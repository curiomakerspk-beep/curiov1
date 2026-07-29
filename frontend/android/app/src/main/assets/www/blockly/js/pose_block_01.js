        'use strict';

        // --- CHROMIUM WEBVIEW BLOB BUG PATCH & CORS PROXY ---
        const originalFetch = window.fetch;
        window.fetch = function() {
            if (arguments[1] && arguments[1].method === 'POST' && arguments[1].body instanceof Blob) {
                let url = arguments[0];
                const init = arguments[1];
                
                // Route K230 uploads directly to the board (Teammate's script handles CORS natively)
                // Removed Docker proxy bypass

                return new Promise((resolve, reject) => {
                    let bytesSent = 0;
                    const xhr = new XMLHttpRequest();
                    if (xhr.upload) { xhr.upload.onprogress = (e) => { bytesSent = e.loaded; }; }
                    xhr.open('POST', url, true);
                    if (init.headers) {
                        for (let k in init.headers) {
                            xhr.setRequestHeader(k, init.headers[k]);
                        }
                    }
                    xhr.onload = () => {
                        resolve({
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            text: () => Promise.resolve(xhr.responseText)
                        });
                    };
                    xhr.onerror = () => {
                        if (url.includes(':8080/upload') && bytesSent > 0) {
                            resolve({
                                ok: true,
                                status: 200,
                                text: () => Promise.resolve("OK: K230 Drop")
                            });
                        } else {
                            reject(new TypeError('Failed to fetch'));
                        }
                    };
                    xhr.send(init.body);
                });
            }
            return originalFetch.apply(this, arguments);
        };
        // ----------------------------------------


        


        // ──────────────────────────────────────────────────────────────
        // CONFIG
        // ──────────────────────────────────────────────────────────────
        const CONVERT_SERVER = (() => {
            let saved = localStorage.getItem('backend_url');
            if (saved) return saved;
            return `http://${window.location.hostname}:5001`;
        })();
        const CHUNK_BYTES = 192;
        const SERIAL_SUPPORTED = 'serial' in navigator;
        const NUM_KEYPOINTS = 17;   // MoveNet standard
        const MIN_POSE_CONF = 0.3;  // minimum MoveNet confidence to accept a sample

        // ──────────────────────────────────────────────────────────────
        // STATE
        // ──────────────────────────────────────────────────────────────
        let moveNet = null;   // loaded MoveNet model
        let classifier = null;   // tf.sequential dense head we train
        let trained = false;
        let classNamesCopy = [];
        let livePreviewActive = false;

        // Training dataset stored as tensors: [{xs: Tensor1D, label: number}, ...]
        let dataset = [];  // {xs: Float32Array (34 values), label: number}

        let classes = [
            { id: 1, name: 'Pose1', color: '#0ea5e9' },
            { id: 2, name: 'Pose2', color: '#10b981' },
        ];
        let nextClassId = 3;
        const CLASS_COLORS = ['#0ea5e9', '#10b981', '#f54254', '#7c3aed',
            '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

        let THRESHOLD = 0.80;

        // Per-class sample counts
        let classCounts = {};

        // Thumbnail stores: thumbnailStore[classIdx] = [ImageData, ...]
        // thumbnailDatasetIdx[classIdx] = [datasetIndex, ...]
        let thumbnailStore = {};
        let thumbnailDatasetIdx = {};

        // Camera / capture state
        let camStream = null;
        let camVideoEl = null;
        let camOpenIdx = null;
        let camAnimFrame = null;
        let holdTimer = null;
        let isCapturing = false;

        // Live preview state
        let previewStream = null;
        let previewVideo = null;

        // Chromium occasionally throws AbortError "Timeout starting video source" the
        // first time a camera device is opened (driver/hardware needing a moment to
        // free up, e.g. right after another tab/app released it). One short retry
        // clears the vast majority of these without bothering the user.
        async function getUserMediaWithRetry(constraints) {
            try {
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e) {
                if (e.name !== 'AbortError') throw e;
                await new Promise(r => setTimeout(r, 800));
                return await navigator.mediaDevices.getUserMedia(constraints);
            }
        }

        // ──────────────────────────────────────────────────────────────
        // WEBSERIAL STATE
        // ──────────────────────────────────────────────────────────────
        const ENC = new TextEncoder();
        const DEC = new TextDecoder();
        let port = null, portReader = null, portWriter = null;
        let connected = false, rxBuf = '';
        const rxHooks = [];

        function usbLog(msg, cls = '') {
            const el = document.getElementById('usbLog'); if (!el) return;
            const line = document.createElement('div'); if (cls) line.className = cls;
            line.textContent = msg; el.appendChild(line); el.scrollTop = el.scrollHeight;
        }
        function usbLogClear() { const el = document.getElementById('usbLog'); if (el) el.innerHTML = ''; }
        function usbSetProgress(idx, pct) {
            const p = Math.round(pct * 100);
            const pEl = document.getElementById(`usbFile${idx}Pct`);
            const fEl = document.getElementById(`usbFile${idx}Fill`);
            if (pEl) pEl.textContent = p + '%'; if (fEl) fEl.style.width = p + '%';
        }
        function showUsbPanel(v) { document.getElementById('usbProgressPanel')?.classList.toggle('visible', v); }
        function resetUsbPanel() { usbSetProgress(1, 0); usbSetProgress(2, 0); usbLogClear(); showUsbPanel(false); }
        async function cleanupPort() {
            connected = false;
            try { portReader && await portReader.cancel(); } catch { }
            try { portReader && portReader.releaseLock(); } catch { }
            try { portWriter && await portWriter.close(); } catch { }
            try { portWriter && portWriter.releaseLock(); } catch { }
            try { port && await port.close(); } catch { }
            port = portReader = portWriter = null;
        }
        async function rxPump() {
            rxBuf = '';
            try {
                while (connected) {
                    const { value, done } = await portReader.read(); if (done) break;
                    if (value?.length) { const t = DEC.decode(value, { stream: true }); rxBuf += t; for (const h of rxHooks) h(t); }
                }
            } catch (e) { if (connected) usbLog('RX error: ' + e.message, 'err'); }
        }
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        async function write(d) { if (!portWriter) return; await portWriter.write(typeof d === 'string' ? ENC.encode(d) : d); }
        async function enterRawREPL() {
            usbLog('Entering Raw REPL...', 'info');
            await write('\x03'); await sleep(200); await write('\x03'); await sleep(200); rxBuf = '';
            await write('\x01'); await sleep(300);
            let banner = '', t = Date.now() + 4000;
            while (Date.now() < t) { banner += rxBuf; rxBuf = ''; if (banner.includes('raw REPL')) { usbLog('Raw REPL ready ✓', 'ok'); rxBuf = ''; return; } await sleep(50); }
            await write('\x01'); await sleep(500); banner += rxBuf; rxBuf = '';
            if (banner.includes('raw REPL')) usbLog('Raw REPL ready ✓', 'ok');
            else usbLog('Raw REPL banner not seen — reset board', 'warn');
            rxBuf = '';
        }
        async function exitRawREPL() { await write('\x02'); await sleep(200); }
        async function execPy(code) {
            rxBuf = ''; await write(code); await write('\x04');
            let full = ''; const dl = Date.now() + 10000;
            while (Date.now() < dl) {
                if (rxBuf.length) {
                    full += rxBuf; rxBuf = '';
                    const oi = full.indexOf('OK');
                    if (oi >= 0) {
                        const a = full.slice(oi + 2); const e1 = a.indexOf('\x04');
                        if (e1 >= 0) {
                            const e2 = a.indexOf('\x04', e1 + 1);
                            if (e2 >= 0) { const se = a.slice(e1 + 1, e2).trim(); if (se) usbLog('stderr: ' + se, 'warn'); return a.slice(0, e1).trim(); }
                        }
                    }
                    if (full.includes('\r\n>') || full === '>') { await write('\x03'); await sleep(100); rxBuf = ''; throw new Error('REPL continuation mode'); }
                } await sleep(10);
            } throw new Error('Timeout. Last: ' + full.slice(-40).replace(/\x04/g, '<EOT>'));
        }
        async function ensureDir(path) { const p = path.replace(/\/$/, ''); await execPy(`import os\r\ntry:\r\n os.mkdir('${p}')\r\nexcept:pass`); }
        async function writeFileOnBoard(dest, arr, onPct) {
            await execPy(`_f=open('${dest}','wb')`);
            let off = 0;
            while (off < arr.length) {
                const sl = arr.slice(off, off + CHUNK_BYTES);
                const hex = Array.from(sl).map(b => b.toString(16).padStart(2, '0')).join('');
                await execPy(`_f.write(bytes.fromhex('${hex}'))`);
                off += sl.length; if (onPct) onPct(off / arr.length);
            }
            await execPy(`_f.close();del _f`);
        }

        function onDeployMethodChange(val) {
            document.getElementById('wifiRow').style.display = val === 'wifi' ? 'flex' : 'none';
            document.getElementById('onlineWifiRow').style.display = val === 'online' ? 'flex' : 'none';
            document.getElementById('usbBaudRow').style.display = val === 'usb' ? 'flex' : 'none';
            document.getElementById('serialWarn').classList.toggle('show', val === 'usb' && !SERIAL_SUPPORTED);
            if (val !== 'usb') showUsbPanel(false);
        }

        // ── Online Wi-Fi (board on existing router network) ───────────
        function onlineUrl(path) {
            const ip = document.getElementById('onlineIpInput').value.trim();
            const pt = document.getElementById('onlinePortInput').value.trim() || '8080';
            return `http://${ip}:${pt}${path}`;
        }

        async function pingOnlineK230() {
            const statusEl = document.getElementById('onlinePingStatus');
            const ip = document.getElementById('onlineIpInput').value.trim();
            if (!ip) { statusEl.className = 'k230-online-status err'; statusEl.textContent = 'Enter board IP first.'; return; }
            statusEl.className = 'k230-online-status chk'; statusEl.textContent = 'Pinging...';
            try {
                await fetch(onlineUrl('/'), { method: 'GET', signal: AbortSignal.timeout(5000) });
                statusEl.className = 'k230-online-status ok'; statusEl.textContent = 'Board reachable at ' + ip;
            } catch (e) {
                statusEl.className = 'k230-online-status err'; statusEl.textContent = 'Not reachable. Check IP / Wi-Fi.';
            }
        }

        function getOnlineLocalSubnet() {
            return new Promise(resolve => {
                try {
                    const pc = new RTCPeerConnection({ iceServers: [] });
                    pc.createDataChannel('');
                    pc.createOffer().then(o => pc.setLocalDescription(o));
                    pc.onicecandidate = e => {
                        if (!e || !e.candidate) return;
                        const m = e.candidate.candidate.match(/(\d+\.\d+\.\d+)\.\d+/);
                        if (m) { pc.close(); resolve(m[1]); }
                    };
                    setTimeout(() => resolve(null), 3000);
                } catch (e) { resolve(null); }
            });
        }

        async function autoDetectOnlineK230() {
            const detectBtn = document.getElementById('onlineDetectBtn');
            const pingBtn = document.getElementById('onlinePingBtn');
            const statusEl = document.getElementById('onlinePingStatus');
            const pt = document.getElementById('onlinePortInput').value.trim() || '8080';
            detectBtn.disabled = true; pingBtn.disabled = true; detectBtn.textContent = 'Scanning...';
            statusEl.className = 'k230-online-status chk'; statusEl.textContent = 'Detecting local subnet...';

            const subnet = await getOnlineLocalSubnet();
            if (!subnet) {
                statusEl.className = 'k230-online-status err'; statusEl.textContent = 'Could not detect subnet. Enter IP manually.';
                detectBtn.disabled = false; pingBtn.disabled = false; detectBtn.textContent = 'Auto-Detect';
                return;
            }
            statusEl.textContent = `Scanning ${subnet}.1–254 on port ${pt}...`;

            const probes = [];
            for (let i = 1; i <= 254; i++) {
                const ip = `${subnet}.${i}`;
                probes.push(
                    fetch(`http://${ip}:${pt}/`, { method: 'GET', signal: AbortSignal.timeout(1500) })
                        .then(r => (r.ok || r.status === 404) ? ip : null)
                        .catch(() => null)
                );
            }
            const results = await Promise.all(probes);
            const found = results.find(r => r !== null);
            if (found) {
                document.getElementById('onlineIpInput').value = found;
                localStorage.setItem('k230_online_ip', found);
                statusEl.className = 'k230-online-status ok'; statusEl.textContent = 'K230 found at ' + found;
            } else {
                statusEl.className = 'k230-online-status err'; statusEl.textContent = 'K230 not found on this network.';
            }
            detectBtn.disabled = false; pingBtn.disabled = false; detectBtn.textContent = 'Auto-Detect';
        }

        // persist online IP across sessions
        (function () {
            const el = document.getElementById('onlineIpInput');
            if (!el) return;
            const saved = localStorage.getItem('k230_online_ip');
            if (saved) el.value = saved;
            el.addEventListener('change', () => localStorage.setItem('k230_online_ip', el.value.trim()));
        })();

        // ──────────────────────────────────────────────────────────────
        // HELPERS
        // ──────────────────────────────────────────────────────────────
        function setStatus(msg) { document.getElementById('statusBar').textContent = msg; }
        function updateThreshold(val) { THRESHOLD = parseInt(val) / 100; document.getElementById('thresholdValue').textContent = val + '%'; }
        function downloadBlob(blob, name) {
            const url = URL.createObjectURL(blob); const a = document.createElement('a');
            a.href = url; a.download = name; document.body.appendChild(a); a.click();
            document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        function updateButtons() {
            ['deployHeaderBtn', 'deployCardBtn', 'deployK230Btn', 'exportBtn', 'testBtn'].forEach(id => {
                const el = document.getElementById(id); if (el) el.disabled = !trained;
            });
            const stopBtn = document.getElementById('stopBtn');
            if (stopBtn) stopBtn.disabled = true;
        }

        // ──────────────────────────────────────────────────────────────
        // MOVENET FEATURE EXTRACTION
        // Flattens 17 keypoints × (x, y) → Float32Array of length 34
        // ──────────────────────────────────────────────────────────────
        function keypointsToFeatures(keypoints, imgW, imgH) {
            const arr = new Float32Array(NUM_KEYPOINTS * 2);
            for (let i = 0; i < NUM_KEYPOINTS; i++) {
                const kp = keypoints[i];
                arr[i * 2] = kp ? kp.x / imgW : 0;
                arr[i * 2 + 1] = kp ? kp.y / imgH : 0;
            }
            return arr;
        }

        // ──────────────────────────────────────────────────────────────
        // POSE THUMBNAIL DRAWING
        // ──────────────────────────────────────────────────────────────
        const SKELETON_PAIRS = [
            [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
            [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]
        ];

        function drawPoseThumb(canvas, keypoints, color) {
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;

            if (!keypoints || keypoints.length < 17) return;

            const srcW = 320, srcH = 240;
            const scX = W / srcW, scY = H / srcH;

            const tx = kp => (srcW - kp.x) * scX;
            const ty = kp => kp.y * scY;

            ctx.strokeStyle = color + 'cc';
            ctx.lineWidth = 1.5;
            SKELETON_PAIRS.forEach(([a, b]) => {
                const ka = keypoints[a], kb = keypoints[b];
                if (ka && kb && ka.score > 0.2 && kb.score > 0.2) {
                    ctx.beginPath(); ctx.moveTo(tx(ka), ty(ka)); ctx.lineTo(tx(kb), ty(kb)); ctx.stroke();
                }
            });

            keypoints.forEach(kp => {
                if (kp.score > 0.2) {
                    ctx.beginPath(); ctx.arc(tx(kp), ty(kp), 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = color; ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
                }
            });
        }

        function drawSkeletonOnCanvas(ctx, keypoints, W, H, scaleX, scaleY, color) {
            const tx = kp => kp.x * scaleX;
            const ty = kp => kp.y * scaleY;

            ctx.strokeStyle = color + 'cc';
            ctx.lineWidth = 2;
            SKELETON_PAIRS.forEach(([a, b]) => {
                const ka = keypoints[a], kb = keypoints[b];
                if (ka && kb && ka.score > MIN_POSE_CONF && kb.score > MIN_POSE_CONF) {
                    ctx.beginPath(); ctx.moveTo(tx(ka), ty(ka)); ctx.lineTo(tx(kb), ty(kb)); ctx.stroke();
                }
            });
            keypoints.forEach(kp => {
                if (kp.score > MIN_POSE_CONF) {
                    ctx.beginPath(); ctx.arc(tx(kp), ty(kp), 4, 0, Math.PI * 2);
                    ctx.fillStyle = color; ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
                }
            });
        }

        // ──────────────────────────────────────────────────────────────
        // LOAD MOVENET  (runs once on page load)
        // ──────────────────────────────────────────────────────────────
        async function loadBaseModel() {
            const fill = document.getElementById('modelLoadFill');
            const titleEl = document.getElementById('modelLoadTitle');
            const statusEl = document.getElementById('modelLoadStatus');
            const iconEl = document.getElementById('modelLoadIcon');

            try {
                let fakeProgress = 0;
                const ticker = setInterval(() => {
                    fakeProgress = Math.min(90, fakeProgress + Math.random() * 6);
                    if (fill) fill.style.width = fakeProgress + '%';
                }, 400);

                const model = poseDetection.SupportedModels.MoveNet;
                moveNet = await poseDetection.createDetector(model, {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                    modelUrl: './offline_libs/models/movenet/model.json'
                });

                clearInterval(ticker);
                if (fill) fill.style.width = '100%';

                if (iconEl) iconEl.textContent = '✓';
                if (titleEl) titleEl.textContent = 'MoveNet ready — SinglePose Thunder';
                if (statusEl) statusEl.textContent = 'Pretrained on human body keypoints. Collect poses to fine-tune.';

                document.getElementById('addClassBtn').disabled = false;
                document.getElementById('trainBtn').disabled = false;

                setStatus('MoveNet loaded ✓ — add samples for each pose class, then train.');
                document.getElementById('modelLoadBar').style.borderLeftColor = '#10b981';
                render();

            } catch (e) {
                if (fill) { fill.style.width = '100%'; fill.style.background = '#ef4444'; }
                if (iconEl) iconEl.textContent = '✗';
                if (titleEl) titleEl.textContent = 'Model failed to load';
                if (statusEl) statusEl.textContent = e.message;
                setStatus('Model load failed: ' + e.message);
                console.error('MoveNet load error:', e);
            }
        }

        // ──────────────────────────────────────────────────────────────
        // CAMERA CAPTURE PER CLASS
        // ──────────────────────────────────────────────────────────────
        async function openCamCapture(classIdx) {
            if (!moveNet) { setStatus('MoveNet not loaded yet.'); return; }
            if (camOpenIdx !== null) stopCamCapture();

            try {
                camStream = await getUserMediaWithRetry({
                    video: { width: 320, height: 240, facingMode: 'user' }, audio: false
                });
                camVideoEl = document.createElement('video');
                camVideoEl.srcObject = camStream;
                camVideoEl.width = 320; camVideoEl.height = 240;
                await camVideoEl.play();

                camOpenIdx = classIdx;
                window._lastLivePose = null;
                render();
                animateCamCanvas(classIdx);
                startPoseLoop();
                setStatus('📷 Camera open — hold the button to capture samples.');
            } catch (e) { alert('Camera error: ' + e.message); console.error(e); }
        }

        async function animateCamCanvas(classIdx) {
            const canvas = document.getElementById(`cam-canvas-${classIdx}`);
            if (!canvas || camOpenIdx !== classIdx) return;
            const ctx = canvas.getContext('2d');
            const W = canvas.width, H = canvas.height;

            ctx.save(); ctx.scale(-1, 1); ctx.drawImage(camVideoEl, -W, 0, W, H); ctx.restore();

            if (window._lastLivePose) {
                const scaleX = W / camVideoEl.width;
                const scaleY = H / camVideoEl.height;
                const mirroredKps = window._lastLivePose.keypoints.map(kp => ({
                    ...kp,
                    x: camVideoEl.width - kp.x
                }));
                drawSkeletonOnCanvas(ctx, mirroredKps, W, H, scaleX, scaleY, classes[classIdx]?.color || '#0ea5e9');
            }

            camAnimFrame = requestAnimationFrame(() => animateCamCanvas(classIdx));
        }

        let _poseLoopRunning = false;
        async function startPoseLoop() {
            if (_poseLoopRunning) return;
            _poseLoopRunning = true;
            while (camOpenIdx !== null && camVideoEl) {
                try {
                    const poses = await moveNet.estimatePoses(camVideoEl, { flipHorizontal: true });
                    if (poses && poses.length > 0) window._lastLivePose = poses[0];
                } catch (e) { }
                await new Promise(r => setTimeout(r, 150));
            }
            _poseLoopRunning = false;
        }

        function stopCamCapture() {
            clearInterval(holdTimer); holdTimer = null;
            if (camAnimFrame) { cancelAnimationFrame(camAnimFrame); camAnimFrame = null; }
            if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
            camVideoEl = null; camOpenIdx = null; isCapturing = false;
            render();
            setStatus('Camera stopped.');
        }

        function startHoldRecord(classIdx) {
            captureOneSample(classIdx);
            holdTimer = setInterval(() => captureOneSample(classIdx), 400);
        }
        function stopHoldRecord() {
            clearInterval(holdTimer); holdTimer = null;
        }

        let burstRunning = false;
        async function burstCapture(classIdx, total = 50) {
            if (burstRunning) return;
            if (!moveNet || camOpenIdx !== classIdx || !camVideoEl) return;
            burstRunning = true;
            const btn = document.getElementById(`burst-btn-${classIdx}`);
            if (btn) btn.disabled = true;

            for (let i = 0; i < total; i++) {
                if (camOpenIdx !== classIdx || !camVideoEl) break;
                await captureOneSample(classIdx);
                if (btn) btn.textContent = `📸 Capturing ${i + 1}/${total}`;
                await new Promise(r => setTimeout(r, 150));
            }

            if (btn) { btn.disabled = false; btn.textContent = '📸 Capture 50'; }
            burstRunning = false;
            setStatus(`✓ Burst capture finished for "${classes[classIdx]?.name || ''}".`);
        }

        async function captureOneSample(classIdx) {
            if (!moveNet || camOpenIdx !== classIdx || !camVideoEl) return;
            isCapturing = true;

            try {
                const poses = await moveNet.estimatePoses(camVideoEl, {
                    flipHorizontal: true
                });

                if (!poses || poses.length === 0) {
                    setStatus('⚠️ No person detected — make sure your body is visible.');
                    return;
                }
                const pose = poses[0];

                const avgScore = pose.keypoints.reduce((s, k) => s + k.score, 0) / pose.keypoints.length;
                if (avgScore < MIN_POSE_CONF) {
                    setStatus('⚠️ Pose confidence too low — make sure your body is visible.');
                    return;
                }

                const features = keypointsToFeatures(pose.keypoints, camVideoEl.width, camVideoEl.height);
                const cls = classes[classIdx];

                const datasetIdx = dataset.length;
                dataset.push({ xs: features, label: classIdx });
                classCounts[cls.name] = (classCounts[cls.name] || 0) + 1;
                const count = classCounts[cls.name];

                if (!thumbnailStore[classIdx]) thumbnailStore[classIdx] = [];
                if (!thumbnailDatasetIdx[classIdx]) thumbnailDatasetIdx[classIdx] = [];
                const thumbIdx = thumbnailStore[classIdx].length;

                const thumbCv = document.createElement('canvas'); thumbCv.width = 64; thumbCv.height = 64;
                const thumbCtx = thumbCv.getContext('2d');
                thumbCtx.save(); thumbCtx.scale(-1, 1); thumbCtx.drawImage(camVideoEl, -64, 0, 64, 64); thumbCtx.restore();
                drawPoseThumb(thumbCv, pose.keypoints, cls.color);
                const imageData = thumbCtx.getImageData(0, 0, 64, 64);
                thumbnailStore[classIdx].push(imageData);
                thumbnailDatasetIdx[classIdx].push(datasetIdx);

                const countEl = document.getElementById(`count-${classIdx}`);
                if (countEl) countEl.textContent = count + ' sample' + (count !== 1 ? 's' : '');

                rebuildPoseThumbs(classIdx);
                renderStats();
                setStatus(`✓ Captured sample ${count} for "${cls.name}" (conf: ${(avgScore * 100).toFixed(0)}%)`);

            } catch (e) {
                setStatus('Capture error: ' + e.message);
                console.error(e);
            } finally {
                isCapturing = false;
            }
        }

        function rebuildPoseThumbs(classIdx) {
            const cls = classes[classIdx];
            let grid = document.getElementById(`thumbs-${classIdx}`);
            if (!grid) return;

            const stored = thumbnailStore[classIdx] || [];
            if (stored.length === 0) {
                grid.className = 'no-samples-hint';
                grid.innerHTML = `
                    <div style="font-size:28px">🧘</div>
                    <div>Hold the button to capture poses</div>
                `;
                return;
            }

            grid.className = 'samples-grid';
            grid.innerHTML = '';

            stored.forEach((canvasData, si) => {
                const wrap = document.createElement('div'); wrap.className = 'thumb-wrap';
                const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
                const ctx2 = cv.getContext('2d'); ctx2.putImageData(canvasData, 0, 0);
                const del = document.createElement('button'); del.className = 'thumb-del';
                del.textContent = '×';
                del.onclick = () => {
                    const globalIdx = thumbnailDatasetIdx[classIdx][si];
                    if (globalIdx !== undefined) {
                        dataset.splice(globalIdx, 1);
                        Object.keys(thumbnailDatasetIdx).forEach(ci => {
                            thumbnailDatasetIdx[ci] = thumbnailDatasetIdx[ci].map(di => di > globalIdx ? di - 1 : di);
                        });
                    }
                    thumbnailStore[classIdx].splice(si, 1);
                    thumbnailDatasetIdx[classIdx].splice(si, 1);
                    classCounts[cls.name] = Math.max(0, (classCounts[cls.name] || 1) - 1);
                    
                    const countEl = document.getElementById(`count-${classIdx}`);
                    if (countEl) {
                        const count = classCounts[cls.name] || 0;
                        countEl.textContent = count + ' sample' + (count !== 1 ? 's' : '');
                    }
                    
                    renderStats();
                    rebuildPoseThumbs(classIdx);
                };
                wrap.appendChild(cv); wrap.appendChild(del);
                grid.appendChild(wrap);
            });
        }

        // ──────────────────────────────────────────────────────────────
        // RENDER
        // ──────────────────────────────────────────────────────────────
        function render() { renderClasses(); renderStats(); initOutputBars(); }

        function renderClasses() {
            const container = document.getElementById('classList');
            container.innerHTML = '';
            classes.forEach((cls, idx) => {
                const card = document.createElement('div');
                card.className = 'class-card';
                const count = classCounts[cls.name] || 0;
                const isCamOpen = camOpenIdx === idx;

                card.innerHTML = `
            <div class="class-header">
                <input class="class-name" style="color:${cls.color}" value="${cls.name}"
                    onchange="renameClass(${idx},this.value)"
                    oninput="renameClass(${idx},this.value)"/>
                <span class="sample-count-badge" id="count-${idx}">
                    ${count} sample${count !== 1 ? 's' : ''}
                </span>
                <button class="remove-btn" onclick="removeClass(${idx})" title="Remove class">×</button>
            </div>

            <div class="card-body">

                <div class="cam-panel">
                    ${isCamOpen ? `
                    <div class="cam-canvas-box">
                        <canvas id="cam-canvas-${idx}" width="320" height="240"></canvas>
                    </div>
                    <div class="cam-crop-label">
                        📐 Dashed box = capture area &nbsp;·&nbsp; <b>320×240px</b> crop
                    </div>
                    <div class="cam-btn-row">
                        <button class="hold-btn" style="background:${cls.color}"
                            onmousedown="startHoldRecord(${idx})" onmouseup="stopHoldRecord()"
                            onmouseleave="stopHoldRecord()"
                            ontouchstart="startHoldRecord(${idx})" ontouchend="stopHoldRecord()">
                            Hold to Capture
                        </button>
                        <button class="burst-btn" id="burst-btn-${idx}" onclick="burstCapture(${idx})">📸 Capture 50</button>
                        <button class="stop-cam-btn" onclick="stopCamCapture()">Stop</button>
                    </div>
                    ` : `
                    <div class="cam-canvas-box">
                        <div class="cam-canvas-placeholder">
                            <div class="ph-icon">📷</div>
                            <div>Click <b>Webcam</b> to start camera</div>
                        </div>
                    </div>
                    <button class="open-cam-btn"
                        onclick="openCamCapture(${idx})" ${!moveNet ? 'disabled' : ''}>
                        Webcam
                    </button>
                    `}
                </div>

                ${count > 0 ? `
                <div class="samples-panel">
                    <div class="samples-header">${count} Pose Sample${count !== 1 ? 's' : ''}</div>
                    <div class="samples-grid" id="thumbs-${idx}"></div>
                </div>` : `
                <div class="samples-panel">
                    <div class="no-samples-hint" id="thumbs-${idx}">
                        <div style="font-size:28px">🧘</div>
                        <div>Hold the button to capture poses</div>
                    </div>
                </div>`}

            </div>
        `;

                container.appendChild(card);
            });

            classes.forEach((cls, idx) => {
                rebuildPoseThumbs(idx);
            });
        }

        function renderStats() {
            document.getElementById('statsList').innerHTML = classes.map(cls => `
        <div class="stat-row">
            <div class="stat-dot" style="background:${cls.color}"></div>
            <span class="stat-name">${cls.name}</span>
            <span class="stat-count">${classCounts[cls.name] || 0} samples</span>
        </div>`).join('');
        }

        // ──────────────────────────────────────────────────────────────
        // CLASS MANAGEMENT
        // ──────────────────────────────────────────────────────────────
        function addClass() {
            const id = nextClassId++;
            const cls = { id, name: `Pose${id}`, color: CLASS_COLORS[(id - 1) % CLASS_COLORS.length] };
            classes.push(cls);
            classCounts[cls.name] = 0;
            render();
        }

        function removeClass(idx) {
            if (classes.length <= 2) { alert('Need at least 2 classes'); return; }
            const cls = classes[idx];
            for (let i = dataset.length - 1; i >= 0; i--) { if (dataset[i].label === idx) dataset.splice(i, 1); }
            dataset.forEach(s => { if (s.label > idx) s.label--; });
            delete classCounts[cls.name];
            delete thumbnailStore[idx];
            delete thumbnailDatasetIdx[idx];
            classes.splice(idx, 1);
            trained = false; updateButtons();
            render();
        }

        function renameClass(idx, newName) {
            const cls = classes[idx];
            const oldName = cls.name;
            if (oldName === newName) return;
            if (classCounts[oldName] !== undefined) {
                classCounts[newName] = classCounts[oldName];
                delete classCounts[oldName];
            }
            cls.name = newName;
            renderStats();
            const lEl = document.getElementById(`output-label-${idx}`);
            if (lEl) { lEl.textContent = newName; lEl.style.color = cls.color; }
        }

        // ──────────────────────────────────────────────────────────────
        // OUTPUT BARS
        // ──────────────────────────────────────────────────────────────
        function initOutputBars() {
            document.getElementById('outputBars').innerHTML = classes.map((cls, i) => `
        <div class="output-row" id="output-row-${i}">
            <span class="output-label" style="color:${cls.color}"
                id="output-label-${i}">${cls.name}</span>
            <div class="output-bar-wrap">
                <div class="output-bar-fill" id="output-bar-${i}"
                    style="width:0%;background:${cls.color}">
                    <span class="output-bar-pct" id="output-pct-${i}"></span>
                </div>
                <span class="output-bar-pct-outside" id="output-pct-out-${i}">0%</span>
            </div>
        </div>`).join('');
        }

        function updateOutputBars(scores) {
            const best = scores.reduce((a, b) => a.score > b.score ? a : b);
            const isAbove = best.score >= THRESHOLD;

            scores.forEach((s, i) => {
                const pct = Math.round(s.score * 100);
                const cls = classes[i];
                const color = cls?.color || CLASS_COLORS[i % CLASS_COLORS.length];
                const bEl = document.getElementById(`output-bar-${i}`);
                const pEl = document.getElementById(`output-pct-${i}`);
                const oEl = document.getElementById(`output-pct-out-${i}`);
                const lEl = document.getElementById(`output-label-${i}`);
                if (!bEl) return;
                bEl.style.width = pct + '%'; bEl.style.background = color;
                if (pct > 20) { pEl.textContent = pct + '%'; oEl.textContent = ''; }
                else { pEl.textContent = ''; oEl.textContent = pct + '%'; }
                if (lEl) { lEl.textContent = s.name; lEl.style.color = color; }
            });
            updateDetectStatus(best, isAbove);
        }

        function updateDetectStatus(best, isDetected) {
            const el = document.getElementById('detectStatus');
            const pct = (best.score * 100).toFixed(1);
            const cls = classes.find(c => c.name === best.name);
            const color = cls?.color || '#0ea5e9';
            if (isDetected) {
                el.style.background = color + '14'; el.style.borderBottom = `2px solid ${color}30`;
                el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:${color};
            display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🧘</div>
            <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:800;color:${color};white-space:nowrap;
                    overflow:hidden;text-overflow:ellipsis">${best.name}</div>
                <div style="font-size:11px;color:#64748b;margin-top:1px">
                    Detected ✓ ${pct}% confidence</div>
            </div>
            <div style="font-size:22px;font-weight:900;color:${color};flex-shrink:0">
                ${Math.round(best.score * 100)}%</div>`;
            } else {
                el.style.background = '#fafafa'; el.style.borderBottom = '1px solid #f1f5f9';
                el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:#f1f5f9;
            display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🧘</div>
            <div style="flex:1">
                <div style="font-size:14px;font-weight:700;color:#94a3b8">Listening...</div>
                <div style="font-size:11px;color:#cbd5e1;margin-top:1px">
                    Best: ${best.name} at ${pct}%
                    (need ${Math.round(THRESHOLD * 100)}%)</div>
            </div>`;
            }
        }

        function resetDetectStatus() {
            const el = document.getElementById('detectStatus');
            el.style.background = '#fafafa'; el.style.borderBottom = '1px solid #f1f5f9';
            el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:#f1f5f9;
        display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🧘</div>
        <div><div style="font-size:13px;font-weight:700;color:#94a3b8">Not Detected</div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:1px">Train model and start camera</div></div>`;
            classes.forEach((_, i) => {
                const b = document.getElementById(`output-bar-${i}`);
                const p = document.getElementById(`output-pct-${i}`);
                const o = document.getElementById(`output-pct-out-${i}`);
                if (b) b.style.width = '0%'; if (p) p.textContent = ''; if (o) o.textContent = '0%';
            });
        }

        // ──────────────────────────────────────────────────────────────
        // TRAIN  — builds a dense classifier on top of MoveNet keypoints
        // ──────────────────────────────────────────────────────────────
        function setTrainState(html) { document.getElementById('trainStateBox').innerHTML = html; }

        async function trainModel() {
            if (!moveNet) { alert('MoveNet not loaded yet.'); return; }
            const minSamples = Math.min(...classes.map(c => classCounts[c.name] || 0));
            if (minSamples < 5) {
                alert(`Need at least 5 samples per class. Some classes have fewer.`); return;
            }

            document.getElementById('trainBtn').disabled = true;
            trained = false; updateButtons();

            const showProgress = (pct, msg) => {
                setTrainState(`<div class="state-progress">
            <div class="progress-pct">${pct}%</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-label">${msg}</div>
        </div>`);
                setStatus(msg);
            };

            try {
                showProgress(5, 'Preparing keypoint dataset...');
                await tf.nextFrame();

                const numClasses = classes.length;
                const total = dataset.length;

                const xsArr = dataset.map(s => Array.from(s.xs));
                const ysArr = dataset.map(s => {
                    const one = new Array(numClasses).fill(0);
                    one[s.label] = 1; return one;
                });

                const xs = tf.tensor2d(xsArr);
                const ys = tf.tensor2d(ysArr);

                showProgress(15, 'Building classifier...');
                await tf.nextFrame();

                classifier = tf.sequential({
                    layers: [
                        tf.layers.dense({
                            inputShape: [NUM_KEYPOINTS * 2], units: 128, activation: 'relu',
                            kernelInitializer: 'glorotUniform'
                        }),
                        tf.layers.dropout({ rate: 0.3 }),
                        tf.layers.dense({ units: 64, activation: 'relu' }),
                        tf.layers.dropout({ rate: 0.2 }),
                        tf.layers.dense({ units: numClasses, activation: 'softmax' })
                    ]
                });

                classifier.compile({
                    optimizer: tf.train.adam(0.001),
                    loss: 'categoricalCrossentropy',
                    metrics: ['accuracy']
                });

                showProgress(20, 'Training...');

                const EPOCHS = 80;
                await classifier.fit(xs, ys, {
                    epochs: EPOCHS,
                    batchSize: 16,
                    validationSplit: 0.15,
                    shuffle: true,
                    callbacks: {
                        onEpochEnd: async (epoch, logs) => {
                            const pct = 20 + Math.round(((epoch + 1) / EPOCHS) * 75);
                            const acc = logs?.acc != null ? ` acc:${(logs.acc * 100).toFixed(0)}%` : '';
                            const val = logs?.val_acc != null ? ` val:${(logs.val_acc * 100).toFixed(0)}%` : '';
                            showProgress(pct, `Epoch ${epoch + 1}/${EPOCHS}${acc}${val}`);
                            await tf.nextFrame();
                        }
                    }
                });

                xs.dispose(); ys.dispose();

                classNamesCopy = classes.map(c => c.name);
                trained = true;

                showProgress(100, 'Training complete!');
                setStatus(`✅ Pose model trained! ${total} samples · ${numClasses} classes. Start camera to preview.`);

                setTrainState(`<div class="state-done">
            <div class="icon">✅</div>
            <h3>Model Trained!</h3>
            <p>${total} samples · ${numClasses} classes</p>
            <p style="font-size:11px;margin-top:4px;font-weight:700;
                background:linear-gradient(135deg,#0ea5e9,#10b981);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent">
                MoveNet + Dense Classifier
            </p>
            <button class="retrain-btn" onclick="resetTrain()">Retrain</button>
        </div>`);

                initOutputBars();
                updateButtons();

            } catch (e) {
                console.error('Training error:', e);
                alert('Training Failed: ' + e.message);
                setStatus('Training failed: ' + e.message);
                setTrainState(`<div class="state-ready"><div class="icon">🧘</div>
            <h3>Ready to train.</h3>
            <p>Add at least 20 samples per pose<br>then press Train.</p></div>`);
            } finally {
                document.getElementById('trainBtn').disabled = false;
            }
        }

        function resetTrain() {
            trained = false; classNamesCopy = []; updateButtons();
            if (classifier) { classifier.dispose(); classifier = null; }
            setTrainState(`<div class="state-ready"><div class="icon">🧘</div>
        <h3>Ready to train.</h3>
        <p>Add at least 20 samples per pose<br>then press Train.</p></div>`);
            setStatus('');
            initOutputBars();
            resetDetectStatus();
        }

        // ──────────────────────────────────────────────────────────────
        // LIVE PREVIEW  — two loops:
        //   1. drawLoop  — rAF 60fps, draws video + cached skeleton
        //   2. poseLoop  — throttled async inference every ~100ms
        // ──────────────────────────────────────────────────────────────
        let _previewPose = null;
        let _previewScores = null;
        let _previewCanvas = null;
        let _previewCtx = null;
        let _drawFrameId = null;
        let _poseTimerId = null;

        async function startLivePreview() {
            if (livePreviewActive) return;
            if (!trained || !classifier) { alert('Train the model first!'); return; }

            try {
                previewStream = await getUserMediaWithRetry({
                    video: { width: 320, height: 240, facingMode: 'user' }, audio: false
                });
                previewVideo = document.createElement('video');
                previewVideo.srcObject = previewStream;
                previewVideo.width = 320;
                previewVideo.height = 240;
                previewVideo.playsInline = true;
                await previewVideo.play();

                _previewCanvas = document.getElementById('previewCanvas');
                _previewCanvas.width = 320;
                _previewCanvas.height = 240;
                _previewCtx = _previewCanvas.getContext('2d');

                document.getElementById('previewPlaceholder').style.display = 'none';
                document.getElementById('testBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;

                livePreviewActive = true;
                _previewPose = null;
                _previewScores = null;

                _drawLoop();
                _startPoseInferLoop();

                setStatus('📷 Live preview running — detecting poses');

            } catch (e) {
                alert('Camera error: ' + e.message);
                stopLivePreview();
            }
        }

        function _drawLoop() {
            if (!livePreviewActive) { _drawFrameId = null; return; }
            _drawFrameId = requestAnimationFrame(_drawLoop);

            const cv = _previewCanvas;
            const ctx = _previewCtx;
            const VW = cv.width, VH = cv.height;

            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(previewVideo, -VW, 0, VW, VH);
            ctx.restore();

            if (_previewPose) {
                const mirroredKps = _previewPose.keypoints.map(kp => ({
                    ...kp,
                    x: previewVideo.width - kp.x
                }));
                drawSkeletonOnCanvas(ctx, mirroredKps, VW, VH, 1, 1, '#0ea5e9');
            }

            if (_previewScores) {
                const best = _previewScores.reduce((a, b) => a.score > b.score ? a : b);
                if (best.score >= THRESHOLD) {
                    const cls = classes.find(c => c.name === best.name);
                    const color = cls?.color || '#0ea5e9';
                    ctx.fillStyle = 'rgba(0,0,0,0.45)';
                    ctx.fillRect(0, VH - 32, VW, 32);
                    ctx.fillStyle = color;
                    ctx.font = 'bold 15px system-ui';
                    ctx.fillText(`${best.name}  ${(best.score * 100).toFixed(0)}%`, 10, VH - 10);
                }
            }
        }

        async function _startPoseInferLoop() {
            while (livePreviewActive) {
                try {
                    const poses = await moveNet.estimatePoses(previewVideo, { flipHorizontal: true });
                    if (!livePreviewActive) break;
                    if (poses && poses.length > 0) {
                        const pose = poses[0];
                        _previewPose = pose;

                        const avgScore = pose.keypoints.reduce((s, k) => s + k.score, 0) / pose.keypoints.length;
                        if (avgScore > MIN_POSE_CONF && classifier) {
                            const features = keypointsToFeatures(pose.keypoints, previewVideo.width, previewVideo.height);
                            const t = tf.tensor2d([Array.from(features)]);
                            const p = classifier.predict(t);
                            const arr = await p.data();
                            t.dispose(); p.dispose();
                            if (!livePreviewActive) break;
                            _previewScores = classes.map((cls, i) => ({ name: cls.name, score: arr[i] }));
                            updateOutputBars(_previewScores);
                        }
                    }
                } catch (e) {
                    if (livePreviewActive) console.warn('Pose infer error:', e);
                }
                await new Promise(r => { _poseTimerId = setTimeout(r, 80); });
            }
        }

        function stopLivePreview() {
            livePreviewActive = false;

            if (_drawFrameId) { cancelAnimationFrame(_drawFrameId); _drawFrameId = null; }
            if (_poseTimerId) { clearTimeout(_poseTimerId); _poseTimerId = null; }
            if (previewStream) { previewStream.getTracks().forEach(t => t.stop()); previewStream = null; }
            previewVideo = null;
            _previewPose = null; _previewScores = null;

            if (_previewCtx && _previewCanvas) {
                _previewCtx.clearRect(0, 0, _previewCanvas.width, _previewCanvas.height);
            }

            document.getElementById('previewPlaceholder').style.display = 'flex';
            document.getElementById('testBtn').disabled = !trained;
            document.getElementById('stopBtn').disabled = true;

            resetDetectStatus();
            setStatus('Camera stopped.');
        }

        // ──────────────────────────────────────────────────────────────
        // RESET PAGE
        // ──────────────────────────────────────────────────────────────
        function resetPage() {
            if (!confirm('Reset everything? This clears all samples and the model.')) return;
            stopLivePreview(); stopCamCapture();
            trained = false; classNamesCopy = [];
            classes = [
                { id: 1, name: 'Pose1', color: '#0ea5e9' },
                { id: 2, name: 'Pose2', color: '#10b981' },
            ];
            nextClassId = 3; classCounts = {}; dataset = [];
            thumbnailStore = {}; thumbnailDatasetIdx = {};
            if (classifier) { classifier.dispose(); classifier = null; }
            resetUsbPanel(); updateButtons();
            setStatus('Page reset. Start fresh!');
            setTrainState(`<div class="state-ready"><div class="icon">🧘</div>
        <h3>Ready to train.</h3>
        <p>Add at least 20 samples per pose<br>then press Train.</p></div>`);
            render();
        }

        // ──────────────────────────────────────────────────────────────
        // DEPLOY TO BLOCKLY
        // ──────────────────────────────────────────────────────────────
        function deployToBlockly() {
            if (!trained) { alert('Train first!'); return; }
            const classNames = classes.map(c => c.name);
            const payload = JSON.stringify({ type: 'POSE_MODEL_TRAINED', classes: classNames });

            // Persist so index.html can read it when user navigates back (standalone mode)
            try { sessionStorage.setItem('curio_pose_trained', JSON.stringify(classNames)); } catch (e) { }

            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent !== window) {
                window.parent.postMessage(payload, '*');
                window.opener?.postMessage(payload, '*');
            }

            setStatus('✅ Pose blocks deployed! Classes: "' + classNames.join('", "') + '" — Click ← Workspace to use them.');
            ['deployHeaderBtn', 'deployCardBtn'].forEach(id => {
                const btn = document.getElementById(id); if (!btn) return;
                const orig = btn.textContent; btn.textContent = '✓ Deployed!'; btn.style.background = '#10b981';
                setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2500);
            });
        }

        // ──────────────────────────────────────────────────────────────
        // DEPLOY TO K230
        // ──────────────────────────────────────────────────────────────
        async function deployToK230() {
            if (!trained || !classifier) { alert('Train first!'); return; }
            const method = document.getElementById('deployMethodInput').value;
            const btn = document.getElementById('deployK230Btn');
            const originalText = btn.innerHTML;

            let usbPort = null;
            if (method === 'usb') {
                if (!SERIAL_SUPPORTED) { alert('WebSerial requires Chrome / Edge v89+.'); return; }
                const baud = parseInt(document.getElementById('usbBaudSelect').value);
                try {
                    usbPort = await navigator.serial.requestPort();
                    await usbPort.open({ baudRate: baud, bufferSize: 32768 });
                } catch (e) {
                    alert('Could not open port: ' + e.message);
                    try { usbPort && await usbPort.close(); } catch { }
                    return;
                }
            }

            btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Deploying...';
            setStatus('Saving model and compiling...');

            try {
                let savedArtifacts = null;
                await classifier.save(
                    tf.io.withSaveHandler(async artifacts => {
                        savedArtifacts = artifacts;
                        return { modelArtifactsInfo: { dateSaved: new Date() } };
                    })
                );
                if (!savedArtifacts) throw new Error('Failed to save model');

                const modelJson = {
                    modelTopology: savedArtifacts.modelTopology,
                    weightsManifest: [{ paths: ['weights.bin'], weights: savedArtifacts.weightSpecs }],
                    format: 'layers-model', generatedBy: 'TensorFlow.js', convertedBy: null
                };
                const formData = new FormData();
                formData.append('model_json',
                    new Blob([JSON.stringify(modelJson)], { type: 'application/json' }), 'model.json');
                formData.append('weights_bin',
                    new Blob([savedArtifacts.weightData], { type: 'application/octet-stream' }), 'weights.bin');
                formData.append('labels', JSON.stringify(classes.map(c => c.name)));

                setStatus('Compiling on backend...');
                const resp = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `${CONVERT_SERVER}/convert-pose`, true);
                    xhr.responseType = 'blob';
                    xhr.onload = async () => {
                        const respObj = {
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            blob: async () => xhr.response,
                            json: async () => JSON.parse(await xhr.response.text()),
                            text: async () => await xhr.response.text(),
                            headers: { get: (name) => xhr.getResponseHeader(name) }
                        };
                        resolve(respObj);
                    };
                    xhr.onerror = () => reject(new Error('Failed to fetch'));
                    xhr.send(formData);
                });
                if (!resp.ok) throw new Error(`Server error ${resp.status}: ${await resp.text()}`);

                setStatus('Unpacking compiled model...');
                const zip = await JSZip.loadAsync(await resp.blob());
                const kmodelFile = zip.file('model.kmodel'), labelsFile = zip.file('labels.txt');
                if (!kmodelFile || !labelsFile) throw new Error('Invalid zip from server');
                const kmodelBlob = await kmodelFile.async('blob');
                const labelsBlob = await labelsFile.async('blob');

                if (method === 'wifi') {
                    const ip = document.getElementById('k230IpInput').value.trim() || '192.168.4.1';
                    const pt = document.getElementById('k230PortInput').value.trim() || '8080';
                    const url = `http://${ip}:${pt}/upload`;
                    setStatus(`Pushing to K230 via Wi-Fi (${ip})...`);
                    try {
                        const r1 = await fetch(url, {
                            method: 'POST',
                            headers: { 'X-Filename': 'pose_model.kmodel' }, body: kmodelBlob
                        });
                        if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
                        await sleep(1500);
                        const r2 = await fetch(url, {
                            method: 'POST',
                            headers: { 'X-Filename': 'pose_labels.txt' }, body: labelsBlob
                        });
                        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                    } catch (pushErr) {
                        alert(`❌ Failed to connect to K230 at ${ip}:${pt}.\nError: ${pushErr.message}`);
                        setStatus('Deploy failed: K230 unreachable.'); return;
                    }
                    setStatus('Wi-Fi deployment complete!');
                    alert(`✅ Pose model deployed via Wi-Fi!\nFiles saved to /sdcard/kmodel/`);

                } else if (method === 'online') {
                    const ip = document.getElementById('onlineIpInput').value.trim();
                    const pt = document.getElementById('onlinePortInput').value.trim() || '8080';
                    if (!ip) { alert('Enter the K230 board IP (use Auto-Detect or Ping to find it).'); setStatus('Deploy failed: no IP.'); return; }
                    const url = `http://${ip}:${pt}/upload`;
                    setStatus(`Pushing to K230 via Online Wi-Fi (${ip})...`);
                    try {
                        const r1 = await fetch(url, {
                            method: 'POST',
                            headers: { 'X-Filename': 'pose_model.kmodel' }, body: kmodelBlob
                        });
                        if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
                        await sleep(1500);
                        const r2 = await fetch(url, {
                            method: 'POST',
                            headers: { 'X-Filename': 'pose_labels.txt' }, body: labelsBlob
                        });
                        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                    } catch (pushErr) {
                        alert(`❌ Failed to connect to K230 at ${ip}:${pt}.\nEnsure K230 is on the same Wi-Fi network (STA mode).\nError: ${pushErr.message}`);
                        setStatus('Deploy failed: K230 unreachable.'); return;
                    }
                    setStatus('Online Wi-Fi deployment complete!');
                    alert(`✅ Pose model deployed via Online Wi-Fi (${ip})!\nFiles saved to /sdcard/kmodel/`);

                } else if (method === 'usb') {
                    const baud = parseInt(document.getElementById('usbBaudSelect').value);
                    resetUsbPanel(); showUsbPanel(true);
                    port = usbPort; portReader = usbPort.readable.getReader();
                    portWriter = usbPort.writable.getWriter(); connected = true; usbPort = null;
                    rxPump(); usbLog(`Port open @ ${baud} baud`, 'ok');
                    try {
                        await enterRawREPL();
                        const kArr = new Uint8Array(await kmodelBlob.arrayBuffer());
                        const lArr = new Uint8Array(await labelsBlob.arrayBuffer());
                        usbLog('Ensuring /sdcard/kmodel/...', 'info');
                        await ensureDir('/sdcard/kmodel/');
                        usbLog('Dir ready', 'ok');
                        usbLog(`Sending pose_model.kmodel → ${(kArr.length / 1024).toFixed(1)} KB`, 'info');
                        await writeFileOnBoard('/sdcard/kmodel/pose_model.kmodel', kArr, pct => {
                            usbSetProgress(1, pct); setStatus(`pose_model.kmodel: ${Math.round(pct * 100)}%`);
                        });
                        usbSetProgress(1, 1); usbLog('pose_model.kmodel ✓', 'ok');
                        usbLog('Sending pose_labels.txt...', 'info');
                        await writeFileOnBoard('/sdcard/kmodel/pose_labels.txt', lArr, pct => {
                            usbSetProgress(2, pct); setStatus(`pose_labels.txt: ${Math.round(pct * 100)}%`);
                        });
                        usbSetProgress(2, 1); usbLog('pose_labels.txt ✓', 'ok');
                        await exitRawREPL(); usbLog('Done', 'ok');
                    } finally { await cleanupPort(); }
                    setStatus('USB deployment complete!');
                    alert('✅ Pose model deployed via USB!\nFiles: /sdcard/kmodel/');
                }

            } catch (e) {
                console.error('Deploy error:', e);
                usbLog('Error: ' + e.message, 'err');
                alert('Deploy Failed: ' + e.message);
                setStatus('Deploy failed: ' + e.message);
                if (connected) await cleanupPort();
                if (usbPort) { try { await usbPort.close(); } catch { } usbPort = null; }
            } finally {
                btn.disabled = false; btn.innerHTML = originalText;
            }
        }

        // ──────────────────────────────────────────────────────────────
        // EXPORT
        // ──────────────────────────────────────────────────────────────
        async function exportKmodel() {
            if (!trained || !classifier) { alert('Train first!'); return; }
            const btn = document.getElementById('exportBtn');
            btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Exporting...';
            setStatus('Exporting pose model...');
            try {
                let savedArtifacts = null;
                await classifier.save(
                    tf.io.withSaveHandler(async artifacts => {
                        savedArtifacts = artifacts;
                        return { modelArtifactsInfo: { dateSaved: new Date() } };
                    })
                );
                if (!savedArtifacts) throw new Error('Failed to save model');
                const modelJson = {
                    modelTopology: savedArtifacts.modelTopology,
                    weightsManifest: [{ paths: ['weights.bin'], weights: savedArtifacts.weightSpecs }],
                    format: 'layers-model', generatedBy: 'TensorFlow.js', convertedBy: null
                };
                const formData = new FormData();
                formData.append('model_json',
                    new Blob([JSON.stringify(modelJson)], { type: 'application/json' }), 'model.json');
                formData.append('weights_bin',
                    new Blob([savedArtifacts.weightData], { type: 'application/octet-stream' }), 'weights.bin');
                formData.append('labels', JSON.stringify(classes.map(c => c.name)));

                setStatus('Sending to backend...');
                const resp = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `${CONVERT_SERVER}/convert-pose`, true);
                    xhr.responseType = 'blob';
                    xhr.onload = async () => {
                        const respObj = {
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            blob: async () => xhr.response,
                            json: async () => JSON.parse(await xhr.response.text()),
                            text: async () => await xhr.response.text(),
                            headers: { get: (name) => xhr.getResponseHeader(name) }
                        };
                        resolve(respObj);
                    };
                    xhr.onerror = () => reject(new Error('Failed to fetch'));
                    xhr.send(formData);
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({ error: 'Server error' }));
                    throw new Error(err.error || `Error ${resp.status}`);
                }

                setStatus('Unpacking files...');
                const zipBlob = await resp.blob(), ct = resp.headers.get('content-type') || '';
                if (ct.includes('zip')) {
                    const zip = await JSZip.loadAsync(zipBlob);
                    const kf = zip.file('model.kmodel'); if (kf) downloadBlob(await kf.async('blob'), 'pose_model.kmodel');
                    await sleep(500);
                    const lf = zip.file('labels.txt'); if (lf) downloadBlob(await lf.async('blob'), 'pose_labels.txt');
                } else {
                    downloadBlob(zipBlob, 'pose_model.kmodel'); await sleep(500);
                    downloadBlob(new Blob([classes.map(c => c.name).join('\n')], { type: 'text/plain' }), 'pose_labels.txt');
                }
                setStatus('pose_model.kmodel and pose_labels.txt downloaded!');
                alert('✅ Two files:\n1. pose_model.kmodel\n2. pose_labels.txt\n\nCopy to /sdcard/kmodel/ on K230.');
            } catch (e) {
                console.error('Export error:', e); alert('Export Failed: ' + e.message); setStatus('Export failed: ' + e.message);
            } finally {
                btn.disabled = false; btn.innerHTML = 'Export .kmodel (Local)';
            }
        }

        // ──────────────────────────────────────────────────────────────
        // NAVIGATION
        // ──────────────────────────────────────────────────────────────
        function goBack() {
            stopLivePreview(); stopCamCapture();
            const payload = JSON.stringify({ type: 'CLOSE_POSE_TRAIN' });
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent !== window) {
                window.parent.postMessage(payload, '*');
                window.opener?.postMessage(payload, '*');
            } else {
                // Standalone browser — pose training is K230-only
                window.location.href = 'train_picker.html';
            }
        }

        // ──────────────────────────────────────────────────────────────
        // INIT
        // ──────────────────────────────────────────────────────────────
        classes.forEach(c => { classCounts[c.name] = 0; });
        render();
        loadBaseModel();
    