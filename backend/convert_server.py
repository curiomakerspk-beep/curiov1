from fastapi import FastAPI, File, UploadFile, Form, Query
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import json
import os
import hashlib
import secrets
import subprocess
import time
import zipfile
import traceback
import numpy as np
import asyncio
from contextlib import asynccontextmanager
import httpx
import shutil

# FIX #9 — Cache MobileNetV3 from TFHub to disk so it is only downloaded once.
# Without this, every /convert and /convert-esp32 request fetched the model
# from the internet, adding 5-15s latency and failing in offline deployments.
_TFHUB_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tfhub_cache")
os.makedirs(_TFHUB_CACHE, exist_ok=True)
os.environ.setdefault("TFHUB_CACHE_DIR", _TFHUB_CACHE)

# Dictionary to hold per-camera locks to prevent concurrent connection resets
camera_locks = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Shared client for all proxy requests to improve performance/pooling.
    # Keep the camera connection pool deliberately small to avoid resets.
    limits = httpx.Limits(max_connections=5, max_keepalive_connections=1)
    app.state.client = httpx.AsyncClient(
        timeout=10.0,
        follow_redirects=True,
        limits=limits,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/91.0.4472.124 Safari/537.36"
            )
        },
    )
    yield
    await app.state.client.aclose()


app = FastAPI(lifespan=lifespan)

# Path to nncase_compile.py resolved dynamically relative to this file
nncase_compile_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "nncase_compile.py"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# QR-assisted K230 model transfer
# =====================================================================

QR_TRANSFER_ROOT = os.path.join(tempfile.gettempdir(), "curio_k230_qr_transfers")
QR_TRANSFER_TTL_SECONDS = 60 * 60
QR_TRANSFER_FILES = (
    ("model.kmodel", "model", 128 * 1024 * 1024),
    ("labels.txt", "labels", 64 * 1024),
    ("input_size.txt", "input_size", 64),
)


def _qr_token_is_safe(token):
    allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    return 8 <= len(token) <= 64 and all(ch in allowed for ch in token)


def _qr_transfer_dir(token):
    if not _qr_token_is_safe(token):
        raise ValueError("Invalid QR transfer token")
    return os.path.join(QR_TRANSFER_ROOT, token)


def _cleanup_expired_qr_transfers():
    os.makedirs(QR_TRANSFER_ROOT, exist_ok=True)
    now = time.time()
    for token in os.listdir(QR_TRANSFER_ROOT):
        try:
            transfer_dir = _qr_transfer_dir(token)
            manifest_path = os.path.join(transfer_dir, "manifest.json")
            with open(manifest_path, "r", encoding="utf-8") as manifest_file:
                manifest = json.load(manifest_file)
            if float(manifest.get("expires_at", 0)) <= now:
                shutil.rmtree(transfer_dir, ignore_errors=True)
        except Exception:
            # Incomplete/invalid transfer directories are never useful.
            shutil.rmtree(
                os.path.join(QR_TRANSFER_ROOT, token), ignore_errors=True
            )


async def _save_qr_upload(upload, destination, maximum_size):
    digest = hashlib.sha256()
    written = 0
    temp_destination = destination + ".part"
    try:
        with open(temp_destination, "wb") as output:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > maximum_size:
                    raise ValueError(
                        "{} exceeds the {} byte QR transfer limit".format(
                            os.path.basename(destination), maximum_size
                        )
                    )
                output.write(chunk)
                digest.update(chunk)
        if written == 0:
            raise ValueError("{} is empty".format(os.path.basename(destination)))
        os.replace(temp_destination, destination)
        return {"size": written, "sha256": digest.hexdigest()}
    finally:
        try:
            os.remove(temp_destination)
        except OSError:
            pass


def _load_qr_manifest(token):
    transfer_dir = _qr_transfer_dir(token)
    manifest_path = os.path.join(transfer_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    if float(manifest.get("expires_at", 0)) <= time.time():
        shutil.rmtree(transfer_dir, ignore_errors=True)
        raise FileNotFoundError("QR transfer expired")
    return transfer_dir, manifest


@app.post("/qr-transfer")
async def create_qr_transfer(
    model: UploadFile = File(...),
    labels: UploadFile = File(...),
    input_size: UploadFile = File(...),
):
    """Store one short-lived K230 deployment for camera/QR pickup."""
    _cleanup_expired_qr_transfers()
    token = secrets.token_urlsafe(12)
    transfer_dir = _qr_transfer_dir(token)
    os.makedirs(transfer_dir, exist_ok=False)
    created_at = int(time.time())
    manifest = {
        "type": "curio-k230-model-transfer",
        "version": 1,
        "created_at": created_at,
        "expires_at": created_at + QR_TRANSFER_TTL_SECONDS,
        "files": [],
    }
    uploads = {
        "model": model,
        "labels": labels,
        "input_size": input_size,
    }

    try:
        for filename, field_name, maximum_size in QR_TRANSFER_FILES:
            details = await _save_qr_upload(
                uploads[field_name],
                os.path.join(transfer_dir, filename),
                maximum_size,
            )
            manifest["files"].append(
                {
                    "name": filename,
                    "path": "/qr-transfer/{}/{}".format(token, filename),
                    "size": details["size"],
                    "sha256": details["sha256"],
                }
            )

        with open(
            os.path.join(transfer_dir, "manifest.json"), "w", encoding="utf-8"
        ) as manifest_file:
            json.dump(manifest, manifest_file, separators=(",", ":"))

        return JSONResponse(
            content={
                "token": token,
                "manifest_path": "/qr-transfer/{}/manifest".format(token),
                "expires_at": manifest["expires_at"],
            },
            headers={"Cache-Control": "no-store"},
        )
    except Exception as error:
        shutil.rmtree(transfer_dir, ignore_errors=True)
        return JSONResponse(status_code=400, content={"error": str(error)})


@app.get("/qr-transfer/{token}/manifest")
async def get_qr_transfer_manifest(token: str):
    try:
        _, manifest = _load_qr_manifest(token)
        return JSONResponse(
            content=manifest,
            headers={"Cache-Control": "no-store"},
        )
    except (ValueError, OSError):
        return JSONResponse(
            status_code=404, content={"error": "QR transfer not found or expired"}
        )


@app.get("/qr-transfer/{token}/{filename}")
async def get_qr_transfer_file(token: str, filename: str):
    if filename not in {item[0] for item in QR_TRANSFER_FILES}:
        return JSONResponse(status_code=404, content={"error": "File not found"})
    try:
        transfer_dir, manifest = _load_qr_manifest(token)
        details = next(
            item for item in manifest["files"] if item.get("name") == filename
        )
        file_path = os.path.join(transfer_dir, filename)

        def file_chunks():
            with open(file_path, "rb") as input_file:
                while True:
                    chunk = input_file.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk

        return StreamingResponse(
            file_chunks(),
            media_type="application/octet-stream",
            headers={
                "Content-Length": str(details["size"]),
                "X-Content-SHA256": details["sha256"],
                "Cache-Control": "no-store",
            },
        )
    except (ValueError, OSError, StopIteration, KeyError):
        return JSONResponse(
            status_code=404, content={"error": "QR transfer not found or expired"}
        )


# =====================================================================
# TF.js → SavedModel reconstruction helpers
# =====================================================================

def rebuild_model_from_tfjs(model_json_path, weights_bin_path, saved_model_dir):
    import tensorflow as tf
    import tensorflow_hub as hub

    head_model = _load_head_model(model_json_path, weights_bin_path)

    print("Stitching MobileNet V3 base model from TF Hub...")
    base_model = hub.KerasLayer(
        "https://tfhub.dev/google/imagenet/mobilenet_v3_small_100_224/feature_vector/5",
        trainable=False,
    )

    # NCHW input format, uint8 type compatible with K230 Ai2d native output
    inputs = tf.keras.Input(
        batch_size=1, shape=(3, 224, 224), dtype=tf.uint8, name="input_image"
    )
    # Convert NCHW → NHWC
    x = tf.transpose(inputs, [0, 2, 3, 1])
    # Normalise uint8 → float32 [0.0, 1.0] matching TF.js frontend behaviour
    x = tf.cast(x, tf.float32) / 255.0
    x = base_model(x)
    outputs = head_model(x)
    full_model = tf.keras.Model(inputs=inputs, outputs=outputs)

    # Lock to a rigid static shape so nncase does not see dynamic dimensions.
    @tf.function(
        input_signature=[
            tf.TensorSpec(shape=[1, 3, 224, 224], dtype=tf.uint8, name="input_image")
        ]
    )
    def serving_fn(x):
        return full_model(x)

    tf.saved_model.save(
        full_model, saved_model_dir, signatures={"serving_default": serving_fn}
    )
    print(f"Stitched SavedModel saved: {saved_model_dir}")
    return full_model


def rebuild_voice_model_from_tfjs(model_json_path, weights_bin_path, saved_model_dir):
    import tensorflow as tf

    full_model = _load_head_model(model_json_path, weights_bin_path)

    input_shape = list(full_model.input_shape) if full_model.input_shape else [None, 43, 232, 1]
    print(f"Loaded voice model input shape: {input_shape}")

    static_shape = [1] + [dim for dim in input_shape[1:]]
    if not all(isinstance(d, int) and d > 0 for d in static_shape[1:]):
        static_shape = [1, 43, 232, 1]

    print(f"Using voice model static input shape: {static_shape}")

    try:
        input_name = full_model.inputs[0].name
        if ":" in input_name:
            input_name = input_name.split(":")[0]
    except Exception:
        input_name = "input_1"

    print(f"Using input name for serving signature: {input_name}")

    @tf.function(
        input_signature=[
            tf.TensorSpec(shape=static_shape, dtype=tf.float32, name=input_name)
        ]
    )
    def serving_fn(x):
        return full_model(x)

    tf.saved_model.save(
        full_model, saved_model_dir, signatures={"serving_default": serving_fn}
    )
    print(f"Voice SavedModel saved: {saved_model_dir}")
    return full_model


def rebuild_pose_model_from_tfjs(model_json_path, weights_bin_path, saved_model_dir):
    import tensorflow as tf

    full_model = _load_head_model(model_json_path, weights_bin_path)

    static_shape = [1, 34]
    print(f"Using pose model static input shape: {static_shape}")

    try:
        input_name = full_model.inputs[0].name
        if ":" in input_name:
            input_name = input_name.split(":")[0]
    except Exception:
        input_name = "input_image"

    @tf.function(
        input_signature=[
            tf.TensorSpec(shape=static_shape, dtype=tf.float32, name=input_name)
        ]
    )
    def serving_fn(x):
        return full_model(x)

    tf.saved_model.save(
        full_model, saved_model_dir, signatures={"serving_default": serving_fn}
    )
    print(f"Pose SavedModel saved: {saved_model_dir}")
    return full_model


def rebuild_gesture_model_from_tfjs(model_json_path, weights_bin_path, saved_model_dir):
    import tensorflow as tf

    full_model = _load_head_model(model_json_path, weights_bin_path)

    # 210 = pairwise distances between all 21 MediaPipe hand landmarks
    # (21 choose 2), wrist-relative and palm-size-normalized. Must match
    # keypointsTo210Features() in gesture.html and
    # keypoints_to_210_features() in k230_scripts/test_gesture.py.
    static_shape = [1, 210]
    print(f"Using gesture model static input shape: {static_shape}")

    try:
        input_name = full_model.inputs[0].name
        if ":" in input_name:
            input_name = input_name.split(":")[0]
    except Exception:
        input_name = "input_features"

    @tf.function(
        input_signature=[
            tf.TensorSpec(shape=static_shape, dtype=tf.float32, name=input_name)
        ]
    )
    def serving_fn(x):
        return full_model(x)

    tf.saved_model.save(
        full_model, saved_model_dir, signatures={"serving_default": serving_fn}
    )
    print(f"Gesture SavedModel saved: {saved_model_dir}")
    return full_model


def _load_head_model(model_json_path, weights_bin_path):
    """Parse TF.js JSON + binary weights and return a Keras model with weights set."""
    import tensorflow as tf
    import struct

    with open(model_json_path, "r") as f:
        topology = json.load(f)

    if "modelTopology" in topology:
        model_config = topology["modelTopology"]
        weights_manifest = topology.get("weightsManifest", [])
    else:
        model_config = topology
        weights_manifest = []

    head_model = tf.keras.models.model_from_json(json.dumps(model_config))

    with open(weights_bin_path, "rb") as f:
        weights_data = f.read()

    weight_specs = []
    if weights_manifest:
        for group in weights_manifest:
            for spec in group.get("weights", []):
                weight_specs.append(spec)
    else:
        for layer in head_model.layers:
            for w in layer.weights:
                weight_specs.append(
                    {
                        "name": w.name,
                        "shape": w.shape.as_list(),
                        "dtype": w.dtype.name,
                    }
                )

    loaded_weights = {}
    offset = 0
    for spec in weight_specs:
        dtype = spec.get("dtype", "float32")
        shape = spec.get("shape", [])
        name = spec.get("name", "")

        num_elements = 1
        for dim in shape:
            if dim is not None and dim > 0:
                num_elements *= dim

        if dtype == "int32":
            byte_count, fmt = num_elements * 4, f"{num_elements}i"
        else:
            byte_count, fmt = num_elements * 4, f"{num_elements}f"

        if offset + byte_count > len(weights_data):
            print(f"WARNING: not enough bytes for {name}")
            break

        values = struct.unpack(fmt, weights_data[offset : offset + byte_count])
        arr = np.array(values, dtype=np.float32).reshape(shape)
        loaded_weights[name] = arr
        offset += byte_count

    ordered_weights = []
    unmatched_keras = []

    def norm(n):
        if ":" in n:
            n = n.split(":")[0]
        parts = n.split("/")
        if len(parts) >= 2:
            return "/".join(parts[-2:])
        return n

    norm_loaded_weights = {norm(k): v for k, v in loaded_weights.items()}

    for w in head_model.weights:
        w_name = w.name
        # 1. Exact match
        val = loaded_weights.get(w_name)
        if val is not None and val.shape == w.shape:
            ordered_weights.append(val)
            continue
        # 2. Strip ':0' suffix
        w_name_no_colon = w_name.split(":")[0] if ":" in w_name else w_name
        val = loaded_weights.get(w_name_no_colon)
        if val is not None and val.shape == w.shape:
            ordered_weights.append(val)
            continue
        # 3. Normalised name
        w_norm = norm(w_name)
        val = norm_loaded_weights.get(w_norm)
        if val is not None and val.shape == w.shape:
            ordered_weights.append(val)
            continue
        # 4. Shape + suffix similarity
        matched_by_shape = False
        for k, v in loaded_weights.items():
            if v.shape == w.shape:
                if norm(k).split("/")[-1] == w_norm.split("/")[-1]:
                    ordered_weights.append(v)
                    matched_by_shape = True
                    print(
                        f"Matched {w_name} to {k} by shape and type similarity: {w.shape}"
                    )
                    break
        if matched_by_shape:
            continue
        # 5. Position-based fallback
        idx = len(ordered_weights)
        if idx < len(weight_specs):
            fallback_spec = weight_specs[idx]
            fallback_name = fallback_spec.get("name", "")
            fallback_val = loaded_weights.get(fallback_name)
            if fallback_val is not None and fallback_val.shape == w.shape:
                ordered_weights.append(fallback_val)
                print(
                    f"Matched {w_name} to index fallback {fallback_name} (shape: {w.shape})"
                )
                continue
        # No match — fill zeros and warn
        unmatched_keras.append((w_name, w.shape))
        ordered_weights.append(np.zeros(w.shape, dtype=np.float32))

    if unmatched_keras:
        print(f"WARNING: some Keras weights were not matched: {unmatched_keras}")
    else:
        print("All Keras weights successfully matched by name/shape!")

    head_model.set_weights(ordered_weights)
    print(
        f"Head model loaded OK — {len(head_model.layers)} layers, "
        f"{len(ordered_weights)} weight tensors"
    )
    return head_model


def rebuild_model_for_esp32(model_json_path, weights_bin_path, saved_model_dir, input_size=96):
    """
    Rebuild the stitched model with NHWC float32 input for TFLite conversion.
    input_size controls the spatial resolution (e.g. 96, 224).
    MobileNet V3 uses GlobalAveragePooling so the 576-dim feature output is
    the same regardless of input_size — the trained head weights stay valid.
    """
    import tensorflow as tf
    import tensorflow_hub as hub

    head_model = _load_head_model(model_json_path, weights_bin_path)

    base_model = hub.KerasLayer(
        "https://tfhub.dev/google/imagenet/mobilenet_v3_small_100_224/feature_vector/5",
        trainable=False,
    )

    inputs = tf.keras.Input(
        batch_size=1,
        shape=(input_size, input_size, 3),
        dtype=tf.float32,
        name="input_image",
    )
    x = inputs / 255.0
    if input_size != 224:
        x = tf.keras.layers.Resizing(224, 224)(x)
    x = base_model(x)
    outputs = head_model(x)
    full_model = tf.keras.Model(inputs=inputs, outputs=outputs)

    @tf.function(
        input_signature=[
            tf.TensorSpec(
                shape=[1, input_size, input_size, 3],
                dtype=tf.float32,
                name="input_image",
            )
        ]
    )
    def serving_fn(x):
        return full_model(x)

    tf.saved_model.save(
        full_model, saved_model_dir, signatures={"serving_default": serving_fn}
    )
    print(
        f"ESP32-S3 SavedModel saved: {saved_model_dir} "
        f"(input: {input_size}x{input_size}, resize→224 inside graph)"
    )
    return full_model


def convert_to_tflite(saved_model_dir, tflite_path, input_size=96, calibration=None):
    """
    Convert SavedModel → INT8 quantised TFLite.

    FIX #8 — Previously this used np.random.rand() as calibration data, which
    produces uniform [0,1] floats completely unlike real camera images and causes
    quantisation scale miscalibration.  Now accepts optional real calibration
    frames (same calibration_bin mechanism as /convert-esp32-lite).
    """
    import tensorflow as tf

    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    def representative_dataset():
        if calibration is not None and len(calibration):
            for item in calibration[: min(len(calibration), 128)]:
                yield [item.reshape(1, input_size, input_size, 3).astype(np.float32)]
            return
        # Fallback: synthetic images spanning the uint8 value range.
        # Still not as good as real frames but far better than uniform random.
        rng = np.random.default_rng(42)
        for _ in range(100):
            # Simulate natural image statistics: most pixels cluster mid-range
            sample = rng.normal(0.45, 0.22, size=(1, input_size, input_size, 3))
            sample = np.clip(sample, 0.0, 1.0).astype(np.float32)
            yield [sample]

    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.uint8

    tflite_model = converter.convert()
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)

    size = len(tflite_model)
    print(
        f"TFLite INT8 model saved: {tflite_path} "
        f"({size} bytes, input: {input_size}x{input_size})"
    )
    return size


# =====================================================================
# /convert-esp32  (image, MobileNetV3, ESP32-S3)
# =====================================================================

@app.post("/convert-esp32")
async def convert_esp32(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
    input_size: int = Form(default=96),
    # FIX #8 — accept real calibration frames just like /convert-esp32-lite
    calibration_bin: UploadFile = File(default=None),
    calibration_count: int = Form(default=0),
):
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = json.loads(labels)

        model_json_path = os.path.join(tmpdir, "model.json")
        weights_bin_path = os.path.join(tmpdir, "weights.bin")
        labels_path = os.path.join(tmpdir, "labels.txt")
        saved_model_dir = os.path.join(tmpdir, "saved_model")
        tflite_path = os.path.join(tmpdir, "model.tflite")
        zip_path = os.path.join(tmpdir, "esp32_model.zip")

        topology = json.loads(model_json_bytes)
        with open(model_json_path, "w") as f:
            json.dump(topology, f)
        with open(weights_bin_path, "wb") as f:
            f.write(weights_bin_bytes)
        with open(labels_path, "w") as f:
            for label in label_list:
                f.write(label.strip() + "\n")

        print(f"[1/3] Files saved. Labels: {label_list}, input_size: {input_size}")

        print(f"[2/3] Rebuilding model for ESP32-S3 ({input_size}x{input_size} NHWC float32)...")
        try:
            rebuild_model_for_esp32(
                model_json_path, weights_bin_path, saved_model_dir, input_size
            )
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500, content={"error": f"Model rebuild failed: {str(e)}"}
            )

        # Parse calibration data if provided
        calibration = None
        if calibration_bin is not None:
            raw = await calibration_bin.read()
            expected = calibration_count * input_size * input_size * 3
            if calibration_count > 0 and len(raw) == expected * 4:
                calibration = np.frombuffer(raw, dtype="<f4").reshape(
                    calibration_count, input_size, input_size, 3
                )
                calibration = np.clip(calibration, 0.0, 1.0).astype(np.float32)

        print(f"[3/3] Converting to INT8 quantised TFLite ({input_size}x{input_size})...")
        try:
            tflite_size = convert_to_tflite(
                saved_model_dir, tflite_path, input_size, calibration
            )
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content={"error": f"TFLite conversion failed: {str(e)}"},
            )

        if not os.path.exists(tflite_path) or tflite_size < 10_000:
            return JSONResponse(
                status_code=500,
                content={"error": f"TFLite model too small: {tflite_size} bytes"},
            )

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(tflite_path, "model.tflite")
            zf.write(labels_path, "labels.txt")

        print("ESP32-S3 zip created OK")
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()

        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="esp32_model.zip"',
                "Access-Control-Allow-Origin": "*",
            },
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# =====================================================================
# DFR1154 Grayscale TinyML Micro-CNN Compiler Pipeline & Helpers
# =====================================================================

def parse_labels_lite(labels_json: str):
    labels = json.loads(labels_json or "[]")
    if not isinstance(labels, list):
        raise RuntimeError("labels must be a JSON array")
    clean = [str(label).strip() or f"Class{i + 1}" for i, label in enumerate(labels)]
    if len(clean) < 2:
        raise RuntimeError("Need at least 2 labels")
    if len(clean) > 16:
        raise RuntimeError("This firmware supports up to 16 labels")
    return clean


def build_small_cnn_lite(class_count: int, input_size: int = 96):
    import tensorflow as tf

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_size, input_size, 1)),
            tf.keras.layers.Conv2D(8, 3, padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=2),
            tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=2),
            tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=2),
            tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=12),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(class_count, activation="softmax"),
        ]
    )
    model(np.zeros((1, input_size, input_size, 1), dtype=np.float32))
    return model


def dtype_size_lite(dtype: str) -> int:
    if dtype == "float32":
        return 4
    if dtype == "int32":
        return 4
    if dtype == "bool":
        return 1
    raise RuntimeError(f"Unsupported TFJS weight dtype: {dtype}")


def decode_tfjs_weight_lite(raw: bytes, spec: dict):
    dtype = spec.get("dtype", "float32")
    shape = spec.get("shape")
    if not isinstance(shape, list):
        raise RuntimeError(f"Bad weight shape for {spec.get('name', '<unnamed>')}")
    count = int(np.prod(shape))
    size = count * dtype_size_lite(dtype)
    return dtype, shape, size


def load_tfjs_weights_lite(model, model_json_bytes: bytes, weights_bytes: bytes):
    model_json = json.loads(model_json_bytes.decode("utf-8"))
    manifests = model_json.get("weightsManifest") or []
    specs = []
    for manifest in manifests:
        specs.extend(manifest.get("weights") or [])
    if not specs:
        raise RuntimeError("No TFJS weights found in model_json")

    arrays = []
    offset = 0
    for spec in specs:
        dtype, shape, size = decode_tfjs_weight_lite(weights_bytes[offset:], spec)
        chunk = weights_bytes[offset : offset + size]
        if len(chunk) != size:
            raise RuntimeError(
                f"Truncated weight data at {spec.get('name', '<unnamed>')}"
            )
        offset += size
        if dtype == "float32":
            arr = np.frombuffer(chunk, dtype="<f4").reshape(shape).astype(np.float32)
        elif dtype == "int32":
            arr = np.frombuffer(chunk, dtype="<i4").reshape(shape).astype(np.int32)
        else:
            arr = np.frombuffer(chunk, dtype=np.bool_).reshape(shape)
        arrays.append(arr)

    # FIX #7 — TF.js sometimes pads the binary to an alignment boundary.
    # Treat leftover bytes as a warning, not a hard error.
    if offset != len(weights_bytes):
        leftover = len(weights_bytes) - offset
        print(
            f"WARNING: {leftover} extra bytes after reading TFJS weights "
            f"(likely alignment padding — safe to ignore)"
        )

    if len(arrays) != len(model.weights):
        raise RuntimeError(
            f"Weight count mismatch: TFJS has {len(arrays)}, "
            f"Keras model expects {len(model.weights)}"
        )

    for variable, value in zip(model.weights, arrays):
        expected = tuple(variable.shape.as_list())
        if tuple(value.shape) != expected:
            raise RuntimeError(
                f"Weight shape mismatch for {variable.name}: "
                f"got {value.shape}, expected {expected}"
            )
        variable.assign(value)


def load_lite_model_from_topology(model_json_bytes: bytes, weights_bin_bytes: bytes,
                                  input_size: int, class_count: int):
    """
    Rebuild an arbitrary TF.js layers model from its own topology instead of the
    fixed micro-CNN — used by the Teachable Machine ZIP export, whose model is a
    MobileNetV1-style 96×96 grayscale network (139 weight tensors, not 10).
    Reuses the generic _load_head_model() name/shape weight matcher.
    """
    tmpdir = tempfile.mkdtemp()
    try:
        mj_path = os.path.join(tmpdir, "model.json")
        wb_path = os.path.join(tmpdir, "weights.bin")
        with open(mj_path, "w") as f:
            f.write(model_json_bytes.decode("utf-8"))
        with open(wb_path, "wb") as f:
            f.write(weights_bin_bytes)
        model = _load_head_model(mj_path, wb_path)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    in_shape = tuple(model.input_shape[1:])
    if in_shape != (input_size, input_size, 1):
        raise RuntimeError(
            f"Rebuilt model input shape {in_shape} != ({input_size}, {input_size}, 1)"
        )
    out_units = int(model.output_shape[-1])
    if out_units != class_count:
        raise RuntimeError(
            f"Rebuilt model has {out_units} outputs but {class_count} labels"
        )
    model(np.zeros((1, input_size, input_size, 1), dtype=np.float32))
    return model


def wrap_for_dfr1154_quantization_lite(base_model, input_size: int = 96):
    """
    Wrap the micro-CNN so that the TFLite graph accepts int8 input in the range
    [-128, 127] (what the Arduino OV767X image provider produces after subtracting
    128 from a uint8 grayscale pixel) and maps it to [0.0, 1.0] before the first
    Conv layer — matching the float domain the model was trained in.

    The Rescaling(scale=0.5, offset=0.5) layer maps the dequantised float
    equivalent of [-1.0, 1.0] → [0.0, 1.0], which is correct because the PTQ
    converter will assign the input tensor a scale ≈ 1/128 and zero-point = 0,
    so int8 -128 → float -1.0 and int8 +127 → float ≈ +1.0.
    """
    import tensorflow as tf

    model_input = tf.keras.Input(
        shape=(input_size, input_size, 1), name="image_int8_normalized"
    )
    x = tf.keras.layers.Rescaling(
        scale=0.5, offset=0.5, name="to_browser_range"
    )(model_input)
    output = base_model(x)
    return tf.keras.Model(model_input, output, name="dfr1154_image_classifier")


def representative_dataset_lite(input_size: int = 96, calibration=None):
    """
    FIX #12 — Increased fallback from ~67 to 100 samples.
    """
    if calibration is not None and len(calibration):
        for item in calibration[: min(len(calibration), 128)]:
            sample = item.reshape(1, input_size, input_size, 1).astype(np.float32)
            yield [(sample * 2.0) - 1.0]
        return

    rng = np.random.default_rng(1154)
    # Edge samples
    zeros = np.zeros((1, input_size, input_size, 1), dtype=np.float32)
    ones = np.ones((1, input_size, input_size, 1), dtype=np.float32)
    yield [zeros - 1.0]
    yield [zeros]
    yield [ones]
    # 97 random samples (total = 100)
    for _ in range(97):
        yield [rng.uniform(-1.0, 1.0, size=(1, input_size, input_size, 1)).astype(np.float32)]


def convert_int8_lite(model, input_size: int = 96, calibration=None) -> bytes:
    import tensorflow as tf

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = lambda: representative_dataset_lite(
        input_size, calibration
    )
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def make_teachable_machine_arduino_zip(tflite_model: bytes, labels):
    """
    Package the INT8 TFLite model + a complete Arduino sketch into a ZIP.

    Fixes applied inside this function:
      FIX #1  — output->data.int8[i]  (was uint8, causing misread of negative scores)
      FIX #2  — hex lines joined with real newlines (was literal \\n in the .cpp)
      FIX #11 — removed kPersonIndex / kNotAPersonIndex from generated model_settings.h
    """
    import io

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        base = "tm_arduino_model/"

        # model.tflite (so WebSerial can still read it directly from the ZIP)
        zf.writestr(base + "model.tflite", tflite_model)
        zf.writestr(base + "labels.txt", "\n".join(labels) + "\n")

        # ── 1. arduino_main.cpp ──────────────────────────────────────────────
        zf.writestr(
            base + "arduino_main.cpp",
            """/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#include "main_functions.h"

// Arduino automatically calls setup() and loop() in a sketch,
// so this file can remain empty.
""",
        )

        # ── 2. tm_template_script.ino ────────────────────────────────────────
        # FIX #1: output->data.int8[i]  (was .uint8[i])
        zf.writestr(
            base + "tm_template_script.ino",
            """/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#include <TensorFlowLite.h>

#include "main_functions.h"
#include "image_provider.h"
#include "model_settings.h"
#include "person_detect_model_data.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "tensorflow/lite/version.h"

namespace {
tflite::ErrorReporter* error_reporter = nullptr;
const tflite::Model* model = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
TfLiteTensor* input = nullptr;

// Tensor arena: sized for the DFR1154 micro-CNN peak activation footprint (~81 KB).
// 136 KB gives comfortable headroom for TFLite Micro scratch + op buffers.
constexpr int kTensorArenaSize = 136 * 1024;
static uint8_t tensor_arena[kTensorArenaSize];
}  // namespace

void setup() {
  static tflite::MicroErrorReporter micro_error_reporter;
  error_reporter = &micro_error_reporter;

  model = tflite::GetModel(g_person_detect_model_data);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    TF_LITE_REPORT_ERROR(error_reporter,
                         "Model schema version %d != supported version %d.",
                         model->version(), TFLITE_SCHEMA_VERSION);
    return;
  }

  static tflite::MicroMutableOpResolver<6> micro_op_resolver;
  micro_op_resolver.AddAveragePool2D();
  micro_op_resolver.AddConv2D();
  micro_op_resolver.AddDepthwiseConv2D();
  micro_op_resolver.AddReshape();
  micro_op_resolver.AddSoftmax();
  micro_op_resolver.AddFullyConnected();

  static tflite::MicroInterpreter static_interpreter(
      model, micro_op_resolver, tensor_arena, kTensorArenaSize, error_reporter);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    TF_LITE_REPORT_ERROR(error_reporter, "AllocateTensors() failed");
    return;
  }

  input = interpreter->input(0);
}

void loop() {
  if (kTfLiteOk != GetImage(error_reporter, kNumCols, kNumRows, kNumChannels,
                            input->data.int8)) {
    TF_LITE_REPORT_ERROR(error_reporter, "Image capture failed.");
    return;
  }

  if (kTfLiteOk != interpreter->Invoke()) {
    TF_LITE_REPORT_ERROR(error_reporter, "Invoke failed.");
    return;
  }

  TfLiteTensor* output = interpreter->output(0);

  // FIX: output tensor is INT8 (signed, range -128..127).
  // Reading via .uint8 would misinterpret negative scores as large positive
  // values (e.g. -128 would appear as 128), making low-confidence outputs
  // look high-confidence. Use .int8 instead.
  for (int i = 0; i < kCategoryCount; i++) {
    int8_t score = output->data.int8[i];
    TF_LITE_REPORT_ERROR(error_reporter, "%s : %d",
                         kCategoryLabels[i], static_cast<int>(score));
  }
}
""",
        )

        # ── 3. arduino_image_provider.cpp ───────────────────────────────────
        zf.writestr(
            base + "arduino_image_provider.cpp",
            """/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  ==============================================================================*/

#include "image_provider.h"

#if defined(ARDUINO) && !defined(ARDUINO_ARDUINO_NANO33BLE)
#define ARDUINO_EXCLUDE_CODE
#endif

#ifndef ARDUINO_EXCLUDE_CODE

#include <Arduino.h>
#include <Arduino_OV767X.h>

const int kCaptureWidth  = 320;
const int kCaptureHeight = 240;

// QVGA frame buffer: 320×240 × 2 bytes/pixel (RGB565)
byte captured_data[kCaptureWidth * kCaptureHeight * 2];

TfLiteStatus ProcessImage(
    tflite::ErrorReporter* error_reporter,
    int image_width, int image_height,
    int8_t* image_data) {

  const int imgSize = 96;
  uint16_t color;

  for (int y = 0; y < imgSize; y++) {
    for (int x = 0; x < imgSize; x++) {
      // Map output pixel to a centre-cropped region of the capture frame.
      // X: skip 40 pixels on each side of the 320-wide frame.
      // Y: use full 240-pixel height.
      int capX = (int)floor(map(x, 0, imgSize, 40, kCaptureWidth - 80));
      int capY = (int)floor(map(y, 0, imgSize, 0, kCaptureHeight));

      int read_index = (capY * kCaptureWidth + capX) * 2;
      uint8_t high_byte = captured_data[read_index];
      uint8_t low_byte  = captured_data[read_index + 1];

      color = ((uint16_t)high_byte << 8) | low_byte;

      // RGB565 → 8-bit channels
      uint8_t r = ((color & 0xF800) >> 11) * 8;
      uint8_t g = ((color & 0x07E0) >>  5) * 4;
      uint8_t b = ((color & 0x001F)      ) * 8;

      // Rec. 709 luminance coefficients
      float gray = (0.2126f * r) + (0.7152f * g) + (0.0722f * b);

      // Shift to signed int8 range: [0,255] → [-128,127]
      gray -= 128.0f;

      image_data[y * image_width + x] = static_cast<int8_t>(gray);
    }
  }
  return kTfLiteOk;
}

TfLiteStatus GetImage(tflite::ErrorReporter* error_reporter,
                      int image_width, int image_height,
                      int channels, int8_t* image_data) {
  static bool g_is_camera_initialized = false;
  if (!g_is_camera_initialized) {
    if (!Camera.begin(QVGA, RGB565, 1)) {
      return kTfLiteError;
    }
    g_is_camera_initialized = true;
  }

  Camera.readFrame(captured_data);

  TfLiteStatus status = ProcessImage(
      error_reporter, image_width, image_height, image_data);
  if (status != kTfLiteOk) {
    TF_LITE_REPORT_ERROR(error_reporter, "ProcessImage failed");
  }
  return status;
}

#endif  // ARDUINO_EXCLUDE_CODE
""",
        )

        # ── 4. image_provider.h ──────────────────────────────────────────────
        zf.writestr(
            base + "image_provider.h",
            """/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#ifndef TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_IMAGE_PROVIDER_H_
#define TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_IMAGE_PROVIDER_H_

#include "tensorflow/lite/c/common.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"

TfLiteStatus GetImage(tflite::ErrorReporter* error_reporter,
                      int image_width, int image_height,
                      int channels, int8_t* image_data);

#endif  // TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_IMAGE_PROVIDER_H_
""",
        )

        # ── 5. main_functions.h ──────────────────────────────────────────────
        zf.writestr(
            base + "main_functions.h",
            """/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#ifndef TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_MAIN_FUNCTIONS_H_
#define TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_MAIN_FUNCTIONS_H_

#ifdef __cplusplus
extern "C" {
#endif

void setup();
void loop();

#ifdef __cplusplus
}
#endif

#endif  // TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_MAIN_FUNCTIONS_H_
""",
        )

        # ── 6. model_settings.cpp ────────────────────────────────────────────
        labels_str = ",\n".join([f'    "{l}"' for l in labels]) + ","
        zf.writestr(
            base + "model_settings.cpp",
            f"""/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#include "model_settings.h"

const char* kCategoryLabels[kCategoryCount] = {{
{labels_str}
}};
""",
        )

        # ── 7. model_settings.h ──────────────────────────────────────────────
        # FIX #11 — removed kPersonIndex / kNotAPersonIndex.
        # These were TF person-detection legacy constants with no meaning for
        # custom classes; they were unused in the .ino and caused confusion.
        zf.writestr(
            base + "model_settings.h",
            f"""/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#ifndef TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_MODEL_SETTINGS_H_
#define TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_MODEL_SETTINGS_H_

constexpr int kNumCols     = 96;
constexpr int kNumRows     = 96;
constexpr int kNumChannels = 1;

constexpr int kMaxImageSize = kNumCols * kNumRows * kNumChannels;

constexpr int kCategoryCount = {len(labels)};
extern const char* kCategoryLabels[kCategoryCount];

#endif  // TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_MODEL_SETTINGS_H_
""",
        )

        # ── 8. person_detect_model_data.h ───────────────────────────────────
        zf.writestr(
            base + "person_detect_model_data.h",
            """/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#ifndef TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_PERSON_DETECT_MODEL_DATA_H_
#define TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_PERSON_DETECT_MODEL_DATA_H_

extern const unsigned char g_person_detect_model_data[];
extern const int g_person_detect_model_data_len;

#endif  // TENSORFLOW_LITE_MICRO_EXAMPLES_PERSON_DETECTION_PERSON_DETECT_MODEL_DATA_H_
""",
        )

        # ── 9. person_detect_model_data.cpp ─────────────────────────────────
        # FIX #2 — join with a real newline character, not the literal string "\n".
        # The previous code used ",\\n".join(...) which wrote backslash-n into
        # the .cpp file, collapsing all hex data onto one giant line.
        hex_lines = []
        for i in range(0, len(tflite_model), 12):
            chunk = tflite_model[i : i + 12]
            hex_lines.append("  " + ", ".join([f"0x{b:02x}" for b in chunk]))
        _NL = "\n"
        hex_data = ("," + _NL).join(hex_lines)  # FIX #2: real newline between rows

        zf.writestr(
            base + "person_detect_model_data.cpp",
            f"""/* Copyright 2019 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

#include "person_detect_model_data.h"

// This file is auto-generated by the Curio Makers Labs model conversion server.
// Do not edit manually.

alignas(8) const unsigned char g_person_detect_model_data[] = {{
{hex_data}
}};
const int g_person_detect_model_data_len = {len(tflite_model)};
""",
        )

    return out.getvalue()


# =====================================================================
# /convert-esp32-lite  (DFR1154 / Arduino Nano 33 BLE)
# =====================================================================

@app.post("/convert-esp32-lite")
async def convert_esp32_lite(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
    input_size: int = Form(default=96),
    calibration_bin: UploadFile = File(default=None),
    calibration_count: int = Form(default=0),
):
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = parse_labels_lite(labels)

        if input_size != 96:
            raise RuntimeError("DFR1154 image firmware expects input_size=96")

        base_model = build_small_cnn_lite(len(label_list), input_size)
        try:
            load_tfjs_weights_lite(base_model, model_json_bytes, weights_bin_bytes)
        except RuntimeError as err:
            if "Weight count mismatch" not in str(err):
                raise
            # Not the fixed micro-CNN (e.g. Teachable Machine-style MobileNet
            # from the TM ZIP button) — rebuild from the TF.js topology itself.
            print("Micro-CNN weight layout mismatch — rebuilding model from TF.js topology...")
            base_model = load_lite_model_from_topology(
                model_json_bytes, weights_bin_bytes, input_size, len(label_list)
            )
        full_model = wrap_for_dfr1154_quantization_lite(base_model, input_size)

        calibration = None
        if calibration_bin is not None:
            raw = await calibration_bin.read()
            expected = calibration_count * input_size * input_size
            if calibration_count > 0 and len(raw) == expected * 4:
                calibration = np.frombuffer(raw, dtype="<f4").reshape(
                    calibration_count, input_size, input_size, 1
                )
                calibration = np.clip(calibration, 0.0, 1.0).astype(np.float32)

        tflite_model = convert_int8_lite(full_model, input_size, calibration)
        zip_bytes = make_teachable_machine_arduino_zip(tflite_model, label_list)

        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="tm_arduino_model.zip"',
                "Access-Control-Allow-Origin": "*",
            },
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


# =====================================================================
# /convert  (K230 kmodel, image)
# =====================================================================

@app.post("/convert")
async def convert(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
    calibration_bin: UploadFile = File(default=None),
    calibration_count: int = Form(default=0),
):
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = json.loads(labels)

        model_json_path = os.path.join(tmpdir, "model.json")
        weights_bin_path = os.path.join(tmpdir, "weights.bin")
        labels_path = os.path.join(tmpdir, "labels.txt")
        saved_model_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "model.onnx")
        kmodel_path = os.path.join(tmpdir, "model.kmodel")
        zip_path = os.path.join(tmpdir, "k230_model.zip")

        topology = json.loads(model_json_bytes)
        with open(model_json_path, "w") as f:
            json.dump(topology, f)
        with open(weights_bin_path, "wb") as f:
            f.write(weights_bin_bytes)
        with open(labels_path, "w") as f:
            for label in label_list:
                f.write(label.strip() + "\n")

        # Save calibration data to file if provided
        calib_bin_path = None
        if calibration_bin is not None:
            raw = await calibration_bin.read()
            if calibration_count > 0 and len(raw) > 0:
                print(f"Received calibration data: {len(raw)} bytes, {calibration_count} samples")
                print(f"Using {calibration_count} real calibration samples for PTQ")
                calib_bin_path = os.path.join(tmpdir, "calib.bin")
                with open(calib_bin_path, "wb") as f:
                    f.write(raw)

        print(f"[1/4] Files saved. Labels: {label_list}")

        print("[2/4] Rebuilding model from TF.js artifacts...")
        try:
            rebuild_model_from_tfjs(model_json_path, weights_bin_path, saved_model_dir)
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500, content={"error": f"Model rebuild failed: {str(e)}"}
            )

        print("[3/4] SavedModel → ONNX...")
        r2 = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_model_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True, text=True, timeout=120,
        )
        print("tf2onnx stdout:", r2.stdout)
        print("tf2onnx stderr:", r2.stderr)
        if r2.returncode != 0:
            return JSONResponse(
                status_code=500, content={"error": f"ONNX failed: {r2.stderr}"}
            )

        print("[4/4] ONNX → kmodel...")
        nncase_cmd = ["python", nncase_compile_path, onnx_path, kmodel_path]
        if calib_bin_path:
            nncase_cmd += [calib_bin_path, str(calibration_count)]
        r3 = subprocess.run(
            nncase_cmd,
            capture_output=True, text=True, timeout=300,
        )
        print("nncase stdout:", r3.stdout)
        print("nncase stderr:", r3.stderr)
        if r3.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "kmodel compilation failed",
                    "details": r3.stderr,
                    "stdout": r3.stdout,
                },
            )

        if not os.path.exists(kmodel_path):
            return JSONResponse(
                status_code=500, content={"error": "kmodel file not created"}
            )

        kmodel_size = os.path.getsize(kmodel_path)
        if kmodel_size < 100:
            return JSONResponse(
                status_code=500,
                content={"error": f"kmodel too small: {kmodel_size} bytes"},
            )

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(kmodel_path, "model.kmodel")
            zf.write(labels_path, "labels.txt")

        # Read into memory before finally-cleanup deletes the tmpdir
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()

        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="k230_model.zip"'},
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# =====================================================================
# /convert-voice  (K230 kmodel, voice)
# =====================================================================

@app.post("/convert-voice")
async def convert_voice(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
):
    """Convert a TF.js voice model into a .kmodel ZIP for K230."""
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = json.loads(labels)

        model_json_path = os.path.join(tmpdir, "model.json")
        weights_bin_path = os.path.join(tmpdir, "weights.bin")
        labels_path = os.path.join(tmpdir, "labels.txt")
        saved_model_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "model.onnx")
        kmodel_path = os.path.join(tmpdir, "model.kmodel")
        zip_path = os.path.join(tmpdir, "voice_kmodel.zip")

        topology = json.loads(model_json_bytes)
        with open(model_json_path, "w") as f:
            json.dump(topology, f)
        with open(weights_bin_path, "wb") as f:
            f.write(weights_bin_bytes)
        with open(labels_path, "w") as f:
            for label in label_list:
                f.write(label.strip() + "\n")

        print("[voice 1/4] Files saved. Labels:", label_list)

        print("[voice 2/4] Rebuilding model from TF.js artifacts...")
        try:
            rebuild_voice_model_from_tfjs(
                model_json_path, weights_bin_path, saved_model_dir
            )
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500, content={"error": f"Model rebuild failed: {str(e)}"}
            )

        print("[voice 3/4] SavedModel → ONNX...")
        r2 = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_model_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True, text=True, timeout=120,
        )
        print("tf2onnx stdout:", r2.stdout)
        print("tf2onnx stderr:", r2.stderr)
        if r2.returncode != 0:
            return JSONResponse(
                status_code=500, content={"error": f"ONNX failed: {r2.stderr}"}
            )

        print("[voice 4/4] ONNX → kmodel (nncase)...")
        r3 = subprocess.run(
            ["python", nncase_compile_path, "--no-ptq", onnx_path, kmodel_path],
            capture_output=True, text=True, timeout=300,
        )
        print("nncase stdout:", r3.stdout)
        print("nncase stderr:", r3.stderr)
        if r3.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "kmodel compilation failed",
                    "details": r3.stderr,
                    "stdout": r3.stdout,
                },
            )

        if not os.path.exists(kmodel_path):
            return JSONResponse(
                status_code=500, content={"error": "kmodel file not created"}
            )

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(kmodel_path, "model.kmodel")
            zf.write(labels_path, "labels.txt")

        print("Voice kmodel zip created OK")
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="voice_kmodel.zip"'},
        )

    except Exception as e:
        # FIX #3 — previously this block had no return, causing FastAPI to
        # return an empty 200 response on every voice conversion error.
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # FIX #5 — previously the finally block had no cleanup code at all,
        # leaking a temp directory on every request (success or failure).
        shutil.rmtree(tmpdir, ignore_errors=True)


# =====================================================================
# /convert-voice-esp32  (ESP32-S3, voice micro-CNN)
# =====================================================================

def build_voice_micro_cnn_lite(class_count: int):
    import tensorflow as tf

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(43, 232, 1)),
            tf.keras.layers.Conv2D(8, (5, 5), strides=(2, 2), padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
            tf.keras.layers.Conv2D(12, (3, 3), strides=(2, 2), padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(24, activation="relu"),
            tf.keras.layers.Dense(class_count, activation="softmax"),
        ]
    )
    model(np.zeros((1, 43, 232, 1), dtype=np.float32))
    return model


@app.post("/convert-voice-esp32")
async def convert_voice_esp32(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
    calibration_data: UploadFile = File(None),
):
    """
    Convert a TF.js voice micro-CNN model into a fully-quantised INT8 TFLite
    model packed in a ZIP for the ESP32-S3.
    """
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = parse_labels_lite(labels)

        base_model = build_voice_micro_cnn_lite(len(label_list))
        load_tfjs_weights_lite(base_model, model_json_bytes, weights_bin_bytes)

        calib_samples = None
        if calibration_data is not None:
            calib_bytes = await calibration_data.read()
            if len(calib_bytes) > 0:
                num_floats = len(calib_bytes) // 4
                sample_size = 43 * 232
                num_samples = num_floats // sample_size
                if num_samples > 0:
                    calib_samples = np.frombuffer(calib_bytes, dtype="<f4").reshape(
                        num_samples, 43, 232, 1
                    )

        import tensorflow as tf

        def representative_dataset():
            if calib_samples is not None:
                for i in range(len(calib_samples)):
                    yield [calib_samples[i : i + 1].astype(np.float32)]
            else:
                rng = np.random.default_rng(123)
                for _ in range(100):
                    # Synthetic NORMALIZED log-spectrogram data. Features are
                    # per-spectrogram mean/std normalized (see
                    # _tiny_voice_normalize_spec), so the calibration range is
                    # mean 0 / std 1 -- not the raw log range (-5.0, 3.0) this
                    # used before normalization was introduced.
                    sample = rng.normal(0.0, 1.0, size=(1, 43, 232, 1)).astype(np.float32)
                    yield [sample]

        converter = tf.lite.TFLiteConverter.from_keras_model(base_model)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.int8
        converter.inference_output_type = tf.int8
        tflite_model = converter.convert()

        print(f"Voice Micro INT8 TFLite compiled: {len(tflite_model)} bytes")

        import io

        labels_txt = "\n".join(label_list) + "\n"
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("model.tflite", tflite_model)
            zf.writestr("labels.txt", labels_txt)

        return Response(
            content=out.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="voice_esp32_model.zip"',
                "Access-Control-Allow-Origin": "*",
            },
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


# =====================================================================
# /convert-pose  (K230 kmodel, pose classifier)
# =====================================================================

@app.post("/convert-pose")
async def convert_pose(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
):
    """Convert a TF.js pose classifier model (dense head) into a .kmodel ZIP for K230."""
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = json.loads(labels)

        model_json_path = os.path.join(tmpdir, "model.json")
        weights_bin_path = os.path.join(tmpdir, "weights.bin")
        labels_path = os.path.join(tmpdir, "labels.txt")
        saved_model_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "model.onnx")
        kmodel_path = os.path.join(tmpdir, "model.kmodel")
        zip_path = os.path.join(tmpdir, "pose_kmodel.zip")

        topology = json.loads(model_json_bytes)
        with open(model_json_path, "w") as f:
            json.dump(topology, f)
        with open(weights_bin_path, "wb") as f:
            f.write(weights_bin_bytes)
        with open(labels_path, "w") as f:
            for label in label_list:
                f.write(label.strip() + "\n")

        print("[pose 1/4] Files saved. Labels:", label_list)

        print("[pose 2/4] Rebuilding model from TF.js artifacts...")
        try:
            rebuild_pose_model_from_tfjs(
                model_json_path, weights_bin_path, saved_model_dir
            )
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500, content={"error": f"Model rebuild failed: {str(e)}"}
            )

        print("[pose 3/4] SavedModel → ONNX...")
        r2 = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_model_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True, text=True, timeout=120,
        )
        print("tf2onnx stdout:", r2.stdout)
        print("tf2onnx stderr:", r2.stderr)
        if r2.returncode != 0:
            return JSONResponse(
                status_code=500, content={"error": f"ONNX failed: {r2.stderr}"}
            )

        print("[pose 4/4] ONNX → kmodel (nncase)...")
        r3 = subprocess.run(
            ["python", nncase_compile_path, "--no-ptq", onnx_path, kmodel_path],
            capture_output=True, text=True, timeout=300,
        )
        print("nncase stdout:", r3.stdout)
        print("nncase stderr:", r3.stderr)
        if r3.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "kmodel compilation failed",
                    "details": r3.stderr,
                    "stdout": r3.stdout,
                },
            )

        if not os.path.exists(kmodel_path):
            return JSONResponse(
                status_code=500, content={"error": "kmodel file not created"}
            )

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(kmodel_path, "model.kmodel")
            zf.write(labels_path, "labels.txt")

        print("Pose kmodel zip created OK")
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="pose_kmodel.zip"'},
        )

    except Exception as e:
        # FIX #4 — previously this block had no return statement.
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # FIX #6 — previously the finally block had no cleanup code at all.
        shutil.rmtree(tmpdir, ignore_errors=True)


@app.post("/convert-gesture")
async def convert_gesture(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
):
    """Convert a TF.js gesture classifier model (dense head on 210 hand-landmark
    features) into a .kmodel ZIP for K230."""
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = json.loads(labels)

        model_json_path = os.path.join(tmpdir, "model.json")
        weights_bin_path = os.path.join(tmpdir, "weights.bin")
        labels_path = os.path.join(tmpdir, "labels.txt")
        saved_model_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "model.onnx")
        kmodel_path = os.path.join(tmpdir, "model.kmodel")
        zip_path = os.path.join(tmpdir, "gesture_kmodel.zip")

        topology = json.loads(model_json_bytes)
        with open(model_json_path, "w") as f:
            json.dump(topology, f)
        with open(weights_bin_path, "wb") as f:
            f.write(weights_bin_bytes)
        with open(labels_path, "w") as f:
            for label in label_list:
                f.write(label.strip() + "\n")

        print("[gesture 1/4] Files saved. Labels:", label_list)

        print("[gesture 2/4] Rebuilding model from TF.js artifacts...")
        try:
            rebuild_gesture_model_from_tfjs(
                model_json_path, weights_bin_path, saved_model_dir
            )
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500, content={"error": f"Model rebuild failed: {str(e)}"}
            )

        print("[gesture 3/4] SavedModel → ONNX...")
        r2 = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_model_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True, text=True, timeout=120,
        )
        print("tf2onnx stdout:", r2.stdout)
        print("tf2onnx stderr:", r2.stderr)
        if r2.returncode != 0:
            return JSONResponse(
                status_code=500, content={"error": f"ONNX failed: {r2.stderr}"}
            )

        print("[gesture 4/4] ONNX → kmodel (nncase)...")
        r3 = subprocess.run(
            ["python", nncase_compile_path, "--no-ptq", onnx_path, kmodel_path],
            capture_output=True, text=True, timeout=300,
        )
        print("nncase stdout:", r3.stdout)
        print("nncase stderr:", r3.stderr)
        if r3.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "kmodel compilation failed",
                    "details": r3.stderr,
                    "stdout": r3.stdout,
                },
            )

        if not os.path.exists(kmodel_path):
            return JSONResponse(
                status_code=500, content={"error": "kmodel file not created"}
            )

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(kmodel_path, "model.kmodel")
            zf.write(labels_path, "labels.txt")

        print("Gesture kmodel zip created OK")
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="gesture_kmodel.zip"'},
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# =====================================================================
# /deploy  (K230 OTA deploy, image)
# =====================================================================

async def push_to_k230(client, filepath, filename, k230_url):
    with open(filepath, "rb") as f:
        data = f.read()
    headers = {
        "X-Filename": filename,
        "Content-Type": "application/octet-stream",
        "Content-Length": str(len(data)),
    }
    resp = await client.post(k230_url, content=data, headers=headers, timeout=60.0)
    return resp.status_code == 200


@app.post("/deploy")
async def deploy(
    model_json: UploadFile = File(...),
    weights_bin: UploadFile = File(...),
    labels: str = Form(...),
    k230_ip: str = Form(default="192.168.169.1"),
    k230_port: int = Form(default=8080),
):
    tmpdir = tempfile.mkdtemp()
    try:
        model_json_bytes = await model_json.read()
        weights_bin_bytes = await weights_bin.read()
        label_list = json.loads(labels)

        model_json_path = os.path.join(tmpdir, "model.json")
        weights_bin_path = os.path.join(tmpdir, "weights.bin")
        labels_path = os.path.join(tmpdir, "labels.txt")
        saved_model_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "model.onnx")
        kmodel_path = os.path.join(tmpdir, "model.kmodel")

        topology = json.loads(model_json_bytes)
        with open(model_json_path, "w") as f:
            json.dump(topology, f)
        with open(weights_bin_path, "wb") as f:
            f.write(weights_bin_bytes)
        with open(labels_path, "w") as f:
            for label in label_list:
                f.write(label.strip() + "\n")

        print(f"[1/4] Files saved. Labels: {label_list}")

        print("[2/4] Rebuilding model from TF.js artifacts...")
        try:
            rebuild_model_from_tfjs(model_json_path, weights_bin_path, saved_model_dir)
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=500, content={"error": f"Model rebuild failed: {str(e)}"}
            )

        print("[3/4] SavedModel → ONNX...")
        r2 = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_model_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True, text=True, timeout=120,
        )
        if r2.returncode != 0:
            return JSONResponse(
                status_code=500, content={"error": f"ONNX failed: {r2.stderr}"}
            )

        print("[4/4] ONNX → kmodel...")
        r3 = subprocess.run(
            ["python", nncase_compile_path, onnx_path, kmodel_path],
            capture_output=True, text=True, timeout=300,
        )
        if r3.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "kmodel compilation failed",
                    "details": r3.stderr,
                    "stdout": r3.stdout,
                },
            )

        if not os.path.exists(kmodel_path):
            return JSONResponse(
                status_code=500, content={"error": "kmodel file not created"}
            )

        kmodel_size = os.path.getsize(kmodel_path)
        if kmodel_size < 100:
            return JSONResponse(
                status_code=500,
                content={"error": f"kmodel too small: {kmodel_size} bytes"},
            )

        k230_url = f"http://{k230_ip}:{k230_port}/upload"
        print(f"Pushing to K230 at {k230_url}...")
        try:
            client = app.state.client
            kmodel_ok = await push_to_k230(client, kmodel_path, "model.kmodel", k230_url)
            labels_ok = await push_to_k230(client, labels_path, "labels.txt", k230_url)
            if not kmodel_ok or not labels_ok:
                return JSONResponse(
                    status_code=502,
                    content={"error": "Failed to upload to K230 (status code not 200)"},
                )
        except Exception as e:
            traceback.print_exc()
            return JSONResponse(
                status_code=502,
                content={"error": f"Failed to connect to K230 at {k230_url}: {str(e)}"},
            )

        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "kmodel_size": kmodel_size,
                "deployed": ["model.kmodel", "labels.txt"],
            },
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# =====================================================================
# /proxy  (CORS proxy for K230 IP camera)
# =====================================================================

@app.get("/proxy")
async def proxy_cam(url: str = Query(..., description="Camera URL to proxy")):
    """
    Fetch any IP camera URL server-side and return it with CORS headers.
    Solves browser CORS restriction for K230 mjpg-streamer.

    FIX #10 — The original code manually called .__aenter__() on the httpx
    stream context manager and never called .__aexit__(), leaking connections.
    Now uses a proper async generator that manages the context correctly.
    """
    client = app.state.client
    proxy_timeout = httpx.Timeout(10.0, connect=5.0, read=15.0)

    async def stream_generator():
        async with client.stream("GET", url, timeout=proxy_timeout) as response:
            async for chunk in response.aiter_bytes():
                yield chunk

    try:
        # Peek at the response headers without consuming the body
        head_response = await client.head(url, timeout=proxy_timeout)
        content_type = head_response.headers.get("Content-Type", "image/jpeg")

        if head_response.status_code >= 400:
            return JSONResponse(
                status_code=head_response.status_code,
                content={"error": f"Camera returned status {head_response.status_code}"},
            )

        if "multipart/x-mixed-replace" in content_type:
            return StreamingResponse(
                stream_generator(),
                media_type=content_type,
                headers={
                    "Cache-Control": "no-store",
                    "Access-Control-Allow-Origin": "*",
                },
            )
        else:
            # Single frame — fetch fully
            response = await client.get(url, timeout=proxy_timeout)
            return Response(
                content=response.content,
                media_type=response.headers.get("Content-Type", "image/jpeg"),
                headers={
                    "Cache-Control": "no-store",
                    "Access-Control-Allow-Origin": "*",
                },
            )

    except httpx.ReadTimeout:
        return JSONResponse(status_code=504, content={"error": "Camera read timeout"})
    except httpx.ConnectTimeout:
        return JSONResponse(status_code=504, content={"error": "Camera connect timeout"})
    except Exception as e:
        print(f"Proxy error for {url}: {repr(e)}")
        return JSONResponse(status_code=500, content={"error": repr(e)})


# =====================================================================
# /health  and  /test-conversion
# =====================================================================

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/test-conversion")
async def test_conversion():
    tmpdir = tempfile.mkdtemp()
    try:
        import tensorflow as tf

        model = tf.keras.Sequential(
            [
                tf.keras.layers.Dense(100, activation="relu", input_shape=(256,)),
                tf.keras.layers.Dense(2, activation="softmax"),
            ]
        )
        model.compile(optimizer="adam", loss="categorical_crossentropy")

        saved_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "test.onnx")
        kmodel_path = os.path.join(tmpdir, "test.kmodel")

        model.save(saved_dir)

        r1 = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True, text=True,
        )
        if r1.returncode != 0:
            return {"step": "onnx", "error": r1.stderr}

        r2 = subprocess.run(
            ["python", nncase_compile_path, onnx_path, kmodel_path],
            capture_output=True, text=True,
        )
        if r2.returncode != 0:
            return {"step": "kmodel", "error": r2.stderr, "stdout": r2.stdout}

        return {
            "status": "ok",
            "onnx_size": os.path.getsize(onnx_path),
            "kmodel_size": os.path.getsize(kmodel_path) if os.path.exists(kmodel_path) else 0,
            "nncase_stdout": r2.stdout,
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# =====================================================================
# Server-Side Tiny Voice Training & Export  (/convert-tiny)
# =====================================================================

import math
import wave
import io

TINY_VOICE_SR = 16000
TINY_VOICE_FRAMES = 43
TINY_VOICE_BINS = 232
TINY_VOICE_FFT_WINDOW = 1024


def _tiny_voice_read_wav_16k(path):
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())
    if rate != TINY_VOICE_SR:
        raise RuntimeError(f"{path.name} is {rate} Hz. Expected {TINY_VOICE_SR} Hz.")
    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    if len(audio) < TINY_VOICE_SR:
        padded = np.zeros((TINY_VOICE_SR,), dtype=np.float32)
        padded[: len(audio)] = audio
        return padded
    return audio[: TINY_VOICE_SR]


def _tiny_voice_logspec_raw(audio: np.ndarray) -> np.ndarray:
    """Hann-1024 log-magnitude spectrogram, NOT yet normalized. Shape (43, 232).

    Split out from _tiny_voice_spectrogram_1s so augmentation can act on the raw
    log-spectrogram (e.g. spectral tilt) before normalization is applied.
    """
    hop = max(
        1,
        int(math.floor((TINY_VOICE_SR - TINY_VOICE_FFT_WINDOW) / max(1, TINY_VOICE_FRAMES - 1))),
    )
    window = np.hanning(TINY_VOICE_FFT_WINDOW).astype(np.float32)
    spec = np.zeros((TINY_VOICE_FRAMES, TINY_VOICE_BINS), dtype=np.float32)
    for frame_index in range(TINY_VOICE_FRAMES):
        start = frame_index * hop
        frame = np.zeros((TINY_VOICE_FFT_WINDOW,), dtype=np.float32)
        take = max(0, min(TINY_VOICE_FFT_WINDOW, len(audio) - start))
        if take:
            frame[:take] = audio[start : start + take]
        mag = np.abs(np.fft.rfft(frame * window))[:TINY_VOICE_BINS]
        spec[frame_index, :] = np.log(np.maximum(mag, 1e-6))
    return spec


def _tiny_voice_normalize_spec(spec: np.ndarray) -> np.ndarray:
    """Per-spectrogram mean/std normalization.

    Cancels the constant log-offset that a microphone gain difference produces,
    so a model trained on laptop-mic clips transfers to the ESP32-S3 PDM mic.
    MUST stay identical to the browser (computeNormalizedSpectrogram), the K230
    script, and the ESP32 firmware (tm_speech_commands_norm_log mode):
    population std (ddof=0), epsilon 1e-4.
    """
    mean = float(spec.mean())
    std = float(spec.std()) + 1e-4
    return (spec - mean) / std


def _tiny_voice_spectrogram_1s(audio: np.ndarray) -> np.ndarray:
    """Public entry point: normalized log-spectrogram, shape (43, 232, 1)."""
    spec = _tiny_voice_normalize_spec(_tiny_voice_logspec_raw(audio))
    return spec.reshape(TINY_VOICE_FRAMES, TINY_VOICE_BINS, 1).astype(np.float32)


def _tiny_voice_safe_extract(zip_data: bytes, out_dir):
    from pathlib import Path

    with zipfile.ZipFile(io.BytesIO(zip_data), "r") as zf:
        for member in zf.infolist():
            target = (out_dir / member.filename).resolve()
            if not str(target).startswith(str(out_dir.resolve())):
                raise RuntimeError("Unsafe zip path")
            zf.extract(member, out_dir)


def _tiny_voice_load_dataset(dataset_dir, requested_labels):
    """
    FIX #14 — label folder collision: labels like 'My Class' and 'My_Class'
    previously both sanitised to 'My_Class', causing a silent merge.
    Now the index is appended as a fallback tiebreaker.
    """
    import tensorflow as tf
    from pathlib import Path

    class_dirs = []
    for idx, label in enumerate(requested_labels):
        # Primary sanitisation
        safe = (
            "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in label)
            or "class"
        )
        # Collision guard: if another label already claimed this safe name,
        # append the index to disambiguate.
        safe_names_used = [d[0] for d in class_dirs]
        if safe in safe_names_used:
            safe = f"{safe}_{idx}"

        direct = dataset_dir / safe
        if direct.is_dir():
            class_dirs.append((safe, label, direct))
            continue
        fallback = dataset_dir / label
        if fallback.is_dir():
            class_dirs.append((safe, label, fallback))

    if not class_dirs:
        for p in sorted(dataset_dir.iterdir()):
            if p.is_dir():
                class_dirs.append((p.name, p.name.replace("_", " "), p))

    if not class_dirs:
        raise RuntimeError("No class folders found in dataset")

    xs, ys, labels = [], [], []
    for _, label, class_dir in class_dirs:
        wavs = sorted(class_dir.glob("*.wav"))
        if not wavs:
            continue
        labels.append(label)
        for wav_path in wavs:
            # Keep the raw 1-second waveform; augmentation and the spectrogram
            # are computed later so gain/noise are applied in the audio domain.
            xs.append(_tiny_voice_read_wav_16k(wav_path))
            ys.append(len(labels) - 1)

    if len(labels) < 2:
        raise RuntimeError("Need at least 2 classes with WAV clips")

    x = np.stack(xs).astype(np.float32)  # (N, 16000) raw audio
    y = tf.keras.utils.to_categorical(np.asarray(ys), num_classes=len(labels))
    return x, y, labels


def _tiny_voice_build_training_set(x_audio: np.ndarray, y: np.ndarray):
    """
    Turn raw 1-second waveforms into the augmented training spectrograms.

    Only augmentations that SURVIVE per-spectrogram normalization are useful
    here. Two earlier attempts did not:

      - multiplying the *log*-spectrogram by 0.75..1.25 ("quieter"/"louder").
        A real gain change is additive in log space, so this modelled a
        distortion no microphone can produce.
      - scaling the *waveform* by 0.3..2.0. This is a genuine gain change, but
        scaling the audio scales its noise floor with it, so it is a pure gain:
        every magnitude scales by g, every log bin gains the constant log(g),
        and normalization subtracts it straight back out. Measured max
        difference vs the original was ~2e-4 (float rounding) - the copies were
        exact duplicates, costing training time and teaching nothing.

    The four variants below all change the SHAPE of the spectrogram, which
    normalization cannot undo:

      1. clean          - the recording as captured
      2. time shift     - the word may land anywhere inside the 1 s window
      3. noise at SNR   - noise added INDEPENDENTLY, so SNR really changes
      4. spectral tilt  - simulates a microphone with a different frequency
                          response. This is the one gap normalization cannot
                          close, and it is exactly the laptop-mic vs PDM-mic
                          difference, so it matters most for board transfer.
    """
    rng = np.random.default_rng(123)
    # Centred ramp across the frequency axis, -0.5 .. +0.5, used for tilt.
    bin_ramp = (
        np.arange(TINY_VOICE_BINS, dtype=np.float32) / (TINY_VOICE_BINS - 1)
    ) - 0.5

    specs, labels = [], []
    for i in range(len(x_audio)):
        audio = x_audio[i].astype(np.float32)
        label = y[i]

        # 1. clean
        specs.append(_tiny_voice_normalize_spec(_tiny_voice_logspec_raw(audio)))
        labels.append(label)

        # 2. time shift, +/- 100 ms
        shifted = np.roll(audio, int(rng.integers(-1600, 1601)))
        specs.append(_tiny_voice_normalize_spec(_tiny_voice_logspec_raw(shifted)))
        labels.append(label)

        # 3. additive noise at a random SNR of 5..25 dB (amplitude ratio)
        rms = float(np.sqrt(np.mean(audio * audio)))
        snr_db = float(rng.uniform(5.0, 25.0))
        noise_rms = rms / (10.0 ** (snr_db / 20.0)) if rms > 1e-8 else 1e-4
        noisy = audio + rng.normal(0.0, noise_rms, size=audio.shape).astype(np.float32)
        specs.append(_tiny_voice_normalize_spec(_tiny_voice_logspec_raw(noisy)))
        labels.append(label)

        # 4. spectral tilt on the raw log-spectrogram, plus a small shift.
        #    +/-1.5 nats across the band is roughly +/-13 dB of tilt.
        nudged = np.roll(audio, int(rng.integers(-400, 401)))
        tilted = _tiny_voice_logspec_raw(nudged)
        tilted = tilted + (float(rng.uniform(-1.5, 1.5)) * bin_ramp)[None, :]
        specs.append(_tiny_voice_normalize_spec(tilted))
        labels.append(label)

    x_out = np.stack(specs).reshape(
        -1, TINY_VOICE_FRAMES, TINY_VOICE_BINS, 1
    ).astype(np.float32)
    y_out = np.stack(labels).astype(np.float32)
    return x_out, y_out


def _tiny_voice_build_model(class_count: int):
    import tensorflow as tf

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(TINY_VOICE_FRAMES, TINY_VOICE_BINS, 1)),
            tf.keras.layers.Conv2D(8, (5, 5), strides=(2, 2), padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
            tf.keras.layers.Conv2D(12, (3, 3), strides=(2, 2), padding="same", activation="relu"),
            tf.keras.layers.MaxPooling2D(pool_size=(2, 2)),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(24, activation="relu"),
            tf.keras.layers.Dense(class_count, activation="softmax"),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def _tiny_voice_convert_int8(model, representative_x: np.ndarray) -> bytes:
    import tensorflow as tf

    def representative_dataset():
        for item in representative_x[: min(len(representative_x), 128)]:
            yield [
                item.reshape(1, TINY_VOICE_FRAMES, TINY_VOICE_BINS, 1).astype(np.float32)
            ]

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def _tiny_voice_train_and_zip(dataset_zip: bytes, labels_json: str, epochs: int) -> bytes:
    """
    FIX #13 — training result (val_accuracy, val_loss) is now written into
    model_settings.json so the caller knows whether training converged.
    """
    from pathlib import Path

    requested_labels = json.loads(labels_json or "[]")
    with tempfile.TemporaryDirectory(prefix="tiny_voice_export_") as tmp:
        root = Path(tmp)
        _tiny_voice_safe_extract(dataset_zip, root)
        dataset_dir = root / "dataset"
        if not dataset_dir.is_dir():
            dataset_dir = root

        x_audio, y, labels = _tiny_voice_load_dataset(dataset_dir, requested_labels)
        # Augmentation and spectrogram computation happen together, because
        # spectral tilt must be applied before normalization.
        x_train, y_train = _tiny_voice_build_training_set(x_audio, y)
        model = _tiny_voice_build_model(len(labels))

        history = model.fit(
            x_train,
            y_train,
            epochs=epochs,
            batch_size=min(16, len(x_train)),
            validation_split=0.18,
            shuffle=True,
            verbose=0,
        )

        # Surface final epoch metrics
        final_val_acc = float(history.history.get("val_accuracy", [0])[-1])
        final_val_loss = float(history.history.get("val_loss", [999])[-1])
        final_train_acc = float(history.history.get("accuracy", [0])[-1])
        print(
            f"Training complete — val_accuracy: {final_val_acc:.3f}, "
            f"val_loss: {final_val_loss:.3f}"
        )

        tflite_model = _tiny_voice_convert_int8(model, x_train)

        metadata = {
            "export_type": "tiny_esp32_voice_norm_log",
            "feature_mode": "tm_speech_commands_norm_log",
            "sample_rate": TINY_VOICE_SR,
            "frames": TINY_VOICE_FRAMES,
            "bins": TINY_VOICE_BINS,
            "fft_window": TINY_VOICE_FFT_WINDOW,
            "classes": labels,
            "model_size": len(tflite_model),
            "training": {
                "epochs_run": epochs,
                "final_train_accuracy": round(final_train_acc, 4),
                "final_val_accuracy": round(final_val_acc, 4),
                "final_val_loss": round(final_val_loss, 4),
            },
        }

        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            base = "tiny_voice_esp32_model/"
            zf.writestr(base + "soundclassifier_int8.tflite", tflite_model)
            zf.writestr(base + "labels.txt", "\n".join(labels) + "\n")
            zf.writestr(base + "model_settings.json", json.dumps(metadata, indent=2))
            zf.writestr(
                base + "README.txt",
                (
                    "Extract this folder and upload tiny_voice_esp32_model "
                    "to the ESP32 dashboard.\n\n"
                    f"Training result: val_accuracy={final_val_acc:.3f}, "
                    f"val_loss={final_val_loss:.3f}\n"
                ),
            )
        return out.getvalue()


@app.post("/convert-tiny")
async def convert_tiny_voice(
    dataset_zip: UploadFile = File(...),
    labels: str = Form(default="[]"),
    epochs: int = Form(default=60),
):
    try:
        dataset_zip_bytes = await dataset_zip.read()
        epochs_val = max(10, min(120, epochs))
        result = _tiny_voice_train_and_zip(dataset_zip_bytes, labels, epochs_val)

        return Response(
            content=result,
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="tiny_esp32_voice_model.zip"',
                "Access-Control-Allow-Origin": "*",
            },
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

# =====================================================================
# MobileNetV3-Small trainer (separate module: mobilenet_v3_trainer.py)
# =====================================================================
try:
    from mobilenet_v3_trainer import router as _mobilenet_v3_router
    app.include_router(_mobilenet_v3_router)
    print(
        "MobileNetV3 trainers mounted: POST /train-mobilenetv3-esp32, "
        "POST /train-mobilenetv3-k230"
    )
except Exception as _mnv3_err:
    print("MobileNetV3 trainer not loaded:", _mnv3_err)
