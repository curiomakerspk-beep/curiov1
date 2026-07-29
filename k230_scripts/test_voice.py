import os
import sys
import gc
import math
import time
import ulab.numpy as np
import nncase_runtime as nn
from media.media import MediaManager
from media.pyaudio import PyAudio, paInt16, AUDIO_3A_ENABLE_ANS

# Search paths for model and labels
MODEL_SEARCH_PATHS = [
    "/sdcard/voice_v2_model.kmodel",
    "/sdcard/kmodel/voice_v2_model.kmodel",
    "voice_v2_model.kmodel"
]

LABELS_SEARCH_PATHS = [
    "/sdcard/voice_v2_labels.txt",
    "/sdcard/kmodel/voice_v2_labels.txt",
    "voice_v2_labels.txt"
]

# Audio Configuration
RATE = 16000          # 16kHz
CHANNELS = 2          # Record in Stereo to ensure we capture the active channel
CHUNK = 1600          # 100ms chunks per channel
WINDOW_SAMPLES = 16000 # 1.0 second of audio

MODEL_FRAMES = 43     # Spectrogram dimensions
MODEL_BINS = 232
FFT_WIN = 1024
HOP_SAMPLES = 356

# Precompute Hann Window
HANN_WINDOW = np.zeros(FFT_WIN, dtype=np.float)
for i in range(FFT_WIN):
    HANN_WINDOW[i] = 0.5 * (1.0 - math.cos(2.0 * math.pi * i / (FFT_WIN - 1)))

# File helpers
def file_exists(path):
    try:
        os.stat(path)
        return True
    except OSError:
        return False

def find_file(paths):
    for p in paths:
        if file_exists(p): return p
    return None

# Check FFT return format dynamically
print("Determining FFT mode...")
try:
    test_fft = np.fft.fft(np.zeros(4))
    if isinstance(test_fft, tuple) and len(test_fft) == 2:
        FFT_MODE = "split"
        print("FFT Mode: Split Real/Imag")
    else:
        FFT_MODE = "complex"
        print("FFT Mode: Complex Array")
except Exception:
    FFT_MODE = "split"

def get_fft_magnitude(frame_data):
    if FFT_MODE == "split":
        real, imag = np.fft.fft(frame_data)
        return np.sqrt(real * real + imag * imag)
    else:
        res = np.fft.fft(frame_data)
        try:
            return np.sqrt(res.real ** 2 + res.imag ** 2)
        except Exception:
            return np.array([abs(x) for x in res])

def compute_spectrogram(pcm_float):
    spec_2d = np.zeros((MODEL_FRAMES, MODEL_BINS), dtype=np.float)
    for f in range(MODEL_FRAMES):
        s = f * HOP_SAMPLES
        frame = np.zeros(FFT_WIN, dtype=np.float)
        available = len(pcm_float) - s
        if available > 0:
            take = min(available, FFT_WIN)
            frame[:take] = pcm_float[s : s + take]
        
        frame_windowed = frame * HANN_WINDOW
        mag = get_fft_magnitude(frame_windowed)
        
        for b in range(MODEL_BINS):
            val = mag[b]
            # Smart check: if val is NaN, negative, or <= 1e-6, default to 1e-6
            # In Python, if val is NaN, (val > 1e-6) evaluates to False.
            if not (val > 1e-6):
                val = 1e-6
            spec_2d[f, b] = math.log(val)
            
    return spec_2d.reshape((1, MODEL_FRAMES, MODEL_BINS, 1))

def main():
    print("--- Kendryte K230 Voice Classifier Test Script ---")
    
    # 1. Locate files
    model_path = find_file(MODEL_SEARCH_PATHS)
    labels_path = find_file(LABELS_SEARCH_PATHS)
    
    # 2. Load labels
    labels = ["Word1", "Word2", "Background Noise"]
    if labels_path:
        try:
            with open(labels_path, "r") as f:
                labels = [line.strip() for line in f if line.strip()]
            print(f"Loaded labels: {labels}")
        except Exception as e:
            print("Error loading labels:", e)
    else:
        print("Labels file not found - using fallbacks:", labels)
        
    # 3. Load model
    if not model_path:
        print("Error: voice_v2_model.kmodel not found in search paths.")
        return
    print(f"Loading .kmodel from {model_path}...")
    kpu = nn.kpu()
    kpu.load_kmodel(model_path)
    print("Model loaded successfully!")
    
    # 4. Initialize PyAudio
    print("Initializing PyAudio...")
    p = PyAudio()
    p.initialize(CHUNK)
    MediaManager.init()
    
    stream = None
    try:
        # Open 16kHz Stereo stream (so we can choose Left or Right channel)
        stream = p.open(
            format=paInt16,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK
        )
        stream.enable_audio3a(AUDIO_3A_ENABLE_ANS)
        
        print("\n--- Audio loop active: start speaking keywords ---")
        
        while True:
            # Read exactly 1 second of audio (10 chunks of 100ms stereo data)
            audio_chunks = []
            for _ in range(10):
                os.exitpoint()
                audio_chunks.append(stream.read())
            
            raw_bytes = b"".join(audio_chunks)
            pcm_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
            
            # Split interleaved Left and Right channels
            left_ch = pcm_int16[0::2]
            right_ch = pcm_int16[1::2]
            
            # Convert channels to float array to prevent int16 overflow during multiplication!
            left_ch_f = np.array(left_ch, dtype=np.float)
            right_ch_f = np.array(right_ch, dtype=np.float)
            
            # Calculate RMS safely, preventing math domain errors if values are NaN or negative
            left_mean_sq = np.mean(left_ch_f * left_ch_f)
            left_rms = 0.0
            if left_mean_sq > 0.0 and not math.isnan(left_mean_sq):
                try:
                    left_rms = math.sqrt(left_mean_sq)
                except Exception: pass
            
            right_mean_sq = np.mean(right_ch_f * right_ch_f)
            right_rms = 0.0
            if right_mean_sq > 0.0 and not math.isnan(right_mean_sq):
                try:
                    right_rms = math.sqrt(right_mean_sq)
                except Exception: pass
            
            # Pick the channel with active input
            if left_rms > right_rms:
                active_pcm = left_ch
                active_rms = left_rms
                channel_name = "Left"
            else:
                active_pcm = right_ch
                active_rms = right_rms
                channel_name = "Right"
                
            # Convert active channel to float PCM [-1.0, 1.0]
            pcm_float = active_pcm / 32768.0
            
            # 1. DC Offset Removal (Zero-centering)
            pcm_float = pcm_float - np.mean(pcm_float)
            
            # 2. Smart Gain Control (AGC)
            mean_sq = np.mean(pcm_float * pcm_float)
            rms = 0.0
            if mean_sq > 0.0 and not math.isnan(mean_sq):
                try:
                    rms = math.sqrt(mean_sq)
                except Exception: pass
            
            # Find maximum absolute value safely without calling np.abs
            try:
                max_val = max(abs(float(np.max(pcm_float))), abs(float(np.min(pcm_float))))
            except Exception:
                max_val = 0.0
                for x in pcm_float:
                    ax = abs(x)
                    if ax > max_val: max_val = ax
                    
            if rms > 0.01 and max_val > 0.0:
                pcm_float = (pcm_float / max_val) * 0.3 # Scale peak value to 0.3
            
            # Compute log spectrogram matching model input shape
            spec_tensor = compute_spectrogram(pcm_float)
            
            # Feed to KPU
            input_tensor = nn.from_numpy(spec_tensor)
            kpu.set_input_tensor(0, input_tensor)
            kpu.run()
            
            # Get predictions
            output_tensor = kpu.get_output_tensor(0)
            probs = output_tensor.to_numpy()[0]
            
            # Find class with highest confidence
            max_idx = 0
            max_val_prob = probs[0]
            for i in range(1, len(probs)):
                if probs[i] > max_val_prob:
                    max_val_prob = probs[i]
                    max_idx = i
            
            pred_label = labels[max_idx] if max_idx < len(labels) else f"Class_{max_idx}"
            
            # Print output + diagnostics
            if max_val_prob > 0.65:
                print(f"🗣️ Detected: {pred_label:<15} (Confidence: {max_val_prob:.2%}) [RMS: {rms:.4f} on {channel_name} ch]")
            else:
                print(f"💤 Listening...                  (Max: {max_val_prob:.1%} on {pred_label}) [RMS: {rms:.4f}]")
                
            # Cleanup loop memory
            del input_tensor
            del output_tensor
            gc.collect()
            
            time.sleep(0.1)
            
    except KeyboardInterrupt:
        print("\nStopping inference script...")
    except Exception as e:
        print("\nException occurred in audio loop:", e)
    finally:
        print("Cleaning up resources...")
        if stream:
            try:
                stream.stop()
                stream.close()
            except Exception: pass
        try: p.terminate()
        except Exception: pass
        try: MediaManager.deinit()
        except Exception: pass
        try: del kpu
        except Exception: pass
        gc.collect()
        nn.shrink_memory_pool()
        print("Cleanup done. Bye!")

if __name__ == "__main__":
    main()
