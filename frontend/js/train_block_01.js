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


        


        let dynamicBackendUrl = null;
        async function discoverBackend() {
            const input = document.getElementById('backendUrlInput');
            let manualUrl = input?.value?.trim();
            if (manualUrl && !manualUrl.includes('localhost') && !manualUrl.includes('127.0.0.1')) {
                let url = manualUrl.endsWith('/') ? manualUrl.slice(0, -1) : manualUrl;
                localStorage.setItem('backend_url', url);
                return url;
            }

            if (dynamicBackendUrl) return dynamicBackendUrl;
            
            const origin = window.location.origin;
            if (origin && !origin.includes('file://') && !origin.includes('localhost') && !origin.includes('127.0.0.1') && origin !== 'null') {
                return origin;
            }

            let saved = localStorage.getItem('backend_url');
            if (saved && !saved.includes('localhost') && !saved.includes('127.0.0.1')) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000);
                    await fetch(saved + '/health', { method: 'GET', mode: 'no-cors', signal: controller.signal });
                    clearTimeout(timeoutId);
                    dynamicBackendUrl = saved;
                    if (input) input.value = saved;
                    return saved;
                } catch(e) {}
            }
            
            const overlay = document.createElement('div');
            overlay.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:white;z-index:9999;display:flex;align-items:center;justify-content:center;font-size:20px;font-family:sans-serif;">Auto-discovering Docker Backend...</div>';
            document.body.appendChild(overlay);

            return new Promise((resolve) => {
                let found = false;
                let pending = 0;
                let subnets = ['192.168.0', '192.168.1', '192.168.29', '192.168.100', '192.168.137', '172.20.10', '172.25.128'];
                
                for (let subnet of subnets) {
                    for (let i = 1; i < 255; i++) {
                        if (found) break;
                        let url = `http://${subnet}.${i}:5001`;
                        pending++;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 1200);
                        
                        fetch(url + '/health', { method: 'GET', mode: 'no-cors', signal: controller.signal })
                            .then(() => {
                                if (!found) {
                                    found = true;
                                    dynamicBackendUrl = url;
                                    localStorage.setItem('backend_url', url);
                                    if (input) input.value = url;
                                    resolve(url);
                                }
                            })
                            .catch(() => {})
                            .finally(() => {
                                clearTimeout(timeoutId);
                                pending--;
                                if (pending === 0 && !found) {
                                    resolve(null);
                                }
                            });
                    }
                }
            }).finally(() => {
                overlay.remove();
            });
        }

        
        function getBackendUrl() {
            const input = document.getElementById('backendUrlInput');
            let val = input?.value?.trim();
            if (val) return val.endsWith('/') ? val.slice(0, -1) : val;
            return localStorage.getItem('backend_url') || `http://${window.location.hostname}:5001`;
        }

        async function postToBackend(endpoint, formData) {
            const backendUrl = await discoverBackend();
            if (!backendUrl) throw new Error("Could not auto-discover Docker backend on Wi-Fi.");
            const url = `${backendUrl}/${endpoint}`;
            try {
                return await new Promise((resolve, reject) => {
                    let bytesSent = 0;
                    const xhr = new XMLHttpRequest();
                    if (xhr.upload) { xhr.upload.onprogress = (e) => { bytesSent = e.loaded; }; }
                    xhr.open('POST', url, true);
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
                        
                        if (!respObj.ok) {
                            let msg = `Server error ${xhr.status}`;
                            try {
                                const text = await respObj.text();
                                try { msg = JSON.parse(text).error || text; } catch(e){ msg = text; }
                            } catch(e) {}
                            reject(new Error(msg));
                        } else {
                            resolve(respObj);
                        }
                    };
                    xhr.onerror = () => reject(new Error('Failed to fetch (Network/CORS error or WebView Blob bug)'));
                    xhr.send(formData);
                });
            } catch (err) {
                throw new Error(`Backend request failed: ${url} — ${err.message}`);
            }
        }

        const MOBILENET_V3_URL =
            './offline_libs/models/mobilenet/model.json';

        // ── Crop size state (intermediate canvas before model resize) ──
        let CROP_SIZE = 320; // default: balanced

        const CROP_BADGE_MAP = {
             96: { label: 'Tiny', cls: 'badge-96' },
            224: { label: 'Fast', cls: 'badge-224' },
            320: { label: 'Balanced', cls: 'badge-320' },
            480: { label: 'Sharp', cls: 'badge-480' },
        };

        // ── WebSerial constants + state ───────────────────────────────
        const SERIAL_SUPPORTED = 'serial' in navigator;
        const CHUNK_BYTES = 512;
        const ENC = new TextEncoder();
        const DEC = new TextDecoder();
        let port = null, portReader = null, portWriter = null;
        let connected = false, rxBuf = '';

        // ── USB log helpers ───────────────────────────────────────────
        function usbLog(msg, cls = '') {
            const el = document.getElementById('usbLog');
            if (!el) return;
            const line = document.createElement('div');
            if (cls) line.className = cls;
            line.textContent = msg;
            el.appendChild(line);
            el.scrollTop = el.scrollHeight;
        }
        function usbLogClear() { const el = document.getElementById('usbLog'); if (el) el.innerHTML = ''; }
        function usbSetProgress(idx, pct) {
            const p = Math.round(pct * 100);
            const pEl = document.getElementById(`usbFile${idx}Pct`);
            const fEl = document.getElementById(`usbFile${idx}Fill`);
            if (pEl) pEl.textContent = p + '%';
            if (fEl) fEl.style.width = p + '%';
        }
        function showUsbPanel(v) { document.getElementById('usbProgressPanel')?.classList.toggle('visible', v); }
        function resetUsbPanel() { usbSetProgress(1, 0); usbSetProgress(2, 0); usbLogClear(); showUsbPanel(false); }

        // ── Port lifecycle ────────────────────────────────────────────
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
                    const { value, done } = await portReader.read();
                    if (done) break;
                    if (value?.length) rxBuf += DEC.decode(value, { stream: true });
                }
            } catch (e) { if (connected) usbLog('RX error: ' + e.message, 'err'); }
        }
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        async function write(data) {
            if (!portWriter) return;
            await portWriter.write(typeof data === 'string' ? ENC.encode(data) : data);
        }

        // ── Raw REPL helpers ──────────────────────────────────────────
        async function enterRawREPL() {
            usbLog('Entering Raw REPL...', 'info');
            await write('\x03'); await sleep(200);
            await write('\x03'); await sleep(200);
            rxBuf = '';
            await write('\x01'); await sleep(300);
            let banner = '', t = Date.now() + 4000;
            while (Date.now() < t) {
                banner += rxBuf; rxBuf = '';
                if (banner.includes('raw REPL')) { usbLog('Raw REPL ready ✓', 'ok'); rxBuf = ''; return; }
                await sleep(50);
            }
            await write('\x01'); await sleep(500);
            banner += rxBuf; rxBuf = '';
            if (banner.includes('raw REPL')) usbLog('Raw REPL ready ✓', 'ok');
            else usbLog('Raw REPL banner not seen — try resetting board', 'warn');
            rxBuf = '';
        }
        async function exitRawREPL() { await write('\x02'); await sleep(200); }
        async function execPy(code) {
            rxBuf = '';
            await write(code);
            await write('\x04');
            let full = '';
            const dl = Date.now() + 10000;
            while (Date.now() < dl) {
                if (rxBuf.length) {
                    full += rxBuf; rxBuf = '';
                    const oi = full.indexOf('OK');
                    if (oi >= 0) {
                        const after = full.slice(oi + 2);
                        const e1 = after.indexOf('\x04');
                        if (e1 >= 0) {
                            const e2 = after.indexOf('\x04', e1 + 1);
                            if (e2 >= 0) {
                                const stderr = after.slice(e1 + 1, e2).trim();
                                if (stderr) usbLog('stderr: ' + stderr, 'warn');
                                return after.slice(0, e1).trim();
                            }
                        }
                    }
                }
                await sleep(10);
            }
            throw new Error('Timeout. Last rx: ' + full.slice(-40));
        }
        async function ensureDir(path) {
            const p = path.replace(/\/$/, '');
            await execPy(`import os\r\ntry:\r\n os.mkdir('${p}')\r\nexcept:pass`);
        }
        async function writeFileOnBoard(dest, arr, onPct) {
            await execPy(`_f=open('${dest}','wb')`);
            let off = 0;
            while (off < arr.length) {
                const sl = arr.slice(off, off + CHUNK_BYTES);
                const hex = Array.from(sl).map(b => b.toString(16).padStart(2, '0')).join('');
                await execPy(`_f.write(bytes.fromhex('${hex}'))`);
                off += sl.length;
                if (onPct) onPct(off / arr.length);
            }
            await execPy(`_f.close();del _f`);
        }

        // ── Deploy method toggle ──────────────────────────────────────
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

        function updateCropSize(val) {
            CROP_SIZE = parseInt(val);
            const badge = document.getElementById('cropSizeBadge');
            const info = CROP_BADGE_MAP[CROP_SIZE];
            badge.textContent = info.label;
            badge.className = 'crop-size-badge ' + info.cls;
            setStatus(`Capture canvas: ${CROP_SIZE}×${CROP_SIZE}px — model input is always 224×224 (MobileNet V3 requirement).`);
        }

        let classes = [
            { id: 1, name: 'Class1', images: [], color: '#f54254' },
            { id: 2, name: 'Class2', images: [], color: '#7c3aed' },
        ];
        let nextClassId = 3;
        const CLASS_COLORS = [
            '#f54254', '#7c3aed', '#0ea5e9',
            '#10b981', '#f59e0b', '#ec4899',
            '#8b5cf6', '#06b6d4', '#84cc16'
        ];

        let mobileNetV3 = null;
        let headModel = null;
        let classNamesCopy = [];
        let trained = false;

        // ── Session persistence ──────────────────────────────────────────────
        const _STORE_KEY = 'curio_train_state_v1';

        function saveState() {
            try {
                sessionStorage.setItem(_STORE_KEY, JSON.stringify({
                    classes, nextClassId, CROP_SIZE
                }));
            } catch (e) {
                // Quota exceeded — too many images; silently skip
            }
        }

        function loadState() {
            try {
                const raw = sessionStorage.getItem(_STORE_KEY);
                if (!raw) return;
                const s = JSON.parse(raw);
                if (!Array.isArray(s.classes) || s.classes.length === 0) return;
                classes = s.classes;
                nextClassId = s.nextClassId ?? (Math.max(...s.classes.map(c => c.id)) + 1);
                if (s.CROP_SIZE) {
                    CROP_SIZE = s.CROP_SIZE;
                    const sel = document.getElementById('cropSizeSelect');
                    if (sel) sel.value = CROP_SIZE;
                    const badge = document.getElementById('cropSizeBadge');
                    const info = CROP_BADGE_MAP[CROP_SIZE];
                    if (badge && info) { badge.textContent = info.label; badge.className = 'crop-size-badge ' + info.cls; }
                }
            } catch (e) { /* corrupted storage — ignore */ }
        }

        function resetState() {
            if (!confirm('Reset all classes and images? This cannot be undone.')) return;
            sessionStorage.removeItem(_STORE_KEY);
            classes = [
                { id: 1, name: 'Class1', images: [], color: '#f54254' },
                { id: 2, name: 'Class2', images: [], color: '#7c3aed' },
            ];
            nextClassId = 3;
            trained = false;
            headModel = null;
            stopCapture();
            stopK230Capture(false);
            render();
        }

        let activeCamIdx = null;
        let activeCamType = null; // 'webcam'
        let activeCamStream = null;
        let k230CamIdx = null;        // class index using K230 cam
        let k230CamPollTimer = null;  // unused legacy — kept to avoid render errors
        let k230CamPort = '';         // display label for the active COM port
        let k230BrowserPort = null;   // WebSerial port object
        let k230BrowserRunning = false;
        let k230LatestFrame = null;   // blob URL of latest JPEG from K230
        let captureTimer = null;
        let testWebcamActive = false;
        let testTimer = null;

        let THRESHOLD = 0.85;

        // ══════════════════════════════════════════════════════════════
        // THRESHOLD
        // ══════════════════════════════════════════════════════════════
        function updateThreshold(val) {
            THRESHOLD = parseInt(val) / 100;
            document.getElementById('thresholdValue').textContent = val + '%';
        }

        // ══════════════════════════════════════════════════════════════
        // HELPERS
        // ══════════════════════════════════════════════════════════════
        function setStatus(msg) {
            document.getElementById('statusBar').textContent = msg;
        }

        function updateButtons() {
            ['deployHeaderBtn', 'deployCardBtn', 'deployK230Btn', 'exportBtn', 'exportEsp32Btn', 'exportArduinoBtn', 'deployEsp32Btn', 'testBtn']
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.disabled = !trained;
                });
        }

        function downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function isBgClass(name) {
            const n = name.toLowerCase();
            return n.includes('background') || n.includes('bg') ||
                n.includes('nothing') || n.includes('empty');
        }

        // ══════════════════════════════════════════════════════════════
        // BACKGROUND REMOVAL — uses CROP_SIZE for intermediate canvas
        // ══════════════════════════════════════════════════════════════
        function applyBackgroundFade(canvas) {
            // Disabled circular background blur/fade per user request
            return;
        }

        // ── Center-crop source into canvas at CROP_SIZE ──────────────
        function centerCropToCanvas(source, canvas) {
            const ctx = canvas.getContext('2d');
            let srcW, srcH;
            if (source instanceof HTMLVideoElement) {
                srcW = source.videoWidth || CROP_SIZE;
                srcH = source.videoHeight || CROP_SIZE;
            } else {
                srcW = source.naturalWidth || source.width || CROP_SIZE;
                srcH = source.naturalHeight || source.height || CROP_SIZE;
            }
            const cropSize = Math.min(srcW, srcH);
            const srcX = (srcW - cropSize) / 2;
            const srcY = (srcH - cropSize) / 2;
            
            ctx.save();
            if (source instanceof HTMLVideoElement) {
                // Mirror the canvas horizontally to match the mirrored CSS video preview
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            // Draw into canvas at its own size (CROP_SIZE × CROP_SIZE)
            ctx.drawImage(
                source, srcX, srcY, cropSize, cropSize,
                0, 0, canvas.width, canvas.height
            );
            ctx.restore();
        }

        // ── Build a canvas at current CROP_SIZE with crop + fade ──────
        function prepareCanvas(source) {
            const canvas = document.createElement('canvas');
            canvas.width = CROP_SIZE;
            canvas.height = CROP_SIZE;
            centerCropToCanvas(source, canvas);
            applyBackgroundFade(canvas);
            return canvas; // CROP_SIZE × CROP_SIZE
        }

        // ── Convert CROP_SIZE canvas → V3 tensor (always 224×224) ────
        // The resizeBilinear here is the ONLY resize the model ever sees.
        function canvasToV3Tensor(canvas) {
            return tf.tidy(() => {
                return tf.browser.fromPixels(canvas)
                    .resizeBilinear([224, 224]) // model always gets 224×224
                    .toFloat()
                    .div(255.0)
                    .expandDims(0);
            });
        }

        // ══════════════════════════════════════════════════════════════
        // MOBILENET V3
        // ══════════════════════════════════════════════════════════════
        async function loadMobileNetV3() {
            if (mobileNetV3) return mobileNetV3;
            setStatus('Loading MobileNet V3 from TF Hub...');
            mobileNetV3 = await tf.loadGraphModel(
                MOBILENET_V3_URL
            );
            return mobileNetV3;
        }

        async function extractFeaturesAsync(source) {
            if (!mobileNetV3) return null;
            const canvas = prepareCanvas(source);   // CROP_SIZE canvas
            const tensor = canvasToV3Tensor(canvas); // → 224 tensor
            const features = mobileNetV3.execute(tensor);
            tensor.dispose();
            const flat = features.flatten();
            features.dispose();
            return flat;
        }

        async function predictFromElement(el) {
            if (!mobileNetV3 || !headModel) return null;
            const canvas = prepareCanvas(el);
            const tensor = canvasToV3Tensor(canvas);
            const features = mobileNetV3.execute(tensor);
            tensor.dispose();
            const flat = features.flatten().expandDims(0);
            features.dispose();
            const probs = headModel.predict(flat).dataSync();
            flat.dispose();
            return classNamesCopy.map((name, i) => ({
                className: name, probability: probs[i]
            }));
        }

        // ══════════════════════════════════════════════════════════════
        // OUTPUT BARS
        // ══════════════════════════════════════════════════════════════
        function initOutputBars() {
            const container = document.getElementById('outputBars');
            container.innerHTML = classes.map((cls, i) => `
        <div class="output-row" id="output-row-${i}">
            <span class="output-label"
                style="color:${cls.color}"
                id="output-label-${i}">
                ${cls.name}
            </span>
            <div class="output-bar-wrap">
                <div class="output-bar-fill"
                    id="output-bar-${i}"
                    style="width:0%;background:${cls.color}">
                    <span class="output-bar-pct"
                        id="output-pct-${i}"></span>
                </div>
                <span class="output-bar-pct-outside"
                    id="output-pct-out-${i}">0%</span>
            </div>
        </div>
    `).join('');
        }

        function updateOutputBars(predictions) {
            const best = predictions.reduce((a, b) =>
                a.probability > b.probability ? a : b
            );
            const isAbove = best.probability >= THRESHOLD;
            const isBg = isBgClass(best.className);
            const isDetected = isAbove && !isBg;

            predictions.forEach((p, i) => {
                const pct = Math.round(p.probability * 100);
                const barEl = document.getElementById(`output-bar-${i}`);
                const pctEl = document.getElementById(`output-pct-${i}`);
                const pctOutEl = document.getElementById(`output-pct-out-${i}`);
                const labelEl = document.getElementById(`output-label-${i}`);
                if (!barEl) return;

                const cls = classes.find(c => c.name === p.className);
                const color = cls?.color || CLASS_COLORS[i % CLASS_COLORS.length];

                barEl.style.width = pct + '%';
                barEl.style.background = color;

                if (pct > 20) {
                    pctEl.textContent = pct + '%';
                    pctOutEl.textContent = '';
                } else {
                    pctEl.textContent = '';
                    pctOutEl.textContent = pct + '%';
                }

                if (labelEl) {
                    labelEl.textContent = p.className;
                    labelEl.style.color = color;
                }
            });

            updateDetectStatus(best, isDetected, isBg && isAbove);
        }

        function updateDetectStatus(best, isDetected, isBgDetected) {
            const statusEl = document.getElementById('detectStatus');
            const pct = (best.probability * 100).toFixed(1);
            const cls = classes.find(c => c.name === best.className);
            const color = cls?.color || '#f54254';

            if (isDetected) {
                statusEl.style.background = color + '14';
                statusEl.style.borderBottom = `2px solid ${color}30`;
                statusEl.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;
                background:${color};display:flex;
                align-items:center;justify-content:center;
                font-size:18px;flex-shrink:0;">✅</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:15px;font-weight:800;
                    color:${color};white-space:nowrap;
                    overflow:hidden;text-overflow:ellipsis;">
                    ${best.className}
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:1px;">
                    Detected — ${pct}% confidence
                </div>
            </div>
            <div style="font-size:22px;font-weight:900;
                color:${color};flex-shrink:0;">
                ${Math.round(best.probability * 100)}%
            </div>`;
            } else if (isBgDetected) {
                statusEl.style.background = '#fafafa';
                statusEl.style.borderBottom = '2px dashed #e2e8f0';
                statusEl.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;
                background:#f1f5f9;display:flex;
                align-items:center;justify-content:center;
                font-size:18px;flex-shrink:0;">🌄</div>
            <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;color:#64748b;">
                    No Object Detected</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:1px;">
                    Background — ${pct}%</div>
            </div>`;
            } else {
                statusEl.style.background = '#fafafa';
                statusEl.style.borderBottom = '1px solid #f1f5f9';
                statusEl.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;
                background:#f1f5f9;display:flex;
                align-items:center;justify-content:center;
                font-size:18px;flex-shrink:0;">🔍</div>
            <div style="flex:1;">
                <div style="font-size:14px;font-weight:700;color:#94a3b8;">
                    Not Detected</div>
                <div style="font-size:11px;color:#cbd5e1;margin-top:1px;">
                    Best: ${best.className} at ${pct}%
                    (need ${Math.round(THRESHOLD * 100)}%)
                </div>
            </div>`;
            }
        }

        function resetDetectStatus() {
            const statusEl = document.getElementById('detectStatus');
            statusEl.style.background = '#fafafa';
            statusEl.style.borderBottom = '1px solid #f1f5f9';
            statusEl.innerHTML = `
        <div style="width:36px;height:36px;border-radius:50%;
            background:#f1f5f9;display:flex;
            align-items:center;justify-content:center;
            font-size:18px;flex-shrink:0;">🔍</div>
        <div>
            <div style="font-size:13px;font-weight:700;color:#94a3b8;">
                Not Detected</div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:1px;">
                Start webcam to preview</div>
        </div>`;
            classes.forEach((cls, i) => {
                const b = document.getElementById(`output-bar-${i}`);
                const p = document.getElementById(`output-pct-${i}`);
                const o = document.getElementById(`output-pct-out-${i}`);
                if (b) b.style.width = '0%';
                if (p) p.textContent = '';
                if (o) o.textContent = '0%';
            });
        }

        // ══════════════════════════════════════════════════════════════
        // RENDER
        // ══════════════════════════════════════════════════════════════
        function render() {
            renderClasses();
            renderStats();
            initOutputBars();
            saveState();
        }

        function renderClasses() {
            const container = document.getElementById('classList');
            container.innerHTML = '';

            classes.forEach((cls, idx) => {
                const card = document.createElement('div');
                card.className = 'class-card';
                card.style.borderLeftColor = cls.color;

                const isBg = isBgClass(cls.name);

                const thumbsHtml = cls.images.map((img, imgIdx) => `
            <div class="thumb-wrap">
                <img src="${img.url}" alt="sample"/>
                <button class="thumb-del"
                    onclick="removeImage(${idx},${imgIdx})">✕</button>
            </div>`).join('');

                const camHtml = activeCamIdx === idx ? `
            <div class="video-wrap">
                <video id="liveVideo" class="live-video" autoplay playsinline muted></video>
                <div class="crop-overlay"></div>
            </div>
            <div style="font-size:11px;color:#64748b;
                text-align:center;margin-bottom:6px;">
                📐 Full square crop &nbsp;·&nbsp;
                <b>${CROP_SIZE}×${CROP_SIZE}px</b>
            </div>
            <div class="cam-btns">
                <button class="hold-btn"
                    style="background:${cls.color}"
                    onmousedown="startHold(${idx})"
                    onmouseup="stopHold()"
                    onmouseleave="stopHold()"
                    ontouchstart="startHold(${idx})"
                    ontouchend="stopHold()"
                >Hold to Capture</button>
                <button class="burst-btn" id="burst-btn-${idx}"
                    onclick="burstCapture(${idx})">📸 Capture 50</button>
                <button class="stop-cam-btn"
                    onclick="stopCapture()">Stop</button>
            </div>` : k230CamIdx === idx ? `
            <div class="video-wrap">
                <img id="k230LiveImg-${idx}" class="live-video"
                    style="object-fit:contain;" src="" alt="K230 stream"/>
                <div class="crop-overlay"></div>
            </div>
            <div style="font-size:11px;color:#64748b;
                text-align:center;margin-bottom:6px;">
                📡 K230 Cam (${k230CamPort}) &nbsp;·&nbsp; <b>${CROP_SIZE}×${CROP_SIZE}px</b> square crop
            </div>
            <div class="cam-btns">
                <button class="hold-btn"
                    style="background:${cls.color}"
                    onmousedown="startK230Hold(${idx})"
                    onmouseup="stopK230Hold()"
                    onmouseleave="stopK230Hold()"
                    ontouchstart="startK230Hold(${idx})"
                    ontouchend="stopK230Hold()"
                >Hold to Capture</button>
                <button class="burst-btn" id="burst-k230-btn-${idx}"
                    onclick="burstK230Capture(${idx})">📸 Capture 50</button>
                <button class="stop-cam-btn"
                    onclick="stopK230Capture()">Stop</button>
            </div>` : `
            <div class="add-btns">
                <button class="add-btn"
                    style="color:${cls.color};
                           border-color:${cls.color};
                           background:${cls.color}18"
                    onclick="startCapture(${idx})"
                >📷 Webcam</button>
                <button class="add-btn"
                    style="color:${cls.color};
                           border-color:${cls.color};
                           background:${cls.color}18"
                    onclick="startK230Capture(${idx})"
                >🔌 K230 USB</button>
                <button class="add-btn"
                    style="color:${cls.color};
                           border-color:${cls.color};
                           background:${cls.color}18"
                    onclick="uploadImages(${idx})"
                >⬆ Upload</button>
            </div>
            ${isBg ? `
            <div style="font-size:11px;color:#92400e;
                background:#fffbeb;border-radius:6px;
                padding:6px 10px;margin-top:4px;">
                🌄 Point at empty room — no objects in frame
            </div>` : ''}`;

                card.innerHTML = `
            <div class="class-header">
                <input class="class-name"
                    style="color:${cls.color}"
                    value="${cls.name}"
                    onchange="renameClass(${idx}, this.value)"
                    oninput="renameClass(${idx}, this.value)"/>
                <span class="sample-count" id="count-${idx}">
                    ${cls.images.length} samples
                </span>
                <button class="class-dl-btn" id="dl-btn-${idx}" onclick="downloadClassZip(${idx})" title="Download images" ${cls.images.length === 0 ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : ''}>⬇ ZIP</button>
                <button class="remove-btn"
                    onclick="removeClass(${idx})">✕</button>
            </div>
            ${isBg ? `
            <div style="display:flex;align-items:center;
                gap:4px;margin-bottom:8px;">
                <span style="font-size:10px;font-weight:700;
                    color:#92400e;background:#fef3c7;
                    padding:2px 8px;border-radius:10px;">
                    🌄 BACKGROUND CLASS
                </span>
            </div>` : ''}
            ${camHtml}
            <div class="thumbs" id="thumbs-${idx}">
                ${thumbsHtml}
            </div>`;

                container.appendChild(card);

                if (activeCamIdx === idx && activeCamStream) {
                    requestAnimationFrame(() => {
                        const v = document.getElementById('liveVideo');
                        if (v && !v.srcObject) {
                            v.srcObject = activeCamStream;
                            v.play().catch(() => { });
                        }
                    });
                }
            });
        }

        function renderStats() {
            document.getElementById('statsList').innerHTML =
                classes.map(cls => `
            <div class="stat-row">
                <div class="stat-dot" style="background:${cls.color}"></div>
                <span class="stat-name">${cls.name}</span>
                <span class="stat-count">${cls.images.length}</span>
            </div>`).join('');

        }

        async function downloadClassZip(idx) {
            const cls = classes[idx];
            if (!cls || cls.images.length === 0) { alert('No images in this class.'); return; }

            setStatus(`Packing ${cls.images.length} images from "${cls.name}"…`);
            try {
                const zip = new JSZip();
                cls.images.forEach((img, i) => {
                    const base64 = img.url.includes(',') ? img.url.split(',')[1] : img.url;
                    zip.file(`${String(i + 1).padStart(4, '0')}.jpg`, base64, { base64: true });
                });

                const blob = await zip.generateAsync(
                    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
                    meta => setStatus(`Compressing "${cls.name}"… ${meta.percent.toFixed(0)}%`)
                );

                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${cls.name}_images.zip`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                setStatus(`Downloaded ${cls.images.length} images for "${cls.name}".`);
            } catch (e) {
                setStatus('Download failed: ' + e.message);
            }
        }

        // ══════════════════════════════════════════════════════════════
        // CLASS MANAGEMENT
        // ══════════════════════════════════════════════════════════════
        function addClass() {
            const id = nextClassId++;
            classes.push({
                id, name: `Class${id}`, images: [],
                color: CLASS_COLORS[(id - 1) % CLASS_COLORS.length]
            });
            render();
        }

        function addBackgroundClass() {
            const exists = classes.find(c => isBgClass(c.name));
            if (exists) { alert('Background class already exists!'); return; }
            const id = nextClassId++;
            classes.push({ id, name: 'Background', images: [], color: '#94a3b8' });
            render();
            setStatus('Background class added! Point camera at empty room and capture 100+ images.');
        }

        function removeClass(idx) {
            if (classes.length <= 2) { alert('Need at least 2 classes'); return; }
            if (activeCamIdx === idx) stopCapture();
            classes.splice(idx, 1);
            render();
        }

        function renameClass(idx, name) {
            const oldName = classes[idx].name;
            if (oldName === name) return;
            classes[idx].name = name;
            renderStats();
            const labelEl = document.getElementById(`output-label-${idx}`);
            if (labelEl) labelEl.textContent = name;
        }

        function removeImage(classIdx, imgIdx) {
            classes[classIdx].images.splice(imgIdx, 1);
            const countEl = document.getElementById(`count-${classIdx}`);
            if (countEl) countEl.textContent = `${classes[classIdx].images.length} samples`;
            const thumbs = document.getElementById(`thumbs-${classIdx}`);
            if (thumbs) {
                thumbs.innerHTML = classes[classIdx].images.map((img, idx) => `
            <div class="thumb-wrap">
                <img src="${img.url}" alt="sample"/>
                <button class="thumb-del"
                    onclick="removeImage(${classIdx},${idx})">✕</button>
            </div>`).join('');
            }
            renderStats();
            saveState();
        }

        // ══════════════════════════════════════════════════════════════
        // WEBCAM CAPTURE
        // ══════════════════════════════════════════════════════════════
        async function startCapture(classIdx) {
            try {
                if (activeCamIdx !== null) stopCapture();
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 320, facingMode: 'user' }
                });
                activeCamStream = stream;
                activeCamIdx = classIdx;
                activeCamType = 'webcam';
                render();
                requestAnimationFrame(() => {
                    const v = document.getElementById('liveVideo');
                    if (v) {
                        v.srcObject = stream;
                        v.play().catch(e => console.warn('play:', e));
                    }
                });
            } catch (e) { alert('Camera Error: ' + e.message); }
        }

        function captureFrame(classIdx) {
            let sourceEl = null;
            if (activeCamType === 'webcam') {
                sourceEl = document.getElementById('liveVideo');
                if (!sourceEl || sourceEl.readyState < 2) return;
            } else {
                return;
            }

            // Use CROP_SIZE for the intermediate canvas
            const canvas = document.createElement('canvas');
            canvas.width = CROP_SIZE;
            canvas.height = CROP_SIZE;

            centerCropToCanvas(sourceEl, canvas);
            applyBackgroundFade(canvas);

            // Black-frame guard (sample 8×8 area scaled to canvas size)
            const sampleSize = Math.min(8, CROP_SIZE);
            const px = canvas.getContext('2d')
                .getImageData(0, 0, sampleSize, sampleSize).data;
            if (Array.from(px).every(v => v < 15)) return;

            const url = canvas.toDataURL('image/jpeg', 0.8);
            classes[classIdx].images.push({ url });

            const thumbs = document.getElementById(`thumbs-${classIdx}`);
            if (thumbs) {
                const imgIdx = classes[classIdx].images.length - 1;
                const wrap = document.createElement('div');
                wrap.className = 'thumb-wrap';
                wrap.innerHTML = `
            <img src="${url}" alt="sample"/>
            <button class="thumb-del"
                onclick="removeImage(${classIdx},${imgIdx})">✕</button>`;
                thumbs.appendChild(wrap);
            }

            const countEl = document.getElementById(`count-${classIdx}`);
            if (countEl) countEl.textContent = `${classes[classIdx].images.length} samples`;

            const dlBtn = document.getElementById(`dl-btn-${classIdx}`);
            if (dlBtn) { dlBtn.disabled = false; dlBtn.style.opacity = ''; dlBtn.style.cursor = ''; }

            renderStats();
            saveState();
        }

        function startHold(classIdx) {
            captureFrame(classIdx);
            captureTimer = setInterval(() => captureFrame(classIdx), 120);
        }

        function stopHold() {
            clearInterval(captureTimer);
            captureTimer = null;
        }

        let burstRunning = false;
        async function burstCapture(classIdx, total = 50) {
            if (burstRunning) return;
            if (activeCamType !== 'webcam' || activeCamIdx !== classIdx) return;
            burstRunning = true;
            const btn = document.getElementById(`burst-btn-${classIdx}`);
            if (btn) btn.disabled = true;

            for (let i = 0; i < total; i++) {
                if (activeCamType !== 'webcam' || activeCamIdx !== classIdx) break;
                captureFrame(classIdx);
                if (btn) btn.textContent = `📸 ${i + 1}/${total}`;
                await new Promise(r => setTimeout(r, 120));
            }

            if (btn) { btn.disabled = false; btn.textContent = '📸 Capture 50'; }
            burstRunning = false;
        }

        function stopCapture() {
            stopHold();
            if (activeCamStream) {
                activeCamStream.getTracks().forEach(t => t.stop());
                activeCamStream = null;
            }
            activeCamIdx = null;
            activeCamType = null;
            render();
        }

        // ══════════════════════════════════════════════════════════════
        // K230 CAMERA — WebSerial (runs in browser, each user uses their own K230)
        // ══════════════════════════════════════════════════════════════

        function _k230Delay(ms) { return new Promise(r => setTimeout(r, ms)); }

        async function startK230Capture(idx) {
            if (!('serial' in navigator)) {
                alert('Your browser does not support WebSerial.\nPlease use Chrome or Edge to connect a local K230.');
                return;
            }
            try {
                stopK230Capture(false);

                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 115200 });

                k230BrowserPort = port;
                k230BrowserRunning = true;
                k230CamIdx = idx;
                k230CamPort = 'Local';
                render();
                setStatus('K230 connecting… first frame may take ~10 s (board boot).');

                _k230BrowserLoop(port, idx).catch(e => {
                    if (k230BrowserRunning) setStatus('K230 error: ' + e.message);
                    stopK230Capture();
                });

            } catch (e) {
                if (e.name === 'NotFoundError') { k230CamIdx = null; render(); return; }
                alert('K230 Error: ' + e.message);
                k230CamIdx = null;
                render();
            }
        }

        async function _k230BrowserLoop(port, idx) {
            const enc = new TextEncoder();
            const dec = new TextDecoder();

            // Interrupt any running script
            { const w = port.writable.getWriter(); await w.write(new Uint8Array([0x03, 0x03])); w.releaseLock(); }
            await _k230Delay(600);
            for (let i = 0; i < 4 && k230BrowserRunning; i++) {
                const w = port.writable.getWriter(); await w.write(new Uint8Array([0x03])); w.releaseLock();
                await _k230Delay(200);
            }
            // Enter raw REPL
            { const w = port.writable.getWriter(); await w.write(new Uint8Array([0x01])); w.releaseLock(); }
            await _k230Delay(500);

            // Inject camera script (identical to the server-side script)
            const script = [
                '\r\nimport time, gc',
                'try:',
                '    import ubinascii as binascii',
                'except:',
                '    import binascii',
                'try:',
                '    from media.sensor import *',
                '    from media.media import MediaManager',
                'except Exception as e:',
                "    print('INIT_ERR:import:' + str(e))",
                '    raise SystemExit',
                "try:",
                "    if 'sensor' in globals():",
                "        try: sensor.stop()",
                "        except: pass",
                "except: pass",
                "try: MediaManager.deinit()",
                "except: pass",
                "time.sleep(0.3)",
                "try:",
                "    sensor = Sensor()",
                "    sensor.reset()",
                "except:",
                "    pass",
                "try:",
                "    sensor.set_framesize(width=320, height=240, chn=CAM_CHN_ID_0)",
                "    sensor.set_pixformat(PIXEL_FORMAT_RGB_565, chn=CAM_CHN_ID_0)",
                "    _use_chn = True",
                "except Exception:",
                "    sensor.set_framesize(width=320, height=240)",
                "    sensor.set_pixformat(Sensor.RGB565)",
                "    _use_chn = False",
                "MediaManager.init()",
                "sensor.run()",
                "time.sleep(0.5)",
                "print('CAM_READY')",
                "while True:",
                "    try:",
                "        img = sensor.snapshot(chn=CAM_CHN_ID_0) if _use_chn else sensor.snapshot()",
                "        try:",
                "            img_bytes = bytes(img.compress(quality=50))",
                "        except Exception:",
                "            img_bytes = bytes(img.to_jpeg(quality=50))",
                "        print('IMG_START:' + binascii.b2a_base64(img_bytes).decode('utf-8').strip() + ':IMG_END')",
                "        gc.collect()",
                "    except Exception as e:",
                "        print('FRAME_ERR:' + str(e))",
                "        time.sleep(0.5)",
                ""
            ].join('\n');

            {
                const w = port.writable.getWriter();
                await w.write(enc.encode(script));
                await w.write(new Uint8Array([0x04]));
                w.releaseLock();
            }

            // Read loop — parse IMG_START:...:IMG_END frames
            let buf = '';
            while (k230BrowserRunning && port.readable) {
                const reader = port.readable.getReader();
                try {
                    while (k230BrowserRunning) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buf += dec.decode(value, { stream: true });

                        let endIdx;
                        while ((endIdx = buf.indexOf(':IMG_END')) !== -1) {
                            const startIdx = buf.indexOf('IMG_START:');
                            if (startIdx !== -1 && startIdx < endIdx) {
                                const b64 = buf.slice(startIdx + 10, endIdx);
                                buf = buf.slice(endIdx + 8);
                                try {
                                    const binary = atob(b64);
                                    const bytes = new Uint8Array(binary.length);
                                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                                    const blob = new Blob([bytes], { type: 'image/jpeg' });
                                    const url = URL.createObjectURL(blob);
                                    const imgEl = document.getElementById(`k230LiveImg-${idx}`);
                                    if (imgEl) { if (imgEl.src.startsWith('blob:')) URL.revokeObjectURL(imgEl.src); imgEl.src = url; }
                                    if (k230LatestFrame) URL.revokeObjectURL(k230LatestFrame);
                                    k230LatestFrame = url;
                                    setStatus('K230 Cam live. Hold to Capture to collect images.');
                                } catch { /* bad frame, skip */ }
                            } else {
                                buf = buf.slice(endIdx + 8);
                            }
                            if (buf.length > 300000) buf = '';
                        }

                        if (buf.includes('CAM_READY')) { setStatus('K230 camera ready…'); buf = buf.replace(/CAM_READY/g, ''); }
                        if (buf.includes('BOOT_OK'))   { setStatus('K230 booted, starting camera…'); buf = buf.replace(/BOOT_OK/g, ''); }
                        if (buf.includes('INIT_ERR'))  { setStatus('K230 camera init error — check hardware.'); }
                    }
                } catch (e) {
                    if (k230BrowserRunning) throw e;
                } finally {
                    reader.releaseLock();
                }
            }
        }

        function stopK230Capture(doRender = true) {
            k230BrowserRunning = false;
            if (k230BrowserPort) {
                (async () => {
                    try { const w = k230BrowserPort.writable.getWriter(); await w.write(new Uint8Array([0x03, 0x02])); w.releaseLock(); } catch {}
                    try { await k230BrowserPort.close(); } catch {}
                })();
                k230BrowserPort = null;
            }
            if (k230LatestFrame) { URL.revokeObjectURL(k230LatestFrame); k230LatestFrame = null; }
            clearInterval(k230CamPollTimer);
            k230CamPollTimer = null;
            k230CamIdx = null;
            k230CamPort = '';
            if (doRender) render();
        }

        let k230HoldTimer = null;
        function startK230Hold(idx) { k230CaptureFrame(idx); k230HoldTimer = setInterval(() => k230CaptureFrame(idx), 150); }
        function stopK230Hold() { clearInterval(k230HoldTimer); k230HoldTimer = null; }

        let burstK230Running = false;
        async function burstK230Capture(idx, total = 50) {
            if (burstK230Running) return;
            if (k230CamIdx !== idx) return;
            burstK230Running = true;
            const btn = document.getElementById(`burst-k230-btn-${idx}`);
            if (btn) btn.disabled = true;

            for (let i = 0; i < total; i++) {
                if (k230CamIdx !== idx) break;
                k230CaptureFrame(idx);
                if (btn) btn.textContent = `📸 ${i + 1}/${total}`;
                await new Promise(r => setTimeout(r, 150));
            }

            if (btn) { btn.disabled = false; btn.textContent = '📸 Capture 50'; }
            burstK230Running = false;
        }

        async function k230CaptureFrame(idx) {
            if (!k230LatestFrame) return;
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = CROP_SIZE;
                canvas.height = CROP_SIZE;
                centerCropToCanvas(img, canvas);
                applyBackgroundFade(canvas);
                const finalUrl = canvas.toDataURL('image/jpeg', 0.8);
                classes[idx].images.push({ url: finalUrl });
                const thumbs = document.getElementById(`thumbs-${idx}`);
                if (thumbs) {
                    const ii = classes[idx].images.length - 1;
                    const w = document.createElement('div');
                    w.className = 'thumb-wrap';
                    w.innerHTML = `<img src="${finalUrl}" alt="sample"/>
                        <button class="thumb-del" onclick="removeImage(${idx},${ii})">✕</button>`;
                    thumbs.appendChild(w);
                }
                const ce = document.getElementById(`count-${idx}`);
                if (ce) ce.textContent = `${classes[idx].images.length} samples`;
                const db = document.getElementById(`dl-btn-${idx}`);
                if (db) { db.disabled = false; db.style.opacity = ''; db.style.cursor = ''; }
                renderStats();
                saveState();
            };
            img.src = k230LatestFrame;
        }

        function uploadImages(classIdx) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = (e) => {
                const files = Array.from(e.target.files);
                let done = 0;
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        classes[classIdx].images.push({ url: ev.target.result });
                        done++;
                        if (done === files.length) render(); // render once all loaded
                    };
                    reader.readAsDataURL(file);
                });
            };
            input.click();
        }

        // ══════════════════════════════════════════════════════════════
        // TRAIN
        // ══════════════════════════════════════════════════════════════
        function setTrainState(html) {
            document.getElementById('trainStateBox').innerHTML = html;
        }

        async function trainModel() {
            const valid = classes.filter(c => c.images.length >= 2);
            if (valid.length < 2) {
                alert('Add at least 2 images to each class');
                return;
            }

            document.getElementById('trainBtn').disabled = true;
            trained = false;
            mobileNetV3 = null;
            headModel = null;
            classNamesCopy = [];
            updateButtons();

            const showProgress = (pct, msg) => {
                setTrainState(`
            <div class="state-progress">
                <div class="progress-pct">${pct}%</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="progress-label">${msg}</div>
            </div>`);
                setStatus(msg);
            };

            try {
                showProgress(0, 'Loading TensorFlow...');
                await tf.ready();

                showProgress(5, 'Loading MobileNet V3 from TF Hub...');
                showProgress(6, 'This may take 15-30 seconds...');

                mobileNetV3 = await tf.loadGraphModel(
                    MOBILENET_V3_URL
                );

                showProgress(12, 'Initializing V3 model...');
                const testTensor = tf.zeros([1, 224, 224, 3]);
                const testOutput = mobileNetV3.execute(testTensor);
                const featureSize = testOutput.shape[testOutput.shape.length - 1];
                testTensor.dispose();
                testOutput.dispose();

                // ── Extract features ── (uses CROP_SIZE via prepareCanvas)
                showProgress(15, `Extracting features (crop: ${CROP_SIZE}px)...`);

                const xs = [], ys = [];
                let done = 0;
                const total = classes.reduce((s, c) => s + c.images.length, 0);

                for (let ci = 0; ci < classes.length; ci++) {
                    for (const img of classes[ci].images) {
                        await new Promise((resolve) => {
                            const el = new Image();
                            el.crossOrigin = 'anonymous';
                            el.onload = async () => {
                                try {
                                    const feat = await extractFeaturesAsync(el);
                                    if (feat) { xs.push(feat); ys.push(ci); }
                                } catch (err) {
                                    console.warn('Feature error:', err);
                                }
                                done++;
                                showProgress(
                                    Math.round(15 + (done / total) * 35),
                                    `Extracting ${done}/${total}...`
                                );
                                resolve();
                            };
                            el.onerror = () => { done++; resolve(); };
                            el.src = img.url;
                        });
                    }
                }

                if (xs.length === 0) throw new Error('No features extracted');

                showProgress(52, 'Building classifier...');

                const numClasses = classes.length;
                const xsTensor = tf.stack(xs);
                const ysTensor = tf.oneHot(tf.tensor1d(ys, 'int32'), numClasses);
                xs.forEach(x => x.dispose());

                headModel = tf.sequential({
                    layers: [
                        tf.layers.dense({
                            inputShape: [featureSize], units: 128, activation: 'relu'
                        }),
                        tf.layers.dropout({ rate: 0.3 }),
                        tf.layers.dense({ units: 64, activation: 'relu' }),
                        tf.layers.dense({ units: numClasses, activation: 'softmax' })
                    ]
                });

                headModel.compile({
                    optimizer: tf.train.adam(0.0005),
                    loss: 'categoricalCrossentropy',
                    metrics: ['accuracy']
                });

                showProgress(55, 'Training...');

                await headModel.fit(xsTensor, ysTensor, {
                    epochs: 80,
                    batchSize: 16,
                    validationSplit: 0.1,
                    callbacks: {
                        onEpochEnd: (epoch, logs) => {
                            const pct = 55 + Math.round(((epoch + 1) / 80) * 45);
                            const acc = logs?.acc
                                ? ` acc:${(logs.acc * 100).toFixed(0)}%` : '';
                            const val = logs?.val_acc
                                ? ` val:${(logs.val_acc * 100).toFixed(0)}%` : '';
                            showProgress(pct, `Epoch ${epoch + 1}/80${acc}${val}`);
                        }
                    }
                });

                xsTensor.dispose();
                ysTensor.dispose();

                classNamesCopy = classes.map(c => c.name);
                trained = true;

                showProgress(100, 'Training complete!');
                setStatus(`Training complete! Crop: ${CROP_SIZE}px. Start webcam to preview.`);

                const totalImages = classes.reduce((s, c) => s + c.images.length, 0);
                setTrainState(`
            <div class="state-done">
                <div class="icon">✅</div>
                <h3>Model Trained!</h3>
                <p>${totalImages} images · ${classes.length} classes</p>
                <p style="font-size:11px;color:#64748b;margin-top:2px;">
                    Crop size used: <b>${CROP_SIZE}×${CROP_SIZE}px</b>
                </p>
                <p style="font-size:11px;
                    background:linear-gradient(135deg,#7c3aed,#0ea5e9);
                    -webkit-background-clip:text;
                    -webkit-text-fill-color:transparent;
                    margin-top:4px;font-weight:700;">
                    MobileNet V3 — best accuracy
                </p>
                <button class="retrain-btn" onclick="resetTrain()">Retrain</button>
            </div>`);

                initOutputBars();
                updateButtons();

            } catch (e) {
                console.error('Training error:', e);
                alert('Training Failed: ' + e.message);
                setStatus('Training failed: ' + e.message);
                setTrainState(`
            <div class="state-ready">
                <div class="icon">🧠</div>
                <h3>Ready to train.</h3>
                <p>Add at least 2 images per class<br>then press Train.</p>
            </div>`);
            } finally {
                document.getElementById('trainBtn').disabled = false;
            }
        }

        function resetTrain() {
            trained = false;
            mobileNetV3 = null;
            headModel = null;
            classNamesCopy = [];
            updateButtons();
            setTrainState(`
        <div class="state-ready">
            <div class="icon">🧠</div>
            <h3>Ready to train.</h3>
            <p>Add at least 2 images per class<br>then press Train.</p>
        </div>`);
            setStatus('');
            initOutputBars();
            resetDetectStatus();
        }

        // ══════════════════════════════════════════════════════════════
        // TEST WEBCAM
        // ══════════════════════════════════════════════════════════════
        async function toggleTestWebcam() {
            if (testWebcamActive) { stopTestWebcam(); return; }
            if (!trained || !mobileNetV3 || !headModel) {
                alert('Train first!'); return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 320 }
                });

                const video = document.getElementById('testVideo');
                const placeholder = document.getElementById('camPlaceholder');

                video.srcObject = stream;
                video.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
                await video.play();

                testWebcamActive = true;
                document.getElementById('testBtn').textContent = '■ Stop';

                testTimer = setInterval(async () => {
                    const v = document.getElementById('testVideo');
                    if (!v || v.readyState < 2) return;
                    if (!mobileNetV3 || !headModel) return;
                    try {
                        const predictions = await predictFromElement(v);
                        if (predictions) updateOutputBars(predictions);
                    } catch (err) {
                        console.warn('Predict error:', err);
                    }
                }, 300);

            } catch (e) { alert('Camera Error: ' + e.message); }
        }

        function stopTestWebcam() {
            clearInterval(testTimer);
            const video = document.getElementById('testVideo');
            const placeholder = document.getElementById('camPlaceholder');
            if (video?.srcObject) {
                video.srcObject.getTracks().forEach(t => t.stop());
                video.srcObject = null;
                video.style.display = 'none';
            }
            if (placeholder) placeholder.style.display = 'flex';
            testWebcamActive = false;
            document.getElementById('testBtn').textContent = 'Start Webcam';
            resetDetectStatus();
        }

        // ══════════════════════════════════════════════════════════════
        // DEPLOY TO BLOCKLY
        // ══════════════════════════════════════════════════════════════
        function deployToBlockly() {
            if (!trained) { alert('Train first!'); return; }
            const classNames = classes
                .filter(c => c.images.length > 0).map(c => c.name);
            const payload = JSON.stringify({
                type: 'AI_MODEL_TRAINED', classes: classNames
            });

            // Always persist so index.html can read it when user navigates back
            sessionStorage.setItem('curio_ai_trained', JSON.stringify(classNames));

            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent !== window) {
                // Inside iframe — tell the host directly
                window.parent.postMessage(payload, '*');
                window.opener?.postMessage(payload, '*');
            }
            // Stay on this page — show success status
            setStatus(`✅ AI blocks deployed for: ${classNames.join(', ')}. Click ← Workspace to use them.`);
        }

        // ══════════════════════════════════════════════════════════════
        // DEPLOY TO K230
        // ══════════════════════════════════════════════════════════════
        async function deployToK230() {
            if (!trained || !headModel) { alert('Train first!'); return; }

            const method = document.getElementById('deployMethodInput').value;
            const btn = document.getElementById('deployK230Btn');
            const originalText = btn.innerHTML;

            // USB: grab port NOW — must be the first await to stay within the user gesture
            let usbPort = null;
            if (method === 'usb') {
                if (!SERIAL_SUPPORTED) { alert('WebSerial requires Chrome / Edge v89+ on desktop.'); return; }
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
            setStatus('Converting model (this may take 1–2 minutes)...');

            try {
                // 1. Capture model artifacts
                let savedArtifacts = null;
                await headModel.save(tf.io.withSaveHandler(async artifacts => {
                    savedArtifacts = artifacts;
                    return { modelArtifactsInfo: { dateSaved: new Date() } };
                }));
                if (!savedArtifacts) throw new Error('Failed to capture artifacts');

                const modelJson = {
                    modelTopology: savedArtifacts.modelTopology,
                    weightsManifest: [{ paths: ['weights.bin'], weights: savedArtifacts.weightSpecs }],
                    format: 'layers-model', generatedBy: 'TensorFlow.js', convertedBy: null
                };
                const formData = new FormData();
                formData.append('model_json', new Blob([JSON.stringify(modelJson)], { type: 'application/json' }), 'model.json');
                formData.append('weights_bin', new Blob([savedArtifacts.weightData], { type: 'application/octet-stream' }), 'weights.bin');
                formData.append('labels', JSON.stringify(classes.map(c => c.name)));

                // 2. Compile on backend
                btn.innerHTML = '<span class="spinner"></span>Converting...';
                setStatus('Converting: sending model to backend for ONNX → .kmodel (1–2 min)...');
                console.log('[DEPLOY] Backend URL:', await discoverBackend());
                console.log('[DEPLOY] Sending to:', (await discoverBackend()) + '/convert');
                
                const resp = await postToBackend('convert', formData);

                console.log('[DEPLOY] Backend response received. Unpacking...');
                setStatus('Converting: unpacking compiled model from backend...');
                const zip = await JSZip.loadAsync(await resp.blob());
                const kmodelFile = zip.file('model.kmodel'), labelsFile = zip.file('labels.txt');
                if (!kmodelFile || !labelsFile) throw new Error('Invalid zip from server');
                const kmodelBlob = await kmodelFile.async('blob');
                const labelsBlob = await labelsFile.async('blob');

                console.log('[DEPLOY] Backend model received. Proceeding to K230...');

                // 3a. Wi-Fi deploy
                if (method === 'wifi') {
                    const ip = document.getElementById('k230IpInput').value.trim() || '192.168.4.1';
                    const pt = document.getElementById('k230PortInput').value.trim() || '8080';
                    const url = `http://${ip}:${pt}/upload`;
                    setStatus(`Pushing to K230 via Wi-Fi (${ip}:${pt})...`);
                    try {
                        const r1 = await fetch(url, { method: 'POST', headers: { 'X-Filename': 'model.kmodel' }, body: kmodelBlob });
                        if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
                        await sleep(1500);
                        const r2 = await fetch(url, { method: 'POST', headers: { 'X-Filename': 'labels.txt' }, body: labelsBlob });
                        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                    } catch (pushErr) {
                        alert(`❌ Failed to connect to K230 at ${ip}:${pt}.\n\nEnsure:\n` +
                            `1) Your PC is connected to YAHBOOM-K230 Wi-Fi\n` +
                            `2) K230 is running k230_receive_server.py\n\nError: ${pushErr.message}`);
                        setStatus('Deploy failed: K230 unreachable.'); return;
                    }
                    setStatus('✅ Wi-Fi deployment complete!');
                    alert(`✅ Successfully deployed to K230 via Wi-Fi (${ip})!\n\nFiles saved to /sdcard/kmodel`);

                // 3a-2. Online Wi-Fi deploy (K230 on the same router network)
                } else if (method === 'online') {
                    const ip = document.getElementById('onlineIpInput').value.trim();
                    const pt = document.getElementById('onlinePortInput').value.trim() || '8080';
                    if (!ip) { alert('Enter the K230 board IP (use Auto-Detect or Ping to find it).'); setStatus('Deploy failed: no IP.'); return; }
                    const url = `http://${ip}:${pt}/upload`;
                    setStatus(`Pushing to K230 via Online Wi-Fi (${ip}:${pt})...`);
                    try {
                        const r1 = await fetch(url, { method: 'POST', headers: { 'X-Filename': 'model.kmodel' }, body: kmodelBlob });
                        if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
                        await sleep(1500);
                        const r2 = await fetch(url, { method: 'POST', headers: { 'X-Filename': 'labels.txt' }, body: labelsBlob });
                        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                    } catch (pushErr) {
                        alert(`❌ Failed to connect to K230 at ${ip}:${pt}.\n\nEnsure:\n` +
                            `1) K230 is connected to the same Wi-Fi network/router as this PC\n` +
                            `2) K230 is running the Wi-Fi receiver script (STA mode)\n\nError: ${pushErr.message}`);
                        setStatus('Deploy failed: K230 unreachable.'); return;
                    }
                    setStatus('✅ Online Wi-Fi deployment complete!');
                    alert(`✅ Successfully deployed to K230 via Online Wi-Fi (${ip})!\n\nFiles saved to /sdcard/kmodel`);

                // 3b. USB deploy
                } else if (method === 'usb') {
                    const baud = parseInt(document.getElementById('usbBaudSelect').value);
                    resetUsbPanel(); showUsbPanel(true);

                    port = usbPort; portReader = usbPort.readable.getReader();
                    portWriter = usbPort.writable.getWriter(); connected = true; usbPort = null;
                    rxPump();
                    usbLog(`Port open @ ${baud} baud`, 'ok');

                    try {
                        setStatus('Entering raw REPL...');
                        await enterRawREPL();

                        const kmodelArr = new Uint8Array(await kmodelBlob.arrayBuffer());
                        const labelsArr = new Uint8Array(await labelsBlob.arrayBuffer());

                        setStatus('Creating /sdcard/ ...');
                        usbLog('Ensuring /sdcard/ exists...', 'info');
                        await ensureDir('/sdcard/');
                        usbLog('Directory ready', 'ok');

                        const kmodelKB = (kmodelArr.length / 1024).toFixed(1);
                        usbLog(`Sending model.kmodel — ${kmodelKB} KB`, 'info');
                        await writeFileOnBoard('/sdcard/model.kmodel', kmodelArr, pct => {
                            usbSetProgress(1, pct); setStatus(`model.kmodel: ${Math.round(pct * 100)}%`);
                        });
                        usbSetProgress(1, 1); usbLog('model.kmodel ✓', 'ok');

                        usbLog('Sending labels.txt...', 'info');
                        await writeFileOnBoard('/sdcard/labels.txt', labelsArr, pct => {
                            usbSetProgress(2, pct); setStatus(`labels.txt: ${Math.round(pct * 100)}%`);
                        });
                        usbSetProgress(2, 1); usbLog('labels.txt ✓', 'ok');

                        await exitRawREPL();
                        usbLog('Done — exited raw REPL', 'ok');

                    } finally {
                        await cleanupPort();
                    }

                    setStatus('USB deployment complete!');
                    alert('✅ Successfully deployed to K230 via USB!\n\nFiles saved to /sdcard/');
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
        // ══════════════════════════════════════════════════════════════
        // EXPORT .kmodel + labels.txt
        // ══════════════════════════════════════════════════════════════
        async function exportKmodel() {
            if (!trained || !headModel) { alert('Train first!'); return; }

            const btn = document.getElementById('exportBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span>Exporting...';
            setStatus('Exporting model...');

            try {
                let savedArtifacts = null;
                await headModel.save(
                    tf.io.withSaveHandler(async (artifacts) => {
                        savedArtifacts = artifacts;
                        return { modelArtifactsInfo: { dateSaved: new Date() } };
                    })
                );
                if (!savedArtifacts) throw new Error('Failed to capture artifacts');

                const modelJson = {
                    modelTopology: savedArtifacts.modelTopology,
                    weightsManifest: [{
                        paths: ['weights.bin'],
                        weights: savedArtifacts.weightSpecs
                    }],
                    format: 'layers-model',
                    generatedBy: 'TensorFlow.js',
                    convertedBy: null
                };

                const formData = new FormData();
                formData.append('model_json',
                    new Blob([JSON.stringify(modelJson)], { type: 'application/json' }),
                    'model.json');
                formData.append('weights_bin',
                    new Blob([savedArtifacts.weightData], { type: 'application/octet-stream' }),
                    'weights.bin');
                formData.append('labels', JSON.stringify(classes.map(c => c.name)));

                setStatus('Sending to Docker server...');
                const resp = await postToBackend('convert', formData);

                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({ error: 'Server error' }));
                    throw new Error(err.error || `Error ${resp.status}`);
                }

                setStatus('Unpacking files...');
                const zipBlob = await resp.blob();
                const contentType = resp.headers.get('content-type') || '';

                if (contentType.includes('zip')) {
                    const zip = await JSZip.loadAsync(zipBlob);
                    const kf = zip.file('model.kmodel');
                    if (kf) downloadBlob(await kf.async('blob'), 'model.kmodel');
                    await new Promise(r => setTimeout(r, 500));
                    const lf = zip.file('labels.txt');
                    if (lf) downloadBlob(await lf.async('blob'), 'labels.txt');
                } else {
                    downloadBlob(zipBlob, 'model.kmodel');
                    await new Promise(r => setTimeout(r, 500));
                    downloadBlob(
                        new Blob([classes.map(c => c.name).join('\n')], { type: 'text/plain' }),
                        'labels.txt'
                    );
                }

                setStatus('model.kmodel and labels.txt downloaded!');
                alert('✅ Two files downloaded:\n\n1. model.kmodel\n2. labels.txt\n\nCopy both to /sdcard/models/ on K230.');

            } catch (e) {
                console.error('Export error:', e);
                alert('Export Failed: ' + e.message);
                setStatus('Export failed: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Export .kmodel for K230';
            }
        }

        // ══════════════════════════════════════════════════════════════
        // EXPORT .tflite (ESP32-S3)
        // ══════════════════════════════════════════════════════════════
        async function exportTflite() {
            if (classes.length < 2) { alert('Need at least 2 classes!'); return; }
            const emptyClass = classes.find(c => c.images.length < 10);
            if (emptyClass) { alert(`"${emptyClass.name}" needs at least 10 images.\n\nMore images = better accuracy. Aim for 30+ per class.`); return; }

            const btn = document.getElementById('exportEsp32Btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span>Loading images...';

            try {
                const nc      = classes.length;
                const labels  = classes.map(c => c.name);
                const skName  = 'esp32s3_classifier';
                const inputSize = 96;

                try { await tf.setBackend('webgl'); } catch (_) {}

                // ── Step 1: convert all images to 96×96 grayscale tensors ──────
                let totalUsed = 0;
                const xs = [], ys = [];
                for (let ci = 0; ci < nc; ci++) {
                    let imgsToUse = classes[ci].images;
                    if (imgsToUse.length > 40) {
                        imgsToUse = imgsToUse.slice().sort(() => 0.5 - Math.random()).slice(0, 40);
                    }
                    totalUsed += imgsToUse.length;
                    for (const imgObj of imgsToUse) {
                        const url = imgObj.url || imgObj;
                        const t = await _imgToGray96Tensor(url);
                        xs.push(t); ys.push(ci);
                    }
                }
                const xAll = tf.concat(xs, 0);
                const yAll = tf.tensor1d(ys, 'float32');
                xs.forEach(t => t.dispose());

                // ── Step 2: train small CNN in-browser ──────────────────────────
                const batchSize = Math.max(4, Math.min(16, Math.floor(totalUsed / 4)));
                const epochs    = 80;
                setStatus(`Training small CNN (${totalUsed} images, ${epochs} epochs, batch ${batchSize})...`);
                const smallCnn = _buildSmallCnn(nc);
                smallCnn.compile({
                    optimizer: tf.train.adam(0.001),
                    loss: 'sparseCategoricalCrossentropy',
                    metrics: ['accuracy']
                });

                let lastAcc = '0';
                await smallCnn.fit(xAll, yAll, {
                    epochs, batchSize, shuffle: true,
                    callbacks: {
                        onEpochEnd(ep, logs) {
                            lastAcc = ((logs.accuracy ?? logs.acc ?? 0) * 100).toFixed(1);
                            btn.innerHTML = `<span class="spinner"></span>Epoch ${ep+1}/${epochs} — acc ${lastAcc}%`;
                        }
                    }
                });

                // Accuracy checks
                const predTensor = smallCnn.predict(xAll);
                const predData   = await predTensor.array();
                predTensor.dispose();
                const perClassCorrect = new Array(nc).fill(0);
                const perClassTotal   = new Array(nc).fill(0);
                for (let i = 0; i < ys.length; i++) {
                    const trueIdx = ys[i];
                    const predIdx = predData[i].indexOf(Math.max(...predData[i]));
                    perClassTotal[trueIdx]++;
                    if (predIdx === trueIdx) perClassCorrect[trueIdx]++;
                }

                const poorClasses = [];
                for (let ci = 0; ci < nc; ci++) {
                    const acc = perClassCorrect[ci] / perClassTotal[ci];
                    if (acc < 0.70) poorClasses.push(`"${labels[ci]}" (${(acc*100).toFixed(0)}%)`);
                }
                if (poorClasses.length > 0) {
                    const go = confirm(
                        `⚠️ Low training accuracy:\n${poorClasses.join('\n')}\n\n` +
                        `Export anyway?`
                    );
                    if (!go) {
                        xAll.dispose(); yAll.dispose(); smallCnn.dispose();
                        btn.disabled = false;
                        btn.innerHTML = 'Export .tflite (ESP32-S3)';
                        return;
                    }
                }

                xAll.dispose(); yAll.dispose();
                setStatus(`CNN trained — overall acc ${lastAcc}%. Exporting...`);

                // ── Step 3: export CNN as TF.js artifacts ────────────────────────
                let savedArtifacts = null;
                await smallCnn.save(tf.io.withSaveHandler(async artifacts => {
                    savedArtifacts = artifacts;
                    return { modelArtifactsInfo: { dateSaved: new Date() } };
                }));
                smallCnn.dispose();
                if (!savedArtifacts) throw new Error('Failed to capture CNN artifacts');

                const modelJson = {
                    modelTopology: savedArtifacts.modelTopology,
                    weightsManifest: [{ paths: ['weights.bin'], weights: savedArtifacts.weightSpecs }],
                    format: 'layers-model', generatedBy: 'TensorFlow.js', convertedBy: null
                };

                // ── Step 4: send to /convert-esp32-lite → INT8 TFLite ───────────
                const formData = new FormData();
                formData.append('model_json',
                    new Blob([JSON.stringify(modelJson)], { type: 'application/json' }), 'model.json');
                formData.append('weights_bin',
                    new Blob([savedArtifacts.weightData], { type: 'application/octet-stream' }), 'weights.bin');
                formData.append('labels', JSON.stringify(labels));
                formData.append('input_size', '96');

                btn.innerHTML = '<span class="spinner"></span>Converting to TFLite INT8...';
                setStatus('Backend: converting to INT8 TFLite (~20s)...');

                const resp = await postToBackend('convert-esp32-lite', formData);
                const zipBlob = await resp.blob();
                const contentType = resp.headers.get('content-type') || '';

                if (contentType.includes('zip')) {
                    downloadBlob(zipBlob, 'tiny_image_esp32_model.zip');
                } else {
                    throw new Error('Backend did not return ZIP');
                }

                setStatus(`✅ Export complete: tiny_image_esp32_model.zip downloaded successfully!`);
                alert(`✅ tiny_image_esp32_model.zip downloaded successfully!\n\nThis ZIP contains the 19 KB optimized model and class labels.\n\nYou can keep this ZIP as a backup or upload it directly to your ESP32 board!`);

            } catch (e) {
                console.error('[ESP32-EXPORT] Error:', e.message);
                alert('❌ Export failed:\n\n' + e.message);
                setStatus('ESP32-S3 export failed: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Export .tflite (ESP32-S3)';
            }
        }

        // ══════════════════════════════════════════════════════════════
        // EXPORT ARDUINO ZIP — helpers
        // Trains a small 96×96 grayscale CNN in-browser (no MobileNet).
        // Produces ~50-300 KB TFLite with only TFLite Micro supported ops.
        // No RESIZE_BILINEAR, no large backbone.
        // ══════════════════════════════════════════════════════════════
        const ARDUINO_INPUT_SIZE = 96;

        async function _imgToGray96Tensor(url) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width  = ARDUINO_INPUT_SIZE;
                        canvas.height = ARDUINO_INPUT_SIZE;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, ARDUINO_INPUT_SIZE, ARDUINO_INPUT_SIZE);
                        const d = ctx.getImageData(0, 0, ARDUINO_INPUT_SIZE, ARDUINO_INPUT_SIZE);
                        const g = new Float32Array(ARDUINO_INPUT_SIZE * ARDUINO_INPUT_SIZE);
                        for (let i = 0, j = 0; i < d.data.length; i += 4, j++)
                            g[j] = (0.299 * d.data[i] + 0.587 * d.data[i+1] + 0.114 * d.data[i+2]) / 255;
                        resolve(tf.tensor4d(g, [1, ARDUINO_INPUT_SIZE, ARDUINO_INPUT_SIZE, 1]));
                    } catch(e) { reject(e); }
                };
                img.onerror = () => reject(new Error('Image load failed: ' + url));
                img.src = url;
            });
        }

        function _buildSmallCnn(nc) {
            // tf.layers.globalAveragePooling2d and averagePooling2d both throw
            // "Cannot read properties of undefined (reading 'dataFormat')"
            // in TF.js 4.10.x Sequential models — avoided entirely.
            // Only uses: CONV_2D, MAX_POOL_2D, RESHAPE (flatten), FULLY_CONNECTED, SOFTMAX
            // — all natively supported by TFLite Micro with no extra op registration.
            const S = ARDUINO_INPUT_SIZE; // 96
            const m = tf.sequential();
            m.add(tf.layers.conv2d({ inputShape: [S, S, 1], filters: 8,  kernelSize: 3, padding: 'same', activation: 'relu' }));
            m.add(tf.layers.maxPooling2d({ poolSize: 2 }));  // → 48×48×8
            m.add(tf.layers.conv2d({ filters: 16, kernelSize: 3, padding: 'same', activation: 'relu' }));
            m.add(tf.layers.maxPooling2d({ poolSize: 2 }));  // → 24×24×16
            m.add(tf.layers.conv2d({ filters: 32, kernelSize: 3, padding: 'same', activation: 'relu' }));
            m.add(tf.layers.maxPooling2d({ poolSize: 2 }));  // → 12×12×32
            m.add(tf.layers.conv2d({ filters: 16, kernelSize: 3, padding: 'same', activation: 'relu' }));
            m.add(tf.layers.maxPooling2d({ poolSize: 12 })); // → 1×1×16
            m.add(tf.layers.flatten());                      // → 16
            m.add(tf.layers.dense({ units: nc, activation: 'softmax' }));
            return m;
        }

        async function exportArduinoZip() {
            await exportArduinoCore(false);
        }

        async function deployToEsp32() {
            await exportArduinoCore(true);
        }

        async function exportArduinoCore(isSerialUpload) {
            if (classes.length < 2) { alert('Need at least 2 classes!'); return; }
            const emptyClass = classes.find(c => c.images.length < 10);
            if (emptyClass) { alert(`"${emptyClass.name}" needs at least 10 images.\n\nMore images = better accuracy. Aim for 30+ per class.`); return; }

            const btn = document.getElementById(isSerialUpload ? 'deployEsp32Btn' : 'exportArduinoBtn');
            btn.disabled = true;

            let _serialReady = false;

            btn.innerHTML = '<span class="spinner"></span>Loading images...';

            try {
                const nc      = classes.length;
                const labels  = classes.map(c => c.name);
                const skName  = 'esp32s3_classifier';
                const dateStr = new Date().toISOString().slice(0, 10);
                const inputSize = ARDUINO_INPUT_SIZE;

                try { await tf.setBackend('webgl'); } catch (_) {}

                // ── Step 1: convert all images to 96×96 grayscale tensors ──────
                let totalUsed = 0;
                const xs = [], ys = [];
                for (let ci = 0; ci < nc; ci++) {
                    let imgsToUse = classes[ci].images;
                    if (imgsToUse.length > 40) {
                        imgsToUse = imgsToUse.slice().sort(() => 0.5 - Math.random()).slice(0, 40);
                    }
                    totalUsed += imgsToUse.length;
                    for (const imgObj of imgsToUse) {
                        const url = imgObj.url || imgObj;
                        const t = await _imgToGray96Tensor(url);
                        xs.push(t); ys.push(ci);
                    }
                }
                const xAll = tf.concat(xs, 0);
                const yAll = tf.tensor1d(ys, 'float32');
                xs.forEach(t => t.dispose());

                // ── Step 2: train small CNN in-browser ──────────────────────────
                // Batch size must be ≤ total images; too-large batches hurt small datasets.
                const batchSize = Math.max(4, Math.min(16, Math.floor(totalUsed / 4)));
                const epochs    = 80;
                setStatus(`Training small CNN (${totalUsed} images, ${epochs} epochs, batch ${batchSize})...`);
                const smallCnn = _buildSmallCnn(nc);
                smallCnn.compile({
                    optimizer: tf.train.adam(0.001),
                    loss: 'sparseCategoricalCrossentropy',
                    metrics: ['accuracy']
                });

                let lastAcc = '0';
                await smallCnn.fit(xAll, yAll, {
                    epochs, batchSize, shuffle: true,
                    callbacks: {
                        onEpochEnd(ep, logs) {
                            lastAcc = ((logs.accuracy ?? logs.acc ?? 0) * 100).toFixed(1);
                            btn.innerHTML = `<span class="spinner"></span>Epoch ${ep+1}/${epochs} — acc ${lastAcc}%`;
                        }
                    }
                });

                // ── Per-class accuracy check — catch "always predicts class 0" failures ──
                const predTensor = smallCnn.predict(xAll);
                const predData   = await predTensor.array();
                predTensor.dispose();
                const perClassCorrect = new Array(nc).fill(0);
                const perClassTotal   = new Array(nc).fill(0);
                for (let i = 0; i < ys.length; i++) {
                    const trueIdx = ys[i];
                    const predIdx = predData[i].indexOf(Math.max(...predData[i]));
                    perClassTotal[trueIdx]++;
                    if (predIdx === trueIdx) perClassCorrect[trueIdx]++;
                }

                const poorClasses = [];
                for (let ci = 0; ci < nc; ci++) {
                    const acc = perClassCorrect[ci] / perClassTotal[ci];
                    if (acc < 0.70) poorClasses.push(`"${labels[ci]}" (${(acc*100).toFixed(0)}%)`);
                }
                if (poorClasses.length > 0) {
                    const go = confirm(
                        `⚠️ Low training accuracy:\n${poorClasses.join('\n')}\n\n` +
                        `The model did not learn these classes well.\n` +
                        `Add more varied i
                        mages (aim for 30+ per class) and retrain.\n\n` +
                        `Export anyway?`
                    );
                    if (!go) {
                        xAll.dispose(); yAll.dispose(); smallCnn.dispose();
                        btn.disabled = false;
                        btn.innerHTML = isSerialUpload ? '🔌 Deploy to ESP32 (WebSerial)' : '📦 Export Arduino ZIP (9 files)';
                        return;
                    }
                }

                xAll.dispose(); yAll.dispose();
                setStatus(`CNN trained — overall acc ${lastAcc}%. Exporting...`);

                // ── Step 3: export CNN as TF.js artifacts ────────────────────────
                let savedArtifacts = null;
                await smallCnn.save(tf.io.withSaveHandler(async artifacts => {
                    savedArtifacts = artifacts;
                    return { modelArtifactsInfo: { dateSaved: new Date() } };
                }));
                smallCnn.dispose();
                if (!savedArtifacts) throw new Error('Failed to capture CNN artifacts');

                const modelJson = {
                    modelTopology: savedArtifacts.modelTopology,
                    weightsManifest: [{ paths: ['weights.bin'], weights: savedArtifacts.weightSpecs }],
                    format: 'layers-model', generatedBy: 'TensorFlow.js', convertedBy: null
                };

                // ── Step 4: send to /convert-esp32-lite → INT8 TFLite ───────────
                const convertServer = await discoverBackend();

                const formData = new FormData();
                formData.append('model_json',
                    new Blob([JSON.stringify(modelJson)], { type: 'application/json' }), 'model.json');
                formData.append('weights_bin',
                    new Blob([savedArtifacts.weightData], { type: 'application/octet-stream' }), 'weights.bin');
                formData.append('labels', JSON.stringify(labels));
                formData.append('input_size', String(inputSize));

                btn.innerHTML = '<span class="spinner"></span>Converting to TFLite INT8...';
                setStatus('Backend: converting to INT8 TFLite (~20s)...');

                const resp = await postToBackend('convert-esp32-lite', formData);

                // ── Step 5: unpack .tflite from backend response ─────────────────
                btn.innerHTML = '<span class="spinner"></span>Generating Arduino files...';
                let tfliteBytes = null;
                const ct = resp.headers.get('content-type') || '';
                if (ct.includes('zip')) {
                    const rz = await JSZip.loadAsync(await resp.blob());
                    let tf_ = rz.file('model.tflite') || rz.file('tiny_image_esp32_model/model.tflite');
                    if (!tf_) {
                        const files = Object.keys(rz.files);
                        const match = files.find(f => f.endsWith('model.tflite'));
                        if (match) tf_ = rz.file(match);
                    }
                    if (!tf_) throw new Error('model.tflite not found in backend response');
                    tfliteBytes = await tf_.async('uint8array');
                } else {
                    tfliteBytes = new Uint8Array(await resp.arrayBuffer());
                }

                if (!isSerialUpload) {
                    setStatus(`TFLite ready (${(tfliteBytes.length/1024).toFixed(1)} KB). Generating 9 Arduino files...`);

                    // ── File 1: person_detect_model_data.cpp ──────────────
                    let hexRows = '';
                    for (let i = 0; i < tfliteBytes.length; i++) {
                        if (i % 12 === 0) hexRows += '\n  ';
                        hexRows += '0x' + tfliteBytes[i].toString(16).padStart(2, '0');
                        if (i < tfliteBytes.length - 1) hexRows += ', ';
                    }
                    const modelDataCpp =
`/* Auto-generated ${dateStr} — ESP32-S3 Trainer
 * Classes (${nc}): ${labels.join(', ')}
 * Input: ${inputSize}x${inputSize} grayscale  |  Format: INT8 TFLite
 * Size: ${tfliteBytes.length} bytes (${(tfliteBytes.length/1024).toFixed(1)} KB)
 */
#include "person_detect_model_data.h"

alignas(8) const unsigned char g_person_detect_model_data[] = {${hexRows}
};
const int g_person_detect_model_data_len = ${tfliteBytes.length};
`;

                    // ── File 2: person_detect_model_data.h ────────────────
                    const modelDataH =
`/* Auto-generated ${dateStr} */
#ifndef PERSON_DETECT_MODEL_DATA_H_
#define PERSON_DETECT_MODEL_DATA_H_

extern const unsigned char g_person_detect_model_data[];
extern const int g_person_detect_model_data_len;

#endif  // PERSON_DETECT_MODEL_DATA_H_
`;

                    // ── File 3: model_settings.h ──────────────────────────
                    const labelConsts = labels
                        .map((l, i) => `constexpr int k${l.replace(/\W+/g, '')}Index = ${i};`)
                        .join('\n');
                    const modelSettingsH =
`/* Auto-generated ${dateStr} */
#ifndef MODEL_SETTINGS_H_
#define MODEL_SETTINGS_H_

constexpr int kNumCols     = ${inputSize};
constexpr int kNumRows     = ${inputSize};
constexpr int kNumChannels = 1;
constexpr int kMaxImageSize = kNumCols * kNumRows * kNumChannels;

constexpr int kCategoryCount = ${nc};
${labelConsts}

extern const char* kCategoryLabels[kCategoryCount];

#endif  // MODEL_SETTINGS_H_
`;

                    // ── File 4: model_settings.cpp ────────────────────────
                    const labelArray = labels.map(l => `  "${l}",`).join('\n');
                    const modelSettingsCpp =
`/* Auto-generated ${dateStr} */
#include "model_settings.h"

const char* kCategoryLabels[kCategoryCount] = {
${labelArray}
};
`;

                    // ── File 5: arduino_image_provider.cpp ────────────────
                    const imageProviderCpp =
`/* ESP32-S3 Camera Image Provider — Auto-generated ${dateStr}
 * Captures ${inputSize}x${inputSize} grayscale frames for TFLite inference.
 * Pin config: Hiwonder ESP32-S3 (OV2640)
 */
#include <Arduino.h>
#include "image_provider.h"
#include "model_settings.h"
#include "esp_camera.h"

#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  40
#define XCLK_GPIO_NUM   15
#define SIOD_GPIO_NUM    4
#define SIOC_GPIO_NUM    5
#define Y9_GPIO_NUM     16
#define Y8_GPIO_NUM     17
#define Y7_GPIO_NUM     18
#define Y6_GPIO_NUM     12
#define Y5_GPIO_NUM     10
#define Y4_GPIO_NUM      8
#define Y3_GPIO_NUM      9
#define Y2_GPIO_NUM     11
#define VSYNC_GPIO_NUM   6
#define HREF_GPIO_NUM    7
#define PCLK_GPIO_NUM   13

static bool g_camera_initialized = false;

static TfLiteStatus InitCamera(tflite::ErrorReporter* reporter) {
  if (g_camera_initialized) return kTfLiteOk;

  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk  = XCLK_GPIO_NUM;
  config.pin_pclk  = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href  = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn  = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_GRAYSCALE;
  config.frame_size   = FRAMESIZE_${inputSize === 96 ? 'QQVGA' : inputSize === 224 ? 'QVGA' : 'QVGA'};
  config.jpeg_quality = 12;
  config.fb_count     = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    TF_LITE_REPORT_ERROR(reporter, "Camera init failed");
    return kTfLiteError;
  }
  g_camera_initialized = true;
  return kTfLiteOk;
}

TfLiteStatus GetImage(tflite::ErrorReporter* reporter, int image_width,
                      int image_height, int channels, int8_t* image_data) {
  if (InitCamera(reporter) != kTfLiteOk) return kTfLiteError;

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { TF_LITE_REPORT_ERROR(reporter, "Camera capture failed"); return kTfLiteError; }

  // Resize captured frame to model input size
  int src_w = fb->width, src_h = fb->height;
  for (int y = 0; y < image_height; y++) {
    for (int x = 0; x < image_width; x++) {
      int sx = x * src_w / image_width;
      int sy = y * src_h / image_height;
      // Convert uint8 [0,255] -> int8 [-128,127]
      image_data[y * image_width + x] =
          (int8_t)((int)fb->buf[sy * src_w + sx] - 128);
    }
  }
  esp_camera_fb_return(fb);
  return kTfLiteOk;
}
`;

                    // ── File 6: image_provider.h ──────────────────────────
                    const imageProviderH =
`/* Auto-generated ${dateStr} */
#ifndef IMAGE_PROVIDER_H_
#define IMAGE_PROVIDER_H_

#include "tensorflow/lite/c/common.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"

TfLiteStatus GetImage(tflite::ErrorReporter* error_reporter,
                      int image_width, int image_height,
                      int channels, int8_t* image_data);

#endif  // IMAGE_PROVIDER_H_
`;

                    // ── File 7: main_functions.h ──────────────────────────
                    const mainFunctionsH =
`/* Auto-generated ${dateStr} */
#ifndef MAIN_FUNCTIONS_H_
#define MAIN_FUNCTIONS_H_

void setup();
void loop();

#endif  // MAIN_FUNCTIONS_H_
`;

                    // ── File 8: arduino_main.cpp ──────────────────────────
                    const arduinoMainCpp =
`/* Auto-generated ${dateStr}
 * TFLite Micro inference loop for ESP32-S3
 * Classes: ${labels.join(', ')}
 */
#include <Arduino.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

#include "main_functions.h"
#include "image_provider.h"
#include "model_settings.h"
#include "person_detect_model_data.h"

namespace {
  tflite::MicroErrorReporter micro_error_reporter;
  tflite::ErrorReporter*     error_reporter = &micro_error_reporter;

  const tflite::Model* model = nullptr;
  tflite::MicroInterpreter* interpreter = nullptr;
  TfLiteTensor* input  = nullptr;
  TfLiteTensor* output = nullptr;

  // Adjust tensor arena size if you get OOM errors
  constexpr int kTensorArenaSize = 136 * 1024;
  static uint8_t tensor_arena[kTensorArenaSize];
}

void setup() {
  Serial.begin(115200);
  Serial.println("[ESP32-S3] Initialising TFLite model...");

  model = tflite::GetModel(g_person_detect_model_data);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    TF_LITE_REPORT_ERROR(error_reporter, "Schema version mismatch!");
    return;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    TF_LITE_REPORT_ERROR(error_reporter, "AllocateTensors failed!");
    return;
  }

  input  = interpreter->input(0);
  output = interpreter->output(0);
  Serial.println("[ESP32-S3] Ready. Starting inference loop.");
}

void loop() {
  if (GetImage(error_reporter, kNumCols, kNumRows, kNumChannels,
               input->data.int8) != kTfLiteOk) {
    Serial.println("[ERROR] Camera capture failed");
    return;
  }

  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println("[ERROR] Inference failed");
    return;
  }

  // Find highest-confidence class
  int    best_idx  = 0;
  int8_t best_score = output->data.int8[0];
  for (int i = 1; i < kCategoryCount; i++) {
    if (output->data.int8[i] > best_score) {
      best_score = output->data.int8[i];
      best_idx   = i;
    }
  }
  float confidence = (best_score + 128) / 255.0f * 100.0f;
  Serial.printf("[%s] %.1f%%\\n", kCategoryLabels[best_idx], confidence);
  delay(100);
}
`;

                    // ── File 9: sketch .ino ───────────────────────────────
                    const sketchIno =
`/* ${skName}.ino — Auto-generated ${dateStr}
 * ESP32-S3 TFLite image classifier
 * Classes: ${labels.join(', ')}
 *
 * Arduino IDE settings:
 *   Board     : ESP32S3 Dev Module
 *   CPU Speed : 240 MHz
 *   PSRAM     : OPI PSRAM  ← required
 *   Partition : Huge APP (3MB No OTA) ← required
 *
 * After upload open Serial Monitor @ 115200 baud.
 */
#include "main_functions.h"

// setup() and loop() are defined in arduino_main.cpp
`;

                    // ── Step 4: bundle into ZIP ───────────────────────────
                    setStatus('Packaging ZIP...');
                    const zip = new JSZip();
                    const folder = zip.folder(skName);
                    folder.file('person_detect_model_data.cpp', modelDataCpp);
                    folder.file('person_detect_model_data.h',   modelDataH);
                    folder.file('model_settings.h',             modelSettingsH);
                    folder.file('model_settings.cpp',           modelSettingsCpp);
                    folder.file('arduino_image_provider.cpp',   imageProviderCpp);
                    folder.file('image_provider.h',             imageProviderH);
                    folder.file('main_functions.h',             mainFunctionsH);
                    folder.file('arduino_main.cpp',             arduinoMainCpp);
                    folder.file(`${skName}.ino`,                sketchIno);

                    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
                    downloadBlob(zipBlob, `${skName}.zip`);
                }

                // ── Auto-upload via WebSerial if port was pre-connected ──────
                _dfr1154.labelsText = labels.map((l, i) => i + ' ' + l).join('\n') + '\n';
                const sizeKb = (tfliteBytes.length / 1024).toFixed(1);

                if (isSerialUpload) {
                    const modal = document.getElementById('rstModal');
                    const modalBtn = document.getElementById('rstModalBtn');
                    const cancelBtn = document.getElementById('rstCancelBtn');
                    modal.style.display = 'flex';

                    await new Promise((resolve, reject) => {
                        modalBtn.onclick = async () => {
                            try {
                                btn.innerHTML = '<span class="spinner"></span>Connecting to port…';
                                try { _dfr1154.reader?.cancel(); }      catch (_) {}
                                try { _dfr1154.writer?.releaseLock(); } catch (_) {}
                                try { _dfr1154.reader?.releaseLock(); } catch (_) {}
                                try { await _dfr1154.port?.close(); }   catch (_) {}
                                _dfr1154.rxBuf  = '';
                                _dfr1154.port   = await navigator.serial.requestPort();
                                await _dfr1154.port.open({ baudRate: 115200, bufferSize: 8192 });
                                try { await _dfr1154.port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (_) {}
                                _dfr1154.reader = _dfr1154.port.readable.getReader();
                                _dfr1154.writer = _dfr1154.port.writable.getWriter();
                                _serialReady    = true;
                                document.getElementById('serialPanel').classList.add('active');
                                dfr1154SetStatus('Serial connected — uploading…', true);
                                dfr1154Log('Port opened. Uploading model...');
                                modal.style.display = 'none';
                                resolve();
                            } catch (e) {
                                modal.style.display = 'none';
                                reject(e);
                            }
                        };
                        cancelBtn.onclick = () => {
                            modal.style.display = 'none';
                            reject(new Error('Upload cancelled by user.'));
                        };
                    });
                } else {
                    setStatus(`ZIP downloaded (${sizeKb} KB).`);
                }

                if (_serialReady) {
                    btn.innerHTML = '<span class="spinner"></span>Waiting for DFR1154 firmware…';
                    dfr1154SetStatus('Handshaking with DFR1154 firmware…', true);
                    dfr1154Log('Starting DFR1154 upload protocol…');
                    await dfr1154WaitReady();

                    btn.innerHTML = '<span class="spinner"></span>Uploading labels…';
                    const labelBytes = new TextEncoder().encode(_dfr1154.labelsText);
                    dfr1154Log('→ LABELS ' + labelBytes.length);
                    await dfr1154Write('LABELS ' + labelBytes.length + '\n');
                    await _dfr1154.writer.write(labelBytes);
                    await dfr1154Expect(l => l.includes('SERIAL OK LABELS') || l.includes('Serial labels uploaded'), 10000);
                    dfr1154Log('Labels sent ✓');

                    await dfr1154SendCommand('MODEL_BEGIN ' + tfliteBytes.length, 'MODEL_BEGIN', 15000);
                    const chunkSize = 2048;
                    for (let offset = 0; offset < tfliteBytes.length; offset += chunkSize) {
                        const chunk = tfliteBytes.slice(offset, Math.min(offset + chunkSize, tfliteBytes.length));
                        const pct   = Math.round(((offset + chunk.length) / tfliteBytes.length) * 100);
                        btn.innerHTML = `<span class="spinner"></span>Uploading to DFR1154… ${pct}%`;
                        dfr1154Log('→ MODEL_CHUNK ' + offset + ' ' + chunk.length);
                        await dfr1154Write('MODEL_CHUNK ' + offset + ' ' + chunk.length + '\n');
                        await _dfr1154.writer.write(chunk);
                        await dfr1154Expect(l => l.includes('SERIAL OK MODEL_CHUNK'), 15000);
                    }
                    await dfr1154SendCommand('MODEL_END ' + tfliteBytes.length, 'MODEL_END', 15000);
                    await dfr1154SendCommand('LOAD', 'LOAD', 10000);

                    const kb = (tfliteBytes.length / 1024).toFixed(1);
                    dfr1154Log(`✅ Model loaded (${kb} KB)! Inference running on DFR1154.`);
                    dfr1154SetStatus(`✅ Loaded ${kb} KB — inference running on board.`, true);
                    setStatus(`DFR1154 model loaded (${kb} KB).`);
                } else {
                    if (isSerialUpload) {
                        alert(
                            `🔌 WebSerial connection was not established or was cancelled.\n\n` +
                            `No files were sent to the board and no ZIP was downloaded.\n\n` +
                            `If you want to manually download the Arduino C++ files, click the "Export Arduino ZIP (9 files)" button instead.`
                        );
                    } else {
                        alert(
                            `✅ Arduino ZIP downloaded!\n\n` +
                            `Contents (${skName}/):\n` +
                            `  1. person_detect_model_data.cpp  2. person_detect_model_data.h\n` +
                            `  3. model_settings.h              4. model_settings.cpp\n` +
                            `  5. arduino_image_provider.cpp    6. image_provider.h\n` +
                            `  7. main_functions.h              8. arduino_main.cpp\n` +
                            `  9. ${skName}.ino\n\n` +
                            `Open in Arduino IDE.\n` +
                            `Set Partition → Huge APP (3MB) + PSRAM → OPI PSRAM, then upload.\n\n` +
                            `💡 Tip: Use Chrome/Edge and click Deploy to ESP32 (WebSerial) for direct flashing.`
                        );
                    }
                }

            } catch (e) {
                console.error('ESP32 deployment error:', e);
                if (isSerialUpload) {
                    if (e.message.includes('Inference already started') || e.message.includes('reset board')) {
                        alert(
                            `⚠️ ESP32 Upload Locked!\n\n` +
                            `The board has already started running its previous model, which locks the upload channel.\n\n` +
                            `👉 How to solve this:\n` +
                            `1. Press the physical "RST" (Reset) button on your DFR1154 board.\n` +
                            `2. Immediately click the yellow "Deploy to ESP32 (WebSerial)" button in your browser within 5 seconds!\n\n` +
                            `This will catch the board during its initial startup handshake before it starts running the old model.`
                        );
                    } else {
                        alert('🔌 ESP32 Serial Upload Failed:\n\n' + e.message + '\n\nTip: Close other applications (like Arduino IDE Serial Monitor) that might be using the COM port, reset the board, and try again.');
                    }
                    setStatus('ESP32 WebSerial upload failed: ' + e.message);
                } else {
                    alert('Arduino ZIP Export Failed: ' + e.message);
                    setStatus('Arduino ZIP export failed: ' + e.message);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = isSerialUpload ? '🔌 Deploy to ESP32 (WebSerial)' : '📦 Export Arduino ZIP (9 files)';
            }
        }

        // ══════════════════════════════════════════════════════════════
        // DFR1154 WebSerial Upload
        // Protocol: PING → LABELS → MODEL_BEGIN → MODEL_CHUNKs → MODEL_END → LOAD
        // ══════════════════════════════════════════════════════════════

        const _dfr1154 = {
            bytes: null,       // Uint8Array — last exported TFLite model
            labelsText: '',    // "0 Class1\n1 Class2\n"
            port: null,
            reader: null,
            writer: null,
            rxBuf: '',
        };

        function dfr1154SetStatus(msg, connected) {
            const dot = document.getElementById('serialDot');
            const st  = document.getElementById('serialStatusMsg');
            if (dot) dot.className = 'serial-dot' + (connected ? ' connected' : '');
            if (st)  st.textContent = msg;
        }

        function dfr1154Log(s) {
            const box = document.getElementById('serialLog');
            if (!box) return;
            box.classList.add('active');
            box.textContent = '[' + new Date().toLocaleTimeString() + '] ' + s + '\n' + box.textContent;
        }

        async function dfr1154ReadLine(timeoutMs = 10000) {
            const deadline = Date.now() + timeoutMs;
            const dec = new TextDecoder();
            while (true) {
                const nl = _dfr1154.rxBuf.indexOf('\n');
                if (nl >= 0) {
                    const line = _dfr1154.rxBuf.slice(0, nl).replace(/\r/g, '');
                    _dfr1154.rxBuf = _dfr1154.rxBuf.slice(nl + 1);
                    if (line) dfr1154Log('← ' + line);
                    return line;
                }
                const remaining = deadline - Date.now();
                if (remaining <= 0) throw new Error('Serial timeout');
                const result = await Promise.race([
                    _dfr1154.reader.read(),
                    new Promise(r => setTimeout(() => r({ timeout: true }), remaining))
                ]);
                if (result.timeout)     throw new Error('Serial timeout');
                if (result.done)        throw new Error('Serial disconnected');
                _dfr1154.rxBuf += dec.decode(result.value, { stream: true });
            }
        }

        async function dfr1154Expect(matchFn, timeoutMs = 10000) {
            while (true) {
                const line = await dfr1154ReadLine(timeoutMs);
                if (line.startsWith('SERIAL ERR')) throw new Error(line);
                if (matchFn(line)) return line;
            }
        }

        async function dfr1154Write(text) {
            await _dfr1154.writer.write(new TextEncoder().encode(text));
        }

        async function dfr1154SendCommand(cmd, okToken, timeoutMs = 10000) {
            dfr1154Log('→ ' + cmd);
            await dfr1154Write(cmd + '\n');
            return dfr1154Expect(l => l.includes('SERIAL OK ' + okToken), timeoutMs);
        }

        async function dfr1154WaitReady() {
            const deadline = Date.now() + 12000;
            while (Date.now() < deadline) {
                await dfr1154Write('PING\n');
                try {
                    const line = await dfr1154Expect(
                        l => l.includes('SERIAL OK PONG') || l.includes('SERIAL READY'),
                        1200
                    );
                    if (line.includes('SERIAL READY')) {
                        await dfr1154SendCommand('PING', 'PONG', 3000);
                    }
                    return;
                } catch (e) {
                    if (!e.message.includes('timeout')) throw e;
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            throw new Error('No firmware response. Flash DFR1154 firmware, reset board, then retry.');
        }

        // ══════════════════════════════════════════════════════════════
        // NAVIGATION
        // ══════════════════════════════════════════════════════════════
        function goBack() {
            stopCapture(); stopTestWebcam();
            const payload = JSON.stringify({ type: 'CLOSE_AI_TRAIN' });
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent !== window) {
                window.parent.postMessage(payload, '*');
                window.opener?.postMessage(payload, '*');
            } else {
                // Standalone browser — navigate back to the picker this
                // session started from (K230 or S3)
                let board = 'k230';
                try { board = localStorage.getItem('blockly_active_train_board') || 'k230'; } catch (e) { }
                window.location.href = board === 's3' ? 's3_picker.html' : 'train_picker.html';
            }
        }

        // ══════════════════════════════════════════════════════════════
        // INIT
        // ══════════════════════════════════════════════════════════════
        loadState();
        render();
    