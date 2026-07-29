import sys
import os
import numpy as np


def is_voice_spectrogram_input(shape, dtype):
    return (
        dtype == np.float32
        and len(shape) == 4
        and shape[0] == 1
        and shape[1] == 43
        and shape[2] == 232
        and shape[3] == 1
    )


def make_voice_calibration_sample(shape, index):
    """Generate browser-like log FFT spectrograms for voice PTQ calibration."""
    frames = shape[1]
    bins = shape[2]
    fft_win = 1024
    samples = 16000
    hop = max(1, (samples - fft_win) // max(1, frames - 1))
    rng = np.random.default_rng(1000 + index)

    # Cover silence, quiet room noise, normal speech-like energy, and tones.
    amplitudes = [0.0, 0.0005, 0.002, 0.006, 0.02, 0.06, 0.12, 0.25]
    amp = amplitudes[index % len(amplitudes)]
    pcm = rng.normal(0.0, amp, samples).astype(np.float32)

    if index % 3 == 1:
        t = np.arange(samples, dtype=np.float32) / 16000.0
        pcm += (amp * 0.7 * np.sin(2.0 * np.pi * 440.0 * t)).astype(np.float32)
    elif index % 3 == 2:
        envelope = np.linspace(0.2, 1.0, samples, dtype=np.float32)
        pcm *= envelope

    pcm = np.clip(pcm, -1.0, 1.0)
    hann = np.hanning(fft_win).astype(np.float32)
    spec = np.zeros((frames, bins), dtype=np.float32)

    for frame_idx in range(frames):
        start = frame_idx * hop
        frame = np.zeros(fft_win, dtype=np.float32)
        available = max(0, min(fft_win, samples - start))
        if available:
            frame[:available] = pcm[start:start + available]

        mag = np.abs(np.fft.fft(frame * hann)).astype(np.float32)
        spec[frame_idx, :] = np.log(np.maximum(mag[:bins], 1e-6))

    return spec.reshape(shape).astype(np.float32)

def get_input_info(onnx_path):
    import onnx
    import numpy as np
    model = onnx.load(onnx_path)
    for inp in model.graph.input:
        shape = []
        for dim in inp.type.tensor_type.shape.dim:
            shape.append(dim.dim_value if dim.dim_value > 0 else 1)
        
        dtype = inp.type.tensor_type.elem_type
        np_dtype = np.uint8 if dtype == 2 else np.float32
        
        print(f"Model input name:  {inp.name}")
        print(f"Model input shape: {shape}")
        print(f"Model input dtype: {np_dtype}")
        return shape, np_dtype
    return [1, 256], np.float32

def compile_model(onnx_path, kmodel_path, no_ptq=False, calib_bin=None, calib_count=0):
    print(f"Input ONNX:  {onnx_path}")
    print(f"ONNX size:   {os.path.getsize(onnx_path)} bytes")

    import nncase

    input_shape, input_dtype = get_input_info(onnx_path)
    print(f"Using input shape: {input_shape}, dtype: {input_dtype}")

    with open(onnx_path, 'rb') as f:
        model_content = f.read()

    compile_options = nncase.CompileOptions()
    compile_options.target     = 'k230'
    compile_options.dump_ir    = False
    compile_options.dump_asm   = False
    compile_options.preprocess = False

    compiler = nncase.Compiler(compile_options)

    import_options = nncase.ImportOptions()
    try:
        compiler.import_onnx(model_content, import_options)
        print("ONNX import OK")
    except Exception as e:
        print(f"ONNX import failed: {e}")
        sys.exit(1)

    if not no_ptq:
        try:
            ptq_options = nncase.PTQTensorOptions()

            # Load real calibration frames if provided by the backend
            real_frames = None
            if calib_bin and calib_count > 0 and os.path.exists(calib_bin):
                raw = np.fromfile(calib_bin, dtype='<f4')
                if input_dtype == np.uint8 and len(input_shape) == 4:
                    # Browser sends NHWC float32 [0,1]; K230 model expects NCHW uint8 [0,255]
                    _, C, H, W = input_shape
                    expected = calib_count * H * W * C
                    if len(raw) == expected:
                        nhwc = raw.reshape(calib_count, H, W, C)
                        nchw = nhwc.transpose(0, 3, 1, 2)
                        real_frames = np.clip(nchw * 255, 0, 255).astype(np.uint8)
                        print(f"Using {calib_count} REAL calibration samples from {calib_bin}")
                    else:
                        print(f"[CALIB] Size mismatch: got {len(raw)} floats, expected {expected}. Falling back to synthetic.")

            ptq_options.samples_count = len(real_frames) if real_frames is not None else (
                20 if is_voice_spectrogram_input(input_shape, input_dtype) else 10
            )

            def calib_gen():
                if real_frames is not None:
                    for frame in real_frames:
                        yield [frame.reshape(input_shape)]
                    return
                for i in range(ptq_options.samples_count):
                    if input_dtype == np.uint8:
                        data = np.random.randint(0, 256, size=input_shape, dtype=np.uint8)
                    elif is_voice_spectrogram_input(input_shape, input_dtype):
                        data = make_voice_calibration_sample(input_shape, i)
                    else:
                        data = np.random.rand(*input_shape).astype(np.float32)
                    print(
                        f"Calib sample {i+1} shape: {data.shape}, dtype: {data.dtype}, "
                        f"range: {float(data.min()):.3f}..{float(data.max()):.3f}"
                    )
                    yield [data]

            ptq_options.set_tensor_data(calib_gen())
            compiler.use_ptq(ptq_options)
            print("PTQ OK")
        except Exception as e:
            print(f"PTQ failed: {e}")
            sys.exit(1)
    else:
        print("Skipping PTQ compilation (compiling in full float32 mode)")

    try:
        compiler.compile()
        print("Compile OK")
    except Exception as e:
        print(f"Compile failed: {e}")
        sys.exit(1)

    try:
        kmodel = compiler.gencode_tobytes()
        print(f"kmodel generated: {len(kmodel)} bytes")
    except Exception as e:
        print(f"gencode failed: {e}")
        sys.exit(1)

    if len(kmodel) < 100:
        print(f"ERROR: kmodel too small ({len(kmodel)} bytes)")
        sys.exit(1)

    if b'Protobuf' in kmodel[:200] or b'Error' in kmodel[:200]:
        print("ERROR: kmodel contains error text")
        sys.exit(1)

    with open(kmodel_path, 'wb') as f:
        f.write(kmodel)

    print(f"kmodel saved OK: {os.path.getsize(kmodel_path)} bytes")

if __name__ == '__main__':
    no_ptq = False
    args = sys.argv[1:]
    if '--no-ptq' in args:
        no_ptq = True
        args.remove('--no-ptq')
    if len(args) < 2:
        print("Usage: python nncase_compile.py [--no-ptq] <onnx_path> <kmodel_path> [calib_bin] [calib_count]")
        sys.exit(1)
    calib_p = args[2] if len(args) > 2 else None
    calib_c = int(args[3]) if len(args) > 3 else 0
    compile_model(args[0], args[1], no_ptq=no_ptq, calib_bin=calib_p, calib_count=calib_c)