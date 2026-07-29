# Integration Notes — AI Block features merged into Blocky_version_12

This document covers (1) what was merged from your teammate's `ai_block_added` project
into your `Blocky_version_12` main project, and (2) the one-time setup steps you need
to run it on Windows.

---

## Quick start (Windows)

### Prerequisites — install once

1. **Docker Desktop** — required for the model converter. Launch it from the Start menu and wait until the whale icon says "Engine running".
2. **Python 3.x** — any modern version (3.10–3.14 all work for the lightweight agent). Heavy ML libs run inside Docker, so your Python version no longer matters.
3. **Node.js** — for `npx cloudflared` and `npx expo`.

### One-time setup (venv & npm)

1. **Backend setup**:
   Open a terminal in the project root:
   ```cmd
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install --upgrade pip
   pip install -r requirements-agent.txt
   cd ..
   ```

2. **Frontend setup**:
   Open a terminal in the project root:
   ```cmd
   cd frontend
   npm install
   cd ..
   ```

> **Note:** Use `requirements-agent.txt` (5 lightweight packages) for your backend venv, **NOT** `requirements.txt`. The full `requirements.txt` is for the Docker build.

### Every time you want to run the app

1. Make sure Docker Desktop is running.
2. In one terminal:
   ```cmd
   cd backend
   python start_backend_tunnel.py
   ```
   First run will take ~10–20 min while Docker builds the converter image. Subsequent runs are fast (cached).

   This single command:
   - Starts the Docker container with `convert_server.py` on port **5001**
   - Starts `windows_agent.py` on port **5002** (handles USB + proxies to Docker)
   - Starts a Cloudflare tunnel pointing at port 5002
   - Auto-writes the new tunnel URL into every `.html` in `frontend/assets/blockly/`

3. In another terminal:
   ```cmd
   cd frontend
   npx expo start --tunnel
   ```

---

## Architecture (so you understand what's happening)

```
Phone/Browser (WebView in your React Native app)
       │
       │  HTTPS request to https://xxx.trycloudflare.com
       ▼
Cloudflare tunnel
       │
       ▼
windows_agent.py  (port 5002, runs in your venv)
       │
       │  Handles directly: /usb-ports, /deploy, /proxy, /k230-get-frame, /health
       │
       │  Proxies these to Docker on port 5001:
       │     POST /convert            → K230 .kmodel
       │     POST /convert-esp32      → ESP32-S3 .tflite
       │     POST /convert-esp32-lite → smaller TFLite variant
       ▼
convert_server.py  (port 5001, runs inside Docker container)
       │
       │  Uses TensorFlow 2.13, tf2onnx, ONNX, nncase-kpu
       │  Does the actual ML model conversion
```

**This is why the CORS errors happened earlier:** the tunnel was working (5002 was up),
but port 5001 wasn't running, so proxy calls failed. The Docker container fixes that.

---

## What was added

Three new features now live in the AI Training screen (`assets/blockly/train.html`):

1. **Export .tflite (ESP32-S3)** — converts trained model to INT8 TFLite for ESP32-S3.
2. **Export Arduino ZIP** — generates 9 ready-to-flash Arduino files. Auto-deploys
   to a DFR1154 board over Web Serial in Chrome/Edge.
3. **K230 camera connect controls** — UI for USB port selection (Auto / refresh)
   and Wi-Fi IP / Port (defaults: `192.168.4.1` / `8080`) for live K230 preview
   and direct model push.

The existing **Export .kmodel (K230)** and **Deploy to K230** buttons are preserved.

---

## Files changed during merge

| Path | Change | Reason |
|------|--------|--------|
| `assets/blockly/train.html` | **Replaced** | New export UI + K230 connect controls. |
| `backend/convert_server.py` | **Replaced** | Adds `/convert-esp32`, `/convert-esp32-lite`. Original endpoints preserved. |
| `backend/windows_agent.py` | **Replaced** | Adds proxy routes for the two new endpoints. |
| `backend/requirements-agent.txt` | **Added** | Lightweight deps for your venv (fastapi, uvicorn, httpx, python-multipart, pyserial). |
| `start_backend_tunnel.py` | **Replaced** | Now starts Docker (port 5001) + windows_agent (port 5002) + Cloudflare tunnel. |
| `wifi_file tranfer/pc_copy_usb.py` | **Replaced** | Updated USB copy logic. |
| `wifi_file tranfer/k230_usb_receive.py` | **Added** | Runs on the K230 board via CanMV. |
| `wifi_file tranfer/usbk230.py` | **Added** | Device-side K230 USB helper. |
| `labels.txt` | **Added** | Sample labels file used by export workflow. |

---

## Files intentionally NOT changed (your main version preserved)

These were different in the teammate's project, but yours was kept because the teammate's was either stripped down or older:

- `assets/blockly/index.html` — yours is 13,094 lines (rich Blockly setup); teammate's was only 2,911. Replacing would have nuked huge amounts of working code.
- `App.js` — yours already loads `train.html` as a WebView correctly. Teammate's dropped `expo-file-system`, `expo-sharing`, `expo-document-picker`, plus other features.
- `package.json` — `train.html` loads TensorFlow.js and JSZip from CDN, so no new npm packages required.
- `assets/blockly/voice.html`, `icons/`, `offline_libs/` — preserved (teammate's were missing).
- `TrainDeployScreen.js` — orphaned legacy file; not imported by `App.js`. Safe to delete.

---

## Files NOT brought over (intentionally skipped)

Per your instruction, only `train.html` was kept from the teammate's many experimental HTML files. Skipped: `train2.html` through `train6.html`, `ai2.html`, `ai_rename.html`, `bothmodel.html`, `chec.html`, `detect_train.html`, `dummy.html`, `picxeltype.html`, `ser*.html`, `wifi.html`, `dp.html`, `file.html`, `web.html`, plus log files and debug images.

---

## Troubleshooting

**"Docker is installed but not responding"** — Open Docker Desktop from the Start menu and wait until it says "Engine running". Then re-run.

**"Docker build failed"** — The first build is ~3 GB and takes 10–20 minutes. If it fails on `nncase-kpu` install, check your internet connection. If it fails earlier, paste the error to me.

**"Could not find python at ...\backend\venv\Scripts\python.exe"** — Run the one-time venv setup commands above.

**Still seeing CORS errors after starting everything** — Check that `docker ps` shows the `blockly-converter` container running. If it crashed silently, look at the logs from `start_backend_tunnel.py`.

**Cloudflare tunnel URL keeps changing** — That's normal for quick tunnels. `start_backend_tunnel.py` auto-rewrites the URL in all your HTML files each time, so you don't have to edit anything manually.

**Known limitation:** `train.html` loads TensorFlow.js and JSZip from CDN (jsdelivr.net), so the training screen needs internet on first load.
