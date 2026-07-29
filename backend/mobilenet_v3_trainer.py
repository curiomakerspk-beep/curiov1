"""
MobileNetV3-Small transfer-learning trainer for ESP32-S3 (DFR1154).

Self-contained module: convert_server.py mounts it with a single
app.include_router() call; no other backend code is touched.

POST /train-mobilenetv3-esp32
  form fields:
    labels  — JSON array of class names, e.g. ["cat","dog"]
    epochs  — head-training epochs (default 60)
    images  — many image files; each filename must start with the class
              index followed by an underscore, e.g. "0_12.png", "1_3.png"
  returns: ZIP containing model.tflite (full INT8) + labels.txt
           header X-Train-Accuracy: final training accuracy in percent

Training strategy (fast even on CPU):
  1. MobileNetV3-Small backbone, ImageNet weights, frozen.
     `minimalistic=True` — plain ReLU, no hard-swish / squeeze-excite, so
     every op is already registered in the DFR1154 firmware's resolver.
  2. Each image is run through the backbone ONCE to get a 576-dim feature
     vector (transfer learning, same idea as Teachable Machine).
  3. A small dense head is trained on those features (seconds).
  4. Backbone + head are stitched into one graph and post-training INT8
     quantized, calibrated with the uploaded images.

Input contract with the DFR1154 firmware:
  96×96×3 int8. The Keras model embeds its own [0,255] preprocessing
  (include_preprocessing=True), so the representative dataset feeds raw
  0..255 pixels and the converter assigns the input tensor scale≈1.0,
  zero-point≈-128. The firmware's quantize_int8_pixel() has a fast path
  for exactly that quantization (plain `pixel - 128`), and its grayscale
  camera replicates the gray value into R,G,B — matching how the images
  are replicated to 3 channels here.
"""

import io
import json
import os
import shutil
import subprocess
import tempfile
import traceback
import zipfile
from typing import List

import numpy as np
from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from fastapi.routing import APIRoute


MAX_UPLOAD_FILES = 5000


class LargeImageUploadRoute(APIRoute):
    """Allow large image datasets on this router without changing other APIs."""

    def get_route_handler(self):
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request):
            content_type = request.headers.get("content-type", "").lower()
            if content_type.startswith("multipart/form-data"):
                # FastAPI later calls request.form() with Starlette's default
                # max_files=1000. Pre-parse and cache the same form with the
                # dataset-specific limit so 10x100 plus existing images works.
                await request.form(max_files=MAX_UPLOAD_FILES)
            return await original_route_handler(request)

        return custom_route_handler


router = APIRouter(route_class=LargeImageUploadRoute)

IMG_SIZE = 96
K230_INPUT_SIZES = (96, 320, 480)
MAX_CALIB_SAMPLES = 128
VALIDATION_FRACTION = 0.15
AUGMENT_COPIES = 1
RANDOM_SEED = 1337

_backbone_cache = {}


def _get_backbone(input_size=IMG_SIZE):
    """Build (once) the frozen MobileNetV3-Small minimalistic backbone."""
    import tensorflow as tf

    if input_size not in _backbone_cache:
        print(
            f"[MNV3] Loading MobileNetV3-Small {input_size}x{input_size} "
            "(minimalistic, ImageNet)..."
        )
        backbone = tf.keras.applications.MobileNetV3Small(
            input_shape=(input_size, input_size, 3),
            alpha=1.0,
            minimalistic=True,
            include_top=False,
            weights="imagenet",
            pooling="avg",
            include_preprocessing=True,
        )
        backbone.trainable = False
        _backbone_cache[input_size] = backbone
        print(f"[MNV3] Backbone ready — {backbone.count_params()} params")
    return _backbone_cache[input_size]


def _decode_upload(data: bytes):
    """Image bytes → float32 [96,96,3] tensor in [0,255], grayscale-replicated.

    Decode as RGB (channels=1 is rejected for BMP), reduce to luminance, then
    replicate to 3 channels — matching both the browser's grayscale capture
    and the firmware's gray→R,G,B replication at inference.
    """
    import tensorflow as tf

    img = tf.io.decode_image(data, channels=3, expand_animations=False)
    img = tf.image.resize(tf.cast(img, tf.float32), (IMG_SIZE, IMG_SIZE))
    img = tf.image.rgb_to_grayscale(img)
    return tf.image.grayscale_to_rgb(img)


def _decode_upload_k230(data: bytes, input_size: int):
    """Image bytes -> centered RGB square tensor, float32 in [0,255].

    This matches the browser's square capture canvas while retaining colour for
    the K230 camera pipeline. Uploaded non-square images are center-cropped
    before the final resize instead of being stretched.
    """
    import tensorflow as tf

    img = tf.io.decode_image(data, channels=3, expand_animations=False)
    img = tf.cast(img, tf.float32)
    shape = tf.shape(img)
    side = tf.minimum(shape[0], shape[1])
    offset_y = (shape[0] - side) // 2
    offset_x = (shape[1] - side) // 2
    img = tf.image.crop_to_bounding_box(img, offset_y, offset_x, side, side)
    result = tf.image.resize(img, (input_size, input_size), antialias=True)
    result.set_shape((input_size, input_size, 3))
    return result


def _stratified_split_indices(y: np.ndarray, class_count: int):
    """Return deterministic train/validation indices with every class in both."""
    rng = np.random.default_rng(RANDOM_SEED)
    train_indices, validation_indices = [], []

    for class_index in range(class_count):
        indices = np.flatnonzero(y == class_index)
        if len(indices) < 2:
            raise RuntimeError(
                f"Class {class_index} has only {len(indices)} usable image(s); need at least 2"
            )
        rng.shuffle(indices)
        validation_count = min(
            len(indices) - 1,
            max(1, int(round(len(indices) * VALIDATION_FRACTION))),
        )
        validation_indices.extend(indices[:validation_count].tolist())
        train_indices.extend(indices[validation_count:].tolist())

    rng.shuffle(train_indices)
    rng.shuffle(validation_indices)
    return (
        np.asarray(train_indices, dtype=np.int32),
        np.asarray(validation_indices, dtype=np.int32),
    )


def _augment_images(images, input_size=IMG_SIZE):
    """Make one conservative deterministic camera-like variation per image."""
    import tensorflow as tf

    def augment_one(item):
        index, image = item
        seed = tf.stack([tf.cast(RANDOM_SEED, tf.int32), tf.cast(index, tf.int32)])
        padded = tf.pad(image, [[4, 4], [4, 4], [0, 0]], mode="REFLECT")
        image = tf.image.stateless_random_crop(
            padded,
            [input_size, input_size, 3],
            seed=seed + tf.constant([0, 11], dtype=tf.int32),
        )
        image = tf.image.stateless_random_brightness(
            image,
            max_delta=18.0,
            seed=seed + tf.constant([0, 23], dtype=tf.int32),
        )
        image = tf.image.stateless_random_contrast(
            image,
            lower=0.90,
            upper=1.10,
            seed=seed + tf.constant([0, 37], dtype=tf.int32),
        )
        return tf.clip_by_value(image, 0.0, 255.0)

    return tf.map_fn(
        augment_one,
        (tf.range(tf.shape(images)[0]), images),
        fn_output_signature=tf.TensorSpec(
            shape=(input_size, input_size, 3), dtype=tf.float32
        ),
    )


def _balanced_calibration_indices(labels, class_count: int, max_samples: int):
    """Choose balanced row indices without materializing the image dataset."""
    per_class = [np.flatnonzero(labels == ci).tolist() for ci in range(class_count)]
    selected = []
    offset = 0
    target_count = min(len(labels), max_samples)
    while len(selected) < target_count:
        added = False
        for indices in per_class:
            if offset < len(indices):
                selected.append(indices[offset])
                added = True
                if len(selected) >= target_count:
                    break
        if not added:
            break
        offset += 1
    return np.asarray(selected, dtype=np.int32)


def _balanced_calibration_images(images, labels, class_count: int):
    """Choose calibration frames round-robin so later classes are represented."""
    per_class = [np.flatnonzero(labels == ci).tolist() for ci in range(class_count)]
    selected = []
    offset = 0
    target_count = min(len(labels), MAX_CALIB_SAMPLES)
    while len(selected) < target_count:
        added = False
        for indices in per_class:
            if offset < len(indices):
                selected.append(indices[offset])
                added = True
                if len(selected) >= target_count:
                    break
        if not added:
            break
        offset += 1
    return images[np.asarray(selected, dtype=np.int32)]


def _evaluate_tflite(tflite_model: bytes, images: np.ndarray, labels: np.ndarray,
                     class_count: int):
    """Run the actual quantized model and return accuracy plus confusion matrix."""
    import tensorflow as tf

    interpreter = tf.lite.Interpreter(model_content=tflite_model)
    interpreter.allocate_tensors()
    input_detail = interpreter.get_input_details()[0]
    output_detail = interpreter.get_output_details()[0]
    input_scale, input_zero = input_detail["quantization"]
    output_scale, output_zero = output_detail["quantization"]
    input_dtype = input_detail["dtype"]

    confusion = np.zeros((class_count, class_count), dtype=np.int32)
    correct = 0
    dtype_info = np.iinfo(input_dtype) if np.issubdtype(input_dtype, np.integer) else None

    for image, expected in zip(images, labels):
        batch = image[np.newaxis, ...].astype(np.float32)
        if dtype_info is not None:
            if input_scale <= 0:
                raise RuntimeError("Invalid TFLite input quantization scale")
            batch = np.rint(batch / input_scale + input_zero)
            batch = np.clip(batch, dtype_info.min, dtype_info.max).astype(input_dtype)
        interpreter.set_tensor(input_detail["index"], batch)
        interpreter.invoke()
        output = interpreter.get_tensor(output_detail["index"])[0]
        if np.issubdtype(output.dtype, np.integer):
            output = (output.astype(np.float32) - output_zero) * output_scale
        predicted = int(np.argmax(output))
        expected = int(expected)
        confusion[expected, predicted] += 1
        correct += int(predicted == expected)

    accuracy = correct / max(1, len(labels))
    return accuracy, confusion, {
        "input_dtype": np.dtype(input_dtype).name,
        "input_scale": float(input_scale),
        "input_zero_point": int(input_zero),
        "output_dtype": np.dtype(output_detail["dtype"]).name,
        "output_scale": float(output_scale),
        "output_zero_point": int(output_zero),
    }


@router.post("/train-mobilenetv3-esp32")
async def train_mobilenetv3_esp32(
    labels: str = Form(...),
    epochs: int = Form(default=60),
    images: List[UploadFile] = File(...),
):
    try:
        import tensorflow as tf

        label_list = json.loads(labels)
        nc = len(label_list)
        if nc < 2:
            raise RuntimeError("Need at least 2 classes")

        # ── 1. Decode uploads; class index comes from the filename prefix ──
        xs, ys = [], []
        for f in images:
            name = f.filename or ""
            try:
                ci = int(name.split("_", 1)[0])
            except ValueError:
                continue
            if not (0 <= ci < nc):
                continue
            data = await f.read()
            try:
                xs.append(_decode_upload(data))
                ys.append(ci)
            except Exception as decode_err:
                print(f"[MNV3] Skipping undecodable image {name}: {decode_err}")
        if len(xs) < nc * 2:
            raise RuntimeError(
                f"Only {len(xs)} usable images for {nc} classes — need more"
            )
        x = tf.stack(xs)  # [N,96,96,3] float32 0..255
        y = np.asarray(ys, dtype=np.int32)
        print(f"[MNV3] {len(ys)} images, {nc} classes: {label_list}")

        train_indices, validation_indices = _stratified_split_indices(y, nc)
        x_train = tf.gather(x, train_indices)
        y_train = y[train_indices]
        x_validation = tf.gather(x, validation_indices)
        y_validation = y[validation_indices]
        print(
            f"[MNV3] Stratified split: {len(train_indices)} train, "
            f"{len(validation_indices)} validation"
        )

        # ── 2. One backbone pass per image → feature vectors ──
        backbone = _get_backbone()
        train_feature_sets = [
            backbone.predict(x_train, batch_size=32, verbose=0)
        ]
        train_label_sets = [y_train]
        for _ in range(AUGMENT_COPIES):
            augmented = _augment_images(x_train)
            train_feature_sets.append(
                backbone.predict(augmented, batch_size=32, verbose=0)
            )
            train_label_sets.append(y_train)
        train_features = np.concatenate(train_feature_sets, axis=0)
        train_labels = np.concatenate(train_label_sets, axis=0)
        validation_features = backbone.predict(
            x_validation, batch_size=32, verbose=0
        )

        # ── 3. Train the dense head on features ──
        head = tf.keras.Sequential(
            [
                tf.keras.layers.Input(shape=(train_features.shape[-1],)),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(128, activation="relu"),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(nc, activation="softmax"),
            ]
        )
        head.compile(
            optimizer=tf.keras.optimizers.Adam(1e-3),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        hist = head.fit(
            train_features,
            train_labels,
            validation_data=(validation_features, y_validation),
            epochs=int(epochs),
            batch_size=16,
            shuffle=True,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(
                    monitor="val_loss", patience=8, restore_best_weights=True
                )
            ],
            verbose=0,
        )
        _, train_accuracy = head.evaluate(
            train_feature_sets[0], y_train, batch_size=32, verbose=0
        )
        _, validation_accuracy = head.evaluate(
            validation_features, y_validation, batch_size=32, verbose=0
        )
        train_acc = float(train_accuracy) * 100.0
        validation_acc = float(validation_accuracy) * 100.0
        print(
            f"[MNV3] Head trained in {len(hist.history['loss'])} epoch(s) — "
            f"train {train_acc:.1f}%, validation {validation_acc:.1f}%"
        )

        # ── 4. Stitch full graph and convert to INT8 ──
        inp = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name="image_0_255")
        out = head(backbone(inp, training=False), training=False)
        full = tf.keras.Model(inp, out, name="mnv3_esp32_classifier")

        calibration = _balanced_calibration_images(
            x_train.numpy(), y_train, nc
        )

        def representative_dataset():
            for i in range(len(calibration)):
                yield [calibration[i : i + 1]]

        converter = tf.lite.TFLiteConverter.from_keras_model(full)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.int8
        converter.inference_output_type = tf.int8
        tflite_model = converter.convert()
        tflite_accuracy, confusion, tensor_contract = _evaluate_tflite(
            tflite_model,
            x_validation.numpy(),
            y_validation,
            nc,
        )
        tflite_acc = tflite_accuracy * 100.0
        print(
            f"[MNV3] INT8 TFLite: {len(tflite_model) / 1024:.1f} KB, "
            f"validation {tflite_acc:.1f}%, input "
            f"{tensor_contract['input_dtype']} scale={tensor_contract['input_scale']:.8f} "
            f"zero={tensor_contract['input_zero_point']}"
        )

        metrics = {
            "labels": label_list,
            "training_images": int(len(train_indices)),
            "validation_images": int(len(validation_indices)),
            "augmentation_copies": AUGMENT_COPIES,
            "epochs_run": int(len(hist.history["loss"])),
            "train_accuracy_percent": round(train_acc, 2),
            "float_validation_accuracy_percent": round(validation_acc, 2),
            "int8_validation_accuracy_percent": round(tflite_acc, 2),
            "confusion_matrix": confusion.tolist(),
            "tensor_contract": tensor_contract,
        }

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("model.tflite", tflite_model)
            zf.writestr("labels.txt", "\n".join(label_list) + "\n")
            zf.writestr("metrics.json", json.dumps(metrics, indent=2) + "\n")

        return Response(
            content=buf.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": 'attachment; filename="mobilenetv3_esp32_model.zip"',
                "Access-Control-Allow-Origin": "*",
                "X-Train-Accuracy": f"{train_acc:.1f}",
                "X-Val-Accuracy": f"{validation_acc:.1f}",
                "X-TFLite-Accuracy": f"{tflite_acc:.1f}",
                "X-Val-Count": str(len(validation_indices)),
                "Access-Control-Expose-Headers": (
                    "X-Train-Accuracy, X-Val-Accuracy, X-TFLite-Accuracy, X-Val-Count"
                ),
            },
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/train-mobilenetv3-k230")
async def train_mobilenetv3_k230(
    labels: str = Form(...),
    epochs: int = Form(default=60),
    input_size: int = Form(default=96),
    images: List[UploadFile] = File(...),
):
    """Train and compile a true RGB MobileNetV3 K230 model.

    Supported static uint8 NCHW inputs are 96, 320, and 480 square. Uploaded
    images are processed in small batches so large datasets do not have to be
    stacked in RAM. The existing /convert route remains the 224x224 workflow.
    """
    tmpdir = tempfile.mkdtemp(prefix=f"k230_mnv3_{input_size}_")
    try:
        import tensorflow as tf

        if input_size not in K230_INPUT_SIZES:
            raise RuntimeError(
                f"K230 MobileNetV3 supports input_size values "
                f"{K230_INPUT_SIZES}, got {input_size}"
            )

        label_list = json.loads(labels)
        class_count = len(label_list)
        if class_count < 2:
            raise RuntimeError("Need at least 2 classes")

        upload_dir = os.path.join(tmpdir, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        image_paths, ys = [], []
        for upload_index, upload in enumerate(images):
            name = upload.filename or ""
            try:
                class_index = int(name.split("_", 1)[0])
            except ValueError:
                continue
            if not (0 <= class_index < class_count):
                continue
            data = await upload.read()
            try:
                # Decode once here to reject corrupt uploads, then retain only
                # the compressed source on disk. Feature extraction below
                # loads small batches, which keeps 320/480 training bounded.
                _decode_upload_k230(data, input_size)
                image_path = os.path.join(upload_dir, f"{upload_index}.img")
                with open(image_path, "wb") as image_file:
                    image_file.write(data)
                image_paths.append(image_path)
                ys.append(class_index)
            except Exception as decode_error:
                print(
                    f"[K230-{input_size}] Skipping undecodable image "
                    f"{name}: {decode_error}"
                )

        if len(image_paths) < class_count * 2:
            raise RuntimeError(
                f"Only {len(image_paths)} usable images for "
                f"{class_count} classes - need more"
            )

        y = np.asarray(ys, dtype=np.int32)
        train_indices, validation_indices = _stratified_split_indices(y, class_count)
        y_train = y[train_indices]
        y_validation = y[validation_indices]
        print(
            f"[K230-{input_size}] {len(ys)} images, {class_count} classes; "
            f"{len(train_indices)} train, {len(validation_indices)} validation"
        )

        feature_batch_size = 32 if input_size == 96 else (8 if input_size == 320 else 4)

        def load_batch(dataset_indices, augmented=False):
            batch = tf.stack(
                [
                    _decode_upload_k230(
                        tf.io.read_file(image_paths[int(dataset_index)]),
                        input_size,
                    )
                    for dataset_index in dataset_indices
                ]
            )
            if augmented:
                batch = _augment_images(batch, input_size)
            return batch

        backbone = _get_backbone(input_size)

        def extract_features(dataset_indices, augmented=False):
            feature_batches = []
            for start in range(0, len(dataset_indices), feature_batch_size):
                index_batch = dataset_indices[start : start + feature_batch_size]
                image_batch = load_batch(index_batch, augmented=augmented)
                feature_batches.append(
                    backbone.predict(image_batch, batch_size=feature_batch_size, verbose=0)
                )
            return np.concatenate(feature_batches, axis=0)

        train_feature_sets = [extract_features(train_indices)]
        train_label_sets = [y_train]
        for _ in range(AUGMENT_COPIES):
            train_feature_sets.append(extract_features(train_indices, augmented=True))
            train_label_sets.append(y_train)
        train_features = np.concatenate(train_feature_sets, axis=0)
        train_labels = np.concatenate(train_label_sets, axis=0)
        validation_features = extract_features(validation_indices)

        head = tf.keras.Sequential(
            [
                tf.keras.layers.Input(shape=(train_features.shape[-1],)),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(128, activation="relu"),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(class_count, activation="softmax"),
            ],
            name=f"k230_{input_size}_head",
        )
        head.compile(
            optimizer=tf.keras.optimizers.Adam(1e-3),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        history = head.fit(
            train_features,
            train_labels,
            validation_data=(validation_features, y_validation),
            epochs=int(epochs),
            batch_size=16,
            shuffle=True,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(
                    monitor="val_loss", patience=8, restore_best_weights=True
                )
            ],
            verbose=0,
        )
        _, train_accuracy = head.evaluate(
            train_feature_sets[0], y_train, batch_size=32, verbose=0
        )
        _, validation_accuracy = head.evaluate(
            validation_features, y_validation, batch_size=32, verbose=0
        )
        train_acc = float(train_accuracy) * 100.0
        validation_acc = float(validation_accuracy) * 100.0
        print(
            f"[K230-{input_size}] Head trained in "
            f"{len(history.history['loss'])} epoch(s): "
            f"train {train_acc:.1f}%, validation {validation_acc:.1f}%"
        )

        # K230 AI2D supplies NCHW uint8. Transpose to the NHWC 0..255 contract
        # used by the Keras MobileNetV3 preprocessing layer.
        nchw_input = tf.keras.Input(
            batch_size=1,
            shape=(3, input_size, input_size),
            dtype=tf.uint8,
            name="input_image",
        )
        nhwc = tf.transpose(nchw_input, [0, 2, 3, 1])
        nhwc = tf.cast(nhwc, tf.float32)
        output = head(backbone(nhwc, training=False), training=False)
        full_model = tf.keras.Model(
            nchw_input,
            output,
            name=f"k230_mobilenetv3_{input_size}_classifier",
        )

        saved_model_dir = os.path.join(tmpdir, "saved_model")
        onnx_path = os.path.join(tmpdir, "model.onnx")
        kmodel_path = os.path.join(tmpdir, "model.kmodel")
        calibration_path = os.path.join(tmpdir, "calibration.bin")

        @tf.function(
            input_signature=[
                tf.TensorSpec(
                    shape=[1, 3, input_size, input_size],
                    dtype=tf.uint8,
                    name="input_image",
                )
            ]
        )
        def serving_fn(value):
            return full_model(value)

        tf.saved_model.save(
            full_model,
            saved_model_dir,
            signatures={"serving_default": serving_fn},
        )

        # Keep the representative-data file around 100 MB or less for larger
        # inputs while retaining balanced coverage across all classes.
        max_calibration = 128 if input_size == 96 else (64 if input_size == 320 else 32)
        calibration_positions = _balanced_calibration_indices(
            y_train, class_count, max_calibration
        )
        calibration_indices = train_indices[calibration_positions]
        # nncase_compile.py accepts NHWC float32 [0,1] calibration frames and
        # converts them to the model's uint8 NCHW input contract.
        with open(calibration_path, "wb") as calibration_file:
            for start in range(0, len(calibration_indices), feature_batch_size):
                index_batch = calibration_indices[start : start + feature_batch_size]
                calibration_batch = load_batch(index_batch).numpy()
                calibration_file.write(
                    (calibration_batch / 255.0).astype("<f4").tobytes()
                )
        calibration_count = len(calibration_indices)

        tf2onnx_result = subprocess.run(
            [
                "python", "-m", "tf2onnx.convert",
                "--saved-model", saved_model_dir,
                "--output", onnx_path,
                "--opset", "13",
            ],
            capture_output=True,
            text=True,
            timeout=180,
        )
        print(f"[K230-{input_size}] tf2onnx stdout:", tf2onnx_result.stdout)
        print(f"[K230-{input_size}] tf2onnx stderr:", tf2onnx_result.stderr)
        if tf2onnx_result.returncode != 0:
            raise RuntimeError("ONNX conversion failed: " + tf2onnx_result.stderr[-2000:])

        nncase_script = os.path.join(os.path.dirname(__file__), "nncase_compile.py")
        nncase_result = subprocess.run(
            [
                "python", nncase_script, onnx_path, kmodel_path,
                calibration_path, str(calibration_count),
            ],
            capture_output=True,
            text=True,
            timeout=360,
        )
        print(f"[K230-{input_size}] nncase stdout:", nncase_result.stdout)
        print(f"[K230-{input_size}] nncase stderr:", nncase_result.stderr)
        if nncase_result.returncode != 0 or not os.path.exists(kmodel_path):
            raise RuntimeError("K230 compilation failed: " + nncase_result.stderr[-2000:])

        metrics = {
            "labels": label_list,
            "input_shape": [1, 3, input_size, input_size],
            "input_dtype": "uint8",
            "training_images": int(len(train_indices)),
            "validation_images": int(len(validation_indices)),
            "augmentation_copies": AUGMENT_COPIES,
            "epochs_run": int(len(history.history["loss"])),
            "train_accuracy_percent": round(train_acc, 2),
            "float_validation_accuracy_percent": round(validation_acc, 2),
        }

        result = io.BytesIO()
        with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(kmodel_path, "model.kmodel")
            archive.writestr("labels.txt", "\n".join(label_list) + "\n")
            archive.writestr("input_size.txt", str(input_size) + "\n")
            archive.writestr("metrics.json", json.dumps(metrics, indent=2) + "\n")

        return Response(
            content=result.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="k230_mobilenetv3_{input_size}.zip"'
                ),
                "Access-Control-Allow-Origin": "*",
                "X-Train-Accuracy": f"{train_acc:.1f}",
                "X-Val-Accuracy": f"{validation_acc:.1f}",
                "X-Val-Count": str(len(validation_indices)),
                "X-Model-Input": f"1,3,{input_size},{input_size}",
                "Access-Control-Expose-Headers": (
                    "X-Train-Accuracy, X-Val-Accuracy, X-Val-Count, X-Model-Input"
                ),
            },
        )
    except Exception as error:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(error)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
