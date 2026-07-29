import os
import gc
import time
import math
import image
import nncase_runtime as nn
import ulab.numpy as np
import aidemo
from machine import TOUCH
from libs.PipeLine import PipeLine, ALIGN_UP
from libs.AIBase import AIBase
from libs.AI2D import Ai2d
from libs.Utils import ScopedTiming

# Model Configuration
# hand_det / handkp_det are the stock CanMV hand-pipeline models shipped on the
# SD card image (usually under /sdcard/examples/kmodel/). Adjust if yours live
# elsewhere. gesture_model.kmodel + gesture_labels.txt are pushed by gesture.html.
HAND_DET_PATH   = "/sdcard/examples/kmodel/hand_det.kmodel"
HAND_KP_PATH    = "/sdcard/examples/kmodel/handkp_det.kmodel"
CLASSIFIER_PATH = "/sdcard/kmodel/gesture_model.kmodel"
LABELS_PATH     = "/sdcard/kmodel/gesture_labels.txt"

# Anchors for the stock hand detector (input 512x512)
HAND_DET_ANCHORS = [26,27, 53,52, 75,71, 80,99, 106,82, 99,134, 140,113, 161,172, 245,276]

# MediaPipe Hands 21-point topology, same as gesture.html's HAND_CONNECTIONS
HAND_CONNECTIONS = [
    (0,1),(1,2),(2,3),(3,4),           # thumb
    (0,5),(5,6),(6,7),(7,8),           # index
    (5,9),(9,10),(10,11),(11,12),      # middle
    (9,13),(13,14),(14,15),(15,16),    # ring
    (13,17),(17,18),(18,19),(19,20),   # pinky
    (0,17)                             # palm base
]

NUM_KEYPOINTS = 21
NUM_FEATURES = 210

def file_exists(path):
    try:
        os.stat(path)
        return True
    except OSError:
        return False

def softmax(x):
    exp_x = np.exp(x - np.max(x))
    return exp_x / np.sum(exp_x)

def keypoints_to_210_features(kps):
    """kps: list of 21 (x, y) tuples in any consistent pixel space.

    Wrist-relative, palm-size-normalized pairwise distances between all 21
    landmarks -> 210 floats (21 choose 2). This MUST match gesture.html's
    keypointsTo210Features() exactly -- the browser trains the classifier on
    these features, so any mismatch here makes the deployed model's weights
    meaningless on-device. (Pairwise distances are mirror-invariant, so the
    browser's flipHorizontal preview does not matter.)
    """
    wrist_x, wrist_y = kps[0]
    translated = [(x - wrist_x, y - wrist_y) for (x, y) in kps]

    index_mcp = translated[5]
    palm_size = math.sqrt(index_mcp[0] * index_mcp[0] + index_mcp[1] * index_mcp[1])
    if palm_size == 0:
        palm_size = 1.0

    features = []
    for i in range(NUM_KEYPOINTS):
        for j in range(i + 1, NUM_KEYPOINTS):
            dx = translated[i][0] - translated[j][0]
            dy = translated[i][1] - translated[j][1]
            features.append(math.sqrt(dx * dx + dy * dy) / palm_size)
    return features

class HandDetApp(AIBase):
    """Stage 1 — stock hand detector (512x512, letterboxed)."""
    def __init__(self, kmodel_path, model_input_size, anchors,
                 confidence_threshold=0.4, nms_threshold=0.5,
                 rgb888p_size=[320, 320], display_size=[800, 480], debug_mode=0):
        super().__init__(kmodel_path, model_input_size, rgb888p_size, debug_mode)
        self.model_input_size = model_input_size
        self.anchors = anchors
        self.confidence_threshold = confidence_threshold
        self.nms_threshold = nms_threshold
        self.rgb888p_size = [ALIGN_UP(rgb888p_size[0], 16), rgb888p_size[1]]
        self.display_size = [ALIGN_UP(display_size[0], 16), display_size[1]]
        self.debug_mode = debug_mode
        self.ai2d = Ai2d(debug_mode)
        self.ai2d.set_ai2d_dtype(nn.ai2d_format.NCHW_FMT, nn.ai2d_format.NCHW_FMT, np.uint8, np.uint8)

    def get_padding_param(self):
        dst_w = self.model_input_size[0]
        dst_h = self.model_input_size[1]
        input_width = self.rgb888p_size[0]
        input_height = self.rgb888p_size[1]
        ratio_w = dst_w / input_width
        ratio_h = dst_h / input_height
        ratio = ratio_w if ratio_w < ratio_h else ratio_h
        new_w = int(ratio * input_width)
        new_h = int(ratio * input_height)
        dw = (dst_w - new_w) / 2
        dh = (dst_h - new_h) / 2
        top = int(round(dh - 0.1))
        bottom = int(round(dh + 0.1))
        left = int(round(dw - 0.1))
        right = int(round(dw + 0.1))
        return top, bottom, left, right

    def config_preprocess(self, input_image_size=None):
        with ScopedTiming("set preprocess config", self.debug_mode > 0):
            ai2d_input_size = input_image_size if input_image_size else self.rgb888p_size
            top, bottom, left, right = self.get_padding_param()
            self.ai2d.pad([0, 0, 0, 0, top, bottom, left, right], 0, [114, 114, 114])
            self.ai2d.resize(nn.interp_method.tf_bilinear, nn.interp_mode.half_pixel)
            self.ai2d.build(
                [1, 3, ai2d_input_size[1], ai2d_input_size[0]],
                [1, 3, self.model_input_size[1], self.model_input_size[0]]
            )

    def postprocess(self, results):
        with ScopedTiming("postprocess", self.debug_mode > 0):
            dets = aidemo.hand_det_post_process(
                results[0],
                [self.rgb888p_size[1], self.rgb888p_size[0]],
                self.model_input_size,
                self.anchors,
                self.confidence_threshold,
                self.nms_threshold
            )
            return dets

class HandKPDetApp(AIBase):
    """Stage 2 — stock hand keypoint model (256x256 crop -> 21 landmarks)."""
    def __init__(self, kmodel_path, model_input_size,
                 rgb888p_size=[320, 320], display_size=[800, 480], debug_mode=0):
        super().__init__(kmodel_path, model_input_size, rgb888p_size, debug_mode)
        self.model_input_size = model_input_size
        self.rgb888p_size = [ALIGN_UP(rgb888p_size[0], 16), rgb888p_size[1]]
        self.display_size = [ALIGN_UP(display_size[0], 16), display_size[1]]
        self.crop_params = []
        self.debug_mode = debug_mode
        self.ai2d = Ai2d(debug_mode)
        self.ai2d.set_ai2d_dtype(nn.ai2d_format.NCHW_FMT, nn.ai2d_format.NCHW_FMT, np.uint8, np.uint8)

    def get_crop_param(self, det_box):
        # Expand the detection box to a 1.26x square crop around the hand,
        # clamped to the frame — same recipe as the official CanMV demo.
        x1, y1, x2, y2 = det_box[2], det_box[3], det_box[4], det_box[5]
        w = int(x2 - x1)
        h = int(y2 - y1)
        length = max(w, h)
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        ratio_num = 1.26 * length
        x1_kp = int(max(0, cx - ratio_num / 2))
        y1_kp = int(max(0, cy - ratio_num / 2))
        x2_kp = int(min(self.rgb888p_size[0] - 1, cx + ratio_num / 2))
        y2_kp = int(min(self.rgb888p_size[1] - 1, cy + ratio_num / 2))
        w_kp = int(x2_kp - x1_kp + 1)
        h_kp = int(y2_kp - y1_kp + 1)
        return [x1_kp, y1_kp, w_kp, h_kp]

    def config_preprocess(self, det, input_image_size=None):
        with ScopedTiming("set preprocess config", self.debug_mode > 0):
            ai2d_input_size = input_image_size if input_image_size else self.rgb888p_size
            self.crop_params = self.get_crop_param(det)
            self.ai2d.crop(self.crop_params[0], self.crop_params[1],
                           self.crop_params[2], self.crop_params[3])
            self.ai2d.resize(nn.interp_method.tf_bilinear, nn.interp_mode.half_pixel)
            self.ai2d.build(
                [1, 3, ai2d_input_size[1], ai2d_input_size[0]],
                [1, 3, self.model_input_size[1], self.model_input_size[0]]
            )

    def postprocess(self, results):
        with ScopedTiming("postprocess", self.debug_mode > 0):
            # Model outputs 42 values normalized to the crop; map back into
            # rgb888p frame coordinates -> [(x, y), ...] * 21
            flat = results[0].reshape((results[0].shape[0] * results[0].shape[1],))
            kps = []
            for i in range(NUM_KEYPOINTS):
                kx = flat[i * 2]     * self.crop_params[2] + self.crop_params[0]
                ky = flat[i * 2 + 1] * self.crop_params[3] + self.crop_params[1]
                kps.append((float(kx), float(ky)))
            return kps

def main():
    print("--- Kendryte K230 Live Hand Gesture Classifier ---")

    # 1. Load custom labels
    labels = ["Gesture1", "Gesture2"]
    if file_exists(LABELS_PATH):
        try:
            with open(LABELS_PATH, "r") as f:
                labels = [line.strip() for line in f if line.strip()]
            print("Loaded labels:", labels)
        except Exception as e:
            print("Error loading labels:", e)

    # 2. Check model existence
    for path in (HAND_DET_PATH, HAND_KP_PATH, CLASSIFIER_PATH):
        if not file_exists(path):
            print("Error: Required model file is missing on SD card!")
            print(f"Missing: {path}")
            return

    # 3. Load custom trained dense classifier KPU
    print("Loading custom gesture classifier...")
    classifier_kpu = nn.kpu()
    classifier_kpu.load_kmodel(CLASSIFIER_PATH)
    print("Classifier loaded successfully!")

    # 4. Initialize Hardware Video Pipeline
    rgb_size = [320, 320]
    display_size = [800, 480]

    pl = PipeLine(rgb888p_size=rgb_size, display_size=display_size, display_mode="lcd")
    pl.create()

    # Touch pad initialization for exiting
    tp = TOUCH(0)

    # 5. Initialize the two-stage hand pipeline
    print("Loading hand detector...")
    hand_det = HandDetApp(
        HAND_DET_PATH,
        model_input_size=[512, 512],
        anchors=HAND_DET_ANCHORS,
        confidence_threshold=0.4,
        nms_threshold=0.5,
        rgb888p_size=rgb_size,
        display_size=display_size
    )
    hand_det.config_preprocess()

    print("Loading hand keypoint model...")
    hand_kp = HandKPDetApp(
        HAND_KP_PATH,
        model_input_size=[256, 256],
        rgb888p_size=rgb_size,
        display_size=display_size
    )
    print("System fully operational!")

    try:
        while True:
            os.exitpoint()

            # Touch top-left corner (100x100) to stop
            pts = tp.read(1)
            if pts:
                pt = pts[0]
                if pt.event == TOUCH.EVENT_DOWN and pt.x < 100 and pt.y < 100:
                    break

            # Capture frame from K230 camera module
            img = pl.get_frame()
            if img is None:
                time.sleep_ms(10)
                continue

            # Step 1: Detect hands
            dets = hand_det.run(img)

            # Clear OSD transparent drawing canvas
            pl.osd_img.clear()

            # Draw HUD Headers
            pl.osd_img.draw_rectangle(0, 0, 260, 52, color=(0, 0, 0, 160), fill=True)
            pl.osd_img.draw_string(8, 4, "K230 Live Gesture AI", color=(255, 255, 255), scale=2)

            if dets and len(dets) > 0:
                pl.osd_img.draw_string(8, 30, f"Tracking: {len(dets)} hand", color=(255, 220, 80), scale=2)

                # Process the first detected hand only (matches gesture.html
                # training, which captures maxHands: 1)
                det = dets[0]

                # Step 2: Extract 21 hand landmarks from the cropped hand
                hand_kp.config_preprocess(det)
                kps = hand_kp.run(img)  # [(x, y), ...] * 21 in rgb888p space

                # Step 3: Build the 210-dim feature vector (must match browser)
                features = keypoints_to_210_features(kps)
                features_np = np.array(features, dtype=np.float).reshape((1, NUM_FEATURES))

                # Step 4: Run custom dense head gesture classifier
                classifier_kpu.set_input_tensor(0, nn.from_numpy(features_np))
                classifier_kpu.run()

                # Get output probabilities
                out_tensor = classifier_kpu.get_output_tensor(0)
                raw_scores = out_tensor.to_numpy()[0]

                # Parse confidence safely (detect if already normalized)
                sum_scores = float(np.sum(raw_scores))
                min_score = float(np.min(raw_scores))
                if abs(sum_scores - 1.0) < 0.05 and min_score >= 0.0:
                    probs = raw_scores
                else:
                    probs = softmax(raw_scores)

                best_idx = np.argmax(probs)
                best_val = probs[best_idx]
                detected_label = labels[best_idx] if best_idx < len(labels) else f"Class_{best_idx}"

                # Draw classification result on OSD HUD
                pl.osd_img.draw_rectangle(0, 55, 260, 52, color=(0, 100, 0, 180), fill=True)
                pl.osd_img.draw_string(8, 60, f"Gesture: {detected_label}", color=(255, 255, 255), scale=2)
                pl.osd_img.draw_string(8, 82, f"Conf: {best_val:.1%}", color=(0, 255, 0), scale=2)

                # Step 5: Draw hand skeleton in bright green
                for a, b in HAND_CONNECTIONS:
                    xa, ya = kps[a]
                    xb, yb = kps[b]
                    x1 = int(xa * display_size[0] // rgb_size[0])
                    y1 = int(ya * display_size[1] // rgb_size[1])
                    x2 = int(xb * display_size[0] // rgb_size[0])
                    y2 = int(yb * display_size[1] // rgb_size[1])
                    pl.osd_img.draw_line(x1, y1, x2, y2, color=(0, 255, 0, 255), thickness=3)

                # Step 6: Draw landmarks as red circles
                for x, y in kps:
                    x_disp = int(x * display_size[0] // rgb_size[0])
                    y_disp = int(y * display_size[1] // rgb_size[1])
                    pl.osd_img.draw_circle(x_disp, y_disp, 4, color=(255, 0, 0, 255), fill=True)

                del out_tensor
            else:
                pl.osd_img.draw_string(8, 30, "Searching for hand...", color=(180, 180, 180), scale=2)

            # Render camera composite frame to IDE Frame Buffer
            pl.show_image()
            gc.collect()

    except BaseException as e:
        print("Gesture App runtime error:", e)
    finally:
        # Cleanup KPU models and hardware display channels
        print("Cleaning up resources...")
        try:
            hand_det.deinit()
        except Exception: pass
        try:
            hand_kp.deinit()
        except Exception: pass
        try:
            del classifier_kpu
        except Exception: pass
        try:
            pl.destroy()
        except Exception: pass
        gc.collect()
        nn.shrink_memory_pool()
        print("Done!")

if __name__ == "__main__":
    main()
