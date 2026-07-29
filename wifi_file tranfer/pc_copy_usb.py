"""
pc_copy_usb.py — runs on WINDOWS PC
Copies files to the CanMV K230 board via USB.
Works with both USB Mass Storage (drive letter) and MTP portable devices.
"""

import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import shutil, os, string, subprocess, ctypes, json, threading

DEFAULT_SUBFOLDER = "sdcard"   # change this if your board uses "data" instead


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

    # Estimate wait time from file size: assume ~500 KB/s MTP speed, min 2 s
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


# ── GUI ───────────────────────────────────────────────────────────────────────

class CopyApp:
    def __init__(self, root):
        self.root = root
        root.title("USB File Copy → K230")
        root.geometry("560x400")
        root.resizable(False, False)

        tk.Label(root, text="K230 USB File Copy", font=("Arial", 14, "bold")).pack(pady=8)

        # ── Device selector ──────────────────────────────────────────────────
        dev_frame = tk.LabelFrame(root, text="Detected USB / MTP devices", font=("Arial", 9))
        dev_frame.pack(padx=14, pady=4, fill=tk.X)

        self.device_list = tk.Listbox(dev_frame, height=4, font=("Courier", 9))
        self.device_list.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=4, pady=4)
        self.device_list.bind("<<ListboxSelect>>", self._on_device_select)

        sb = tk.Scrollbar(dev_frame, command=self.device_list.yview)
        sb.pack(side=tk.LEFT, fill=tk.Y)
        self.device_list.config(yscrollcommand=sb.set)

        tk.Button(dev_frame, text="Refresh", command=self.refresh_devices).pack(
            side=tk.LEFT, padx=6)

        # ── Subfolder row ────────────────────────────────────────────────────
        sub_frame = tk.Frame(root)
        sub_frame.pack(padx=14, pady=2, fill=tk.X)
        tk.Label(sub_frame, text="Sub-folder on device:").pack(side=tk.LEFT)
        self.sub_var = tk.StringVar(value="(root)")
        self.sub_combo = ttk.Combobox(sub_frame, textvariable=self.sub_var,
                                       width=20, state="readonly")
        self.sub_combo.pack(side=tk.LEFT, padx=6)

        # ── File row ─────────────────────────────────────────────────────────
        file_frame = tk.Frame(root)
        file_frame.pack(padx=14, pady=6, fill=tk.X)
        tk.Label(file_frame, text="File:", width=6).pack(side=tk.LEFT)
        self.file_var = tk.StringVar(value="(no file selected)")
        tk.Label(file_frame, textvariable=self.file_var, anchor='w',
                 relief=tk.SUNKEN, width=44).pack(side=tk.LEFT, padx=4)
        tk.Button(file_frame, text="Browse...", command=self.browse_file).pack(side=tk.LEFT)

        # ── Status ───────────────────────────────────────────────────────────
        self.status_var = tk.StringVar(value="Scanning devices…")
        self.status_lbl = tk.Label(root, textvariable=self.status_var,
                                    wraplength=530, fg="navy", font=("Arial", 9),
                                    justify=tk.LEFT)
        self.status_lbl.pack(pady=4)

        # ── Copy button ──────────────────────────────────────────────────────
        self.copy_btn = tk.Button(root, text="Copy to K230",
                                   font=("Arial", 11, "bold"),
                                   bg="#e07b00", fg="white",
                                   command=self.do_copy, state=tk.DISABLED)
        self.copy_btn.pack(pady=8)

        # Internal state
        self.selected_file  = None
        self.selected_device = None   # dict with Name/Type/Subs  OR  ('drive', letter)
        self._devices = []            # all items returned by ps_list_devices

        self.refresh_devices()

    # ── Device detection ──────────────────────────────────────────────────────

    def refresh_devices(self):
        self.set_status("Scanning… please wait.", "navy")
        self.copy_btn.config(state=tk.DISABLED)
        self.device_list.delete(0, tk.END)
        threading.Thread(target=self._scan_thread, daemon=True).start()

    def _scan_thread(self):
        drive, label = find_canmv_drive()
        all_dev = ps_list_devices()
        self.root.after(0, self._populate_devices, drive, label, all_dev)

    def _populate_devices(self, canmv_drive, canmv_label, all_dev):
        self._devices = []
        self.device_list.delete(0, tk.END)

        # ── Add drive-letter entry if found ──────────────────────────────────
        if canmv_drive:
            entry = {"_type": "drive", "Name": canmv_label,
                     "drive": canmv_drive, "Subs": []}
            self._devices.append(entry)
            self.device_list.insert(tk.END,
                f"[DRIVE] {canmv_drive}  label={canmv_label}")
            self.device_list.itemconfig(tk.END, fg="darkgreen")

        # ── Add all Shell.Application items ──────────────────────────────────
        for dev in all_dev:
            dev["_type"] = "mtp"
            self._devices.append(dev)
            subs = ", ".join(dev.get("Subs", [])) or "—"
            marker = " ★" if "canmv" in dev["Name"].lower() else ""
            self.device_list.insert(tk.END,
                f"[MTP]   {dev['Name']}{marker}   ({dev['Type']})   subs: {subs}")
            if marker:
                self.device_list.itemconfig(tk.END, fg="darkgreen")

        if not self._devices:
            self.set_status(
                "No devices found.\n"
                "Make sure the board is plugged in, then click Refresh.", "red")
        else:
            self.set_status(
                f"Found {len(self._devices)} device(s). "
                "Select the CanMV entry (★) then pick a sub-folder.", "navy")

        # Auto-select the first CanMV-labelled entry
        for i, d in enumerate(self._devices):
            if "canmv" in d["Name"].lower():
                self.device_list.selection_set(i)
                self.device_list.see(i)
                self._on_device_select(None)
                break

    def _on_device_select(self, _event):
        sel = self.device_list.curselection()
        if not sel:
            return
        dev = self._devices[sel[0]]
        self.selected_device = dev

        subs = dev.get("Subs", [])
        options = ["(root)"] + subs
        self.sub_combo["values"] = options

        # Default to DEFAULT_SUBFOLDER if present, else root
        match = next((s for s in subs if s.lower() == DEFAULT_SUBFOLDER.lower()), None)
        self.sub_var.set(match if match else "(root)")

        self._update_copy_btn()
        self.set_status(
            f"Selected: {dev['Name']}   sub-folders: {subs or 'none (root only)'}",
            "green")

    # ── File selection ────────────────────────────────────────────────────────

    def browse_file(self):
        path = filedialog.askopenfilename(title="Select file to copy to K230")
        if path:
            self.selected_file = path
            self.file_var.set(os.path.basename(path))
            self._update_copy_btn()
            self.set_status(f"Ready: {os.path.basename(path)}", "navy")

    def _update_copy_btn(self):
        ok = bool(self.selected_file and self.selected_device)
        self.copy_btn.config(state=tk.NORMAL if ok else tk.DISABLED)

    # ── Copy ──────────────────────────────────────────────────────────────────

    def do_copy(self):
        if not self.selected_file or not self.selected_device:
            return

        dev      = self.selected_device
        subfolder = self.sub_var.get()
        if subfolder == "(root)":
            subfolder = ""

        size_mb = os.path.getsize(self.selected_file) / (1024 * 1024)
        self.set_status(f"Copying {size_mb:.2f} MB — please wait…", "navy")
        self.copy_btn.config(state=tk.DISABLED)
        self.root.update()

        # Drive-letter path: fast shutil copy
        if dev["_type"] == "drive":
            dest_dir  = os.path.join(dev["drive"], subfolder) if subfolder else dev["drive"]
            dest_file = os.path.join(dest_dir, os.path.basename(self.selected_file))
            try:
                os.makedirs(dest_dir, exist_ok=True)
                shutil.copy2(self.selected_file, dest_file)
                self.set_status(f"Done!  Saved to {dest_file}", "green")
            except Exception as e:
                self.set_status(f"Copy failed: {e}", "red")
            finally:
                self.copy_btn.config(state=tk.NORMAL)
            return

        # MTP path: PowerShell copy (runs in thread so GUI stays responsive)
        def _mtp_thread():
            ok, err = ps_copy_to_mtp(self.selected_file, dev["Name"], subfolder)
            self.root.after(0, self._mtp_done, ok, err)

        threading.Thread(target=_mtp_thread, daemon=True).start()

    def _mtp_done(self, ok, err):
        self.copy_btn.config(state=tk.NORMAL)
        if ok:
            self.set_status(
                f"Done!  {os.path.basename(self.selected_file)} copied to K230.", "green")
        else:
            self.set_status(
                f"MTP copy failed: {err}\n"
                "Try: open Explorer → CanMV → sdcard, then drag the file manually.",
                "red")

    # ── Helpers ───────────────────────────────────────────────────────────────

    def set_status(self, msg, color="navy"):
        self.status_var.set(msg)
        self.status_lbl.config(fg=color)


if __name__ == '__main__':
    root = tk.Tk()
    app = CopyApp(root)
    root.mainloop()