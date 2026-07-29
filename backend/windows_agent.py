from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import tempfile
import os
import ctypes
import string
import shutil
import subprocess
import json
import httpx
import zipfile
import base64
import time
import serial
import serial.tools.list_ports

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve frontend HTML files directly ───────────────────────────────────────
_ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'assets', 'blockly')
_IMG_DIR    = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'assets', 'img')

def _html(name: str) -> FileResponse:
    return FileResponse(os.path.join(_ASSETS_DIR, name), media_type='text/html')

@app.get("/")
async def root():
    return _html('index.html')

@app.get("/train.html")
async def serve_train():
    return _html('train.html')

@app.get("/cam.html")
async def serve_cam():
    return _html('cam.html')

@app.get("/voice.html")
async def serve_voice():
    return _html('voice.html')

@app.get("/index.html")
async def serve_index():
    return _html('index.html')

# ── Drive-letter detection ────────────────────────────────────────────────────

def list_all_drives():
    result = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drive = letter + ":\\"
            try:
                buf = ctypes.create_unicode_buffer(261)
                ctypes.windll.kernel32.GetVolumeInformationW(
                    drive, buf, 261, None, None, None, None, 0)
                result.append((drive, buf.value.strip() or "(no label)"))
            except Exception:
                pass
        bitmask >>= 1
    return result

def find_canmv_drive():
    for drive, label in list_all_drives():
        if label.lower() in ('sdcard', 'data', 'canmv'):
            return drive, label
    return None, None

# ── MTP via PowerShell Shell.Application ─────────────────────────────────────

_PS_LIST = r"""
$shell  = New-Object -ComObject Shell.Application
$myComp = $shell.NameSpace(17)
$out    = [System.Collections.Generic.List[object]]::new()
foreach ($item in $myComp.Items()) {
    $subs = @()
    try { foreach ($s in $item.GetFolder.Items()) { $subs += $s.Name } } catch {}
    $obj = [PSCustomObject]@{ Name = $item.Name; Type = $item.Type; Subs = $subs }
    $out.Add($obj)
}
$out | ConvertTo-Json -Depth 3 -Compress
"""

def ps_list_devices():
    """Return list of dicts with Name/Type/Subs for every item under This PC."""
    r = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", _PS_LIST],
        capture_output=True, text=True, timeout=20)
    if r.returncode != 0 or not r.stdout.strip():
        return []
    try:
        data = json.loads(r.stdout.strip())
        return [data] if isinstance(data, dict) else data
    except Exception:
        return []

def ps_copy_to_mtp(src_file, device_name, subfolder=""):
    """
    Copy src_file into an MTP device (device_name) optionally into subfolder.
    Returns (success: bool, error_msg: str|None).
    """
    src_escaped = src_file.replace("'", "''")

    size_kb = os.path.getsize(src_file) / 1024
    wait_sec = max(2, int(size_kb / 500) + 1)

    sub_nav = ""
    if subfolder:
        sub_nav = f"""
foreach ($s in $ns.Items()) {{
    if ($s.Name -eq '{subfolder}') {{ $ns = $s.GetFolder; break }}
}}"""

    ps = f"""
$shell  = New-Object -ComObject Shell.Application
$myComp = $shell.NameSpace(17)
$device = $null
foreach ($item in $myComp.Items()) {{
    if ($item.Name -like '*{device_name}*') {{ $device = $item; break }}
}}
if (-not $device) {{ Write-Error 'DEVICE_NOT_FOUND'; exit 1 }}

$ns = $device.GetFolder
{sub_nav}

$srcDir  = $shell.NameSpace([System.IO.Path]::GetDirectoryName('{src_escaped}'))
$srcItem = $srcDir.ParseName([System.IO.Path]::GetFileName('{src_escaped}'))
if (-not $srcItem) {{ Write-Error 'SRC_NOT_FOUND'; exit 1 }}

$ns.CopyHere($srcItem)
Start-Sleep -Seconds {wait_sec}
Write-Output 'SUCCESS'
"""
    try:
        timeout = wait_sec + 30
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, text=True, timeout=timeout)
        if "SUCCESS" in r.stdout:
            return True, None
        err = (r.stderr or r.stdout or "Unknown error").strip()
        return False, err
    except subprocess.TimeoutExpired:
        return False, "Timed out — file may be too large or board disconnected."
    except Exception as e:
        return False, str(e)

# ── Serial COM Port Transfer Logic ──────────────────────────────────────────

# ── MicroPython raw REPL constants ───────────────────────────────────────────
REPL_BAUD       = 115200
REPL_CHUNK      = 256          # binary bytes per write call
REPL_DEST_DIR   = '/sdcard/kmodel'
CTRL_C, CTRL_A, CTRL_B, CTRL_D = b'\x03', b'\x01', b'\x02', b'\x04'


def _repl_read_until(ser, ending: bytes, timeout: float = 8) -> bytes:
    """Read from serial until 'ending' is found or timeout."""
    buf = b''
    t0 = time.time()
    while time.time() - t0 < timeout:
        waiting = ser.in_waiting
        b = ser.read(waiting if waiting else 1)
        if b:
            buf += b
            if buf.endswith(ending):
                return buf
    return buf


def _repl_exec(ser, code: str, timeout: float = 20) -> bytes:
    """
    Execute 'code' in MicroPython raw REPL.
    Protocol: send code + Ctrl+D → recv OK<stdout>\x04<stderr>\x04
    Raises Exception if stderr is non-empty.
    """
    ser.write(code.encode('utf-8') + CTRL_D)
    ser.flush()

    # Wait for 'OK' (raw REPL acknowledgement)
    ok = _repl_read_until(ser, b'OK', timeout=5)
    if not ok.endswith(b'OK'):
        raise Exception(f"Raw REPL did not send OK. Got: {ok!r}")

    # Read stdout block (ends with Ctrl+D)
    stdout = _repl_read_until(ser, CTRL_D, timeout)
    # Read stderr block (ends with Ctrl+D)
    stderr = _repl_read_until(ser, CTRL_D, timeout)

    err_text = stderr.rstrip(CTRL_D).strip()
    if err_text:
        raise Exception(f"REPL error: {err_text.decode('utf-8', errors='replace')}")

    return stdout.rstrip(CTRL_D)


def repl_copy(filepath: str, com_port: str, dest_dir: str = REPL_DEST_DIR):
    """
    Transfer a file to K230 using MicroPython raw REPL over serial.
    No custom script required on the board — works with stock CanMV firmware.

    Steps:
      1. Open serial port at 115200 baud
      2. Ctrl+C x2  — interrupt any running script
      3. Ctrl+A     — enter raw REPL mode
      4. mkdir dest_dir (ignore if exists)
      5. open(remote_path, 'wb')
      6. Loop: send base64 chunks via ubinascii.a2b_base64()
      7. close() + os.stat() size verification
      8. Ctrl+B     — exit raw REPL (restore normal REPL)
    """
    filename    = os.path.basename(filepath)
    remote_path = f"{dest_dir}/{filename}"
    file_size   = os.path.getsize(filepath)

    ser = None
    try:
        ser = serial.Serial(com_port, REPL_BAUD, timeout=5)
        time.sleep(0.3)

        # ── Step 1: interrupt any running script ──────────────────────────
        ser.write(CTRL_C + CTRL_C)
        ser.flush()
        time.sleep(0.5)
        ser.reset_input_buffer()

        # ── Step 2: enter raw REPL ────────────────────────────────────────
        ser.write(CTRL_A)
        ser.flush()
        resp = _repl_read_until(ser, b'>', timeout=5)
        if b'raw REPL' not in resp:
            # Try once more after a short pause
            time.sleep(0.3)
            ser.write(CTRL_A)
            ser.flush()
            resp = _repl_read_until(ser, b'>', timeout=5)
        if b'raw REPL' not in resp:
            raise Exception(
                "Could not enter raw REPL.\n"
                "Make sure the board is running CanMV MicroPython firmware."
            )

        print(f"[REPL] Connected to {com_port}. Transferring {filename} ({file_size} bytes) → {remote_path}")

        # ── Step 3: create destination directory ─────────────────────────
        _repl_exec(ser,
            f"import os\n"
            f"try:\n"
            f"    os.mkdir('{dest_dir}')\n"
            f"except OSError:\n"
            f"    pass"
        )

        # ── Step 4: open remote file for writing ──────────────────────────
        _repl_exec(ser, f"__xf = open('{remote_path}', 'wb')")

        # ── Step 5: stream file in base64 chunks ──────────────────────────
        chunks_sent = 0
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(REPL_CHUNK)
                if not chunk:
                    break
                b64 = base64.b64encode(chunk).decode('ascii')
                _repl_exec(ser,
                    f"import ubinascii as _u\n"
                    f"__xf.write(_u.a2b_base64('{b64}'))",
                    timeout=20
                )
                chunks_sent += 1

        print(f"[REPL] {chunks_sent} chunks sent. Closing file…")

        # ── Step 6: close file ────────────────────────────────────────────
        _repl_exec(ser, "__xf.close()")

        # ── Step 7: verify size on board ──────────────────────────────────
        out = _repl_exec(ser, f"import os; print(os.stat('{remote_path}')[6])")
        size_str = out.strip().decode('utf-8', errors='ignore')
        try:
            remote_size = int(size_str)
            if remote_size != file_size:
                raise Exception(
                    f"Size mismatch: sent {file_size} B, board reports {remote_size} B"
                )
        except ValueError:
            pass  # stat output parsing failed — non-fatal

        print(f"[REPL] {filename} transferred successfully ({file_size} B).")

        # ── Step 8: exit raw REPL ─────────────────────────────────────────
        ser.write(CTRL_B)
        ser.flush()
        ser.close()
        return True, None

    except serial.SerialException as e:
        return False, f"Serial port error: {e}"
    except Exception as e:
        if ser:
            try:
                ser.write(CTRL_B)   # try to restore normal REPL before closing
                ser.close()
            except Exception:
                pass
        return False, str(e)


@app.get("/usb-ports")
async def get_usb_ports():
    import asyncio
    # Retry up to 3 times — Windows USB enumeration can lag after a hotplug
    for attempt in range(3):
        ports = serial.tools.list_ports.comports()
        result = [
            {"device": p.device, "description": p.description, "vid": p.vid, "pid": p.pid}
            for p in sorted(ports)
        ]
        if result:
            return {"ports": result}
        if attempt < 2:
            await asyncio.sleep(1)
    return {"ports": []}


@app.post("/deploy")
async def deploy(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
    k230_ip:     str        = Form(default="192.168.169.1"),
    k230_port:   int        = Form(default=8080),
    com_port:    str        = Form(default=""),
):
    print(f"Received deploy request. COM Port: '{com_port}'")
    
    # 1. Forward request to Docker (localhost:5001/convert)
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes  = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            data = {'labels': labels}
            
            resp = await client.post('http://localhost:5001/convert', files=files, data=data)

            if resp.status_code != 200:
                print("Docker compilation failed.")
                return JSONResponse(status_code=500, content={"error": f"Compilation failed: {resp.text}"})
            
            # Save the compiled zip returned by Docker
            zip_path = os.path.join(tmpdir, "compiled.zip")
            with open(zip_path, 'wb') as f:
                f.write(resp.content)
                
            print("Successfully received compiled model from Docker.")
            
            # Extract zip
            extract_dir = os.path.join(tmpdir, "extracted")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
                
            kmodel_path = os.path.join(extract_dir, 'model.kmodel')
            labels_path = os.path.join(extract_dir, 'labels.txt')
            kmodel_size = os.path.getsize(kmodel_path)
            
            # 2. USB Serial / MTP / Mass Storage Logic
            usb_copied = False
            usb_method = None
            
            try:
                if com_port and com_port.strip():
                    print(f"Attempting to deploy via MicroPython REPL on {com_port}...")
                    ok1, err1 = repl_copy(kmodel_path, com_port)
                    if ok1:
                        ok2, err2 = repl_copy(labels_path, com_port)
                        if ok2:
                            usb_copied = True
                            usb_method = "Serial REPL"
                        else:
                            print(f"REPL copy failed for labels: {err2}")
                    else:
                        print(f"REPL copy failed for kmodel: {err1}")
                
                if not usb_copied:
                    print("Checking for K230 USB connection (Mass Storage)...")
                drive, label = find_canmv_drive()
                if drive:
                    print(f"Found USB drive: {drive} (label={label})")
                    dest_dir = drive
                    shutil.copy2(kmodel_path, os.path.join(dest_dir, 'model.kmodel'))
                    shutil.copy2(labels_path, os.path.join(dest_dir, 'labels.txt'))
                    usb_copied = True
                    usb_method = "USB Mass Storage"
                else:
                    print("Checking for K230 MTP connection...")
                    devices = ps_list_devices()
                    canmv_dev = next((d for d in devices if "canmv" in d.get("Name", "").lower()), None)
                    if canmv_dev:
                        print(f"Found MTP device: {canmv_dev['Name']}")
                        subs = canmv_dev.get("Subs", [])
                        
                        subfolder = ""
                        for s in subs:
                            if s.lower() == "sdcard":
                                subfolder = s
                                break

                        print(f"Copying to MTP subfolder: '{subfolder}'")
                        ok1, err1 = ps_copy_to_mtp(kmodel_path, canmv_dev["Name"], subfolder)
                        ok2, err2 = ps_copy_to_mtp(labels_path, canmv_dev["Name"], subfolder)
                        
                        if ok1 and ok2:
                            usb_copied = True
                            usb_method = "MTP"
                        else:
                            print(f"MTP copy failed. kmodel: {err1}, labels: {err2}")
            except Exception as e:
                print(f"USB detection/copy failed: {e}")

            if usb_copied:
                print(f"Successfully deployed via {usb_method}")
                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "ok",
                        "kmodel_size": kmodel_size,
                        "deployed": ["model.kmodel", "labels.txt"],
                        "method": usb_method
                    }
                )

            # Fallback: Push to K230 via Wi-Fi HTTP
            k230_url = f"http://{k230_ip}:{k230_port}/upload"
            print(f"USB not found or failed. Pushing to K230 at {k230_url} via Wi-Fi...")
            
            with open(kmodel_path, 'rb') as f:
                kmodel_data = f.read()
            with open(labels_path, 'rb') as f:
                labels_data = f.read()

            k_resp = await client.post(k230_url, content=kmodel_data, headers={'X-Filename': 'model.kmodel', 'Content-Type': 'application/octet-stream'})
            l_resp = await client.post(k230_url, content=labels_data, headers={'X-Filename': 'labels.txt', 'Content-Type': 'application/octet-stream'})
            
            if k_resp.status_code != 200 or l_resp.status_code != 200:
                return JSONResponse(status_code=502, content={"error": "Failed to upload to K230 over Wi-Fi"})

            return JSONResponse(
                status_code=200,
                content={
                    "status": "ok",
                    "kmodel_size": kmodel_size,
                    "deployed": ["model.kmodel", "labels.txt"],
                    "method": "Wi-Fi"
                }
            )

    except Exception as e:
        print(f"Error: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/convert")
async def convert(
    model_json:       UploadFile = File(...),
    weights_bin:      UploadFile = File(...),
    labels:           str        = Form(...),
    calibration_bin:  UploadFile = File(default=None),
    calibration_count: int       = Form(default=0),
):
    print("Proxying /convert to Docker compiler...")
    try:
        model_json_bytes  = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            if calibration_bin is not None:
                cal_bytes = await calibration_bin.read()
                files['calibration_bin'] = (calibration_bin.filename, cal_bytes, calibration_bin.content_type)
            data = {'labels': labels, 'calibration_count': str(calibration_count)}
            resp = await client.post('http://localhost:5001/convert', files=files, data=data)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})

@app.post("/convert-voice")
async def convert_voice(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
):
    print("Proxying /convert-voice to Docker compiler...")
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            data = {'labels': labels}
            resp = await client.post('http://localhost:5001/convert-voice', files=files, data=data)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker or remote service: {e}"})


@app.post("/convert-tiny")
async def convert_tiny_voice(
    dataset_zip:  UploadFile = File(...),
    labels:       str        = Form(default="[]"),
    epochs:       int        = Form(default=60),
):
    print("Proxying /convert-tiny to Docker compiler...")
    try:
        dataset_zip_bytes = await dataset_zip.read()
        async with httpx.AsyncClient(timeout=600.0) as client:
            files = {
                'dataset_zip': (dataset_zip.filename, dataset_zip_bytes, dataset_zip.content_type),
            }
            data = {
                'labels': labels,
                'epochs': str(epochs)
            }
            resp = await client.post('http://localhost:5001/convert-tiny', files=files, data=data)
            from fastapi.responses import Response
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})


@app.post("/convert-voice-esp32")
async def convert_voice_esp32(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
):
    print("Proxying /convert-voice-esp32 to Docker compiler...")
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            data = {'labels': labels}
            resp = await client.post('http://localhost:5001/convert-voice-esp32', files=files, data=data)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})


@app.post("/convert-pose")
async def convert_pose(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
):
    print("Proxying /convert-pose to Docker compiler...")
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            data = {'labels': labels}
            resp = await client.post('http://localhost:5001/convert-pose', files=files, data=data)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})


@app.post("/convert-gesture")
async def convert_gesture(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
):
    print("Proxying /convert-gesture to Docker compiler...")
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            data = {'labels': labels}
            resp = await client.post('http://localhost:5001/convert-gesture', files=files, data=data)
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})


@app.post("/convert-esp32")
async def convert_esp32(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
    input_size:  int        = Form(default=96),
    calibration_bin: UploadFile = File(default=None),
    calibration_count: int = Form(default=0),
):
    print(f"Proxying /convert-esp32 to Docker compiler (input_size={input_size})...")
    try:
        model_json_bytes  = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            if calibration_bin is not None:
                cal_bytes = await calibration_bin.read()
                files['calibration_bin'] = (calibration_bin.filename, cal_bytes, calibration_bin.content_type)
            data = {
                'labels': labels,
                'input_size': str(input_size),
                'calibration_count': str(calibration_count)
            }
            resp = await client.post('http://localhost:5001/convert-esp32', files=files, data=data)
            from fastapi.responses import Response
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})


@app.post("/convert-esp32-lite")
async def convert_esp32_lite(
    model_json:  UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels:      str        = Form(...),
    input_size:  int        = Form(default=96),
    calibration_bin: UploadFile = File(default=None),
    calibration_count: int = Form(default=0),
):
    print(f"Proxying /convert-esp32-lite to Docker compiler (input_size={input_size})...")
    try:
        model_json_bytes  = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        async with httpx.AsyncClient(timeout=300.0) as client:
            files = {
                'model_json': (model_json.filename, model_json_bytes, model_json.content_type),
                'weights_bin': (weights_bin.filename, weights_bin_bytes, weights_bin.content_type),
            }
            if calibration_bin is not None:
                cal_bytes = await calibration_bin.read()
                files['calibration_bin'] = (calibration_bin.filename, cal_bytes, calibration_bin.content_type)
            data = {
                'labels': labels,
                'input_size': str(input_size),
                'calibration_count': str(calibration_count)
            }
            resp = await client.post('http://localhost:5001/convert-esp32-lite', files=files, data=data)
            from fastapi.responses import Response

            if resp.status_code == 200:
                import io, zipfile, json
                try:
                    # Extract original model.tflite
                    with zipfile.ZipFile(io.BytesIO(resp.content), 'r') as zf:
                        tflite_filename = next(f for f in zf.namelist() if f.endswith('model.tflite'))
                        tflite_bytes = zf.read(tflite_filename)

                    # Parse labels
                    try:
                        label_list = json.loads(labels)
                    except:
                        label_list = [l.strip() for l in labels.split(',')]

                    from convert_server import make_teachable_machine_arduino_zip
                    new_zip_bytes = make_teachable_machine_arduino_zip(tflite_bytes, label_list)

                    return Response(
                        content=new_zip_bytes,
                        status_code=200,
                        media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="tm_arduino_model.zip"'}
                    )
                except Exception as ex:
                    print("Error intercepting zip:", ex)
                    import traceback
                    with open("error_log.txt", "w") as f:
                        f.write(str(ex) + "\\n")
                        traceback.print_exc(file=f)

            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("Content-Type", "application/zip")
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})

@app.post("/train-mobilenetv3-esp32")
async def train_mobilenetv3_esp32_proxy(request: Request):
    """Pass-through proxy to the Docker compiler's MobileNetV3 trainer.
    Forwards the multipart body untouched (many image files)."""
    print("Proxying /train-mobilenetv3-esp32 to Docker compiler...")
    try:
        body = await request.body()
        headers = {"content-type": request.headers.get("content-type", "")}
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.post(
                "http://localhost:5001/train-mobilenetv3-esp32",
                content=body, headers=headers,
            )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("Content-Type", "application/zip"),
            headers={
                k: v for k, v in resp.headers.items()
                if k.lower() in (
                    "content-disposition",
                    "x-train-accuracy",
                    "x-val-accuracy",
                    "x-tflite-accuracy",
                    "x-val-count",
                    "access-control-expose-headers",
                )
            },
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to proxy to Docker: {e}"})


@app.post("/train-mobilenetv3-k230")
async def train_mobilenetv3_k230_proxy(request: Request):
    """Forward the many-image 96x96 K230 training request unchanged."""
    print("Proxying /train-mobilenetv3-k230 to Docker compiler...")
    try:
        body = await request.body()
        headers = {"content-type": request.headers.get("content-type", "")}
        async with httpx.AsyncClient(timeout=900.0) as client:
            resp = await client.post(
                "http://localhost:5001/train-mobilenetv3-k230",
                content=body,
                headers=headers,
            )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("Content-Type", "application/zip"),
            headers={
                key: value
                for key, value in resp.headers.items()
                if key.lower()
                in (
                    "content-disposition",
                    "x-train-accuracy",
                    "x-val-accuracy",
                    "x-val-count",
                    "x-model-input",
                    "access-control-expose-headers",
                )
            },
        )
    except Exception as error:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to proxy K230 96x96 training to Docker: {error}"},
        )


@app.post("/qr-transfer")
async def qr_transfer_proxy(request: Request):
    """Create a short-lived QR transfer ticket in the Docker backend."""
    print("Proxying /qr-transfer to Docker compiler...")
    try:
        body = await request.body()
        headers = {"content-type": request.headers.get("content-type", "")}
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                "http://localhost:5001/qr-transfer",
                content=body,
                headers=headers,
            )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("Content-Type", "application/json"),
            headers={"Cache-Control": "no-store"},
        )
    except Exception as error:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to create QR transfer ticket: {error}"},
        )


@app.get("/proxy")
async def proxy_cam(url: str):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"http://localhost:5001/proxy?url={url}")
            from fastapi.responses import Response, StreamingResponse
            
            # For MJPEG streams, we need to stream the response
            if "multipart/x-mixed-replace" in resp.headers.get("Content-Type", ""):
                async def stream_generator():
                    async with client.stream("GET", f"http://localhost:5001/proxy?url={url}") as stream_resp:
                        async for chunk in stream_resp.aiter_bytes():
                            yield chunk
                return StreamingResponse(
                    stream_generator(),
                    media_type=resp.headers.get("Content-Type"),
                    headers={"Access-Control-Allow-Origin": "*"}
                )
            
            return Response(
                content=resp.content, 
                status_code=resp.status_code, 
                media_type=resp.headers.get("Content-Type", "image/jpeg"),
                headers={"Access-Control-Allow-Origin": "*"}
            )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

import threading
import time

camera_state = {
    "com_port": None,
    "ser": None,
    "latest_frame": None,
    "last_access": 0,
    "thread": None,
    "running": False
}

def log_k230(msg):
    import sys
    print(msg)
    sys.stdout.flush()
    try:
        with open("k230_debug.log", "a") as f:
            f.write(str(time.time()) + " " + msg + "\n")
    except:
        pass

def camera_worker(com_port):
    log_k230(f"[{com_port}] Starting background camera thread...")
    try:
        ser = serial.Serial()
        ser.port = com_port
        ser.baudrate = 115200
        ser.timeout = 1.0
        ser.open()
        try:
            ser.setDTR(True)
            ser.setRTS(True)
        except:
            pass
        time.sleep(0.5)
        camera_state["ser"] = ser

        # Keep last_access alive during the slow boot so the inactivity timer
        # doesn't fire before the first frame arrives.
        camera_state["last_access"] = time.time()

        # Interrupt any running script and wait for friendly REPL prompt
        try:
            ser.write(b'\x03\x03')
        except Exception as e:
            log_k230(f"[{com_port}] Warning: Failed to send Ctrl+C: {e}")

        log_k230(f"[{com_port}] Waiting for REPL prompt...")

        t_boot = time.time()
        boot_out = b""
        while time.time() - t_boot < 15:
            camera_state["last_access"] = time.time()  # keep alive during boot
            try:
                ser.write(b'\x03')
                if ser.in_waiting:
                    boot_out += ser.read(ser.in_waiting)
                    if b'>>>' in boot_out:
                        log_k230(f"[{com_port}] Friendly REPL prompt found.")
                        break
            except Exception:
                pass
            time.sleep(0.1)

        # Enter raw REPL and verify
        try:
            ser.write(b'\x01')
            time.sleep(0.3)
            raw_ack = b""
            t_raw = time.time()
            while time.time() - t_raw < 2.0:
                if ser.in_waiting:
                    raw_ack += ser.read(ser.in_waiting)
                    if b'raw REPL' in raw_ack or b'>' in raw_ack:
                        log_k230(f"[{com_port}] Raw REPL entered.")
                        break
                time.sleep(0.05)
        except Exception as e:
            log_k230(f"[{com_port}] Warning: raw REPL entry error: {e}")

        # Update last_access after boot so the frame-loop timer starts fresh
        camera_state["last_access"] = time.time()

        script = b"""\r\nimport time, gc
try:
    import ubinascii as binascii
except:
    import binascii
try:
    from media.sensor import *
    from media.media import MediaManager
except Exception as e:
    print('INIT_ERR:import:' + str(e))
    raise SystemExit
print('BOOT_OK')
try:
    if 'sensor' in globals():
        try: sensor.stop()
        except: pass
except: pass
try: MediaManager.deinit()
except: pass
time.sleep(0.3)
sensor = None
_use_chn = True
_cam_id = None
_af_enabled = False
def _try_cam(cid):
    global sensor, _use_chn, _af_enabled
    s = None
    af = False
    try:
        s = Sensor() if cid is None else Sensor(id=cid)
        s.reset()
        if cid == 0:
            try:
                s.auto_focus(True)
                af = True
            except Exception as af_error:
                print('AF_FAIL:' + str(af_error))
        try:
            s.set_framesize(width=320, height=240, chn=CAM_CHN_ID_0)
            s.set_pixformat(PIXEL_FORMAT_RGB_565, chn=CAM_CHN_ID_0)
            uc = True
        except Exception as e:
            s.set_framesize(width=320, height=240)
            s.set_pixformat(Sensor.RGB565)
            uc = False
        MediaManager.init()
        s.run()
        time.sleep(0.5)
        img = s.snapshot(chn=CAM_CHN_ID_0) if uc else s.snapshot()
        if img is None or img == -1:
            raise OSError('no frame')
        sensor = s
        _use_chn = uc
        _af_enabled = af
        return True
    except Exception as e:
        print('CAM_TRY_FAIL:' + str(cid) + ':' + str(e))
        try: s.stop()
        except: pass
        try: MediaManager.deinit()
        except: pass
        time.sleep(0.5)
        return False
for _cid in (None, 0, 1):
    if _try_cam(_cid):
        _cam_id = _cid
        break
if sensor is None:
    print('INIT_ERR:no camera found on main/cam0/cam1')
    raise SystemExit
print('CAM_ID:' + ('main' if _cam_id is None else 'cam' + str(_cam_id)))
print('AF_STATUS:' + ('enabled' if _af_enabled else 'off'))
print('CAM_READY')
while True:
    try:
        img = sensor.snapshot(chn=CAM_CHN_ID_0) if _use_chn else sensor.snapshot()
        try:
            img_bytes = bytes(img.compress(quality=50))
        except Exception:
            img_bytes = bytes(img.to_jpeg(quality=50))
        print('IMG_START:' + binascii.b2a_base64(img_bytes).decode('utf-8').strip() + ':IMG_END')
        gc.collect()
    except Exception as e:
        print('FRAME_ERR:' + str(e))
        time.sleep(0.5)
\r\n"""
        ser.write(script)
        ser.write(b'\x04')
        log_k230(f"[{com_port}] Camera script injected, waiting for frames...")

        out = b""
        while camera_state["running"]:
            try:
                if ser.in_waiting:
                    out += ser.read(ser.in_waiting)
                    if b':IMG_END' in out:
                        parts = out.split(b':IMG_END')
                        for i in range(len(parts) - 1):
                            chunk = parts[i]
                            if b'IMG_START:' in chunk:
                                try:
                                    text_before = chunk.split(b'IMG_START:')[0].decode('utf-8', errors='ignore').strip()
                                    if text_before:
                                        log_k230(f"[K230] {text_before}")

                                    b64 = chunk.split(b'IMG_START:')[1]
                                    jpg = base64.b64decode(b64)
                                    camera_state["latest_frame"] = jpg
                                except:
                                    pass
                        out = parts[-1]
                    else:
                        # Only log as error if we're NOT accumulating a partial frame.
                        # Base64 JPEG data frequently contains "ERR" as a substring,
                        # so checking while IMG_START is in out gives false positives.
                        if b'IMG_START:' not in out:
                            if b'ERR' in out or b'Traceback' in out:
                                log_k230(f"[K230 ERROR] {out.decode('utf-8', errors='ignore')}")
                                out = b""
                        elif len(out) > 200_000:
                            # Safety valve: drop oversized partial buffer (stalled frame)
                            out = b""

                    time.sleep(0.01)

                # Auto-stop after 30 s of no active API requests
                if time.time() - camera_state["last_access"] > 30.0:
                    log_k230(f"[{com_port}] Camera stream timed out due to inactivity. Shutting down.")
                    camera_state["running"] = False
                    break
            except Exception as e:
                log_k230(f"[{com_port}] Serial read error: {e}")
                break
                
    except Exception as e:
        import traceback
        log_k230(f"[{com_port}] Camera initialization failed: {e}")
        traceback.print_exc()
        
    # Cleanup
    try:
        if camera_state["ser"]:
            camera_state["ser"].write(b'\x03\x02')
            camera_state["ser"].close()
    except:
        pass
    camera_state["ser"] = None
    camera_state["thread"] = None
    camera_state["running"] = False

@app.get("/k230-get-frame")
def k230_get_frame(com_port: str):
    if not com_port:
        return JSONResponse(status_code=400, content={"error": "COM port required"})
        
    camera_state["last_access"] = time.time()
    
    # If the camera is not running or on a different port, start the background thread
    if camera_state["com_port"] != com_port or not camera_state["running"]:
        log_k230(f"API Request triggered thread start. current_com={camera_state['com_port']}, new_com={com_port}, running={camera_state['running']}")
        if camera_state["thread"] and camera_state["thread"].is_alive():
            # Stop the old thread first
            log_k230("Stopping old thread...")
            camera_state["running"] = False
            camera_state["thread"].join(timeout=1.0)
            
        camera_state["com_port"] = com_port
        camera_state["running"] = True
        camera_state["latest_frame"] = None
        
        camera_state["thread"] = threading.Thread(target=camera_worker, args=(com_port,))
        camera_state["thread"].daemon = True
        camera_state["thread"].start()

    # Wait up to 15 s for the first frame (K230 boot takes ~10 s).
    # Keep last_access alive while we wait so the inactivity timer in the
    # camera_worker thread doesn't fire before a frame arrives.
    t0 = time.time()
    while time.time() - t0 < 15.0:
        camera_state["last_access"] = time.time()
        if camera_state["latest_frame"]:
            from fastapi.responses import Response
            return Response(content=camera_state["latest_frame"], media_type="image/jpeg", headers={"Access-Control-Allow-Origin": "*"})
        time.sleep(0.05)

    return JSONResponse(status_code=504, content={"error": "Timeout waiting for frame from K230"})

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Windows USB Agent"}

# ── Serve all static assets (JS, CSS, images, fonts) ─────────────────────────
# /assets/img must be mounted before "/" so it takes priority over the catch-all.
app.mount("/assets/img", StaticFiles(directory=_IMG_DIR), name="assets_img")
# Must be LAST so API routes defined above take priority over file serving.
app.mount("/", StaticFiles(directory=_ASSETS_DIR, html=True), name="static")
