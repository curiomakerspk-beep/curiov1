// =====================================================================
// BLUETOOTH LOGIC
// Dual-platform: Web Bluetooth for browser, ReactNativeWebView for mobile
// =====================================================================
const BLE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_CONTROL_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_DATA_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// Storage for discovered Web Bluetooth device objects (keyed by device.id)
let _foundBLEDevices = {};

// Web Bluetooth state (browser only)
let bleDevice = null;
let bleGattServer = null;
let bleControlChar = null;
let bleDataChar = null;      // TX notify char — board → browser

/** True when running inside React Native WebView */
function isMobileApp() {
  return typeof window !== 'undefined' && !!window.ReactNativeWebView;
}

/** True when a BLE link is live (browser or mobile) */
function bleConnected() {
  if (isMobileApp()) {
    // Mobile connection state is managed by App.js; we trust the flag it sets
    return window._mobileBLEConnected === true;
  }
  return !!(bleDevice && bleDevice.gatt && bleDevice.gatt.connected);
}

// --- Modal helpers ---
function openBT() {
  document.getElementById('btModal').classList.add('open');
  document.getElementById('btModal').style.display = 'flex';
}
function closeBT() {
  document.getElementById('btModal').classList.remove('open');
  document.getElementById('btModal').style.display = 'none';
}

/** Called by App.js (mobile) or by browser connect flow to finalise UI */
function finalizeConnection(deviceName) {
  closeBT();
  window._mobileBLEConnected = true;
  handleBoardMessage("Connected ✅ " + deviceName, "SYS");
  const pill = document.getElementById('bt-text');
  if (pill) pill.innerText = deviceName || "Connected";
  // Live Mode: re-send last known hardware state on reconnect
  if (typeof LiveModeEngine !== 'undefined' && LiveModeEngine.isEnabled()) {
    setTimeout(() => LiveModeEngine.resyncAll(), 600);
  }
}

// --- Scanning ---
async function startScan() {
  const deviceList = document.getElementById('deviceList');
  deviceList.innerHTML = '<div style="color:#00f5ff;text-align:center;padding:20px;">Scanning…</div>';

  if (isMobileApp()) {
    // Tell native App.js to start scanning; results come back via addDeviceToUI()
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "CONNECT_BLE" }));
    return;
  }

  // ── BROWSER: Web Bluetooth API (original working logic) ──
  if (!navigator.bluetooth) {
    deviceList.innerHTML = '<div style="color:red;text-align:center;">Web Bluetooth not supported in this browser.</div>';
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BLE_SERVICE_UUID]
    });
    deviceList.innerHTML = '';
    _foundBLEDevices[device.id] = device;
    addDeviceToUI(device.name || 'STM32', device.id, 'Link');
    // Auto-connect to the selected device
    await _connectBrowserBLE(device.id);
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      deviceList.innerHTML = '<div style="color:red;text-align:center;">Scan cancelled or failed.</div>';
    }
  }
}

/** Inject a device card into the BT modal list (called by mobile via injectJS too) */
function addDeviceToUI(name, id, rssi) {
  const list = document.getElementById('deviceList');
  // Clear placeholder text on first real result
  if (list.querySelector('div[style*="text-align:center"]')) {
    list.innerHTML = '';
  }

  // Prevent duplicates: update RSSI if we already have it
  const safeId = id.replace(/:/g, '-');
  let existingCard = document.getElementById('bt-card-' + safeId);
  if (existingCard) {
    existingCard.querySelector('.bt-rssi').innerText = rssi + ' dBm';
    return;
  }

  const card = document.createElement('div');
  card.id = 'bt-card-' + safeId;
  card.className = 'bt-card';
  card.innerHTML = `
        <div>
          <div class="bt-name">${name}</div>
          <div class="bt-mac">${id}</div>
        </div>
        <div class="bt-rssi">${rssi} dBm</div>`;
  card.onclick = () => connectToDevice(id);
  list.prepend(card);
}

/** Unified connect – routes to browser or mobile path */
async function connectToDevice(deviceId) {
  if (isMobileApp()) {
    handleBoardMessage("Connecting…", "SYS");
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "SELECT_DEVICE",
      deviceId: deviceId
    }));
    return;
  }
  await _connectBrowserBLE(deviceId);
}

/** Browser-only Web Bluetooth GATT connect */
async function _connectBrowserBLE(deviceId) {
  try {
    handleBoardMessage("Connecting…", "SYS");
    const device = _foundBLEDevices[deviceId];
    if (!device) throw new Error("Device object not in cache");

    // KEY FIX: If we already have an active GATT session (even to this same
    // device), disconnect it cleanly first. This prevents the old session
    // from delivering stale writes that make MicroPython print help().
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
      try {
        bleDevice.removeEventListener('gattserverdisconnected', _onBLEDisconnect);
        bleDevice.gatt.disconnect(); // synchronous – fires gattserverdisconnected
      } catch (_) { }
      // Small pause to let the disconnect event clear
      await new Promise(r => setTimeout(r, 200));
    }

    bleDevice = device;
    bleGattServer = null;
    bleControlChar = null;
    bleDataChar = null;

    // Remove before adding to avoid duplicate listener accumulation across reconnects
    bleDevice.removeEventListener('gattserverdisconnected', _onBLEDisconnect);
    bleDevice.addEventListener('gattserverdisconnected', _onBLEDisconnect);

    bleGattServer = await bleDevice.gatt.connect();
    const service = await bleGattServer.getPrimaryService(BLE_SERVICE_UUID);

    // ── Write characteristic (browser → ESP32) ────────────────────
    bleControlChar = await service.getCharacteristic(BLE_CONTROL_UUID);

    // ── Notify characteristic (ESP32 → browser) ───────────────────
    // THIS WAS MISSING: without startNotifications() the browser
    // never receives any data back from the board.
    bleDataChar = await service.getCharacteristic(BLE_DATA_UUID);
    await bleDataChar.startNotifications();

    // Line-buffer: ESP32 may split a single logical line across
    // multiple BLE notification packets.
    let _bleRxBuffer = '';
    bleDataChar.addEventListener('characteristicvaluechanged', (event) => {
      const bytes = new Uint8Array(event.target.value.buffer);
      _bleRxBuffer += new TextDecoder().decode(bytes);

      // Split on newlines and dispatch each complete line
      const lines = _bleRxBuffer.split('\n');
      _bleRxBuffer = lines.pop();  // last element = incomplete tail

      for (let raw of lines) {
        const line = raw.replace(/\r/g, '').trim();
        if (!line) continue;
        // Filter out noisy MicroPython REPL artefacts
        if (/^>{2,}/.test(line)) continue;
        if (/^\.{3,}/.test(line)) continue;
        if (line === 'OK' || line === 'MPY: soft reboot') continue;
        handleBoardMessage(line, 'BLE');
      }
    });

    finalizeConnection(bleDevice.name || 'STM32');
  } catch (e) {
    console.error("BLE connect error:", e);
    handleBoardMessage("Connection Failed ❌ " + e.message, "SYS");
  }
}

function _onBLEDisconnect() {
  bleGattServer = null;
  bleControlChar = null;
  bleDataChar = null;
  handleBoardMessage("BLE disconnected", "SYS");
  if (typeof resetRunStopButtons === 'function') resetRunStopButtons();
  const pill = document.getElementById('bt-text');
  if (pill) pill.innerText = "Bluetooth";
}

// --- Data transmission ---
/**
 * Send Python code via BLE.
 * Browser path: chunked 20-byte writes with 15 ms delay (original logic).
 * Mobile path:  delegate to App.js via postMessage.
 */
async function sendCodeToBLEBoot(code) {
  if (!code) return;

  if (isMobileApp()) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "SEND_DATA",
      data: code
    }));
    handleBoardMessage("Uploading via Bluetooth…", "SYS");
    return;
  }

  // ── BROWSER: original chunked write logic ──
  if (!bleControlChar) {
    handleBoardMessage("BLE not connected", "SYS");
    return;
  }

  const encoder = new TextEncoder();
  const payload = encoder.encode(code);

  try {
    // Send START marker
    await bleControlChar.writeValue(encoder.encode("@@START\n"));

    // Send code in safe 500-byte chunks with 15 ms gap to prevent buffer overflow
    for (let i = 0; i < payload.length; i += 500) {
      await bleControlChar.writeValue(payload.slice(i, i + 500));
      await new Promise(r => setTimeout(r, 15));
    }

    // Send END marker
    await bleControlChar.writeValue(encoder.encode("\n@@END"));
    handleBoardMessage("Upload Done! ✅", "SYS");
  } catch (e) {
    console.error("BLE upload error:", e);
    handleBoardMessage("Upload Error ❌", "SYS");
  }
}

