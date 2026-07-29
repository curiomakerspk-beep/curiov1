# Blockly STEM AI Platform — Project Report

**Project Directory:** `blockly_img_voice-model`
**Report Date:** 2026-06-07
**Author Analysis By:** Claude Sonnet 4.6

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Module-by-Module Breakdown](#4-module-by-module-breakdown)
   - 4.1 [React Native Frontend (App.js)](#41-react-native-frontend-appjs)
   - 4.2 [Blockly Workspace (index.html)](#42-blockly-workspace-indexhtml)
   - 4.3 [AI Training Screens](#43-ai-training-screens)
   - 4.4 [Backend — Windows Agent](#44-backend--windows-agent)
   - 4.5 [Backend — Convert Server (Docker)](#45-backend--convert-server-docker)
   - 4.6 [Model Compiler (nncase_compile.py)](#46-model-compiler-nncase_compilepy)
   - 4.7 [K230 MicroPython Library Stack](#47-k230-micropython-library-stack)
   - 4.8 [K230 Scripts](#48-k230-scripts)
   - 4.9 [ESP32-S3 Firmware (frimware_full.cpp)](#49-esp32-s3-firmware-frimware_fullcpp)
   - 4.10 [Wi-Fi File Transfer Utilities](#410-wi-fi-file-transfer-utilities)
   - 4.11 [Tunnel & Startup Scripts](#411-tunnel--startup-scripts)
5. [Key Data Flows](#5-key-data-flows)
   - 5.1 [Image Model: Training → Deployment](#51-image-model-training--deployment)
   - 5.2 [Voice Model: Training → Deployment](#52-voice-model-training--deployment)
   - 5.3 [Pose Model: Training → Deployment](#53-pose-model-training--deployment)
   - 5.4 [Blockly Code → Robot Board](#54-blockly-code--robot-board)
   - 5.5 [K230 Live Camera Preview](#55-k230-live-camera-preview)
6. [Communication Protocols](#6-communication-protocols)
7. [ML Pipeline Deep Dive](#7-ml-pipeline-deep-dive)
8. [API Endpoint Reference](#8-api-endpoint-reference)
9. [Hardware Support Matrix](#9-hardware-support-matrix)
10. [File Inventory](#10-file-inventory)
11. [Design Patterns & Key Decisions](#11-design-patterns--key-decisions)
12. [Setup & Run Guide](#12-setup--run-guide)
13. [Known Limitations](#13-known-limitations)

---

## 1. Executive Summary

The **Blockly STEM AI Platform** is an end-to-end educational robotics and machine-learning system designed for classrooms and maker communities. It allows users to:

- **Visually program robots** using Google Blockly (drag-and-drop blocks that generate MicroPython code)
- **Train custom AI models** in the browser — image classification, voice/keyword recognition, and body-pose classification — with zero coding required
- **Deploy trained models** directly to embedded hardware (Kendryte K230 AI camera board and DFRobot DFR1154 ESP32-S3) over USB, MTP, or Wi-Fi
- **Connect to robot boards** via Bluetooth Low Energy (BLE) or USB Serial and send the generated code wirelessly

The system spans a **React Native mobile app** (the primary interface), a **Python FastAPI backend** running locally on Windows (behind a Cloudflare tunnel so phones can reach it), a **Docker container** for heavy ML work, and **MicroPython libraries** that run on the K230 hardware.

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER'S PHONE / BROWSER                        │
│                                                                      │
│   React Native App (Expo)  ─  frontend/App.js                       │
│   ┌───────────────────────────────────────────────────────────┐      │
│   │  WebView Stack (all always-mounted, opacity-switched)     │      │
│   │  ┌─────────────────┐  ┌─────────────────────────────┐    │      │
│   │  │ index.html       │  │ train_picker.html  (z:30)   │    │      │
│   │  │ Blockly Workspace│  │ Choose: Image/Voice/Pose    │    │      │
│   │  │ (z-index: 0)     │  └─────────────────────────────┘    │      │
│   │  └─────────────────┘  ┌─────────────────────────────┐    │      │
│   │                        │ train.html        (z:20)    │    │      │
│   │                        │ Image Classification        │    │      │
│   │                        ├─────────────────────────────┤    │      │
│   │                        │ train_voice_v2.html (z:20)  │    │      │
│   │                        │ Voice / Keyword Training    │    │      │
│   │                        ├─────────────────────────────┤    │      │
│   │                        │ pose.html          (z:20)   │    │      │
│   │                        │ Body Pose Training          │    │      │
│   │                        └─────────────────────────────┘    │      │
│   └───────────────────────────────────────────────────────────┘      │
│                │ postMessage bridge                                   │
└────────────────┼─────────────────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼
┌─────────────┐    ┌──────────────────────────────────────────────────┐
│ Robot Boards│    │  Windows PC (USER'S LAPTOP)                      │
│             │    │                                                  │
│  Via BLE    │    │  backend/start_backend_tunnel.py                 │
│  NUS 6e400001    │  ┌─────────────────────────────────────────────┐ │
│  @@START/END│    │  │ windows_agent.py — FastAPI  (port 5002)     │ │
│  chunked    │    │  │  • USB REPL transfer to K230                │ │
│             │    │  │  • MTP copy via PowerShell COM              │ │
│  Via USB    │    │  │  • Mass storage drive detection             │ │
│  115200 baud│    │  │  • K230 camera streaming (serial thread)    │ │
│  PYCODE hdr │    │  │  • Proxies ML endpoints → Docker 5001       │ │
│             │    │  │  • Serves HTML files for browser mode       │ │
└─────────────┘    │  └─────────────────────────────────────────────┘ │
                   │              │ Cloudflare Tunnel                  │
                   │              ▼ (URL auto-injected into HTML)      │
                   │  ┌─────────────────────────────────────────────┐ │
                   │  │ convert_server.py — FastAPI  (port 5001)    │ │
                   │  │  Inside Docker container "blockly-converter" │ │
                   │  │  • TensorFlow 2.13 + TF Hub                 │ │
                   │  │  • tf2onnx conversion                       │ │
                   │  │  • nncase-kpu K230 compiler                 │ │
                   │  │  • TFLite INT8 PTQ for ESP32-S3             │ │
                   │  │  • Server-side voice training               │ │
                   │  └─────────────────────────────────────────────┘ │
                   └──────────────────────────────────────────────────┘
                                        │
                              ┌─────────┴──────────┐
                              ▼                    ▼
                    ┌─────────────────┐   ┌──────────────────┐
                    │ Kendryte K230   │   │ ESP32-S3 DFR1154  │
                    │ (CanMV / K230D) │   │ (DFRobot board)   │
                    │ MicroPython     │   │ TFLite Micro       │
                    │ nncase runtime  │   │ OV2640 camera      │
                    │ libs/ stack     │   │ PDM microphone     │
                    └─────────────────┘   └──────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Mobile App | React Native (Expo) | Expo SDK 54, RN 0.81.5 |
| UI Framework | React | 19.1.0 |
| Blockly | Google Blockly | Bundled (offline_libs) |
| Browser ML | TensorFlow.js | 4.10.0 (CDN) |
| Voice Model | TF Speech Commands | 0.5.4 (CDN) |
| Pose Detection | MoveNet (pose-detection) | 2.1.3 (CDN) |
| ZIP packaging | JSZip | 3.10.1 (CDN) |
| BLE | react-native-ble-plx | 3.5.0 |
| USB Serial | rn-usb-serial | runtime lazy-load |
| File sharing | expo-sharing, expo-document-picker | 14.0.x |
| Backend framework | FastAPI + Uvicorn | Python 3.x |
| ML conversion | TensorFlow 2.13, tf2onnx | Inside Docker |
| K230 compiler | nncase-kpu | Inside Docker |
| K230 runtime | nncase_runtime, ulab | MicroPython CanMV |
| ESP32 runtime | TFLite Micro | Arduino/ESP-IDF |
| Tunnel | Cloudflare (cloudflared npx) | Quick tunnels |
| Containerisation | Docker Desktop | Windows host |

---

## 4. Module-by-Module Breakdown

### 4.1 React Native Frontend (App.js)

**Location:** `frontend/App.js`

This is the single root component of the entire mobile application. It has no navigation library — screens are implemented as **always-mounted WebViews** layered with `z-index` and toggled via `opacity` and `pointerEvents`. This design choice is intentional: unmounting a training WebView would destroy TF.js model weights held in browser memory.

#### WebView Layout

| WebView | Source | z-index | Ref |
|---|---|---|---|
| Blockly Workspace | `index.html` | 0 (base) | `blocklyRef` |
| Image Training | `train.html` | 20 | `trainRef` |
| Voice Training | `train_voice_v2.html` | 20 | `voiceRef` |
| Pose Training | `pose.html` | 20 | `poseRef` |
| AI Type Picker | `train_picker.html` | 30 | `pickerRef` |

#### BLE Stack

- Library: `react-native-ble-plx`
- Service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (Nordic UART Service)
- Write UUID: `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- Notify UUID: `6e400003-b5a3-f393-e0a9-e50e24dcca9e`
- MTU negotiation: requests 512 on Android (board reports actual), uses 185 on iOS
- Chunk size = `MTU - 12` bytes
- Data framing: `@@START\n` → chunks → `\n@@END`
- Notification: incoming lines accumulated in `_notifyBuffer`, split on `\n`, garbage-filtered (binary, `>>>`, `...`, `OK`, `MPY: soft reboot`)
- Scan: 10-second window, stops automatically

#### USB Serial Stack

- Library: `rn-usb-serial` (lazy-loaded at runtime — not a hard dependency)
- Baud rate: 115200
- Auto-connect mode enabled on startup
- Protocol for code upload: `PYCODE\nENTRY:main\nSIZE:{len}\n\n{python_code}`

#### Message Bus (JS → React Native)

All messages are JSON strings posted via `window.ReactNativeWebView.postMessage()`:

| Message Type | Source Screen | Action |
|---|---|---|
| `CONNECT_BLE` | Blockly | Starts BLE device scan |
| `SELECT_DEVICE` | Blockly | Connects to specific BLE device ID |
| `SEND_DATA` | Blockly | Sends Python code via BLE |
| `COMMAND` | Blockly | Sends single command string via BLE |
| `DISCONNECT_SAFE` | Blockly | Sends DISCONNECT command, then cancels connection |
| `python_upload` | Blockly | Sends code via USB serial |
| `OPEN_AI_TRAIN_PICKER` | Blockly | Shows picker modal |
| `OPEN_AI_TRAIN` | Picker | Shows image training screen |
| `OPEN_VOICE_TRAIN` | Picker | Shows voice training screen |
| `OPEN_POSE_TRAIN` | Picker | Shows pose training screen |
| `CLOSE_PICKER` | Picker | Hides picker |
| `CLOSE_AI_TRAIN` | Training | Hides image training |
| `CLOSE_VOICE_TRAIN_V2` | Training | Hides voice training |
| `CLOSE_POSE_TRAIN` | Training | Hides pose training |
| `AI_MODEL_TRAINED` | Training | Re-dispatches to Blockly (class names for blocks) |
| `VOICE_MODEL_TRAINED` | Training | Re-dispatches to Blockly |
| `POSE_MODEL_TRAINED` | Training | Re-dispatches to Blockly |
| `SAVE_FILE` | Blockly | Saves XML to cache, opens share dialog |
| `LOAD_FILE` | Blockly | Opens document picker, reads XML, calls `loadXml()` |
| `SAVE_CLOUD` | Blockly | Placeholder (replies "coming soon") |

---

### 4.2 Blockly Workspace (index.html)

**Location:** `frontend/assets/blockly/index.html`
**Size:** ~13,000 lines

The core user-facing UI. A full Blockly environment with custom block definitions for:

- **Motion blocks** — motor control, servo, speed
- **Sensor blocks** — distance, colour, line-following
- **AI blocks** — inference trigger, class-label comparisons (populated dynamically after training)
- **BLE blocks** — connect, send, disconnect
- **Control blocks** — loops, conditionals, timing

The workspace generates MicroPython code. Users click "Send via Bluetooth" or "Send via USB" which calls `window.ReactNativeWebView.postMessage(JSON.stringify({type:"SEND_DATA", data: generatedCode}))`.

---

### 4.3 AI Training Screens

#### train_picker.html
A modal with three animated cards. Sends navigation messages to App.js:
- 📷 **Image Classification** → `OPEN_AI_TRAIN`
- 🎤 **Voice Classification** → `OPEN_VOICE_TRAIN`
- 🧘 **Pose Classification** → `OPEN_POSE_TRAIN`

Falls back to `window.location.href` redirects when running in a plain browser (not in the app).

---

#### train.html — Image Classification Trainer

**ML Model:** MobileNet V3 Small 100/224 (TF Hub backbone, frozen) + trained dense head

**Training Flow:**
1. User creates 2–N classes with names
2. Captures webcam images per class (configurable crop size: 96, 128, 160, 224 px)
3. Each image is processed: crop → resize to 224×224 → MobileNet V3 feature extraction (576-dim) → stored as feature vector
4. Head model trained: Dense(128, relu) → Dense(N, softmax) on feature vectors
5. Loss: categorical crossentropy, Optimizer: Adam

**Export Options:**

| Button | Endpoint | Output | Target |
|---|---|---|---|
| Export .kmodel (K230) | `/convert` | `k230_model.zip` (model.kmodel + labels.txt) | K230 KPU |
| Deploy to K230 | `/deploy` | Converts + pushes directly to board | K230 KPU |
| Export .tflite (ESP32-S3) | `/convert-esp32` | `esp32_model.zip` (model.tflite + labels.txt) | ESP32-S3 |
| Export DFR1154 INT8 ZIP | `/convert-esp32-lite` | `tiny_image_esp32_model.zip` | DFR1154 |
| K230 Camera Connect | `/k230-get-frame` | Live JPEG preview | K230 camera |

---

#### train_voice_v2.html — Voice Classification Trainer

**ML Model:** TF Speech Commands v2 backbone + trained dense head
**Feature:** 43 frames × 232 FFT bins log-spectrogram (1-second audio)
**Clip Length:** Configurable 1, 2, or 3 seconds

**Training Flow:**
1. User creates voice classes (e.g., "go", "stop", "left")
2. Holds record button, speaks; audio captured at 16kHz via Web Audio API
3. Audio → log spectrogram (43×232) → Speech Commands feature extraction → stored
4. Head model trained on features
5. Exports model.json + weights.bin (TF.js format)

**Export Options:**

| Button | Endpoint | Output | Target |
|---|---|---|---|
| Export K230 .kmodel | `/convert-voice` | `voice_kmodel.zip` | K230 KPU |
| Export ESP32 TFLite | `/convert-voice-esp32` | `voice_esp32_model.zip` | ESP32-S3 |
| Export Tiny Voice | `/convert-tiny` | `tiny_esp32_voice_model.zip` | ESP32-S3 (server-trained) |

---

#### pose.html — Body Pose Trainer

**ML Model:** MoveNet Thunder (17 keypoints) + trained dense classifier
**Input shape:** [1, 34] — 17 keypoints × (x, y) coordinates, normalised float32

**Training Flow:**
1. User creates pose classes (e.g., "standing", "sitting", "waving")
2. Webcam feeds MoveNet Thunder in real time
3. User presses capture; 17 keypoint coordinates (34 floats) saved as sample
4. Dense classifier trained on keypoint arrays
5. Exports model.json + weights.bin

**Export:**

| Button | Endpoint | Output | Target |
|---|---|---|---|
| Export K230 .kmodel | `/convert-pose` | `pose_kmodel.zip` | K230 KPU |

---

### 4.4 Backend — Windows Agent

**Location:** `backend/windows_agent.py`
**Port:** 5002 (FastAPI, runs in `venv`)

This is the critical Windows-only bridge between the Cloudflare tunnel and everything local.

#### File Serving (Browser Mode)
When accessed via browser (not phone), serves HTML directly:
- `GET /` → `index.html`
- `GET /train.html` → `train.html`
- `GET /cam.html` → `cam.html`
- `GET /voice.html` → `voice.html`
- `StaticFiles` mount for all assets

#### USB Drive Detection
```
find_canmv_drive()
  → GetLogicalDrives() bitmask
  → GetVolumeInformationW() for each drive
  → Matches label: "sdcard" | "data" | "canmv"
```

#### MTP Device Access
Uses **PowerShell Shell.Application COM object** — no extra drivers needed:
```
ps_list_devices()  → lists all devices under "This PC"
ps_copy_to_mtp()   → Shell.NameSpace(17) → find device → CopyHere()
```

#### MicroPython Raw REPL File Transfer (`repl_copy`)
Transfers any file to K230 without custom firmware:
1. `Ctrl+C × 2` — interrupt running script
2. `Ctrl+A` — enter raw REPL mode (verify `raw REPL` in response)
3. `os.mkdir('/sdcard/kmodel')` — create destination
4. `open(remote_path, 'wb')` — open file on board
5. Loop: read 256-byte chunks → base64 encode → `ubinascii.a2b_base64()` on board → `__xf.write()`
6. `__xf.close()`
7. `os.stat()` — verify byte count matches
8. `Ctrl+B` — exit raw REPL

#### K230 Camera Streaming
`camera_worker()` background thread:
1. Opens serial port at 115200 baud
2. Sets DTR/RTS, waits for `>>>` REPL prompt (up to 15s)
3. Enters raw REPL (`Ctrl+A`)
4. Injects MicroPython camera script (inline string):
   - Imports `media.sensor`, `media.media.MediaManager`
   - Sets 320×240 RGB565 sensor
   - Loop: `snapshot()` → `compress(quality=50)` → `binascii.b2a_base64()` → prints `IMG_START:base64:IMG_END`
5. Reads serial, splits on `IMG_START:`/`:IMG_END`, decodes base64 → stores JPEG as `camera_state["latest_frame"]`
6. Auto-stops after 30 seconds of no API requests

#### Deploy Priority Cascade
```
POST /deploy
  ├─ 1. Convert via Docker (localhost:5001/convert)
  ├─ 2. Try COM port REPL transfer (if com_port param given)
  ├─ 3. Try mass storage (find_canmv_drive)
  ├─ 4. Try MTP (ps_copy_to_mtp)
  └─ 5. Fallback: HTTP POST to K230 Wi-Fi at http://{k230_ip}:{k230_port}/upload
```

---

### 4.5 Backend — Convert Server (Docker)

**Location:** `backend/convert_server.py`
**Port:** 5001 (FastAPI inside Docker container `blockly-converter`)

This runs inside Docker because `nncase-kpu` and TensorFlow 2.13 require specific Linux dependencies incompatible with a standard Windows Python environment.

#### TF.js Weight Loader (`_load_head_model`)

Parses the browser-exported `model.json` (topology) and `weights.bin` (flat binary) into a Keras model. Uses 5 matching strategies in order:

1. **Exact name match** — `loaded_weights[w.name]`
2. **Strip `:0` suffix** — TF variable naming artifact
3. **Normalized path** — removes `sequential/model/` prefixes, keeps last 2 path parts
4. **Shape + suffix match** — same last path component AND same tensor shape
5. **Positional fallback** — match by index in weight spec list if shape agrees

Unmatched weights are filled with zeros and logged as warnings.

#### Image Model Rebuild (`rebuild_model_from_tfjs`)

```
TF.js JSON + BIN
    └─> _load_head_model() → Keras head (dense layers only)
    └─> TF Hub MobileNet V3 Small 100/224 (frozen backbone)

Final model:
  Input: [1, 3, 224, 224] uint8  (NCHW — K230 native Ai2d format)
    └─> tf.transpose to NHWC
    └─> cast to float32 / 255.0
    └─> MobileNet V3 → 576-dim feature vector
    └─> Dense head (trained)
    └─> Softmax output

Saved with @tf.function + TensorSpec for fully static shape
(required by nncase — "Only Can Get It When Shape Is Fixed!")
```

#### Voice Model Rebuild (`rebuild_voice_model_from_tfjs`)

```
Input: [1, 43, 232, 1] float32  (log spectrogram)
  └─> Loaded head model directly (backbone already included)
  └─> Static shape locked via serving_fn TensorSpec
```

#### Pose Model Rebuild (`rebuild_pose_model_from_tfjs`)

```
Input: [1, 34] float32  (17 keypoints × x,y)
  └─> Dense classifier head
  └─> Static shape [1, 34] locked
```

#### ESP32 Model (`rebuild_model_for_esp32`)

```
Input: [1, input_size, input_size, 3] float32  (NHWC)
  └─> / 255.0 normalise
  └─> Resizing(224, 224) layer if input_size != 224
  └─> MobileNet V3 → 576-dim
  └─> Dense head
→ TFLite INT8 PTQ via representative_dataset (100 random samples)
→ inference_input_type = uint8, inference_output_type = uint8
```

#### DFR1154 Micro CNN (`build_small_cnn_lite`)

A tiny 4-layer CNN built fresh (does NOT use MobileNet — too large for ESP32 without PSRAM):

```
Input: (96, 96, 1)  grayscale
  Conv2D(8, 3, relu) → MaxPool(2)
  Conv2D(16, 3, relu) → MaxPool(2)
  Conv2D(32, 3, relu) → MaxPool(2)
  Conv2D(16, 3, relu) → MaxPool(12)
  Flatten → Dense(N_classes, softmax)
→ Wrapped with Rescaling(0.5, 0.5) layer for domain alignment
→ INT8 PTQ with int8 input/output
```

#### Voice Micro CNN (`build_voice_micro_cnn_lite`)

```
Input: (43, 232, 1)  log spectrogram
  Conv2D(8, 5×5, stride=2, relu) → MaxPool(2×2)
  Conv2D(12, 3×3, stride=2, relu) → MaxPool(2×2)
  Flatten → Dense(24, relu) → Dense(N_classes, softmax)
→ INT8 PTQ with int8 input/output
→ Size: ~12 KB
```

#### Server-Side Voice Training (`_tiny_voice_train_and_zip`)

Accepts a ZIP of WAV files (one folder per class), trains the voice micro CNN entirely server-side, and returns a deployable ZIP:
- Reads 16kHz WAV, mono-mixes stereo, pads/truncates to 1 second
- Computes 43×232 log spectrogram using Hann-windowed 1024-point FFT
- Data augmentation: ×4 (quiet, loud, noise variants)
- Trains for 10–120 epochs (user-configurable, capped)
- Outputs INT8 TFLite + labels.txt + metadata.json

#### Conversion Pipeline (K230 path)

```
TF.js JSON+BIN
    └─[Docker]─> rebuild_*_from_tfjs() → SavedModel
    └─[Docker subprocess]─> tf2onnx.convert --opset 13 → model.onnx
    └─[Docker subprocess]─> nncase_compile.py → model.kmodel
    └─> ZIP (model.kmodel + labels.txt)
    └─[windows_agent]─> delivered to K230 board
```

---

### 4.6 Model Compiler (nncase_compile.py)

**Location:** `backend/nncase_compile.py` (also mirrored at `k230_scripts/nncase_compile.py`)

Converts ONNX model → K230 `.kmodel` binary using the `nncase` library.

**Input detection:**
- Reads ONNX graph input spec for shape and dtype
- Detects voice spectrogram input: shape `[1,43,232,1]` + `float32`

**PTQ Calibration strategy by input type:**

| Input Type | Calibration Data | Samples |
|---|---|---|
| `uint8` (image models) | `np.random.randint(0,256)` | 10 |
| Voice spectrogram `float32 [1,43,232,1]` | Synthetic log-FFT (silence→noise→tones) | 20 |
| Other `float32` | `np.random.rand()` | 10 |

**`--no-ptq` flag:** Compiles in full float32 mode (used for voice and pose models whose inputs are already float).

**Output validation:** Checks kmodel > 100 bytes and does not start with `Protobuf`/`Error` text.

---

### 4.7 K230 MicroPython Library Stack

**Location:** `frontend/libs/`
These files run on the **K230 board** under CanMV MicroPython. They are deployed to `/sdcard/app/libs/`.

#### AI2D.py — Hardware Preprocessor

Wraps the K230's hardware `nn.ai2d()` accelerator for image preprocessing:

| Method | Operation |
|---|---|
| `crop(x, y, w, h)` | Region crop |
| `shift(shift_val)` | Bit-shift |
| `pad(paddings, mode, val)` | Constant padding |
| `resize(method, mode)` | Interpolated resize (bilinear, nearest) |
| `affine(method, ...)` | Affine transform with 6-element matrix |
| `build(in_shape, out_shape)` | Finalises config, allocates output tensor |
| `run(input_np)` | Executes preprocessing, returns output tensor |

---

#### AIBase.py — Inference Base Class

Abstract base for all AI tasks. Lifecycle:
```
__init__()  → nn.kpu().load_kmodel(path)
preprocess(input_np) → runs Ai2d, returns tensor list
inference(tensors)   → kpu.set_input_tensor() + kpu.run() + get_output_tensor()
postprocess(results) → implemented by subclass
run(input_np)        → preprocess + inference + postprocess (one call)
deinit()             → del kpu, del ai2d, shrink_memory_pool()
```

---

#### PipeLine.py — Camera Pipeline Manager

Manages the K230's 3-channel camera output:

| Channel | Format | Use |
|---|---|---|
| CAM_CHN_ID_0 | YUV420 (semiplanar) | Display output (bound to VO LAYER_VIDEO1) |
| CAM_CHN_ID_1 | RGB565 | Secondary display / streaming |
| CAM_CHN_ID_2 | RGB888 Planar | AI inference input |

Key methods:
- `create()` — initialises Sensor, binds channel 0 to display, creates OSD image buffer, calls `MediaManager.init()` + `sensor.run()`
- `get_frame()` — `sensor.snapshot(chn=CAM_CHN_ID_2)` → numpy array
- `show_image()` — `Display.show_image(osd_img, 0, 0, Display.LAYER_OSD3)`
- `destroy()` — stops sensor, deinits Display, deinits MediaManager

---

#### PlatTasks.py — Classification Application

`ClassificationApp(AIBase)` — the runtime used when a trained model is deployed:
- Uses `Ai2d.resize()` to scale camera frames to model input size
- Postprocessing:
  - N > 2 classes: `softmax()` → `argmax` → label if above `confidence_threshold`
  - Binary: `sigmoid()` → returns label[1] if > threshold, else label[0]
- `draw_result()` — overlays label + confidence on OSD image

---

#### Utils.py — Utility Library

- `ScopedTiming` — context manager timing with `time.time_ns()`, prints elapsed ms
- `color_four[]` — 80-entry ARGB colour palette for detection boxes
- `softmax(x)` — numerically stable softmax
- `sigmoid(x)` — standard sigmoid
- `get_colors(n)` — returns n colours from palette
- `letterbox_pad_param(src, dst)` — computes pad amounts for letterbox resize + scale factor
- `center_crop_param(size)` — computes square crop from centre
- `ALIGN_UP(x, align)` — align x up to next multiple of align (16 for K230 width)

---

#### WBCRtsp.py — Write-Back Channel Frame Grabber

Used for RTSP / IDE preview streaming. Uses K230's VO WBC (Write-Back Channel) hardware to grab the display output frame:
- `VOWBCFrameGrabber.configure(mode)` — sets resolution (1920×1080 for HDMI, 480×800 for LCD), allocates VB buffer pools
- `start()` / `stop()` — enable/disable WBC via `kd_mpi_vo_set_wbc_attr()` / `kd_mpi_vo_enable_wbc()`
- Uses `media.vencoder` and MPP layer bindings

---

#### YOLO.py — YOLOv5 Inference

`YOLOv5(AIBase)` — supports three task types:

| Task | Preprocessing | Postprocessing |
|---|---|---|
| `classify` | `center_crop` + resize | softmax → argmax |
| `detect` | `letterbox_pad` + resize | NMS bounding boxes |
| `segment` | `letterbox_pad` + resize | NMS + mask overlay |

---

#### YbProtocol.py — Robot Communication Protocol

Encodes AI results into a compact serial string for downstream robot control boards:

**Packet format:** `$LL,II,data#\n`
- `LL` = packet length (2 digits)
- `II` = function ID (2 digits)
- `data` = comma-separated payload

**23 registered message types:**

| ID | Name | Payload |
|---|---|---|
| 01 | COLOR | x, y, w, h |
| 02 | BARCODE | x, y, w, h, string |
| 03 | QRCODE | x, y, w, h, string |
| 04 | APRILTAG | x, y, w, h, tag_id, degrees |
| 05 | DMCODE | x, y, w, h, msg, degrees |
| 06 | FACE_DETECT | x, y, w, h |
| 07 | EYE_GAZE | start_x, start_y, end_x, end_y |
| 08 | FACE_RECOGNITION | x, y, w, h, name, score |
| 09 | PERSON_DETECT | x, y, w, h |
| 10 | FALLDOWN_DETECT | x, y, w, h, msg, score |
| 11 | HAND_DETECT | x, y, w, h |
| 12 | HAND_GESTURE | msg |
| 13 | OCR_REC | msg |
| 14 | OBJECT_DETECT | x, y, w, h, msg |
| 15 | NANO_TRACKER | x, y, w, h |
| 16 | SELF_LEARNING | category, score |
| 17 | LICENCE_REC | msg |
| 18 | LICENCE_DETECT | 8 corner points |
| 19 | GARBAGE_DETECT | x, y, w, h, msg |
| 20 | GUIDE_DETECT | x, y, w, h, msg |
| 21 | OBSTACLE_DETECT | x, y, w, h, msg |
| 22 | MULTI_COLOR | x, y, w, h, msg |
| 23 | FINGER_GUESS | msg |

---

### 4.8 K230 Scripts

**Location:** `k230_scripts/`

Utility and diagnostic scripts that run on the K230 board via CanMV.

| Script | Purpose |
|---|---|
| `test_voice.py` | Full voice inference loop: PyAudio 16kHz → spectrogram → KPU |
| `download_and_infer.py` | Prototype: download kmodel via HTTP, run inference (KPU mock) |
| `nncase_compile.py` | Offline kmodel compiler (same as Docker version) |
| `test_pose.py` | Pose inference test |
| `check_aidemo.py` | Verify `aidemo` module is present and working |
| `list_all_sdcard.py` | List all files on SD card |
| `scan_sdcard.py` | Scan for model files on SD card |
| `scan_scripts.py` | List scripts in /sdcard/app |
| `read_libs.py` | Read libs directory contents |
| `read_main.py` | Read and display main.py |
| `read_face_det.py` | Read face detection model config |
| `search_word.py` | Text search utility |

#### test_voice.py — Logic Detail

1. Searches for model in: `/sdcard/voice_v2_model.kmodel`, `/sdcard/kmodel/voice_v2_model.kmodel`, `voice_v2_model.kmodel`
2. Opens PyAudio stream: 16kHz, 2 channels (stereo), 100ms chunks
3. Reads 10 chunks → 1 second of stereo audio
4. Splits interleaved channels → picks active channel by RMS comparison
5. Float conversion, DC offset removal, AGC (normalise peak to 0.3)
6. Computes log spectrogram: 43 frames, 1024-point Hann-windowed FFT, 232 bins
7. Feeds `(1,43,232,1)` tensor to KPU
8. Prints label if confidence > 65%

---

### 4.9 ESP32-S3 Firmware (frimware_full.cpp)

**Location:** `frimware_full.cpp`

A complete unified Arduino/ESP-IDF firmware for the **DFRobot DFR1154** ESP32-S3 board supporting both image and voice classification.

#### Hardware Configuration

| Component | GPIO / Config |
|---|---|
| Camera | OV2640 (standard ESP32-CAM pinout) |
| Microphone | PDM: CLK=GPIO38, DATA=GPIO39 |
| Status LED | GPIO3 |
| UART output | UART_NUM_0, 115200 baud |
| Wi-Fi AP SSID | `DFR1154-IMAGE-VOICE` |
| Wi-Fi AP password | `12345678` |
| Model storage | SPIFFS flash partition `"model"` |

#### Runtime Modes

| Mode | Input | Inference interval |
|---|---|---|
| `kImage` | OV2640 96×96 grayscale | 1000 ms |
| `kVoice` | PDM 16kHz | 50 ms |
| `kUnknown` | — | Waiting for model upload |

#### TFLite Micro Configuration

- Tensor arena: 5 MB (PSRAM) or 160 KB (fallback)
- Max model size: 7 MB
- Confidence threshold: 85% for action trigger
- Stable frames required: 3 consecutive predictions before firing
- Min action gap: 250 ms

#### Audio Feature Extraction

Matches the browser training exactly:
- 16kHz sample rate, 44032 raw samples (~2.75s ring buffer)
- 43 frames, 232 FFT bins, 1024-point FFT
- Frame hop: `(16000 - 1024) / 42 = 356` samples
- Output: 43×232 spectrogram fed as INT8 tensor

#### Model Update Protocol

Model can be uploaded over Wi-Fi:
- Board hosts HTTP server in AP mode
- Browser POSTs new `.tflite` binary to `/upload` endpoint
- Board writes to SPIFFS, reboots, auto-detects image vs voice model

#### Serial Output Format

Predictions output on UART0 for downstream robot controller:
```
PREDICT:label_name:confidence_percent
```

---

### 4.10 Wi-Fi File Transfer Utilities

**Location:** `wifi_file tranfer/`

| File | Description |
|---|---|
| `pc_send_file.py` | PC-side: sends a file to K230 TCP socket (host:port) |
| `k230_receive_server.py` | K230-side: TCP server that receives and saves files |
| `pc_copy_usb.py` | Windows USB mass-storage copy tool |
| `k230_usb_receive.py` | K230-side USB receive handler (CanMV) |
| `usbk230.py` | K230 USB device layer helper |
| `ap.py` | K230 Wi-Fi AP mode setup helper |
| `app.py` | K230 application entry point for file transfer mode |
| `14.file.py` | File utility helper |

---

### 4.11 Tunnel & Startup Scripts

#### backend/start_backend_tunnel.py (Current — Cloudflare)

**Startup sequence:**
1. `check_docker_running()` — runs `docker ps`, aborts if Docker not ready
2. `start_docker()` — checks if any container already on port 5001; if not, runs `docker build` (cached) then `docker run -d --restart unless-stopped -p 5001:5001`
3. Starts `windows_agent.py` via venv's `uvicorn` on port 5002
4. Starts `npx cloudflared tunnel --url http://localhost:5002`
5. Reads tunnel stdout line-by-line, regex-extracts `https://*.trycloudflare.com` URL
6. `update_html_files(url)` — replaces any existing cloudflare URL or `http://localhost:5002` in all `.html` files under `frontend/assets/blockly/`

**Note:** Docker container is kept running between sessions (`--restart unless-stopped`). Only stopped manually with `docker rm -f blockly-converter`.

#### start_ngrok.py (Legacy)

Older approach using ngrok instead of cloudflared. Only updates `train.html` and `train_voice_v2.html`. Superseded by the cloudflare script.

#### start_public.js / start_ngrok.js

Node.js helpers for running `npx expo` with the tunnel.

---

## 5. Key Data Flows

### 5.1 Image Model: Training → Deployment

```
[Browser / Phone]
  User captures images per class in train.html
  TF.js MobileNet V3 feature extraction → head training in browser
  User clicks "Export K230" or "Deploy to K230"
      ↓ POST multipart: model.json, weights.bin, labels JSON
      ↓ (to Cloudflare URL = localhost:5002 via tunnel)

[windows_agent.py — port 5002]
  Receives upload, reads all bytes
  Forwards to Docker: POST localhost:5001/convert
      ↓

[convert_server.py — port 5001, inside Docker]
  1. Saves model.json, weights.bin, labels.txt to tmpdir
  2. _load_head_model() — parses TF.js JSON topology + binary weights (5-strategy matching)
  3. rebuild_model_from_tfjs() — stitches MobileNet V3 (TFHub) + head
     Input: NCHW uint8 [1,3,224,224]  (K230 native format)
     Wraps in @tf.function with static TensorSpec
  4. SavedModel → tf2onnx.convert (subprocess, opset 13) → model.onnx
  5. nncase_compile.py (subprocess) → model.kmodel
     PTQ with 10 random uint8 calibration samples
  6. ZIP: model.kmodel + labels.txt → return ZIP bytes

[windows_agent.py]
  Receives ZIP, extracts to tmpdir
  Deploy attempt order:
    1. COM port raw REPL transfer (if com_port specified)
    2. Mass storage copy (if K230 mounted as drive)
    3. MTP copy via PowerShell
    4. Wi-Fi HTTP POST to K230 /upload endpoint
  Returns JSON: {status, kmodel_size, deployed, method}

[K230 Board]
  /sdcard/kmodel/model.kmodel
  /sdcard/kmodel/labels.txt
  ClassificationApp reads model, runs inference on live camera
```

---

### 5.2 Voice Model: Training → Deployment

```
[Browser]
  train_voice_v2.html records audio (16kHz Web Audio API)
  Speech Commands backbone → feature extraction
  Dense head trained in browser → model.json + weights.bin

  POST to /convert-voice:
      ↓

[windows_agent.py]
  Proxies to Docker localhost:5001/convert-voice

[Docker]
  rebuild_voice_model_from_tfjs()
    Input: [1,43,232,1] float32 spectrogram  (STATIC shape locked)
    Saves head directly (backbone already merged in browser)
  SavedModel → ONNX → nncase_compile.py --no-ptq → kmodel
  (--no-ptq because input is float32, PTQ would require float calibration)

[K230]
  test_voice.py:
    PyAudio 16kHz stereo → pick active channel (higher RMS)
    DC offset removal → AGC → log spectrogram (43×232×1)
    kpu.run() → probabilities → label if confidence > 65%
```

---

### 5.3 Pose Model: Training → Deployment

```
[Browser]
  pose.html runs MoveNet Thunder on webcam (17 keypoints)
  User captures keypoint snapshots per class
  Dense classifier trained: input [1,34] → N classes

  POST to /convert-pose:
      ↓

[Docker]
  rebuild_pose_model_from_tfjs()
    Input: [1,34] float32  (17 keypoints × x,y)
    Static shape locked
  SavedModel → ONNX → nncase_compile.py --no-ptq → kmodel

[K230]
  Custom runtime: MoveNet Thunder kmodel → 17 keypoints →
  pose classifier kmodel → label
```

---

### 5.4 Blockly Code → Robot Board

```
[index.html — Blockly]
  User builds program with visual blocks
  Blockly code generator → MicroPython string

  Via BLE path:
    postMessage({type:"SEND_DATA", data: pythonCode})
        ↓
  [App.js sendToBoardBLE()]
    BLE writeCharacteristic: base64("@@START\n")
    Loop chunks (MTU-12 bytes): writeCharacteristic(base64(chunk))
    BLE writeCharacteristic: base64("\n@@END")
    → injectJS("handleBoardMessage('Upload Done ✅', 'SYS')")

  Via USB path:
    postMessage({type:"python_upload", code: pythonCode})
        ↓
  [App.js sendToBoardUSB()]
    RNSerialport.writeString("PYCODE\nENTRY:main\nSIZE:{N}\n\n{code}")

[Robot Board MicroPython]
  Receives BLE data → assembles between @@START / @@END
  Receives USB data → parses PYCODE header
  exec() the received Python code
```

---

### 5.5 K230 Live Camera Preview

```
[train.html — Browser]
  User clicks "Connect K230 Camera"
  Polls: GET /k230-get-frame?com_port=COM5 every 500ms

[windows_agent.py]
  k230_get_frame(com_port):
    1. First call: camera_state["com_port"] != com_port OR not running
    2. Starts camera_worker(com_port) as daemon thread
    3. Waits up to 15s for first frame (K230 boot ~10s)
    4. Returns JPEG bytes as image/jpeg response

  camera_worker thread:
    Opens serial COM5 @ 115200
    Ctrl+C x2 → wait for ">>>" REPL prompt (15s timeout)
    Ctrl+A → raw REPL → injects camera MicroPython script:
      sensor = Sensor()
      sensor.set_framesize(320, 240) + RGB565
      sensor.run()
      while True:
        img = sensor.snapshot()
        img_bytes = img.compress(50)
        print("IMG_START:" + b2a_base64(img_bytes) + ":IMG_END")
    Reads serial: splits on IMG_START:/IMG_END, decodes base64 → JPEG
    Stores in camera_state["latest_frame"]
    Auto-stop: 30s inactivity timer

[Browser]
  Displays returned JPEG in <img> tag
  Continues polling every 500ms
```

---

## 6. Communication Protocols

### BLE Data Protocol (Robot Boards)
```
Framing:   @@START\n → [MicroPython code chunks] → \n@@END
Transport: BLE NUS Write characteristic (UUID 6e400002)
Encoding:  UTF-8 strings, base64 encoded per write call
MTU:       Android: negotiated (request 512) − 12 overhead
           iOS: 185 − 12 = 173 bytes per chunk
```

### USB Serial Protocol (Robot Boards)
```
Header:   PYCODE\n
          ENTRY:{function_name}\n
          SIZE:{byte_count}\n
          \n
Payload:  {python_code}
Baud:     115200
Module:   rn-usb-serial (Android only)
```

### Backend HTTP API (Cloudflare → windows_agent)
```
Content-Type: multipart/form-data (for file uploads)
Auth:         None (Cloudflare quick tunnel, no auth)
CORS:         allow_origins=["*"] on both servers
```

### K230 MicroPython Camera Serial Protocol
```
K230 → PC:  IMG_START:{base64_jpeg}:IMG_END\n
PC → K230:  Ctrl+C (interrupt), Ctrl+A (raw REPL), Ctrl+B (exit REPL)
            Code blocks terminated with Ctrl+D
            Raw REPL response: "OK" + stdout + Ctrl+D + stderr + Ctrl+D
```

### YbProtocol (K230 → Robot Controller)
```
Format:  $LL,II,fields#\n
Example: $24,06,120,080,050,060#\n
         └─ len=24, ID=06 (FACE_DETECT), x=120, y=80, w=50, h=60
```

---

## 7. ML Pipeline Deep Dive

### Browser-Side Training (All Models)

| Step | Image | Voice | Pose |
|---|---|---|---|
| Backbone | MobileNet V3 (TF Hub CDN) | Speech Commands v2 (CDN) | MoveNet Thunder (CDN) |
| Input | 224×224 RGB | 16kHz audio | Webcam video |
| Feature | 576-dim vector | 43×232 log-spectrogram | 34 floats (17 keypoints) |
| Head | Dense(128,relu) + Dense(N,softmax) | Dense head | Dense(N,softmax) |
| Export format | model.json + weights.bin (TF.js) | model.json + weights.bin | model.json + weights.bin |

### Server-Side Conversion

| Target | Input format | Output format | Pipeline |
|---|---|---|---|
| K230 (image) | TF.js JSON+BIN | `.kmodel` | TF.js→SavedModel→ONNX→nncase (INT8 PTQ) |
| K230 (voice) | TF.js JSON+BIN | `.kmodel` | TF.js→SavedModel→ONNX→nncase (float32) |
| K230 (pose) | TF.js JSON+BIN | `.kmodel` | TF.js→SavedModel→ONNX→nncase (float32) |
| ESP32-S3 (image) | TF.js JSON+BIN | INT8 `.tflite` | TF.js→SavedModel→TFLite (uint8 I/O) |
| DFR1154 (image) | TF.js JSON+BIN | INT8 `.tflite` | Micro CNN (fresh) + TF.js weights→TFLite (int8 I/O) |
| ESP32-S3 (voice) | TF.js JSON+BIN | INT8 `.tflite` | Micro CNN (fresh) + TF.js weights→TFLite (int8 I/O) |
| Tiny voice | WAV ZIP dataset | INT8 `.tflite` | Server trains micro CNN from scratch, INT8 PTQ |

### Critical Shape Constraints

| Model | Input Shape | Why |
|---|---|---|
| K230 image | `[1, 3, 224, 224]` uint8 NCHW | K230 Ai2d native output format |
| K230 voice | `[1, 43, 232, 1]` float32 | Speech Commands spectrogram dimensions |
| K230 pose | `[1, 34]` float32 | 17 keypoints × 2 coordinates |
| ESP32 image | `[1, 96, 96, 3]` float32 NHWC | TFLite standard, 96×96 for memory |
| DFR1154 | `[1, 96, 96, 1]` int8 | Grayscale, INT8 for micro CNN |

---

## 8. API Endpoint Reference

### convert_server.py (Docker, port 5001)

| Method | Path | Input | Output | Description |
|---|---|---|---|---|
| POST | `/convert` | model_json, weights_bin, labels | ZIP (kmodel+labels) | Image → K230 kmodel |
| POST | `/convert-voice` | model_json, weights_bin, labels | ZIP (kmodel+labels) | Voice → K230 kmodel |
| POST | `/convert-pose` | model_json, weights_bin, labels | ZIP (kmodel+labels) | Pose → K230 kmodel |
| POST | `/convert-esp32` | model_json, weights_bin, labels, input_size | ZIP (tflite+labels) | Image → ESP32 INT8 TFLite |
| POST | `/convert-esp32-lite` | model_json, weights_bin, labels | ZIP (tflite+metadata) | Image → DFR1154 micro CNN TFLite |
| POST | `/convert-voice-esp32` | model_json, weights_bin, labels | ZIP (tflite+labels) | Voice → ESP32 INT8 TFLite |
| POST | `/convert-tiny` | dataset_zip, labels, epochs | ZIP (tflite+metadata) | Server-trains voice from WAVs |
| POST | `/deploy` | model_json, weights_bin, labels, k230_ip, k230_port | JSON status | Convert + push to K230 via Wi-Fi |
| GET | `/proxy` | url (query param) | JPEG or MJPEG stream | CORS proxy for K230 camera |
| GET | `/health` | — | `{status:"ok"}` | Health check |
| GET | `/test-conversion` | — | JSON sizes | Tests full ONNX→kmodel pipeline |

### windows_agent.py (port 5002)

| Method | Path | Input | Output | Description |
|---|---|---|---|---|
| GET | `/usb-ports` | — | `{ports:[...]}` | List available COM ports |
| POST | `/deploy` | model_json, weights_bin, labels, k230_ip, com_port | JSON status | Convert + deploy (REPL/MTP/Wi-Fi) |
| POST | `/convert` | model_json, weights_bin, labels | ZIP | Proxy → Docker /convert |
| POST | `/convert-voice` | model_json, weights_bin, labels | ZIP | Proxy → Docker (fallback to remote) |
| POST | `/convert-pose` | model_json, weights_bin, labels | ZIP | Proxy → Docker /convert-pose |
| POST | `/convert-esp32` | model_json, weights_bin, labels, input_size | ZIP | Proxy → Docker /convert-esp32 |
| POST | `/convert-esp32-lite` | model_json, weights_bin, labels | ZIP | Proxy → Docker /convert-esp32-lite |
| POST | `/convert-voice-esp32` | model_json, weights_bin, labels | ZIP | Proxy → Docker /convert-voice-esp32 |
| POST | `/convert-tiny` | dataset_zip, labels, epochs | ZIP | Proxy → Docker /convert-tiny |
| GET | `/proxy` | url (query param) | image/stream | Proxy → Docker /proxy |
| GET | `/k230-get-frame` | com_port (query param) | JPEG | K230 camera frame via serial REPL |
| GET | `/health` | — | `{status:"ok"}` | Health check |
| GET | `/` | — | HTML | Serves index.html (browser mode) |

---

## 9. Hardware Support Matrix

| Hardware | Connection | Model Format | Deploy Method |
|---|---|---|---|
| Kendryte K230 (CanMV) | USB Serial (REPL) | `.kmodel` (nncase) | Raw REPL base64 transfer |
| Kendryte K230 (CanMV) | USB Mass Storage | `.kmodel` (nncase) | `shutil.copy2` to drive |
| Kendryte K230 (CanMV) | USB MTP | `.kmodel` (nncase) | PowerShell Shell.Application |
| Kendryte K230 (CanMV) | Wi-Fi HTTP | `.kmodel` (nncase) | POST to /upload endpoint |
| Kendryte K230D BPI Zero | USB Serial | `.kmodel` (nncase) | Same as above |
| Kendryte K230D ATK DNK230D | USB Serial | `.kmodel` (nncase) | Same as above |
| DFRobot DFR1154 ESP32-S3 | Wi-Fi HTTP | INT8 `.tflite` | HTTP POST to board AP |
| DFRobot DFR1154 ESP32-S3 | USB Serial (WebSerial) | INT8 `.tflite` | dashboard_webserial.html |
| Generic BLE Robot Board | BLE NUS | MicroPython code | App.js BLE chunked write |
| Generic Arduino/MCU | USB Serial | MicroPython code | App.js USB serial write |

---

## 10. File Inventory

```
blockly_img_voice-model/
│
├── frontend/                          ← React Native Expo app
│   ├── App.js                         ← Root: BLE + USB + WebView bridge
│   ├── index.js                       ← Expo entry point
│   ├── app.json                       ← Expo config
│   ├── package.json                   ← npm dependencies
│   ├── metro.config.js                ← Metro bundler config
│   │
│   ├── assets/
│   │   ├── blockly/
│   │   │   ├── index.html             ← Blockly workspace (13,000 lines)
│   │   │   ├── train.html             ← Image classification trainer
│   │   │   ├── train_voice_v2.html    ← Voice / keyword trainer
│   │   │   ├── train_picker.html      ← AI type selector modal
│   │   │   ├── pose.html              ← Body pose trainer
│   │   │   ├── cam.html               ← Camera preview page
│   │   │   ├── style.css              ← Shared styles
│   │   │   ├── icons/                 ← Custom Blockly toolbar SVG icons
│   │   │   ├── sounds/                ← Blockly UI sounds
│   │   │   └── offline_libs/          ← Bundled Blockly JS + MQTT
│   │   ├── vendor/                    ← Pre-bundled Blockly bundles
│   │   ├── img/                       ← App images (robo.png, speed.png)
│   │   └── [PNG icons]
│   │
│   └── libs/                          ← K230 MicroPython libraries
│       ├── AI2D.py                    ← Hardware ai2d preprocessor
│       ├── AIBase.py                  ← KPU inference base class
│       ├── PipeLine.py                ← 3-channel camera pipeline
│       ├── PlatTasks.py               ← ClassificationApp runtime
│       ├── Utils.py                   ← ScopedTiming, colors, math helpers
│       ├── WBCRtsp.py                 ← VO Write-Back Channel grabber
│       ├── YOLO.py                    ← YOLOv5 (detect/classify/segment)
│       └── YbProtocol.py              ← Robot serial data protocol (23 types)
│
├── backend/                           ← Windows backend
│   ├── start_backend_tunnel.py        ← Startup orchestrator (Docker+agent+CF)
│   ├── windows_agent.py               ← FastAPI port 5002 (USB/MTP/proxy)
│   ├── convert_server.py              ← FastAPI port 5001 (ML conversion)
│   ├── nncase_compile.py              ← ONNX→kmodel compiler (runs in Docker)
│   ├── Dockerfile                     ← Docker image: TF2 + nncase + tf2onnx
│   ├── requirements.txt               ← Docker full deps (TF, nncase, etc.)
│   ├── requirements-agent.txt         ← Venv lightweight deps (fastapi, pyserial)
│   ├── test_nncase.py                 ← nncase sanity test
│   ├── .dockerignore
│   └── venv/                          ← Python virtual environment
│
├── k230_scripts/                      ← K230 diagnostic / inference scripts
│   ├── test_voice.py                  ← Voice inference loop on K230
│   ├── test_pose.py                   ← Pose inference on K230
│   ├── download_and_infer.py          ← HTTP model download + inference
│   ├── nncase_compile.py              ← Offline compiler (same as backend)
│   ├── check_aidemo.py                ← Check aidemo module
│   ├── list_all_sdcard.py             ← List SD card files
│   ├── scan_sdcard.py                 ← Scan for model files
│   ├── scan_scripts.py                ← List app scripts
│   ├── read_libs.py                   ← Read libs directory
│   ├── read_main.py                   ← Read main.py
│   ├── read_face_det.py               ← Read face det config
│   └── search_word.py                 ← Text search utility
│
├── wifi_file tranfer/                 ← File transfer utilities
│   ├── pc_send_file.py                ← PC TCP sender
│   ├── k230_receive_server.py         ← K230 TCP receiver
│   ├── pc_copy_usb.py                 ← USB mass-storage copy
│   ├── k230_usb_receive.py            ← K230 USB receiver
│   ├── usbk230.py                     ← USB device helper
│   ├── ap.py                          ← Wi-Fi AP helper
│   ├── app.py                         ← App entry for file transfer
│   └── 14.file.py                     ← File utility
│
├── frimware_full.cpp                  ← ESP32-S3 unified firmware (C++)
├── start_backend_tunnel.py            ← (root copy, superseded by backend/)
├── start_ngrok.py                     ← Legacy ngrok tunnel script
├── start_ngrok.js                     ← Legacy Node.js ngrok helper
├── start_public.js                    ← Node.js expo start helper
├── labels.txt                         ← Sample labels (floor, arun)
├── py.py                              ← Scratch/test Python file
├── 3d.html                            ← Experimental 3D view page
├── k230_debug.log                     ← Runtime debug log from windows_agent
├── INTEGRATION_NOTES.md               ← Setup guide (merge notes)
└── .vscode/settings.json              ← VSCode workspace settings
```

---

## 11. Design Patterns & Key Decisions

### 1. Always-Mounted WebViews
**Decision:** All 5 WebViews are mounted at app start and never unmounted.
**Reason:** TF.js loads MobileNet V3, Speech Commands backbone (~30 MB) and keeps trained weights in browser memory. Unmounting destroys this — user loses all training progress. Switching is done via `opacity: 0 / pointerEvents: none`.

### 2. Static Shape Locking for nncase
**Decision:** All models saved as `@tf.function` with explicit `tf.TensorSpec(shape=[1,3,224,224], ...)`.
**Reason:** The K230 nncase KPU compiler cannot handle dynamic shapes — it throws "Only Can Get It When Shape Is Fixed!". Wrapping in a serving function with concrete shapes forces ONNX export with static dimensions.

### 3. NCHW for K230, NHWC for TFLite
**Decision:** Two separate model rebuild functions for K230 vs ESP32.
**Reason:** K230's hardware Ai2d accelerator outputs images in NCHW uint8 format natively. TFLite standard is NHWC float32. Trying to use one format for both breaks either the KPU hardware pipeline or TFLite's op support.

### 4. 5-Strategy Weight Matching
**Decision:** `_load_head_model` tries 5 matching strategies before accepting zeros.
**Reason:** TF.js exports weights with naming like `dense/kernel:0`, while Keras internally names them `dense_1/kernel:0` or `sequential/dense/kernel:0`. Different TF.js versions and training scenarios produce different naming. The cascade handles all known variants gracefully.

### 5. Deploy Priority Cascade
**Decision:** Try COM REPL → Mass Storage → MTP → Wi-Fi in sequence.
**Reason:** K230 can be connected in several different ways depending on what CanMV firmware is running and how it's plugged in. Each method works in a different scenario. Cascading handles all of them automatically without user configuration.

### 6. Cloudflare URL Auto-Injection
**Decision:** `start_backend_tunnel.py` regex-replaces old tunnel URLs in all HTML files at startup.
**Reason:** Cloudflare quick tunnels generate a new URL every restart. Hardcoding fails after every session. Auto-injection means users never touch the URL manually.

### 7. Docker for ML Dependencies
**Decision:** Heavy ML stack (TF 2.13, nncase-kpu) runs in Docker.
**Reason:** `nncase-kpu` requires specific Linux library versions incompatible with Windows Python environments. Docker eliminates this entirely. `windows_agent.py` remains lightweight (5 packages).

### 8. BLE Chunked Write with Framing
**Decision:** @@START/@@END framing around chunked BLE writes.
**Reason:** BLE has a maximum packet size (MTU). Long Python programs must be split. The frame markers tell the robot's MicroPython receiver when a complete program has arrived so it can `exec()` it safely.

---

## 12. Setup & Run Guide

### One-Time Setup

```cmd
# 1. Backend venv (lightweight — only 5 packages)
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements-agent.txt
cd ..

# 2. Frontend npm
cd frontend
npm install
cd ..

# 3. Docker Desktop must be installed and running
```

### Every Session

```cmd
# Terminal 1 — Backend (Docker + Agent + Tunnel)
cd backend
python start_backend_tunnel.py
# First run: ~10-20 min (Docker build)
# Subsequent: ~15 seconds (cached)

# Terminal 2 — Frontend
cd frontend
npx expo start --tunnel
# Scan QR code with Expo Go app on phone
```

### Browser Mode (no phone needed)
Navigate to the Cloudflare URL printed by `start_backend_tunnel.py`:
```
https://xxx.trycloudflare.com/
```
All HTML files are served directly by `windows_agent.py`.

---

## 13. Known Limitations

| Limitation | Details |
|---|---|
| CDN dependency | `train.html`, `train_voice_v2.html`, `pose.html` load TF.js from `cdn.jsdelivr.net` — training screens require internet on first load |
| Windows-only backend | `windows_agent.py` uses `ctypes.windll` (drive detection) and PowerShell COM (MTP) — Linux/Mac would need different USB handling |
| Docker first build time | First `docker build` downloads TensorFlow 2.13 + nncase (~3 GB), takes 10–20 minutes |
| Cloudflare URL rotation | Tunnel URL changes every restart; must re-scan Expo QR code after restarting backend |
| BLE Android only | `rn-usb-serial` module is Android-only; USB serial path not available on iOS |
| Voice model fallback | `convert-voice` in `windows_agent.py` has a hardcoded fallback URL to an external trycloudflare.com endpoint (line 522–525) — will fail if that external instance is not running |
| K230 camera boot time | Camera streaming via serial REPL takes ~10–15 seconds per connection (K230 boot + sensor init) |
| DFR1154 micro CNN accuracy | `/convert-esp32-lite` builds a fresh micro CNN and loads TF.js weights — this works correctly only if the architecture matches exactly (same as `build_small_cnn_lite`) |
| Pose deploy | Pose model deployment to K230 requires a separate MoveNet Thunder kmodel already on the board — the exported kmodel is only the classifier head |

---

*Report generated from full source analysis on 2026-06-07*
