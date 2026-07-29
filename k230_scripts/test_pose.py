import os
import gc
import time
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
YOLO_POSE_PATH = "/sdcard/yolov8n-pose.kmodel"
CLASSIFIER_PATH = "/sdcard/kmodel/pose_model.kmodel"
LABELS_PATH = "/sdcard/kmodel/pose_labels.txt"

def file_exists(path):
    try:
        os.stat(path)
        return True
    except OSError:
        return False

def softmax(x):
    exp_x = np.exp(x - np.max(x))
    return exp_x / np.sum(exp_x)

class YOLOv8PoseApp(AIBase):
    def __init__(self, kmodel_path, model_input_size,
                 confidence_threshold=0.35, nms_threshold=0.45,
                 rgb888p_size=[320, 320], display_size=[800, 480], debug_mode=0):
        super().__init__(kmodel_path, model_input_size, rgb888p_size, debug_mode)
        self.model_input_size = model_input_size
        self.confidence_threshold = confidence_threshold
        self.nms_threshold = nms_threshold
        self.rgb888p_size = [ALIGN_UP(rgb888p_size[0], 16), rgb888p_size[1]]
        self.display_size = [ALIGN_UP(display_size[0], 16), display_size[1]]
        self.ai2d = Ai2d(debug_mode)
        self.ai2d.set_ai2d_dtype(nn.ai2d_format.NCHW_FMT, nn.ai2d_format.NCHW_FMT, np.uint8, np.uint8)

    def config_preprocess(self):
        self.ai2d.resize(nn.interp_method.tf_bilinear, nn.interp_mode.half_pixel)
        self.ai2d.build(
            [1, 3, self.rgb888p_size[1], self.rgb888p_size[0]],
            [1, 3, self.model_input_size[1], self.model_input_size[0]]
        )

    def postprocess(self, results):
        # Pass raw output to precompiled C post-processor
        post_ret = aidemo.person_kp_postprocess(
            results[0],
            [self.rgb888p_size[1], self.rgb888p_size[0]],
            self.model_input_size,
            self.confidence_threshold,
            self.nms_threshold
        )
        return post_ret

def main():
    print("--- Kendryte K230 Live Pose Estimation & Classifier ---")

    # 1. Load custom labels
    labels = ["Pose1", "Pose2"]
    if file_exists(LABELS_PATH):
        try:
            with open(LABELS_PATH, "r") as f:
                labels = [line.strip() for line in f if line.strip()]
            print("Loaded labels:", labels)
        except Exception as e:
            print("Error loading labels:", e)

    # 2. Check model existence
    if not file_exists(YOLO_POSE_PATH) or not file_exists(CLASSIFIER_PATH):
        print("Error: Required model files are missing on SD card!")
        print(f"Missing: {YOLO_POSE_PATH} or {CLASSIFIER_PATH}")
        return

    # 3. Load custom trained dense classifier KPU
    print("Loading custom pose classifier...")
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

    # 5. Initialize YOLOv8-pose Detector App
    print("Loading YOLOv8-pose backbone detector...")
    yolo_pose = YOLOv8PoseApp(
        YOLO_POSE_PATH,
        model_input_size=[320, 320],
        confidence_threshold=0.35,
        nms_threshold=0.45,
        rgb888p_size=rgb_size,
        display_size=display_size
    )
    yolo_pose.config_preprocess()
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

            # Step 1: Run YOLOv8-pose to extract joints
            res = yolo_pose.run(img)

            # Clear OSD transparent drawing canvas
            pl.osd_img.clear()

            # Draw HUD Headers
            pl.osd_img.draw_rectangle(0, 0, 260, 52, color=(0, 0, 0, 160), fill=True)
            pl.osd_img.draw_string(8, 4, "K230 Live Pose AI", color=(255, 255, 255), scale=2)

            detected_persons = res[1] if (res and len(res) > 1) else []
            person_count = len(detected_persons)

            if person_count > 0:
                pl.osd_img.draw_string(8, 30, f"Tracking: {person_count} person", color=(255, 220, 80), scale=2)

                # Process the first detected person
                kps = detected_persons[0] # Shape: [17, 3] -> (x, y, score)

                # Step 2: Center on the hip midpoint and scale by torso length
                # (shoulder-to-hip distance). This MUST match the browser
                # trainer's keypointsToFeatures() exactly (pose.html) -- it
                # trains on hip-centered/scale-normalized coordinates, not
                # raw x/rgb_size[0], y/rgb_size[1]. A mismatch here makes the
                # classifier's learned weights meaningless on-device even
                # though the same model predicts correctly in the browser.
                l_hip_x, l_hip_y, _ = kps[11]
                r_hip_x, r_hip_y, _ = kps[12]
                l_sh_x, l_sh_y, _ = kps[5]
                r_sh_x, r_sh_y, _ = kps[6]

                cx = (l_hip_x + r_hip_x) / 2.0
                cy = (l_hip_y + r_hip_y) / 2.0
                shx = (l_sh_x + r_sh_x) / 2.0
                shy = (l_sh_y + r_sh_y) / 2.0

                scale = ((shx - cx) ** 2 + (shy - cy) ** 2) ** 0.5
                if scale < 1e-3:
                    scale = max(rgb_size[0], rgb_size[1]) * 0.25

                features = []
                for i in range(17):
                    x, y, score = kps[i]
                    features.append((x - cx) / scale)
                    features.append((y - cy) / scale)

                # Convert to float array and reshape to [1, 34] input tensor
                features_np = np.array(features, dtype=np.float).reshape((1, 34))

                # Step 3: Run custom dense head pose classifier
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
                pl.osd_img.draw_string(8, 60, f"Pose: {detected_label}", color=(255, 255, 255), scale=2)
                pl.osd_img.draw_string(8, 82, f"Conf: {best_val:.1%}", color=(0, 255, 0), scale=2)

                # Step 4: Draw Skeleton Bones in Bright Green
                SKELETON_PAIRS = [
                    (5,6),(5,7),(7,9),(6,8),(8,10),
                    (5,11),(6,12),(11,12),(11,13),(13,15),(12,14),(14,16)
                ]
                for a, b in SKELETON_PAIRS:
                    ka, kb = kps[a], kps[b]
                    if ka[2] > 0.35 and kb[2] > 0.35:
                        x1 = int(ka[0] * display_size[0] // rgb_size[0])
                        y1 = int(ka[1] * display_size[1] // rgb_size[1])
                        x2 = int(kb[0] * display_size[0] // rgb_size[0])
                        y2 = int(kb[1] * display_size[1] // rgb_size[1])
                        pl.osd_img.draw_line(x1, y1, x2, y2, color=(0, 255, 0, 255), thickness=3)

                # Step 5: Draw Joints as Red Circles
                for i in range(17):
                    x, y, score = kps[i]
                    if score > 0.35:
                        x_disp = int(x * display_size[0] // rgb_size[0])
                        y_disp = int(y * display_size[1] // rgb_size[1])
                        pl.osd_img.draw_circle(x_disp, y_disp, 4, color=(255, 0, 0, 255), fill=True)
                        
                del out_tensor
            else:
                pl.osd_img.draw_string(8, 30, "Searching for person...", color=(180, 180, 180), scale=2)

            # Render camera composite frame to IDE Frame Buffer
            pl.show_image()
            gc.collect()

    except BaseException as e:
        print("Pose App runtime error:", e)
    finally:
        # Cleanup KPU models and hardware display channels
        print("Cleaning up resources...")
        try:
            yolo_pose.deinit()
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
