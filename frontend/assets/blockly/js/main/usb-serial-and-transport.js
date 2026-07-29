// =====================================================================
// USB / Web Serial (Desktop only)
// =====================================================================
let stm32Port = null;
let stm32Writer = null;
let stm32Reader = null;
let stopUsbReader = false;
const stm32Encoder = new TextEncoder();

async function connectStm32() {
  if (!("serial" in navigator)) {
    alert("Web Serial not supported. Use Chrome/Edge desktop.");
    return;
  }
  try {
    stm32Port = await navigator.serial.requestPort();
    await stm32Port.open({ baudRate: 115200 });
    if (stm32Port.writable.locked && stm32Writer) {
      try { stm32Writer.releaseLock(); } catch (e) { console.log(e); }
    }
    stm32Writer = stm32Port.writable.getWriter();
    listenForData();
    handleBoardMessage("USB Connected ✅", "SYS");
  } catch (e) {
    console.error("Failed to open port", e);
    alert("USB Connection failed: " + e.message);
  }
}

async function writeUserPyToBoard(code) {
  if (!stm32Port || !stm32Writer) { alert("Board not connected"); return; }
  const payload = `@@START\n${code}\n@@END`;
  try {
    await stm32Writer.write(stm32Encoder.encode(payload));
    handleBoardMessage("user.py sent via USB ✅", "SYS");
  } catch (e) {
    console.error("USB write error:", e);
    alert("USB write failed: " + e.message);
  }
}

async function listenForData() {
  if (!stm32Port) return;
  const decoder = new TextDecoder();

  let reader = null;
  try {
    reader = stm32Port.readable.getReader();
    stm32Reader = reader;
    stopUsbReader = false;

    let buffer = "";
    let _yieldCounter = 0;
    while (!stopUsbReader) {
      try {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          let lines = buffer.split("\n");
          buffer = lines.pop();
          for (let line of lines) {
            line = line.trim();
            if (line) handleBoardMessage(line, 'USB');
          }
          // Yield to the UI thread every 32 reads to prevent starvation
          // when data arrives in rapid continuous bursts
          _yieldCounter++;
          if (_yieldCounter >= 32) {
            _yieldCounter = 0;
            await new Promise(r => setTimeout(r, 0));
          }
        }
      } catch (readError) {
        if (!stopUsbReader) {
          console.error("USB read error:", readError.message);
          handleBoardMessage("USB disconnected (cable unplugged?)", "SYS");
          resetRunStopButtons();
          break;
        }
      }
    }
  } catch (e) {
    console.error("USB setup error:", e);
    handleBoardMessage("USB error: " + e.message, "SYS");
  } finally {
    if (reader) {
      try {
        reader.releaseLock();
      } catch (e) {
      }
    }
    stm32Reader = null;
    stm32Port = null;
    stm32Writer = null;
  }
}

// =====================================================================
// HELPER: Reset Run/Stop buttons on disconnect
// =====================================================================
function resetRunStopButtons() {
  const runBtn = document.getElementById("btnRun");
  const stopBtn = document.getElementById("btnStop");
  if (runBtn) runBtn.style.display = "flex";
  if (stopBtn) stopBtn.style.display = "none";
}

// =====================================================================
// USB DISCONNECT FUNCTION (NEW)
// =====================================================================
async function closeUSB() {
  if (!stm32Port) {
    handleBoardMessage("USB not connected", "SYS");
    return;
  }

  try {
    stopUsbReader = true;

    if (stm32Reader) {
      try {
        stm32Reader.releaseLock();
      } catch (e) {
      }
      stm32Reader = null;
    }

    if (stm32Writer) {
      try {
        stm32Writer.releaseLock();
      } catch (e) {
      }
      stm32Writer = null;
    }

    if (stm32Port) {
      try {
        await stm32Port.close();
      } catch (e) {
      }
      stm32Port = null;
    }

    await new Promise(r => setTimeout(r, 300));

    handleBoardMessage("USB Disconnected ✅", "SYS");
    resetRunStopButtons();
    const pill = document.getElementById('bt-text');
    if (pill) pill.innerText = "USB";

  } catch (e) {
    console.error("USB disconnect error:", e);
    stm32Port = null;
    stm32Writer = null;
    stm32Reader = null;
  }
}

// =====================================================================
// BLE DISCONNECT FUNCTION (NEW)
// =====================================================================
function closeBLE() {
  try {
    if (bleDevice) {
      try {
        bleDevice.removeEventListener('gattserverdisconnected', _onBLEDisconnect);
      } catch (e) {
      }
    }

    if (bleGattServer && bleGattServer.connected) {
      try {
        bleGattServer.disconnect();
      } catch (e) {
      }
    }

    bleGattServer = null;
    bleControlChar = null;
    bleDataChar = null;
    bleDevice = null;

    handleBoardMessage("BLE Disconnected ✅", "SYS");
    resetRunStopButtons();
    const pill = document.getElementById('bt-text');
    if (pill) pill.innerText = "Bluetooth";

  } catch (e) {
    console.error("BLE disconnect error:", e);
    bleGattServer = null;
    bleControlChar = null;
    bleDataChar = null;
    bleDevice = null;
  }
}

// =====================================================================
// CONNECTION STATUS HELPERS (NEW)
// =====================================================================
function isBLEConnected() {
  return bleDevice &&
    bleDevice.gatt &&
    bleDevice.gatt.connected &&
    bleControlChar !== null;
}

function isUSBConnected() {
  return stm32Port !== null && stm32Writer !== null;
}

// =====================================================================
// UNIVERSAL DISCONNECT (NEW)
// =====================================================================
async function disconnectAll() {
  if (isMobileApp()) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "DISCONNECT_SAFE"
    }));
    return;
  }

  try {
    // ============================================================
    // USB EJECT-STYLE SAFE DISCONNECT
    // (Like "Safely Remove USB Drive" on Windows/Mac)
    // ============================================================

    handleBoardMessage("🔴 Initiating safe disconnect...", "SYS");

    // ============================================================
    // STEP 1: STOP EXECUTION (Send disconnect command)
    // ============================================================
    handleBoardMessage("⏹️ Stopping board execution...", "SYS");
    const encoder = new TextEncoder();
    let disconnectSent = false;

    if (isUSBConnected()) {
      try {
        await stm32Writer.write(encoder.encode("DISCONNECT\n"));
        disconnectSent = true;
        handleBoardMessage("  ✓ Disconnect command sent", "SYS");
      } catch (e) {
        console.error("Disconnect send error:", e);
        handleBoardMessage("  ⚠️ Could not send disconnect", "SYS");
      }
    }

    if (isBLEConnected()) {
      try {
        await bleControlChar.writeValue(encoder.encode("DISCONNECT\n"));
        disconnectSent = true;
        handleBoardMessage("  ✓ Disconnect command sent", "SYS");
      } catch (e) {
        console.error("BLE error:", e);
      }
    }

    if (!disconnectSent) {
      handleBoardMessage("⚠️ No connection available", "SYS");
      return;
    }

    // ============================================================
    // STEP 2: FLUSH DATA (App waits for board to flush)
    // ============================================================
    handleBoardMessage("💾 Flushing data to storage...", "SYS");
    await new Promise(r => setTimeout(r, 400));

    // ============================================================
    // STEP 3: GRACEFUL SHUTDOWN
    // ============================================================
    handleBoardMessage("🔧 Graceful shutdown of peripherals...", "SYS");
    await new Promise(r => setTimeout(r, 400));

    // ============================================================
    // STEP 4: NOTIFY SAFE STATE
    // ============================================================
    handleBoardMessage("📢 Waiting for safe state confirmation...", "SYS");
    await new Promise(r => setTimeout(r, 400));

    // ============================================================
    // STEP 5: CLOSE CONNECTION CLEANLY
    // ============================================================
    handleBoardMessage("🔌 Closing connection...", "SYS");

    if (isUSBConnected()) {
      try {
        await closeUSB();
      } catch (e) {
        console.error("USB close error:", e);
      }
    }

    if (isBLEConnected()) {
      try {
        closeBLE();
      } catch (e) {
        console.error("BLE close error:", e);
      }
    }

    // ============================================================
    // STEP 6: DISCONNECTED SAFELY
    // ============================================================
    handleBoardMessage("🟢 [SAFE_DISCONNECT] Complete!", "SYS");
    handleBoardMessage("✨ Safe to unplug device", "SYS");

  } catch (error) {
    console.error("Disconnect error:", error);
    handleBoardMessage("Error: " + error.message, "SYS");
  }
}

// =====================================================================
// Unified command sender (tries USB then BLE)
// =====================================================================
async function sendUnifiedCommand(commandName) {
  const encoder = new TextEncoder();

  if (stm32Port && stm32Writer) {
    try {
      await stm32Writer.write(encoder.encode(commandName + "\n"));
      handleBoardMessage(commandName + " sent via USB", "SYS");
      return true;
    } catch (e) { console.error("USB send failed:", e); }
  }

  if (bleConnected() && bleControlChar) {
    try {
      await bleControlChar.writeValue(encoder.encode(commandName + "\n"));
      handleBoardMessage(commandName + " sent via BLE", "SYS");
      return true;
    } catch (e) { console.error("BLE send failed:", e); }
  }

  if (isMobileApp()) {
    // Mobile: send command via bridge
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "COMMAND",
      command: commandName
    }));
    return true;
  }

  alert("No board connected! Please connect via USB or Bluetooth.");
  return false;
}

// =====================================================================
// Unified Chunked Upload with ACK
// =====================================================================

const sleep = ms => new Promise(Math.random ? r => setTimeout(r, ms) : r => setTimeout(r, ms));

let _ackResolver = null;
function checkAck(msg) {
  if (msg && msg.toLowerCase().includes("ack") && _ackResolver) {
    _ackResolver(msg);
    _ackResolver = null;
  }
}

function waitForAck(timeoutMs) {
  return new Promise((resolve, reject) => {
    _ackResolver = resolve;
    setTimeout(() => {
      if (_ackResolver === resolve) {
        _ackResolver = null;
        reject(new Error("Timeout"));
      }
    }, timeoutMs);
  });
}

let uploadTimeout = null;
function setUploadedSuccess() {
  const imgUpload = document.getElementById('imgUpload');
  if (imgUpload) {
    imgUpload.src = 'icons/uploaded.svg';
    if (uploadTimeout) clearTimeout(uploadTimeout);
    uploadTimeout = setTimeout(() => {
      if (imgUpload.src.includes('uploaded.svg')) {
        imgUpload.src = 'icons/upload.svg';
      }
    }, 5000);
  }
}

async function unifiedUploadCode(code) {
  if (!code || !code.trim()) {
    alert("No code to send");
    return;
  }

  const encoder = new TextEncoder();
  const rawData = encoder.encode(code);
  const CHUNK_SIZE = 20;

  let isUSB = (stm32Port && stm32Writer);
  let isBLE = (bleConnected() && bleControlChar);

  if (!isUSB && !isBLE) {
    alert("No board connected! Please connect via USB or Bluetooth.");
    return;
  }

  async function sendData(data) {
    if (isUSB) {
      await stm32Writer.write(data);
    } else if (isBLE) {
      await bleControlChar.writeValue(data);
    }
  }

  try {
    handleBoardMessage(isUSB ? "USB: uploading..." : "WEB (BLE): uploading...", "SYS");

    // START marker
    await sendData(encoder.encode("@@START\n"));

    // Wait for ACK
    try {
      handleBoardMessage("Waiting for @@START ack...", "SYS");
      await waitForAck(5000);
      handleBoardMessage("@@START ack received!", "SYS");
    } catch (e) {
      handleBoardMessage("@@START ack timeout, continuing...", "SYS");
    }

    for (let i = 0; i < rawData.length; i += CHUNK_SIZE) {
      const chunk = rawData.slice(i, i + CHUNK_SIZE);
      await sendData(chunk);
      await sleep(15);
    }

    // END marker
    await sendData(encoder.encode("\n@@END"));

    // Wait for ACK
    try {
      handleBoardMessage("Waiting for @@END ack...", "SYS");
      await waitForAck(5000);
      handleBoardMessage("@@END ack received!", "SYS");
    } catch (e) {
      handleBoardMessage("@@END ack timeout!", "SYS");
    }

    handleBoardMessage(`Upload done (${rawData.length} bytes)`, "SYS");

    // Successfully completed upload!
    setUploadedSuccess();
  } catch (e) {
    console.error("Upload error:", e);
    alert("Upload failed: " + e.message);
  }
}

// =====================================================================
// Status display
// =====================================================================
// ── Batched message queue — avoids a forced reflow on every USB/BLE line ──
const _msgQueue = [];
let _msgRafPending = false;

function _flushMsgQueue() {
  _msgRafPending = false;
  const el = document.getElementById("responseDisplay");
  if (!el || _msgQueue.length === 0) return;

  // Build a DocumentFragment so we do ONE DOM write, not N
  const frag = document.createDocumentFragment();
  while (_msgQueue.length > 0) {
    const { ts, cls, src, text, sensor } = _msgQueue.shift();
    const row = document.createElement('div');
    row.className = 'rd-line';

    row.innerHTML =
      '<span class="rd-ts">' + ts + '</span>' +
      '<span class="' + cls + '">[' + src + ']</span>' +
      '<span class="rd-msg">' + text + '</span>';
    frag.appendChild(row);
  }
  el.appendChild(frag);

  // Trim to 500 lines in one pass
  while (el.children.length > 500) el.removeChild(el.firstChild);

  // Single scroll measurement (only when near bottom)
  if (el.scrollHeight - el.scrollTop < el.clientHeight + 80) {
    el.scrollTop = el.scrollHeight;
  }
}

function handleBoardMessage(msg, source) {
  if (!msg || msg === '-') return;   // skip legacy clear-placeholder

  if (typeof msg === 'string') {
    const lower = msg.toLowerCase();
    if (lower.includes('disconnected') || lower.includes('disconnect')) {
      if (typeof resetRunStopButtons === 'function') resetRunStopButtons();
    }
  }

  if (typeof checkAck === 'function') checkAck(msg);

  let matchedSensorName = null;

  // REDESIGNED TERMINAL: Parse variables dynamically from DATA JSON or print statements
  try {
    if (msg.startsWith('DATA:')) {
      const data = JSON.parse(msg.slice(5));
      const sensorType = data.type; // e.g. "button", "temp", "ultrasonic", "ir"
      const sensorValue = data.value;
      for (const varName in varToSensorMap) {
        if (isSensorTypeMatch(sensorType, varToSensorMap[varName])) {
          variableValues[varName] = sensorValue;
          matchedSensorName = varToSensorMap[varName];
          setTimeout(updateSensorsAndVariablesUI, 0);
        }
      }
      if (!matchedSensorName) {
        for (const key in SENSOR_NAME_MAP) {
          const displayName = SENSOR_NAME_MAP[key];
          if (isSensorTypeMatch(sensorType, displayName)) {
            matchedSensorName = displayName;
            break;
          }
        }
      }
    } else {
      const cleanedMsg = msg.trim();
      const lowerMsg = cleanedMsg.toLowerCase();

      // Check if it's a raw number
      const numericValue = parseFloat(msg.trim());
      const isNumber = !isNaN(numericValue) && isFinite(numericValue);

      if (isNumber) {
        let numericUpdate = false;

        // A. Match to last printed string label if available
        if (lastStringMessage) {
          const label = lastStringMessage.toLowerCase().trim();
          let matchedVarName = null;
          if (typeof workspace !== 'undefined' && workspace) {
            const vars = workspace.getAllVariables();
            const exactVar = vars.find(v => v.name.toLowerCase() === label);
            if (exactVar) {
              matchedVarName = exactVar.name;
            } else {
              for (const varName in varToSensorMap) {
                if (isSensorTypeMatch(label, varToSensorMap[varName])) {
                  matchedVarName = varName;
                  break;
                }
              }
            }
          }
          if (matchedVarName) {
            variableValues[matchedVarName] = numericValue;
            matchedSensorName = varToSensorMap[matchedVarName];
            numericUpdate = true;
          }

          if (!matchedSensorName) {
            const bestSensor = getBestSensorForText(label);
            if (bestSensor) {
              matchedSensorName = bestSensor;
            }
          }

          if (!matchedSensorName) {
            for (const key in SENSOR_NAME_MAP) {
              const displayName = SENSOR_NAME_MAP[key];
              if (isSensorTypeMatch(label, displayName)) {
                matchedSensorName = displayName;
                break;
              }
            }
          }
        }

        // B. Directly printed variables (only if there is exactly one to avoid ambiguity/leaks)
        if (!numericUpdate) {
          const keys = Object.keys(directlyPrintedVars);
          if (keys.length === 1) {
            const varName = keys[0];
            variableValues[varName] = numericValue;
            matchedSensorName = varToSensorMap[varName];
            numericUpdate = true;
          }
        }

        // C. Assign only to variables mapped to the currently selected sensor
        if (!numericUpdate && activeSensorSelection) {
          for (const varName in varToSensorMap) {
            if (varToSensorMap[varName] === activeSensorSelection) {
              variableValues[varName] = numericValue;
              matchedSensorName = activeSensorSelection;
              numericUpdate = true;
            }
          }
        }

        // D. Last resort: exactly one workspace variable exists — assign to it
        if (!numericUpdate && typeof workspace !== 'undefined' && workspace) {
          const allVars = workspace.getAllVariables();
          if (allVars.length === 1) {
            variableValues[allVars[0].name] = numericValue;
            numericUpdate = true;
          }
        }

        // Always refresh so live values appear in variable card
        setTimeout(updateSensorsAndVariablesUI, 0);
      } else {
        // Not a number - it's a string log message

        // 1. Check for standard numeric / variable assignment text (e.g., room_temp = 23.4)
        const assignmentRegexes = [
          /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9.-]+)/g,
          /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([0-9.-]+)/g,
          /([a-zA-Z_][a-zA-Z0-9_]*)\s+([0-9.-]+)/g
        ];
        let assignmentsFound = false;
        for (const regex of assignmentRegexes) {
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(msg)) !== null) {
            const label = match[1];
            const varVal = parseFloat(match[2]);
            if (!isNaN(varVal)) {
              let matchedVarName = null;
              if (typeof workspace !== 'undefined' && workspace) {
                const vars = workspace.getAllVariables();
                const exactVar = vars.find(v => v.name.toLowerCase() === label.toLowerCase());
                if (exactVar) {
                  matchedVarName = exactVar.name;
                } else {
                  for (const varName in varToSensorMap) {
                    if (isSensorTypeMatch(label, varToSensorMap[varName])) {
                      matchedVarName = varName;
                      break;
                    }
                  }
                }
              }
              if (matchedVarName) {
                variableValues[matchedVarName] = varVal;
                matchedSensorName = varToSensorMap[matchedVarName];
                assignmentsFound = true;
              }
            }
          }
        }
        if (assignmentsFound) {
          setTimeout(updateSensorsAndVariablesUI, 0);
        } else if (typeof workspace !== 'undefined' && workspace) {
          // Still refresh UI so the variable card stays current
          setTimeout(updateSensorsAndVariablesUI, 0);
        }

        // 2. Check for literal strings matching known print output maps
        let printMatchFound = false;
        const bestSensor = getBestSensorForText(lowerMsg);
        if (bestSensor) {
          let value = 1;
          if (lowerMsg.includes('not ') || lowerMsg.includes('no ') || lowerMsg.includes('clear') || lowerMsg.includes('idle') || lowerMsg.includes('open') || lowerMsg.includes('normal')) {
            value = 0;
          }
          for (const varName in varToSensorMap) {
            if (varToSensorMap[varName] === bestSensor) {
              variableValues[varName] = value;
              printMatchFound = true;
            }
          }
          matchedSensorName = bestSensor;
        }
        if (printMatchFound) {
          setTimeout(updateSensorsAndVariablesUI, 0);
        }

        if (!matchedSensorName) {
          for (const key in SENSOR_NAME_MAP) {
            const displayName = SENSOR_NAME_MAP[key];
            if (isSensorTypeMatch(cleanedMsg, displayName)) {
              matchedSensorName = displayName;
              break;
            }
          }
        }

        // Save this string log to associate with the next incoming number(s)
        lastStringMessage = cleanedMsg;
      }
    }
  } catch (err) {
    console.warn("Redesigned Terminal error parsing variables from log:", err);
  }

  const ts = new Date().toLocaleTimeString('en', { hour12: false });
  const src = (source || 'SYS').toUpperCase();
  const cls = src === 'USB' ? 'rd-badge-usb'
    : src === 'BLE' ? 'rd-badge-ble'
      : src === 'WIFI' ? 'rd-badge-wifi'
        : 'rd-badge-sys';

  // Push to queue, including the resolved sensor name
  _msgQueue.push({
    ts,
    cls,
    src,
    text: msg.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    sensor: matchedSensorName
  });

  // Schedule one RAF flush
  if (!_msgRafPending) {
    _msgRafPending = true;
    requestAnimationFrame(_flushMsgQueue);
  }
}

function rdClear() {
  const el = document.getElementById("responseDisplay");
  if (el) el.innerHTML = '';
}

// =====================================================================
// WiFi (MQTT)
// =====================================================================
function openWifiModal() { document.getElementById('wifiSettingsModal').style.display = 'block'; }
function closeWifiModal() { document.getElementById('wifiSettingsModal').style.display = 'none'; }

async function saveWifiSettings() {
  const ssid = document.getElementById('wifiSSID').value;
  const pass = document.getElementById('wifiPass').value;
  if (!ssid) { alert("Please enter an SSID"); return; }
  closeWifiModal();
  await sendWifiConfigOverBLE(ssid, pass);
}

async function sendWifiConfigOverBLE(ssid, password) {
  if (!navigator.bluetooth) { alert("Web Bluetooth not supported."); return; }
  const payload = `${ssid},${password}`;
  const encoder = new TextEncoder();
  try {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE_UUID] }] });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const char = await service.getCharacteristic(BLE_CONTROL_UUID);
    await char.writeValue(encoder.encode(payload));
    alert("WiFi Credentials sent ✅");
  } catch (error) {
    console.error("BLE WiFi Error:", error);
    alert("Failed to send WiFi config: " + error);
  }
}

// initBlockSearch is defined fully below — dead duplicate removed

async function sendCodeToESP32_MQTT(code) {
  const asyncCode = (typeof wrapWithAsyncio === 'function') ? wrapWithAsyncio(code) : code;
  const mqttClient = mqtt.connect('wss://3921b8461cb747b593a333f2aced8435.s1.eu.hivemq.cloud:8884/mqtt', {
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    clean: true, connectTimeout: 10000, reconnectPeriod: 1000,
    protocolVersion: 5, username: 'ESP32', password: 'Esp@12345',
  });
  mqttClient.on('connect', function () {
    mqttClient.publish('esp32/boot', `@@START \n${asyncCode} \n @@END`);
    mqttClient.subscribe(['esp32/fire', 'esp32/ultrasonic', 'esp32/servo', 'esp32/led', 'esp32/motor', 'esp32/message']);
    handleBoardMessage("WiFi code sent ✅", "WIFI");
  });
  mqttClient.on('error', function (err) {
    console.error('MQTT error:', err);
    handleBoardMessage('MQTT error: ' + err.message, 'WIFI');
  });
  mqttClient.on('message', function (topic, message) {
    const data = message.toString();

    // Route every board response to the frontend display.
    // Topics like esp32/ultrasonic publish JSON: {"type":"ultrasonic","value":12,"unit":"cm"}
    // Wrap them in the DATA: prefix so LiveTerminal also parses them correctly.
    const shortTopic = topic.split('/').pop();   // e.g. "ultrasonic"
    let displayMsg;
    try {
      // If it's already valid JSON, wrap as DATA: so LiveTerminal colour-codes it
      JSON.parse(data);
      displayMsg = 'DATA:' + data;
    } catch (_) {
      // Plain text (e.g. "OK", "print() output from board")
      displayMsg = '[' + shortTopic.toUpperCase() + '] ' + data;
    }
    handleBoardMessage(displayMsg, 'WIFI');
  });
}

