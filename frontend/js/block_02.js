// v12: set Blockly.Python alias (runs after python_compressed.js in deferred order)
if (typeof python !== 'undefined' && python.pythonGenerator) {
  Blockly.Python = python.pythonGenerator;
}

let workspace = null;
let pyGen = null; // v12: set after Blockly loads
let defaultToolboxConfig = null;

// =====================================================================
// REDESIGNED TERMINAL PANELS STATE & LOGIC
// =====================================================================
let activeSensorSelection = null;
let varToSensorMap = {};
let printOutputToSensorMap = {};
let directlyPrintedVars = {};
let lastStringMessage = "";
const variableValues = {};

function toggleSensorSelection(sensorName) {
  activeSensorSelection = (activeSensorSelection === sensorName) ? null : sensorName;
  updateSensorsAndVariablesUI();
}

const SENSOR_NAME_MAP = {
  'tep_ana': 'Temperature',
  'ana_temp': 'Temperature',
  'din_temp': 'Temperature',
  'temp_sensor': 'Temperature',
  'sen_temp': 'Temperature',
  'IR-Temp': 'Temperature',
  'ir_temp': 'Temperature',
  'temp2-sensor': 'Temperature',
  'tem_sensor': 'Temperature',
  'humidity': 'Humidity',
  'soil_moisture': 'Soil Moisture',
  'dust': 'Dust',
  'Air_quality_sensor': 'Air Quality',
  'water_sensor': 'Water Sensor',
  'water-turbidity-sensor': 'Turbidity',
  'TDS_Water_sensor': 'Water TDS',
  'pressure': 'Pressure',
  'din_motion': 'Motion',
  'motion': 'Motion',
  'din_proximity': 'Proximity',
  'din_tilt': 'Tilt',
  'din_ultra': 'Ultrasonic',
  'din_ultra_range': 'Ultrasonic',
  'sen_ultrasonic': 'Ultrasonic',
  'accelerometer_sensor': 'Accelerometer',
  'accelerometer': 'Accelerometer',
  'compass': 'Compass',
  'mag_encoder': 'Encoder',
  'gusture': 'Gesture',
  'flex-sensor': 'Flex Sensor',
  'shock_sensor': 'Shock Sensor',
  'vibration-switch-sensor': 'Vibration',
  'joystick_move': 'Joystick',
  'ldr': 'Light (LDR)',
  'din_ir': 'Infrared',
  'ir_sen': 'Infrared',
  'colour_sen': 'Color Sensor',
  'ambient-sen': 'Ambient Light',
  'uv_sensor': 'UV Sensor',
  'light_freq': 'Light Freq',
  'magnetic_sensor': 'Magnetic Sensor',
  'heart_beat': 'Heart Beat',
  'ecg': 'ECG Sensor',
  'max': 'MAX Sensor',
  'din_flame': 'Flame Sensor',
  'flame': 'Flame Sensor',
  'din_door': 'Door Sensor',
  'din_sound': 'Sound Sensor',
  'speaker': 'Speaker',
  'rotation_sensor': 'Rotation Sensor',
  'gsr_skin_current_sensor': 'GSR Skin Current Sensor',
  'line_follower': 'Line Follower',
  'water_level': 'Water Level',
  'solor_panel': 'Solar Panel',
  'admp': 'ADMP 401',
  'uv_sensor_ana': 'UV Sensor analog',
  'ph_sensor': 'pH Sensor',
  'seven_segment': 'seven segment',
  'gas_sensor': 'Gas sensor',
  'lifi_receiver': 'Lifi receiver',
  'lifi_transmitter': 'Lifi transmitter',
  'touch_potentiometer': 'Touch Potentiometer',
  'fm_receiver': 'FM Receiver',
  'sound': 'Sound Sensor',
  'din_button': 'Button',
  'button': 'Button',
  'touch_sensor': 'Touch Sensor',
  'finger_print_enroll': 'Fingerprint',
  'finger_print_match': 'Fingerprint',
  'Current-sensor': 'Current',
  'voltage_sensor': 'Voltage',
  'load_cell': 'Load Cell',
  'flexi_force_sensor': 'Flexi Force',
  'piezo_sensor': 'Piezo',
  'rtc_sensor': 'RTC Clock',
  'rfid': 'RFID',
  'nfc_reader': 'NFC Reader',
  'rc_sensor': 'RC Sensor',
  'xray_sensor': 'X-Ray',
  'sensor': 'Generic Sensor'
};

function getSensorColor(name) {
  const colors = {
    'Temperature': '#EF4444',
    'Humidity': '#10B981',
    'Soil Moisture': '#8B5CF6',
    'Dust': '#6B7280',
    'Air Quality': '#14B8A6',
    'Water Sensor': '#3B82F6',
    'Turbidity': '#F59E0B',
    'Water TDS': '#06B6D4',
    'Pressure': '#EC4899',
    'Motion': '#F97316',
    'Proximity': '#84CC16',
    'Tilt': '#6366F1',
    'Ultrasonic': '#3B82F6',
    'Accelerometer': '#8B5CF6',
    'Compass': '#EAB308',
    'Encoder': '#D946EF',
    'Gesture': '#A855F7',
    'Flex Sensor': '#F43F5E',
    'Shock Sensor': '#10B981',
    'Vibration': '#F97316',
    'Joystick': '#3B82F6',
    'Light (LDR)': '#EAB308',
    'Infrared': '#EF4444',
    'Color Sensor': '#D946EF',
    'Ambient Light': '#EAB308',
    'UV Sensor': '#A855F7',
    'Light Freq': '#EAB308',
    'Magnetic Sensor': '#6366F1',
    'Heart Beat': '#EF4444',
    'ECG Sensor': '#EF4444',
    'MAX Sensor': '#EF4444',
    'Flame Sensor': '#F97316',
    'Door Sensor': '#10B981',
    'Sound Sensor': '#3B82F6',
    'Button': '#EC4899',
    'Touch Sensor': '#84CC16',
    'Fingerprint': '#6B7280',
    'Current': '#F59E0B',
    'Voltage': '#F59E0B',
    'Load Cell': '#6B7280',
    'Flexi Force': '#F43F5E',
    'Piezo': '#14B8A6',
    'RTC Clock': '#6366F1',
    'RFID': '#D946EF',
    'NFC Reader': '#D946EF',
    'RC Sensor': '#06B6D4',
    'X-Ray': '#6B7280',
    'Generic Sensor': '#10B981'
  };
  return colors[name] || '#3D5AE0';
}

function isSensorTypeMatch(rawType, displayName) {
  if (!rawType || !displayName) return false;
  // Normalize: lowercase, strip underscores, spaces, and hyphens
  const rt = rawType.toLowerCase().replace(/[_\s-]/g, '').trim();
  const dn = displayName.toLowerCase().replace(/[_\s-]/g, '').trim();

  if (rt === dn) return true;

  // Custom normalized synonym mappings
  const synonyms = {
    'temp': ['temperature', 'tempsensor', 'temsensor'],
    'temperature': ['temp', 'tem'],
    'ultra': ['ultrasonic', 'ultrarange', 'dist'],
    'ultrasonic': ['ultra', 'dist'],
    'ir': ['infrared', 'irsen', 'irtemp'],
    'infrared': ['ir'],
    'button': ['btn', 'button'],
    'btn': ['button'],
    'air': ['airquality', 'airqualitysensor', 'gas'],
    'gas': ['airquality', 'air'],
    'soil': ['soilmoisture'],
    'soilmoisture': ['soil'],
    'light': ['ldr', 'ambientlight'],
    'ldr': ['light', 'ambientlight'],
    'hum': ['humidity'],
    'humidity': ['hum'],
    'tds': ['watertds', 'watertdssensor'],
    'watertds': ['tds'],
    'uv': ['uvsensor'],
    'uvsensor': ['uv'],
    'ecg': ['ecgsensor'],
    'ecgsensor': ['ecg'],
    'max': ['maxsensor'],
    'maxsensor': ['max'],
    'rtc': ['rtcclock', 'rtcsensor'],
    'rtcclock': ['rtc'],
    'nfc': ['nfcreader'],
    'nfcreader': ['nfc'],
    'rc': ['rcsensor'],
    'rcsensor': ['rc'],
    'xray': ['xray'],
    'colour': ['color', 'colorsensor'],
    'color': ['colour', 'colorsensor'],
    'colorsensor': ['color', 'colour'],
    'motion': ['pir', 'dinmotion'],
    'pir': ['motion'],
    'prox': ['proximity'],
    'proximity': ['prox'],
    'vib': ['vibration'],
    'vibration': ['vib'],
    'flex': ['flexsensor', 'flexiforce'],
    'flexsensor': ['flex'],
    'mag': ['magneticsensor', 'compass'],
    'magneticsensor': ['mag']
  };

  // Exact synonym check
  if (synonyms[rt] && synonyms[rt].includes(dn)) return true;
  if (synonyms[dn] && synonyms[dn].includes(rt)) return true;

  // Prefix checks for common sensors to prevent loose suffix matches (e.g. "air" matches "ir")
  if (dn === 'infrared') {
    if (rt.startsWith('ir') && !rt.startsWith('air')) return true;
  }
  if (dn === 'airquality') {
    if (rt.startsWith('air') || rt.startsWith('gas')) return true;
  }
  if (dn === 'ultrasonic') {
    if (rt.startsWith('ultra') || rt.startsWith('dist')) return true;
  }
  if (dn === 'temperature') {
    if (rt.startsWith('temp') || rt.startsWith('tem')) return true;
  }
  if (dn === 'button') {
    if (rt.startsWith('btn') || rt.startsWith('button')) return true;
  }

  // Fallback prefix checks (4+ chars to avoid false matches)
  if (rt.length >= 4 && dn.startsWith(rt)) return true;
  if (dn.length >= 4 && rt.startsWith(dn)) return true;

  if (synonyms[rt]) {
    for (const syn of synonyms[rt]) {
      if (syn === dn || (syn.length >= 2 && dn.startsWith(syn)) || (dn.length >= 2 && syn.startsWith(dn))) return true;
    }
  }
  if (synonyms[dn]) {
    for (const syn of synonyms[dn]) {
      if (syn === rt || (syn.length >= 2 && rt.startsWith(syn)) || (rt.length >= 2 && syn.startsWith(rt))) return true;
    }
  }

  return false;
}

function getBestSensorForText(text) {
  if (!text) return null;
  const rawText = text.toLowerCase().trim();

  // Sort print keys by length descending to check the most specific first
  const keys = Object.keys(printOutputToSensorMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (rawText.includes(key)) {
      return printOutputToSensorMap[key];
    }
  }
  return null;
}

function updateSensorsAndVariablesUI() {
  if (typeof workspace === 'undefined' || !workspace) return;

  // Re-initialize mappings
  varToSensorMap = {};
  printOutputToSensorMap = {};
  directlyPrintedVars = {};

  const blocks = workspace.getAllBlocks(false);

  // 1. Map variables to sensors
  blocks.forEach(block => {
    if (block.type === 'variables_set') {
      const varId = block.getFieldValue('VAR');
      const varModel = workspace.getVariableById(varId);
      if (varModel) {
        const varName = varModel.name;
        const targetBlock = block.getInputTargetBlock('VALUE');
        if (targetBlock) {
          // Check targetBlock and all its descendants
          const descendants = targetBlock.getDescendants(false);
          for (const d of descendants) {
            if (SENSOR_NAME_MAP[d.type]) {
              varToSensorMap[varName] = SENSOR_NAME_MAP[d.type];
              break;
            }
          }
        }
      }
    }
  });

  // 2. Map print string literals to sensors and detect directly printed variables
  blocks.forEach(block => {
    if (block.type === 'text_print' || block.type === 'text_speech' || block.type === 'text_print_basic' || block.type === 'lp_label' || block.type === 'LCD_print') {
      const inputName = block.type === 'lp_label' ? 'NAME' : (block.getInput('TEXT') ? 'TEXT' : 'VALUE');
      const valueBlock = block.getInputTargetBlock(inputName);
      if (valueBlock) {
        // Collect directly printed variables from descendants
        valueBlock.getDescendants(false).forEach(d => {
          if (d.type === 'variables_get') {
            const varId = d.getFieldValue('VAR');
            const varModel = workspace.getVariableById(varId);
            if (varModel) {
              directlyPrintedVars[varModel.name] = true;
            }
          }
        });

        // Also check if any_input_block refers directly to a variable name (like printing variable temp)
        if (valueBlock.type === 'any_input_block') {
          let literalVal = valueBlock.getFieldValue('ANY');
          if (literalVal) {
            literalVal = literalVal.replace(/^["']|["']$/g, '').trim();
            const allVars = workspace.getAllVariables();
            if (allVars.some(v => v.name === literalVal)) {
              directlyPrintedVars[literalVal] = true;
            }
          }
        }

        if (valueBlock.type === 'text' || valueBlock.type === 'any_input_block') {
          const fieldName = valueBlock.type === 'any_input_block' ? 'ANY' : 'TEXT';
          let textValue = valueBlock.getFieldValue(fieldName);
          if (textValue) {
            // Strip quotes if present
            textValue = textValue.replace(/^["']|["']$/g, '').toLowerCase().trim();

            // Find parent IF block to associate with a sensor variable
            let parent = block.getParent();
            let associatedSensor = null;
            while (parent) {
              if (parent.type === 'controls_if' || parent.type === 'din_if_else' || parent.type === 'custom_if_then') {
                const checkCondition = (inputName) => {
                  const condBlock = parent.getInputTargetBlock(inputName);
                  if (condBlock) {
                    condBlock.getDescendants(false).forEach(d => {
                      if (d.type === 'variables_get') {
                        const varId = d.getFieldValue('VAR');
                        const varModel = workspace.getVariableById(varId);
                        if (varModel && varToSensorMap[varModel.name]) {
                          associatedSensor = varToSensorMap[varModel.name];
                        }
                      } else if (SENSOR_NAME_MAP[d.type]) {
                        associatedSensor = SENSOR_NAME_MAP[d.type];
                      }
                    });
                  }
                };
                checkCondition('IF0');
                checkCondition('IF1');
                checkCondition('IF2');
                checkCondition('COND'); // 'COND' is used by din_if_else
                checkCondition('CONDITION');
              }
              parent = parent.getParent();
            }
            if (associatedSensor) {
              printOutputToSensorMap[textValue] = associatedSensor;
            }
          }
        }
      }
    }
  });

  // Pre-seed common default heuristics for prints
  if (!printOutputToSensorMap['pressed']) printOutputToSensorMap['pressed'] = 'Button';
  if (!printOutputToSensorMap['not pressed']) printOutputToSensorMap['not pressed'] = 'Button';
  if (!printOutputToSensorMap['detected']) printOutputToSensorMap['detected'] = 'Infrared';
  if (!printOutputToSensorMap['not detected']) printOutputToSensorMap['not detected'] = 'Infrared';
  if (!printOutputToSensorMap['person detected']) printOutputToSensorMap['person detected'] = 'Ultrasonic';
  if (!printOutputToSensorMap['no person detected']) printOutputToSensorMap['no person detected'] = 'Ultrasonic';
  if (!printOutputToSensorMap['gas detected']) printOutputToSensorMap['gas detected'] = 'Air Quality';
  if (!printOutputToSensorMap['normal']) printOutputToSensorMap['normal'] = 'Air Quality';

  // 3. SENSORS CARD RENDER
  // Build uniqueSensors first so name-based variable mapping can use it
  const uniqueSensors = new Set();
  blocks.forEach(b => {
    if (SENSOR_NAME_MAP[b.type]) {
      uniqueSensors.add(SENSOR_NAME_MAP[b.type]);
    }
  });

  // Name-based variable → sensor mapping (e.g. variable "ultra" → "Ultrasonic")
  workspace.getAllVariables().forEach(v => {
    if (!varToSensorMap[v.name]) {
      uniqueSensors.forEach(sensorDisplay => {
        if (isSensorTypeMatch(v.name, sensorDisplay)) {
          varToSensorMap[v.name] = sensorDisplay;
        }
      });
    }
  });

  const sensorContainer = document.getElementById('term-sensors-body');
  if (sensorContainer) {
    if (uniqueSensors.size > 0) {
      let html = '<div class="sensor-pills-list">';
      uniqueSensors.forEach(name => {
        const isActive = activeSensorSelection === name;
        const color = getSensorColor(name);
        html += '<button class="sensor-pill ' + (isActive ? 'active' : '') + '" onclick="toggleSensorSelection(\'' + name + '\')">' +
          '<span class="sensor-pill-dot" style="background:' + color + '; box-shadow: 0 0 4px ' + color + '"></span>' +
          name + '</button>';
      });
      html += '</div>';
      sensorContainer.innerHTML = html;
    } else {
      sensorContainer.innerHTML =
        '<div class="term-empty-state">' +
        '  <div class="term-empty-icon"><i class="fa-solid fa-wifi"></i></div>' +
        '  <div class="term-empty-text">No Sensor added</div>' +
        '</div>';
    }
  }

  // 4. VARIABLES CARD RENDER
  const variableContainer = document.getElementById('term-variables-body');
  if (variableContainer) {
    if (!activeSensorSelection) {
      variableContainer.innerHTML =
        '<div class="term-empty-state">' +
        '  <div class="term-empty-icon"><span>{x}</span></div>' +
        '  <div class="term-empty-text">Select a sensor to view variables</div>' +
        '</div>';
    } else {
      const allVars = workspace.getAllVariables();
      // prefer variables explicitly mapped to this sensor; fall back to all variables
      const mapped = allVars.filter(v => varToSensorMap[v.name] === activeSensorSelection);
      const toShow = mapped.length > 0 ? mapped : allVars;
      if (toShow.length > 0) {
        let html = '<div class="variable-rows-list">';
        toShow.forEach(v => {
          const val = variableValues[v.name] !== undefined ? variableValues[v.name] : '—';
          html += '<div class="variable-row">' +
            '  <span class="variable-name">' + v.name + '</span>' +
            '  <span class="variable-value">' + val + '</span>' +
            '</div>';
        });
        html += '</div>';
        variableContainer.innerHTML = html;
      } else {
        variableContainer.innerHTML =
          '<div class="term-empty-state">' +
          '  <div class="term-empty-icon"><span>{x}</span></div>' +
          '  <div class="term-empty-text">No variables in workspace</div>' +
          '</div>';
      }
    }
  }
}


function resetToolboxAndAIClasses() {
  window._aiTrainedClasses = null;
  window._aiTrainedBoard = null;
  window._voiceTrainedClasses = null;
  window._poseTrainedClasses = null;

  try {
    sessionStorage.removeItem('curio_ai_trained');
    sessionStorage.removeItem('curio_voice_trained');
    sessionStorage.removeItem('curio_pose_trained');
  } catch (e) { }

  if (typeof defaultToolboxConfig !== 'undefined' && defaultToolboxConfig) {
    window.toolboxConfig = JSON.parse(JSON.stringify(defaultToolboxConfig));
    if (typeof workspace !== 'undefined' && workspace) {
      try {
        workspace.updateToolbox(window.toolboxConfig);
      } catch (e) {
        console.warn('resetToolbox updateToolbox error:', e);
      }
    }
  }

  // Also reset block definitions to their default options (Class1/Class2)
  if (typeof Blockly !== 'undefined' && Blockly.Blocks) {
    const opts = [['Class1', 'Class1'], ['Class2', 'Class2']];

    if (Blockly.Blocks['ai_class_result']) {
      delete Blockly.Blocks['ai_class_result'];
      Blockly.defineBlocksWithJsonArray([{
        type: 'ai_class_result',
        message0: 'classifying result is %1',
        args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
        colour: '#7c3aed', output: 'Boolean',
        tooltip: 'Returns true if the camera sees this class.',
      }]);
    }

    if (Blockly.Blocks['ai_class_reliability']) {
      delete Blockly.Blocks['ai_class_reliability'];
      Blockly.defineBlocksWithJsonArray([{
        type: 'ai_class_reliability',
        message0: 'reliability of %1',
        args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
        colour: '#7c3aed', output: 'Number',
        tooltip: 'Returns 0–100 confidence score for this class.',
      }]);
    }

    if (Blockly.Blocks['ai_classify_image']) {
      delete Blockly.Blocks['ai_classify_image'];
      Blockly.defineBlocksWithJsonArray([{
        type: 'ai_classify_image',
        message0: 'classify image → result %1',
        args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
        colour: '#f54254', previousStatement: null, nextStatement: null,
        tooltip: 'Run AI classification on camera feed.',
      }]);
    }

    // Reset the board-specific (K230/S3) variants the same way
    ['k230', 's3'].forEach(function (board) {
      const tag = board.toUpperCase();

      const resultType = 'ai_class_result_' + board;
      if (Blockly.Blocks[resultType]) {
        delete Blockly.Blocks[resultType];
        Blockly.defineBlocksWithJsonArray([{
          type: resultType,
          message0: tag + ': classifying result is %1',
          args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
          colour: '#7c3aed', output: 'Boolean',
          tooltip: 'Returns true if the ' + tag + ' camera sees this class.',
        }]);
      }

      const reliabilityType = 'ai_class_reliability_' + board;
      if (Blockly.Blocks[reliabilityType]) {
        delete Blockly.Blocks[reliabilityType];
        Blockly.defineBlocksWithJsonArray([{
          type: reliabilityType,
          message0: tag + ': reliability of %1',
          args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
          colour: '#7c3aed', output: 'Number',
          tooltip: 'Returns 0–100 confidence score for this class on ' + tag + '.',
        }]);
      }

      const classifyType = 'ai_classify_image_' + board;
      if (Blockly.Blocks[classifyType]) {
        delete Blockly.Blocks[classifyType];
        Blockly.defineBlocksWithJsonArray([{
          type: classifyType,
          message0: tag + ': classify image → result %1',
          args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
          colour: '#f54254', previousStatement: null, nextStatement: null,
          tooltip: 'Run AI classification on the ' + tag + ' camera feed.',
        }]);
      }
    });

    // Clean up dynamically added voice/pose blocks if any
    const voicePoseBlocks = [
      'voice_heard', 'voice_confidence', 'voice_classify',
      'pose_detected', 'pose_confidence', 'pose_classify'
    ];
    voicePoseBlocks.forEach(bType => {
      if (Blockly.Blocks[bType]) delete Blockly.Blocks[bType];
    });
  }
}

function prepareSaveData() {
  const state = Blockly.serialization.workspaces.save(workspace);
  return {
    workspaceState: state,
    aiTrainedClasses: window._aiTrainedClasses || null,
    aiTrainedBoard: window._aiTrainedBoard || null,
    voiceTrainedClasses: window._voiceTrainedClasses || null,
    poseTrainedClasses: window._poseTrainedClasses || null
  };
}

async function waitForBlockly(timeoutMs = 15000) {
  // With v12 CDN script tags, Blockly loads synchronously before the page
  // `load` event fires — no chained callbacks needed. We still poll briefly
  // in case the CDN response is slow on first load.
  const t0 = Date.now();
  while (!(window.Blockly && window.Blockly.Python)) {
    await new Promise(r => setTimeout(r, 100));
    if (Date.now() - t0 > timeoutMs) {
      console.error('Blockly load timed out after', timeoutMs, 'ms');
      break;
    }
  }
  pyGen = window.Blockly && window.Blockly.Python;
  // Keep Blockly.Python in sync — any code that still references it gets the real object
  if (pyGen && window.Blockly) window.Blockly.Python = pyGen;
  return !!(window.Blockly && window.Blockly.Python);
}

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

// =====================================================================
// PORT / MOTOR / SERVO / LED MODALS
// =====================================================================
let currentPortBlock = null;
const ALL_PORT_NUMBERS = ["D3", "D4", "D5", "D6", "E3", "G4", "G5", "G6", "D7", "E0", "E1", "G3", "G0", "G1", "G2"];

function openPortSelectionModal(block) {
  currentPortBlock = block;
  const txt = block.getFieldValue('PORTS') || '';
  const selectedSet = new Set(txt.split(',').map(s => s.trim()).filter(Boolean));
  ALL_PORT_NUMBERS.forEach(p => {
    const cb = document.getElementById('port' + p);
    if (cb) cb.checked = selectedSet.has(String(p));
  });
  document.getElementById('portSelectionModal').style.display = 'block';
}
function closePortModal() { document.getElementById('portSelectionModal').style.display = 'none'; currentPortBlock = null; }
function savePortSelection() {
  if (!currentPortBlock) { closePortModal(); return; }
  const sel = [];
  ALL_PORT_NUMBERS.forEach(p => { const cb = document.getElementById('port' + p); if (cb && cb.checked) sel.push(String(p)); });
  currentPortBlock.setFieldValue(sel.length ? sel.join(',') : '', 'PORTS');
  closePortModal();
}

let currentMotorBlock = null;
function openMotorSelectionModal(block) {
  currentMotorBlock = block;
  const rawTxt = block.getFieldValue('MOTORS') || '';

  ['P1', 'P2', 'P3', 'P4'].forEach(p => {
    const cb = document.getElementById('motor' + p);
    if (cb) cb.checked = false;
  });

  if (rawTxt.includes('E11') || rawTxt.includes('E12')) {
    const cb = document.getElementById('motorP1');
    if (cb) cb.checked = true;
  }
  if (rawTxt.includes('B8') || rawTxt.includes('B9')) {
    const cb = document.getElementById('motorP2');
    if (cb) cb.checked = true;
  }
  if (rawTxt.includes('E13') || rawTxt.includes('B15')) {
    const cb = document.getElementById('motorP3');
    if (cb) cb.checked = true;
  }
  if (rawTxt.includes('D15') || rawTxt.includes('E14')) {
    const cb = document.getElementById('motorP4');
    if (cb) cb.checked = true;
  }

  document.getElementById('motorSelectionModal').style.display = 'block';
}
function closeModal() { document.getElementById('motorSelectionModal').style.display = 'none'; }
function saveMotorSelection() {
  if (!currentMotorBlock) { closeModal(); return; }
  const selected = [];

  const cb1 = document.getElementById('motorP1');
  if (cb1 && cb1.checked) selected.push('E11,E12');

  const cb2 = document.getElementById('motorP2');
  if (cb2 && cb2.checked) selected.push('B9,B8');

  const cb3 = document.getElementById('motorP3');
  if (cb3 && cb3.checked) selected.push('E13,B15');

  const cb4 = document.getElementById('motorP4');
  if (cb4 && cb4.checked) selected.push('D15,E14');

  currentMotorBlock.setFieldValue(selected.length ? selected.join(',') : '', 'MOTORS');
  closeModal();
}

let currentLedBlock = null;
const LED_PIN_NAMES = ['C0', 'C1', 'C2', 'F9', 'A3', 'F3', 'F4', 'F5', 'C4', 'C5', 'A1', 'A2', 'A4', 'F8', 'A6'];
function openLedPinSelectionModal(block) {
  currentLedBlock = block;
  const txt = block.getFieldValue('PORTS') || '';
  const selected = new Set(txt.split(',').map(s => s.trim()).filter(Boolean));
  LED_PIN_NAMES.forEach(pin => { const cb = document.getElementById('ledPin' + pin); if (cb) cb.checked = selected.has(pin); });
  document.getElementById('ledPinSelectionModal').style.display = 'flex';
}
function closeLedPinModal() { document.getElementById('ledPinSelectionModal').style.display = 'none'; currentLedBlock = null; }
function saveLedPinSelection() {
  if (!currentLedBlock) { closeLedPinModal(); return; }
  const sel = [];
  LED_PIN_NAMES.forEach(pin => { const cb = document.getElementById('ledPin' + pin); if (cb && cb.checked) sel.push(pin); });
  currentLedBlock.setFieldValue(sel.length ? sel.join(',') : '', 'PORTS');
  closeLedPinModal();
}

// ── Speedometer ──
let speedStep = 0, speedPercent = 0, angle = 0, lastTouchX = null;
function addclass() {
  let ele = document.querySelector(".arrow-wrapper");
  if (!ele) return;
  for (let i = 1; i <= 7; i++) ele.classList.remove("arrow-speed-" + i);
  ele.classList.add("arrow-speed-" + speedStep);
}
function fast() { const f = document.getElementById("speed-val"); if (f) f.innerText = speedPercent + "%"; }
function updateGaugeUI() {
  const arrow = document.querySelector(".arrow-wrapper");
  if (arrow) arrow.style.transform = `rotate(${angle}deg)`;
  for (let i = 1; i <= 7; i++) {
    const scale = document.querySelector(".speed-scale-" + i);
    if (scale) { if (speedStep >= i - 1) scale.classList.add("active"); else scale.classList.remove("active"); }
  }
  if (typeof updateMotor3DSpeed === 'function') updateMotor3DSpeed();
}
function inspeed() {
  if (speedStep < 6) {
    speedStep++; speedPercent = Math.min(100, Math.round(speedStep * 16.6));
    angle = speedStep * 30; addclass(); fast(); updateGaugeUI();
    if (typeof updateMotor3DSpeed === 'function') updateMotor3DSpeed();
  }
}
function despeed() {
  if (speedStep > 0) {
    speedStep--; speedPercent = Math.round(speedStep * 16.6);
    angle = speedStep * 30; addclass(); fast(); updateGaugeUI();
  }
}
function setSpeedByStep(t) { t = Math.max(0, Math.min(6, t)); while (speedStep < t) inspeed(); while (speedStep > t) despeed(); }
function bindSpeedControls() {
  const inc = document.getElementById("btnIncrease");
  const dec = document.getElementById("btnDecrease");
  if (inc) inc.onclick = (e) => { e.stopPropagation(); inspeed(); };
  if (dec) dec.onclick = (e) => { e.stopPropagation(); despeed(); };
}
function bindSpeedoTouch() {
  const gauge = document.getElementById("speedoGauge");
  if (!gauge) return;
  gauge.style.touchAction = "none";
  gauge.onpointerdown = (e) => {
    if (e.target.closest("button")) return;
    const rect = gauge.getBoundingClientRect();
    let t = Math.round((e.clientX - rect.left) / rect.width * 6);
    setSpeedByStep(t); lastTouchX = e.clientX;
  };
  gauge.onpointermove = (e) => {
    if (lastTouchX === null) return;
    const diff = e.clientX - lastTouchX;
    if (diff > 25) { inspeed(); lastTouchX = e.clientX; }
    else if (diff < -25) { despeed(); lastTouchX = e.clientX; }
  };
  gauge.onpointerup = () => { lastTouchX = null; };
  gauge.onpointerleave = () => { lastTouchX = null; };
}
window.addEventListener("DOMContentLoaded", () => { bindSpeedControls(); bindSpeedoTouch(); });

// ══════════════════════════════════════════════════════════════
// 3D DC Motor + Wheel Simulation (Three.js r128) — Bright Theme
// ══════════════════════════════════════════════════════════════
let motor3D = { scene: null, camera: null, renderer: null, wheelGroup: null, motorGroup: null, targetRPM: 0, currentRPM: 0, animId: null, initialized: false };

function initMotor3D() {
  if (motor3D.initialized) return;
  const canvas = document.getElementById('motor3DCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = 220, H = 220;
  canvas.width = W * 2; canvas.height = H * 2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8f4f8);
  // Soft gradient fog
  scene.fog = new THREE.Fog(0xe8f4f8, 8, 18);

  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  camera.position.set(3.5, 2.0, 4.5);
  camera.lookAt(0, 0.2, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(2);
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0xe8f4f8, 1);

  // Bright warm lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xfff5e6, 0.85);
  dirLight.position.set(4, 6, 4);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0xe0f0ff, 0.35);
  fillLight.position.set(-3, 4, -2);
  scene.add(fillLight);
  const rimLight = new THREE.PointLight(0xffe0c0, 0.3, 12);
  rimLight.position.set(3, 1, -3);
  scene.add(rimLight);

  // Soft ground plane
  const groundGeo = new THREE.PlaneGeometry(14, 14);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xd4e8ef, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.85;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── DC Motor Body ──
  const motorGroup = new THREE.Group();

  // Motor cylinder body — clean silver-gray
  const motorBodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.3, 32);
  const motorBodyMat = new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.6, roughness: 0.35 });
  const motorBody = new THREE.Mesh(motorBodyGeo, motorBodyMat);
  motorBody.rotation.z = Math.PI / 2;
  motorBody.castShadow = true;
  motorGroup.add(motorBody);

  // Motor front cap
  const capGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 32);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.7, roughness: 0.25 });
  const frontCap = new THREE.Mesh(capGeo, capMat);
  frontCap.rotation.z = Math.PI / 2;
  frontCap.position.x = 0.68;
  motorGroup.add(frontCap);

  // Motor back cap
  const backCap = new THREE.Mesh(capGeo, capMat);
  backCap.rotation.z = Math.PI / 2;
  backCap.position.x = -0.68;
  motorGroup.add(backCap);

  // Motor shaft — gold colored
  const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 16);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.85, roughness: 0.15 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 1.05;
  motorGroup.add(shaft);

  // Motor terminals (back) — red and blue
  const termGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8);
  const termMatR = new THREE.MeshStandardMaterial({ color: 0xef5350, metalness: 0.5, roughness: 0.4 });
  const termMatB = new THREE.MeshStandardMaterial({ color: 0x42a5f5, metalness: 0.5, roughness: 0.4 });
  const term1 = new THREE.Mesh(termGeo, termMatR);
  term1.position.set(-0.82, 0.15, 0.12);
  motorGroup.add(term1);
  const term2 = new THREE.Mesh(termGeo, termMatB);
  term2.position.set(-0.82, 0.15, -0.12);
  motorGroup.add(term2);

  // Motor accent ring — orange
  const ringGeo = new THREE.TorusGeometry(0.39, 0.02, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xff7043, metalness: 0.7, roughness: 0.2 });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.rotation.y = Math.PI / 2;
  ring1.position.x = 0.3;
  motorGroup.add(ring1);
  const ring2 = ring1.clone();
  ring2.position.x = -0.3;
  motorGroup.add(ring2);

  // Motor mounting bracket
  const bracketGeo = new THREE.BoxGeometry(0.8, 0.08, 0.9);
  const bracketMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.5, roughness: 0.4 });
  const bracket = new THREE.Mesh(bracketGeo, bracketMat);
  bracket.position.y = -0.42;
  bracket.castShadow = true;
  motorGroup.add(bracket);

  // Mounting feet
  const footGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.4, roughness: 0.5 });
  [-0.35, 0.35].forEach(zz => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(0, -0.62, zz);
    foot.castShadow = true;
    motorGroup.add(foot);
  });

  motorGroup.position.set(-0.6, 0.2, 0);
  scene.add(motorGroup);

  // ── Racing Wheel (attached to shaft) ──
  const wheelGroup = new THREE.Group();

  // Tire — dark charcoal
  const tireGeo = new THREE.TorusGeometry(0.62, 0.18, 20, 48);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.85, metalness: 0.1 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  // Tire tread pattern
  for (let i = 0; i < 36; i++) {
    const treadAngle = (i / 36) * Math.PI * 2;
    const treadGeo = new THREE.BoxGeometry(0.02, 0.04, 0.38);
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.95 });
    const tread = new THREE.Mesh(treadGeo, treadMat);
    tread.position.set(Math.cos(treadAngle) * 0.62, Math.sin(treadAngle) * 0.62, 0);
    tread.rotation.z = treadAngle;
    wheelGroup.add(tread);
  }

  // Rim — bright silver
  const rimGeo = new THREE.TorusGeometry(0.45, 0.05, 12, 48);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.9, roughness: 0.1 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheelGroup.add(rim);

  // Inner rim ring
  const innerRimGeo = new THREE.TorusGeometry(0.2, 0.04, 12, 32);
  const innerRim = new THREE.Mesh(innerRimGeo, rimMat);
  wheelGroup.add(innerRim);

  // 5 Y-shaped spokes — bright chrome
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.9, roughness: 0.08 });
  for (let i = 0; i < 5; i++) {
    const spokeAngle = (i / 5) * Math.PI * 2;
    const spokeGeo = new THREE.BoxGeometry(0.05, 0.3, 0.04);
    const spoke = new THREE.Mesh(spokeGeo, spokeMat);
    spoke.position.set(Math.cos(spokeAngle) * 0.32, Math.sin(spokeAngle) * 0.32, 0);
    spoke.rotation.z = spokeAngle;
    wheelGroup.add(spoke);
    const brGeo = new THREE.BoxGeometry(0.035, 0.16, 0.035);
    const brL = new THREE.Mesh(brGeo, spokeMat);
    brL.position.set(Math.cos(spokeAngle + 0.18) * 0.4, Math.sin(spokeAngle + 0.18) * 0.4, 0);
    brL.rotation.z = spokeAngle + 0.3;
    wheelGroup.add(brL);
    const brR = new THREE.Mesh(brGeo, spokeMat);
    brR.position.set(Math.cos(spokeAngle - 0.18) * 0.4, Math.sin(spokeAngle - 0.18) * 0.4, 0);
    brR.rotation.z = spokeAngle - 0.3;
    wheelGroup.add(brR);
  }

  // Center hub
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 24);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, metalness: 0.9, roughness: 0.05 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.rotation.x = Math.PI / 2;
  wheelGroup.add(hub);

  // Center nut — orange accent
  const nutGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.15, 6);
  const nutMat = new THREE.MeshStandardMaterial({ color: 0xff7043, metalness: 0.7, roughness: 0.2 });
  const nut = new THREE.Mesh(nutGeo, nutMat);
  nut.rotation.x = Math.PI / 2;
  wheelGroup.add(nut);

  // Wheel disc
  const discGeo = new THREE.CircleGeometry(0.44, 32);
  const discMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.z = -0.03;
  wheelGroup.add(disc);

  wheelGroup.rotation.y = Math.PI / 2;
  wheelGroup.position.set(1.0, 0.2, 0);
  scene.add(wheelGroup);

  // ── Orbit drag ──
  let isDrag = false, prevM = { x: 0, y: 0 };
  let camTheta = 0.65, camPhi = 0.5, camDist = 6.5;
  function updateCam() {
    camera.position.x = camDist * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.y = camDist * Math.cos(camPhi);
    camera.position.z = camDist * Math.sin(camPhi) * Math.sin(camTheta);
    camera.lookAt(0.2, 0.1, 0);
  }
  canvas.addEventListener('pointerdown', (e) => { isDrag = true; prevM = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!isDrag) return; camTheta += (e.clientX - prevM.x) * 0.01; camPhi = Math.max(0.3, Math.min(1.4, camPhi + (e.clientY - prevM.y) * 0.01)); prevM = { x: e.clientX, y: e.clientY }; updateCam(); });
  canvas.addEventListener('pointerup', () => { isDrag = false; });
  canvas.addEventListener('pointerleave', () => { isDrag = false; });

  motor3D.scene = scene; motor3D.camera = camera; motor3D.renderer = renderer;
  motor3D.wheelGroup = wheelGroup; motor3D.motorGroup = motorGroup; motor3D.initialized = true;
  animateMotor3D();
}

function updateMotor3DSpeed() {
  motor3D.targetRPM = speedPercent / 100 * 12;
}

function animateMotor3D() {
  if (!motor3D.initialized) return;
  motor3D.animId = requestAnimationFrame(animateMotor3D);
  motor3D.currentRPM += (motor3D.targetRPM - motor3D.currentRPM) * 0.06;
  if (Math.abs(motor3D.currentRPM) < 0.01 && motor3D.targetRPM === 0) motor3D.currentRPM = 0;
  if (motor3D.wheelGroup) motor3D.wheelGroup.rotation.z += motor3D.currentRPM * 0.02;
  motor3D.renderer.render(motor3D.scene, motor3D.camera);
}

function destroyMotor3D() {
  if (motor3D.animId) cancelAnimationFrame(motor3D.animId);
  if (motor3D.renderer) motor3D.renderer.dispose();
  motor3D = { scene: null, camera: null, renderer: null, wheelGroup: null, motorGroup: null, targetRPM: 0, currentRPM: 0, animId: null, initialized: false };
}

// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
// 3D Servo Motor Simulation (Three.js r128) ΓÇö Angle-based
// ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
let servo3D = { scene: null, camera: null, renderer: null, hornGroup: null, targetAngle: 0, currentAngle: 0, animId: null, initialized: false };

function initServo3D() {
  if (servo3D.initialized) return;
  const canvas = document.getElementById('servo3DCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = 220, H = 220;
  canvas.width = W * 2; canvas.height = H * 2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4e8);
  scene.fog = new THREE.Fog(0xf0f4e8, 8, 18);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  camera.position.set(2.5, 3.0, 5.0);
  camera.lookAt(0, 0.3, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(2);
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0xf0f4e8, 1);

  // Warm bright lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirL = new THREE.DirectionalLight(0xfff8e1, 0.85);
  dirL.position.set(5, 7, 4); dirL.castShadow = true;
  scene.add(dirL);
  const fillL = new THREE.DirectionalLight(0xe8f5e9, 0.3);
  fillL.position.set(-4, 3, -2);
  scene.add(fillL);

  // Ground
  const gndGeo = new THREE.PlaneGeometry(14, 14);
  const gndMat = new THREE.MeshStandardMaterial({ color: 0xdce8d0, roughness: 0.95 });
  const gnd = new THREE.Mesh(gndGeo, gndMat);
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.6; gnd.receiveShadow = true;
  scene.add(gnd);

  // ΓöÇΓöÇ Servo Motor Body ΓöÇΓöÇ
  const servoGroup = new THREE.Group();

  // Main body ΓÇö blue
  const bodyGeo = new THREE.BoxGeometry(0.9, 0.75, 1.5);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, metalness: 0.3, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  servoGroup.add(body);

  // Body edge highlight
  const edgeGeo = new THREE.BoxGeometry(0.92, 0.04, 1.52);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, metalness: 0.4, roughness: 0.4 });
  const topEdge = new THREE.Mesh(edgeGeo, edgeMat);
  topEdge.position.y = 0.375;
  servoGroup.add(topEdge);

  // Mounting tabs (flanges)
  const tabGeo = new THREE.BoxGeometry(1.5, 0.07, 0.3);
  const tabMat = new THREE.MeshStandardMaterial({ color: 0x1976d2, metalness: 0.3, roughness: 0.5 });
  const tab = new THREE.Mesh(tabGeo, tabMat);
  tab.position.set(0, -0.1, 0.7);
  tab.castShadow = true;
  servoGroup.add(tab);

  // Mounting holes on tabs
  const holeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, metalness: 0.5, roughness: 0.3 });
  [-0.58, 0.58].forEach(xx => {
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(xx, -0.1, 0.7);
    servoGroup.add(hole);
  });

  // Wire harness ΓÇö 3 colored wires
  const wireColors = [0xef5350, 0x43a047, 0xff8f00]; // red, green, orange
  wireColors.forEach((col, i) => {
    const wGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8);
    const wMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
    const w = new THREE.Mesh(wGeo, wMat);
    w.position.set(-0.1 + i * 0.1, -0.1, -1.1);
    servoGroup.add(w);
  });

  // Wire connector block
  const connGeo = new THREE.BoxGeometry(0.4, 0.12, 0.15);
  const connMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.6 });
  const conn = new THREE.Mesh(connGeo, connMat);
  conn.position.set(0, -0.1, -1.5);
  servoGroup.add(conn);

  // Output shaft cylinder (on top)
  const shaftBase = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 24);
  const shaftBaseMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, metalness: 0.8, roughness: 0.15 });
  const sBase = new THREE.Mesh(shaftBase, shaftBaseMat);
  sBase.position.set(0.15, 0.45, 0.35);
  servoGroup.add(sBase);

  // Shaft gear ring
  const gearRingGeo = new THREE.TorusGeometry(0.17, 0.015, 8, 24);
  const gearRingMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.85, roughness: 0.1 });
  const gearRing = new THREE.Mesh(gearRingGeo, gearRingMat);
  gearRing.rotation.x = Math.PI / 2;
  gearRing.position.set(0.15, 0.53, 0.35);
  servoGroup.add(gearRing);

  // Label stripe on body
  const labelGeo = new THREE.BoxGeometry(0.91, 0.2, 0.02);
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.8 });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 0.1, 0.76);
  servoGroup.add(label);

  servoGroup.position.set(0, 0, 0);
  scene.add(servoGroup);

  // ΓöÇΓöÇ Servo Horn (rotating arm) ΓöÇΓöÇ
  const hornGroup = new THREE.Group();

  // Horn base disc
  const hornBaseGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 20);
  const hornBaseMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.7, roughness: 0.2 });
  const hornBase = new THREE.Mesh(hornBaseGeo, hornBaseMat);
  hornGroup.add(hornBase);

  // Main horn arm ΓÇö white
  const armGeo = new THREE.BoxGeometry(0.12, 0.06, 0.85);
  const armMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, metalness: 0.2, roughness: 0.5 });
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.position.set(0, 0, 0.4);
  arm.castShadow = true;
  hornGroup.add(arm);

  // Horn rounded tip
  const tipGeo = new THREE.SphereGeometry(0.065, 12, 8);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, metalness: 0.2, roughness: 0.5 });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.set(0, 0, 0.82);
  hornGroup.add(tip);

  // Horn screw holes
  [0.22, 0.45, 0.65].forEach(zz => {
    const screwGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.07, 8);
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.8, roughness: 0.2 });
    const screw = new THREE.Mesh(screwGeo, screwMat);
    screw.position.set(0, 0, zz);
    hornGroup.add(screw);
  });

  // Center screw ΓÇö green accent
  const cScrewGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6);
  const cScrewMat = new THREE.MeshStandardMaterial({ color: 0x43a047, metalness: 0.7, roughness: 0.2 });
  const cScrew = new THREE.Mesh(cScrewGeo, cScrewMat);
  cScrew.position.y = 0.04;
  hornGroup.add(cScrew);

  // Angle indicator arrow on horn
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0);
  arrowShape.lineTo(-0.04, -0.06);
  arrowShape.lineTo(0.04, -0.06);
  arrowShape.lineTo(0, 0);
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.02, bevelEnabled: false });
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xff7043 });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.035, 0.15);
  hornGroup.add(arrow);

  hornGroup.position.set(0.15, 0.56, 0.35);
  scene.add(hornGroup);

  // ΓöÇΓöÇ Angle arc indicator (on ground, subtle) ΓöÇΓöÇ
  const arcGeo = new THREE.RingGeometry(0.9, 1.0, 48, 1, 0, Math.PI);
  const arcMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
  const arc = new THREE.Mesh(arcGeo, arcMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.set(0.15, 0.57, 0.35);
  scene.add(arc);

  // ΓöÇΓöÇ Orbit drag ΓöÇΓöÇ
  let isDragS = false, prevMS = { x: 0, y: 0 };
  let sCamTheta = 0.5, sCamPhi = 0.45, sCamDist = 5.8;
  function updateSCam() {
    camera.position.x = sCamDist * Math.sin(sCamPhi) * Math.cos(sCamTheta);
    camera.position.y = sCamDist * Math.cos(sCamPhi);
    camera.position.z = sCamDist * Math.sin(sCamPhi) * Math.sin(sCamTheta);
    camera.lookAt(0.1, 0.3, 0);
  }
  canvas.addEventListener('pointerdown', (e) => { isDragS = true; prevMS = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!isDragS) return; sCamTheta += (e.clientX - prevMS.x) * 0.01; sCamPhi = Math.max(0.2, Math.min(1.3, sCamPhi + (e.clientY - prevMS.y) * 0.01)); prevMS = { x: e.clientX, y: e.clientY }; updateSCam(); });
  canvas.addEventListener('pointerup', () => { isDragS = false; });
  canvas.addEventListener('pointerleave', () => { isDragS = false; });

  servo3D.scene = scene; servo3D.camera = camera; servo3D.renderer = renderer;
  servo3D.hornGroup = hornGroup; servo3D.initialized = true;
  animateServo3D();
}

function updateServo3DAngle() {
  // currentServoAngle is 0..360
  servo3D.targetAngle = currentServoAngle * (Math.PI / 180);
}

function animateServo3D() {
  if (!servo3D.initialized) return;
  servo3D.animId = requestAnimationFrame(animateServo3D);
  // Smooth interpolation ΓÇö horn rotates on Y axis
  servo3D.currentAngle += (servo3D.targetAngle - servo3D.currentAngle) * 0.1;
  if (servo3D.hornGroup) servo3D.hornGroup.rotation.y = -servo3D.currentAngle;
  servo3D.renderer.render(servo3D.scene, servo3D.camera);
}

function destroyServo3D() {
  if (servo3D.animId) cancelAnimationFrame(servo3D.animId);
  if (servo3D.renderer) servo3D.renderer.dispose();
  servo3D = { scene: null, camera: null, renderer: null, hornGroup: null, targetAngle: 0, currentAngle: 0, animId: null, initialized: false };
}

// ΓöÇΓöÇ Dedicated Soil Moisture Popup Modal 3D Logic ΓöÇΓöÇ
let soilMoisturePopupState = {
  block: null, initialized: false,
  scene: null, camera: null, renderer: null,
  model: null, animId: null,
  isDragging: false, theta: 0.6, phi: 0.55, radius: 3.8,
  prevX: 0, prevY: 0
};

let currentSoilMoistureBlock = null;
const SOIL_POPUP_PIN_NAMES = ['C0', 'C1', 'C2', 'F9', 'A3', 'F3', 'F4', 'F5', 'C4', 'C5', 'A1', 'A2', 'A4', 'F8', 'A6'];

function openSoilMoisturePopupModal(block) {
  currentSoilMoistureBlock = block;
  const txt = block.getFieldValue('PORTS') || '';
  const selected = new Set(txt.split(',').map(s => s.trim()).filter(Boolean));
  SOIL_POPUP_PIN_NAMES.forEach(pin => {
    const cb = document.getElementById('soil_pop_' + pin);
    if (cb) cb.checked = selected.has(pin);
  });
  document.getElementById('soilMoisturePopupModal').style.display = 'flex';
  setTimeout(() => { initSoilMoisturePopup3D(); }, 60);
}

function closeSoilMoisturePopup() {
  destroySoilMoisturePopup3D();
  document.getElementById('soilMoisturePopupModal').style.display = 'none';
  currentSoilMoistureBlock = null;
}

function saveSoilMoisturePopup() {
  if (!currentSoilMoistureBlock) { closeSoilMoisturePopup(); return; }
  const sel = [];
  SOIL_POPUP_PIN_NAMES.forEach(pin => {
    const cb = document.getElementById('soil_pop_' + pin);
    if (cb && cb.checked) sel.push(pin);
  });
  currentSoilMoistureBlock.setFieldValue(sel.length ? sel.join(',') : '', 'PORTS');
  closeSoilMoisturePopup();
}

function initSoilMoisturePopup3D() {
  if (soilMoisturePopupState.initialized) return;
  const canvas = document.getElementById('soilMoisturePopupCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = 240, H = 240;
  canvas.width = W * 2; canvas.height = H * 2;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfcfcfc);
  scene.fog = new THREE.Fog(0xfcfcfc, 10, 22);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0xfcfcfc, 1);

  // Studio lighting rig
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const hemiL = new THREE.HemisphereLight(0xffffff, 0xe8f5e9, 0.95);
  scene.add(hemiL);
  const keyL = new THREE.DirectionalLight(0xfffaed, 1.8);
  keyL.position.set(5, 8, 6);
  keyL.castShadow = true;
  keyL.shadow.mapSize.set(1024, 1024);
  keyL.shadow.bias = -0.001;
  scene.add(keyL);
  const fillL = new THREE.DirectionalLight(0xe6f7ff, 0.85);
  fillL.position.set(-6, 3, 4);
  scene.add(fillL);
  const rimL = new THREE.DirectionalLight(0x50ffaa, 1.25);
  rimL.position.set(0, 4, -8);
  scene.add(rimL);

  function updatePopupSoilCam() {
    const r = soilMoisturePopupState.radius;
    const ph = soilMoisturePopupState.phi;
    const th = soilMoisturePopupState.theta;
    camera.position.set(
      r * Math.sin(ph) * Math.sin(th),
      r * Math.cos(ph) + 0.4,
      r * Math.sin(ph) * Math.cos(th)
    );
    camera.lookAt(0, 0, 0);
  }
  updatePopupSoilCam();

  // Load GLB model from base64
  if (typeof THREE.GLTFLoader !== 'undefined') {
    try {
      const blobUrl = 'assets/models/soil_sensor.glb';

      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('offline_libs/draco/');
      const loader = new THREE.GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      loader.load(
        blobUrl,
        function (gltf) {
          URL.revokeObjectURL(blobUrl);
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          model.position.sub(center);
          model.scale.setScalar(2.4 / maxDim);
          model.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(model);
          soilMoisturePopupState.model = model;
        },
        undefined,
        function (err) {
          console.error('[SoilMoisturePopup] GLB load error:', err);
          URL.revokeObjectURL(blobUrl);
        }
      );
    } catch (e) {
      console.error('[SoilMoisturePopup] Error parsing GLB base64:', e);
    }
  }

  // Pointer drag controls (static rotation)
  canvas.addEventListener('pointerdown', e => {
    soilMoisturePopupState.isDragging = true;
    soilMoisturePopupState.prevX = e.clientX;
    soilMoisturePopupState.prevY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!soilMoisturePopupState.isDragging) return;
    soilMoisturePopupState.theta -= (e.clientX - soilMoisturePopupState.prevX) * 0.008;
    soilMoisturePopupState.phi = Math.max(0.15, Math.min(
      Math.PI / 2.1,
      soilMoisturePopupState.phi - (e.clientY - soilMoisturePopupState.prevY) * 0.006
    ));
    soilMoisturePopupState.prevX = e.clientX;
    soilMoisturePopupState.prevY = e.clientY;
    updatePopupSoilCam();
  });
  canvas.addEventListener('pointerup', () => { soilMoisturePopupState.isDragging = false; });
  canvas.addEventListener('pointerleave', () => { soilMoisturePopupState.isDragging = false; });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    soilMoisturePopupState.radius = Math.max(1.5, Math.min(10.0,
      soilMoisturePopupState.radius + e.deltaY * 0.003));
    updatePopupSoilCam();
  }, { passive: false });

  soilMoisturePopupState.scene = scene;
  soilMoisturePopupState.camera = camera;
  soilMoisturePopupState.renderer = renderer;
  soilMoisturePopupState.initialized = true;

  function renderLoop() {
    if (!soilMoisturePopupState.initialized || !soilMoisturePopupState.renderer) return;
    soilMoisturePopupState.renderer.render(soilMoisturePopupState.scene, soilMoisturePopupState.camera);
    soilMoisturePopupState.animId = requestAnimationFrame(renderLoop);
  }
  renderLoop();
}

function destroySoilMoisturePopup3D() {
  if (soilMoisturePopupState.animId) cancelAnimationFrame(soilMoisturePopupState.animId);
  if (soilMoisturePopupState.renderer) soilMoisturePopupState.renderer.dispose();
  soilMoisturePopupState = {
    scene: null, camera: null, renderer: null, model: null, animId: null, initialized: false,
    isDragging: false, theta: 0.6, phi: 0.55, radius: 3.8, prevX: 0, prevY: 0
  };
}

let currentUnifiedBlock = null;
function openUnifiedModal(block) {
  currentUnifiedBlock = block;
  const currentMotors = (block.getFieldValue('MOTORS') || '').split(',').map(s => s.trim());
  ['E12', 'E11', 'B8', 'B9', 'B15', 'E13', 'E14', 'D15'].forEach(m => {
    const cb = document.getElementById('uni_motor' + m);
    if (cb) cb.checked = currentMotors.includes(m);
  });
  let val = parseInt(block.getFieldValue('SPEED')) || 0;
  speedPercent = val; speedStep = Math.min(6, Math.round(val / 16.6)); angle = speedStep * 30;
  fast(); addclass(); updateGaugeUI();
  document.getElementById('unifiedMotorModal').style.display = 'flex';
  bindSpeedControls(); bindSpeedoTouch();
  // Init 3D motor after modal is visible so canvas has dimensions
  setTimeout(() => { initMotor3D(); updateMotor3DSpeed(); }, 50);
}
function closeUnifiedModal() { destroyMotor3D(); document.getElementById('unifiedMotorModal').style.display = 'none'; currentUnifiedBlock = null; }
function saveUnifiedSelection() {
  if (!currentUnifiedBlock) { closeUnifiedModal(); return; }
  const selected = [];
  ['E12', 'E11', 'B8', 'B9', 'B15', 'E13', 'E14', 'D15'].forEach(m => { const cb = document.getElementById('uni_motor' + m); if (cb && cb.checked) selected.push(m); });
  currentUnifiedBlock.setFieldValue(selected.length ? selected.join(',') : '', 'MOTORS');
  currentUnifiedBlock.setFieldValue(speedPercent, 'SPEED');
  closeUnifiedModal();
}

/* ==== THIS IS FOR KEYPAD PINS ==== */
let currentkeyBlock = null;
let currentSelectedKeyArray = [];
const KEY_PIN_NAMES = ['A3', 'E3', 'E12', 'E11', 'F3', 'G4', 'C8', 'C9', 'F4', 'G5', 'B15', 'E13', 'F5', 'G6', 'E14', 'D15'];

function _syncKpLabel(cb) {
  if (!cb) return;
  const lbl = cb.closest('.kp-pin-label');
  if (lbl) lbl.classList.toggle('kp-checked', cb.checked);
}

function openkeyPinSelectionModal(block) {
  currentkeyBlock = block;

  const txt = block.getFieldValue('PORTS') || '';
  currentSelectedKeyArray = txt.split(',').map(s => s.trim()).filter(Boolean);
  const selected = new Set(currentSelectedKeyArray);

  KEY_PIN_NAMES.forEach(pin => {
    const cb = document.getElementById('keyPin' + pin);
    if (cb) {
      cb.checked = selected.has(pin);
      _syncKpLabel(cb);
      cb.onchange = (e) => {
        _syncKpLabel(e.target);
        if (e.target.checked) {
          if (!currentSelectedKeyArray.includes(pin)) currentSelectedKeyArray.push(pin);
        } else {
          currentSelectedKeyArray = currentSelectedKeyArray.filter(x => x !== pin);
        }
      };
    }
  });

  document.getElementById('keyPinSelectionModal').style.display = 'flex';
}

function closekeyPinModal() {
  document.getElementById('keyPinSelectionModal').style.display = 'none';
  currentkeyBlock = null;
}

function savekeyPinSelection() {
  if (!currentkeyBlock) {
    closekeyPinModal();
    return;
  }

  const label = currentSelectedKeyArray.length ? currentSelectedKeyArray.join(',') : '';
  currentkeyBlock.setFieldValue(label, 'PORTS');   // ≡ƒö┤ changed PINS ΓåÆ PORTS

  closekeyPinModal();
}

// ΓöÇΓöÇ Servo Modal ΓöÇΓöÇ
let currentServoBlock = null, currentServoAngle = 0, isDragging = false;
const MAX_ANGLE_LIMIT = 360;
function openServoSelectionModal(block) {
  currentServoBlock = block;
  const savedPorts = (block.getFieldValue('SERVO_PORT') || '').split(',').map(s => s.trim());
  document.querySelectorAll('#servoSelectionModal input[name="servoPort"]').forEach(cb => { cb.checked = savedPorts.includes(cb.value); });
  currentServoAngle = parseInt(block.getFieldValue('ANG')) || 0;
  updateServoUI();
  document.getElementById('servoSelectionModal').style.display = 'flex';
  initServoTouchControls();
  setTimeout(() => { initServo3D(); updateServo3DAngle(); }, 50);
}
function initServoTouchControls() {
  const meter = document.querySelector('.servo-meter');
  if (!meter) return;
  meter.onpointerdown = (e) => { isDragging = true; calculateAngleFromEvent(e, meter); meter.setPointerCapture(e.pointerId); };
  meter.onpointermove = (e) => { if (!isDragging) return; calculateAngleFromEvent(e, meter); };
  meter.onpointerup = () => { isDragging = false; };
  meter.onpointercancel = () => { isDragging = false; };
}
function calculateAngleFromEvent(e, element) {
  const rect = element.getBoundingClientRect();
  const x = e.clientX - (rect.left + rect.width / 2);
  const y = e.clientY - (rect.top + rect.height / 2);
  let a = Math.atan2(y, x) * (180 / Math.PI) + 90;
  if (a < 0) a += 360;
  currentServoAngle = Math.round(a);
  updateServoUI();
}
function changeServoAngle(amount) {
  currentServoAngle = Math.max(0, Math.min(MAX_ANGLE_LIMIT, currentServoAngle + amount));
  updateServoUI();
}
function updateServoUI() {
  const at = document.getElementById("angle-text");
  if (at) at.innerText = currentServoAngle + "°";
  const fill = document.getElementById("servoFill");
  if (fill) fill.style.setProperty('--angle', currentServoAngle + 'deg');
  const needle = document.getElementById("servoNeedle");
  if (needle) needle.style.transform = `rotate(${currentServoAngle}deg)`;
  if (servo3D.initialized) updateServo3DAngle();
}
function saveServoSelection() {
  if (!currentServoBlock) return;
  const selected = [];
  document.querySelectorAll('#servoSelectionModal input[name="servoPort"]').forEach(cb => { if (cb.checked) selected.push(cb.value); });
  currentServoBlock.setFieldValue(selected.join(','), 'SERVO_PORT');
  currentServoBlock.setFieldValue(currentServoAngle.toString(), 'ANG');
  closeServoModal();
}
function closeServoModal() { destroyServo3D(); document.getElementById('servoSelectionModal').style.display = 'none'; currentServoBlock = null; }

// =====================================================================
// GRADIENTS & SHADOWS (v12 multi-layer fix)
// =====================================================================
const CURIO_GRAD_CSS = `
        /* Only target the FIRST .blocklyPath — extra paths must stay hidden */
        .defult_style > .blocklyPath:first-of-type  { fill: #2685BF           !important; stroke: #2685BF; stroke-width:1px; }
        .led_style    > .blocklyPath:first-of-type  { fill: #BF0B2C           !important; stroke: #8C041D; stroke-width:1px; }
        .dummy_block  > .blocklyPath:first-of-type  { fill: #79A637           !important; stroke: #79A637; stroke-width:1px; }
        .delay_style  > .blocklyPath:first-of-type  { fill: #FB913B           !important; stroke: #C8671A; stroke-width:1px; }
        .logic_style  > .blocklyPath:first-of-type  { fill: #04B6D4           !important; stroke: #0290A8; stroke-width:1px; }
        .llm_style    > .blocklyPath:first-of-type  { fill: #F49E09           !important; stroke: #B87504; stroke-width:1px; }
        .list_style   > .blocklyPath:first-of-type  { fill: #0FB881           !important; stroke: #0B8F64; stroke-width:1px; }
        .block_dc     > .blocklyPath:first-of-type  { fill: #6265F0           !important; stroke: #4A4DC8; stroke-width:1px; }
        .temp_style   > .blocklyPath:first-of-type  { fill: #0FB881           !important; stroke: #0B8F64; stroke-width:1px; }
        .block-servo  > .blocklyPath:first-of-type  { fill: #F266C1           !important; stroke: #F266C1; stroke-width:1px; }
        .i2c_style    > .blocklyPath:first-of-type  { fill: #8A5BF7           !important; stroke: #5D37B0; stroke-width:1px; }
        .ultra_style  > .blocklyPath:first-of-type  { fill: #593A28           !important; stroke: #593A28; stroke-width:1px; }
        .digital_style > .blocklyPath:first-of-type  { fill: #E57333           !important; stroke: #B84E18; stroke-width:1px; }
        .pwm_style    > .blocklyPath:first-of-type  { fill: #F49E09           !important; stroke: #B87504; stroke-width:1px; }
        .led_category_style > .blocklyPath:first-of-type  { fill: #22C45D           !important; stroke: #15803D; stroke-width:1px; }
        .txrx_category_style > .blocklyPath:first-of-type  { fill: #3B82F6           !important; stroke: #1D4ED8; stroke-width:1px; }
        .spi_category_style > .blocklyPath:first-of-type  { fill: #EB4899           !important; stroke: #BE185D; stroke-width:1px; }
        .variable_style > .blocklyPath:first-of-type  { fill: #E9B308           !important; stroke: #B88A00; stroke-width:1px; }
        /* Hide duplicate overlay paths */
        .blocklyDraggable > .blocklyPath ~ .blocklyPath { fill: none !important; stroke: none !important; opacity: 0 !important; pointer-events: none !important; }
      `;

const CURIO_GRAD_DEFS = `
        <filter id="blueShadow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="#2685BF"/></filter>
        <filter id="dcshodow"     x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="#D97A07"/></filter>
        <filter id="loopshodow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="#6265F0"/></filter>
        <filter id="ledshodow"    x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="5" stdDeviation="5" flood-color="#D99CA7"/></filter>
        <filter id="servoshodow"  x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="#F279BC"/></filter>
        <filter id="dummyshadow"  x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#79A637"/></filter>
        <filter id="delayshodow"  x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#FB913B"/></filter>
        <filter id="logicshodow"  x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#04B6D4"/></filter>
        <filter id="llmshodow"    x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#F49E09"/></filter>
        <filter id="listshodow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#0FB881"/></filter>
        <filter id="tempshadow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#0FB881"/></filter>
        <filter id="variableshadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#E9B308"/></filter>
        <filter id="i2cshadow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#8A5BF7"/></filter>
        <filter id="ultrashowdow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="2" stdDeviation="5" flood-color="#8B22A8"/></filter>
        <filter id="digitalShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#c15b22"/></filter>
        <filter id="pwmShadow"    x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#F49E09"/></filter>
        <filter id="ledsShadow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#22C45D"/></filter>
        <filter id="txrxShadow"   x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#3B82F6"/></filter>
        <filter id="spiShadow"    x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="2" dy="3" stdDeviation="5" flood-color="#EB4899"/></filter>
      `;

// Shadow map kept for the direct-setAttribute fallback path
const BLOCK_SHADOW_MAP = {
  // blue shadow
  start: 'logicshodow',
  sim_solar: 'blueShadow', sim_pendulum: 'blueShadow', sim_particles: 'blueShadow',
  sim_dna: 'blueShadow', sim_gears: 'blueShadow', sim_wave: 'blueShadow',
  sim_bouncing: 'blueShadow', sim_windmill: 'blueShadow', sim_atom: 'blueShadow',
  sim_globe: 'blueShadow',

  // ledshodow
  port_on: 'ledshodow', port_off: 'ledshodow',
  sen_ultrasonic: 'ledshodow', sen_temp: 'ledshodow',

  // servoshodow
  do_onoff: 'servoshodow', bt_send: 'servoshodow',
  din_temp: 'tempshadow', flex_sensor: 'tempshadow', flexi_force_sensor: 'tempshadow',
  humidity: 'tempshadow', joystick_move: 'tempshadow', shock_sensor: 'tempshadow',
  TDS_Water_sensor: 'tempshadow', water_sensor: 'tempshadow',
  'water-turbidity-sensor': 'tempshadow', Air_quality_sensor: 'tempshadow',
  'flex-sensor': 'tempshadow', piezo_sensor: 'tempshadow', din_ultra_range: 'tempshadow', ana_flame: 'tempshadow',

  // delayshodow
  ctl_delay: 'delayshodow',
  // llmshodow
  llm_text: 'llmshodow',
  // listshodow
  list_create_empty: 'listshodow', list_create_with: 'listshodow', list_add: 'listshodow',
  list_get: 'listshodow', list_set: 'listshodow', list_remove: 'listshodow',
  list_delete_all: 'listshodow', list_insert: 'listshodow', list_length: 'listshodow',
  list_isEmpty: 'listshodow', list_contains: 'listshodow', list_indexOf: 'listshodow',
  list_show: 'listshodow',
  // dummyshadow
  // logicshodow
  din_if_else: 'logicshodow', custom_if_then: 'logicshodow', any_input_block: 'logicshodow',
  system_status: 'logicshodow', logical_comparison: 'logicshodow',

  // loopshodow (loop blocks)
  lp_while: 'loopshodow', lp_break: 'loopshodow', lp_continue: 'loopshodow', lp_repeat_count: 'loopshodow',
  lp_label: 'loopshodow', lp_start: 'loopshodow', compare: 'loopshodow',
  // dcshodow (DC motor blocks)
  bike_model: 'dcshodow', do_dc_motor: 'dcshodow', do_dc_motor2: 'dcshodow',
  do_servo: 'dcshodow',

  // ultrashowdow
  sensor: 'ultrashowdow', tem_sensor: 'ultrashowdow', xray_sensor: 'ultrashowdow',
  rc_sensor: 'ultrashowdow',

  // tempshadow
  ana_temp: 'tempshadow', 'Current-sensor': 'tempshadow',
  din_ultra: 'tempshadow', dust: 'tempshadow', ecg: 'tempshadow', heart_beat: 'tempshadow',
  'IR-Temp': 'tempshadow', ldr: 'tempshadow', water_level: 'tempshadow',
  loop_end: 'tempshadow', soil_moisture: 'tempshadow', solor_panel: 'tempshadow', admp: 'tempshadow',
  tank_motor: 'tempshadow', 'temp2-sensor': 'tempshadow', tep_ana: 'tempshadow',
  'vibration-switch-sensor': 'tempshadow', voltage_sensor: 'tempshadow', water_motor: 'tempshadow',
  uv_sensor_ana: 'tempshadow',
  ph_sensor: 'tempshadow',


  // ledsShadow
  do_led_param: 'ledsShadow', do_led: 'ledsShadow', red_led: 'ledsShadow',
  yellow_led: 'ledsShadow', green_led: 'ledsShadow', light_freq: 'ledsShadow',
  rgb_display: 'ledsShadow', rgb_led_display: 'ledsShadow', rgb_component: 'ledsShadow',
  LCD_print: 'ledsShadow',

  // txrxShadow
  finger_print_enroll: 'txrxShadow', finger_print_match: 'txrxShadow', keypad: 'txrxShadow',
  gps: 'txrxShadow', gsm: 'txrxShadow', tof: 'txrxShadow', soli_npk: 'txrxShadow',

  // spiShadow
  rfid: 'spiShadow', tft: 'spiShadow',

  magnetic_sensor: 'i2cshadow', colour_sen: 'i2cshadow', accelerometer_sensor: 'i2cshadow',
  rtc_sensor: 'i2cshadow', 'ambient-sen': 'i2cshadow', LCD: 'i2cshadow',
  pressure: 'i2cshadow', compass: 'i2cshadow', ceprom: 'i2cshadow',
  gusture: 'i2cshadow', ir_temp: 'i2cshadow', motor_driver: 'i2cshadow',
  nfc_reader: 'i2cshadow', mag_encoder: 'i2cshadow', rfc: 'i2cshadow',
  text_speech: 'i2cshadow', temp_sensor: 'i2cshadow',
  accelerometer: 'i2cshadow', max: 'i2cshadow', seven_segment: 'i2cshadow',
  gas_sensor: 'i2cshadow',
  lifi_receiver: 'i2cshadow',
  lifi_transmitter: 'i2cshadow',
  touch_potentiometer: 'i2cshadow',
  fm_receiver: 'i2cshadow',
  gsr_skin_current_sensor: 'i2cshadow',
  line_follower: 'i2cshadow',

  din_sound: 'digitalShadow', speaker: 'digitalShadow', din_tilt: 'digitalShadow', din_door: 'digitalShadow',
  rotation_sensor: 'digitalShadow',
  din_button: 'digitalShadow', din_motion: 'digitalShadow', din_proximity: 'digitalShadow',
  din_ir: 'digitalShadow', din_flame: 'digitalShadow', load_cell: 'digitalShadow',
  steper: 'digitalShadow', waterpump: 'digitalShadow', solinoid: 'digitalShadow',
  animo: 'digitalShadow', relay: 'digitalShadow', buzzer: 'digitalShadow',
  minifan: 'digitalShadow', buzzer_component: 'digitalShadow', ir_sen: 'digitalShadow',
  touch_sensor: 'digitalShadow', peltier: 'digitalShadow', microwave_sensor: 'digitalShadow',

  // tempshadow — list blocks (green glow #0FB881)
  list_create_empty: 'tempshadow', list_create_with: 'tempshadow',
  list_add: 'tempshadow', list_get: 'tempshadow', list_set: 'tempshadow',
  list_remove: 'tempshadow', list_delete_all: 'tempshadow', list_insert: 'tempshadow',
  list_length: 'tempshadow', list_isEmpty: 'tempshadow', list_contains: 'tempshadow',
  list_indexOf: 'tempshadow', list_show: 'tempshadow',
  variables_get: 'variableshadow', variables_set: 'variableshadow', math_change: 'variableshadow',
  list_variable_set: 'tempshadow', list_variable_get: 'tempshadow',
};

// CSS class -> solid color map
const CLASS_COLOR_MAP = {
  'defult_style': '#2685BF',
  'led_style': '#BF0B2C',
  'dummy_block': '#79A637',
  'delay_style': '#FB913B',
  'logic_style': '#04B6D4',
  'llm_style': '#F49E09',
  'list_style': '#0FB881',
  'block_dc': '#6265F0',
  'temp_style': '#0FB881',
  'variable_style': '#E9B308',
  'block-servo': '#F266C1',
  'i2c_style': '#8A5BF7',
  'ultra_style': '#593A28',
  'digital_style': '#E57333',
  'pwm_style': '#F49E09',
  'led_category_style': '#22C45D',
  'txrx_category_style': '#3B82F6',
  'spi_category_style': '#EB4899'
};

// Block type ΓåÆ CSS class (mirrors mkStyleExt registrations)
// ΓöÇΓöÇ COMPLETE MAP: every block type that has a style extension ΓöÇΓöÇ
const BLOCK_CLASS_MAP = {
  // defult_style (blue gradient)
  start: 'logic_style',
  sim_solar: 'defult_style', sim_pendulum: 'defult_style', sim_particles: 'defult_style',
  sim_dna: 'defult_style', sim_gears: 'defult_style', sim_wave: 'defult_style',
  sim_bouncing: 'defult_style', sim_windmill: 'defult_style', sim_atom: 'defult_style',
  sim_globe: 'defult_style',

  // led_style
  port_on: 'led_style', port_off: 'led_style',
  sen_ultrasonic: 'led_style', sen_temp: 'led_style',

  // delay_style
  ctl_delay: 'delay_style',
  // llm_style
  llm_text: 'llm_style',
  // list_style
  list_create_empty: 'list_style', list_create_with: 'list_style', list_add: 'list_style',
  list_get: 'list_style', list_set: 'list_style', list_remove: 'list_style',
  list_delete_all: 'list_style', list_insert: 'list_style', list_length: 'list_style',
  list_isEmpty: 'list_style', list_contains: 'list_style', list_indexOf: 'list_style',
  list_show: 'list_style',
  // dummy_block

  // block_dc
  lp_while: 'block_dc', lp_break: 'block_dc', lp_continue: 'block_dc', lp_repeat_count: 'block_dc',
  lp_label: 'block_dc', lp_start: 'block_dc', compare: 'block_dc',

  // block-servo
  do_onoff: 'block-servo', bt_send: 'block-servo',

  // pwm_style
  bike_model: 'pwm_style', do_dc_motor: 'pwm_style', do_dc_motor2: 'pwm_style',
  do_servo: 'pwm_style',

  // led_category_style
  do_led_param: 'led_category_style', do_led: 'led_category_style', red_led: 'led_category_style',
  yellow_led: 'led_category_style', green_led: 'led_category_style', light_freq: 'led_category_style',
  rgb_display: 'led_category_style', rgb_led_display: 'led_category_style', rgb_component: 'led_category_style',
  LCD_print: 'led_category_style',

  // txrx_category_style
  finger_print_enroll: 'txrx_category_style', finger_print_match: 'txrx_category_style', keypad: 'txrx_category_style',
  gps: 'txrx_category_style', gsm: 'txrx_category_style', tof: 'txrx_category_style', soli_npk: 'txrx_category_style',

  // spi_category_style
  rfid: 'spi_category_style', tft: 'spi_category_style',
  din_temp: 'temp_style', flex_sensor: 'temp_style', flexi_force_sensor: 'temp_style',
  humidity: 'temp_style', joystick_move: 'temp_style', shock_sensor: 'temp_style',
  TDS_Water_sensor: 'temp_style', water_sensor: 'temp_style',
  'water-turbidity-sensor': 'temp_style', Air_quality_sensor: 'temp_style',
  'flex-sensor': 'temp_style', piezo_sensor: 'temp_style', din_ultra_range: 'temp_style', ana_flame: 'temp_style',

  // ultra_style
  sensor: 'ultra_style', tem_sensor: 'ultra_style', xray_sensor: 'ultra_style',
  rc_sensor: 'ultra_style',

  // logic_style
  din_if_else: 'logic_style', custom_if_then: 'logic_style', any_input_block: 'logic_style',
  system_status: 'logic_style', logical_comparison: 'logic_style',

  // temp_style
  ana_temp: 'temp_style', 'Current-sensor': 'temp_style',
  din_ultra: 'temp_style', dust: 'temp_style', ecg: 'temp_style', heart_beat: 'temp_style',
  'IR-Temp': 'temp_style', ldr: 'temp_style',
  loop_end: 'temp_style', soil_moisture: 'temp_style',
  tank_motor: 'temp_style', 'temp2-sensor': 'temp_style', tep_ana: 'temp_style',
  water_level: 'temp_style', solor_panel: 'temp_style', admp: 'temp_style',
  'vibration-switch-sensor': 'temp_style', voltage_sensor: 'temp_style', water_motor: 'temp_style',
  uv_sensor_ana: 'temp_style',
  ph_sensor: 'temp_style',

  // i2c_style
  magnetic_sensor: 'i2c_style', colour_sen: 'i2c_style', accelerometer_sensor: 'i2c_style',
  rtc_sensor: 'i2c_style', 'ambient-sen': 'i2c_style', LCD: 'i2c_style',
  pressure: 'i2c_style', compass: 'i2c_style', ceprom: 'i2c_style',
  gusture: 'i2c_style', ir_temp: 'i2c_style', motor_driver: 'i2c_style',
  nfc_reader: 'i2c_style', mag_encoder: 'i2c_style', rfc: 'i2c_style',
  text_speech: 'i2c_style', uv_sensor: 'i2c_style', temp_sensor: 'i2c_style',
  accelerometer: 'i2c_style', max: 'i2c_style', seven_segment: 'i2c_style',
  gas_sensor: 'i2c_style',
  lifi_receiver: 'i2c_style',
  lifi_transmitter: 'i2c_style',
  touch_potentiometer: 'i2c_style',
  fm_receiver: 'i2c_style',
  gsr_skin_current_sensor: 'i2c_style',
  line_follower: 'i2c_style',

  // digital_style (flat #E57333)
  din_sound: 'digital_style', speaker: 'digital_style', din_tilt: 'digital_style', din_door: 'digital_style',
  rotation_sensor: 'digital_style',
  din_button: 'digital_style', din_motion: 'digital_style', din_proximity: 'digital_style',
  din_ir: 'digital_style', din_flame: 'digital_style', load_cell: 'digital_style',
  steper: 'digital_style', waterpump: 'digital_style', solinoid: 'digital_style',
  animo: 'digital_style', relay: 'digital_style', buzzer: 'digital_style',
  minifan: 'digital_style', buzzer_component: 'digital_style', ir_sen: 'digital_style',
  touch_sensor: 'digital_style', peltier: 'digital_style', microwave_sensor: 'digital_style',

  // temp_style — list blocks (#0FB881)
  list_create_empty: 'temp_style', list_create_with: 'temp_style',
  list_add: 'temp_style', list_get: 'temp_style', list_set: 'temp_style',
  list_remove: 'temp_style', list_delete_all: 'temp_style', list_insert: 'temp_style',
  list_length: 'temp_style', list_isEmpty: 'temp_style', list_contains: 'temp_style',
  list_indexOf: 'temp_style', list_show: 'temp_style',
  variables_get: 'variable_style', variables_set: 'variable_style', math_change: 'variable_style',
  list_variable_set: 'temp_style', list_variable_get: 'temp_style',
};

/**
 * LAYER 1: Insert a persistent hidden <svg> at body level with all gradient
 * and filter <defs>. This makes url(#id) in ANY CSS fill rule resolve
 * correctly, regardless of which nested SVG the block element lives inside.
 * This is the most reliable fix for Blockly v12's nested-SVG architecture.
 */
function injectDocumentLevelDefs() {
  if (document.getElementById('curio-gradient-defs-svg')) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'curio-gradient-defs-svg';
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;';
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(NS, 'defs');
  svg.appendChild(defs);

  // Use a temporary container to parse the SVG markup
  const tmp = document.createElementNS(NS, 'svg');
  tmp.innerHTML = CURIO_GRAD_DEFS;
  // Clone all child nodes (gradients + filters) into the permanent defs
  Array.from(tmp.childNodes).forEach(n => defs.appendChild(n.cloneNode(true)));

  // Insert as first child of body so itΓÇÖs available immediately
  document.body.insertAdjacentElement('afterbegin', svg);
}

/**
 * LAYER 2: Also inject <defs> + <style> into every Blockly-created <svg>.
 * This covers the case where browsers resolve url(#id) relative to the
 * elementΓÇÖs owner SVG rather than the document (spec-compliant fallback).
 */
function _injectIntoSvg(svgEl) {
  if (!svgEl || !(svgEl instanceof SVGSVGElement)) return;
  // Skip our own hidden defs SVG
  if (svgEl.id === 'curio-gradient-defs-svg') return;

  const NS = 'http://www.w3.org/2000/svg';

  // ΓöÇΓöÇ <defs> with gradients & filters ΓöÇΓöÇ
  let defs = svgEl.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(NS, 'defs');
    svgEl.prepend(defs);
  }
  // Only inject if not already present (check by first shadow id)
  if (!defs.querySelector('[id="blueShadow"]')) {
    const tmp = document.createElementNS(NS, 'svg');
    tmp.innerHTML = CURIO_GRAD_DEFS;
    Array.from(tmp.childNodes).forEach(n => defs.appendChild(n.cloneNode(true)));
  }

  // ΓöÇΓöÇ <style> so CSS class fill rules resolve in this SVG scope ΓöÇΓöÇ
  if (!svgEl.querySelector('style.curio-grad-style')) {
    const styleEl = document.createElementNS(NS, 'style');
    styleEl.setAttribute('class', 'curio-grad-style');
    styleEl.textContent = CURIO_GRAD_CSS;
    svgEl.prepend(styleEl);
  }
}

/**
 * Inject defs into every SVG in the document and watch for new ones.
 */
function addGradientDefs() {
  // Layer 1: document-level hidden SVG (most reliable)
  injectDocumentLevelDefs();

  // Layer 2: inject into all existing Blockly SVGs
  document.querySelectorAll('svg').forEach(_injectIntoSvg);

  // Watch for SVGs Blockly creates lazily (flyout, tooltip, etc.)
  if (!window._curioGradObserver) {
    window._curioGradObserver = new MutationObserver((mutations) => {
      let hasNewSvgs = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node instanceof SVGSVGElement) { _injectIntoSvg(node); hasNewSvgs = true; }
            // Also check descendants
            node.querySelectorAll && node.querySelectorAll('svg').forEach(s => { _injectIntoSvg(s); hasNewSvgs = true; });
          }
        }
      }
      // Re-apply gradients to all blocks after new SVGs appear
      if (hasNewSvgs && window.Blockly && Blockly.getMainWorkspace) {
        requestAnimationFrame(applyToAllBlocks);
      }
    });
    window._curioGradObserver.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * LAYER 3: Apply gradient fill + shadow directly to a single block via
 * style.setProperty with 'important' to override Blockly v12’s inline fill.
 */
function applyGradientAndShadowToBlock(block) {
  const svgRoot = (typeof block.getSvgRoot === 'function')
    ? block.getSvgRoot()
    : block.svgGroup_;
  if (!svgRoot) return;

  // Ensure the owning SVG also has our <defs> (layer 2)
  let el = svgRoot.parentNode;
  while (el) {
    if (el instanceof SVGSVGElement) { _injectIntoSvg(el); break; }
    el = el.parentNode;
  }

  // Add CSS class for resilience (used by the <style> injected in layer 2)
  const cls = BLOCK_CLASS_MAP[block.type];
  const shadowId = BLOCK_SHADOW_MAP[block.type];
  if (cls) svgRoot.classList.add(cls);

  // Get ALL blocklyPath elements — apply gradient/color only to the FIRST,
  // and force-hide any extras so they don't cover text/images/fields.
  const allPaths = svgRoot.querySelectorAll(':scope > .blocklyPath');
  if (allPaths.length === 0) return;

  // FIRST path: apply solid color + shadow
  const color = CLASS_COLOR_MAP[cls] || '#2685BF';
  allPaths[0].style.setProperty('fill', color, 'important');
  if (shadowId) {
    allPaths[0].style.setProperty('filter', 'url(#' + shadowId + ')', 'important');
  }

  // ALL EXTRA paths: make completely invisible so they can't cover content
  for (let i = 1; i < allPaths.length; i++) {
    allPaths[i].style.setProperty('fill', 'none', 'important');
    allPaths[i].style.setProperty('stroke', 'none', 'important');
    allPaths[i].style.setProperty('opacity', '0', 'important');
    allPaths[i].style.setProperty('pointer-events', 'none', 'important');
  }
}

function applyToAllBlocks() {
  const ws = Blockly.getMainWorkspace && Blockly.getMainWorkspace();
  if (!ws) return;
  ws.getAllBlocks(false).forEach(b => applyGradientAndShadowToBlock(b));
  try {
    let flyout = ws.getFlyout ? ws.getFlyout() : null;
    if (!flyout && ws.getToolbox && ws.getToolbox()) {
      flyout = ws.getToolbox().getFlyout();
    }
    const flyoutWs = flyout ? flyout.getWorkspace() : null;
    if (flyoutWs) {
      flyoutWs.getAllBlocks(false).forEach(b => applyGradientAndShadowToBlock(b));
    }
  } catch (e) {
    console.error("Error styling flyout blocks:", e);
  }
}

// =====================================================================
// CUSTOM RGB PICKER FIELD
// =====================================================================
let currentRgbField = null;
let rgbH = 0, rgbS = 100, rgbV = 100;

function hsvToHex(h, s, v) {
  s /= 100; v /= 100;
  let r, g, b;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hex) {
  hex = (hex || '#ff0000').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function openRgbColorModal(field) {
  currentRgbField = field;
  const hsv = hexToHsv(field.getValue() || '#ff0000');
  rgbH = hsv.h; rgbS = hsv.s; rgbV = hsv.v;
  document.getElementById('rgbHSlider').value = rgbH;
  document.getElementById('rgbSSlider').value = rgbS;
  document.getElementById('rgbVSlider').value = rgbV;
  document.getElementById('rgbHVal').textContent = rgbH;
  document.getElementById('rgbSVal').textContent = rgbS;
  document.getElementById('rgbVVal').textContent = rgbV;
  updateRgbPreview();
  document.getElementById('rgbColorModal').style.display = 'flex';
}

function updateRgbPreview() {
  const hex = hsvToHex(rgbH, rgbS, rgbV);
  document.getElementById('rgbColorPreview').style.backgroundColor = hex;
  document.getElementById('rgbHexInput').value = hex;
  const pb = document.getElementById('rgbHexPreviewBox');
  if (pb) pb.style.backgroundColor = hex;
  const satFrom = hsvToHex(rgbH, 0, rgbV);
  const satTo = hsvToHex(rgbH, 100, rgbV);
  document.getElementById('rgbSSlider').style.background =
    `linear-gradient(to right, ${satFrom}, ${satTo})`;
  const briTo = hsvToHex(rgbH, rgbS, 100);
  document.getElementById('rgbVSlider').style.background =
    `linear-gradient(to right, #000, ${briTo})`;
}

function onRgbSliderChange() {
  rgbH = +document.getElementById('rgbHSlider').value;
  rgbS = +document.getElementById('rgbSSlider').value;
  rgbV = +document.getElementById('rgbVSlider').value;
  document.getElementById('rgbHVal').textContent = rgbH;
  document.getElementById('rgbSVal').textContent = rgbS;
  document.getElementById('rgbVVal').textContent = rgbV;
  updateRgbPreview();
}

function saveRgbColor() {
  if (!currentRgbField) { closeRgbModal(); return; }
  currentRgbField.setValue(hsvToHex(rgbH, rgbS, rgbV));
  closeRgbModal();
}

function closeRgbModal() {
  document.getElementById('rgbColorModal').style.display = 'none';
  currentRgbField = null;
}

function registerRgbPickerField() {
  // Blockly.FieldColour was moved out of core in v12 (now a separate plugin).
  // We extend FieldTextInput which is always available and provides getValue/setValue.
  class FieldRgbPicker extends Blockly.FieldTextInput {
    constructor(value, validator, config) {
      super(value || '#ff0000', validator, config);
    }
    // Open the custom HTML RGB modal instead of the built-in editor
    showEditor_() { openRgbColorModal(this); }
    // Show the hex colour value as the field label
    getText_() { return this.getValue() || '#ff0000'; }
    static fromJson(options) {
      return new FieldRgbPicker(options['colour'] || '#ff0000', undefined, options);
    }
  }
  Blockly.fieldRegistry.register('field_rgb_picker', FieldRgbPicker);
}

function setupGradientAndShadowOnBlocks() {
  const ws = Blockly.getMainWorkspace();

  // Multiple deferred passes — Blockly v12 async renders mean one pass isn’t enough
  setTimeout(applyToAllBlocks, 0);
  setTimeout(applyToAllBlocks, 100);
  setTimeout(applyToAllBlocks, 300);
  setTimeout(applyToAllBlocks, 700);

  // Only re-apply on CREATE/LOAD — not every drag/move/select/change
  // (those events fired hundreds of times per second — causing the browser freeze)
  let _gradRafPending = false;
  ws.addChangeListener((e) => {
    const relevant = [
      Blockly.Events.BLOCK_CREATE,
      Blockly.Events.FINISHED_LOADING,
      'finished_loading',
      'block_create',
    ];
    if (relevant.includes(e.type) && !_gradRafPending) {
      _gradRafPending = true;
      requestAnimationFrame(() => {
        applyToAllBlocks();
        _gradRafPending = false;
      });
    }
  });

  // MutationObserver: re-apply gradient when block gets selected/deselected
  const selectionObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList && (el.classList.contains('blocklySelected') ||
          m.oldValue && m.oldValue.includes('blocklySelected'))) {
          requestAnimationFrame(applyToAllBlocks);
        }
      }
    }
  });
  const blocklyDiv2 = document.getElementById('blocklyDiv');
  if (blocklyDiv2) {
    selectionObserver.observe(blocklyDiv2, {
      subtree: true, attributes: true,
      attributeFilter: ['class'], attributeOldValue: true
    });
  }

  // MutationObserver: catch Blockly resetting style.fill on .blocklyPath
  // FIX: disconnect observer while applying to prevent self-triggering infinite loop
  const blocklyDiv = document.getElementById('blocklyDiv');
  if (blocklyDiv) {
    let _moApplying = false;
    const moOptions = { subtree: true, attributes: true, attributeFilter: ['style'] };
    const mo = new MutationObserver((mutations) => {
      if (_moApplying) return; // guard: skip re-entrant calls triggered by our own writes
      let needsApply = false;
      for (const m of mutations) {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'style' &&
          m.target.classList &&
          m.target.classList.contains('blocklyPath')
        ) {
          const fillVal = m.target.style.fill;
          if (fillVal && !fillVal.startsWith('url(')) {
            needsApply = true;
            break;
          }
        }
      }
      if (needsApply) {
        requestAnimationFrame(() => {
          _moApplying = true;   // set guard BEFORE our style writes
          mo.disconnect();      // stop watching while we apply gradients
          applyToAllBlocks();
          mo.observe(blocklyDiv, moOptions); // resume watching after
          _moApplying = false;
        });
      }
    });
    mo.observe(blocklyDiv, moOptions);
  }
}

// =====================================================================
// BLOCK DEFINITIONS
// =====================================================================
function defineBlocks() {
  Blockly.defineBlocksWithJsonArray([
    {
      "type": "list_variable_set",
      "message0": "set %1 to %2",
      "args0": [
        {
          "type": "field_variable",
          "name": "VAR",
          "variable": "%{BKY_VARIABLES_DEFAULT_NAME}",
          "variableTypes": ["list"],
          "defaultType": "list"
        },
        {
          "type": "input_value",
          "name": "VALUE"
        }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881",
      "extensions": ["list_color"]
    },
    {
      "type": "list_variable_get",
      "message0": "%1",
      "args0": [
        {
          "type": "field_variable",
          "name": "VAR",
          "variable": "%{BKY_VARIABLES_DEFAULT_NAME}",
          "variableTypes": ["list"],
          "defaultType": "list"
        }
      ],
      "output": null,
      "colour": "#0FB881",
      "extensions": ["list_color"]
    },
    { type: "sim_solar", message0: "%1 Solar System %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Solar System" }], colour: "#f59e0b", previousStatement: null, nextStatement: null, extensions: ["sim_solar_click", "defult_style"] },
    { type: "sim_pendulum", message0: "%1 Pendulum %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Pendulum" }], colour: "#ef4444", previousStatement: null, nextStatement: null, extensions: ["sim_pendulum_click", "defult_style"] },
    { type: "sim_particles", message0: "%1 Particles %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Particles" }], colour: "#8b5cf6", previousStatement: null, nextStatement: null, extensions: ["sim_particles_click", "defult_style"] },
    { type: "sim_dna", message0: "%1 DNA Helix %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "DNA Helix" }], colour: "#06b6d4", previousStatement: null, nextStatement: null, extensions: ["sim_dna_click", "defult_style"] },
    { type: "sim_gears", message0: "%1 Gear System %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Gear System" }], colour: "#64748b", previousStatement: null, nextStatement: null, extensions: ["sim_gears_click", "defult_style"] },
    { type: "sim_wave", message0: "%1 Wave Surface %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Wave Surface" }], colour: "#0ea5e9", previousStatement: null, nextStatement: null, extensions: ["sim_wave_click", "defult_style"] },
    { type: "sim_bouncing", message0: "%1 Bouncing Balls %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Bouncing Balls" }], colour: "#f97316", previousStatement: null, nextStatement: null, extensions: ["sim_bouncing_click", "defult_style"] },
    { type: "sim_windmill", message0: "%1 Wind Turbine %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Wind Turbine" }], colour: "#22c55e", previousStatement: null, nextStatement: null, extensions: ["sim_windmill_click", "defult_style"] },
    { type: "sim_atom", message0: "%1 Atom Model %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Atom Model" }], colour: "#a855f7", previousStatement: null, nextStatement: null, extensions: ["sim_atom_click", "defult_style"] },
    { type: "sim_globe", message0: "%1 Earth Globe %2 %3", args0: [{ type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "3D", name: "IMG1", class: "hover-animate" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "SIM_LABEL", text: "Earth Globe" }], colour: "#3b82f6", previousStatement: null, nextStatement: null, extensions: ["sim_globe_click", "defult_style"] },
    {
      type: "speedo_3d",
      message0: "%1 Speedometer %2 %3",
      args0: [
        { type: "field_image", src: "./assets/img/robo.png", width: 35, height: 35, alt: "Speedo", name: "IMG1", class: "hover-animate" },
        { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" },
        { type: "field_label", name: "SPEED_LABEL", text: "0%" }
      ],
      colour: "#10b981",
      previousStatement: null,
      nextStatement: null,
      extensions: ["speedo_3d_click", "defult_style"]
    },
    {
      type: "three_d_model",
      message0: "%1 3D Model %2 %3",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/robo.png",
          width: 35,
          height: 35,
          alt: "3D",
          name: "IMG1",
          class: "hover-animate"
        },
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG",
          class: "hover-animate"
        },
        {
          type: "field_label",
          name: "MODEL_LABEL",
          text: "Cube"
        }
      ],
      colour: "#6366f1",
      previousStatement: null,
      nextStatement: null,
      extensions: ["three_d_image_click", "defult_style"]
    },
    {
      type: "start",
      message0: "Start %1 return %2",
      args0: [{
        type: "input_statement",
        name: "DO"
      },
      {
        type: "input_value"
        , name: "VALUE"
      }],
      nextStatement: null,
      extensions: ["logic_color"]
    },
    {
      type: "port_on",
      args0: [{
        type: "field_image",
        src: "./assets/img/robo.png",
        width: 35,
        height: 35,
        alt: "",
        name: "IMG1",
        class: "hover-animate"
      },
      {
        type: "field_label",
        name: "LABEL",
        text: "Digi ON"
      },
      {
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png"
        , width: 15,
        height: 15,
        alt: "",
        name: "IMG",
        class: "hover-animate"
      },
      {
        type: "field_label"
        , name: "PORTS",
        text: ""
      }],
      message0: "%1 %2 %3 %4",
      colour: "#ffb56a",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_on_img_click", "led_style"]
    },
    {
      type: "port_off",
      message0: "DigitalOut OFF %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15,
        height: 15,
        alt: "",
        name: "IMG"
      },
      {
        type: "field_label",
        name: "PORTS",
        text: ""
      }
      ],
      colour: "#ffb56a",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "led_style"]
    },
    {
      type: "rfid",
      message0: "RFID",

      colour: "#EB4899",
      output: "Boolean",
      extensions: ["spi_category_color"]
    },
    {
      type: "tft",
      message0: "TFT Display %1",
      args0: [
        {
          type: "input_value",
          name: "TEXT"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: "#EB4899",
      extensions: ["spi_category_color"]
    },
    {
      type: "finger_print_enroll",
      message0: "Fingerprint Enroll",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "finger_print_match",
      message0: "Fingerprint Match ",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "soli_npk",
      message0: "Soil Moisture NPK",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "sen_ultrasonic",
      message0: "ultrasonic distance on port %1",
      args0: [{
        type: "field_number",
        name: "PORT",
        value: 2,
        min: 0,
        max: 99
      }],
      style: "control_blocks",
      previousStatement: null,
      nextStatement: null,
      extensions: ["led_style"]
    },
    { type: "sen_temp", message0: "temperature on port %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", previousStatement: null, nextStatement: null, extensions: ["led_style", "led_pin_image_click"] },
    { type: "do_onoff", message0: "digital write pins %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "servo_color"] },
    { type: "bike_model", message0: "🏍️ Bike Model %1 speed %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 18, height: 18, alt: "View", name: "IMG", class: "hover-animate" }, { type: "field_number", name: "BIKE_SPEED", value: 0, min: 0, max: 10 }, { type: "field_label", text: "/ 10" }], colour: "#F49E09", previousStatement: null, nextStatement: null, extensions: ["bike_model_image_click", "pwm_color"] },
    {
      type: "do_dc_motor",
      message0: "DC Motor %1 %2 speed %3 %4 %5",
      args0: [
        {
          type: "field_image", src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "Config",
          name: "IMG",
          class: "hover-animate"
        },
        {
          type: "field_label",
          name: "MOTORS",
          text: ""
        },
        {
          type: "field_number",
          name: "SPEED",
          value: 60,
          min: 0,
          max: 100
        },
        {
          type: "field_label",
          text: "%"
        }, {
          type: "field_dropdown",
          name: "STATE",
          options:
            [["forward", "forward"],
            ["backward", "backward"],
            ["stop", "stop"]]
        }],
      colour: "#F49E09",
      previousStatement: null,
      nextStatement: null,
      extensions: ["motor_image_click", "pwm_color"]
    },
    {
      type: "do_dc_motor2",
      message0: "DC Motor %1 %2 %3",
      args0: [{
        type: "field_image",
        name: "IMG",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15
      },
      {
        type: "field_label",
        name: "MOTORS", text: ""
      },
      {
        type: "field_dropdown",
        name: "STATE",
        options: [["forward", "forward"], ["backward", "backward"], ["stop", "stop"], ["turn left", "turn left"], ["turn right", "turn right"]]
      }], colour: "#F49E09", previousStatement: null, nextStatement: null, extensions: ["motor_image_click2", "pwm_color"]
    },
    { type: "do_servo", message0: "servo on %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "SERVO_PORT", text: "" }, { type: "field_number", name: "ANG", value: 45, min: 0, max: 360, precision: 1 }], colour: "#F49E09", previousStatement: null, nextStatement: null, extensions: ["servo_image_click", "pwm_color"] },
    { type: "bt_send", message0: "Bluetooth send %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, style: "control_blocks", extensions: ["servo_color"] },
    { type: "do_led", message0: "LED %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "leds_category_color"] },
    { type: "ctl_delay", message0: "Delay%1 ms", args0: [{ type: "field_number", name: "MS", value: 500, min: 0, max: 600000 }], previousStatement: null, nextStatement: null, extensions: ["delay_color"] },
    { type: "lp_while", message0: "while %1", args0: [{ type: "input_value", name: "COND", check: "Boolean" }], message1: "do %1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_break", message0: "break", previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_continue", message0: "continue", previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_start", message0: "@@start", previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_repeat_count", message0: "repeat %1 %2 times", args0: [{ type: "field_number", name: "PIN" }, { type: "field_number", name: "COUNT", value: 4, min: 0, max: 100000 }], message1: "do %1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "lp_label", message0: "Print %1", args0: [{ type: "input_value", name: "NAME" }], previousStatement: null, nextStatement: null, extensions: ["dc_color"] },
    { type: "din_if_else", message0: "if %1", args0: [{ type: "input_value", name: "COND", check: "Boolean" }], message1: "do %1", args1: [{ type: "input_statement", name: "DO" }], message2: "else %1", args2: [{ type: "input_statement", name: "ELSE" }], previousStatement: null, nextStatement: null, extensions: ["logic_color"] },
    {
      type: "din_sound",
      message0: "SOUND CELL %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["digital_style", "port_image_click"]
    },
    { type: "din_tilt", message0: "TILT %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_door", message0: "MAGNETIC SWITCH %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_button", message0: "BUTTON %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_motion", message0: "MOTION SENSOR %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "light_freq", message0: "LIGHT Frequency %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], colour: "#22C45D", output: "Boolean", extensions: ["leds_category_color", "port_image_click"] },
    { type: "din_proximity", message0: "PROXIMITY %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_ir", message0: "IR %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "din_flame", message0: "FLAME %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "ana_flame", message0: "FLAME %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "port_image_click"] },
    { type: "load_cell", message0: "Load Cell %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    { type: "do_led_param", message0: "LED write %1 %2 value %3 time %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL" }, { type: "field_number", name: "VAL2" }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "sensor", message0: "ultra sonic %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "tem_sensor", message0: "tem sonic %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "xray_sensor", message0: "xray sonic %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "rc_sensor", message0: "rc sensor %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "ultra_style"] },
    { type: "logical_comparison", message0: "%1 %2 %3", args0: [{ type: "input_value", name: "VALUE1" }, { type: "field_dropdown", name: "OPERATOR", options: [["<", "<"], [">", ">"], [" == ", "=="], [" >= ", ">="], [" <= ", "<="], [" != ", "!="]] }, { type: "input_value", name: "VALUE2" }], output: "Boolean", inputsInline: true, extensions: ["logic_color"] },
    { type: "red_led", message0: "Red LED %1 %2 %3 %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1", value: 1, min: 0, max: 100, precision: 1 }, { type: "field_number", name: "VAL2", value: 1, min: 0, max: 100, precision: 1 }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "yellow_led", message0: "YELLOW LED %1 %2 %3 %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1", value: 1, min: 0, max: 100, precision: 1 }, { type: "field_number", name: "VAL2", value: 1, min: 0, max: 100, precision: 1 }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "green_led", message0: "GREEN LED %1 %2 %3 %4", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1", value: 1, min: 0, max: 100, precision: 1 }, { type: "field_number", name: "VAL2", value: 1, min: 0, max: 100, precision: 1 }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["led_pin_image_click", "leds_category_color"] },
    { type: "water-turbidity-sensor", message0: "turbidity %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "steper", message0: "stepper Motor %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "SPEED", value: 60, min: 0, max: 100 }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "waterpump", message0: "Water Pump %1 %2 Angle %3 °", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "ANGLE", value: 60, min: 0 }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "solinoid", message0: "Solinoid Valve %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "animo", message0: "Anemo Meter %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "relay", message0: "Relay %1 %2 Value %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["0", "0"], ["1", "1"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "loop_end", message0: "End the Loop %1", args0: [{ type: "field_input", name: "NAME", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "port_image_click"] },
    { type: "buzzer", message0: "buzzer %1 %2 %3 %4 %5", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "VAL1" }, { type: "field_number", name: "VAL2" }, { type: "field_number", name: "VAL3" }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "minifan", message0: "Mini fan %1 %2 %3", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_dropdown", name: "STATE", options: [["forward", "forward"], ["backward", "backward"], ["stop", "stop"]] }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    {
      type: "rgb_component",
      message0: "rgb_component %1 %2 %3 %4 %5",
      args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" },
      { type: "field_label", name: "PORTS", text: "" },
      { type: "field_number", name: "freq", value: 0 },
      { type: "field_number", name: "Delay1", value: 255 },
      { type: "field_number", name: "DELAY2", value: 0 }],
      colour: "#22C45D",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "leds_category_color"]
    },
    { type: "shock_sensor", message0: "Shock Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "flex-sensor", message0: "flex %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "humidity", message0: "Huminity %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    {
      type: "piezo_sensor",
      message0: "Piezo %1 %2 ",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        },

      ],
      output: "Boolean",
      extensions: ["led_pin_image_click", "temp_style"]
    },

    { type: "buzzer_component", message0: "buzzer_component %1 %2 %3 %4 %5", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }, { type: "field_number", name: "freq" }, { type: "field_number", name: "Delay1" }, { type: "field_number", name: "DELAY2" }], colour: "#81d4ed", previousStatement: null, nextStatement: null, extensions: ["port_image_click", "digital_style"] },
    { type: "joystick_move", args0: [{ type: "field_label", name: "LABEL", text: "joystick" }, { type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG", class: "hover-animate" }, { type: "field_label", name: "PORTS", text: "" }], message0: "%1 %2 %3", colour: "#ffb56a", output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "Air_quality_sensor", message0: "Air-quality-sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "flexi_force_sensor", message0: "Flexi Force Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "TDS_Water_sensor", message0: "TDS Water Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "LCD_print", message0: "LCD %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, colour: "#22C45D", extensions: ["leds_category_color"] },
    { type: "din_temp", message0: "temperature sensor pin %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "water_sensor", message0: "Water Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "any_input_block", message0: "%1", args0: [{ type: "field_input", name: "ANY", text: "1" }], output: null, extensions: ["logic_color"] },
    { type: "custom_if_then", message0: "if %1 then %2", args0: [{ type: "input_value", name: "CONDITION", check: "Boolean" }, { type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, extensions: ["logic_color"] },
    { type: "tep_ana", message0: "Temputure ana Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "heart_beat", message0: "heart beat %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "ldr", message0: "LDR %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "soil_moisture", message0: "Soil Moisture %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "soil_moisture_image_click"] },
    { type: "dust", message0: "dust %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "vibration-switch-sensor", message0: "vibration %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "Current-sensor", message0: "Current %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "IR-Temp", message0: "IR Temp %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "temp2-sensor", message0: "temp01 %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "ecg", message0: "EGC %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "ana_temp", message0: "Analog Temputure %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["temp_style", "led_pin_image_click"] },
    { type: "magnetic_sensor", message0: "Magnetic sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "colour_sen", message0: "Colour", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "system_status", message0: "System Status Running", output: "Boolean", extensions: ["logic_color"] },
    { type: "accelerometer_sensor", message0: "Accelerometer sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "rtc_sensor", message0: "Rtc sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "LCD", message0: "LCD pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "pressure", message0: "Pressure pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "compass", message0: "compass", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "ceprom", message0: "ceprom", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    {
      type: "speaker",
      message0: "Speaker %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["digital_style", "port_image_click"]
    },
    {
      type: "rotation_sensor",
      message0: "Rotation Sensor %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["digital_style", "port_image_click"]
    },
    { type: "gsr_skin_current_sensor", message0: "GSR Skin Current Sensor", style: "control_blocks", output: "Boolean", extensions: ["digital_style"] },
    { type: "line_follower", message0: "Line Follower", style: "control_blocks", output: "Boolean", extensions: ["digital_style"] },

    { type: "gusture", message0: "Gesture", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "ir_temp", message0: "IR temp", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "motor_driver", message0: "Motor Driver", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "nfc_reader", message0: "NFC Reader", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "mag_encoder", message0: "Mag Encoder", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "text_speech", message0: "Text Speech", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "rfc", message0: "RFC", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "touch_sensor", message0: "Touch Sensor", style: "control_blocks", output: "Boolean", extensions: ["digital_style"] },
    { type: "uv_sensor", message0: "UV Sensor", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "temp_sensor", message0: "Temp Sensor", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "accelerometer", message0: "Accelerometer", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "ir_sen", message0: "IR Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["digital_style", "port_image_click"] },
    {
      type: "max",
      message0: "Max",

      style: "control_blocks",
      output: "Boolean",
      extensions: ["i2c_style"]
    },
    {
      type: "water_level",
      message0: "Water Level %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "solor_panel",
      message0: "Solar Panel %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "admp",
      message0: "ADMP 401 %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "uv_sensor_ana",
      message0: "UV Sensor Analog %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },
    {
      type: "ph_sensor",
      message0: "PH sensor %1 %2",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15, height: 15, alt: "",
        name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "led_pin_image_click"]
    },



    { type: "uv_sensor_dig", message0: "UV Sensor Digital", style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "seven_segment", message0: "Seven segment", style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "gas_sensor", message0: 'gas sensor', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "lifi_receiver", message0: 'Lifi receiver', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "lifi_transmitter", message0: 'Lifi transmitter', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "touch_potentiometer", message0: 'Touch Potentiometer', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    { type: "fm_receiver", message0: 'FM Receiver', style: "control_blocks", output: "Boolean", extensions: ["temp_style"] },
    {
      type: "touch_sensor",
      message0: "TOUCH SENSOR %1 %2",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        }
      ],
      colour: "#81d4ed",
      output: "Boolean",
      extensions: ["port_image_click", "servo_color"]
    },
    {
      type: "peltier",
      message0: "Peltier %1 %2 %3",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        },
        {
          type: "field_dropdown",
          name: "STATE",
          options: [
            ["hot", "hot"],
            ["cold", "cold"],
            ["off", "off"]
          ]
        }
      ],
      colour: "#81d4ed",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "ultra_style"]
    },
    {
      type: "microwave_sensor",
      message0: "Microwave_sensor %1 %2",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        }],
      style: "control_blocks",
      output: "Boolean",
      extensions: ["temp_style", "port_image_click"]
    }
    ,
    { type: "ambient-sen", message0: "Ambient sensor pin", style: "control_blocks", output: "Boolean", extensions: ["i2c_style"] },
    { type: "din_ultra", message0: "Ultra Sonic sensor pin %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "voltage_sensor", message0: "Voltage Sensor %1 %2", args0: [{ type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG" }, { type: "field_label", name: "PORTS", text: "" }], style: "control_blocks", output: "Boolean", extensions: ["led_pin_image_click", "temp_style"] },
    { type: "rgb_display", message0: "display %1 %2 %3 %4 %5", args0: [{ type: "field_colour", name: "RED", colour: "#FF0000" }, { type: "field_colour", name: "ORANGE", colour: "#FFA500" }, { type: "field_colour", name: "YELLOW", colour: "#FFFF00" }, { type: "field_colour", name: "GREEN", colour: "#008000" }, { type: "field_colour", name: "CYAN", colour: "#00FFFF" }], colour: "#22C45D", previousStatement: null, nextStatement: null, extensions: ["leds_category_color"] },
    {
      type: "rgb_led_display",
      message0: "%1 LED %2 displays %3 for %4 secs",
      args0: [{
        type: "field_image", src: "./assets/img/Chips_Chips_Show.png", width: 15, height: 15, alt: "", name: "IMG"
      },
      { type: "field_dropdown", name: "LED", options: [["all", "ALL"], ["1", "1"], ["2", "2"], ["3", "3"]] },
      { type: "field_rgb_picker", name: "COLOR", colour: "#ff0000" },
      { type: "input_value", name: "TIME", check: "Number" }],
      previousStatement: null,
      nextStatement: null,
      colour: "#22C45D",
      extensions: ["leds_category_color"]
    },
    {
      type: "din_ultra_range",
      message0: "Ultra Sonic range pin %1 %2 From %3 to %4 Range %5",
      args0: [{
        type: "field_image",
        src: "./assets/img/Chips_Chips_Show.png",
        width: 15,
        height: 15,
        alt: "", name: "IMG"
      },
      { type: "field_label", name: "PORTS", text: "" },
      { type: "field_number", name: "ANG1", value: "0" },
      { type: "field_number", name: "ANG2", value: "5" },
      {
        type: "field_dropdown",
        name: "STATE",
        options: [["0", "0"],
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
        ["4", "4"],
        ["5", "5"],
        ["6", "6"],
        ["7", "7"],
        ["8", "8"],
        ["9", "9"],
        ["10", "10"],]
      }],
      colour: "#C0603E",
      output: "Boolean",
      extensions: ["led_pin_image_click", "temp_style"]
    },
    {
      type: "keypad",
      message0: "Keypad %1 %2",
      args0: [
        {
          type: "field_image",
          src: "./assets/img/Chips_Chips_Show.png",
          width: 15,
          height: 15,
          alt: "",
          name: "IMG"
        },
        {
          type: "field_label",
          name: "PORTS",
          text: ""
        }],
      colour: "#3B82F6",
      previousStatement: null,
      nextStatement: null,
      extensions: ["txrx_category_color", "key_pin_image_click"]
    },
    {
      type: "gps",
      message0: "GPS ",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "gsm",
      message0: "GSM %1 %2",
      args0: [
        {
          type: "field_input",
          name: "VAL1",
        },
        {
          type: "field_input",
          name: "VAL2",
        },],
      colour: "#3B82F6",
      previousStatement: null,
      nextStatement: null,
      extensions: ["port_image_click", "txrx_category_color"]
    },
    {
      type: "tof",
      message0: "ToF",

      colour: "#3B82F6",
      output: "Boolean",
      extensions: ["txrx_category_color"]
    },
    {
      type: "compare",
      message0: "RDX %1 %2",
      args0: [{
        type: "input_value",
        name: "NAME",
      },
      {
        type: "input_value",
        name: "NAME2",
      }],
      previousStatement: null,
      nextStatement: null,
      extensions: ["dc_color"]
    },
    {
      type: "llm_text",
      message0: "LLM TTS %1 %2 %3",
      args0: [
        {
          type: "input_value",
          name: "NAME2",
        },
        {
          type: "field_dropdown",
          name: "STATE",
          options: [["photo", "photo"],
          ["voice", "voice"],
          ["text", "text"]
          ]
        },
        {
          type: "field_input",
          name: "VAL1",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      extensions: ["llm_color"]
    },
    // ── Original AI Blocks (dropdown-based) ─────────────────────────
    {
      type: "ai_block",
      message0: "Ai Blocks %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Face Detection", "face_detection"],
          ["Color Detection", "color_detection"],
          ["Multi color Recognition", "multi_color_recognition"],
          ["Same Color Object counting", "same_color_object_counting"],
          ["QR Code Recognition", "qr_code_recognition"],
          ["Live Camera", "live_camera"],
          ["Train", "Train"]]
      }],
      colour: "#FF69B4",
      previousStatement: null,
      nextStatement: null,
      extensions: ["servo_color"]
    },
    {
      type: "ai_output",
      message0: "Ai Output %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Face Detection", "face_detection"],
          ["Color Detection", "color_detection"],
          ["Multi color Recognition", "multi_color_recognition"],
          ["Same Color Object counting", "same_color_object_counting"],
          ["QR Code Recognition", "qr_code_recognition"],
          ["Live Camera", "live_camera"],
          ["Train", "Train"]]
      }],
      colour: "#FF69B4",
      output: "Boolean",
      extensions: ["servo_color"]
    },
    {
      type: "object_de",
      message0: "Object Detection %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Person", "person"], ["Bicycle", "bicycle"], ["Car", "car"],
          ["Motorcycle", "motorcycle"], ["Airplane", "airplane"], ["Bus", "bus"],
          ["Train", "train"], ["Truck", "truck"], ["Boat", "boat"],
          ["Traffic light", "traffic_light"], ["Sports Ball", "sports_ball"],
          ["Cup", "cup"], ["Toothbrush", "toothbrush"],
          ["Book", "book"], ["Keyboard", "keyboard"]]
      }],
      colour: "#FF69B4",
      previousStatement: null,
      nextStatement: null,
      extensions: ["servo_color"]
    },
    {
      type: "object_out",
      message0: "Object Output %1",
      args0: [{
        type: "field_dropdown",
        name: "STATE", options: [
          ["Person", "person"], ["Bicycle", "bicycle"], ["Car", "car"],
          ["Motorcycle", "motorcycle"], ["Airplane", "airplane"], ["Bus", "bus"],
          ["Train", "train"], ["Truck", "truck"], ["Boat", "boat"],
          ["Traffic light", "traffic_light"], ["Sports Ball", "sports_ball"],
          ["Cup", "cup"], ["Toothbrush", "toothbrush"],
          ["Book", "book"], ["Keyboard", "keyboard"]]
      }],
      colour: "#FF69B4",
      output: "Boolean",
      extensions: ["servo_color"]
    },

    // ── A.I. Vision Blocks ───────────────────────────────────────────
    {
      type: 'ai_open_train',
      message0: '🤖 Open AI Training Studio',
      args0: [],
      colour: '#7c3aed',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Open the AI camera training screen to train your model.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_export_model',
      message0: '📤 Export AI Model to Board',
      args0: [],
      colour: '#0ea5e9',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Export the trained AI model to the connected board.',
      helpUrl: '',
      extensions: ["defult_style"]
    },
    {
      type: 'ai_open_train_k230',
      message0: 'K230: 🤖 Open AI Training Studio',
      args0: [],
      colour: '#7c3aed',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Open the K230 AI camera training screen to train your model.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_open_train_s3',
      message0: 'S3: 🤖 Open AI Training Studio',
      args0: [],
      colour: '#7c3aed',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Open the S3 AI camera training screen to train your model.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_export_model_k230',
      message0: 'K230: 📤 Export AI Model to Board',
      args0: [],
      colour: '#0ea5e9',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Export the trained AI model to the connected K230 board.',
      helpUrl: '',
      extensions: ["defult_style"]
    },
    {
      type: 'ai_export_model_s3',
      message0: 'S3: 📤 Export AI Model to Board',
      args0: [],
      colour: '#0ea5e9',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Export the trained AI model to the connected S3 board.',
      helpUrl: '',
      extensions: ["defult_style"]
    },
    {
      type: 'ai_infer_k230',
      message0: '🧠 K230: Run AI Inference',
      args0: [],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Trigger the AI inference loop on the K230 KPU.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_infer_s3',
      message0: '🧠 S3: Run AI Inference',
      args0: [],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Trigger the AI inference loop on the S3 board.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_classify_image',
      message0: 'classify image → result %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Run AI classification on camera feed.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_classify_image_k230',
      message0: 'K230: classify image → result %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Run AI classification on the K230 camera feed.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_classify_image_s3',
      message0: 'S3: classify image → result %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#f54254',
      previousStatement: null,
      nextStatement: null,
      tooltip: 'Run AI classification on the S3 camera feed.',
      helpUrl: '',
      extensions: ["led_style"]
    },
    {
      type: 'ai_class_result',
      message0: 'classifying result is %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Boolean',
      tooltip: 'Returns true if the camera sees this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_result_k230',
      message0: 'K230: classifying result is %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Boolean',
      tooltip: 'Returns true if the K230 camera sees this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_result_s3',
      message0: 'S3: classifying result is %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Boolean',
      tooltip: 'Returns true if the S3 camera sees this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_reliability',
      message0: 'reliability of %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Number',
      tooltip: 'Returns 0–100 confidence score for this class.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_reliability_k230',
      message0: 'K230: reliability of %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Number',
      tooltip: 'Returns 0–100 confidence score for this class on K230.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
    {
      type: 'ai_class_reliability_s3',
      message0: 'S3: reliability of %1',
      args0: [{
        type: 'field_dropdown',
        name: 'CLASS',
        options: [['Class1', 'Class1'], ['Class2', 'Class2']]
      }],
      colour: '#7c3aed',
      output: 'Number',
      tooltip: 'Returns 0–100 confidence score for this class on S3.',
      helpUrl: '',
      extensions: ["temp_style"]
    },
  ]);

  // Extensions
  Blockly.Extensions.register('port_on_img_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openPortSelectionModal(this));
  });
  Blockly.Extensions.register('port_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openPortSelectionModal(this));
  });
  Blockly.Extensions.register('bike_model_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openBikeModelModal(this));
  });
  Blockly.Extensions.register('motor_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openUnifiedModal(this));
  });
  Blockly.Extensions.register('motor_image_click2', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openMotorSelectionModal(this));
  });
  Blockly.Extensions.register('servo_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openServoSelectionModal(this));
  });
  Blockly.Extensions.register('led_pin_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openLedPinSelectionModal(this));
  });
  Blockly.Extensions.register('soil_moisture_image_click', function () {
    const f = this.getField('IMG'); if (!f) return;
    f.setOnClickHandler(() => openSoilMoisturePopupModal(this));
  });
  Blockly.Extensions.register('key_pin_image_click', function () {
    const imgField = this.getField('IMG');
    if (!imgField) return;
    imgField.setOnClickHandler(() => {
      openkeyPinSelectionModal(this);
    });
  });

  Blockly.Extensions.register('three_d_image_click', function () {
    // Hidden fields to store 3D model config
    this.appendDummyInput('HIDDEN_3D')
      .appendField(new Blockly.FieldTextInput('cube'), 'MODEL_TYPE')
      .appendField(new Blockly.FieldTextInput('30'), 'SPIN_SPEED')
      .appendField(new Blockly.FieldTextInput('#7c3aed'), 'MODEL_COLOR')
      .setVisible(false);
    const f = this.getField('IMG');
    if (!f) return;
    f.setOnClickHandler(() => open3DModal(this));
  });


  Blockly.Extensions.register('speedo_3d_click', function () {
    this.appendDummyInput('HIDDEN_SPEEDO')
      .appendField(new Blockly.FieldTextInput('0'), 'SPEED_VAL')
      .setVisible(false);
    var f = this.getField('IMG');
    if (!f) return;
    f.setOnClickHandler(() => openSpeedo3D(this));
  });

  Blockly.Extensions.register('sim_solar_click', function () { this.appendDummyInput('H_SIM_SOLAR').appendField(new Blockly.FieldTextInput('sim_solar'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_solar')); });
  Blockly.Extensions.register('sim_pendulum_click', function () { this.appendDummyInput('H_SIM_PENDULUM').appendField(new Blockly.FieldTextInput('sim_pendulum'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_pendulum')); });
  Blockly.Extensions.register('sim_particles_click', function () { this.appendDummyInput('H_SIM_PARTICLES').appendField(new Blockly.FieldTextInput('sim_particles'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_particles')); });
  Blockly.Extensions.register('sim_dna_click', function () { this.appendDummyInput('H_SIM_DNA').appendField(new Blockly.FieldTextInput('sim_dna'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_dna')); });
  Blockly.Extensions.register('sim_gears_click', function () { this.appendDummyInput('H_SIM_GEARS').appendField(new Blockly.FieldTextInput('sim_gears'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_gears')); });
  Blockly.Extensions.register('sim_wave_click', function () { this.appendDummyInput('H_SIM_WAVE').appendField(new Blockly.FieldTextInput('sim_wave'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_wave')); });
  Blockly.Extensions.register('sim_bouncing_click', function () { this.appendDummyInput('H_SIM_BOUNCING').appendField(new Blockly.FieldTextInput('sim_bouncing'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_bouncing')); });
  Blockly.Extensions.register('sim_windmill_click', function () { this.appendDummyInput('H_SIM_WINDMILL').appendField(new Blockly.FieldTextInput('sim_windmill'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_windmill')); });
  Blockly.Extensions.register('sim_atom_click', function () { this.appendDummyInput('H_SIM_ATOM').appendField(new Blockly.FieldTextInput('sim_atom'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_atom')); });
  Blockly.Extensions.register('sim_globe_click', function () { this.appendDummyInput('H_SIM_GLOBE').appendField(new Blockly.FieldTextInput('sim_globe'), 'SIM_TYPE').appendField(new Blockly.FieldTextInput('50'), 'SIM_SPEED').setVisible(false); var f = this.getField('IMG'); if (f) f.setOnClickHandler(() => openSimModal(this, 'sim_globe')); });
  // Style extensions — apply class immediately AND on every change
  // so gradient stays consistent from the moment a block enters the workspace.
  function mkStyleExt(name, cls) {
    Blockly.Extensions.register(name, function () {
      const block = this;
      // Apply immediately (covers drag-from-flyout moment)
      function applyNow() {
        const root = (typeof block.getSvgRoot === 'function')
          ? block.getSvgRoot() : block.svgGroup_;
        if (root) {
          root.classList.add(cls);
          // Also trigger the full gradient fill immediately
          if (typeof applyGradientAndShadowToBlock === 'function') {
            applyGradientAndShadowToBlock(block);
          }
        }
      }
      // Try immediately; also retry after a frame in case SVG is not ready yet
      applyNow();
      requestAnimationFrame(applyNow);
      // Re-apply on any workspace change (resilience against Blockly re-renders)
      block.setOnChange(function () { applyNow(); });
    });
  }
  mkStyleExt('defult_style', 'defult_style');
  mkStyleExt('servo_color', 'block-servo');
  mkStyleExt('pwm_color', 'pwm_style');
  mkStyleExt('leds_category_color', 'led_category_style');
  mkStyleExt('txrx_category_color', 'txrx_category_style');
  mkStyleExt('spi_category_color', 'spi_category_style');
  mkStyleExt('led_style', 'led_style');
  mkStyleExt('dummy_style', 'dummy_block');
  mkStyleExt('delay_color', 'delay_style');
  mkStyleExt('logic_color', 'logic_style');
  mkStyleExt('llm_color', 'llm_style');
  mkStyleExt('list_color', 'list_style');
  mkStyleExt('temp_style', 'temp_style');
  mkStyleExt('i2c_style', 'i2c_style');
  mkStyleExt('digital_style', 'digital_style');
  mkStyleExt('dc_color', 'block_dc');
  mkStyleExt('ultra_style', 'ultra_style');
}

// =====================================================================
// PYTHON GENERATORS
// =====================================================================
function defineGenerators() {
  const py = Blockly.Python;
  const reg = py.forBlock || py; // v12: register on forBlock

  function pinCode(block, field, fn) {
    const txt = block.getFieldValue(field) || '';
    const pins = txt.split(',').map(s => s.trim()).filter(Boolean);
    if (!pins.length) return `# ${fn}: no pins selected\n`;
    return pins.map(p => `${fn}(${p})\n`).join('');
  }
  function pinOutput(block, fn) {
    const txt = block.getFieldValue('PORTS') || '';
    const pins = txt.split(',').map(p => p.trim()).filter(Boolean);
    if (!pins.length) return ['# Invalid: no port', py.ORDER_NONE];
    return [`${fn}(${pins.map(p => `"${p}"`).join(',')})`, py.ORDER_FUNCTION_CALL];
  }

  reg['do_led'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return "# do_led: no ports selected\n";
    const fn = b.getFieldValue('STATE') === '1' ? 'robot.led_on' : 'robot.led_off';
    return ports.map(p => `${fn}(${p})\n`).join('');
  };
  reg['rfid'] = b => [`await async_rfid()`, py.ORDER_ATOMIC];
  reg['tft'] = function (block) {
    const txt = Blockly.Python.valueToCode(block, 'TEXT', Blockly.Python.ORDER_NONE) || "''";
    // Example: send text over Bluetooth
    return `await async_tft(${txt})\n`;
  };
  reg['bt_send'] = b => { const t = py.valueToCode(b, 'TEXT', py.ORDER_NONE) || "''"; return `robot.bt_send(${t})\n`; };
  reg['sen_ultrasonic'] = b => `distance = robot.ultrasonic_cm(${b.getFieldValue('PORT') || 0})\n`;
  reg['sen_temp'] = b => { const pins = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!pins.length) return "# no pins\n"; return pins.map(p => `temp_port(${p})\n`).join(''); };
  reg['do_onoff'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return "# do_onoff: no ports\n"; const fn = b.getFieldValue('STATE') === '1' ? 'robot.port_on' : 'robot.port_off'; return ports.map(p => `${fn}(${p})\n`).join(''); };
  reg['port_on'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()); return ports.map(p => `robot.port_on(${p})\n`).join(''); };
  reg['port_off'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()); return ports.map(p => `robot.port_off(${p})\n`).join(''); };
  reg['bike_model'] = b => { const speed = b.getFieldValue('BIKE_SPEED') || 0; return `# Bike Model speed: ${speed}\nawait async_motor_speed("E12",${speed},"forward")\n`; };
  reg['do_dc_motor'] = b => {
    const speed = b.getFieldValue('SPEED') || 0;
    const ports = (b.getFieldValue('MOTORS') || '').split(',').map(s => s.trim()).filter(Boolean);
    const state = b.getFieldValue('STATE');
    if (!ports.length) return "# No motors\n";
    if (ports.length === 1)
      return `await async_motor_speed("${ports[0]}",${speed},"${state}")\n`;
    return `await async_motor_speed(${ports.map(p => `"${p}"`).join(',')},${speed},"${state}")\n`;
  };
  reg['start'] = b => {
    let body = py.statementToCode(b, 'DO');
    const val = py.valueToCode(b, 'VALUE', py.ORDER_NONE);
    if (val) {
      body += '    return ' + val + '\n';
    }
    if (!body) {
      body = '    pass\n';
    }
    return `async def start():\n${body}\n`;
  };
  reg['do_dc_motor2'] = b => {
    const angle = b.getFieldValue('STATE') || 0;
    const ports = (b.getFieldValue('MOTORS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return '# Motor: no port\n';
    if (ports.length === 1) return `await async_motor("${ports[0]}","${angle}")\n`;
    return `await async_motor(${ports.map(p => `"${p}"`).join(',')}, "${angle}")\n`;
  };
  reg['do_servo'] = b => {
    const ports = (b.getFieldValue('SERVO_PORT') || '').split(',').map(s => s.trim()).filter(Boolean);
    const angle = b.getFieldValue('ANG') || 0;
    if (!ports.length) return "# do_servo: no port\n";
    if (ports.length === 1) return `await async_servo("${ports[0]}",${angle})\n`; return `await async_servo(${ports.map(p => `"${p}"`).join(',')},${angle})\n`;
  };
  reg['ctl_delay'] = b => `await asyncio.sleep_ms(${b.getFieldValue('MS') || 0})\n`;
  reg['lp_while'] = b => { const cond = py.valueToCode(b, 'COND', py.ORDER_NONE) || 'False'; const body = py.statementToCode(b, 'DO') || '  pass\n'; return `while ${cond}:\n  await asyncio.sleep(0)\n${body}`; };
  reg['lp_break'] = () => 'break\n';
  reg['lp_continue'] = () => 'continue\n';
  reg['lp_start'] = () => '@@START\n';
  reg['lp_repeat_count'] = function (block) {
    const n = block.getFieldValue('COUNT') || 0;
    const pin = block.getFieldValue('PIN');
    const body = py.statementToCode(block, 'DO') || '  pass\n';
    return `for i in range(${pin},${n}):\n  await asyncio.sleep(0)\n${body}`;
  };
  reg['lp_label'] = b => { const name = py.valueToCode(b, 'NAME', py.ORDER_NONE); return `print(${name || ''})\n`; };

  reg['controls_flow_statements'] = function (block) {
    var keyword = block.getFieldValue('FLOW') == 'BREAK' ? 'break\n' : 'continue\n';
    return keyword;
  };

  reg['controls_repeat_ext'] = function (block) {
    var repeats = py.valueToCode(block, 'TIMES', py.ORDER_NONE) || '0';
    var branch = py.statementToCode(block, 'DO') || '  pass\n';
    return 'for _ in range(' + repeats + '):\n  await asyncio.sleep(0)\n' + branch;
  };

  reg['controls_whileUntil'] = function (block) {
    var until = block.getFieldValue('MODE') == 'UNTIL';
    var argument0 = py.valueToCode(block, 'BOOL', until ? py.ORDER_LOGICAL_NOT : py.ORDER_NONE) || 'False';
    var branch = py.statementToCode(block, 'DO') || '  pass\n';
    if (until) {
      argument0 = 'not ' + argument0;
    }
    return 'while ' + argument0 + ':\n  await asyncio.sleep(0)\n' + branch;
  };

  reg['controls_for'] = function (block) {
    var variable0 = py.nameDB_ ? py.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE) : block.getFieldValue('VAR');
    var argument0 = py.valueToCode(block, 'FROM', py.ORDER_NONE) || '0';
    var argument1 = py.valueToCode(block, 'TO', py.ORDER_NONE) || '0';
    var step = py.valueToCode(block, 'BY', py.ORDER_NONE) || '1';
    var branch = py.statementToCode(block, 'DO') || '  pass\n';
    return 'for ' + variable0 + ' in range(' + argument0 + ', ' + argument1 + ' + 1, ' + step + '):\n  await asyncio.sleep(0)\n' + branch;
  };

  reg['controls_forEach'] = function (block) {
    var variable0 = py.nameDB_ ? py.nameDB_.getName(block.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE) : block.getFieldValue('VAR');
    var argument0 = py.valueToCode(block, 'LIST', py.ORDER_NONE) || '[]';
    var branch = py.statementToCode(block, 'DO') || '  pass\n';
    return 'for ' + variable0 + ' in ' + argument0 + ':\n  await asyncio.sleep(0)\n' + branch;
  };
  reg['din_if_else'] = function (b) {
    const cond = py.valueToCode(b, 'COND', py.ORDER_NONE) || 'False';
    const doS = py.statementToCode(b, 'DO') || '  pass\n';
    const elseS = py.statementToCode(b, 'ELSE') || '  pass\n';
    function makeGather(stmtCode) {
      var ls = stmtCode.split('\n')
        .map(function (l) { return l.trimEnd(); })
        .filter(function (l) { return l.trim() && !l.trim().startsWith('#'); });
      if (ls.length <= 1) return stmtCode;
      // Separate lines into:
      //   gatherLines: pure actuator awaits (await async_motor/servo/led/buzzer/relay...)
      //   passthrough: assignment lines, control flow, etc.
      var ind = (ls[0].match(/^(\s*)/) || ['', ''])[1];
      // An actuator line is: optional indent + "await async_xxx(...)" with no "=" assignment before the await
      var actuatorPat = /^\s*await\s+async_\w+\s*\(/;
      var assignPat = /^\s*\w+\s*=\s*/;
      var allActuators = ls.every(function (l) {
        return actuatorPat.test(l) && !assignPat.test(l);
      });
      if (!allActuators) return stmtCode; // mixed content, keep as-is
      var coros = ls.map(function (l) { return l.trim().replace(/^await\s+/, ''); });
      return ind + 'await asyncio.gather(\n'
        + coros.map(function (c) { return ind + '    ' + c + ','; }).join('\n')
        + '\n' + ind + ')\n';
    }
    return 'if ' + cond + ':\n' + makeGather(doS) + 'else:\n' + makeGather(elseS) + '\n';
  };

  // Override default controls_if to use asyncio.gather() in all branches
  reg['controls_if'] = function (b) {
    function makeGather(stmtCode) {
      if (!stmtCode || !stmtCode.trim()) return stmtCode;
      var lines = stmtCode.split('\n');
      // Find base indentation from first non-empty line
      var baseInd = '';
      for (var k = 0; k < lines.length; k++) {
        if (lines[k].trim()) { baseInd = (lines[k].match(/^(\s*)/) || ['', ''])[1]; break; }
      }
      var baseLen = baseInd.length;
      var actuatorPat = /^\s*await\s+async_\w+\s*\(/;
      var assignPat = /^\s*\w+\s*=\s*/;
      // Build top-level segments
      var segments = [];
      var i = 0;
      while (i < lines.length) {
        var line = lines[i];
        if (!line.trim()) { i++; continue; }
        var lineLen = (line.match(/^(\s*)/) || ['', ''])[1].length;
        if (lineLen !== baseLen) { i++; continue; }
        // Peek at next non-empty line to detect multi-line block
        var peek = i + 1;
        while (peek < lines.length && !lines[peek].trim()) peek++;
        var nextDeeper = peek < lines.length &&
          (lines[peek].match(/^(\s*)/) || ['', ''])[1].length > baseLen;
        if (nextDeeper) {
          // Multi-line block — collect until back to base indent
          var blockParts = [line];
          i++;
          while (i < lines.length) {
            var bl = lines[i];
            if (!bl.trim()) { blockParts.push(bl); i++; continue; }
            if ((bl.match(/^(\s*)/) || ['', ''])[1].length > baseLen) {
              blockParts.push(bl); i++;
            } else { break; }
          }
          segments.push({ type: 'block', code: blockParts.join('\n') });
        } else {
          // Single top-level line
          var isAct = actuatorPat.test(line) && !assignPat.test(line);
          segments.push({
            type: isAct ? 'actuator' : 'other',
            code: line,
            coro: isAct ? line.trim().replace(/^await\s+/, '') : null
          });
          i++;
        }
      }
      if (!segments.length) return stmtCode;
      // Merge consecutive actuators (>=2) into gather; singles stay as-is
      var result = '';
      var j = 0;
      while (j < segments.length) {
        if (segments[j].type === 'actuator') {
          var grp = [segments[j]];
          while (j + 1 < segments.length && segments[j + 1].type === 'actuator') {
            j++; grp.push(segments[j]);
          }
          if (grp.length >= 2) {
            result += baseInd + 'await asyncio.gather(\n'
              + grp.map(function (s) { return baseInd + '    ' + s.coro + ','; }).join('\n')
              + '\n' + baseInd + ')\n';
          } else {
            result += grp[0].code.trimEnd() + '\n';
          }
        } else {
          result += segments[j].code.trimEnd() + '\n';
        }
        j++;
      }
      return result;
    }

    var n = 0; // count elseif clauses (inputs are named IF1, IF2, ...)
    while (b.getInput('IF' + (n + 1))) n++;

    var cond0 = py.valueToCode(b, 'IF0', py.ORDER_NONE) || 'False';
    var do0 = py.statementToCode(b, 'DO0') || '    pass\n';
    var code = 'if ' + cond0 + ':\n' + makeGather(do0);

    for (var i = 1; i <= n; i++) {
      var condI = py.valueToCode(b, 'IF' + i, py.ORDER_NONE) || 'False';
      var doI = py.statementToCode(b, 'DO' + i) || '    pass\n';
      code += 'elif ' + condI + ':\n' + makeGather(doI);
    }

    var hasElse = b.getInput('ELSE');
    if (hasElse) {
      var elseS = py.statementToCode(b, 'ELSE') || '    pass\n';
      code += 'else:\n' + makeGather(elseS);
    }

    return code + '\n';
  };

  reg['do_led_param'] = b => { const pins = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); const v1 = b.getFieldValue('VAL') || 0; const v2 = b.getFieldValue('VAL2') || 0; if (!pins.length) return "# do_led_param: no pins\n"; return pins.map(p => `led_blink('${p}',${v1},${v2})\n`).join(''); };
  reg['logical_comparison'] = b => { const v1 = py.valueToCode(b, 'VALUE1', py.ORDER_NONE); const op = b.getFieldValue('OPERATOR'); const v2 = py.valueToCode(b, 'VALUE2', py.ORDER_NONE); return [`${v1} ${op} ${v2}`, py.ORDER_RELATIONAL]; };
  reg['red_led'] = b => { const pins = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); const v1 = b.getFieldValue('VAL1'); const v2 = b.getFieldValue('VAL2'); if (!pins.length) return "# red_blink: no pins\n"; return pins.map(p => `await async_red_blink("${p}",${v1},${v2})\n`).join(''); };
  reg['yellow_led'] = b => { const pins = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); const v1 = b.getFieldValue('VAL1'); const v2 = b.getFieldValue('VAL2'); if (!pins.length) return "# yellow_blink: no pins\n"; return pins.map(p => `await async_yellow_blink("${p}",${v1},${v2})\n`).join(''); };
  reg['green_led'] = b => { const pins = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); const v1 = b.getFieldValue('VAL1'); const v2 = b.getFieldValue('VAL2'); if (!pins.length) return "# green_blink: no pins\n"; return pins.map(p => `await async_green_blink("${p}",${v1},${v2})\n`).join(''); };

  reg['three_d_model'] = function (block) {
    var model = block.getFieldValue('MODEL_TYPE') || 'cube';
    var speed = block.getFieldValue('SPIN_SPEED') || '30';
    var color = block.getFieldValue('MODEL_COLOR') || '#7c3aed';
    return 'robot.display_3d("' + model + '", ' + speed + ', "' + color + '")\n';
  };


  reg['speedo_3d'] = function (block) {
    var speed = block.getFieldValue('SPEED_VAL') || '0';
    return 'robot.set_speed(' + speed + ')\n';
  };

  reg['sim_solar'] = function (b) { return 'robot.sim("sim_solar", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_pendulum'] = function (b) { return 'robot.sim("sim_pendulum", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_particles'] = function (b) { return 'robot.sim("sim_particles", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_dna'] = function (b) { return 'robot.sim("sim_dna", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_gears'] = function (b) { return 'robot.sim("sim_gears", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_wave'] = function (b) { return 'robot.sim("sim_wave", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_bouncing'] = function (b) { return 'robot.sim("sim_bouncing", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_windmill'] = function (b) { return 'robot.sim("sim_windmill", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_atom'] = function (b) { return 'robot.sim("sim_atom", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  reg['sim_globe'] = function (b) { return 'robot.sim("sim_globe", ' + (b.getFieldValue('SIM_SPEED') || '50') + ')\n'; };
  // Sensor output blocks
  // Maps block type → [asyncFnName, syncFnName]
  // asyncFnName is used for await async_xxx(...) in value context
  // syncFnName kept for backward compat but async is preferred
  const sensorOutputMap = {
    din_sound: ['async_sound', 'sound'],
    din_tilt: ['async_tilt', 'tilt'],
    din_door: ['async_get_door', 'get_door'],
    din_button: ['async_button', 'button'],
    din_motion: ['async_motion', 'motion'],
    light_freq: ['async_light_freq', 'light_freq'],
    din_proximity: ['async_get_proximity', 'get_proximity'],
    din_ir: ['async_get_ir', 'get_ir'],
    din_flame: ['async_flame', 'flame'],
    ana_flame: ['async_flame', 'flame'],
    load_cell: ['async_load_cell', 'load_cell'],
    tep_ana: ['async_temp_ana_sensor', 'temp_ana_sensor'],
    heart_beat: ['async_heart_beat', 'heart_beat'],
    ldr: ['async_LDR', 'LDR'],
    soil_moisture: ['async_soil_moisture', 'soil_moisture'],
    dust: ['async_dust', 'dust'],
    'vibration-switch-sensor': ['async_vibration_sensor', 'vibration_sensor'],
    'Current-sensor': ['async_current', 'current'],
    'IR-Temp': ['async_IrTemp', 'IrTemp'],
    'temp2-sensor': ['async_tempanalog', 'tempanalog'],
    ecg: ['async_ecg', 'ecg'],
    ana_temp: ['async_ana_temp', 'ana_temp'],
    shock_sensor: ['async_shock_sensor', 'shock_sensor'],
    'flex-sensor': ['async_flex', 'flex'],
    humidity: ['async_humidity', 'humidity'],
    joystick_move: ['async_joy_stick', 'joy_stick'],
    Air_quality_sensor: ['async_air_quality_sensor', 'air_quality_sensor'],
    flexi_force_sensor: ['async_flexi_sensor', 'flexi_sensor'],
    TDS_Water_sensor: ['async_tds_sensor', 'tds_sensor'],
    'water-turbidity-sensor': ['async_waterturbidity', 'waterturbidity'],
    ir_sen: ['async_IR', 'IR'],
    din_ultra: ['async_ultrasonic', 'ultrasonic'],
    voltage_sensor: ['async_voltage', 'voltage'],
    water_sensor: ['async_water_sen', 'water_sen'],
  };

  Object.entries(sensorOutputMap).forEach(([type, [asyncFn, syncFn]]) => {
    reg[type] = b => {
      const pins = (b.getFieldValue('PORTS') || '').split(',').map(p => p.trim()).filter(Boolean);
      if (!pins.length) return ['# Invalid: no port', py.ORDER_NONE];
      // Generate: await async_xxx("PIN") — works as expression value in async def
      return [`await ${asyncFn}(${pins.map(p => `"${p}"`).join(',')})`, py.ORDER_FUNCTION_CALL];
    };
  });
  reg['din_ultra_range'] = function (block) {
    const ports = (block.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    const angle = block.getFieldValue('STATE') || 0;
    const val1 = block.getFieldValue('ANG1');
    const val2 = block.getFieldValue('ANG2');
    if (!ports.length) return ['# Ultra sonic : no port', py.ORDER_NONE];
    if (ports.length === 1) return [`await async_ultrasonic("${ports[0]}","${val1}","${val2}","${angle}")`, py.ORDER_FUNCTION_CALL];
    return [`await async_ultrasonic(${ports.map(p => `"${p}"`).join(',')},"${val1}","${val2}", "${angle}")`, py.ORDER_FUNCTION_CALL];
  };
  reg['piezo_sensor'] = function (block) {
    const portsTxt = block.getFieldValue('PORTS') || '';

    // Split ports like "D3,H1"
    const pins = portsTxt
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    // If no ports are selected, show a warning message
    if (!pins.length) {
      return ['# Invalid: Please select at least one port', py.ORDER_NONE];
    }

    // If one port is selected, return code for that port only
    if (pins.length === 1) {
      return [`piezo_sensor("${pins[0]}")`, py.ORDER_FUNCTION_CALL];
    }

    // If two ports are selected, use both for Trig and Echo
    if (pins.length === 2) {
      return [`piezo_sensor("${pins[0]}","${pins[1]}")`, py.ORDER_FUNCTION_CALL];
    }

    // If more than two ports are selected, return the first two only
    return [`piezo_sensor("${pins[0]}","${pins[1]}","${pins[2]}")`, py.ORDER_FUNCTION_CALL];
  };

  reg['touch_sensor'] = function (block) {
    const portsTxt = block.getFieldValue('PORTS') || '';

    // Split ports like "D3,H1"
    const pins = portsTxt
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    // If no ports are selected, show a warning message
    if (!pins.length) {
      return ['# Invalid: Please select at least one port', py.ORDER_NONE];
    }

    // If one port is selected, return code for that port only
    if (pins.length === 1) {
      return [`await async_touch_sensor("${pins[0]}")`, py.ORDER_FUNCTION_CALL];
    }

    // If two ports are selected, use both for Trig and Echo
    if (pins.length === 2) {
      return [`await async_touch_sensor("${pins[0]}","${pins[1]}")`, py.ORDER_FUNCTION_CALL];
    }

    // If more than two ports are selected, return the first two only
    return [`await async_touch_sensor("${pins[0]}","${pins[1]}","${pins[2]}")`, py.ORDER_FUNCTION_CALL];
  };

  reg['peltier'] = function (block) {
    const ports = (block.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    const stateVal = block.getFieldValue('STATE');

    if (ports.length === 0) {
      return "# No pin selected\n";
    }

    if (ports.length === 1) {
      return `await async_peltier("${ports[0]}","${stateVal}")\n`;
    }
    const portList = ports.map(p => `"${p}"`).join(', ');
    return `await async_peltier(${portList},"${stateVal}")\n`;
  };

  reg['microwave_sensor'] = function (block) {
    const portsTxt = block.getFieldValue('PORTS') || '';

    // Split ports like "D3,H1"
    const pins = portsTxt
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    // If no ports are selected, show a warning message
    if (!pins.length) {
      return ['# Invalid: Please select at least one port', py.ORDER_NONE];
    }

    // If one port is selected, return code for that port only
    if (pins.length === 1) {
      return [`await async_microwave_sensor("${pins[0]}")`, py.ORDER_FUNCTION_CALL];
    }

    // If two ports are selected, use both for Trig and Echo
    if (pins.length === 2) {
      return [`await async_microwave_sensor("${pins[0]}","${pins[1]}")`, py.ORDER_FUNCTION_CALL];
    }

    // If more than two ports are selected, return the first two only
    return [`await async_microwave_sensor("${pins[0]}","${pins[1]}","${pins[2]}")`, py.ORDER_FUNCTION_CALL];
  };
  reg['sensor'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return "# no ports\n"; const fn = b.getFieldValue('STATE') === '1' ? 'sensor_on' : 'sensor_off'; return ports.map(p => `${fn}(${p})\n`).join(''); };
  reg['tem_sensor'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return "# no ports\n"; const fn = b.getFieldValue('STATE') === '1' ? 'tem_sensor_on' : 'tem_sensor_off'; return ports.map(p => `${fn}(${p})\n`).join(''); };
  reg['xray_sensor'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return "# no ports\n"; const fn = b.getFieldValue('STATE') === '1' ? 'xray_sensor_on' : 'xray_sensor_off'; return ports.map(p => `${fn}(${p})\n`).join(''); };
  reg['rc_sensor'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return "# no ports\n"; const fn = b.getFieldValue('STATE') === '1' ? 'rc_sensor_on' : 'rc_sensor_off'; return ports.map(p => `${fn}(${p})\n`).join(''); };
  reg['steper'] = b => { const speed = +b.getFieldValue('SPEED') || 0; const motors = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!motors.length) return '# Stepper: no port\n'; if (motors.length === 1) return `get_stepper("${motors[0]}",${speed})\n`; return `get_stepper(${motors.map(p => `"${p}"`).join(',')},${speed})\n`; };
  reg['waterpump'] = b => { const angle = b.getFieldValue('ANGLE') || 0; const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return '# Waterpump: no port\n'; if (ports.length === 1) return `get_waterpump("${ports[0]}",${angle})\n`; return `get_waterpump(${ports.map(p => `"${p}"`).join(',')},${angle})\n`; };
  reg['solinoid'] = b => { const angle = b.getFieldValue('STATE') || 0; const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return '# Solinoid: no port\n'; if (ports.length === 1) return `get_solinoid("${ports[0]}",${angle})\n`; return `get_solinoid(${ports.map(p => `"${p}"`).join(',')},${angle})\n`; };
  reg['animo'] = b => { const angle = b.getFieldValue('STATE') || 0; const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return '# Animo: no port\n'; if (ports.length === 1) return `get_animo("${ports[0]}",${angle})\n`; return `get_animo(${ports.map(p => `"${p}"`).join(',')},${angle})\n`; };
  reg['relay'] = b => { const angle = b.getFieldValue('STATE') || 0; const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return '# relay: no port\n'; if (ports.length === 1) return `await async_relay("${ports[0]}",${angle})\n`; return `await async_relay(${ports.map(p => `"${p}"`).join(',')},${angle})\n`; };
  reg['buzzer'] = b => { const v1 = b.getFieldValue('VAL1') || 0; const v2 = b.getFieldValue('VAL2') || 0; const v3 = b.getFieldValue('VAL3') || 0; const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return '# Buzzer: no port\n'; if (ports.length === 1) return `await async_buzzer("${ports[0]}",${v1},${v2},${v3})\n`; return `await async_buzzer(${ports.map(p => `"${p}"`).join(',')},${v1},${v2},${v3})\n`; };
  reg['minifan'] = b => { const state = b.getFieldValue('STATE') || 0; const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); if (!ports.length) return '# MINI FAN: no port\n'; if (ports.length === 1) return `mini_fan("${ports[0]}","${state}")\n`; return `mini_fan(${ports.map(p => `"${p}"`).join(',')},"${state}")\n`; };
  reg['loop_end'] = b => `${b.getFieldValue('NAME') || ''}\n`;
  reg['rgb_display'] = b => `displayRGBColors(${b.getFieldValue('RED')},${b.getFieldValue('ORANGE')},${b.getFieldValue('YELLOW')},${b.getFieldValue('GREEN')},${b.getFieldValue('CYAN')});\n`;
  reg['rgb_component'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); const freq = b.getFieldValue('freq'); const d1 = b.getFieldValue('Delay1'); const d2 = b.getFieldValue('DELAY2'); if (!ports.length) return "# rgb_component: no ports\n"; return ports.map(p => `rgb("${p}",${freq},${d1},${d2})\n`).join(''); };
  reg['buzzer_component'] = b => { const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean); const freq = b.getFieldValue('freq'); const d1 = b.getFieldValue('Delay1'); const d2 = b.getFieldValue('DELAY2'); if (!ports.length) return "# buzzer_component: no ports\n"; return ports.map(p => `buzzer("${p}",${freq},${d1},${d2})\n`).join(''); };
  reg['LCD_print'] = b => { const txt = py.valueToCode(b, 'TEXT', py.ORDER_NONE) || ""; return `await async_lcd(${txt})\n`; };
  reg['din_flame'] = b => { const port = b.getFieldValue('PORTS'); return [`await async_flame("${port}")`, py.ORDER_FUNCTION_CALL]; };
  reg['ana_flame'] = b => { const port = b.getFieldValue('PORTS'); return [`await async_flame("${port}")`, py.ORDER_FUNCTION_CALL]; };
  reg['din_temp'] = b => { const port = b.getFieldValue('PORTS'); return [`await async_temp("${port}")`, py.ORDER_FUNCTION_CALL]; };
  reg['magnetic_sensor'] = () => [`await async_magnetic()`, py.ORDER_ATOMIC];
  reg['colour_sen'] = () => [`await async_colour()`, py.ORDER_ATOMIC];
  reg['system_status'] = () => [`system_status.running`, py.ORDER_ATOMIC];
  reg['accelerometer_sensor'] = () => [`await async_accelerometer()`, py.ORDER_ATOMIC];
  reg['rtc_sensor'] = () => [`await async_rtc()`, py.ORDER_ATOMIC];
  reg['LCD'] = () => [`await async_lcd()`, py.ORDER_ATOMIC];
  reg['pressure'] = () => [`await async_pressure()`, py.ORDER_ATOMIC];
  reg['compass'] = () => [`await async_compass()`, py.ORDER_ATOMIC];
  reg['ceprom'] = () => [`await async_eeprom()`, py.ORDER_ATOMIC];
  reg['speaker'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await async_speaker("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await async_speaker(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };
  reg['rotation_sensor'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await async_rotation("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await async_rotation(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };
  reg['gsr_skin_current_sensor'] = () => [`await async_gsr_skin_current_sensor()`, py.ORDER_ATOMIC];
  reg['line_follower'] = () => [`await async_line_follower_array()`, py.ORDER_ATOMIC];
  reg['water_level'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await water_level("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await water_level(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };
  reg['solor_panel'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await async_solor_panel("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await async_solor_panel(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };
  reg['admp'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await async_admp401("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await async_admp401(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };
  reg['uv_sensor_ana'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await async_uv_sensor_ana("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await async_uv_sensor_ana(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };
  reg['ph_sensor'] = b => {
    const ports = (b.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ports.length) return ['# no port', py.ORDER_NONE];
    if (ports.length === 1)
      return [`await async_ph_sensor("${ports[0]}")`, py.ORDER_ATOMIC];
    return [`await async_ph_sensor(${ports.map(p => `"${p}"`).join(',')})`, py.ORDER_ATOMIC];
  };

  reg['uv_sensor'] = () => [`await async_uv_sensor()`, py.ORDER_ATOMIC];


  reg['seven_segment'] = () => [`await async_seven_segment()`, py.ORDER_ATOMIC];
  reg['gas_sensor'] = () => [`await async_gas_sensor()`, py.ORDER_ATOMIC];
  reg['lifi_receiver'] = () => [`await async_lifi_receiver()`, py.ORDER_ATOMIC];
  reg['lifi_transmitter'] = () => [`await async_lifi_transmitter()`, py.ORDER_ATOMIC];
  reg['touch_potentiometer'] = () => [`await async_touch_potentiometer()`, py.ORDER_ATOMIC];
  reg['fm_receiver'] = () => [`await async_fm_receiver()`, py.ORDER_ATOMIC];
  reg['gusture'] = () => [`await async_gesture()`, py.ORDER_ATOMIC];
  reg['ir_temp'] = () => [`await async_ir_temp()`, py.ORDER_ATOMIC];
  reg['motor_driver'] = () => [`await async_motor_driver()`, py.ORDER_ATOMIC];
  reg['nfc_reader'] = () => [`await async_nfc_reader()`, py.ORDER_ATOMIC];
  reg['mag_encoder'] = () => [`await async_mag_encoder()`, py.ORDER_ATOMIC];
  reg['rfc'] = () => [`await async_rfc()`, py.ORDER_ATOMIC];
  reg['text_speech'] = () => [`await async_text_speech()`, py.ORDER_ATOMIC];
  reg['temp_sensor'] = () => [`await async_temp_sensor()`, py.ORDER_ATOMIC];
  reg['accelerometer'] = () => [`await async_accelerometer()`, py.ORDER_ATOMIC];
  reg['max'] = b => [`await async_max()`, py.ORDER_ATOMIC];
  reg['ambient-sen'] = () => [`await async_ambient()`, py.ORDER_ATOMIC];
  reg['finger_print_enroll'] = b => [`await async_fingerprint_enroll()`, py.ORDER_ATOMIC];
  reg['finger_print_match'] = b => [`await async_fingerprint_match()`, py.ORDER_ATOMIC];
  reg['soli_npk'] = b => [`await async_soil_moisture_npk()`, py.ORDER_ATOMIC];
  reg['any_input_block'] = b => [b.getFieldValue('ANY'), py.ORDER_ATOMIC];
  reg['custom_if_then'] = b => { const cond = py.valueToCode(b, 'CONDITION', py.ORDER_NONE) || 'False'; const stmts = py.statementToCode(b, 'DO'); return `if ${cond}:\n${stmts || '    pass\n'}`; };
  reg['rgb_led_display'] = b => { const led = b.getFieldValue('LED'); const hex = b.getFieldValue('COLOR') || "#ff0000"; const time = py.valueToCode(b, 'TIME', py.ORDER_ATOMIC) || 1; const r = parseInt(hex.substring(1, 3), 16); const g = parseInt(hex.substring(3, 5), 16); const bv = parseInt(hex.substring(5, 7), 16); return `await async_rgb_led("${led}",${r},${g},${bv},${time})\n`; };

  reg['keypad'] = function (block) {
    const ports = (block.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean);

    if (ports.length === 0) {
      return '# No Keypin selected\n';
    }
    if (ports.length === 1) {
      return `await async_keypad("${ports[0]}")\n`;
    }
    const portList = ports.map(p => `"${p}"`).join(', ');
    return `await async_keypad(${portList})\n`;
  };
  reg['gps'] = b => [`gps()`, py.ORDER_ATOMIC];

  reg['gsm'] = function (block) {
    const val1 = block.getFieldValue('VAL1');
    const val2 = block.getFieldValue('VAL2');
    // ALWAYS return a STRING
    return `gsm("${val1}","${val2}")\n`;
  };
  reg['tof'] = b => [`tof()`, py.ORDER_ATOMIC];
  reg['compare'] = function (b) {
    var name = py.valueToCode(b, 'NAME', py.ORDER_NONE); // Correct way to get field value
    var name2 = py.valueToCode(b, 'NAME2', py.ORDER_NONE);
    return `${name || ''} = ${name2 || ''} \n`;  // Ensure empty string fallback
  };
  reg['llm_text'] = function (block) {
    const val1 = block.getFieldValue('VAL1');
    var name2 = py.valueToCode(block, 'NAME2', py.ORDER_NONE);
    const angle = block.getFieldValue('STATE') || 0;
    return `await async_llm_text(${name2},"${angle}","${val1}")\n`;
  };
  reg['ai_block'] = b => {
    const State = b.getFieldValue('STATE') || 0;
    return `await async_ai_block("${State}")\n`;
  };
  reg['ai_output'] = b => {
    const State = b.getFieldValue('STATE') || 0;
    return [`await async_ai_output("${State}")`, py.ORDER_FUNCTION_CALL];
  };
  reg['object_de'] = b => {
    const State = b.getFieldValue('STATE') || 0;
    return `await async_object_detection("${State}")\n`;
  };
  reg['object_out'] = b => {
    const State = b.getFieldValue('STATE') || 0;
    return [`await async_object_output("${State}")`, py.ORDER_FUNCTION_CALL];
  };

  reg['ai_open_train'] = b => `await async_open_ai_training()  # opens AI Training Studio\n`;
  reg['ai_open_train_k230'] = b => `await async__k230_open_ai_training()  # opens AI Training Studio\n`;
  reg['ai_open_train_s3'] = b => `await async__s3_open_ai_training()  # opens AI Training Studio\n`;
  reg['ai_export_model'] = b => `await async_export_ai_model()  # exports trained model to board\n`;
  reg['ai_export_model_k230'] = b => `await async__k230_export_ai_model()  # exports trained model to K230 board\n`;
  reg['ai_export_model_s3'] = b => `await async__s3_export_ai_model()  # exports trained model to S3 board\n`;
  reg['ai_classify_image'] = b => {
    const cls = b.getFieldValue('CLASS') || 'Class1';
    return `await async_get_ai_classify_image("${cls}")\n`;
  };
  reg['ai_classify_image_k230'] = b => {
    const cls = b.getFieldValue('CLASS') || 'Class1';
    return `await async__k230_get_ai_classify_image("${cls}")\n`;
  };
  reg['ai_classify_image_s3'] = b => {
    const cls = b.getFieldValue('CLASS') || 'Class1';
    return `await async__s3_get_ai_classify_image("${cls}")\n`;
  };
  reg['ai_class_result'] = b => [`await async_result("${b.getFieldValue('CLASS')}")`, py.ORDER_RELATIONAL];
  reg['ai_class_result_k230'] = b => [`await async__k230_result("${b.getFieldValue('CLASS')}")`, py.ORDER_RELATIONAL];
  reg['ai_class_result_s3'] = b => [`await async__s3_result("${b.getFieldValue('CLASS')}")`, py.ORDER_RELATIONAL];
  reg['ai_class_reliability'] = b => [`await async_get_reliability("${b.getFieldValue('CLASS')}")`, py.ORDER_FUNCTION_CALL];
  reg['ai_class_reliability_k230'] = b => [`await async__k230_get_reliability("${b.getFieldValue('CLASS')}")`, py.ORDER_FUNCTION_CALL];
  reg['ai_class_reliability_s3'] = b => [`await async__s3_get_reliability("${b.getFieldValue('CLASS')}")`, py.ORDER_FUNCTION_CALL];
  reg['ai_infer'] = () => `await async_run_inference()\n`;
  reg['ai_infer_k230'] = () => `await async__k230_run_inference()\n`;
  reg['ai_infer_s3'] = () => `await async__s3_run_inference()\n`;

  // ── Voice ML generators ──────────────────────────────────────────────
  reg['voice_classify'] = b => {
    const word = b.getFieldValue('WORD') || 'word';
    return `await async_voice_classify("${word}")\n`;
  };
  reg['voice_heard'] = b => [`await async_voice_heard("${b.getFieldValue('WORD')}")`, py.ORDER_RELATIONAL];
  reg['voice_confidence'] = b => [`await async_voice_confidence("${b.getFieldValue('WORD')}")`, py.ORDER_FUNCTION_CALL];

  // ── Pose ML generators ───────────────────────────────────────────────
  reg['pose_classify'] = b => {
    const pose = b.getFieldValue('POSE') || 'Pose1';
    return `await async_pose_classify("${pose}")\n`;
  };
  reg['pose_detected'] = b => [`await async_pose_detected("${b.getFieldValue('POSE')}")`, py.ORDER_RELATIONAL];
  reg['pose_confidence'] = b => [`await async_pose_confidence("${b.getFieldValue('POSE')}")`, py.ORDER_FUNCTION_CALL];
}

// =====================================================================
// BUTTON LOCK / MUTEX SYSTEM
// Prevents multiple concurrent operations (upload, play, stop, etc.)
// Only one operation can run at a time. All other buttons are disabled
// visually and functionally until the active operation completes.
// =====================================================================
let _operationLock = false;

/**
 * The IDs of buttons that participate in the mutex.
 * upload, playmode, stop, soft_reset, hard_reset are the main ops.
 */
const LOCKABLE_BTN_IDS = ['upload', 'playmode', 'stop', 'soft_reset', 'hard_reset', 'btnRun', 'btnStop', 'btnUpload', 'btnLive'];

/**
 * Acquire the operation lock.
 * @param {string} activeId - The button ID that is currently running.
 * @returns {boolean} true if lock was acquired, false if already locked.
 */
function acquireOpLock(activeId) {
  if (_operationLock) return false;
  _operationLock = true;

  LOCKABLE_BTN_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (id === activeId) {
      // Show the active button as "busy"
      btn.dataset._origText = btn.textContent;
      btn.dataset._origOpacity = btn.style.opacity || '';
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
      btn.disabled = true;
    } else {
      // Dim and disable other buttons
      btn.dataset._origOpacity = btn.style.opacity || '';
      btn.dataset._origCursor = btn.style.cursor || '';
      btn.style.opacity = '0.35';
      btn.style.cursor = 'not-allowed';
      btn.disabled = true;
    }
  });
  return true;
}

/**
 * Release the operation lock and restore all buttons.
 */
function releaseOpLock() {
  _operationLock = false;
  LOCKABLE_BTN_IDS.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = btn.dataset._origOpacity || '';
    btn.style.cursor = btn.dataset._origCursor || '';
    delete btn.dataset._origOpacity;
    delete btn.dataset._origCursor;
    delete btn.dataset._origText;
  });
}

/**
 * Wraps an async operation with the button lock.
 * Usage: await withOpLock('upload', async () => { ... your code ... });
 * If already locked, logs a warning and returns without running the op.
 */
async function withOpLock(activeId, asyncFn) {
  if (!acquireOpLock(activeId)) {
    handleBoardMessage('⚠️ Another operation is in progress. Please wait.', 'SYS');
    return;
  }
  try {
    await asyncFn();
  } finally {
    releaseOpLock();
  }
}

// =====================================================================
// APP START
// =====================================================================

// =====================================================================
// 3D SPEEDOMETER — Modal Logic (Three.js)
// =====================================================================
var currentSpeedoBlock = null;
var speedo3DValue = 0;
var speedo3DTarget = 0;
var speedo3DScene, speedo3DCamera, speedo3DRenderer;
var speedo3DNeedle, speedo3DGlow, speedo3DArcs = [];
var speedo3DAnimId;

function openSpeedo3D(block) {
  currentSpeedoBlock = block;
  speedo3DTarget = parseInt(block.getFieldValue('SPEED_VAL') || '0');
  speedo3DValue = speedo3DTarget;
  document.getElementById('speedo3DSlider').value = speedo3DTarget;
  updateSpeedo3DUI();
  document.getElementById('speedo3DModal').style.display = 'flex';
  setTimeout(initSpeedo3DScene, 50);
}

function closeSpeedo3D() {
  document.getElementById('speedo3DModal').style.display = 'none';
  currentSpeedoBlock = null;
  if (speedo3DAnimId) cancelAnimationFrame(speedo3DAnimId);
  if (speedo3DRenderer) {
    speedo3DRenderer.dispose();
    document.getElementById('speedo3DCanvas').innerHTML = '';
    speedo3DRenderer = null;
  }
}

function saveSpeedo3D() {
  if (!currentSpeedoBlock) { closeSpeedo3D(); return; }
  currentSpeedoBlock.setFieldValue(speedo3DTarget.toString(), 'SPEED_VAL');
  var label = currentSpeedoBlock.getField('SPEED_LABEL');
  if (label) label.setValue(speedo3DTarget + '%');
  closeSpeedo3D();
}

function setSpeedo3D(val) {
  speedo3DTarget = val;
  document.getElementById('speedo3DSlider').value = val;
  updateSpeedo3DUI();
}

function onSpeedo3DSlider(val) {
  speedo3DTarget = parseInt(val);
  updateSpeedo3DUI();
}

function updateSpeedo3DUI() {
  document.getElementById('speedo3DValue').textContent = speedo3DTarget;
  document.getElementById('speedo3DSliderVal').textContent = speedo3DTarget + '%';
  document.querySelectorAll('.speedo3d-preset').forEach(function (b) {
    var v = parseInt(b.textContent);
    b.classList.toggle('active', v === speedo3DTarget);
  });
}

function initSpeedo3DScene() {
  var container = document.getElementById('speedo3DCanvas');
  container.innerHTML = '';
  var W = container.clientWidth, H = container.clientHeight;

  speedo3DScene = new THREE.Scene();
  speedo3DCamera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  speedo3DCamera.position.set(0, 0.5, 5.5);
  speedo3DCamera.lookAt(0, 0, 0);

  speedo3DRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  speedo3DRenderer.setSize(W, H);
  speedo3DRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  speedo3DRenderer.setClearColor(0x000000, 0);
  container.appendChild(speedo3DRenderer.domElement);

  speedo3DScene.add(new THREE.AmbientLight(0xffffff, 0.4));
  var d = new THREE.DirectionalLight(0xffffff, 0.6);
  d.position.set(2, 3, 5);
  speedo3DScene.add(d);
  speedo3DScene.add(new THREE.PointLight(0x10b981, 0.5, 10).position.set(-3, 1, 2) || new THREE.PointLight(0x10b981, 0.5, 10));

  // Bezel
  var bezel = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.15, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.2 })
  );
  speedo3DScene.add(bezel);

  // Face
  var face = new THREE.Mesh(
    new THREE.CircleGeometry(2.05, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.1, roughness: 0.9 })
  );
  face.position.z = -0.05;
  speedo3DScene.add(face);

  // Arc segments
  speedo3DArcs = [];
  for (var i = 0; i < 30; i++) {
    var sa = Math.PI * 0.75 - (i / 30) * Math.PI * 1.5;
    var ea = Math.PI * 0.75 - ((i + 1) / 30) * Math.PI * 1.5;
    var curve = new THREE.ArcCurve(0, 0, 1.95, sa, ea, true);
    var pts = curve.getPoints(4);
    var tg = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p.x, p.y, 0.01); })),
      4, 0.06, 8, false
    );
    var pct = i / 30;
    var cr, cg, cb;
    if (pct < 0.4) { cr = 0.06; cg = 0.73; cb = 0.51; }
    else if (pct < 0.7) { cr = 0.95; cg = 0.75; cb = 0.05; }
    else { cr = 0.94; cg = 0.27; cb = 0.27; }
    var m = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({
      color: new THREE.Color(cr, cg, cb),
      emissive: new THREE.Color(cr, cg, cb),
      emissiveIntensity: 0.05, metalness: 0.3, roughness: 0.5,
      transparent: true, opacity: 0.25
    }));
    speedo3DScene.add(m);
    speedo3DArcs.push(m);
  }

  // Tick marks
  for (var t = 0; t <= 10; t++) {
    var ta = Math.PI * 0.75 - (t / 10) * Math.PI * 1.5;
    var isMaj = t % 2 === 0;
    var ir = isMaj ? 1.55 : 1.65;
    var pts2 = [
      new THREE.Vector3(Math.cos(ta) * ir, Math.sin(ta) * ir, 0.01),
      new THREE.Vector3(Math.cos(ta) * 1.85, Math.sin(ta) * 1.85, 0.01)
    ];
    speedo3DScene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts2),
      new THREE.LineBasicMaterial({ color: isMaj ? 0xe2e8f0 : 0x4b5563 })
    ));
    if (isMaj) {
      var lr = 1.35;
      var cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      var cx = cv.getContext('2d');
      cx.fillStyle = '#94a3b8';
      cx.font = 'bold 32px monospace';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(String(t * 10), 32, 32);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      sp.position.set(Math.cos(ta) * lr, Math.sin(ta) * lr, 0.02);
      sp.scale.set(0.4, 0.4, 1);
      speedo3DScene.add(sp);
    }
  }

  // Hub
  var hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.15, 32),
    new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.1 })
  );
  hub.rotation.x = Math.PI / 2; hub.position.z = 0.1;
  speedo3DScene.add(hub);

  // Needle
  var ns = new THREE.Shape();
  ns.moveTo(0, -0.04); ns.lineTo(1.6, -0.015); ns.lineTo(1.7, 0);
  ns.lineTo(1.6, 0.015); ns.lineTo(0, 0.04); ns.lineTo(-0.2, 0); ns.closePath();
  speedo3DNeedle = new THREE.Mesh(
    new THREE.ShapeGeometry(ns),
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide })
  );
  speedo3DNeedle.position.z = 0.15;
  speedo3DNeedle.rotation.z = Math.PI * 0.75;
  speedo3DScene.add(speedo3DNeedle);

  // Needle glow
  var gs = new THREE.Shape();
  gs.moveTo(0, -0.06); gs.lineTo(1.65, -0.02); gs.lineTo(1.65, 0.02); gs.lineTo(0, 0.06); gs.closePath();
  speedo3DGlow = new THREE.Mesh(
    new THREE.ShapeGeometry(gs),
    new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  );
  speedo3DGlow.position.z = 0.12;
  speedo3DGlow.rotation.z = Math.PI * 0.75;
  speedo3DScene.add(speedo3DGlow);

  // Pointer drag
  var isDrag = false;
  container.addEventListener('pointerdown', function (e) {
    isDrag = true; updateSpeedFromPointer3D(e, container);
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', function (e) {
    if (!isDrag) return;
    updateSpeedFromPointer3D(e, container);
  });
  container.addEventListener('pointerup', function () { isDrag = false; });

  animateSpeedo3D();
}

function updateSpeedFromPointer3D(e, container) {
  var rect = container.getBoundingClientRect();
  var dx = e.clientX - (rect.left + rect.width / 2);
  var dy = -(e.clientY - (rect.top + rect.height / 2));
  var angle = Math.atan2(dy, dx);
  var deg = angle * 180 / Math.PI;
  if (deg >= -135 && deg < 135) {
    var norm = Math.max(0, Math.min(1, (135 - deg) / 270));
    speedo3DTarget = Math.round(norm * 100);
    document.getElementById('speedo3DSlider').value = speedo3DTarget;
    updateSpeedo3DUI();
  }
}

function animateSpeedo3D() {
  speedo3DAnimId = requestAnimationFrame(animateSpeedo3D);
  speedo3DValue += (speedo3DTarget - speedo3DValue) * 0.12;
  var pct = speedo3DValue / 100;
  var na = Math.PI * 0.75 - pct * Math.PI * 1.5;
  speedo3DNeedle.rotation.z = na;
  speedo3DGlow.rotation.z = na;

  var nr, ng, nb;
  if (pct < 0.4) { nr = 0.06 + pct * 2.2; ng = 0.73; nb = 0.3; }
  else if (pct < 0.7) { nr = 0.95; ng = 0.75 - (pct - 0.4) * 1.5; nb = 0.1; }
  else { nr = 0.94; ng = Math.max(0, 0.27 - (pct - 0.7) * 0.5); nb = 0.27; }
  speedo3DNeedle.material.color.setRGB(nr, ng, nb);
  speedo3DGlow.material.color.setRGB(nr, ng, nb);
  speedo3DGlow.material.opacity = 0.1 + Math.sin(Date.now() * 0.005) * 0.05 + pct * 0.1;

  speedo3DArcs.forEach(function (m, i) {
    var ap = i / speedo3DArcs.length;
    var lit = ap <= pct;
    m.material.emissiveIntensity = lit ? 0.6 : 0.05;
    m.material.opacity = lit ? 1 : 0.25;
  });

  if (speedo3DRenderer && speedo3DScene && speedo3DCamera)
    speedo3DRenderer.render(speedo3DScene, speedo3DCamera);
}

// =====================================================================
// THREE.JS SIMULATION MODAL (10 simulations)
// =====================================================================
var currentSimBlock = null, currentSimType = '', simSpeed = 50;
var simScene, simCamera, simRenderer, simAnimId, simObjects = [];
var SIM_META = {
  sim_solar: { title: "Solar System", desc: "Planets orbiting the sun", grad: "linear-gradient(135deg,#f59e0b,#ef4444)" },
  sim_pendulum: { title: "Pendulum", desc: "Swinging pendulum physics", grad: "linear-gradient(135deg,#ef4444,#b91c1c)" },
  sim_particles: { title: "Particles", desc: "Particle fountain effect", grad: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  sim_dna: { title: "DNA Helix", desc: "Double helix rotation", grad: "linear-gradient(135deg,#06b6d4,#0891b2)" },
  sim_gears: { title: "Gear System", desc: "Interlocking gears spinning", grad: "linear-gradient(135deg,#64748b,#475569)" },
  sim_wave: { title: "Wave Surface", desc: "Animated sine wave mesh", grad: "linear-gradient(135deg,#0ea5e9,#0284c7)" },
  sim_bouncing: { title: "Bouncing Balls", desc: "Physics bouncing simulation", grad: "linear-gradient(135deg,#f97316,#ea580c)" },
  sim_windmill: { title: "Wind Turbine", desc: "Spinning turbine blades", grad: "linear-gradient(135deg,#22c55e,#16a34a)" },
  sim_atom: { title: "Atom Model", desc: "Electron orbit simulation", grad: "linear-gradient(135deg,#a855f7,#7c3aed)" },
  sim_globe: { title: "Earth Globe", desc: "Rotating wireframe globe", grad: "linear-gradient(135deg,#3b82f6,#2563eb)" }
};

function openSimModal(block, simType) {
  currentSimBlock = block; currentSimType = simType;
  simSpeed = parseInt(block.getFieldValue('SIM_SPEED') || '50');
  document.getElementById('simSpeedSlider').value = simSpeed;
  document.getElementById('simSpeedVal').textContent = simSpeed;
  var m = SIM_META[simType] || { title: simType, desc: '3D', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' };
  document.getElementById('simTitle').textContent = m.title;
  document.getElementById('simDesc').textContent = m.desc;
  document.getElementById('simHeader').style.background = m.grad;
  document.getElementById('simModal').style.display = 'flex';
  setTimeout(function () { initSimScene(simType); }, 60);
}
function closeSimModal() {
  document.getElementById('simModal').style.display = 'none'; currentSimBlock = null;
  if (simAnimId) cancelAnimationFrame(simAnimId);
  if (simRenderer) { simRenderer.dispose(); document.getElementById('simCanvas').innerHTML = ''; simRenderer = null; }
  simObjects = [];
}
function saveSimModal() {
  if (!currentSimBlock) { closeSimModal(); return; }
  currentSimBlock.setFieldValue(simSpeed.toString(), 'SIM_SPEED');
  closeSimModal();
}
function onSimSpeedChange(v) { simSpeed = parseInt(v); document.getElementById('simSpeedVal').textContent = v; }

function initSimScene(simType) {
  var c = document.getElementById('simCanvas'); c.innerHTML = '';
  simScene = new THREE.Scene(); simScene.background = new THREE.Color(0x0f172a);
  simCamera = new THREE.PerspectiveCamera(50, c.clientWidth / c.clientHeight, 0.1, 1000);
  simCamera.position.set(0, 3, 6); simCamera.lookAt(0, 0, 0);
  simRenderer = new THREE.WebGLRenderer({ antialias: true });
  simRenderer.setSize(c.clientWidth, c.clientHeight);
  simRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  c.appendChild(simRenderer.domElement);
  simScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 5, 5); simScene.add(dl);
  simScene.add(new THREE.GridHelper(8, 16, 0x1e293b, 0x0f172a));
  simObjects = [];
  var isDrag = false, pX = 0, pY = 0, rX = 0.4, rY = 0;
  c.onpointerdown = function (e) { isDrag = true; pX = e.clientX; pY = e.clientY; c.setPointerCapture(e.pointerId); };
  c.onpointermove = function (e) { if (!isDrag) return; rY += (e.clientX - pX) * 0.01; rX += (e.clientY - pY) * 0.01; rX = Math.max(-1.2, Math.min(1.2, rX)); pX = e.clientX; pY = e.clientY; simCamera.position.set(6 * Math.sin(rY) * Math.cos(rX), 6 * Math.sin(rX) + 2, 6 * Math.cos(rY) * Math.cos(rX)); simCamera.lookAt(0, 0, 0); };
  c.onpointerup = function () { isDrag = false; };
  buildSim(simType); animateSim();
}

function buildSim(type) {
  var i, m, g;
  switch (type) {
    case 'sim_solar':
      simScene.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5 })));
      [{ r: 1.2, s: 0.1, c: 0x94a3b8, sp: 2 }, { r: 1.7, s: 0.15, c: 0x3b82f6, sp: 1.2 }, { r: 2.3, s: 0.12, c: 0xef4444, sp: 0.8 }, { r: 3, s: 0.3, c: 0xd4a574, sp: 0.4 }, { r: 3.7, s: 0.22, c: 0x06b6d4, sp: 0.3 }].forEach(function (p) {
        m = new THREE.Mesh(new THREE.SphereGeometry(p.s, 16, 16), new THREE.MeshStandardMaterial({ color: p.c }));
        m._oR = p.r; m._oS = p.sp; m._a = Math.random() * 6.28; simScene.add(m); simObjects.push(m);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, 0.005, 8, 64), new THREE.MeshBasicMaterial({ color: 0x1e293b })); ring.rotation.x = Math.PI / 2; simScene.add(ring);
      }); break;
    case 'sim_pendulum':
      simScene.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshStandardMaterial({ color: 0x94a3b8 })));
      var pg = new THREE.Group();
      pg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3, 8), new THREE.MeshStandardMaterial({ color: 0x64748b })));
      pg.children[0].position.y = -1.5;
      var bob = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 32), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 }));
      bob.position.y = -3; pg.add(bob); pg.position.y = 3; pg._a = 0.8; pg._v = 0;
      simScene.add(pg); simObjects.push(pg); simObjects._t = 'pend'; break;
    case 'sim_particles':
      for (i = 0; i < 80; i++) { m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random() * 0.15 + 0.75, 0.8, 0.6) })); m._vx = (Math.random() - 0.5) * 0.08; m._vy = Math.random() * 0.12 + 0.05; m._vz = (Math.random() - 0.5) * 0.08; m._life = Math.random() * 60; simScene.add(m); simObjects.push(m); } simObjects._t = 'part'; break;
    case 'sim_dna':
      for (i = 0; i < 40; i++) { var a = (i / 40) * Math.PI * 4; var s1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0x06b6d4 })); var s2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf43f5e })); s1.position.set(Math.cos(a) * 1.2, i * 0.15 - 3, Math.sin(a) * 1.2); s2.position.set(Math.cos(a + Math.PI) * 1.2, i * 0.15 - 3, Math.sin(a + Math.PI) * 1.2); simScene.add(s1); simScene.add(s2); if (i % 4 === 0) { var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 })); bar.position.set(0, i * 0.15 - 3, 0); bar.rotation.z = Math.PI / 2; bar.rotation.y = a; simScene.add(bar); } simObjects.push(s1); simObjects.push(s2); } simObjects._t = 'dna'; break;
    case 'sim_gears':
      for (i = 0; i < 3; i++) { var gg = new THREE.Group(); gg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7 + i * 0.4, 0.7 + i * 0.4, 0.3, 12 + i * 4), new THREE.MeshStandardMaterial({ color: i === 0 ? 0x64748b : i === 1 ? 0x94a3b8 : 0x475569, metalness: 0.7, roughness: 0.2 }))); gg.children[0].rotation.x = Math.PI / 2; gg.position.x = i === 0 ? -1.5 : i === 1 ? 0 : 1.5; gg.position.y = 1; gg._sp = i === 1 ? -1 : 1; gg._gr = 1 / (1 + i * 0.3); simScene.add(gg); simObjects.push(gg); } break;
    case 'sim_wave':
      m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8, 40, 40), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.7 })); m.rotation.x = -Math.PI / 2; simScene.add(m); simObjects.push(m); simObjects._t = 'wave'; break;
    case 'sim_bouncing':
      simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x1e293b }))); simScene.children[simScene.children.length - 1].rotation.x = -Math.PI / 2; simScene.children[simScene.children.length - 1].position.y = -0.01;
      for (i = 0; i < 8; i++) { m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i / 8, 0.7, 0.5), metalness: 0.3, roughness: 0.4 })); m.position.set((i - 3.5) * 0.8, 2 + Math.random() * 3, 0); m._vy = 0; m._bn = 0.8; simScene.add(m); simObjects.push(m); } simObjects._t = 'bounce'; break;
    case 'sim_windmill':
      simScene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 4, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }))); simScene.children[simScene.children.length - 1].position.y = 2;
      simScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }))); simScene.children[simScene.children.length - 1].position.y = 4;
      var bg2 = new THREE.Group(); for (i = 0; i < 3; i++) { var bl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xfafafa })); bl.position.y = 1.1; var bgg = new THREE.Group(); bgg.add(bl); bgg.rotation.z = (i / 3) * Math.PI * 2; bg2.add(bgg); } bg2.position.set(0, 4, 0.2); simScene.add(bg2); simObjects.push(bg2); break;
    case 'sim_atom':
      simScene.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.3 })));
      for (i = 0; i < 3; i++) { var orb = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.5, 0.008, 8, 64), new THREE.MeshBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.3 })); orb.rotation.x = Math.PI / 2 + i * 0.6; orb.rotation.y = i * 1.0; simScene.add(orb); var el = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.6 })); el._oR = 1.4 + i * 0.5; el._oS = 2 - i * 0.4; el._a = i * 2; el._tX = Math.PI / 2 + i * 0.6; el._tY = i * 1.0; simScene.add(el); simObjects.push(el); } simObjects._t = 'atom'; break;
    case 'sim_globe':
      m = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 24), new THREE.MeshStandardMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.4 })); simScene.add(m); simObjects.push(m);
      simScene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 5, 8), new THREE.MeshBasicMaterial({ color: 0x6b7280 })));
      for (i = 0; i < 6; i++) { var lt = new THREE.Mesh(new THREE.TorusGeometry(2 * Math.cos((i - 2.5) * 0.5), 0.008, 8, 64), new THREE.MeshBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.3 })); lt.position.y = 2 * Math.sin((i - 2.5) * 0.5); simScene.add(lt); } break;
  }
}

function animateSim() {
  simAnimId = requestAnimationFrame(animateSim);
  var t = Date.now() * 0.001, spd = simSpeed / 50;
  switch (currentSimType) {
    case 'sim_solar': simObjects.forEach(function (p) { if (p._oR) { p._a += p._oS * 0.01 * spd; p.position.set(Math.cos(p._a) * p._oR, 0, Math.sin(p._a) * p._oR); p.rotation.y += 0.02 * spd; } }); break;
    case 'sim_pendulum': if (simObjects[0]) { var dt = 0.016 * spd; simObjects[0]._v -= (9.8 / 3) * Math.sin(simObjects[0]._a) * dt; simObjects[0]._v *= 0.999; simObjects[0]._a += simObjects[0]._v * dt; simObjects[0].rotation.z = simObjects[0]._a; } break;
    case 'sim_particles': simObjects.forEach(function (p) { if (p._vx !== undefined) { p._life++; if (p._life > 60) { p.position.set(0, 0, 0); p._vy = Math.random() * 0.12 + 0.05; p._vx = (Math.random() - 0.5) * 0.08; p._vz = (Math.random() - 0.5) * 0.08; p._life = 0; } p.position.x += p._vx * spd; p.position.y += p._vy * spd; p.position.z += p._vz * spd; p._vy -= 0.002 * spd; } }); break;
    case 'sim_dna': simObjects.forEach(function (s) { s.position.y += 0.005 * spd; if (s.position.y > 3) s.position.y -= 6; }); break;
    case 'sim_gears': simObjects.forEach(function (g) { if (g._sp !== undefined) g.rotation.z += 0.02 * g._sp * g._gr * spd; }); break;
    case 'sim_wave': if (simObjects[0] && simObjects[0].geometry) { var pos = simObjects[0].geometry.attributes.position; for (var i = 0; i < pos.count; i++) { pos.setZ(i, Math.sin(pos.getX(i) * 1.5 + t * 2 * spd) * Math.cos(pos.getY(i) * 1.5 + t * 2 * spd) * 0.5); } pos.needsUpdate = true; } break;
    case 'sim_bouncing': simObjects.forEach(function (b) { if (b._vy !== undefined) { b._vy -= 0.005 * spd; b.position.y += b._vy * spd; if (b.position.y < 0.22) { b.position.y = 0.22; b._vy = Math.abs(b._vy) * b._bn; } } }); break;
    case 'sim_windmill': if (simObjects[0]) simObjects[0].rotation.z += 0.03 * spd; break;
    case 'sim_atom': simObjects.forEach(function (e) { if (e._oR) { e._a += e._oS * 0.02 * spd; var x = Math.cos(e._a) * e._oR, y = Math.sin(e._a) * e._oR; var v = new THREE.Vector3(x, 0, y); v.applyAxisAngle(new THREE.Vector3(1, 0, 0), e._tX); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), e._tY); e.position.copy(v); } }); break;
    case 'sim_globe': if (simObjects[0]) simObjects[0].rotation.y += 0.005 * spd; break;
  }
  if (simRenderer && simScene && simCamera) simRenderer.render(simScene, simCamera);
}

// =====================================================================
// THREE.JS 3D MODEL VIEWER — Modal Logic
// =====================================================================
var current3DBlock = null;
var threeScene, threeCamera, threeRenderer, threeMesh, threeAnimId;
var selectedModel = 'cube';
var spinSpeed = 30;
var modelColor = '#7c3aed';

function open3DModal(block) {
  current3DBlock = block;
  selectedModel = block.getFieldValue('MODEL_TYPE') || 'cube';
  spinSpeed = parseInt(block.getFieldValue('SPIN_SPEED') || '30');
  modelColor = block.getFieldValue('MODEL_COLOR') || '#7c3aed';

  document.getElementById('threeSpinSpeed').value = spinSpeed;
  document.getElementById('threeSpeedLabel').textContent = spinSpeed;
  document.getElementById('threeColorPick').value = modelColor;
  document.getElementById('threeColorHex').textContent = modelColor;

  document.querySelectorAll('.three-model-btn').forEach(function (b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === selectedModel);
  });

  document.getElementById('threeDModal').style.display = 'flex';
  setTimeout(function () { init3DScene(); load3DModel(selectedModel); }, 50);
}

function close3DModal() {
  document.getElementById('threeDModal').style.display = 'none';
  current3DBlock = null;
  if (threeAnimId) cancelAnimationFrame(threeAnimId);
  if (threeRenderer) {
    threeRenderer.dispose();
    var container = document.getElementById('threeCanvas');
    container.innerHTML = '';
    threeRenderer = null;
  }
}

function save3DSelection() {
  if (!current3DBlock) { close3DModal(); return; }
  current3DBlock.setFieldValue(selectedModel, 'MODEL_TYPE');
  current3DBlock.setFieldValue(spinSpeed.toString(), 'SPIN_SPEED');
  current3DBlock.setFieldValue(modelColor, 'MODEL_COLOR');
  var label = current3DBlock.getField('MODEL_LABEL');
  if (label) label.setValue(selectedModel.charAt(0).toUpperCase() + selectedModel.slice(1));
  close3DModal();
}

function select3DModel(model) {
  selectedModel = model;
  document.querySelectorAll('.three-model-btn').forEach(function (b) {
    b.classList.toggle('active', b.textContent.toLowerCase() === model);
  });
  load3DModel(model);
}

function update3DSpeed(val) {
  spinSpeed = parseInt(val);
  document.getElementById('threeSpeedLabel').textContent = val;
}

function update3DColor(val) {
  modelColor = val;
  document.getElementById('threeColorHex').textContent = val;
  if (threeMesh) {
    if (threeMesh._isGroup) {
      threeMesh.children.forEach(function (child) {
        if (child.material && child.material.color) child.material.color.set(val);
      });
    } else {
      threeMesh.material.color.set(val);
    }
  }
}

function init3DScene() {
  var container = document.getElementById('threeCanvas');
  container.innerHTML = '';

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x1a2235);

  threeCamera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
  threeCamera.position.set(0, 1.5, 4);
  threeCamera.lookAt(0, 0.5, 0);

  threeRenderer = new THREE.WebGLRenderer({ antialias: true });
  threeRenderer.setSize(container.clientWidth, container.clientHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(threeRenderer.domElement);

  // Lighting
  threeScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 5, 5);
  threeScene.add(dir);
  var point = new THREE.PointLight(0x7c3aed, 0.6, 10);
  point.position.set(-3, 2, 1);
  threeScene.add(point);

  // Grid
  threeScene.add(new THREE.GridHelper(6, 12, 0x243049, 0x1a2235));

  // Simple orbit via pointer drag (no external OrbitControls needed)
  var isDrag = false, prevX = 0, prevY = 0;
  var rotX = 0.3, rotY = 0;
  container.addEventListener('pointerdown', function (e) {
    isDrag = true; prevX = e.clientX; prevY = e.clientY;
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', function (e) {
    if (!isDrag) return;
    rotY += (e.clientX - prevX) * 0.01;
    rotX += (e.clientY - prevY) * 0.01;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    prevX = e.clientX; prevY = e.clientY;
    threeCamera.position.x = 4 * Math.sin(rotY) * Math.cos(rotX);
    threeCamera.position.y = 4 * Math.sin(rotX) + 1;
    threeCamera.position.z = 4 * Math.cos(rotY) * Math.cos(rotX);
    threeCamera.lookAt(0, 0.5, 0);
  });
  container.addEventListener('pointerup', function () { isDrag = false; });
}

function load3DModel(type) {
  if (threeMesh) {
    threeScene.remove(threeMesh);
    if (threeMesh._isGroup) {
      threeMesh.children.forEach(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    } else {
      threeMesh.geometry.dispose();
      threeMesh.material.dispose();
    }
  }
  if (threeAnimId) cancelAnimationFrame(threeAnimId);

  var mat = new THREE.MeshStandardMaterial({
    color: modelColor,
    metalness: 0.3,
    roughness: 0.4
  });

  var geo;
  switch (type) {
    case 'sphere':
      geo = new THREE.SphereGeometry(1, 32, 32); break;
    case 'cylinder':
      geo = new THREE.CylinderGeometry(0.7, 0.7, 1.6, 32); break;
    case 'cone':
      geo = new THREE.ConeGeometry(0.8, 1.6, 32); break;
    case 'torus':
      geo = new THREE.TorusGeometry(0.8, 0.3, 16, 48); break;
    case 'robot':
      var group = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.6), mat);
      var headMat = mat.clone();
      headMat.color.set('#a855f7');
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), headMat);
      head.position.y = 1;
      var eyeMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, emissive: 0x00f5ff, emissiveIntensity: 0.8 });
      var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeMat);
      eyeL.position.set(-0.15, 1.05, 0.26);
      var eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeMat.clone());
      eyeR.position.set(0.15, 1.05, 0.26);
      var armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), mat.clone());
      armL.position.set(-0.65, 0, 0);
      var armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), mat.clone());
      armR.position.set(0.65, 0, 0);
      group.add(body, head, eyeL, eyeR, armL, armR);
      group.position.y = 0.7;
      threeScene.add(group);
      threeMesh = group;
      threeMesh._isGroup = true;
      animate3D();
      return;
    default:
      geo = new THREE.BoxGeometry(1.2, 1.2, 1.2); break;
  }

  threeMesh = new THREE.Mesh(geo, mat);
  threeMesh.position.y = 1;
  threeScene.add(threeMesh);
  animate3D();
}

function animate3D() {
  threeAnimId = requestAnimationFrame(animate3D);
  if (threeMesh) {
    var speed = spinSpeed * 0.0003;
    threeMesh.rotation.y += speed;
    if (!threeMesh._isGroup) threeMesh.rotation.x += speed * 0.3;
  }
  if (threeRenderer && threeScene && threeCamera) {
    threeRenderer.render(threeScene, threeCamera);
  }
}

async function start() {

  // Apply mobile layout class when running inside Expo WebView
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    const appEl = document.querySelector('.app');
    appEl.classList.add('mobile-app');
    const mainSection = document.querySelector('.main');
    if (mainSection) mainSection.classList.add('main1');
    const codePanel = document.querySelector(".code");
    if (codePanel) codePanel.classList.add('show');

    // Fix Android WebView: update CSS custom properties (set early by the
    // <head> script) with accurate measurements after layout settles.
    // CSS rules targeting .expo-wv use var(--expo-h) / var(--expo-content-h)
    // so updating them here instantly resizes all containers + Blockly SVG.
    window._applyExpoHeight = function applyExpoHeight() {
      const h = window.innerHeight;
      const w = window.innerWidth;
      if (h <= 0 || w <= 0) return;

      // Read actual topbar height after any media-query adjustments
      const topbarEl = document.querySelector('.topbar');
      const topbarH = topbarEl ? topbarEl.getBoundingClientRect().height : 63;
      const contentH = h - topbarH;

      // Update CSS custom properties — all var(--expo-*) rules recompute
      const root = document.documentElement;
      root.style.setProperty('--expo-h', h + 'px');
      root.style.setProperty('--expo-w', w + 'px');
      root.style.setProperty('--expo-content-h', contentH + 'px');

      // Belt-and-suspenders: also set inline styles directly
      appEl.style.height = h + 'px';
      appEl.style.width = w + 'px';

      const mainEl = document.querySelector('.main');
      if (mainEl) { mainEl.style.height = contentH + 'px'; mainEl.style.maxHeight = contentH + 'px'; }

      const wsEl = document.querySelector('.workspace');
      if (wsEl) wsEl.style.height = contentH + 'px';

      const bdEl = document.getElementById('blocklyDiv');
      if (bdEl) bdEl.style.height = contentH + 'px';

      // Tell Blockly to refit its SVG canvas
      if (typeof workspace !== 'undefined' && workspace && typeof Blockly !== 'undefined') {
        Blockly.svgResize(workspace);
      }
    };

    window._applyExpoHeight();
    window.addEventListener('resize', window._applyExpoHeight);
  }

  const _connectBtn = document.getElementById("btnConnect");
  if (_connectBtn) _connectBtn.onclick = () => connectStm32();

  // DISCONNECT button handler (NEW)
  const disconnectBtn = document.getElementById("btnDisconnect");
  if (disconnectBtn) {
    disconnectBtn.onclick = async () => {
      const hasConnection = isUSBConnected() || isBLEConnected();
      if (!hasConnection) {
        handleBoardMessage("Not connected to any device", "SYS");
        return;
      }
      handleBoardMessage("Disconnecting...", "SYS");
      await disconnectAll();
    };
  }

  const ok = await waitForBlockly();
  if (!ok) { console.error('Blockly/Python failed to load'); return; }

  if (window.toolboxConfig) {
    defaultToolboxConfig = JSON.parse(JSON.stringify(window.toolboxConfig));
  }

  const Theme = Blockly.Theme.defineTheme('rndmfg_glass', {
    base: Blockly.Themes.Classic,
    blockStyles: {
      'loop_blocks': { colourPrimary: '#6265F0', colourSecondary: '#4A4DC8', colourTertiary: '#4A4DC8' },
      'logic_blocks': { colourPrimary: '#04B6D4', colourSecondary: '#0290A8', colourTertiary: '#0290A8' },
      'variable_blocks': { colourPrimary: '#E9B308', colourSecondary: '#B88A00', colourTertiary: '#B88A00' },
      'variable_dynamic_blocks': { colourPrimary: '#E9B308', colourSecondary: '#B88A00', colourTertiary: '#B88A00' }
    },
    componentStyles: {
      workspaceBackgroundColour: '#ffffff',
      toolboxBackgroundColour: '#FFFFFF',
      toolboxForegroundColour: '#1e293b',
      flyoutBackgroundColour: 'rgba(15,23,42,0.95)',
      flyoutForegroundColour: '#e5e7eb',
      flyoutOpacity: 1,
      insertionMarkerColour: '#38bdf8',
      insertionMarkerOpacity: 0.0,
      scrollbarColour: '#94a3b8',
      selectedGlowColour: 'transparent',
      selectedGlowOpacity: 0,
      selectedGlowSize: 1,
      cursorColour: '#facc15'
    }
  });

  registerRgbPickerField();
  defineBlocks();
  defineGenerators();

  // ══════════════════════════════════════════════════
  // CUSTOM "LIST" CATEGORY (like Variable / Function)
  // ══════════════════════════════════════════════════

  // ── List Block Definitions ──

  Blockly.defineBlocksWithJsonArray([
    // 1) Create empty list
    {
      "type": "list_create_empty",
      "message0": "create empty list",
      "output": "Array",
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Creates an empty list []"
    },
    // 2) Create list with items [ , , ]
    {
      "type": "list_create_with",
      "message0": "create list with %1",
      "args0": [{ "type": "input_value", "name": "ITEM0" }],
      "output": "Array",
      "inputsInline": true,
      "colour": "#0FB881", "extensions": ["list_color"],
      "mutator": "list_create_with_mutator",
      "tooltip": "Create a list with items"
    },
    // 3) Add item to list
    {
      "type": "list_add",
      "message0": "add %1 to %2",
      "args0": [
        { "type": "input_value", "name": "ITEM" },
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Append an item to a list"
    },
    // 4) Get item from list by index
    {
      "type": "list_get",
      "message0": "item %1 of %2",
      "args0": [
        { "type": "input_value", "name": "INDEX", "check": "Number" },
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "output": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Get item at index (starts from 0)"
    },
    // 5) Set item in list by index
    {
      "type": "list_set",
      "message0": "replace item %1 of %2 with %3",
      "args0": [
        { "type": "input_value", "name": "INDEX", "check": "Number" },
        { "type": "input_value", "name": "LIST" },
        { "type": "input_value", "name": "VALUE" }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Replace item at index"
    },
    // 6) Delete item from list
    {
      "type": "list_remove",
      "message0": "delete %1 of %2",
      "args0": [
        { "type": "input_value", "name": "INDEX", "check": "Number" },
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Delete item at index"
    },
    // 7) Delete all of list
    {
      "type": "list_delete_all",
      "message0": "delete all of %1",
      "args0": [
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Delete all items from the list"
    },
    // 8) Insert item at index
    {
      "type": "list_insert",
      "message0": "insert %1 at %2 of %3",
      "args0": [
        { "type": "input_value", "name": "ITEM" },
        { "type": "input_value", "name": "INDEX", "check": "Number" },
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Insert item at a specific index"
    },
    // 9) Length of list
    {
      "type": "list_length",
      "message0": "length of %1",
      "args0": [
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "output": "Number",
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Returns the number of items in the list"
    },
    // 10) List is empty?
    {
      "type": "list_isEmpty",
      "message0": "%1 is empty?",
      "args0": [
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "output": "Boolean",
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Returns True if the list is empty"
    },
    // 11) List contains item?
    {
      "type": "list_contains",
      "message0": "%1 contains %2 ?",
      "args0": [
        { "type": "input_value", "name": "LIST" },
        { "type": "input_value", "name": "ITEM" }
      ],
      "inputsInline": true,
      "output": "Boolean",
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Returns True if item is in the list"
    },
    // 12) Item # of thing in list
    {
      "type": "list_indexOf",
      "message0": "item # of %1 in %2",
      "args0": [
        { "type": "input_value", "name": "ITEM" },
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "output": "Number",
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Returns the index of the first occurrence"
    },
    // 13) Show list (print)
    {
      "type": "list_show",
      "message0": "show list %1",
      "args0": [
        { "type": "input_value", "name": "LIST" }
      ],
      "inputsInline": true,
      "previousStatement": null,
      "nextStatement": null,
      "colour": "#0FB881", "extensions": ["list_color"],
      "tooltip": "Print the list"
    }
  ]);

  // ── Mutator for "create list with" (add/remove items) ──
  // Simplified: uses itemCount_ to track number of inputs

  Blockly.Extensions.registerMutator('list_create_with_mutator', {
    itemCount_: 1,

    mutationToDom: function () {
      var container = Blockly.utils.xml.createElement('mutation');
      container.setAttribute('items', this.itemCount_);
      return container;
    },

    domToMutation: function (xmlElement) {
      this.itemCount_ = parseInt(xmlElement.getAttribute('items'), 10) || 1;
      this.updateShape_();
    },

    saveExtraState: function () {
      return { 'itemCount': this.itemCount_ };
    },

    loadExtraState: function (state) {
      this.itemCount_ = state['itemCount'] || 1;
      this.updateShape_();
    },

    updateShape_: function () {
      // Remove old inputs beyond ITEM0
      for (var i = 1; i < 20; i++) {
        if (this.getInput('ITEM' + i)) {
          this.removeInput('ITEM' + i);
        }
      }
      if (this.getInput('ADD_REMOVE')) this.removeInput('ADD_REMOVE');

      // Add inputs for current item count (skip ITEM0, it's in JSON)
      for (var i = 1; i < this.itemCount_; i++) {
        this.appendValueInput('ITEM' + i);
      }

      // + / − buttons row
      this.appendDummyInput('ADD_REMOVE')
        .appendField(new Blockly.FieldImage(
          'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="11" fill="#22c55e"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="18" font-weight="bold">+</text></svg>'
          ), 24, 24, '+', function () {
            var block = this.getSourceBlock();
            block.itemCount_++;
            block.updateShape_();
          }
        ))
        .appendField(new Blockly.FieldImage(
          'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="11" fill="#ef4444"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="18" font-weight="bold">−</text></svg>'
          ), 24, 24, '−', function () {
            var block = this.getSourceBlock();
            if (block.itemCount_ > 1) {
              block.itemCount_--;
              block.updateShape_();
            }
          }
        ));
    }
  }, undefined, []);

  // ── Python Generators for List Blocks ──

  (pyGen.forBlock || pyGen)['list_create_empty'] = function (block) {
    return ['[]', pyGen.ORDER_ATOMIC];
  };

  (pyGen.forBlock || pyGen)['list_create_with'] = function (block) {
    var items = [];
    for (var i = 0; i < block.itemCount_; i++) {
      items.push(pyGen.valueToCode(block, 'ITEM' + i, pyGen.ORDER_NONE) || 'None');
    }
    var code = '[' + items.join(', ') + ']';
    return [code, pyGen.ORDER_ATOMIC];
  };

  (pyGen.forBlock || pyGen)['list_add'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    var item = pyGen.valueToCode(block, 'ITEM', pyGen.ORDER_NONE) || 'None';
    return list + '.append(' + item + ')\n';
  };

  (pyGen.forBlock || pyGen)['list_get'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    var index = pyGen.valueToCode(block, 'INDEX', pyGen.ORDER_NONE) || '0';
    return [list + '[' + index + ']', pyGen.ORDER_MEMBER];
  };

  (pyGen.forBlock || pyGen)['list_set'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    var index = pyGen.valueToCode(block, 'INDEX', pyGen.ORDER_NONE) || '0';
    var value = pyGen.valueToCode(block, 'VALUE', pyGen.ORDER_NONE) || 'None';
    return list + '[' + index + '] = ' + value + '\n';
  };

  (pyGen.forBlock || pyGen)['list_remove'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    var index = pyGen.valueToCode(block, 'INDEX', pyGen.ORDER_NONE) || '0';
    return list + '.pop(' + index + ')\n';
  };

  (pyGen.forBlock || pyGen)['list_length'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_NONE) || '[]';
    return ['len(' + list + ')', pyGen.ORDER_FUNCTION_CALL];
  };

  (pyGen.forBlock || pyGen)['list_isEmpty'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_NONE) || '[]';
    return ['len(' + list + ') == 0', pyGen.ORDER_RELATIONAL];
  };

  (pyGen.forBlock || pyGen)['list_contains'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_NONE) || '[]';
    var item = pyGen.valueToCode(block, 'ITEM', pyGen.ORDER_NONE) || 'None';
    return [item + ' in ' + list, pyGen.ORDER_RELATIONAL];
  };

  (pyGen.forBlock || pyGen)['list_indexOf'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    var item = pyGen.valueToCode(block, 'ITEM', pyGen.ORDER_NONE) || 'None';
    return [list + '.index(' + item + ')', pyGen.ORDER_FUNCTION_CALL];
  };

  (pyGen.forBlock || pyGen)['list_delete_all'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    return list + '.clear()\n';
  };

  (pyGen.forBlock || pyGen)['list_insert'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_MEMBER) || '[]';
    var index = pyGen.valueToCode(block, 'INDEX', pyGen.ORDER_NONE) || '0';
    var item = pyGen.valueToCode(block, 'ITEM', pyGen.ORDER_NONE) || 'None';
    return list + '.insert(' + index + ', ' + item + ')\n';
  };

  (pyGen.forBlock || pyGen)['list_show'] = function (block) {
    var list = pyGen.valueToCode(block, 'LIST', pyGen.ORDER_NONE) || '[]';
    return 'print(' + list + ')\n';
  };

  // ── Override variables_set / variables_get for list-typed variables ──
  // Uses pyGen (set inside waitForBlockly) — guaranteed non-null here.

  var _pyFB = pyGen.forBlock || pyGen;
  _pyFB['procedures_mutatorcontainer'] = function (block) {
    return '';
  };
  _pyFB['procedures_mutatorarg'] = function (block) {
    return '';
  };
  var _origVarSet = _pyFB['variables_set'];
  var _origVarGet = _pyFB['variables_get'];

  _pyFB['variables_set'] = function (block, generator) {
    var gen = generator || pyGen;
    var varModel = block.getField('VAR').getVariable();
    var varName = gen.nameDB_.getName(varModel.name, Blockly.Names.NameType.VARIABLE);
    var value = gen.valueToCode(block, 'VALUE', gen.ORDER_NONE);

    // If it's a list-typed variable and no value plugged in → default to []
    if (varModel.type === 'list' && !value) {
      return varName + ' = []\n';
    }
    // Otherwise use original generator
    if (_origVarSet) return _origVarSet.call(this, block, gen);
    return varName + ' = ' + (value || 'None') + '\n';
  };

  _pyFB['variables_get'] = function (block, generator) {
    var gen = generator || pyGen;
    if (_origVarGet) return _origVarGet.call(this, block, gen);
    var varModel = block.getField('VAR').getVariable();
    var varName = gen.nameDB_.getName(varModel.name, Blockly.Names.NameType.VARIABLE);
    return [varName, gen.ORDER_ATOMIC];
  };

  _pyFB['list_variable_set'] = function (block, generator) {
    var gen = generator || pyGen;
    var varField = block.getField('VAR');
    var varName = varField ? gen.nameDB_.getName(varField.getText(), Blockly.Names.NameType.VARIABLE) : 'my_list';
    var value = gen.valueToCode(block, 'VALUE', gen.ORDER_NONE);
    return varName + ' = ' + (value || '[]') + '\n';
  };

  _pyFB['list_variable_get'] = function (block, generator) {
    var gen = generator || pyGen;
    var varField = block.getField('VAR');
    var varName = varField ? gen.nameDB_.getName(varField.getText(), Blockly.Names.NameType.VARIABLE) : 'my_list';
    return [varName, gen.ORDER_ATOMIC];
  };

  // ── Patch pyGen.finish to init list-typed vars as [] not None ──
  var _origFinish = pyGen.finish;
  pyGen.finish = function (code) {
    var result = _origFinish.call(this, code);
    var allVars = workspace.getAllVariables();
    for (var i = 0; i < allVars.length; i++) {
      if (allVars[i].type === 'list') {
        var safeName = pyGen.nameDB_.getName(
          allVars[i].name, Blockly.Names.NameType.VARIABLE
        );
        var re = new RegExp('^(' + safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=\\s*)None', 'm');
        result = result.replace(re, '$1[]');
      }
    }
    return result;
  };

  // ── LIST flyout + button callbacks registered after inject (see below) ──

  // Store the flyout builder as a function we'll register on workspace
  window.__listFlyoutCallback = function (workspace) {
    var xmlList = [];

    // ➊ "Create List" button always visible at top
    var button = document.createElement('button');
    button.setAttribute('text', '✦ Create a List');
    button.setAttribute('callbackKey', 'CREATE_LIST_VARIABLE');
    xmlList.push(button);

    // ➋ Only show blocks AFTER user creates at least one list variable
    var allVars = workspace.getAllVariables();
    var listVars = allVars.filter(function (v) { return v.type === 'list'; });

    if (listVars.length > 0) {
      // Use the first list variable as the default pre-fill
      var defaultListName = listVars[0].name;

      // Helper: creates a <value name="LIST"> with the variable pre-attached
      var listVarXml = function (varName) {
        return '<value name="LIST">' +
          '<block type="list_variable_get">' +
          '<field name="VAR" variabletype="list">' + (varName || defaultListName) + '</field>' +
          '</block></value>';
      };

      var sep = document.createElement('sep');
      sep.setAttribute('gap', '24');
      xmlList.push(sep);

      // "set [myList] to" for each list variable
      for (var i = 0; i < listVars.length; i++) {
        xmlList.push(Blockly.utils.xml.textToDom(
          '<block type="list_variable_set">' +
          '  <field name="VAR" variabletype="list">' + listVars[i].name + '</field>' +
          '</block>'
        ));
      }

      // "get [myList]" for each list variable
      for (var i = 0; i < listVars.length; i++) {
        xmlList.push(Blockly.utils.xml.textToDom(
          '<block type="list_variable_get">' +
          '  <field name="VAR" variabletype="list">' + listVars[i].name + '</field>' +
          '</block>'
        ));
      }

      // ➌ List operation blocks — Scratch-style order, pre-filled with list name
      var sep2 = document.createElement('sep');
      sep2.setAttribute('gap', '24');
      xmlList.push(sep2);

      // add [thing] to [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_add">' + listVarXml() + '</block>'
      ));

      // delete [1] of [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_remove">' + listVarXml() + '</block>'
      ));

      // delete all of [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_delete_all">' + listVarXml() + '</block>'
      ));

      // insert [thing] at [1] of [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_insert">' + listVarXml() + '</block>'
      ));

      // replace item [1] of [gopal] with [thing]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_set">' + listVarXml() + '</block>'
      ));

      var sep3 = document.createElement('sep');
      sep3.setAttribute('gap', '24');
      xmlList.push(sep3);

      // item [1] of [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_get">' + listVarXml() + '</block>'
      ));

      // item # of [thing] in [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_indexOf">' + listVarXml() + '</block>'
      ));

      // length of [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_length">' + listVarXml() + '</block>'
      ));

      // [gopal] contains [thing] ?
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_contains">' + listVarXml() + '</block>'
      ));

      var sep4 = document.createElement('sep');
      sep4.setAttribute('gap', '24');
      xmlList.push(sep4);

      // show list [gopal]
      xmlList.push(Blockly.utils.xml.textToDom(
        '<block type="list_show">' + listVarXml() + '</block>'
      ));
    }

    return xmlList;
  };

  // ══════════════════════════════════════════════════
  // END LIST CATEGORY
  // ══════════════════════════════════════════════════

  workspace = Blockly.inject('blocklyDiv', {
    toolbox: window.toolboxConfig,   // v12 JS config — see <script> above
    theme: Theme,
    renderer: 'zelos',
    grid: { spacing: 30, length: 2, colour: '#b7b7b7', snap: true },
    trashcan: true,
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2.0, minScale: 0.4 },
    move: { scrollbars: true, drag: true, wheel: true },
    sounds: false
  });
  // ── FIGMA TOOLBOX ICONS ─────────────────────────────────
  (function () {
    var C = {
      'Digital': '#E57333', 'Analog': '#0FB881', 'I2c': '#8A5BF7', 'PWM': '#F49E09',
      'LEDs': '#22C45D', 'Tx-Rx': '#3B82F6', 'SPI': '#EB4899', 'Loop': '#6265F0',
      'Delay': '#FB913B', 'Logic': '#04B6D4', 'Maths': '#84CB17', 'A.I. Vision': '#EE4444',
      'AI blocks': '#E9B308', 'Variable': '#E9B308', 'Function': '#F4405D',
      'List': '#0FB881', 'Display-3.js': '#A68AF9', 'default block': '#84CB17',
      'Search': '#526271', 'A.I. Voice': '#7c3aed', 'A.I. Pose': '#0ea5e9', 'Llm': '#0DA5E8'
    };
    var ICONS = { 'Digital': 'assets/img/icon_001.svg', 'Analog': 'assets/img/icon_002.svg', 'I2c': 'assets/img/icon_003.svg', 'PWM': 'assets/img/icon_004.svg', 'LEDs': 'assets/img/icon_005.svg', 'Tx-Rx': 'assets/img/icon_006.svg', 'SPI': 'assets/img/icon_007.svg', 'Loop': 'assets/img/icon_008.svg', 'Delay': 'assets/img/icon_009.svg', 'Logic': 'assets/img/icon_010.svg', 'Maths': 'assets/img/icon_011.svg', 'A.I. Vision': 'assets/img/icon_012.svg', 'AI blocks': 'assets/img/icon_012.svg', 'Variable': 'assets/img/icon_013.svg', 'Display-3.js': 'assets/img/icon_014.svg', 'List': 'assets/img/icon_015.svg', 'Function': 'assets/img/icon_016.svg', 'default block': 'assets/img/icon_017.svg', 'Llm': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2Ljg3NSAxMS44NzVDMTcuOTA4OCAxMS44NzUgMTguNzUgMTEuMDMzNyAxOC43NSAxMEMxOC43NSA4Ljk2NjI1IDE3LjkwODggOC4xMjUgMTYuODc1IDguMTI1QzE2LjQ4ODUgOC4xMjYxNSAxNi4xMTE4IDguMjQ2OTIgMTUuNzk2NyA4LjQ3MDc0QzE1LjQ4MTUgOC42OTQ1NSAxNS4yNDM0IDkuMDEwNDMgMTUuMTE1IDkuMzc1SDExLjUwODdMMTYuMDcxMyA0LjgxMjVDMTYuMzE2MyA0LjkyOTM3IDE2LjU4NjMgNSAxNi44NzUgNUMxNy45MDg4IDUgMTguNzUgNC4xNTg3NSAxOC43NSAzLjEyNUMxOC43NSAyLjA5MTI1IDE3LjkwODggMS4yNSAxNi44NzUgMS4yNUMxNS44NDEzIDEuMjUgMTUgMi4wOTEyNSAxNSAzLjEyNUMxNSAzLjQxMzc1IDE1LjA3MTIgMy42ODM3NSAxNS4xODc1IDMuOTI4MTJMMTAgOS4xMTYyNVY1QzEwIDQuMzExMjUgMTAuNTYwNiAzLjc1IDExLjI1IDMuNzVIMTIuNVYyLjVIMTEuMjVDMTAuNSAyLjUgOS44MzM3NSAyLjgzOTM4IDkuMzc1IDMuMzYzNzVDOS4xNDI1MiAzLjA5Mzk0IDguODU0ODEgMi44NzcyIDguNTMxMzMgMi43MjgxOEM4LjIwNzg2IDIuNTc5MTcgNy44NTYxNSAyLjUwMTM1IDcuNSAyLjVINi44NzVDMy43NzM3NSAyLjUgMS4yNSA1LjAyMzEzIDEuMjUgOC4xMjVWMTEuODc1QzEuMjUgMTQuOTc2OSAzLjc3Mzc1IDE3LjUgNi44NzUgMTcuNUg3LjVDOC4yNSAxNy41IDguOTE2MjUgMTcuMTYxMyA5LjM3NSAxNi42MzYyQzkuODMzNzUgMTcuMTYxMyAxMC41IDE3LjUgMTEuMjUgMTcuNUgxMi41VjE2LjI1SDExLjI1QzEwLjU2MDYgMTYuMjUgMTAgMTUuNjg5NCAxMCAxNVYxMC44ODM3TDE1LjE4NzUgMTYuMDcxOUMxNS4wNzA2IDE2LjMxNjIgMTUgMTYuNTg2MyAxNSAxNi44NzVDMTUgMTcuOTA5NCAxNS44NDEzIDE4Ljc1IDE2Ljg3NSAxOC43NUMxNy45MDg4IDE4Ljc1IDE4Ljc1IDE3LjkwOTQgMTguNzUgMTYuODc1QzE4Ljc1IDE1Ljg0MDYgMTcuOTA4OCAxNSAxNi44NzUgMTVDMTYuNTk2NSAxNS4wMDE1IDE2LjMyMiAxNS4wNjU4IDE2LjA3MTkgMTUuMTg4MUwxMS41MDg3IDEwLjYyNTZIMTUuMTE1QzE1LjI0MzUgMTAuOTkwMSAxNS40ODE3IDExLjMwNTggMTUuNzk2OCAxMS41Mjk1QzE2LjExMTkgMTEuNzUzMiAxNi40ODg2IDExLjg3MzkgMTYuODc1IDExLjg3NVpNMTYuODc1IDkuMzc1QzE3LjA0MDggOS4zNzUgMTcuMTk5NyA5LjQ0MDg1IDE3LjMxNjkgOS41NTgwNkMxNy40MzQyIDkuNjc1MjcgMTcuNSA5LjgzNDI0IDE3LjUgMTBDMTcuNSAxMC4xNjU4IDE3LjQzNDIgMTAuMzI0NyAxNy4zMTY5IDEwLjQ0MTlDMTcuMTk5NyAxMC41NTkyIDE3LjA0MDggMTAuNjI1IDE2Ljg3NSAxMC42MjVDMTYuNzA5MiAxMC42MjUgMTYuNTUwMyAxMC41NTkyIDE2LjQzMzEgMTAuNDQxOUMxNi4zMTU4IDEwLjMyNDcgMTYuMjUgMTAuMTY1OCAxNi4yNSAxMEMxNi4yNSA5LjgzNDI0IDE2LjMxNTggOS42NzUyNyAxNi40MzMxIDkuNTU4MDZDMTYuNTUwMyA5LjQ0MDg1IDE2LjcwOTIgOS4zNzUgMTYuODc1IDkuMzc1Wk0xNi44NzUgMi41QzE3LjAzNTkgMi41MDcyIDE3LjE4NzkgMi41NzYxOSAxNy4yOTkyIDIuNjkyNjFDMTcuNDEwNSAyLjgwOTA0IDE3LjQ3MjcgMi45NjM5MSAxNy40NzI3IDMuMTI1QzE3LjQ3MjcgMy4yODYwOSAxNy40MTA1IDMuNDQwOTYgMTcuMjk5MiAzLjU1NzM5QzE3LjE4NzkgMy42NzM4MSAxNy4wMzU5IDMuNzQyOCAxNi44NzUgMy43NUMxNi43MDkyIDMuNzUgMTYuNTUwMyAzLjY4NDE1IDE2LjQzMzEgMy41NjY5NEMxNi4zMTU4IDMuNDQ5NzMgMTYuMjUgMy4yOTA3NiAxNi4yNSAzLjEyNUMxNi4yNSAyLjk1OTI0IDE2LjMxNTggMi44MDAyNyAxNi40MzMxIDIuNjgzMDZDMTYuNTUwMyAyLjU2NTg1IDE2LjcwOTIgMi41IDE2Ljg3NSAyLjVaTTguNzUgNy41SDcuNVY4Ljc1SDguNzVWMTEuMjVINy41QzYuNDY2MjUgMTEuMjUgNS42MjUgMTIuMDkxMyA1LjYyNSAxMy4xMjVWMTQuMzc1SDYuODc1VjEzLjEyNUM2Ljg3NSAxMi45NTkyIDYuOTQwODUgMTIuODAwMyA3LjA1ODA2IDEyLjY4MzFDNy4xNzUyNyAxMi41NjU4IDcuMzM0MjQgMTIuNSA3LjUgMTIuNUg4Ljc1VjE1QzguNzUgMTUuNjg5NCA4LjE4OTM3IDE2LjI1IDcuNSAxNi4yNUg2Ljg3NUM0LjY3NSAxNi4yNSAyLjg1NSAxNC42MTY5IDIuNTUgMTIuNUgzLjc1VjExLjI1SDIuNVY4Ljc1SDQuMzc1QzUuNDA4NzUgOC43NSA2LjI1IDcuOTA4NzUgNi4yNSA2Ljg3NVY1LjYyNUg1VjYuODc1QzUgNy4wNDA3NiA0LjkzNDE1IDcuMTk5NzMgNC44MTY5NCA3LjMxNjk0QzQuNjk5NzMgNy40MzQxNSA0LjU0MDc2IDcuNSA0LjM3NSA3LjVIMi41NUMyLjg1NSA1LjM4MzEyIDQuNjc1IDMuNzUgNi44NzUgMy43NUg3LjVDOC4xODkzNyAzLjc1IDguNzUgNC4zMTEyNSA4Ljc1IDVWNy41Wk0xNy41IDE2Ljg3NUMxNy40OTI4IDE3LjAzNTkgMTcuNDIzOCAxNy4xODc5IDE3LjMwNzQgMTcuMjk5MkMxNy4xOTEgMTcuNDEwNSAxNy4wMzYxIDE3LjQ3MjcgMTYuODc1IDE3LjQ3MjdDMTYuNzEzOSAxNy40NzI3IDE2LjU1OSAxNy40MTA1IDE2LjQ0MjYgMTcuMjk5MkMxNi4zMjYyIDE3LjE4NzkgMTYuMjU3MiAxNy4wMzU5IDE2LjI1IDE2Ljg3NUMxNi4yNSAxNi41MzA2IDE2LjUzMDYgMTYuMjUgMTYuODc1IDE2LjI1QzE3LjIxOTQgMTYuMjUgMTcuNSAxNi41MzA2IDE3LjUgMTYuODc1WiIgZmlsbD0iIzBEQTVFOCIvPgo8L3N2Zz4K' };
    window.SMALL_ICONS = {
      'Digital': 'assets/img/icon_018.svg',
      'Analog': 'assets/img/icon_019.svg',
      'I2c': 'assets/img/icon_020.svg',
      'PWM': 'assets/img/icon_021.svg',
      'LEDs': 'assets/img/icon_022.svg',
      'Tx-Rx': 'assets/img/icon_023.svg',
      'SPI': 'assets/img/icon_024.svg',
      'Loop': 'assets/img/icon_025.svg',
      'Delay': 'assets/img/icon_026.svg',
      'Logic': 'assets/img/icon_027.svg',
      'Maths': 'assets/img/icon_028.svg',
      'AI blocks': 'assets/img/icon_029.svg',
      'Variable': 'assets/img/icon_030.svg',
      'Function': 'assets/img/icon_031.svg',
      'List': 'assets/img/icon_032.svg',
      'Display-3.js': 'assets/img/icon_033.svg',

      'default block': 'assets/img/icon_034.svg',
      'A.I. Vision': 'assets/img/icon_029.svg',
      'A.I. Pose': 'assets/img/icon_033.svg',
      'Llm': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzciIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNyAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iMC41IiB5PSIwLjUiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzMyIgcng9IjcuNSIgZmlsbD0iI0Q4RUZGOSIvPgo8cmVjdCB4PSIwLjUiIHk9IjAuNSIgd2lkdGg9IjM2IiBoZWlnaHQ9IjMzIiByeD0iNy41IiBzdHJva2U9IiNENUQ1RDUiLz4KPHBhdGggZD0iTTI1LjM3NSAxOC44NzVDMjYuNDA4OCAxOC44NzUgMjcuMjUgMTguMDMzNyAyNy4yNSAxN0MyNy4yNSAxNS45NjYyIDI2LjQwODggMTUuMTI1IDI1LjM3NSAxNS4xMjVDMjQuOTg4NSAxNS4xMjYxIDI0LjYxMTggMTUuMjQ2OSAyNC4yOTY3IDE1LjQ3MDdDMjMuOTgxNSAxNS42OTQ2IDIzLjc0MzQgMTYuMDEwNCAyMy42MTUgMTYuMzc1SDIwLjAwODdMMjQuNTcxMyAxMS44MTI1QzI0LjgxNjMgMTEuOTI5NCAyNS4wODYzIDEyIDI1LjM3NSAxMkMyNi40MDg4IDEyIDI3LjI1IDExLjE1ODggMjcuMjUgMTAuMTI1QzI3LjI1IDkuMDkxMjUgMjYuNDA4OCA4LjI1IDI1LjM3NSA4LjI1QzI0LjM0MTMgOC4yNSAyMy41IDkuMDkxMjUgMjMuNSAxMC4xMjVDMjMuNSAxMC40MTM3IDIzLjU3MTIgMTAuNjgzNyAyMy42ODc1IDEwLjkyODFMMTguNSAxNi4xMTYzVjEyQzE4LjUgMTEuMzExMiAxOS4wNjA2IDEwLjc1IDE5Ljc1IDEwLjc1SDIxVjkuNUgxOS43NUMxOSA5LjUgMTguMzMzNyA5LjgzOTM4IDE3Ljg3NSAxMC4zNjM3QzE3LjY0MjUgMTAuMDkzOSAxNy4zNTQ4IDkuODc3MiAxNy4wMzEzIDkuNzI4MThDMTYuNzA3OSA5LjU3OTE3IDE2LjM1NjEgOS41MDEzNSAxNiA5LjVIMTUuMzc1QzEyLjI3MzggOS41IDkuNzUgMTIuMDIzMSA5Ljc1IDE1LjEyNVYxOC44NzVDOS43NSAyMS45NzY5IDEyLjI3MzggMjQuNSAxNS4zNzUgMjQuNUgxNkMxNi43NSAyNC41IDE3LjQxNjIgMjQuMTYxMyAxNy44NzUgMjMuNjM2MkMxOC4zMzM3IDI0LjE2MTMgMTkgMjQuNSAxOS43NSAyNC41SDIxVjIzLjI1SDE5Ljc1QzE5LjA2MDYgMjMuMjUgMTguNSAyMi42ODk0IDE4LjUgMjJWMTcuODgzN0wyMy42ODc1IDIzLjA3MTlDMjMuNTcwNiAyMy4zMTYyIDIzLjUgMjMuNTg2MyAyMy41IDIzLjg3NUMyMy41IDI0LjkwOTQgMjQuMzQxMyAyNS43NSAyNS4zNzUgMjUuNzVDMjYuNDA4OCAyNS43NSAyNy4yNSAyNC45MDk0IDI3LjI1IDIzLjg3NUMyNy4yNSAyMi44NDA2IDI2LjQwODggMjIgMjUuMzc1IDIyQzI1LjA5NjUgMjIuMDAxNSAyNC44MjIgMjIuMDY1OCAyNC41NzE5IDIyLjE4ODFMMjAuMDA4NyAxNy42MjU2SDIzLjYxNUMyMy43NDM1IDE3Ljk5MDEgMjMuOTgxNyAxOC4zMDU4IDI0LjI5NjggMTguNTI5NUMyNC42MTE5IDE4Ljc1MzIgMjQuOTg4NiAxOC44NzM5IDI1LjM3NSAxOC44NzVaTTI1LjM3NSAxNi4zNzVDMjUuNTQwOCAxNi4zNzUgMjUuNjk5NyAxNi40NDA4IDI1LjgxNjkgMTYuNTU4MUMyNS45MzQyIDE2LjY3NTMgMjYgMTYuODM0MiAyNiAxN0MyNiAxNy4xNjU4IDI1LjkzNDIgMTcuMzI0NyAyNS44MTY5IDE3LjQ0MTlDMjUuNjk5NyAxNy41NTkyIDI1LjU0MDggMTcuNjI1IDI1LjM3NSAxNy42MjVDMjUuMjA5MiAxNy42MjUgMjUuMDUwMyAxNy41NTkyIDI0LjkzMzEgMTcuNDQxOUMyNC44MTU4IDE3LjMyNDcgMjQuNzUgMTcuMTY1OCAyNC43NSAxN0MyNC43NSAxNi44MzQyIDI0LjgxNTggMTYuNjc1MyAyNC45MzMxIDE2LjU1ODFDMjUuMDUwMyAxNi40NDA4IDI1LjIwOTIgMTYuMzc1IDI1LjM3NSAxNi4zNzVaTTI1LjM3NSA5LjVDMjUuNTM1OSA5LjUwNzIgMjUuNjg3OSA5LjU3NjE5IDI1Ljc5OTIgOS42OTI2MUMyNS45MTA1IDkuODA5MDQgMjUuOTcyNyA5Ljk2MzkxIDI1Ljk3MjcgMTAuMTI1QzI1Ljk3MjcgMTAuMjg2MSAyNS45MTA1IDEwLjQ0MSAyNS43OTkyIDEwLjU1NzRDMjUuNjg3OSAxMC42NzM4IDI1LjUzNTkgMTAuNzQyOCAyNS4zNzUgMTAuNzVDMjUuMjA5MiAxMC43NSAyNS4wNTAzIDEwLjY4NDIgMjQuOTMzMSAxMC41NjY5QzI0LjgxNTggMTAuNDQ5NyAyNC43NSAxMC4yOTA4IDI0Ljc1IDEwLjEyNUMyNC43NSA5Ljk1OTI0IDI0LjgxNTggOS44MDAyNyAyNC45MzMxIDkuNjgzMDZDMjUuMDUwMyA5LjU2NTg1IDI1LjIwOTIgOS41IDI1LjM3NSA5LjVaTTE3LjI1IDE0LjVIMTZWMTUuNzVIMTcuMjVWMTguMjVIMTZDMTQuOTY2MiAxOC4yNSAxNC4xMjUgMTkuMDkxMyAxNC4xMjUgMjAuMTI1VjIxLjM3NUgxNS4zNzVWMjAuMTI1QzE1LjM3NSAxOS45NTkyIDE1LjQ0MDggMTkuODAwMyAxNS41NTgxIDE5LjY4MzFDMTUuNjc1MyAxOS41NjU4IDE1LjgzNDIgMTkuNSAxNiAxOS41SDE3LjI1VjIyQzE3LjI1IDIyLjY4OTQgMTYuNjg5NCAyMy4yNSAxNiAyMy4yNUgxNS4zNzVDMTMuMTc1IDIzLjI1IDExLjM1NSAyMS42MTY5IDExLjA1IDE5LjVIMTIuMjVWMTguMjVIMTFWMTUuNzVIMTIuODc1QzEzLjkwODggMTUuNzUgMTQuNzUgMTQuOTA4OCAxNC43NSAxMy44NzVWMTIuNjI1SDEzLjVWMTMuODc1QzEzLjUgMTQuMDQwOCAxMy40MzQyIDE0LjE5OTcgMTMuMzE2OSAxNC4zMTY5QzEzLjE5OTcgMTQuNDM0MiAxMy4wNDA4IDE0LjUgMTIuODc1IDE0LjVIMTEuMDVDMTEuMzU1IDEyLjM4MzEgMTMuMTc1IDEwLjc1IDE1LjM3NSAxMC43NUgxNkMxNi42ODk0IDEwLjc1IDE3LjI1IDExLjMxMTIgMTcuMjUgMTJWMTQuNVpNMjYgMjMuODc1QzI1Ljk5MjggMjQuMDM1OSAyNS45MjM4IDI0LjE4NzkgMjUuODA3NCAyNC4yOTkyQzI1LjY5MSAyNC40MTA1IDI1LjUzNjEgMjQuNDcyNyAyNS4zNzUgMjQuNDcyN0MyNS4yMTM5IDI0LjQ3MjcgMjUuMDU5IDI0LjQxMDUgMjQuOTQyNiAyNC4yOTkyQzI0LjgyNjIgMjQuMTg3OSAyNC43NTcyIDI0LjAzNTkgMjQuNzUgMjMuODc1QzI0Ljc1IDIzLjUzMDYgMjUuMDMwNiAyMy4yNSAyNS4zNzUgMjMuMjVDMjUuNzE5NCAyMy4yNSAyNiAyMy41MzA2IDI2IDIzLjg3NVoiIGZpbGw9IiMwREE1RTgiLz4KPC9zdmc+Cg=='
    };
    ICONS['Search'] = 'assets/img/icon_035.svg';
    ICONS['A.I. Voice'] = 'assets/img/icon_036.svg';
    ICONS['A.I. Pose'] = 'assets/img/icon_014.svg';
    // Board-tagged A.I. Vision category names (K230 AI Vision / S3 AI Vision)
    // share the same colour/icon as the original "A.I. Vision" entry.
    C['K230 AI Vision'] = C['A.I. Vision'];
    C['S3 AI Vision'] = C['A.I. Vision'];
    ICONS['K230 AI Vision'] = ICONS['A.I. Vision'];
    ICONS['S3 AI Vision'] = ICONS['A.I. Vision'];
    window.SMALL_ICONS['K230 AI Vision'] = window.SMALL_ICONS['A.I. Vision'];
    window.SMALL_ICONS['S3 AI Vision'] = window.SMALL_ICONS['A.I. Vision'];

    function tag(row) {
      var lbl = row.querySelector('.blocklyToolboxCategoryLabel');
      if (!lbl) return;
      var txt = lbl.textContent.trim();
      if (!C[txt]) return;

      row.setAttribute('data-figma', txt);
      var ctr = row.querySelector('.blocklyToolboxCategory') || row;
      ctr.setAttribute('data-figma', txt);

      var isDark = document.body.classList.contains('dark-mode');
      lbl.style.color = isDark ? '#e2e8f0' : '#1e293b';

      if (row._fgDone) {
        // just update existing chevron color
        var existingChv = ctr.querySelector('.fg-chv');
        if (existingChv) {
          existingChv.style.color = isDark ? '#64748b' : '#CBD5E1';
        }
        return;
      }
      row._fgDone = true;

      ctr.style.display = 'flex';
      ctr.style.alignItems = 'center';
      ctr.style.minHeight = '40px';
      ctr.style.padding = '9px 4px 9px 8px';
      ctr.style.boxSizing = 'border-box';
      ctr.style.position = 'relative';
      ctr.style.setProperty('border-left', 'none', 'important');
      if (!ctr.querySelector('.fg-bar')) {
        var bar = document.createElement('span');
        bar.className = 'fg-bar';
        bar.style.cssText = 'position:absolute;left:0;top:4px;bottom:4px;width:4px;background:' + C[txt] + ';border-radius:0 3px 3px 0;z-index:2;pointer-events:none;';
        ctr.insertBefore(bar, ctr.firstChild);
      }
      /* Hide Blockly square; inject <img> icon — same technique as mblock */
      var oldIcon = row.querySelector('[class*="blocklyToolboxCategoryIcon"]');
      if (oldIcon) oldIcon.style.cssText = 'display:none!important;width:0;min-width:0;margin:0;padding:0;';
      if (ICONS[txt] && !ctr.querySelector('.fg-icon')) {
        var ic = document.createElement('img');
        ic.className = 'fg-icon';
        ic.src = ICONS[txt];
        ic.style.cssText = 'width:37px;height:34px;min-width:37px;flex-shrink:0;border-radius:8px;margin-right:8px;display:inline-block;vertical-align:middle;object-fit:contain;';
        ctr.insertBefore(ic, ctr.firstChild);
      }
      lbl.style.fontWeight = '600';
      lbl.style.fontSize = '13px';
      lbl.style.textTransform = 'none';
      lbl.style.flex = '1';
      if (!ctr.querySelector('.fg-bdg')) {
        var cnt = 0;
        try {
          workspace.getToolbox().getToolboxItems().forEach(function (it) {
            if (it.getName && it.getName() === txt)
              cnt = (it.getContents ? it.getContents() : [])
                .filter(function (c) { return c.kind && c.kind.toLowerCase() === 'block'; }).length;
          });
        } catch (e) { }
        if (cnt > 0) {
          var b = document.createElement('span');
          b.className = 'fg-bdg';
          var r2 = parseInt(C[txt].slice(1, 3), 16), g2 = parseInt(C[txt].slice(3, 5), 16), b2 = parseInt(C[txt].slice(5, 7), 16);
          b.style.cssText = 'margin-left:auto;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;min-width:24px;text-align:center;flex-shrink:0;line-height:1.7;background:rgba(' + r2 + ',' + g2 + ',' + b2 + ',0.13);color:' + C[txt] + ';font-family:Inter,system-ui,sans-serif;';
          b.textContent = (cnt < 10 ? '0' : '') + cnt;
          ctr.appendChild(b);
        }
        var chv = document.createElement('span');
        chv.className = 'fg-chv';
        chv.innerHTML = '&#8250;';
        chv.style.cssText = 'color:' + (isDark ? '#64748b' : '#CBD5E1') + ';font-size:16px;margin-left:4px;margin-right:2px;flex-shrink:0;line-height:1;';
        ctr.appendChild(chv);
      }
    }

    // Global toggle collapse handler
    window.toggleToolboxCollapse = function () {
      var tb = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
      if (!tb) return;
      var isCollapsed = tb.classList.toggle('collapsed');
      localStorage.setItem('blockly_toolbox_collapsed', isCollapsed ? 'true' : 'false');
      var btn = tb.querySelector('.figma-tb-toggle-btn');
      if (btn) {
        btn.innerHTML = isCollapsed ? '&#9654;' : '&#9664;';
      }
      if (window.Blockly && window.workspace) {
        Blockly.svgResize(workspace);
      }
    };

    // Global toggle collapse handler (respects pinned state)
    window.toggleToolboxCollapse = function () {
      var tb = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
      if (!tb) return;
      if (tb.classList.contains('pinned')) return;
      var isCollapsed = tb.classList.toggle('collapsed');
      localStorage.setItem('blockly_toolbox_collapsed', isCollapsed ? 'true' : 'false');
      var btn = tb.querySelector('.figma-tb-toggle-btn');
      if (btn) {
        btn.innerHTML = isCollapsed ? '&#9654;' : '&#9664;';
      }
      if (window.Blockly && window.workspace) {
        Blockly.svgResize(workspace);
      }
    };

    // Stick / Pin — keep toolbox always expanded
    window.toggleToolboxPin = function () {
      var tb = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
      if (!tb) return;
      var isPinned = tb.classList.toggle('pinned');
      localStorage.setItem('blockly_toolbox_pinned', isPinned ? 'true' : 'false');
      if (isPinned) {
        tb.classList.remove('collapsed');
        localStorage.setItem('blockly_toolbox_collapsed', 'false');
        var toggleBtn = tb.querySelector('.figma-tb-toggle-btn');
        if (toggleBtn) toggleBtn.innerHTML = '&#9664;';
      }
      var pinBtn = tb.querySelector('.figma-tb-pin-btn');
      if (pinBtn) pinBtn.title = isPinned ? 'Unpin toolbox' : 'Pin toolbox open';
      if (window.Blockly && window.workspace) {
        setTimeout(function () { Blockly.svgResize(workspace); }, 50);
      }
    };

    function header() {
      var tb = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
      if (!tb) return;
      var isDark = document.body.classList.contains('dark-mode');
      tb.style.background = isDark ? '#1e293b' : '#FFFFFF';
      tb.style.borderRadius = '20px';
      tb.style.overflowY = 'auto';
      tb.style.overflowX = 'hidden';

      // If header already exists — just refresh theme colors
      if (tb.querySelector('.figma-tb-header')) {
        tb.style.background = isDark ? '#1e293b' : '#FFFFFF';
        var hTitle = tb.querySelector('.figma-tb-header-title');
        if (hTitle) hTitle.style.color = isDark ? '#f8fafc' : '#1e293b';
        var hLine = tb.querySelector('.figma-tb-header');
        if (hLine) hLine.style.borderBottom = isDark ? '1px solid #334155' : '1px solid #F0F2F5';
        return;
      }

      // Restore saved state on first build
      var savedPinned = localStorage.getItem('blockly_toolbox_pinned') === 'true';
      var savedCollapsed = localStorage.getItem('blockly_toolbox_collapsed') === 'true';
      if (savedPinned) { tb.classList.add('pinned'); tb.classList.remove('collapsed'); }
      else if (savedCollapsed) { tb.classList.add('collapsed'); }

      var isCollapsed = tb.classList.contains('collapsed');

      // Build header row
      var h = document.createElement('div');
      h.className = 'figma-tb-header';

      h.innerHTML = '<div class="figma-tb-header-icon"><img src="assets/img/icon_037.svg" style="width:37px;height:34px;object-fit:contain;" /></div><span class="figma-tb-header-title">Toolbox</span>';

      tb.insertBefore(h, tb.firstChild);
    }

    function run() {
      header();
      document.querySelectorAll('.blocklyToolboxCategory').forEach(tag);
    }

    // Dynamic category hover color styles
    (function () {
      var style = document.createElement('style');
      var css = '';
      for (var txt in C) {
        if (C.hasOwnProperty(txt)) {
          var hex = C[txt];
          var r = parseInt(hex.slice(1, 3), 16);
          var g = parseInt(hex.slice(3, 5), 16);
          var b = parseInt(hex.slice(5, 7), 16);
          css += '.blocklyToolboxCategory[data-figma="' + txt + '"]:not(.blocklyTreeSelected):hover, ' +
            'body.dark-mode .blocklyToolboxDiv .blocklyToolboxCategory[data-figma="' + txt + '"]:not(.blocklyTreeSelected):hover, ' +
            'body.dark-mode .blocklyToolbox .blocklyToolboxCategory[data-figma="' + txt + '"]:not(.blocklyTreeSelected):hover, ' +
            '.blocklyToolboxDiv .blocklyToolboxCategory[data-figma="' + txt + '"]:not(.blocklyTreeSelected):hover, ' +
            '.blocklyToolbox .blocklyToolboxCategory[data-figma="' + txt + '"]:not(.blocklyTreeSelected):hover { ' +
            'background: rgba(' + r + ',' + g + ',' + b + ', 0.15) !important; ' +
            '}\n';
        }
      }
      css += '.blocklyToolboxCategory .fg-icon { ' +
        'transition: transform 0.15s ease-in-out !important; ' +
        '}\n' +
        '.blocklyToolboxCategory:not(.blocklyTreeSelected):hover .fg-icon { ' +
        'transform: scale(1.06) !important; ' +
        '}\n' +
        '.blocklyToolboxCategory .fg-chv { ' +
        'transition: transform 0.15s ease-in-out !important; ' +
        '}\n' +
        '.blocklyToolboxCategory:not(.blocklyTreeSelected):hover .fg-chv { ' +
        'transform: translateX(3px) !important; ' +
        '}\n';
      style.textContent = css;
      document.head.appendChild(style);
    })();

    run();
    setTimeout(run, 150); setTimeout(run, 400); setTimeout(run, 900); setTimeout(run, 2000); setTimeout(run, 4500);
    var _n = 0, _iv = setInterval(function () { run(); if (++_n > 15) clearInterval(_iv); }, 1200);
    try { new MutationObserver(function () { run(); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    window.addEventListener('theme-changed', function () { run(); });
  })();

  // ── END FIGMA TOOLBOX ICONS ─────────────────────────────────────

  // ── AI Vision: inline custom blocks (not JSON-definable) ──────────────
  Blockly.Blocks['ai_infer'] = {
    init: function () {
      this.appendDummyInput().appendField('🧠 Run AI Inference');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#f54254');
      this.setTooltip('Trigger the AI inference loop on K230 KPU.');
      this.setHelpUrl('');
    },
    extensions: ['led_style']
  };
  Blockly.Python['ai_infer'] = () => 'run_inference()\n';

  // ── AI block click handlers ────────────────────────────────────────
  // When user clicks ai_open_train block → open training screen
  Blockly.Blocks['ai_open_train'].onchange = function (e) {
    if (e.type === Blockly.Events.BLOCK_CLICK && e.blockId === this.id) {
      openAITrainScreen();
    }
  };
  // When user clicks the K230-specific open-training block → open K230's picker
  Blockly.Blocks['ai_open_train_k230'].onchange = function (e) {
    if (e.type === Blockly.Events.BLOCK_CLICK && e.blockId === this.id) {
      openAITrainScreen();
    }
  };
  // When user clicks the S3-specific open-training block → open S3's picker
  Blockly.Blocks['ai_open_train_s3'].onchange = function (e) {
    if (e.type === Blockly.Events.BLOCK_CLICK && e.blockId === this.id) {
      openS3TrainScreen();
    }
  };
  // When user clicks ai_export_model block → send export message
  Blockly.Blocks['ai_export_model'].onchange = function (e) {
    if (e.type === Blockly.Events.BLOCK_CLICK && e.blockId === this.id) {
      const payload = JSON.stringify({ type: 'EXPORT_AI_MODEL' });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else window.parent?.postMessage(payload, '*');
    }
  };
  // When user clicks the K230-specific export block → send export message tagged for K230
  Blockly.Blocks['ai_export_model_k230'].onchange = function (e) {
    if (e.type === Blockly.Events.BLOCK_CLICK && e.blockId === this.id) {
      const payload = JSON.stringify({ type: 'EXPORT_AI_MODEL', board: 'k230' });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else window.parent?.postMessage(payload, '*');
    }
  };
  // When user clicks the S3-specific export block → send export message tagged for S3
  Blockly.Blocks['ai_export_model_s3'].onchange = function (e) {
    if (e.type === Blockly.Events.BLOCK_CLICK && e.blockId === this.id) {
      const payload = JSON.stringify({ type: 'EXPORT_AI_MODEL', board: 's3' });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else window.parent?.postMessage(payload, '*');
    }
  };

  // ─── FIX: Resize Blockly SVG after layout settles ─────────────────────
  function fixAppHeight() {
    // In Expo: re-run the full height chain fix (sets all container heights
    // AND calls svgResize). In browser: just svgResize.
    if (window._applyExpoHeight) {
      window._applyExpoHeight();
    } else if (workspace) {
      Blockly.svgResize(workspace);
    }
  }
  fixAppHeight();

  // ─── FIX: Staggered svgResize after inject ─────────────────────────────
  [0, 100, 300, 600, 1200, 2500].forEach(delay => {
    setTimeout(() => { if (workspace) { fixAppHeight(); workspace.scrollCenter(); } }, delay);
  });

  window.addEventListener('resize', fixAppHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(fixAppHeight, 100);
    setTimeout(fixAppHeight, 500);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fixAppHeight);
    window.visualViewport.addEventListener('scroll', fixAppHeight);
  }

  // Register "Create a List" button + flyout on the workspace
  workspace.registerToolboxCategoryCallback('LIST', window.__listFlyoutCallback);
  workspace.registerButtonCallback('CREATE_LIST_VARIABLE', function () {
    Blockly.Variables.createVariableButtonHandler(workspace, function (varName) {
    }, 'list');
  });

  // Register a separate "<BOARD> AI Vision" flyout + Train button per board.
  // Each category is only added to the toolbox once that specific board is
  // picked (see setSelectedBoard / ensureAIVisionCategory above) — picking
  // a 2nd board adds its own category instead of replacing the 1st.
  function buildAIVisionFlyout(board) {
    return function () {
      var xmlList = [];
      var tag = board === 's3' ? 'S3' : 'K230';

      var button = document.createElement('button');
      button.setAttribute('text', '🎯 Train ' + tag);
      button.setAttribute('callbackKey', 'TRAIN_AI_VISION_' + board.toUpperCase());
      xmlList.push(button);

      var trained = (window._aiVisionTrainedContents && window._aiVisionTrainedContents[board]) || [];
      if (trained.length > 0) {
        var sep = document.createElement('sep');
        sep.setAttribute('gap', '24');
        xmlList.push(sep);
        trained.forEach(function (item) {
          if (item.kind === 'block' && Blockly.Blocks[item.type]) {
            var b = document.createElement('block');
            b.setAttribute('type', item.type);
            xmlList.push(b);
          }
        });
      }
      return xmlList;
    };
  }
  window.__aiVisionFlyoutCallbackK230 = buildAIVisionFlyout('k230');
  window.__aiVisionFlyoutCallbackS3 = buildAIVisionFlyout('s3');
  workspace.registerToolboxCategoryCallback('AI_VISION_K230', window.__aiVisionFlyoutCallbackK230);
  workspace.registerToolboxCategoryCallback('AI_VISION_S3', window.__aiVisionFlyoutCallbackS3);
  workspace.registerButtonCallback('TRAIN_AI_VISION_K230', function () {
    if (typeof openAITrainScreen === 'function') openAITrainScreen();
  });
  workspace.registerButtonCallback('TRAIN_AI_VISION_S3', function () {
    if (typeof openS3TrainScreen === 'function') openS3TrainScreen();
  });

  // Restore any previously-picked boards (if any) so their categories
  // survive reloads. Falls back to the old singular key for migration.
  try {
    var _savedBoards = JSON.parse(localStorage.getItem('blockly_selected_boards') || 'null');
    if (!_savedBoards) {
      var _legacyBoard = localStorage.getItem('blockly_selected_board');
      _savedBoards = _legacyBoard ? [_legacyBoard] : [];
    }
    _savedBoards.forEach(function (b) { setSelectedBoard(b); });
  } catch (e) { }

  // ══════════════════════════════════════════════════════════════════════
  // BLOCKLY v12 DYNAMIC TOOLBOX FEATURES
  // ══════════════════════════════════════════════════════════════════════

  // ── ⭐ 1. RECENTLY USED blocks ─────────────────────────────────────────
  // Tracks the last 8 unique block types placed on the workspace.
  // Persisted in localStorage so it survives page reloads.
  const RECENT_MAX = 8;
  let _recentBlocks = [];
  try { _recentBlocks = JSON.parse(localStorage.getItem('blockly_recent_blocks') || '[]'); } catch (_) { }

  function trackRecentBlock(blockType) {
    if (!blockType || blockType === 'start') return;
    _recentBlocks = _recentBlocks.filter(t => t !== blockType);
    _recentBlocks.unshift(blockType);
    if (_recentBlocks.length > RECENT_MAX) _recentBlocks.length = RECENT_MAX;
    try { localStorage.setItem('blockly_recent_blocks', JSON.stringify(_recentBlocks)); } catch (_) { }
    _refreshDynamicFlyout();
  }

  workspace.registerToolboxCategoryCallback('RECENT_BLOCKS', function () {
    const xmlList = [];
    if (_recentBlocks.length === 0) {
      const label = document.createElement('label');
      label.setAttribute('text', 'No blocks used yet — drag some to the workspace!');
      xmlList.push(label);
      return xmlList;
    }
    _recentBlocks.forEach(function (type) {
      if (Blockly.Blocks[type]) {
        const block = document.createElement('block');
        block.setAttribute('type', type);
        xmlList.push(block);
      }
    });
    return xmlList;
  });

  // Track every BLOCK_CREATE event to feed the recent list
  workspace.addChangeListener(function (ev) {
    if (ev.type === Blockly.Events.BLOCK_CREATE) {
      const block = workspace.getBlockById(ev.blockId);
      if (block) trackRecentBlock(block.type);
    }
  });

  // ── ❤️ 2. FAVORITE blocks ──────────────────────────────────────────────
  // Right-click any block on the workspace → "⭐ Add to Favorites".
  // Persisted in localStorage.
  let _favoriteBlocks = [];
  try { _favoriteBlocks = JSON.parse(localStorage.getItem('blockly_favorite_blocks') || '[]'); } catch (_) { }

  function addToFavorites(blockType) {
    if (!blockType || _favoriteBlocks.includes(blockType)) return;
    _favoriteBlocks.push(blockType);
    try { localStorage.setItem('blockly_favorite_blocks', JSON.stringify(_favoriteBlocks)); } catch (_) { }
    _refreshDynamicFlyout();
  }
  function removeFromFavorites(blockType) {
    _favoriteBlocks = _favoriteBlocks.filter(function (t) { return t !== blockType; });
    try { localStorage.setItem('blockly_favorite_blocks', JSON.stringify(_favoriteBlocks)); } catch (_) { }
    _refreshDynamicFlyout();
  }
  function isFavorite(blockType) { return _favoriteBlocks.includes(blockType); }

  window.addToFavorites = addToFavorites;
  window.removeFromFavorites = removeFromFavorites;

  workspace.registerToolboxCategoryCallback('FAVORITE_BLOCKS', function () {
    const xmlList = [];
    if (_favoriteBlocks.length === 0) {
      const label = document.createElement('label');
      label.setAttribute('text', 'Right-click any block → "⭐ Add to Favorites"');
      xmlList.push(label);
      return xmlList;
    }
    _favoriteBlocks.forEach(function (type) {
      if (Blockly.Blocks[type]) {
        const block = document.createElement('block');
        block.setAttribute('type', type);
        xmlList.push(block);
      }
    });
    return xmlList;
  });

  // ── ⭐/💔 3. Context menu — Add / Remove Favorites ─────────────────────
  // v12 ContextMenuRegistry API — adds item to the block right-click menu.
  if (Blockly.ContextMenuRegistry && Blockly.ContextMenuRegistry.registry) {
    try {
      Blockly.ContextMenuRegistry.registry.register({
        id: 'toggle_favorite_block',
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        displayText: function (scope) {
          return isFavorite(scope.block && scope.block.type)
            ? '💔 Remove from Favorites'
            : '⭐ Add to Favorites';
        },
        preconditionFn: function (scope) {
          return (scope.block && scope.block.type) ? 'enabled' : 'hidden';
        },
        callback: function (scope) {
          const type = scope.block && scope.block.type;
          if (!type) return;
          isFavorite(type) ? removeFromFavorites(type) : addToFavorites(type);
        },
        weight: 100,
      });
    } catch (e) { console.warn('ContextMenu register failed:', e); }
  }

  // ── 4. Shared refresh helper ───────────────────────────────────────────
  // Refreshes the currently open dynamic flyout (Recent or Favorites).
  // Uses clearSelection + setSelectedItem so the callback always re-runs.
  function _refreshDynamicFlyout() {
    try {
      const toolbox = workspace.getToolbox();
      if (!toolbox) return;
      const selected = toolbox.getSelectedItem();
      if (!selected) return;
      const name = selected.getName ? selected.getName() : '';
      if (name.includes('Recent') || name.includes('Favorite')) {
        toolbox.clearSelection();
        toolbox.setSelectedItem(selected);
      }
    } catch (e) { }
  }

  // ── 5. navigateToCategory(id) — v12-only API ──────────────────────────
  // Usage: navigateToCategory('cat_sensors')
  function navigateToCategory(categoryId) {
    try {
      const toolbox = workspace.getToolbox();
      const item = toolbox.getToolboxItemById(categoryId);
      if (item) toolbox.setSelectedItem(item);
    } catch (e) { console.warn('navigateToCategory("' + categoryId + '") failed:', e); }
  }
  window.navigateToCategory = navigateToCategory;

  // ── 6. updateToolboxConfig(config) — live toolbox swap ─────────────────
  function updateToolboxConfig(newConfig) {
    try {
      workspace.updateToolbox(newConfig);
      window.toolboxConfig = newConfig;
    } catch (e) { console.warn('updateToolboxConfig failed:', e); }
  }
  window.updateToolboxConfig = updateToolboxConfig;

  // ── 7. setToolboxVisible(bool) ─────────────────────────────────────────
  function setToolboxVisible(visible) {
    try {
      workspace.getToolbox().setVisible(visible);
      Blockly.svgResize(workspace);
    } catch (e) { }
  }
  window.setToolboxVisible = setToolboxVisible;

  // ══════════════════════════════════════════════════════════════════════
  // END v12 DYNAMIC TOOLBOX FEATURES
  // ══════════════════════════════════════════════════════════════════════

  // ── SEARCH CATEGORY callback — registered inside initBlockSearch() below ──
  // ══════════════════════════════════════════════════
  // CUSTOM WORKSPACE ICONS (External SVG/PNG files)
  // ══════════════════════════════════════════════════
  // TO CHANGE ANY ICON:
  //   1. Put your .svg or .png file in the icons/ folder
  //   2. Change the file name below
  //   That's it!
  // ══════════════════════════════════════════════════
  (function customizeCurioIcons() {
    var svgRoot = workspace.getParentSvg();
    var XLINK = 'http://www.w3.org/1999/xlink';

    // ─── AUTO-DETECT CORRECT PATH ───
    // Expo dev server changes the base URL, so we try multiple paths
    var PATHS_TO_TRY = [
      './icons/',                    // normal (index.html and icons/ in same folder)
      './assets/blockly/icons/',     // fallback
      '/assets/blockly/icons/'       // absolute fallback
    ];

    var BASE_PATH = './icons/';     // default

    // Test which path works, then apply icons
    function detectPathAndApply() {
      var testFile = 'curio-zoom-in.svg';
      var tried = 0;
      var pathDetected = false;

      PATHS_TO_TRY.forEach(function (path) {
        fetch(path + testFile).then(function (res) {
          var contentType = res.headers.get('content-type');
          var isHtml = contentType && contentType.indexOf('html') !== -1;
          if (res.ok && !isHtml && !pathDetected) {
            pathDetected = true;
            BASE_PATH = path;
            applyIcons();
          }
        }).catch(function () { }).finally(function () {
          tried++;
          // If all paths failed, try default anyway
          if (tried === PATHS_TO_TRY.length && !pathDetected) {
            console.warn('⚠️ No working icon path found, using default: ./icons/');
            applyIcons();
          }
        });
      });
    }

    // Helper to resolve icon path according to current theme mode
    window.getIconPath = function (fileName, ignoreDarkMode) {
      var isDark = !ignoreDarkMode && document.body.classList.contains('dark-mode');
      var darkIcons = [
        'bin_close.svg',
        'bluethooth.svg',
        'curio-zoom-in.svg',
        'curio-zoom-out.svg',
        'curio-zoom-reset.svg',
        'setting_inner.svg',
        'usb.svg'
      ];
      if (isDark && darkIcons.indexOf(fileName) !== -1) {
        return BASE_PATH + 'dark_mode/' + fileName;
      }
      return BASE_PATH + fileName;
    };

    // ─── SWAP ICON HELPER ───
    function swapIcon(img, fileName, w, h) {
      var fullPath = window.getIconPath(fileName);
      img.setAttribute('href', fullPath);
      img.setAttributeNS(XLINK, 'xlink:href', fullPath);  // needed for older browsers/WebView
      img.setAttribute('width', String(w));
      img.setAttribute('height', String(h));
      img.setAttribute('x', '0');
      img.setAttribute('y', '0');
      img.removeAttribute('clip-path');
    }

    // ─── APPLY ALL ICONS ───
    function applyIcons() {
      // Update non-Blockly HTML images if they exist
      var usbImgs = document.querySelectorAll('img[src*="usb.svg"]');
      usbImgs.forEach(function (img) {
        img.src = window.getIconPath('usb.svg');
      });

      var btImgs = document.querySelectorAll('img[src*="bluethooth.svg"]');
      btImgs.forEach(function (img) {
        img.src = window.getIconPath('bluethooth.svg');
      });

      var settingsImgs = document.querySelectorAll('img[src*="setting_inner.svg"]');
      settingsImgs.forEach(function (img) {
        img.src = window.getIconPath('setting_inner.svg');
      });

      // ── TRASHCAN ──
      var trash = svgRoot.querySelector('.blocklyTrash');
      if (trash) {
        var tImgs = trash.querySelectorAll('image');
        if (tImgs[0]) {
          swapIcon(tImgs[0], 'bin_close.svg', 40, 40);
          tImgs[0].setAttribute('x', '15');
          tImgs[0].setAttribute('y', '-25');
          tImgs[0].setAttribute('data-bin-icon', 'true');
        }
        if (tImgs[1]) {
          tImgs[1].setAttribute('width', '0');
          tImgs[1].setAttribute('height', '0');
          tImgs[1].setAttribute('display', 'none');
        }

        // Override setLidOpen directly so the icon swaps whenever a block hovers the trash.
        var tc = workspace.trashcan;
        if (tc && tc.setLidOpen && !tc.setLidOpen.isOverridden) {
          var _origSetLidOpen = tc.setLidOpen.bind(tc);
          tc.setLidOpen = function (isOpen) {
            _origSetLidOpen(isOpen);
            var binImg = svgRoot.querySelector('.blocklyTrash image[data-bin-icon="true"]');
            if (binImg) {
              swapIcon(binImg, isOpen ? 'bin_open.svg' : 'bin_close.svg', 40, 40);
              binImg.setAttribute('x', '15');
              binImg.setAttribute('y', '-25');
            }
          };
          tc.setLidOpen.isOverridden = true;
        }
      }

      // ── ZOOM CONTROLS ──
      var zReset = svgRoot.querySelector('.blocklyZoomReset image');
      var zIn = svgRoot.querySelector('.blocklyZoomIn image');
      var zOut = svgRoot.querySelector('.blocklyZoomOut image');

      if (zReset) {
        swapIcon(zReset, 'curio-zoom-reset.svg', 40, 40);
        zReset.setAttribute('x', '-4');  // align with zoom-in/out (compensate for sprite-offset diff)
      }
      if (zIn) swapIcon(zIn, 'curio-zoom-in.svg', 40, 40);
      if (zOut) swapIcon(zOut, 'curio-zoom-out.svg', 40, 40);

    }

    window.applyCurioIcons = applyIcons;

    // Automatically re-apply icons when the theme changes
    window.addEventListener('theme-changed', function () {
      applyIcons();
    });

    detectPathAndApply();
  })();

  addGradientDefs();

  // =====================================================================
  // KILL BLUE SELECTION GLOW (Blockly v12)
  // =====================================================================
  function killBlueSelection() {
    const style = document.createElement('style');
    style.textContent = `
          /* ── Remove Blockly v12 blue selection glow entirely ── */
          svg.blocklySvg .blocklySelected { filter: none !important; }

          /* ── CRITICAL: Hide duplicate overlay paths that cover block content ── */
          .blocklyDraggable > .blocklyPath ~ .blocklyPath {
            fill: none !important;
            stroke: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }

          /* ── Hide the light/dark path overlays ── */
          svg.blocklySvg .blocklySelected > .blocklyPathLight,
          svg.blocklySvg .blocklySelected > .blocklyPathDark,
          svg.blocklySvg .blocklySelected > .blocklyPathSelected {
            display: none !important;
          }

          /* ── Ensure text is always visible ── */
          .blocklyText { fill: #000 !important; }

          /* ── Images and interactive fields stay clickable ── */
          .blocklySelected image,
          .blocklySelected .blocklyEditableText,
          .blocklySelected .blocklyNonEditableText,
          .blocklySelected .blocklyText,
          .blocklyDraggable image {
            cursor: pointer !important;
            pointer-events: all !important;
          }

          /* ── Dropdowns must appear above all SVG layers ── */
          .blocklyWidgetDiv   { z-index: 9999 !important; }
          .blocklyDropdownDiv { z-index: 9999 !important; }
          .blocklyTooltipDiv  { z-index: 9998 !important; }
          .blocklyDropdownDiv .goog-menuitem-content { color: #000 !important; }

          /* ── Dragging: keep gradient visible, not washed out ── */
          .blocklyDragging > .blocklyPath:first-of-type {
            opacity: 1 !important;
          }

          /* ── CUSTOM: Zoom Controls — uniform 12px gap between 40px icons (52px step) ── */
          svg.blocklySvg .blocklyZoomReset,
          svg.blocklySvg .blocklyZoomIn,
          svg.blocklySvg .blocklyZoomOut {
            transition: transform 0.2s ease, opacity 0.2s ease !important;
          }

          svg.blocklySvg .blocklyZoomReset {
            transform: translate(4px, -52px) !important;
          }

          svg.blocklySvg .blocklyZoomIn {
            transform: translate(0px, 0px) !important;
          }

          svg.blocklySvg .blocklyZoomOut {
            transform: translate(0px, 52px) !important;
          }

          /* Force zoom images opacity to 1 as requested */
          svg.blocklySvg .blocklyZoom > image,
          svg.blocklySvg .blocklyZoom > svg > image {
            opacity: 1 !important;
            transition: opacity 0.15s ease, filter 0.15s ease !important;
          }

          svg.blocklySvg .blocklyZoom:hover > image,
          svg.blocklySvg .blocklyZoom:hover > svg > image {
            opacity: 0.9 !important;
            filter: brightness(0.95);
          }

          svg.blocklySvg .blocklyZoom:active > image,
          svg.blocklySvg .blocklyZoom:active > svg > image {
            opacity: 0.8 !important;
            filter: brightness(0.9);
          }

          /* ── Trash: always full opacity — icon swap replaces Blockly's fade animation ── */
          svg.blocklySvg .blocklyTrash {
            opacity: 1 !important;
          }
        `;
    document.head.appendChild(style);
  }

  killBlueSelection();
  setupGradientAndShadowOnBlocks();

  // =====================================================================
  // BLOCK SEARCH — single correct implementation
  // Fixes:
  //   1. ev.newItem is the generated ID in v12, not the name — use getName()
  //   2. Use clearSelection()+setSelectedItem() to force flyout redraw
  //   3. Build search index from Blockly.Blocks (works with JS toolbox config)
  //   4. Position box dynamically using toolbox.getWidth()
  // =====================================================================
  function initBlockSearch() {
    const container = document.getElementById('flyoutSearchContainer');
    const input = document.getElementById('flyoutSearchInput');
    const clearBtn = document.getElementById('flyoutSearchClear');
    const emptyState = document.getElementById('searchEmptyState');
    const noResultsState = document.getElementById('searchNoResults');
    if (!container || !input) return;

    // Prevent clicking inside the search box from bubbling up to document and triggering Blockly.hideChaff()
    const preventClose = (e) => {
      e.stopPropagation();
    };
    container.addEventListener('pointerdown', preventClose);
    container.addEventListener('mousedown', preventClose);
    container.addEventListener('touchstart', preventClose);
    container.addEventListener('click', preventClose);
    // ── Build search index from Blockly.Blocks registry ──────────────
    // This works regardless of whether the toolbox is XML or JS config.
    const searchIndex = [];
    Object.keys(Blockly.Blocks).forEach(type => {
      const displayName = type
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      searchIndex.push({
        type,
        search: (type + ' ' + displayName).toLowerCase()
      });
    });

    // ── Register SEARCH_CATEGORY flyout callback ──────────────────────
    // Reads input.value directly — no global variable needed.
    workspace.registerToolboxCategoryCallback('SEARCH_CATEGORY', function () {
      const xmlList = [];

      // Top spacer so blocks don't hide under the floating search box
      // Using a non-breaking space ensures Blockly's bounding box calculation
      // includes this block, stretching the dark blue flyout background to the top!
      const gap = document.createElement('label');
      gap.setAttribute('text', '\u00A0');
      gap.setAttribute('gap', '48');
      xmlList.push(gap);

      const q = input.value.trim().toLowerCase();
      if (!q) {
        const hint = document.createElement('label');
        hint.setAttribute('text', '');
        xmlList.push(hint);
        return xmlList;
      }

      const words = q.split(/\s+/);
      const hits = searchIndex.filter(b => words.every(w => b.search.includes(w)));

      const header = document.createElement('label');
      header.setAttribute('text', hits.length
        ? ``
        : ``
      );
      xmlList.push(header);

      hits.slice(0, 50).forEach(b => {
        const block = document.createElement('block');
        block.setAttribute('type', b.type);
        xmlList.push(block);
      });

      return xmlList;
    });

    // ── Helper: get the Search toolbox item ───────────────────────────
    // FIX: in v12 ev.newItem is the generated ID. Use getName() on the
    // actual item object instead of comparing ev.newItem to the string.
    function getSearchItem() {
      const toolbox = workspace.getToolbox();
      if (!toolbox) return null;
      return toolbox.getToolboxItems().find(
        item => item.getName && item.getName().toLowerCase().includes('search')
      ) || null;
    }

    // ── Show / hide the floating search box on category change ────────
    workspace.addChangeListener(function (ev) {
      if (ev.type !== 'toolbox_item_select') return;
      const toolbox = workspace.getToolbox();
      if (!toolbox) return;

      // FIX: Use `getSelectedItem()` directly instead of ambiguous `ev.newItem` which may be Name or ID
      let isSearch = false;
      const selectedItem = toolbox.getSelectedItem();
      if (selectedItem && selectedItem.getName) {
        isSearch = selectedItem.getName().toLowerCase().includes('search');
      }

      if (isSearch) {
        // Position flush inside flyout panel
        // Position perfectly centered inside the dark blue flyout panel
        const _positionSearch = () => {
          try {
            const toolboxEl = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
            // offsetParent of the container (inside .topbar) — used to convert
            // viewport coords into the correct local offset
            const parent = container.offsetParent || document.body;
            const tbRect = toolboxEl.getBoundingClientRect();
            const pRect = parent.getBoundingClientRect();

            // Left edge of flyout relative to the container's offsetParent
            const relLeft = tbRect.right - pRect.left;
            // Top of toolbox relative to the container's offsetParent
            const relTop = tbRect.top - pRect.top;
            // Search input: 300px wide, 12px inside flyout, 14px from top
            container.style.left = (relLeft + 12) + 'px';
            container.style.width = '276px';
            container.style.top = (relTop + 14) + 'px';

            // Empty / no-results states: same size as the toolbox panel
            [emptyState, noResultsState].forEach(el => {
              if (!el) return;
              el.style.left = relLeft + 'px';
              el.style.top = relTop + 'px';
              el.style.width = '300px';
              el.style.height = tbRect.height + 'px';
            });
          } catch (_) {
            container.style.left = '227px';
            container.style.width = '276px';
            container.style.top = '55px';
            if (emptyState) {
              emptyState.style.left = '215px';
              emptyState.style.top = '55px';
              emptyState.style.width = '300px';
              emptyState.style.height = 'calc(100vh - 110px)';
            }
          }
        };
        _positionSearch();
        // Re-run after flyout finishes rendering
        setTimeout(_positionSearch, 80);
        if (window._searchHideTimeout) {
          clearTimeout(window._searchHideTimeout);
          window._searchHideTimeout = null;
        }
        if (container.classList.contains('hidden')) {
          container.classList.remove('hidden');
          // Show empty state if no query
          if (emptyState && !input.value.trim()) {
            emptyState.classList.remove('hidden');
          }
          if (noResultsState) noResultsState.classList.add('hidden');
          setTimeout(() => input.focus(), 60);
        }
      } else {
        // Debounce the hiding to prevent flicker and focus loss when refreshing search
        if (window._searchHideTimeout) {
          clearTimeout(window._searchHideTimeout);
        }
        window._searchHideTimeout = setTimeout(() => {
          if (container.contains(document.activeElement)) {
            // If focus is still in the search bar, don't hide, re-select search category!
            const searchItem = getSearchItem();
            if (searchItem) workspace.getToolbox().setSelectedItem(searchItem);
            return;
          }
          container.classList.add('hidden');
          if (emptyState) emptyState.classList.add('hidden');
          if (noResultsState) noResultsState.classList.add('hidden');

          // Clear search when it hides so the next time it opens or after a block is dragged, it's empty
          if (input.value !== '') {
            input.value = '';
            clearBtn.style.display = 'none';
          }
        }, 100);
      }
    });

    // ── Input handler — force flyout redraw on every keystroke ────────
    let _debounce = null;
    input.addEventListener('input', function () {
      const q = input.value.trim().toLowerCase();
      clearBtn.style.display = input.value ? 'flex' : 'none';

      if (!q) {
        // No query — show empty state, hide no-results
        if (emptyState) emptyState.classList.remove('hidden');
        if (noResultsState) noResultsState.classList.add('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
        // Check hits immediately so no-results shows without waiting for debounce
        const words = q.split(/\s+/);
        const hasHits = searchIndex.some(b => words.every(w => b.search.includes(w)));
        if (noResultsState) {
          if (hasHits) noResultsState.classList.add('hidden');
          else noResultsState.classList.remove('hidden');
        }
      }
      clearTimeout(_debounce);
      _debounce = setTimeout(function () {
        const toolbox = workspace.getToolbox();
        if (!toolbox) return;
        const searchItem = getSearchItem();
        if (!searchItem) return;
        // FIX: clearSelection + setSelectedItem forces the flyout callback
        // to re-run and reflect the new query. refreshSelection() alone
        // sometimes does not re-invoke the callback if the same item is
        // already selected.
        toolbox.clearSelection();
        toolbox.setSelectedItem(searchItem);

        // Re-focus the search input because Blockly steals focus when it opens the flyout
        setTimeout(() => input.focus(), 50);
      }, 120);
    });

    // ── Clear button ──────────────────────────────────────────────────
    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.style.display = 'none';
      if (emptyState) emptyState.classList.remove('hidden');
      if (noResultsState) noResultsState.classList.add('hidden');
      input.dispatchEvent(new Event('input'));
      input.focus();
    });

    // ── Escape to close ───────────────────────────────────────────────
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        container.classList.add('hidden');
        input.value = '';
        clearBtn.style.display = 'none';
        workspace.getToolbox().clearSelection();
      }
    });

    // ── Ctrl+K / Cmd+K shortcut to open Search ────────────────────────
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchItem = getSearchItem();
        if (searchItem) workspace.getToolbox().setSelectedItem(searchItem);
      }
    });
  }

  initBlockSearch();


  // ════════════════════════════════════════════════════════════════
  // UI ENHANCEMENT SUITE
  // ════════════════════════════════════════════════════════════════

  // ── 1. Block Hover & Drag Effects (filter-only, NO transforms) ─
  // IMPORTANT: Never apply CSS transform to Blockly SVG block groups.
  // Blockly manages their position via SVG transform attribute every
  // frame. CSS transform on top creates a feedback loop → shaking.
  // Only filter (brightness/drop-shadow) is safe.
  function setupBlockHoverEffects() {
    const svgRoot = workspace.getParentSvg();
    if (!svgRoot) return;

    let _hovered = null;

    svgRoot.addEventListener('mouseover', function (e) {
      const g = e.target.closest('.blocklyDraggable');
      if (g === _hovered) return;                       // same group, skip
      if (_hovered) _hovered.classList.remove('block-hover-active');
      _hovered = g || null;
      if (g && !g.classList.contains('blocklySelected') &&
        !g.classList.contains('block-drag-active')) {
        g.classList.add('block-hover-active');
      }
    }, { passive: true });

    svgRoot.addEventListener('mouseout', function (e) {
      if (!_hovered) return;
      if (!_hovered.contains(e.relatedTarget)) {
        _hovered.classList.remove('block-hover-active');
        _hovered = null;
      }
    }, { passive: true });

    // Deeper shadow while dragging, removed on drop
    workspace.addChangeListener(function (ev) {
      if (ev.type !== Blockly.Events.BLOCK_DRAG) return;
      const block = workspace.getBlockById(ev.blockId);
      if (!block) return;
      const svg = block.getSvgRoot();
      if (!svg) return;
      if (ev.isStart) {
        svg.classList.add('block-drag-active');
        svg.classList.remove('block-hover-active');
      } else {
        svg.classList.remove('block-drag-active');
      }
    });
  }

  // ── 2. Workspace Welcome Hint ─────────────────────────────────
  function setupWorkspaceHint() {
    const wsEl = document.querySelector('.workspace');
    if (!wsEl) return;
    const hint = document.createElement('div');
    hint.id = 'workspace-hint';
    hint.innerHTML =
      '<div class="hint-icon">🧩</div>' +
      '<div class="hint-text">Drag blocks from the<br>toolbox to start!</div>';
    wsEl.appendChild(hint);

    function refresh() {
      const user = workspace.getAllBlocks(false).filter(function (b) {
        return b.type !== 'start';
      });
      hint.classList.toggle('ws-hint-hidden', user.length > 0);
    }
    refresh();
    workspace.addChangeListener(function (ev) {
      if (ev.type === Blockly.Events.BLOCK_CREATE ||
        ev.type === Blockly.Events.BLOCK_DELETE) refresh();
    });
  }

  // ── 3. Block Count Badges on Toolbox Categories ───────────────
  // function setupCategoryBadges() {
  //   function inject() {
  //     try {
  //       workspace.getToolbox().getToolboxItems().forEach(function (item) {
  //         if (!item.getName) return;
  //         const row = item.rowDiv_ ||
  //           (item.getDiv && item.getDiv() &&
  //             item.getDiv().querySelector('.blocklyTreeRow'));
  //         if (!row || row.querySelector('.cat-block-badge')) return;
  //         let count = 0;
  //         try {
  //           count = (item.getContents ? item.getContents() : [])
  //             .filter(function (c) {
  //               return c.kind && c.kind.toLowerCase() === 'block';
  //             }).length;
  //         } catch (_) { }
  //         if (count === 0) return;
  //         const badge = document.createElement('span');
  //         badge.className = 'cat-block-badge';
  //         badge.textContent = count;
  //         row.appendChild(badge);
  //       });
  //     } catch (_) { }
  //   }
  //   setTimeout(inject, 900);
  //   setTimeout(inject, 2200); // retry for slow renders
  // }

  // ── 4. Friendly Block Tooltips ────────────────────────────────
  function setupBlockTooltips() {
    var TIPS = {
      'start': '▶ Program entry — all code starts here',
      'ctl_delay': '⏱ Pause execution for a set time',
      'din_motion': '🏃 Detects movement (PIR sensor)',
      'din_ultra': '📡 Measures distance with ultrasound',
      'din_button': '🔘 Reads a push button',
      'din_temp': '🌡 Digital temperature sensor',
      'tep_ana': '🌡 Analog temperature sensor',
      'humidity': '💧 Reads humidity level',
      'ldr': '☀️ Reads ambient light (LDR)',
      'heart_beat': '❤️ Reads heartbeat / pulse',
      'do_dc_motor': '🔄 Controls a DC motor',
      'do_servo': '🦾 Moves a servo to an angle',
      'do_led': '💡 Turns an LED on or off',
      'do_led_param': '💡 LED with custom pin & state',
      'rgb_display': '🌈 Sets RGB LED color',
      'relay': '🔌 Switches a relay',
      'buzzer': '🔊 Sounds the buzzer',
      'bt_send': '📡 Sends a value over Bluetooth',
      'lp_while': '🔁 Repeats while condition is true',
      'lp_repeat_count': '🔢 Repeats a fixed number of times',
      'din_if_else': '🧠 Runs code based on a condition',
      'logic_boolean': '✅ A true or false value',
      'logic_compare': '⚖️ Compares two values',
      'math_number': '🔢 A number',
      'math_arithmetic': '➕ Add, subtract, multiply, divide',
      'text': '🔤 A text string',
      'text_join': '🔗 Joins two strings together',
    };
    Object.keys(TIPS).forEach(function (type) {
      var def = Blockly.Blocks[type];
      if (!def || !def.init) return;
      var orig = def.init;
      var tip = TIPS[type];
      def.init = function () {
        orig.call(this);
        try {
          if (!this.getTooltip || !this.getTooltip()) this.setTooltip(tip);
        } catch (_) { }
      };
    });
  }

  // ── 5. Responsive Toolbox Toggle ─────────────────────────────
  function setupResponsiveLayout() {
    var isCollapsed = false;

    // Toggle button — fixed on body so Blockly SVG never blocks it
    var btn = document.createElement('button');
    btn.className = 'toolbox-toggle-btn';
    btn.innerHTML = '<img src="icons/slider.svg" style="width: 36px; height: 36px; transform: scaleX(-1);" alt="Toggle" />';
    btn.title = 'Collapse Toolbox';
    btn.style.visibility = 'hidden';
    document.body.appendChild(btn);

    // Icon-only panel — sits over Blockly area, no animation
    var iconPanel = document.createElement('div');
    iconPanel.id = 'toolbox-icon-panel';
    iconPanel.style.cssText = [
      'position:fixed',
      'top:0', 'left:0',
      'width:72px', 'height:100%',
      'background:#fff',
      'z-index:998',
      'overflow-y:auto',
      'overflow-x:hidden',
      'padding:8px 4px',
      'box-sizing:border-box',
      'border-radius:0 20px 20px 0',
      'box-shadow:4px 0 16px rgba(0,0,0,0.10)',
      'display:none',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(iconPanel);

    // Reposition icon panel to match the Blockly area exactly
    function fitIconPanel() {
      var bd = document.getElementById('blocklyDiv');
      if (!bd) return;
      var r = bd.getBoundingClientRect();
      iconPanel.style.top = r.top + 'px';
      iconPanel.style.left = r.left + 'px';
      iconPanel.style.height = r.height + 'px';
    }

    function buildIconPanel() {
      iconPanel.innerHTML = '';

      // ── Toolbox header icon (top of panel, matches Figma design) ──
      var isDark = document.body.classList.contains('dark-mode');
      var tbIconWrapper = document.createElement('div');
      tbIconWrapper.id = 'icon-panel-tb-header';
      tbIconWrapper.style.cssText = [
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:10px 4px 8px 4px',
        'margin-bottom:2px',
        'border-bottom: 1px solid ' + (isDark ? '#334155' : '#E2E8F0'),
        'flex-shrink:0'
      ].join(';');
      var tbIcon = document.createElement('img');
      tbIcon.src = 'assets/img/icon_037.svg';
      tbIcon.alt = 'Toolbox';
      tbIcon.style.cssText = 'width:37px;height:34px;object-fit:contain;pointer-events:none;';
      tbIconWrapper.appendChild(tbIcon);
      iconPanel.appendChild(tbIconWrapper);
      // ─────────────────────────────────────────────────────────────────

      var rows = document.querySelectorAll('[data-figma]');
      rows.forEach(function (row) {
        var img = row.querySelector('.fg-icon');
        var lbl = row.querySelector('.blocklyToolboxCategoryLabel');
        if (!img) return;
        var item = document.createElement('div');
        item.title = lbl ? lbl.textContent.trim() : '';
        item.style.cssText = [
          'display:flex', 'align-items:center', 'justify-content:center',
          'margin:4px auto', 'cursor:pointer',
          'padding:6px', 'border-radius:10px',
          'transition:background 0.15s'
        ].join(';');
        item.onmouseenter = function () { item.style.background = '#EEF2FF'; };
        item.onmouseleave = function () { item.style.background = ''; };
        var clone = document.createElement('img');
        var _lbl = lbl ? lbl.textContent.trim() : '';
        clone.src = (window.SMALL_ICONS && window.SMALL_ICONS[_lbl]) ? window.SMALL_ICONS[_lbl] : img.src;
        clone.style.cssText = 'width:37px;height:34px;border-radius:8px;pointer-events:none;';
        item.appendChild(clone);
        item.addEventListener('click', function (e) { e.stopPropagation(); expand(); });
        iconPanel.appendChild(item);
      });
    }

    // Position button at right edge of toolbox
    function updateBtnPos() {
      try {
        var bd = document.getElementById('blocklyDiv');
        var bdLeft = bd ? bd.getBoundingClientRect().left : 0;
        if (isCollapsed) {
          btn.style.top = (bdLeft + 63) + '%';
          btn.style.left = (bdLeft + 60) + 'px';
        } else {
          // getWidth() returns toolbox panel width (not flyout)
          var w = workspace.getToolbox().getWidth();
          // If Blockly hasn't rendered yet, w may be 0 – retry
          if (w < 60) { setTimeout(updateBtnPos, 300); return; }
          btn.style.left = (bdLeft + 193) + 'px';
          btn.style.top = (bdLeft + 73) + '%';
        }
        btn.style.visibility = 'visible';
      } catch (_) { setTimeout(updateBtnPos, 300); }
    }

    function collapse() {
      isCollapsed = true;
      buildIconPanel();
      fitIconPanel();
      iconPanel.style.display = 'block';
      iconPanel.style.pointerEvents = 'auto';
      try { workspace.getToolbox().setVisible(false); Blockly.svgResize(workspace); } catch (_) { }
      btn.innerHTML = '<img src="icons/slider.svg" style="width: 36px; height: 36px;" alt="Toggle" />';
      btn.title = 'Expand Toolbox';
      localStorage.setItem('blockly_toolbox_collapsed', 'true');
      if (typeof window.dpSyncCollapse === 'function') window.dpSyncCollapse();
      if (typeof window.dpPosition === 'function') window.dpPosition();
      setTimeout(updateBtnPos, 50);
    }

    function expand() {
      isCollapsed = false;
      iconPanel.style.display = 'none';
      iconPanel.style.pointerEvents = 'none';
      try { workspace.getToolbox().setVisible(true); Blockly.svgResize(workspace); } catch (_) { }
      btn.innerHTML = '<img src="icons/slider.svg" style="width: 36px; height: 36px; transform: scaleX(-1);" alt="Toggle" />';
      btn.title = 'Collapse Toolbox';
      localStorage.setItem('blockly_toolbox_collapsed', 'false');
      if (typeof window.dpSyncCollapse === 'function') window.dpSyncCollapse();
      if (typeof window.dpPosition === 'function') window.dpPosition();
      setTimeout(updateBtnPos, 150);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isCollapsed) expand(); else collapse();
    });

    // Hide button when a category flyout is open, show when closed
    workspace.addChangeListener(function (ev) {
      if (ev.type !== 'toolbox_item_select') return;
      if (isCollapsed) return;
      try {
        var flyout = workspace.getFlyout ? workspace.getFlyout() : null;
        var flyoutOpen = flyout && flyout.isVisible && flyout.isVisible();
        btn.style.display = flyoutOpen ? 'none' : 'flex';
      } catch (_) { }
    });

    // Restore collapsed state from localStorage
    if (localStorage.getItem('blockly_toolbox_collapsed') === 'true') {
      setTimeout(collapse, 900);
    } else {
      // Multiple retries so Blockly has time to fully render the toolbox
      setTimeout(updateBtnPos, 800);
      setTimeout(updateBtnPos, 1800);
    }
  }

  // ── Kick off all enhancements ─────────────────────────────────
  setupBlockHoverEffects();
  setupWorkspaceHint();
  setupBlockTooltips();
  // setTimeout(setupCategoryBadges, 300);
  setupResponsiveLayout();

  // ===== ZELOS POPUP + DRAG FIX =====
  // The glow path swallows pointerdown before click ever fires.
  // So we MUST intercept at pointerdown in capture phase.
  // To avoid breaking drag: we record pointer position on pointerdown,
  // then on pointerup we check if the pointer barely moved (= a tap/click,
  // not a drag). Only then do we fire the popup.

  (function patchZelosImageClicks() {
    const blocklyDiv = document.getElementById('blocklyDiv');
    if (!blocklyDiv) { setTimeout(patchZelosImageClicks, 100); return; }

    let downX = 0, downY = 0, downTarget = null;

    // Step 1: Record where the pointerdown happened
    blocklyDiv.addEventListener('pointerdown', function (e) {
      downX = e.clientX;
      downY = e.clientY;
      // Use elementFromPoint to find what's VISUALLY under the cursor
      // (even if the glow path is on top in the DOM)
      downTarget = document.elementFromPoint(e.clientX, e.clientY);
    }, true);

    // Step 2: On pointerup, if pointer barely moved = it was a tap
    blocklyDiv.addEventListener('pointerup', function (e) {
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);

      // If moved more than 5px = drag, ignore
      if (dx > 5 || dy > 5) return;
      if (!downTarget) return;

      // Check all elements at the click point — not just the top one
      const elements = document.elementsFromPoint(e.clientX, e.clientY);

      // Find any <image> SVG element in the stack
      const imageEl = elements.find(el =>
        el.tagName === 'image' || el.tagName === 'IMAGE'
      );

      if (!imageEl) return;

      // Now find which FieldImage in workspace owns this <image> element
      const blocks = workspace.getAllBlocks(false);
      for (const block of blocks) {
        for (const input of block.inputList) {
          for (const field of input.fieldRow) {
            const root = field.getSvgRoot ? field.getSvgRoot() : null;
            if (!root) continue;

            if (root === imageEl || root.contains(imageEl)) {

              if (typeof field.clickHandler === 'function') {
                field.clickHandler(field);
                return;
              }
              if (typeof field.clickHandler_ === 'function') {
                field.clickHandler_(field);
                return;
              }
            }
          }
        }
      }
    }, true);
  })();
  // ===== END ZELOS POPUP + DRAG FIX =====

  // ═══ SYNTHESIZED SOUND ENGINE (no external files needed) ═══
  const CurioSounds = {
    _ctx: null,
    _getCtx() {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Resume if suspended — Android WebView suspends AudioContext until user gesture
      if (this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => { });
      }
      return this._ctx;
    },
    click() {
      try {
        const c = this._getCtx(), o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(600, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.06);
        g.gain.setValueAtTime(0.08, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
        o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.08);
      } catch (e) { }
    },
    delete() {
      try {
        const c = this._getCtx(), o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(400, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.15);
        g.gain.setValueAtTime(0.06, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
        o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.15);
      } catch (e) { }
    },
    error() {
      try {
        const c = this._getCtx(), o = c.createOscillator(), g = c.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(200, c.currentTime);
        o.frequency.setValueAtTime(150, c.currentTime + 0.08);
        g.gain.setValueAtTime(0.05, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
        o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.15);
      } catch (e) { }
    }
  };

  let userInteracted = false;
  document.addEventListener('pointerdown', () => userInteracted = true, { once: true });
  document.addEventListener('keydown', () => userInteracted = true, { once: true });

  workspace.addChangeListener((ev) => {
    if (!userInteracted) return;
    if (ev.type === Blockly.Events.BLOCK_MOVE && ev.isStart) CurioSounds.click();
  });
  workspace.addChangeListener((ev) => {
    if (!userInteracted) return;
    if (ev.type === Blockly.Events.BLOCK_DELETE) CurioSounds.delete();
  });
  Blockly.Connection.prototype.highlightForError = function () {
    if (userInteracted) CurioSounds.error();
  };

  // =====================================================================
  // MULTI-EFFECT PARTICLE ENGINE — 5 ANIMATION VARIANTS
  // =====================================================================
  const splashCanvas = document.getElementById('waterSplashCanvas');
  const splashCtx = splashCanvas.getContext('2d');
  let splashParticles = [];
  let splashAnimating = false;
  let currentEffect = 'water';

  // Effect selector logic
  const fxSelect = document.getElementById('fxSelect');
  const fxIcon = document.getElementById('fxIcon');
  const fxIcons = { water: '💧', fire: '🔥', stars: '✨', bubbles: '🫧', electric: '⚡', hearts: '💖', rainbow: '🌈', fairy: '🧚' };
  if (fxSelect) {
    fxSelect.addEventListener('change', (e) => {
      currentEffect = e.target.value;
      if (fxIcon) fxIcon.textContent = fxIcons[currentEffect] || '💧';
    });
  }

  function resizeSplashCanvas() {
    splashCanvas.width = window.innerWidth;
    splashCanvas.height = window.innerHeight;
  }
  resizeSplashCanvas();
  window.addEventListener('resize', resizeSplashCanvas);

  // ─── EFFECT 1: WATER SPLASH 💧 ───
  class WaterParticle {
    constructor(x, y) {
      this.x = x; this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.0;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - (Math.random() * 1.5);
      this.radius = 2 + Math.random() * 5;
      this.originalRadius = this.radius;
      this.life = 1; this.decay = 0.008 + Math.random() * 0.01; this.gravity = 0.06;
      const colors = [[71, 201, 255], [0, 150, 255], [0, 119, 204], [179, 232, 255], [0, 200, 220], [100, 220, 255]];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.05 + Math.random() * 0.1;
    }
    update() {
      this.vy += this.gravity; this.x += this.vx; this.y += this.vy;
      this.vx *= 0.98; this.life -= this.decay;
      this.radius = this.originalRadius * this.life; this.wobble += this.wobbleSpeed;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save(); const a = this.life * 0.8; const [r, g, b] = this.color;
      ctx.beginPath();
      ctx.arc(this.x + Math.sin(this.wobble) * 1.5, this.y, Math.max(0.5, this.radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x + Math.sin(this.wobble) * 1.5 - this.radius * 0.3, this.y - this.radius * 0.3, Math.max(0.3, this.radius * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`; ctx.fill();
      ctx.restore();
    }
  }
  class WaterRipple {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 3; this.maxRadius = 30 + Math.random() * 25; this.life = 1; this.speed = 0.4 + Math.random() * 0.3; }
    update() { this.radius += this.speed; this.life = 1 - (this.radius / this.maxRadius); }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save(); ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(71,201,255,${this.life * 0.6})`; ctx.lineWidth = 2 * this.life; ctx.stroke(); ctx.restore();
    }
  }

  // ─── EFFECT 2: FIRE EXPLOSION 🔥 ───
  class FireParticle {
    constructor(x, y) {
      this.x = x; this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2.5;
      this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed - (Math.random() * 2);
      this.radius = 3 + Math.random() * 6; this.originalRadius = this.radius;
      this.life = 1; this.decay = 0.012 + Math.random() * 0.015;
      this.gravity = -0.02; this.phase = Math.random() * Math.PI * 2;
    }
    update() {
      this.vy += this.gravity; this.x += this.vx + Math.sin(this.phase) * 0.3; this.y += this.vy;
      this.vx *= 0.97; this.vy *= 0.98; this.life -= this.decay;
      this.radius = this.originalRadius * this.life; this.phase += 0.15;
    }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      let r, g, b;
      if (this.life > 0.7) { r = 255; g = 230 + Math.random() * 25; b = 100 + this.life * 100; }
      else if (this.life > 0.4) { r = 255; g = 120 + this.life * 140; b = 20; }
      else { r = 255 * this.life * 2; g = 40 * this.life; b = 0; }
      const a = this.life * 0.9;
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(0.4, `rgba(${r},${Math.max(0, g - 50)},0,${a * 0.5})`);
      grad.addColorStop(1, `rgba(${r},0,0,0)`);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.5, this.radius * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,200,${a})`; ctx.fill(); ctx.restore();
    }
  }
  class EmberParticle {
    constructor(x, y) {
      this.x = x; this.y = y;
      const angle = Math.random() * Math.PI * 2; const speed = 1 + Math.random() * 3;
      this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed - 2;
      this.radius = 1 + Math.random() * 2; this.life = 1; this.decay = 0.008 + Math.random() * 0.012;
      this.gravity = -0.03; this.flicker = Math.random() * Math.PI * 2;
    }
    update() { this.vy += this.gravity; this.x += this.vx; this.y += this.vy; this.vx *= 0.99; this.life -= this.decay; this.flicker += 0.3; }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      const f = 0.5 + Math.sin(this.flicker) * 0.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * this.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${150 + Math.random() * 100},0,${this.life * f})`; ctx.fill(); ctx.restore();
    }
  }

  // ─── EFFECT 3: STAR SPARKLE ✨ ───
  class StarParticle {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 40; this.y = y + (Math.random() - 0.5) * 40;
      this.size = 3 + Math.random() * 8; this.originalSize = this.size;
      this.life = 1; this.decay = 0.01 + Math.random() * 0.015;
      this.rotation = Math.random() * Math.PI * 2; this.rotSpeed = (Math.random() - 0.5) * 0.15;
      this.vx = (Math.random() - 0.5) * 1.5; this.vy = (Math.random() - 0.5) * 1.5;
      const golds = [[255, 215, 0], [255, 235, 59], [255, 193, 7], [255, 245, 157], [255, 183, 77]];
      this.color = golds[Math.floor(Math.random() * golds.length)];
      this.twinklePhase = Math.random() * Math.PI * 2; this.twinkleSpeed = 0.1 + Math.random() * 0.2;
      this.points = Math.random() > 0.5 ? 4 : 5;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.vx *= 0.98; this.vy *= 0.98;
      this.life -= this.decay; this.size = this.originalSize * this.life;
      this.rotation += this.rotSpeed; this.twinklePhase += this.twinkleSpeed;
    }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
      const tw = 0.4 + Math.sin(this.twinklePhase) * 0.6;
      const a = this.life * tw; const [r, g, b] = this.color;
      ctx.beginPath();
      for (let i = 0; i < this.points * 2; i++) {
        const rad = (i % 2 === 0) ? this.size : this.size * 0.4;
        const ang = (i * Math.PI) / this.points - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath(); ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`; ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.4})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-this.size * 1.5, 0); ctx.lineTo(this.size * 1.5, 0);
      ctx.moveTo(0, -this.size * 1.5); ctx.lineTo(0, this.size * 1.5); ctx.stroke();
      ctx.restore();
    }
  }
  class StarTrail {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 2; this.maxRadius = 20 + Math.random() * 15; this.life = 1; this.speed = 0.3 + Math.random() * 0.2; }
    update() { this.radius += this.speed; this.life = 1 - (this.radius / this.maxRadius); }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save(); ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,215,0,${this.life * 0.35})`; ctx.lineWidth = 1.5 * this.life; ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }

  // ─── EFFECT 4: BUBBLE POP 🫧 ───
  class BubbleParticle {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 20; this.y = y + (Math.random() - 0.5) * 20;
      this.radius = 4 + Math.random() * 12; this.originalRadius = this.radius;
      this.life = 1; this.decay = 0.006 + Math.random() * 0.008;
      this.vy = -(0.3 + Math.random() * 1.2); this.vx = (Math.random() - 0.5) * 0.8;
      this.wobbleX = Math.random() * Math.PI * 2; this.wobbleSpeed = 0.03 + Math.random() * 0.05;
      const hues = [[255, 182, 193], [173, 216, 230], [152, 251, 152], [255, 218, 185], [221, 160, 221], [176, 224, 230]];
      this.color = hues[Math.floor(Math.random() * hues.length)];
      this.popTime = 0.1 + Math.random() * 0.08; this.popped = false;
    }
    update() {
      this.x += this.vx + Math.sin(this.wobbleX) * 0.5; this.y += this.vy;
      this.vy *= 0.995; this.life -= this.decay; this.wobbleX += this.wobbleSpeed;
      this.radius = this.originalRadius * Math.min(1, this.life * 1.5);
      if (this.life < this.popTime && !this.popped) this.popped = true;
    }
    draw(ctx) {
      if (this.life <= 0) return;
      const [r, g, b] = this.color;
      if (this.popped) {
        ctx.save(); const a = this.life / this.popTime;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2; const dist = this.originalRadius * (1 - a) * 2;
          ctx.beginPath(); ctx.arc(this.x + Math.cos(ang) * dist, this.y + Math.sin(ang) * dist, 1.5 * a, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.7})`; ctx.fill();
        }
        ctx.restore(); return;
      }
      ctx.save(); const a = Math.min(1, this.life * 1.5) * 0.45;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.35})`; ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.55, Math.PI * 1.1, Math.PI * 1.7);
      ctx.strokeStyle = `rgba(255,255,255,${a * 1.2})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(this.x - this.radius * 0.25, this.y - this.radius * 0.35, this.radius * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 1.5})`; ctx.fill();
      ctx.restore();
    }
  }

  // ─── EFFECT 5: ELECTRIC SHOCK ⚡ ───
  class LightningBolt {
    constructor(x, y) {
      this.x = x; this.y = y; this.life = 1; this.decay = 0.03 + Math.random() * 0.02;
      this.angle = Math.random() * Math.PI * 2; this.length = 25 + Math.random() * 45;
      this.segments = [];
      const steps = 5 + Math.floor(Math.random() * 4);
      let cx = x, cy = y;
      for (let i = 0; i < steps; i++) {
        const sl = this.length / steps;
        const nx = cx + Math.cos(this.angle) * sl + (Math.random() - 0.5) * 18;
        const ny = cy + Math.sin(this.angle) * sl + (Math.random() - 0.5) * 18;
        this.segments.push({ x1: cx, y1: cy, x2: nx, y2: ny }); cx = nx; cy = ny;
      }
      const colors = [[100, 200, 255], [150, 220, 255], [200, 240, 255], [80, 180, 255], [0, 230, 255]];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.width = 1.5 + Math.random() * 2;
    }
    update() { this.life -= this.decay; }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      const a = this.life; const [r, g, b] = this.color;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Outer glow
      ctx.strokeStyle = `rgba(${r},${g},${b},${a * 0.3})`; ctx.lineWidth = this.width * 4 * this.life;
      ctx.beginPath(); this.segments.forEach((s, i) => { if (i === 0) ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }); ctx.stroke();
      // Core bolt
      ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = this.width * this.life;
      ctx.beginPath(); this.segments.forEach((s, i) => { if (i === 0) ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }); ctx.stroke();
      // White hot core
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`; ctx.lineWidth = this.width * 0.4 * this.life;
      ctx.beginPath(); this.segments.forEach((s, i) => { if (i === 0) ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }); ctx.stroke();
      ctx.restore();
    }
  }
  class SparkParticle {
    constructor(x, y) {
      this.x = x; this.y = y;
      const angle = Math.random() * Math.PI * 2; const speed = 1 + Math.random() * 3;
      this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
      this.life = 1; this.decay = 0.02 + Math.random() * 0.025;
      this.trailLength = 3 + Math.floor(Math.random() * 4); this.trail = [];
      this.color = [100 + Math.random() * 155, 200 + Math.random() * 55, 255];
    }
    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.trailLength) this.trail.shift();
      this.x += this.vx; this.y += this.vy; this.vx *= 0.95; this.vy *= 0.95; this.life -= this.decay;
    }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save(); const [r, g, b] = this.color;
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i]; const ta = (i / this.trail.length) * this.life * 0.4;
        ctx.beginPath(); ctx.arc(t.x, t.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${ta})`; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${this.life})`; ctx.fill();
      ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${this.life * 0.3})`; ctx.fill();
      ctx.restore();
    }
  }
  class ElectricRing {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 2; this.maxRadius = 25 + Math.random() * 20; this.life = 1; this.speed = 0.6 + Math.random() * 0.4; this.dashOffset = 0; }
    update() { this.radius += this.speed; this.life = 1 - (this.radius / this.maxRadius); this.dashOffset += 2; }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save(); ctx.setLineDash([4, 6]); ctx.lineDashOffset = this.dashOffset;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100,200,255,${this.life * 0.5})`; ctx.lineWidth = 1.5 * this.life; ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }

  // ─── EFFECT 6: LOVE HEARTS 💖 ───
  class HeartParticle {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 30; this.y = y + (Math.random() - 0.5) * 20;
      this.size = 5 + Math.random() * 10; this.originalSize = this.size;
      this.life = 1; this.decay = 0.008 + Math.random() * 0.01;
      this.vy = -(0.4 + Math.random() * 1.2); this.vx = (Math.random() - 0.5) * 1;
      this.rotation = (Math.random() - 0.5) * 0.5;
      this.rotSpeed = (Math.random() - 0.5) * 0.06;
      this.wobble = Math.random() * Math.PI * 2; this.wobbleSpeed = 0.04 + Math.random() * 0.04;
      const pinks = [[255, 105, 180], [255, 20, 147], [255, 182, 193], [255, 0, 127], [255, 110, 199], [219, 112, 147]];
      this.color = pinks[Math.floor(Math.random() * pinks.length)];
    }
    update() {
      this.x += this.vx + Math.sin(this.wobble) * 0.4; this.y += this.vy;
      this.vy *= 0.998; this.life -= this.decay; this.wobble += this.wobbleSpeed;
      this.size = this.originalSize * this.life; this.rotation += this.rotSpeed;
    }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
      ctx.scale(this.size / 10, this.size / 10);
      const a = this.life * 0.85; const [r, g, b] = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -3); ctx.bezierCurveTo(-5, -10, -14, -5, -7, 3);
      ctx.lineTo(0, 10); ctx.lineTo(7, 3);
      ctx.bezierCurveTo(14, -5, 5, -10, 0, -3);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fill();
      // Shine
      ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`; ctx.fill();
      ctx.restore();
    }
  }
  class HeartTrail {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 2; this.maxRadius = 22 + Math.random() * 15; this.life = 1; this.speed = 0.35 + Math.random() * 0.2; }
    update() { this.radius += this.speed; this.life = 1 - (this.radius / this.maxRadius); }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save(); ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,105,180,${this.life * 0.4})`; ctx.lineWidth = 1.5 * this.life; ctx.stroke(); ctx.restore();
    }
  }

  // ─── EFFECT 7: RAINBOW BURST 🌈 ───
  class RainbowParticle {
    constructor(x, y, index, total) {
      this.x = x; this.y = y;
      const arcAngle = Math.PI + (index / total) * Math.PI; // top semicircle
      const speed = 1 + Math.random() * 2;
      this.vx = Math.cos(arcAngle) * speed; this.vy = Math.sin(arcAngle) * speed;
      this.radius = 3 + Math.random() * 4; this.originalRadius = this.radius;
      this.life = 1; this.decay = 0.008 + Math.random() * 0.01; this.gravity = 0.03;
      // Rainbow colors
      const rainbow = [[255, 0, 0], [255, 127, 0], [255, 255, 0], [0, 200, 0], [0, 100, 255], [75, 0, 130], [148, 0, 211]];
      this.color = rainbow[index % rainbow.length];
      this.trail = []; this.trailMax = 5;
    }
    update() {
      this.trail.push({ x: this.x, y: this.y, life: this.life });
      if (this.trail.length > this.trailMax) this.trail.shift();
      this.vy += this.gravity; this.x += this.vx; this.y += this.vy;
      this.vx *= 0.99; this.life -= this.decay;
      this.radius = this.originalRadius * this.life;
    }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      const [r, g, b] = this.color;
      // Trail
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i]; const ta = (i / this.trail.length) * this.life * 0.3;
        ctx.beginPath(); ctx.arc(t.x, t.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${ta})`; ctx.fill();
      }
      // Main dot
      ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.5, this.radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${this.life * 0.9})`; ctx.fill();
      // White center
      ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${this.life * 0.5})`; ctx.fill();
      ctx.restore();
    }
  }
  class RainbowArc {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 5; this.maxRadius = 40 + Math.random() * 20; this.life = 1; this.speed = 0.5 + Math.random() * 0.3; this.hueOffset = Math.random() * 360; }
    update() { this.radius += this.speed; this.life = 1 - (this.radius / this.maxRadius); }
    // --- AFTER (FIXED) ---
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00C800', '#0064FF', '#4B0082', '#9400D3'];
      for (let i = 0; i < colors.length; i++) {
        // Calculate the ring radius and ensure it is never negative
        const ringRadius = Math.max(0, this.radius - i * 2);

        // Only draw if the radius is actually visible
        if (ringRadius > 0) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, ringRadius, Math.PI, Math.PI * 2);
          ctx.strokeStyle = colors[i];
          ctx.globalAlpha = this.life * 0.4;
          ctx.lineWidth = 2 * this.life;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // ─── EFFECT 8: FAIRY DUST 🧚 ───
  class FairyParticle {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 30; this.y = y + (Math.random() - 0.5) * 30;
      this.size = 1 + Math.random() * 3; this.originalSize = this.size;
      this.life = 1; this.decay = 0.006 + Math.random() * 0.008;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 1.5;
      this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed - 0.5;
      this.gravity = -0.01; // floats up gently
      this.twinkle = Math.random() * Math.PI * 2; this.twinkleSpeed = 0.15 + Math.random() * 0.2;
      this.spiral = Math.random() * Math.PI * 2; this.spiralSpeed = 0.04 + Math.random() * 0.06;
      const magics = [[255, 200, 255], [200, 150, 255], [150, 255, 200], [255, 255, 150], [255, 180, 220], [180, 220, 255], [220, 255, 180]];
      this.color = magics[Math.floor(Math.random() * magics.length)];
      this.trail = []; this.trailMax = 8;
    }
    update() {
      this.trail.push({ x: this.x, y: this.y, s: this.size * this.life });
      if (this.trail.length > this.trailMax) this.trail.shift();
      this.vy += this.gravity;
      this.x += this.vx + Math.sin(this.spiral) * 0.5;
      this.y += this.vy + Math.cos(this.spiral) * 0.3;
      this.vx *= 0.99; this.vy *= 0.99;
      this.life -= this.decay; this.size = this.originalSize * this.life;
      this.twinkle += this.twinkleSpeed; this.spiral += this.spiralSpeed;
    }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      const [r, g, b] = this.color;
      const tw = 0.3 + Math.sin(this.twinkle) * 0.7;
      // Trail (fading sparkle path)
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i]; const ta = (i / this.trail.length) * this.life * 0.25 * tw;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.s * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${ta})`; ctx.fill();
      }
      // Main sparkle
      const a = this.life * tw * 0.9;
      ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.3, this.size), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fill();
      // Tiny cross sparkle
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.6})`; ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x - this.size * 2, this.y); ctx.lineTo(this.x + this.size * 2, this.y);
      ctx.moveTo(this.x, this.y - this.size * 2); ctx.lineTo(this.x, this.y + this.size * 2);
      ctx.stroke();
      // Outer glow
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.12})`; ctx.fill();
      ctx.restore();
    }
  }
  class FairyRing {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 2; this.maxRadius = 25 + Math.random() * 15; this.life = 1; this.speed = 0.3 + Math.random() * 0.2; this.rot = 0; }
    update() { this.radius += this.speed; this.life = 1 - (this.radius / this.maxRadius); this.rot += 0.05; }
    draw(ctx) {
      if (this.life <= 0) return; ctx.save();
      ctx.translate(this.x, this.y); ctx.rotate(this.rot);
      // Dotted sparkle ring
      const dots = 8;
      for (let i = 0; i < dots; i++) {
        const ang = (i / dots) * Math.PI * 2;
        const dx = Math.cos(ang) * this.radius; const dy = Math.sin(ang) * this.radius;
        ctx.beginPath(); ctx.arc(dx, dy, 1.5 * this.life, 0, Math.PI * 2);
        const hue = (i / dots) * 360;
        ctx.fillStyle = `hsla(${hue},100%,80%,${this.life * 0.5})`; ctx.fill();
      }
      ctx.restore();
    }
  }

  // ─── UNIFIED FIRE FUNCTION — spreads across full block width ───
  function fireEffect(blockLeftX, connY, blockWidth) {
    // Helper: random X position along the block's full width
    const randX = () => blockLeftX + Math.random() * blockWidth;
    const centerX = blockLeftX + blockWidth / 2;

    switch (currentEffect) {
      case 'water':
        for (let i = 0; i < 35; i++) splashParticles.push(new WaterParticle(randX(), connY));
        for (let i = 0; i < 5; i++) {
          const rx = blockLeftX + (i / 4) * blockWidth;
          setTimeout(() => splashParticles.push(new WaterRipple(rx, connY)), i * 60);
        }
        playSplashSound('water'); break;
      case 'fire':
        for (let i = 0; i < 30; i++) splashParticles.push(new FireParticle(randX(), connY));
        for (let i = 0; i < 20; i++) splashParticles.push(new EmberParticle(randX(), connY));
        playSplashSound('fire'); break;
      case 'stars':
        for (let i = 0; i < 18; i++) splashParticles.push(new StarParticle(randX(), connY));
        for (let i = 0; i < 4; i++) {
          const rx = blockLeftX + (i / 3) * blockWidth;
          setTimeout(() => splashParticles.push(new StarTrail(rx, connY)), i * 80);
        }
        playSplashSound('stars'); break;
      case 'bubbles':
        for (let i = 0; i < 22; i++) setTimeout(() => splashParticles.push(new BubbleParticle(randX(), connY)), i * 20);
        playSplashSound('bubbles'); break;
      case 'electric':
        for (let i = 0; i < 8; i++) splashParticles.push(new LightningBolt(randX(), connY));
        for (let i = 0; i < 18; i++) splashParticles.push(new SparkParticle(randX(), connY));
        for (let i = 0; i < 4; i++) {
          const rx = blockLeftX + (i / 3) * blockWidth;
          setTimeout(() => splashParticles.push(new ElectricRing(rx, connY)), i * 50);
        }
        setTimeout(() => { for (let i = 0; i < 4; i++)splashParticles.push(new LightningBolt(randX(), connY)); }, 80);
        playSplashSound('electric'); break;
      case 'hearts':
        for (let i = 0; i < 25; i++) splashParticles.push(new HeartParticle(randX(), connY));
        for (let i = 0; i < 4; i++) {
          const rx = blockLeftX + (i / 3) * blockWidth;
          setTimeout(() => splashParticles.push(new HeartTrail(rx, connY)), i * 70);
        }
        playSplashSound('hearts'); break;
      case 'rainbow':
        for (let i = 0; i < 28; i++) splashParticles.push(new RainbowParticle(randX(), connY, i, 28));
        for (let i = 0; i < 3; i++) {
          const rx = blockLeftX + (i / 2) * blockWidth;
          setTimeout(() => splashParticles.push(new RainbowArc(rx, connY)), i * 100);
        }
        playSplashSound('rainbow'); break;
      case 'fairy':
        for (let i = 0; i < 40; i++) setTimeout(() => splashParticles.push(new FairyParticle(randX(), connY)), i * 12);
        for (let i = 0; i < 5; i++) {
          const rx = blockLeftX + (i / 4) * blockWidth;
          setTimeout(() => splashParticles.push(new FairyRing(rx, connY)), i * 80);
        }
        playSplashSound('fairy'); break;
    }
    if (!splashAnimating) { splashAnimating = true; animateSplash(); }
  }

  // Unique sound per effect type
  function playSplashSound(type) {
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator(); const gain = actx.createGain();
      switch (type) {
        case 'water':
          osc.type = 'sine'; osc.frequency.setValueAtTime(800, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.06, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.2);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.2); break;
        case 'fire':
          osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(50, actx.currentTime + 0.25);
          gain.gain.setValueAtTime(0.05, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.3);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.3); break;
        case 'stars':
          osc.type = 'sine'; osc.frequency.setValueAtTime(1200, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(2000, actx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.04, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.15); break;
        case 'bubbles':
          osc.type = 'sine'; osc.frequency.setValueAtTime(400, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, actx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.04, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.12);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.12); break;
        case 'electric':
          osc.type = 'square'; osc.frequency.setValueAtTime(2000, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, actx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.04, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.1);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.1); break;
        case 'hearts':
          osc.type = 'sine'; osc.frequency.setValueAtTime(500, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, actx.currentTime + 0.08);
          osc.frequency.exponentialRampToValueAtTime(600, actx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.05, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.18);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.18); break;
        case 'rainbow':
          osc.type = 'sine'; osc.frequency.setValueAtTime(300, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1200, actx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.04, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.25); break;
        case 'fairy':
          osc.type = 'sine'; osc.frequency.setValueAtTime(1000, actx.currentTime);
          osc.frequency.setValueAtTime(1500, actx.currentTime + 0.05);
          osc.frequency.setValueAtTime(1200, actx.currentTime + 0.1);
          osc.frequency.exponentialRampToValueAtTime(2000, actx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.03, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.2);
          osc.connect(gain).connect(actx.destination); osc.start(); osc.stop(actx.currentTime + 0.2); break;
      }
    } catch (e) { }
  }

  function animateSplash() {
    splashCtx.clearRect(0, 0, splashCanvas.width, splashCanvas.height);
    splashParticles = splashParticles.filter(p => p.life > 0);
    for (const p of splashParticles) { p.update(); p.draw(splashCtx); }
    if (splashParticles.length > 0) { requestAnimationFrame(animateSplash); }
    else { splashAnimating = false; splashCtx.clearRect(0, 0, splashCanvas.width, splashCanvas.height); }
  }

  // =====================================================================
  // BLOCK SNAP TRIGGER — fires selected effect across FULL BLOCK WIDTH
  // =====================================================================
  workspace.addChangeListener((ev) => {
    if (ev.type === Blockly.Events.BLOCK_MOVE && ev.newParentId) {
      const block = workspace.getBlockById(ev.blockId);
      if (!block) return;
      if (block.getSvgRoot()) {
        const svgRoot = block.getSvgRoot();
        svgRoot.classList.add('block-snap-pulse');
        setTimeout(() => svgRoot.classList.remove('block-snap-pulse'), 350);
      }

      // Get the PARENT block (the one we snapped into) to measure its full width
      const parentBlock = workspace.getBlockById(ev.newParentId);
      let connection = null;
      if (block.previousConnection && block.previousConnection.isConnected()) connection = block.previousConnection;
      else if (block.outputConnection && block.outputConnection.isConnected()) connection = block.outputConnection;

      if (connection) {
        const ctm = workspace.getCanvas().getScreenCTM();
        const connY = (connection.y * ctm.d) + ctm.f;

        // Get the wider block's bounding box to spread effect across full width
        const targetBlock = parentBlock || block;
        const svgEl = targetBlock.getSvgRoot();
        let blockLeftX, blockWidth;

        if (svgEl) {
          const bbox = svgEl.getBoundingClientRect();
          blockLeftX = bbox.left;
          blockWidth = bbox.width;
        } else {
          // Fallback: use connection point with default width
          blockLeftX = (connection.x * ctm.a) + ctm.e - 60;
          blockWidth = 120;
        }

        // Fire effect across the full block width
        fireEffect(blockLeftX, connY, blockWidth);
      }
    }
  });

  // CurioSounds listeners already registered above with userInteracted guard.
  // Duplicate block removed — it was firing sounds twice AND calling
  // `audio.play("error")` which is undefined here, crashing the start() function
  // on mobile and preventing the workspace from ever rendering.

  const pyOut = document.getElementById('pyOut');
  function updateCode(event) {
    if (event && event.workspaceId && event.workspaceId !== workspace.id) {
      return;
    }
    const code = pyGen.workspaceToCode(workspace);
    pyOut.textContent = code || '# (no blocks yet)';
    try { window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'py_preview', code })); } catch (e) { }

    // If workspace is modified, revert Upload success state back to normal Upload button
    const imgUpload = document.getElementById('imgUpload');
    if (imgUpload && imgUpload.src.includes('uploaded.svg')) {
      imgUpload.src = 'icons/upload.svg';
    }
  }
  workspace.addChangeListener(updateCode);
  updateCode();

  // ═══════════════════════════════════════════════════════════════════════
  // MULTIPLE START BLOCKS ALLOWED
  // (Single Start block enforcement removed per user request)

  // ═══════════════════════════════════════════════════════════════════════
  // LIVE MODE ENGINE — init
  // ═══════════════════════════════════════════════════════════════════════
  LiveModeEngine.init(workspace);

  // Register the workspace change listener for live commands
  workspace.addChangeListener(ev => LiveModeEngine.onWorkspaceChange(ev));

  // REDESIGNED TERMINAL: Initialize UI scan and hook change listener
  updateSensorsAndVariablesUI();
  workspace.addChangeListener(() => updateSensorsAndVariablesUI());

  // Wire the ⚡ toggle button
  const _liveModeBtn = document.getElementById('btnLiveMode');
  if (_liveModeBtn) {
    _liveModeBtn.addEventListener('click', () => LiveModeEngine.toggle());
  }

  // Optional: connect a dedicated MQTT live channel (separate from upload channel).
  // Un-comment and customise credentials to enable MQTT Live Mode:
  // LiveModeEngine.Transport.initMQTT(
  //   'wss://3921b8461cb747b593a333f2aced8435.s1.eu.hivemq.cloud:8884/mqtt',
  //   { username: 'ESP32', password: 'Esp@12345' }
  // );
  // ═══════════════════════════════════════════════════════════════════════

  // ── Button Handlers ──

  // PLAY (hidden legacy button kept for withOpLock compatibility)
  const _playmode = document.getElementById("playmode");
  if (_playmode) _playmode.onclick = async () => {
    await withOpLock("playmode", async () => {
      await sendUnifiedCommand("PLAY");
    });
  };

  // STOP (hidden legacy button)
  const _stop = document.getElementById("stop");
  if (_stop) _stop.onclick = async () => {
    await withOpLock("stop", async () => {
      await sendUnifiedCommand("STOP");
    });
  };

  // SOFT RESET
  const _soft_reset = document.getElementById("soft_reset");
  if (_soft_reset) _soft_reset.onclick = async () => {
    await withOpLock("soft_reset", async () => {
      const ok = await sendUnifiedCommand("SOFT_RESET");
      if (ok) handleBoardMessage("Soft Reset triggered", "SYS");
    });
  };

  // HARD RESET
  const _hard_reset = document.getElementById("hard_reset");
  if (_hard_reset) _hard_reset.onclick = async () => {
    await withOpLock("hard_reset", async () => {
      const ok = await sendUnifiedCommand("HARD_RESET");
      if (ok) handleBoardMessage("Hardware Rebooting…", "SYS");
    });
  };

  // ── NEW ACTION BAR BUTTONS ──

  // Helper: swap between Run and Stop UI states
  function setRunning(isRunning) {
    const runBtn = document.getElementById("btnRun");
    const stopBtn = document.getElementById("btnStop");
    if (!runBtn || !stopBtn) return;
    runBtn.style.display = isRunning ? "none" : "flex";
    stopBtn.style.display = isRunning ? "flex" : "none";
  }

  // RUN button - fire PLAY command, flip to Stop only if board is connected and command succeeds
  const _btnRun = document.getElementById("btnRun");
  if (_btnRun) _btnRun.onclick = async () => {
    await withOpLock("btnRun", async () => {
      try {
        const success = await sendUnifiedCommand("PLAY");
        if (success) {
          setRunning(true);
        }
      } catch (e) {
        console.error("Error starting program:", e);
      }
    });
  };

  // STOP button — send STOP, then flip back to Run
  const _btnStop = document.getElementById("btnStop");
  if (_btnStop) _btnStop.onclick = async () => {
    await withOpLock("btnStop", async () => {
      try {
        await sendUnifiedCommand("STOP");
      } catch (e) { /* ignore */ }
      setRunning(false);  // always revert to Run after Stop
    });
  };

  // LIVE button → toggles live mode
  const _btnLive = document.getElementById("btnLive");
  if (_btnLive) _btnLive.onclick = () => {
    const liveModeBtn = document.getElementById("btnLiveMode");
    if (liveModeBtn) liveModeBtn.click();
  };

  // BLUETOOTH button – open scan popup
  const _btnBluetooth = document.getElementById("btnBluetooth");
  if (_btnBluetooth) _btnBluetooth.onclick = () => {
    openBT();
  };

  // UPLOAD button (new action bar)
  const _btnUpload = document.getElementById("btnUpload");
  if (_btnUpload) _btnUpload.onclick = async () => {
    await withOpLock("upload", async () => {
      const code = pyGen.workspaceToCode(workspace);
      if (!code.trim()) { alert("Please drag some blocks first!"); return; }

      // Auto-stop before upload
      try {
        await sendUnifiedCommand("STOP");
        if (typeof setRunning === 'function') setRunning(false);
        // Wait for the board to process the KeyboardInterrupt and return to REPL
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { /* ignore */ }

      const asyncCode = wrapWithAsyncio(code);
      if (isMobileApp()) {
        handleBoardMessage("Uploading via Bluetooth…", "SYS");
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "SEND_DATA", data: asyncCode }));
        // Set successful Uploaded icon after a small delay
        setTimeout(() => {
          setUploadedSuccess();
        }, 1200);
        return;
      }
      await unifiedUploadCode(asyncCode);
    });
  };
  // Wraps all Blockly-generated Python in uasyncio so every action inside
  // an if/while block fires SIMULTANEOUSLY — fan + light + servo all at once.
  // Without this, MicroPython runs each line one by one (sequential).
  function wrapWithAsyncio(rawCode) {
    // reg['start'] generates: async def start(): ...body... / start()
    // main.py detects coroutine → asyncio.run(). No extra wrapper needed.
    return rawCode || '';
  }

  // UPLOAD button
  const _upload = document.getElementById("upload");
  if (_upload) _upload.onclick = async () => {
    await withOpLock("upload", async () => {
      const code = pyGen.workspaceToCode(workspace);
      if (!code.trim()) { alert("Please drag some blocks first!"); return; }

      // Auto-stop before upload
      try {
        await sendUnifiedCommand("STOP");
        if (typeof setRunning === 'function') setRunning(false);
        // Wait for the board to process the KeyboardInterrupt and return to REPL
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { /* ignore */ }

      const asyncCode = wrapWithAsyncio(code);

      if (isMobileApp()) {
        // Mobile: hand off to App.js via bridge
        handleBoardMessage("Uploading via Bluetooth…", "SYS");
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "SEND_DATA", data: asyncCode }));
        // Set successful Uploaded icon after a small delay
        setTimeout(() => {
          setUploadedSuccess();
        }, 1200);
        return;
      }

      // Desktop: unified upload (USB or BLE)
      await unifiedUploadCode(asyncCode);
    });
  };

  // BOOT (save user.py via USB)
  document.getElementById('btnboot').onclick = async () => {
    const code = pyGen.workspaceToCode(workspace);
    if (stm32Port && stm32Writer) {
      await unifiedUploadCode(wrapWithAsyncio(code));
    } else {
      alert("USB not connected.");
    }
  };

  // SAVE (download project as JSON)
  document.getElementById('btnSave').onclick = async () => {
    const code = pyGen.workspaceToCode(workspace);
    if (!code.trim()) { alert("No code to save"); return; }
    const data = JSON.stringify(prepareSaveData(), null, 2);

    if (isMobileApp()) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "SAVE_FILE",
        fileName: "program.json",
        content: data
      }));
      return;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'program.json'; a.click();
    URL.revokeObjectURL(a.href);
  };

  // LOAD
  document.getElementById('btnLoad').onclick = async () => {
    if (isMobileApp()) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "LOAD_FILE" }));
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,.xml,application/json,text/xml';
    inp.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const t = await file.text();
      loadXml(t);
    };
    inp.click();
  };

  function loadXml(text) {
    if (!text) return;
    workspace.clear();
    resetToolboxAndAIClasses();
    const trimmed = text.trim();
    try {
      if (trimmed.startsWith('{')) {
        // v12 JSON format
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.workspaceState) {
          if (parsed.aiTrainedClasses) {
            applyAIClasses(parsed.aiTrainedClasses, parsed.aiTrainedBoard);
            try { sessionStorage.setItem('curio_ai_trained', JSON.stringify(parsed.aiTrainedClasses)); } catch (e) { }
          }
          if (parsed.voiceTrainedClasses) {
            applyVoiceClasses(parsed.voiceTrainedClasses);
            try { sessionStorage.setItem('curio_voice_trained', JSON.stringify(parsed.voiceTrainedClasses)); } catch (e) { }
          }
          if (parsed.poseTrainedClasses) {
            applyPoseClasses(parsed.poseTrainedClasses);
            try { sessionStorage.setItem('curio_pose_trained', JSON.stringify(parsed.poseTrainedClasses)); } catch (e) { }
          }
          Blockly.serialization.workspaces.load(parsed.workspaceState, workspace);
        } else {
          Blockly.serialization.workspaces.load(parsed, workspace);
        }
      } else if (trimmed.startsWith('<')) {
        // Legacy XML format — backward compatibility
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(trimmed), workspace);
      }
    } catch (e) { console.error("loadXml failed:", e); }
  }
  window.loadXml = loadXml;

  // ========== FILE MENU / STORAGE LOGIC ==========

  const StorageLayer = {
    saveLocal: (name, xmlData) => {
      try {
        localStorage.setItem('blockly_project_' + name, xmlData);
        localStorage.setItem('blockly_last_project', name);
        return true;
      } catch (e) { console.error("Storage error:", e); return false; }
    },
    loadLocal: (name) => {
      return localStorage.getItem('blockly_project_' + name);
    },
    deleteLocal: (name) => {
      localStorage.removeItem('blockly_project_' + name);
      const last = localStorage.getItem('blockly_last_project');
      if (last === name) localStorage.removeItem('blockly_last_project');
    },
    listProjects: () => {
      return Object.keys(localStorage)
        .filter(k => k.startsWith('blockly_project_'))
        .map(k => k.replace('blockly_project_', ''));
    }
  };

  let _autoSaveTimer = null;

  const ProjectManager = {
    init: () => {
      // ── Project Switcher (file pill) ──
      const _fileBtn = document.getElementById('fileMenuBtn');
      const _projDD = document.getElementById('projSwitcherDropdown');

      function renderProjSwitcher() {
        const list = document.getElementById('projSwitcherList');
        const countEl = document.getElementById('projCountLabel');
        const pillLabel = document.getElementById('projPillLabel');
        const projects = StorageLayer.listProjects();
        const current = document.getElementById('projectNameInput')?.value || 'Untitled';

        countEl.textContent = projects.length + ' File' + (projects.length !== 1 ? 's' : '');
        pillLabel.textContent = projects.length + ' File' + (projects.length !== 1 ? 's' : '');

        list.innerHTML = '';
        if (projects.length === 0) {
          list.innerHTML = '<div style="padding:10px 14px;color:#94a3b8;font-size:13px">No saved files yet</div>';
          return;
        }
        projects.forEach(name => {
          const item = document.createElement('div');
          item.className = 'proj-tab-item' + (name === current ? ' active' : '');
          item.innerHTML = `
                ${name === current ? '<span class="proj-active-dot"></span>' : '<span style="width:7px;flex-shrink:0"></span>'}
                <span class="proj-tab-name">${name}</span>
                <button class="proj-tab-close" title="Remove file" data-name="${name}">✕</button>
              `;
          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('proj-tab-close')) {
              e.stopPropagation();
              const n = e.target.dataset.name;
              if (confirm('Remove "' + n + '" from saved files?')) {
                ProjectManager.deleteProject(n);
                renderProjSwitcher();
              }
              return;
            }
            ProjectManager.switchToProject(name);
            _projDD.classList.remove('open');
          });
          list.appendChild(item);
        });
      }

      _fileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        renderProjSwitcher();
        _projDD.classList.toggle('open');
      });

      document.getElementById('projNewFileBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        _projDD.classList.remove('open');
        ProjectManager.newProject();
      });

      document.addEventListener('click', (e) => {
        if (!_projDD.contains(e.target) && e.target !== _fileBtn) {
          _projDD.classList.remove('open');
        }
      });

      // Update pill label when projects change (hook into renderTabs)
      const _origRenderTabs = ProjectManager.renderTabs.bind(ProjectManager);
      ProjectManager.renderTabs = function () {
        _origRenderTabs();
        const projects = StorageLayer.listProjects();
        const pillLabel = document.getElementById('projPillLabel');
        if (pillLabel) pillLabel.textContent = projects.length + ' File' + (projects.length !== 1 ? 's' : '');
      };

      // Old dropdown wiring (kept functional for logo dropdown etc.)
      document.getElementById('menuNewProject').onclick = ProjectManager.newProject;
      document.getElementById('menuDownloadXml').onclick = ProjectManager.downloadXml;
      document.getElementById('menuUploadXml').onclick = ProjectManager.uploadXml;

      // ── File-ops pill (right of name input) ──
      const _fileOpsBtn = document.getElementById('fileOpsPillBtn');
      const _fileOpsDD = document.getElementById('fileOpsPillDropdown');
      _fileOpsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _projDD.classList.remove('open');
        _fileOpsDD.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!_fileOpsDD.contains(e.target) && e.target !== _fileOpsBtn) {
          _fileOpsDD.classList.remove('open');
        }
      });

      // also close old dropdown on outside click (keep it working if directly triggered)
      document.addEventListener('click', () => {
        const dropdown = document.getElementById('fileMenuDropdown');
        if (dropdown && !dropdown.classList.contains('hidden')) {
          dropdown.classList.add('hidden');
        }
      });

      // ── Logo dropdown (CURIO LABS click → save/load) ──
      const _logoBtn = document.getElementById('logoBtn');
      const _logoDD = document.getElementById('logoSaveDropdown');
      _logoBtn.addEventListener('click', (e) => { e.stopPropagation(); _logoDD.classList.toggle('open'); });
      document.addEventListener('click', (e) => { if (!_logoDD.contains(e.target) && e.target !== _logoBtn) _logoDD.classList.remove('open'); });
      document.getElementById('logoNewProject').onclick = () => { _logoDD.classList.remove('open'); ProjectManager.newProject(); };
      document.getElementById('logoSaveProgram').onclick = () => { _logoDD.classList.remove('open'); ProjectManager.downloadXml(); };
      document.getElementById('logoDownloadXml').onclick = () => { _logoDD.classList.remove('open'); ProjectManager.downloadXml(); };
      document.getElementById('logoUploadXml').onclick = () => { _logoDD.classList.remove('open'); ProjectManager.uploadXml(); };
      // ─────────────────────────────────────────────────

      // Auto-save whenever workspace changes (debounced)
      workspace.addChangeListener((ev) => {
        if (ev.isUiEvent) return; // skip UI-only events
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(() => {
          ProjectManager.autoSave();
        }, 800);
      });

      // Also auto-save when project name changes
      document.getElementById('projectNameInput').addEventListener('change', () => {
        ProjectManager.autoSave();
        ProjectManager.renderTabs();
      });

      // Attempt to load last worked on project
      const lastProject = localStorage.getItem('blockly_last_project');
      if (lastProject) {
        const xml = StorageLayer.loadLocal(lastProject);
        if (xml) {
          document.getElementById('projectNameInput').value = lastProject;
          setTimeout(() => {
            ProjectManager.loadContent(xml);
            ProjectManager.renderTabs();
          }, 300);
        }
      }

      // Render tabs on init
      setTimeout(() => ProjectManager.renderTabs(), 500);
    },

    /** Silently auto-save current workspace to localStorage */
    autoSave: () => {
      try {
        const name = document.getElementById('projectNameInput').value.trim() || 'Untitled';
        StorageLayer.saveLocal(name, JSON.stringify(prepareSaveData()));
      } catch (e) { console.warn('Auto-save failed:', e); }
    },

    newProject: () => {
      // Auto-save current project before creating a new one
      ProjectManager.autoSave();

      // Generate a unique project name
      const existing = StorageLayer.listProjects();
      let newName = 'Untitled';
      let counter = 1;
      while (existing.includes(newName)) {
        newName = 'Untitled ' + counter;
        counter++;
      }

      workspace.clear();
      resetToolboxAndAIClasses();
      document.getElementById('projectNameInput').value = newName;

      // v12: load default start block via JSON serialization API
      Blockly.serialization.workspaces.load({
        blocks: {
          languageVersion: 0,
          blocks: [{ type: "start", x: 40, y: 40, deletable: false }]
        }
      }, workspace);

      // Save the new project immediately so it appears in tabs
      ProjectManager.autoSave();
      ProjectManager.renderTabs();

      // Close the dropdown menu
      document.getElementById('fileMenuDropdown').classList.add('hidden');
    },

    saveProject: () => {
      const data = JSON.stringify(prepareSaveData());
      const name = document.getElementById('projectNameInput').value.trim() || "Untitled";

      if (StorageLayer.saveLocal(name, data)) {
        if (isMobileApp()) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "SAVE_CLOUD", name, data }));
        }
        ProjectManager.renderTabs();
      }
    },

    /** Render clickable project tabs next to the input */
    renderTabs: () => {
      const tabsContainer = document.getElementById('projectTabs');
      if (!tabsContainer) return;
      tabsContainer.innerHTML = '';

      const projects = StorageLayer.listProjects();
      const currentName = document.getElementById('projectNameInput').value.trim();

      projects.forEach(name => {
        const tab = document.createElement('div');
        tab.className = 'project-tab' + (name === currentName ? ' active' : '');

        const label = document.createElement('span');
        label.textContent = name;
        label.onclick = (e) => {
          e.stopPropagation();
          ProjectManager.switchToProject(name);
          // Close dropdown after switching
          tabsContainer.classList.remove('open');
          const toggle = document.getElementById('projectTabsToggle');
          if (toggle) toggle.classList.remove('open');
        };
        tab.appendChild(label);

        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Delete project';
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          ProjectManager.deleteProject(name);
        };
        tab.appendChild(closeBtn);

        tabsContainer.appendChild(tab);
      });

      // Update toggle button label with count
      const countEl = document.getElementById('projectTabsCount');
      if (countEl) {
        countEl.textContent = projects.length > 0
          ? projects.length + ' Project' + (projects.length !== 1 ? 's' : '')
          : 'Projects';
      }
    },

    /** Switch to a different saved project */
    switchToProject: (name) => {
      // Auto-save current before switching
      ProjectManager.autoSave();

      const xml = StorageLayer.loadLocal(name);
      if (xml) {
        document.getElementById('projectNameInput').value = name;
        ProjectManager.loadContent(xml);
        localStorage.setItem('blockly_last_project', name);
        ProjectManager.renderTabs();
      }
    },

    /** Delete a project from localStorage */
    deleteProject: (name) => {
      const currentName = document.getElementById('projectNameInput').value.trim();
      if (name === currentName) {
        if (!confirm(`Delete the active project "${name}"? This will clear the workspace.`)) return;
        StorageLayer.deleteLocal(name);
        workspace.clear();
        resetToolboxAndAIClasses();
        document.getElementById('projectNameInput').value = 'Untitled';
        // v12: JSON serialization replaces deprecated Blockly.Xml.domToWorkspace()
        Blockly.serialization.workspaces.load({
          blocks: {
            languageVersion: 0,
            blocks: [{ type: "start", x: 40, y: 40, deletable: false }]
          }
        }, workspace);
        ProjectManager.autoSave();
      } else {
        if (!confirm(`Delete project "${name}"?`)) return;
        StorageLayer.deleteLocal(name);
      }
      ProjectManager.renderTabs();
    },

    loadProjectPrompt: () => {
      const projects = StorageLayer.listProjects();
      if (projects.length === 0) {
        alert("No saved projects found on this device.");
        return;
      }
      const name = prompt("Saved Local Projects:\n" + projects.join("\n") + "\n\nType the exact project name to load:");
      if (name && projects.includes(name)) {
        ProjectManager.switchToProject(name);
      } else if (name) {
        alert("Project not found.");
      }
    },

    downloadXml: () => {
      const data = JSON.stringify(prepareSaveData(), null, 2);
      const name = document.getElementById('projectNameInput').value.trim() || "Untitled";

      if (isMobileApp()) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "SAVE_FILE",
          fileName: name + ".json",
          content: data
        }));
        return;
      }

      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      a.download = name + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    },

    uploadXml: async () => {
      if (isMobileApp()) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "LOAD_FILE" }));
        return;
      }

      // Modern File System Access API (Chrome/Edge)
      if (window.showOpenFilePicker) {
        try {
          const handles = await showOpenFilePicker({
            // v12: accept both new JSON and legacy XML project files
            types: [
              { description: 'Blockly Project (JSON)', accept: { 'application/json': ['.json'] } },
              { description: 'Blockly Project (XML)', accept: { 'text/xml': ['.xml'] } },
            ]
          });
          if (handles && handles.length > 0) {
            const f = handles[0];
            const text = await (await f.getFile()).text();
            document.getElementById('projectNameInput').value = f.name.replace(/\.(json|xml)$/i, '');
            ProjectManager.loadContent(text);
            ProjectManager.autoSave();
            ProjectManager.renderTabs();
          }
        } catch (e) {
          if (e.name !== 'AbortError') console.error("File picker error:", e);
        }
        return;
      }

      // Fallback for Firefox / Safari / older browsers
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,.xml,application/json,text/xml';
      inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const t = await file.text();
        document.getElementById('projectNameInput').value = file.name.replace(/\.(json|xml)$/i, '');
        ProjectManager.loadContent(t);
        ProjectManager.autoSave();
        ProjectManager.renderTabs();
      };
      inp.click();
    },

    loadContent: (text) => {
      if (!text) return;
      workspace.clear();
      resetToolboxAndAIClasses();
      try {
        const trimmed = text.trim();
        if (trimmed.startsWith('{')) {
          // v12 JSON format — new serialization API
          const parsed = JSON.parse(trimmed);
          if (parsed && parsed.workspaceState) {
            if (parsed.aiTrainedClasses) {
              applyAIClasses(parsed.aiTrainedClasses, parsed.aiTrainedBoard);
              try { sessionStorage.setItem('curio_ai_trained', JSON.stringify(parsed.aiTrainedClasses)); } catch (e) { }
            }
            if (parsed.voiceTrainedClasses) {
              applyVoiceClasses(parsed.voiceTrainedClasses);
              try { sessionStorage.setItem('curio_voice_trained', JSON.stringify(parsed.voiceTrainedClasses)); } catch (e) { }
            }
            if (parsed.poseTrainedClasses) {
              applyPoseClasses(parsed.poseTrainedClasses);
              try { sessionStorage.setItem('curio_pose_trained', JSON.stringify(parsed.poseTrainedClasses)); } catch (e) { }
            }
            Blockly.serialization.workspaces.load(parsed.workspaceState, workspace);
          } else {
            Blockly.serialization.workspaces.load(parsed, workspace);
          }
        } else if (trimmed.startsWith('<')) {
          // Legacy XML format (v10 files) — backward compatibility
          Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(trimmed), workspace);
        }
      } catch (e) { console.error("Failed to load project:", e); }

      // Guarantee the undeletable start block is always present
      if (workspace.getAllBlocks().length === 0) {
        Blockly.serialization.workspaces.load({
          blocks: {
            languageVersion: 0,
            blocks: [{ type: "start", x: 40, y: 40, deletable: false }]
          }
        }, workspace);
      }
    }
  };

  ProjectManager.init();

  // CLEAR
  document.getElementById('btnClear').onclick = () => {
    workspace.clear();
    resetToolboxAndAIClasses();
    Blockly.serialization.workspaces.load({
      blocks: {
        languageVersion: 0,
        blocks: [{ type: "start", x: 40, y: 40, deletable: false }]
      }
    }, workspace);
    updateCode();
  };

  // UNDO
  document.getElementById('btnUndo').onclick = () => { workspace.undo(false); };

  // REDO
  document.getElementById('btnRedo').onclick = () => { workspace.undo(true); };

  // -------------setting slide-------------
  const setting = document.getElementById("setting");
  const close = document.getElementById('close');
  const slide = document.getElementById("slide-setting");

  // Create a backdrop element to close the panel when tapping outside
  const backdrop = document.createElement('div');
  backdrop.id = 'setting-backdrop';
  backdrop.style.cssText = [
    'display:none',
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:99998',
    'background:rgba(0,0,0,0.25)',
    'cursor:pointer'           /* visual hint: click to dismiss */
  ].join(';');
  // Append inside .app so backdrop shares the same stacking context
  // as .setting-slide (z-index 99999 > 99998 now works correctly).
  (document.querySelector('.app') || document.body).appendChild(backdrop);

  function openSettings() {
    slide.style.right = "0%";
    backdrop.style.display = 'block';
  }

  function closeSettings() {
    slide.style.right = "-100%";
    backdrop.style.display = 'none';
  }

  setting.addEventListener("click", openSettings);
  close.addEventListener("click", closeSettings);
  backdrop.addEventListener("click", closeSettings);
  // ESC key closes settings
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });

  // ------------- Dark Mode & Full Screen Handlers -------------
  const darkModeToggle = document.getElementById('toggle-35');
  const fullScreenToggle = document.getElementById('toggle-36');

  // Load saved state
  const isDarkMode = localStorage.getItem('dark_mode_enabled') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('dark_mode_enabled', 'true');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('dark_mode_enabled', 'false');
      }
      window.dispatchEvent(new Event('theme-changed'));
    });
  }

  if (fullScreenToggle) {
    fullScreenToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.log(err));
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      fullScreenToggle.checked = !!document.fullscreenElement;
    });
  }

  // SHOW/HIDE CODE PANEL
  const showCode = document.getElementById("showCode");
  const codePanel = document.querySelector(".code");
  const mainSection = document.querySelector(".main");
  showCode.addEventListener("click", function () {
    codePanel.classList.toggle("show");
    mainSection.classList.toggle("main1");

    // Resize Blockly SVG multiple times as layout transitions and settles
    [0, 50, 150, 300, 600, 1000, 2000].forEach(delay => {
      setTimeout(() => {
        if (workspace) {
          Blockly.svgResize(workspace);
          workspace.scrollCenter();
        }
        positionActionBar();   // re-center bar after panel toggle
      }, delay);
    });
  });

  // ── positionActionBar ──────────────────────────────────────────────────
  // Bar is position:fixed so left values are viewport-relative.
  // We center it over the visible block workspace editing area (excluding the category toolbox sidebar).
  function positionActionBar() {
    const bar = document.getElementById('bottomActionBar');
    const mainSection = document.querySelector('.main');
    if (!bar) return;

    if (mainSection && mainSection.classList.contains('main1')) {
      // Code panel is hidden -> workspace takes full width
      bar.style.left = '57%';
    } else {
      // Code panel is visible -> center over workspace (80% of main)
      bar.style.left = '43%';
    }
    bar.style.transform = 'translateX(-50%)';
    bar.style.right = 'auto';
  }

  // Run once on init and whenever the layout changes
  // Use rAF to ensure the layout is fully painted before measuring
  requestAnimationFrame(() => {
    positionActionBar();
    // Second pass for any late-rendered elements
    setTimeout(positionActionBar, 200);
  });

  // Watch for workspace resize (e.g. window resize, panel toggling)
  if (typeof ResizeObserver !== 'undefined') {
    const _barObserver = new ResizeObserver(() => positionActionBar());
    const wsEl = document.querySelector('.workspace');
    if (wsEl) _barObserver.observe(wsEl);
    _barObserver.observe(document.body);
  }
  window.addEventListener('resize', positionActionBar);

  // Default starting block — v12 JSON serialization API
  Blockly.serialization.workspaces.load({
    blocks: {
      languageVersion: 0,
      blocks: [{ type: "start", x: 40, y: 40 }]
    }
  }, workspace);
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE MODE ENGINE  v1.0  — rndmfg Blockly
// Real-Time Hardware Feedback without full code upload.
//
// Packet wire format:
//   LIVE:{"cmd":"live","id":"<blockId>","ts":<epoch>,"type":"<hw>",...}\n
//
// Transport priority: USB Serial → BLE → React Native → MQTT
// ═══════════════════════════════════════════════════════════════════════════
const LiveModeEngine = (() => {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  const DEBOUNCE_NUMBER_MS = 120;   // slider / number fields
  const DEBOUNCE_DROPDOWN_MS = 60;   // dropdown fields
  const BLE_MAX_CHUNK = 512;   // max BLE write bytes per call
  const LIVE_PREFIX = 'LIVE:';

  // ── Block Registry ──────────────────────────────────────────────────────
  // Maps block type → extractor(block) → hardware payload object.
  // Return null from an extractor to suppress the command for that block.
  // Set the value to null (not a function) to silently skip that type.
  const LIVE_BLOCK_REGISTRY = {

    // ── Servo ────────────────────────────────────────────────────────────
    do_servo(block) {
      return {
        type: 'servo',
        port: block.getFieldValue('SERVO_PORT') || '',
        val: Math.min(360, Math.max(0, parseFloat(block.getFieldValue('ANG')) || 0)),
      };
    },

    // ── DC Motors ────────────────────────────────────────────────────────
    bike_model(block) { return { type: 'motor', speed: parseInt(block.getFieldValue('BIKE_SPEED'), 10) || 0 }; },
    do_dc_motor(block) {
      return {
        type: 'motor',
        motors: block.getFieldValue('MOTORS') || '',
        speed: parseInt(block.getFieldValue('SPEED'), 10) || 0,
        dir: block.getFieldValue('STATE') || 'forward',
      };
    },
    do_dc_motor2(block) {
      return {
        type: 'motor',
        motors: block.getFieldValue('MOTORS') || '',
        speed: 100,
        dir: block.getFieldValue('STATE') || 'forward',
      };
    },
    motor_driver(block) {
      return { type: 'motor', motors: block.getFieldValue('MOTORS') || '', speed: parseInt(block.getFieldValue('SPEED'), 10) || 0, dir: block.getFieldValue('STATE') || 'forward' };
    },
    steper(block) {
      return { type: 'stepper', ports: block.getFieldValue('PORTS') || '', steps: parseInt(block.getFieldValue('STEPS'), 10) || 0, dir: block.getFieldValue('DIR') || 'cw' };
    },

    // ── LEDs ─────────────────────────────────────────────────────────────
    do_led(block) {
      return { type: 'led', ports: block.getFieldValue('PORTS') || '', state: block.getFieldValue('STATE') || '0' };
    },
    do_led_param(block) {
      return { type: 'led_pwm', ports: block.getFieldValue('PORTS') || '', val: parseInt(block.getFieldValue('VAL'), 10) || 0, val2: parseInt(block.getFieldValue('VAL2'), 10) || 0 };
    },
    red_led(block) {
      const v = Math.min(255, Math.round((parseInt(block.getFieldValue('VAL1'), 10) || 0) * 2.55));
      return { type: 'rgb', ports: block.getFieldValue('PORTS') || '', r: v, g: 0, b: 0 };
    },
    yellow_led(block) {
      const v = Math.min(255, Math.round((parseInt(block.getFieldValue('VAL1'), 10) || 100) * 2.55));
      return { type: 'rgb', ports: block.getFieldValue('PORTS') || '', r: v, g: v, b: 0 };
    },
    green_led(block) {
      const v = Math.min(255, Math.round((parseInt(block.getFieldValue('VAL1'), 10) || 100) * 2.55));
      return { type: 'rgb', ports: block.getFieldValue('PORTS') || '', r: 0, g: v, b: 0 };
    },

    // ── RGB ──────────────────────────────────────────────────────────────
    rgb_display(block) {
      return { type: 'rgb', r: Math.min(255, parseInt(block.getFieldValue('R'), 10) || 0), g: Math.min(255, parseInt(block.getFieldValue('G'), 10) || 0), b: Math.min(255, parseInt(block.getFieldValue('B'), 10) || 0) };
    },
    rgb_led_display(block) {
      return { type: 'rgb', r: Math.min(255, parseInt(block.getFieldValue('R'), 10) || 0), g: Math.min(255, parseInt(block.getFieldValue('G'), 10) || 0), b: Math.min(255, parseInt(block.getFieldValue('B'), 10) || 0) };
    },
    rgb_component(block) {
      return { type: 'rgb_ch', component: block.getFieldValue('COLOR') || 'R', val: Math.min(255, parseInt(block.getFieldValue('VAL'), 10) || 0) };
    },

    // ── Digital pins ─────────────────────────────────────────────────────
    do_onoff(block) {
      return { type: 'digital', ports: block.getFieldValue('PORTS') || '', state: block.getFieldValue('STATE') || '0' };
    },
    port_on(block) { return { type: 'digital', ports: block.getFieldValue('PORTS') || '', state: '1' }; },
    port_off(block) { return { type: 'digital', ports: block.getFieldValue('PORTS') || '', state: '0' }; },
  };

  // ── Non-Live Types ───────────────────────────────────────────────────────
  // These block types are silently skipped — they have no instantaneous
  // hardware output or their output depends on runtime program state.
  const NON_LIVE_TYPES = new Set([
    'start', 'ctl_delay',
    'controls_if', 'controls_ifelse', 'controls_repeat_ext', 'controls_for',
    'controls_forEach', 'controls_while', 'controls_whileUntil', 'controls_flow_statements',
    'logic_compare', 'logic_operation', 'logic_boolean', 'logic_negate', 'logic_ternary',
    'variables_set', 'variables_get',
    'math_number', 'math_arithmetic', 'math_random_int', 'math_random_float',
    'math_trigonometry', 'math_on_list', 'math_constrain', 'math_modulo',
    'math_round', 'math_single',
    'text', 'text_join', 'text_print', 'text_length', 'text_isEmpty',
    'text_indexOf', 'text_charAt', 'text_getSubstring', 'text_changeCase',
    'text_trim', 'text_count', 'text_replace', 'text_reverse',
    'procedures_defnoreturn', 'procedures_callnoreturn',
    'procedures_defreturn', 'procedures_callreturn',
    'sen_ultrasonic', 'sen_temp', 'sen_ir', 'sen_colour', 'sen_sound',
    'bt_send',
    'list_add', 'list_remove', 'list_delete_all', 'list_insert',
    'list_set', 'list_get', 'list_indexOf', 'list_length', 'list_contains', 'list_show',
    'sim_solar', 'sim_pendulum', 'sim_particles', 'sim_dna', 'sim_gears',
    'sim_wave', 'sim_bouncing', 'sim_windmill', 'sim_atom', 'sim_globe',
  ]);

  // ── State ────────────────────────────────────────────────────────────────
  let _enabled = false;
  let _workspace = null;
  let _debounceMap = {};
  let _lastPackets = {};
  let _mqttLive = null;

  // ── Transport Layer ──────────────────────────────────────────────────────
  const Transport = {
    isConnected() {
      if (typeof stm32Writer !== 'undefined' && stm32Writer) return true;
      if (typeof bleControlChar !== 'undefined' && bleControlChar) return true;
      if (typeof window !== 'undefined' && window.ReactNativeWebView
        && window._mobileBLEConnected) return true;
      if (_mqttLive && _mqttLive.connected) return true;
      return false;
    },
    async send(raw) {
      const enc = new TextEncoder();
      // 1. USB
      if (typeof stm32Writer !== 'undefined' && stm32Writer) {
        try { await stm32Writer.write(enc.encode(raw)); return 'usb'; }
        catch (e) { console.warn('[LiveMode/USB]', e.message); }
      }
      // 2. BLE — chunked to stay within ATT MTU
      if (typeof bleControlChar !== 'undefined' && bleControlChar) {
        try {
          const bytes = enc.encode(raw);
          for (let i = 0; i < bytes.length; i += BLE_MAX_CHUNK)
            await bleControlChar.writeValue(bytes.slice(i, i + BLE_MAX_CHUNK));
          return 'ble';
        } catch (e) { console.warn('[LiveMode/BLE]', e.message); }
      }
      // 3. React Native bridge
      if (typeof window !== 'undefined' && window.ReactNativeWebView && window._mobileBLEConnected) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LIVE_CMD', raw })); return 'rn'; }
        catch (e) { console.warn('[LiveMode/RN]', e.message); }
      }
      // 4. MQTT live client
      if (_mqttLive && _mqttLive.connected) {
        try { _mqttLive.publish('esp32/live', raw); return 'mqtt'; }
        catch (e) { console.warn('[LiveMode/MQTT]', e.message); }
      }
      return null;
    },
    initMQTT(brokerUrl, opts = {}) {
      if (_mqttLive) { try { _mqttLive.end(true); } catch (_) { } _mqttLive = null; }
      if (typeof mqtt === 'undefined') { console.warn('[LiveMode] mqtt.js not loaded'); return; }
      _mqttLive = mqtt.connect(brokerUrl, {
        clientId: 'live_' + Math.random().toString(16).slice(2, 10),
        clean: true, connectTimeout: 8000, reconnectPeriod: 3000, ...opts,
      });
      _mqttLive.on('connect', () => { console.log('[LiveMode/MQTT] connected'); _showToast('⚡ MQTT Live ready', 'info'); });
      _mqttLive.on('error', e => console.error('[LiveMode/MQTT]', e));
    },
  };

  // ── Packet builder ───────────────────────────────────────────────────────
  function buildPacket(blockId, payload) {
    return { cmd: 'live', id: blockId, ts: Date.now(), ...payload };
  }
  function serialise(packet) {
    return LIVE_PREFIX + JSON.stringify(packet) + '\n';
  }

  // ── Debouncer ────────────────────────────────────────────────────────────
  function debouncedSend(key, packet, delay) {
    if (_debounceMap[key]) clearTimeout(_debounceMap[key]);
    _debounceMap[key] = setTimeout(async () => {
      delete _debounceMap[key];
      if (!_enabled) { return; }
      if (!Transport.isConnected()) { _showToast('⚡ Live Mode: No device connected', 'warn'); return; }
      const channel = await Transport.send(serialise(packet));
      if (channel) {
        _lastPackets[packet.id] = packet;
        _pulseIndicator();
        _sync3D(packet);
        console.debug('[LiveMode] \u2713 ' + channel + ' \u2192', packet);
      } else {
        _showToast('⚡ Live send failed — check connection', 'error');
      }
    }, delay);
  }

  // ── 3D Sync ──────────────────────────────────────────────────────────────
  // Updates existing Three.js modals to reflect dispatched packets.
  // Fires AFTER send — so 3D reflects what was actually transmitted.
  function _sync3D(packet) {
    try {
      switch (packet.type) {
        case 'servo':
          // Sync servo arm if modal is open
          if (typeof currentServoAngle !== 'undefined') currentServoAngle = packet.val;
          if (typeof servoArm !== 'undefined' && servoArm)
            servoArm.rotation.z = (packet.val - 90) * (Math.PI / 180);
          const srd = document.getElementById('servoAngleDisplay');
          if (srd) srd.textContent = packet.val + '\u00b0';
          break;
        case 'motor':
          // Sync speedometer if open
          if (typeof speedo3DTarget !== 'undefined') {
            speedo3DTarget = Math.min(100, Math.max(0, Math.abs(packet.speed)));
            const sl = document.getElementById('speedo3DSlider');
            if (sl) { sl.value = speedo3DTarget; if (typeof updateSpeedo3DUI === 'function') updateSpeedo3DUI(); }
          }
          if (typeof motorAnimSpeed !== 'undefined') motorAnimSpeed = packet.speed / 100;
          break;
        case 'led': case 'led_pwm': case 'digital': {
          const dot = document.getElementById('liveLedDot');
          if (dot) {
            const on = (packet.state === '1' || (packet.val || 0) > 0);
            dot.style.background = on ? '#00ff88' : '#374151';
            dot.style.boxShadow = on ? '0 0 8px #00ff88' : 'none';
          }
          break;
        }
        case 'rgb': case 'rgb_ch': {
          const r = packet.r || 0, g = packet.g || 0, b = packet.b || 0;
          const dot = document.getElementById('liveLedDot');
          if (dot) {
            dot.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
            dot.style.boxShadow = (r + g + b) > 0 ? '0 0 10px rgba(' + r + ',' + g + ',' + b + ',0.8)' : 'none';
          }
          break;
        }
      }
    } catch (e) { /* 3D sync is best-effort */ }
  }

  // ── UI helpers ───────────────────────────────────────────────────────────
  function _updateUI() {
    const btn = document.getElementById('btnLiveMode');
    const bar = document.getElementById('liveModeIndicator');
    if (btn) {
      btn.classList.toggle('live-active', _enabled);
      btn.title = _enabled ? 'Live Mode ON \u2014 click to disable' : 'Live Mode OFF \u2014 click to enable';
    }
    if (bar) bar.style.display = _enabled ? 'flex' : 'none';

    // Update the bottom action bar Live button icon
    const imgLive = document.getElementById('imgLive');
    if (imgLive) {
      imgLive.src = _enabled ? 'icons/live-off.svg' : 'icons/live-on.svg';
    }
  }

  function _pulseIndicator() {
    const dot = document.getElementById('livePulseDot');
    if (!dot) return;
    dot.classList.remove('live-pulse');
    void dot.offsetWidth; // force reflow — restarts CSS animation
    dot.classList.add('live-pulse');
  }

  let _toastTimer = null;
  function _showToast(msg, level) {
    const el = document.getElementById('liveModeToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'live-toast live-toast-' + (level || 'info') + ' live-toast-show';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('live-toast-show'), 2800);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {

    // ── SENSOR REGISTRY ──────────────────────────────────────────────────────
    // Sensor blocks are polled (not triggered by field change).
    // Returns {cmd:'read', type, ...} sent to firmware to read and respond.

    // ── Terminal ──────────────────────────────────────────────────────────────
    Terminal: {
      _el: null, _paused: false, _count: 0,
      init() { this._el = document.getElementById('ltBody'); },
      _ltQueue: [],
      _ltRafPending: false,
      _flushLtQueue() {
        this._ltRafPending = false;
        if (!this._el || this._ltQueue.length === 0) return;
        if (this._count === 0) this._el.innerHTML = '';
        const frag = document.createDocumentFragment();
        while (this._ltQueue.length > 0) {
          const item = this._ltQueue.shift();
          this._count++;
          const row = document.createElement('div');
          row.className = 'lt-row lt-' + item.dir;
          row.innerHTML = item.html;
          frag.appendChild(row);
        }
        this._el.appendChild(frag);
        // Trim in one pass
        const el = this._el;
        while (el.children.length > 200) el.removeChild(el.firstChild);
        // One scroll measurement
        if (el.scrollHeight - el.scrollTop < el.clientHeight + 60) el.scrollTop = el.scrollHeight;
      },
      log(dir, cls, label, valHTML) {
        if (this._paused || !this._el) return;
        const ts = new Date().toLocaleTimeString('en', { hour12: false });
        const arrow = dir === 'out' ? '↑' : dir === 'in' ? '↓' : '·';
        const html = '<span class="lt-ts">' + ts + '</span><span class="lt-dir">' + arrow + '</span><span class="lt-badge ' + cls + '">' + label + '</span><span class="lt-val">' + valHTML + '</span>';
        this._ltQueue.push({ dir, html });
        if (!this._ltRafPending) {
          this._ltRafPending = true;
          requestAnimationFrame(() => this._flushLtQueue());
        }
      },
      logCommand(p) {
        const t = p.type || '';
        const m = {
          servo: ['lb-servo', 'SERVO', '<span class="lt-pin">' + (p.port || '') + '</span>  <span class="lt-num">' + (p.val || 0) + '</span><span class="lt-unit">°</span>'],
          motor: ['lb-motor', 'MOTOR', '<span class="lt-pin">' + (p.motors || '') + '</span>  <span class="lt-num">' + (p.dir || '') + '</span>  <span class="lt-num">' + (p.speed || 0) + '</span><span class="lt-unit">%</span>'],
          led: ['lb-led', 'LED', '<span class="lt-pin">' + (p.ports || '') + '</span>  ' + (p.state === '1' ? '<span class="lt-num">ON</span>' : '<span style="color:#475569">OFF</span>')],
          led_pwm: ['lb-led', 'LED PWM', '<span class="lt-pin">' + (p.ports || '') + '</span>  <span class="lt-num">' + (p.val || 0) + '</span><span class="lt-unit">%</span>'],
          rgb: ['lb-rgb', 'RGB', 'r<span class="lt-num">' + (p.r || 0) + '</span> g<span class="lt-num">' + (p.g || 0) + '</span> b<span class="lt-num">' + (p.b || 0) + '</span>'],
          digital: ['lb-digital', 'DIGITAL', '<span class="lt-pin">' + (p.ports || '') + '</span>  ' + (p.state === '1' ? '<span class="lt-num">HIGH</span>' : '<span style="color:#475569">LOW</span>')],
          relay: ['lb-relay', 'RELAY', '<span class="lt-pin">' + (p.port || '') + '</span>  ' + (p.state ? '<span class="lt-num">ON</span>' : '<span style="color:#475569">OFF</span>')],
          buzzer: ['lb-led', 'BUZZER', '<span class="lt-num">' + (p.freq || 0) + '</span><span class="lt-unit">Hz</span>'],
        };
        const e = m[t];
        if (e) this.log('out', e[0], e[1], e[2]);
      },
      onBoardMessage(msg) {
        if (!msg) return;
        if (msg.startsWith('DATA:')) {
          try {
            const j = JSON.parse(msg.slice(5));
            const t = j.type || '';
            const v = j.value !== undefined ? j.value : '?';
            const u = j.unit || '';
            const sm = {
              ultrasonic: ['lb-ultra', 'DIST', '<span class="lt-num">' + v + '</span><span class="lt-unit"> cm</span>'],
              temp: ['lb-temp', 'TEMP', '<span class="lt-num">' + v + '</span><span class="lt-unit"> °C</span>'],
              ir: ['lb-ir', 'IR', v ? '<span class="lt-num">DETECTED</span>' : '<span style="color:#475569">clear</span>'],
              button: ['lb-button', 'BUTTON', v ? '<span class="lt-num">PRESSED</span>' : '<span style="color:#475569">open</span>'],
              flame: ['lb-temp', 'FLAME', v ? '<span class="lt-num" style="color:#f87171">DETECTED</span>' : '<span style="color:#475569">none</span>'],
              motion: ['lb-button', 'MOTION', v ? '<span class="lt-num">DETECTED</span>' : '<span style="color:#475569">idle</span>'],
              sound: ['lb-ultra', 'SOUND', '<span class="lt-num">' + v + '</span>'],
            };
            const se = sm[t];
            if (se) this.log('in', se[0], se[1], se[2]);
            else this.log('in', 'lb-board', t.toUpperCase().slice(0, 8) || 'DATA', '<span class="lt-num">' + v + '</span>' + (u ? '<span class="lt-unit"> ' + u + '</span>' : ''));
          } catch (_) { this.log('in', 'lb-board', 'DATA', msg.slice(5, 80)); }
        } else if (_enabled && msg.length > 1 && !msg.startsWith('>>') && !msg.startsWith('[LIVE]') && !msg.startsWith('[!]')) {
          this.log('board', 'lb-board', 'BOARD', '<span style="color:#475569">' + msg.slice(0, 90) + '</span>');
        }
      },
      show() { const e = document.getElementById('liveTerminal'); if (e) e.classList.add('lt-active'); },
      hide() { const e = document.getElementById('liveTerminal'); if (e) e.classList.remove('lt-active'); },
      clear() { if (this._el) { this._el.innerHTML = '<div class="lt-empty">Cleared — waiting for data…</div>'; this._count = 0; } },
      togglePause() { this._paused = !this._paused; const b = document.getElementById('ltPauseBtn'); if (b) b.textContent = this._paused ? '▶ Resume' : '⏸ Pause'; },
    },

    // ── Sensor polling loop ───────────────────────────────────────────────────
    _pollTimer: null,
    _SENSOR_TYPES: {
      sen_ultrasonic: b => ({ cmd: 'read', type: 'ultrasonic', port: b.getFieldValue('PORT') || '' }),
      sen_temp: b => ({ cmd: 'read', type: 'temp', pin: b.getFieldValue('PORTS') || '' }),
      button: b => ({ cmd: 'read', type: 'button', pin: b.getFieldValue('PORTS') || '' }),
      get_ir: b => ({ cmd: 'read', type: 'ir', pin: b.getFieldValue('PORTS') || '' }),
      flame: b => ({ cmd: 'read', type: 'flame', pin: b.getFieldValue('PORTS') || '' }),
      motion: b => ({ cmd: 'read', type: 'motion', pin: b.getFieldValue('PORTS') || '' }),
      sound: b => ({ cmd: 'read', type: 'sound', pin: b.getFieldValue('PORTS') || '' }),
    },
    _startPolling() {
      this._stopPolling();
      const rate = parseInt(document.getElementById('ltPollRate')?.value || '500');
      this._pollTimer = setInterval(async () => {
        if (!_enabled || !_workspace) { this._stopPolling(); return; }
        if (!Transport.isConnected()) return;
        const blocks = _workspace.getAllBlocks(false);
        for (const block of blocks) {
          const ex = this._SENSOR_TYPES[block.type];
          if (!ex) continue;
          try {
            const payload = ex(block);
            payload.id = block.id;
            await Transport.send(serialise(payload));
          } catch (e) { }
        }
      }, rate);
    },
    _stopPolling() {
      if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    /** Call once inside start() after workspace is created. */
    init(ws) {
      _workspace = ws;
      _updateUI();
      this.Terminal.init();
      // Patch handleBoardMessage to route DATA: lines to terminal
      if (typeof handleBoardMessage === 'function') {
        const _orig = handleBoardMessage;
        handleBoardMessage = (msg, source) => { _orig(msg, source); this.Terminal.onBoardMessage(msg); };
      }
    },

    /** Enable Live Mode. Device must be connected first. */
    enable() {
      if (!Transport.isConnected()) {
        _showToast('\u26A1 Connect a device before enabling Live Mode', 'warn');
        return false;
      }
      _enabled = true; _updateUI();
      this.Terminal.show();
      this._startPolling();
      _showToast('\u26A1 Live Mode ON', 'info');
      return true;
    },

    /** Disable Live Mode. Cancels all pending debounce timers. */
    disable() {
      _enabled = false;
      Object.values(_debounceMap).forEach(clearTimeout);
      _debounceMap = {};
      _updateUI();
      this.Terminal.hide();
      this._stopPolling();
      _showToast('\u26A1 Live Mode OFF', 'info');
    },

    /** Toggle Live Mode on/off. */
    toggle() { _enabled ? this.disable() : this.enable(); },

    /** Returns true when Live Mode is currently active. */
    isEnabled() { return _enabled; },

    /** Workspace change listener — also logs commands to terminal. */
    onWorkspaceChange(ev) {
      if (!_enabled) return;
      const ok = ev.type === Blockly.Events.BLOCK_CHANGE ||
        ev.type === (Blockly.Events.BLOCK_FIELD_INTERMEDIATE_VALUE || '__never__');
      if (!ok) return;
      const blockId = ev.blockId;
      if (!blockId) return;
      const block = _workspace ? _workspace.getBlockById(blockId) : null;
      if (!block) return;
      const type = block.type;
      if (NON_LIVE_TYPES.has(type)) return;
      const extractor = LIVE_BLOCK_REGISTRY[type];
      if (extractor === undefined) { return; }
      if (extractor === null) return;
      let payload;
      try { payload = extractor(block); } catch (e) { return; }
      if (!payload) return;
      const packet = buildPacket(blockId, payload);
      const isNum = /^(ANG|SPEED|VAL|VAL1|VAL2|R|G|B|STEPS|MS|FREQ)$/.test(ev.name || '');
      const key = blockId + ':' + (ev.name || 'chg');
      const delay = isNum ? DEBOUNCE_NUMBER_MS : DEBOUNCE_DROPDOWN_MS;
      if (_debounceMap[key]) clearTimeout(_debounceMap[key]);
      _debounceMap[key] = setTimeout(async () => {
        delete _debounceMap[key];
        if (!_enabled) return;
        if (!Transport.isConnected()) { _showToast('\u26A1 Live Mode: No device connected', 'warn'); return; }
        const raw = serialise(packet);
        const channel = await Transport.send(raw);
        if (channel) {
          _lastPackets[packet.id] = packet;
          _pulseIndicator();
          _sync3D(packet);
          this.Terminal.logCommand(packet);
        } else {
          _showToast('\u26A1 Live send failed', 'error');
        }
      }, delay);
    },

    async resyncAll() {
      if (!_enabled || !Transport.isConnected()) return;
      const packets = Object.values(_lastPackets);
      for (const p of packets) {
        await Transport.send(serialise(p));
        await new Promise(r => setTimeout(r, 20));
      }
      _showToast('\u26A1 Re-synced ' + packets.length + ' block(s)', 'info');
    },

    Transport,
    LIVE_BLOCK_REGISTRY,
    NON_LIVE_TYPES,
    _buildPacket: buildPacket,
    _serialise: serialise,
  };
})();

// ── Panel toggle: Split → Python full → Terminal full → Split ────────────
(function () {
  const STATES = ['split', 'pyout', 'terminal'];
  const LABELS = { split: '⬍ Split', pyout: '▣ Python', terminal: '▤ Terminal' };
  let idx = 0;
  window.cyclePanelView = function () {
    idx = (idx + 1) % STATES.length;
    const panel = document.getElementById('codePanel');
    const btn = document.getElementById('panelToggleBtn');
    panel.classList.remove('show-pyout-only', 'show-terminal-only');
    if (STATES[idx] === 'pyout') panel.classList.add('show-pyout-only');
    if (STATES[idx] === 'terminal') panel.classList.add('show-terminal-only');
    btn.textContent = LABELS[STATES[idx]];
    // Re-center action bar after panel layout change
    if (typeof positionActionBar === 'function') {
      positionActionBar();
      setTimeout(positionActionBar, 320);
    }
  };
})();

// ── Project Dropdown toggle ─────────────────────────────────────────────
window.toggleProjectDropdown = function () {
  const panel = document.getElementById('projectTabs');
  const toggle = document.getElementById('projectTabsToggle');
  if (!panel || !toggle) return;
  const isOpen = panel.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
};

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
  const wrapper = document.getElementById('projectTabsWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const panel = document.getElementById('projectTabs');
    const toggle = document.getElementById('projectTabsToggle');
    if (panel) panel.classList.remove('open');
    if (toggle) toggle.classList.remove('open');
  }
});

window.addEventListener('load', start);

// ── AI Train screen integration ────────────────────────────────────────
/**
 * Opens the AI Training screen.
 * - On mobile (React Native WebView): sends OPEN_AI_TRAIN to App.js
 * - On web (expo web / browser): sends postMessage to parent iframe host
 */
function openAITrainScreen() {
  // Opens the picker so user can choose Image or Voice training
  const payload = JSON.stringify({ type: 'OPEN_AI_TRAIN_PICKER' });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(payload);
  } else if (window.parent !== window) {
    window.parent.postMessage(payload, '*');
    window.postMessage(payload, '*');
  } else {
    // Standalone browser — go directly to picker
    window.location.href = 'train_picker.html';
  }
}

/**
 * Opens the S3 training picker directly (Image/Voice choice for the S3 board).
 * Mirrors openAITrainScreen() but targets S3's picker instead of K230's.
 */
function openS3TrainScreen() {
  const payload = JSON.stringify({ type: 'OPEN_S3_PICKER' });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(payload);
  } else if (window.parent !== window) {
    window.parent.postMessage(payload, '*');
    window.postMessage(payload, '*');
  } else {
    // Standalone browser — go directly to the S3 picker
    window.location.href = 's3_picker.html';
  }
}

/**
 * Opens the Extension screen — lets the user pick a board (K230, STM32, S3…)
 * before landing on that board's training picker.
 * - On mobile (React Native WebView): sends OPEN_BOARD_PICKER to App.js
 * - On web (expo web / browser): sends postMessage to parent iframe host
 */
function openBoardScreen() {
  const payload = JSON.stringify({ type: 'OPEN_BOARD_PICKER' });
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(payload);
  } else if (window.parent !== window) {
    window.parent.postMessage(payload, '*');
    window.postMessage(payload, '*');
  } else {
    // Standalone browser — go directly to the board picker
    window.location.href = 'board.html';
  }
}

// ── BOARD SELECTION — one "<BOARD> AI Vision" category per selected board ──
// Both start hidden (see block_01.js). Picking K230 adds "K230 AI Vision";
// picking S3 adds "S3 AI Vision" alongside it — selecting a 2nd board never
// replaces the 1st, each board keeps its own category + Train button.
window._selectedBoards = window._selectedBoards || {};   // { k230: true, s3: true }
window._aiVisionTrainedContents = window._aiVisionTrainedContents || { k230: [], s3: [] };

function ensureAIVisionCategory(board) {
  const label = (board === 's3' ? 'S3' : 'K230') + ' AI Vision';
  const catId = 'cat_ai_vision_' + board;
  const contents = window.toolboxConfig.contents;

  const found = contents.find(it => it.id === catId);
  if (found) { found.name = label; return; }

  const customKey = 'AI_VISION_' + board.toUpperCase();
  const newCat = { kind: 'category', name: label, colour: '#f54254', id: catId, custom: customKey };

  // Keep K230/S3 in a stable relative order when both are present.
  const k230Idx = contents.findIndex(it => it.id === 'cat_ai_vision_k230');
  let insertIdx;
  if (board === 's3' && k230Idx !== -1) {
    insertIdx = k230Idx + 1;
  } else {
    const blocksIdx = contents.findIndex(it => it.id === 'cat_ai_blocks');
    insertIdx = blocksIdx === -1 ? contents.length : blocksIdx + 1;
  }
  contents.splice(insertIdx, 0, newCat);
}

function setSelectedBoard(board) {
  board = (board === 's3') ? 's3' : 'k230';
  window._selectedBoard = board;   // most-recently-picked board (legacy/reference use)
  window._selectedBoards[board] = true;
  try { localStorage.setItem('blockly_selected_boards', JSON.stringify(Object.keys(window._selectedBoards))); } catch (e) { }
  ensureAIVisionCategory(board);
  if (typeof workspace !== 'undefined' && workspace) {
    try { workspace.updateToolbox(window.toolboxConfig); } catch (e) { }
  }
}
window.setSelectedBoard = setSelectedBoard;

// ── AI_MODEL_TRAINED — inject trained blocks into A.I. Vision category ─

function applyAIClasses(classes, board) {
  if (!classes || classes.length < 1) return;
  board = (board === 's3') ? 's3' : 'k230';
  window._aiTrainedClasses = classes;
  window._aiTrainedBoard = board;
  const opts = classes.map(c => [c, c]);
  const tag = board.toUpperCase();
  const classifyType = 'ai_classify_image_' + board;
  const resultType = 'ai_class_result_' + board;
  const reliabilityType = 'ai_class_reliability_' + board;
  const openTrainType = 'ai_open_train_' + board;
  const exportModelType = 'ai_export_model_' + board;
  const inferType = 'ai_infer_' + board;

  // 1. Re-define the board-specific "classifying result" block with trained dropdown
  if (Blockly.Blocks[resultType]) delete Blockly.Blocks[resultType];
  Blockly.defineBlocksWithJsonArray([{
    type: resultType,
    message0: tag + ': classifying result is %1',
    args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
    colour: '#7c3aed', output: 'Boolean',
    tooltip: 'Returns true if the ' + tag + ' camera sees this class.',
  }]);

  // 2. Re-define the board-specific "reliability" block with trained dropdown
  if (Blockly.Blocks[reliabilityType]) delete Blockly.Blocks[reliabilityType];
  Blockly.defineBlocksWithJsonArray([{
    type: reliabilityType,
    message0: tag + ': reliability of %1',
    args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
    colour: '#7c3aed', output: 'Number',
    tooltip: 'Returns 0–100 confidence score for this class on ' + tag + '.',
  }]);

  // 3. Re-define the board-specific classify-image block with trained dropdown
  if (Blockly.Blocks[classifyType]) delete Blockly.Blocks[classifyType];
  Blockly.defineBlocksWithJsonArray([{
    type: classifyType,
    message0: tag + ': classify image → result %1',
    args0: [{ type: 'field_dropdown', name: 'CLASS', options: opts }],
    colour: '#f54254', previousStatement: null, nextStatement: null,
    tooltip: 'Run AI classification on the ' + tag + ' camera feed.',
  }]);

  // 4. Patch existing workspace blocks
  if (typeof workspace !== 'undefined' && workspace) {
    workspace.getAllBlocks(false).forEach(function (block) {
      if ([
        'ai_class_result', 'ai_class_reliability', 'ai_classify_image',
        'ai_classify_image_k230', 'ai_classify_image_s3',
        'ai_class_result_k230', 'ai_class_result_s3',
        'ai_class_reliability_k230', 'ai_class_reliability_s3',
      ].includes(block.type)) {
        const field = block.getField('CLASS');
        if (field) {
          field.menuGenerator_ = opts;
          const cur = field.getValue();
          if (!opts.some(o => o[1] === cur)) field.setValue(opts[0][1]);
          field.forceRerender();
        }
      }
    });
  }

  // 5. Update this board's A.I. Vision category — ensure it's visible/tagged,
  // and hand the trained blocks to its own Train-button flyout callback.
  // Other boards' categories/trained blocks are untouched.
  function doUpdate() {
    try {
      setSelectedBoard(board);
      window._aiVisionTrainedContents[board] = [
        { kind: 'block', type: openTrainType },
        { kind: 'block', type: exportModelType },
        { kind: 'block', type: inferType },
        { kind: 'block', type: classifyType },
        { kind: 'block', type: resultType },
        { kind: 'block', type: reliabilityType },
      ];
      if (typeof workspace !== 'undefined' && workspace) {
        workspace.updateToolbox(window.toolboxConfig);

        // Open this board's A.I. Vision category so user sees new blocks immediately
        setTimeout(function () {
          try {
            var tb = workspace.getToolbox();
            var aiItem = tb.getToolboxItems().find(function (item) {
              return item.getId && item.getId() === 'cat_ai_vision_' + board;
            });
            if (aiItem) tb.setSelectedItem(aiItem);
          } catch (e) { }
        }, 150);
      }
    } catch (e) {
      console.warn('Toolbox update error:', e);
    }

    // 6. Toast notification
    const toast = document.getElementById('liveModeToast');
    if (toast) {
      toast.textContent = '🧠 AI blocks ready! Classes: ' + classes.join(', ');
      toast.style.display = 'block'; toast.style.opacity = '1';
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => { toast.style.display = 'none'; }, 500); }, 3500);
    }

  }

  var blocklyDiv = document.getElementById('blocklyDiv');
  if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
    doUpdate();
  } else {
    var pollVisible = setInterval(function () {
      if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
        clearInterval(pollVisible);
        doUpdate();
      }
    }, 100);
  }
}

// ── VOICE_MODEL_TRAINED — inject voice blocks into toolbox ──────────────
function applyVoiceClasses(classes) {
  if (!classes || classes.length < 1) return;
  window._voiceTrainedClasses = classes;
  const opts = classes.map(c => [c, c]);

  // Define voice_heard block — checks if a word was heard
  if (Blockly.Blocks['voice_heard']) delete Blockly.Blocks['voice_heard'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'voice_heard',
    message0: 'voice heard %1',
    args0: [{ type: 'field_dropdown', name: 'WORD', options: opts }],
    colour: '#7c3aed', output: 'Boolean',
    tooltip: 'Returns true if this word was heard.',
    extensions: ["temp_style"]
  }]);

  // Define voice_confidence block — confidence % for a word
  if (Blockly.Blocks['voice_confidence']) delete Blockly.Blocks['voice_confidence'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'voice_confidence',
    message0: 'confidence of %1',
    args0: [{ type: 'field_dropdown', name: 'WORD', options: opts }],
    colour: '#7c3aed', output: 'Number',
    tooltip: 'Returns 0–100 confidence for this word.',
    extensions: ["temp_style"]
  }]);

  // Define voice_classify block — run voice inference
  if (Blockly.Blocks['voice_classify']) delete Blockly.Blocks['voice_classify'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'voice_classify',
    message0: 'classify voice → result %1',
    args0: [{ type: 'field_dropdown', name: 'WORD', options: opts }],
    colour: '#7c3aed', previousStatement: null, nextStatement: null,
    tooltip: 'Run voice classification.',
    extensions: ["temp_style"]
  }]);

  // Patch existing workspace blocks
  if (typeof workspace !== 'undefined' && workspace) {
    workspace.getAllBlocks(false).forEach(function (block) {
      if (['voice_heard', 'voice_confidence', 'voice_classify'].includes(block.type)) {
        const field = block.getField('WORD');
        if (field) {
          field.menuGenerator_ = opts;
          const cur = field.getValue();
          if (!opts.some(o => o[1] === cur)) field.setValue(opts[0][1]);
          field.forceRerender();
        }
      }
    });
  }

  // Add/update A.I. Voice category in toolbox
  function doUpdateVoice() {
    try {
      if (typeof workspace !== 'undefined' && workspace && window.toolboxConfig) {
        var voiceContents = [
          { kind: 'block', type: 'voice_classify' },
          { kind: 'block', type: 'voice_heard' },
          { kind: 'block', type: 'voice_confidence' },
        ];
        // Find existing cat_ai_voice or append new one
        var found = false;
        function findAndUpdateVoice(items) {
          if (!items) return false;
          for (var i = 0; i < items.length; i++) {
            if (items[i].id === 'cat_ai_voice') {
              items[i].contents = voiceContents; found = true; return true;
            }
            if (items[i].contents && findAndUpdateVoice(items[i].contents)) return true;
          }
          return false;
        }
        findAndUpdateVoice(window.toolboxConfig.contents);
        if (!found) {
          // Add new Voice category after A.I. Vision
          window.toolboxConfig.contents.push({
            kind: 'category', name: 'A.I. Voice', colour: '#7c3aed',
            id: 'cat_ai_voice', contents: voiceContents
          });
        }
        workspace.updateToolbox(window.toolboxConfig);

        // Open A.I. Voice category
        setTimeout(function () {
          try {
            var tb = workspace.getToolbox();
            var voiceItem = tb.getToolboxItems().find(function (item) {
              return item.getName && item.getName() === 'A.I. Voice';
            });
            if (voiceItem) tb.setSelectedItem(voiceItem);
          } catch (e) { }
        }, 150);
      }
    } catch (e) {
      console.warn('[Voice Train] Toolbox update error:', e);
    }

    // Toast
    const toast = document.getElementById('liveModeToast');
    if (toast) {
      toast.textContent = '🎤 Voice blocks ready! Words: ' + classes.join(', ');
      toast.style.display = 'block'; toast.style.opacity = '1';
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => { toast.style.display = 'none'; }, 500); }, 3500);
    }

    // Also store for sessionStorage reload
    try { sessionStorage.setItem('curio_voice_trained', JSON.stringify(classes)); } catch (e) { }

  }

  var blocklyDiv = document.getElementById('blocklyDiv');
  if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
    doUpdateVoice();
  } else {
    var pollVisible = setInterval(function () {
      if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
        clearInterval(pollVisible);
        doUpdateVoice();
      }
    }, 100);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 🏍️  Bike 3D — Three.js r128 + embedded GLB
//
//  WHEEL MESH IDENTIFICATION (by z-proximity to axle centres):
//  Front axle: x≈7.2, z≈-4.0
//    WHEELS (z -4.5 to -3.9): pCylinder31,68, pPipe10,26, pCylinder33,41, pPipe12,16
//    NOT wheel (z -2.0 to -2.6): polySurface140,141,166,167 → fender/brake
//
//  Rear axle:  x≈-9.7, z≈-2.8
//    WHEELS (z -3.3 to -2.7): polySurface142,143,164,165
//    NOT wheel (z -6.8 to -8.3): polySurface136,137,138,152 → swingarm/chain
//
//  Spin axis = Y  (wheel diameter spans Y, axle runs along Y)
// ══════════════════════════════════════════════════════════════════════
// ONLY the tight axle-cluster meshes — body/fender/swingarm excluded
const _FRONT_WHEEL_SET = new Set([
  "pCylinder31", "pCylinder68",
  "pPipe10", "pPipe26",
  "pCylinder33", "pCylinder41",
  "pPipe12", "pPipe16"
]);
const _REAR_WHEEL_SET = new Set([
  "polySurface142", "polySurface143",
  "polySurface164", "polySurface165"
]);

let bikeState = {
  scene: null, camera: null, renderer: null, animId: null,
  initialized: false, block: null,
  wheelMeshes: [], spinSpeed: 0,
  theta: -0.3, phi: 1.1, radius: 14,
  isDragging: false, prevX: 0, prevY: 0
};

function openBikeModelModal(block) {
  bikeState.block = block;
  const saved = parseInt(block.getFieldValue('BIKE_SPEED')) || 0;
  bikeState.spinSpeed = saved;
  const sl = document.getElementById('bikeSpeedSlider');
  if (sl) sl.value = saved;
  _updateBikeLabel();
  document.getElementById('bikeModelModal').style.display = 'flex';
  setTimeout(_initBike3D, 60);
}
function closeBikeModal() {
  _destroyBike3D();
  document.getElementById('bikeModelModal').style.display = 'none';
  bikeState.block = null;
}
function saveBikeModal() {
  if (bikeState.block) bikeState.block.setFieldValue(String(bikeState.spinSpeed), 'BIKE_SPEED');
  closeBikeModal();
}
function bikeSpeedUp() { bikeState.spinSpeed = Math.min(10, bikeState.spinSpeed + 1); _syncBikeSlider(); _updateBikeLabel(); }
function bikeSpeedDown() { bikeState.spinSpeed = Math.max(0, bikeState.spinSpeed - 1); _syncBikeSlider(); _updateBikeLabel(); }
function setBikeSpeedFromSlider(v) { bikeState.spinSpeed = +v; _updateBikeLabel(); }
function _syncBikeSlider() { const sl = document.getElementById('bikeSpeedSlider'); if (sl) sl.value = bikeState.spinSpeed; }
function _updateBikeLabel() { const el = document.getElementById('bikeSpeedValLabel'); if (el) el.textContent = bikeState.spinSpeed + ' / 10'; }

function _initBike3D() {
  if (bikeState.initialized) { _runBikeAnim(); return; }
  const canvas = document.getElementById('bikeCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = (canvas.parentElement ? canvas.parentElement.offsetWidth : 492) || 492;
  const H = 310;
  canvas.width = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 18, 50);

  const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 300);
  _updateBikeCamera(camera);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  // ── Balanced lighting — body won't blow out white ──
  // Soft ambient only — no harsh direct overexposure
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  // Key light from upper-left — moderate intensity
  const key = new THREE.DirectionalLight(0xfff0d0, 1.2);
  key.position.set(-6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  scene.add(key);

  // Soft fill from right
  const fill = new THREE.DirectionalLight(0x8ab4f8, 0.4);
  fill.position.set(8, 4, -6);
  scene.add(fill);

  // Subtle rim/back light
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(0, -4, -10);
  scene.add(rim);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0d1f35, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(new THREE.GridHelper(50, 25, 0x1a3a5c, 0x1a3a5c));

  bikeState.scene = scene;
  bikeState.camera = camera;
  bikeState.renderer = renderer;
  bikeState.wheelMeshes = [];
  bikeState.initialized = true;

  const loadMsg = document.getElementById('bikeLoadingMsg');
  if (typeof THREE.GLTFLoader === 'undefined') {
    if (loadMsg) loadMsg.textContent = 'GLTFLoader unavailable';
    _runBikeAnim(); return;
  }

  try {
    const blobUrl = 'assets/models/bike.glb';

    new THREE.GLTFLoader().load(blobUrl, function (gltf) {
      URL.revokeObjectURL(blobUrl);
      if (loadMsg) loadMsg.style.display = 'none';
      const model = gltf.scene;
      if (!model) { _runBikeAnim(); return; }

      // Scale & sit on ground
      const box = new THREE.Box3().setFromObject(model);
      const sz = box.getSize(new THREE.Vector3());
      const sc = 4.0 / Math.max(sz.x, sz.y, sz.z);
      model.scale.setScalar(sc);

      const box2 = new THREE.Box3().setFromObject(model);
      const cen = box2.getCenter(new THREE.Vector3());
      model.position.x -= cen.x;
      model.position.z -= cen.z;
      model.position.y -= box2.min.y;

      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(model);

      // ── Collect ONLY true wheel meshes (tight axle cluster) ──
      const wm = [];
      model.traverse(child => {
        if (child.isMesh &&
          (_FRONT_WHEEL_SET.has(child.name) || _REAR_WHEEL_SET.has(child.name))) {
          wm.push(child);
        }
      });
      bikeState.wheelMeshes = wm;
      _runBikeAnim();

    }, undefined, function (err) {
      console.error('[BikeGLB] load error:', err);
      if (loadMsg) loadMsg.textContent = 'Load error';
      _runBikeAnim();
    });
  } catch (e) {
    console.error('[BikeGLB] init error:', e);
    if (loadMsg) loadMsg.textContent = 'Error: ' + e.message;
    _runBikeAnim();
  }

  // Orbit camera drag
  canvas.addEventListener('pointerdown', e => {
    bikeState.isDragging = true;
    bikeState.prevX = e.clientX; bikeState.prevY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!bikeState.isDragging) return;
    bikeState.theta -= (e.clientX - bikeState.prevX) * 0.007;
    bikeState.phi = Math.max(0.12, Math.min(Math.PI / 2.2,
      bikeState.phi - (e.clientY - bikeState.prevY) * 0.005));
    bikeState.prevX = e.clientX; bikeState.prevY = e.clientY;
    _updateBikeCamera(bikeState.camera);
  });
  canvas.addEventListener('pointerup', () => { bikeState.isDragging = false; });
  canvas.addEventListener('pointerleave', () => { bikeState.isDragging = false; });
}

function _updateBikeCamera(cam) {
  if (!cam) return;
  const r = bikeState.radius, ph = bikeState.phi, th = bikeState.theta;
  cam.position.set(
    r * Math.sin(ph) * Math.sin(th),
    r * Math.cos(ph) + 0.5,
    r * Math.sin(ph) * Math.cos(th)
  );
  cam.lookAt(0, 0.5, 0);
}

function _runBikeAnim() {
  if (bikeState.animId) cancelAnimationFrame(bikeState.animId);
  function loop() {
    if (!bikeState.initialized || !bikeState.renderer) return;
    const rad = bikeState.spinSpeed * 0.015;
    if (rad > 0) {
      bikeState.wheelMeshes.forEach(m => { m.rotation.y += rad; });
    }
    bikeState.renderer.render(bikeState.scene, bikeState.camera);
    bikeState.animId = requestAnimationFrame(loop);
  }
  bikeState.animId = requestAnimationFrame(loop);
}

function _destroyBike3D() {
  if (bikeState.animId) { cancelAnimationFrame(bikeState.animId); bikeState.animId = null; }
  if (bikeState.renderer) { bikeState.renderer.dispose(); bikeState.renderer = null; }
  bikeState.scene = bikeState.camera = null;
  bikeState.wheelMeshes = []; bikeState.initialized = false;
}

// ── POSE_MODEL_TRAINED — inject pose blocks into toolbox ───────────────
function applyPoseClasses(classes) {
  if (!classes || classes.length < 1) return;
  window._poseTrainedClasses = classes;
  const opts = classes.map(c => [c, c]);

  // Define pose_detected block — checks if a pose is detected
  if (Blockly.Blocks['pose_detected']) delete Blockly.Blocks['pose_detected'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'pose_detected',
    message0: 'pose detected %1',
    args0: [{ type: 'field_dropdown', name: 'POSE', options: opts }],
    colour: '#0ea5e9', output: 'Boolean',
    tooltip: 'Returns true if this pose is detected.',
    extensions: ["defult_style"]
  }]);

  // Define pose_confidence block — confidence % for a pose
  if (Blockly.Blocks['pose_confidence']) delete Blockly.Blocks['pose_confidence'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'pose_confidence',
    message0: 'confidence of pose %1',
    args0: [{ type: 'field_dropdown', name: 'POSE', options: opts }],
    colour: '#0ea5e9', output: 'Number',
    tooltip: 'Returns 0–100 confidence score for this pose.',
    extensions: ["defult_style"]
  }]);

  // Define pose_classify block — run pose inference
  if (Blockly.Blocks['pose_classify']) delete Blockly.Blocks['pose_classify'];
  Blockly.defineBlocksWithJsonArray([{
    type: 'pose_classify',
    message0: 'classify pose → result %1',
    args0: [{ type: 'field_dropdown', name: 'POSE', options: opts }],
    colour: '#0ea5e9', previousStatement: null, nextStatement: null,
    tooltip: 'Run pose classification on camera feed.',
    extensions: ["defult_style"]
  }]);

  // Patch existing workspace blocks
  if (typeof workspace !== 'undefined' && workspace) {
    workspace.getAllBlocks(false).forEach(function (block) {
      if (['pose_detected', 'pose_confidence', 'pose_classify'].includes(block.type)) {
        const field = block.getField('POSE');
        if (field) {
          field.menuGenerator_ = opts;
          const cur = field.getValue();
          if (!opts.some(o => o[1] === cur)) field.setValue(opts[0][1]);
          field.forceRerender();
        }
      }
    });
  }

  // Add/update A.I. Pose category in toolbox
  function doUpdatePose() {
    try {
      if (typeof workspace !== 'undefined' && workspace && window.toolboxConfig) {
        var poseContents = [
          { kind: 'block', type: 'pose_classify' },
          { kind: 'block', type: 'pose_detected' },
          { kind: 'block', type: 'pose_confidence' },
        ];
        var found = false;
        function findAndUpdatePose(items) {
          if (!items) return false;
          for (var i = 0; i < items.length; i++) {
            if (items[i].id === 'cat_ai_pose') {
              items[i].contents = poseContents; found = true; return true;
            }
            if (items[i].contents && findAndUpdatePose(items[i].contents)) return true;
          }
          return false;
        }
        findAndUpdatePose(window.toolboxConfig.contents);
        if (!found) {
          window.toolboxConfig.contents.push({
            kind: 'category', name: 'A.I. Pose', colour: '#0ea5e9',
            id: 'cat_ai_pose', contents: poseContents
          });
        }
        workspace.updateToolbox(window.toolboxConfig);

        // Open A.I. Pose category
        setTimeout(function () {
          try {
            var tb = workspace.getToolbox();
            var poseItem = tb.getToolboxItems().find(function (item) {
              return item.getName && item.getName() === 'A.I. Pose';
            });
            if (poseItem) tb.setSelectedItem(poseItem);
          } catch (e) { }
        }, 150);
      }
    } catch (e) {
      console.warn('[Pose Train] Toolbox update error:', e);
    }

    // Toast
    const toast = document.getElementById('liveModeToast');
    if (toast) {
      toast.textContent = '🧘 Pose blocks ready! Poses: ' + classes.join(', ');
      toast.style.display = 'block'; toast.style.opacity = '1';
      setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => { toast.style.display = 'none'; }, 500); }, 3500);
    }

    try { sessionStorage.setItem('curio_pose_trained', JSON.stringify(classes)); } catch (e) { }

  }

  var blocklyDiv = document.getElementById('blocklyDiv');
  if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
    doUpdatePose();
  } else {
    var pollVisible = setInterval(function () {
      if (blocklyDiv && blocklyDiv.getBoundingClientRect().width > 0) {
        clearInterval(pollVisible);
        doUpdatePose();
      }
    }, 100);
  }
}

// Listen for postMessage from iframe usage
window.addEventListener('message', function (event) {
  try {
    const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (!msg) return;
    if (typeof msg.type === 'string' && (msg.type.includes('DISCONNECT') || msg.type.includes('disconnect'))) {
      if (typeof resetRunStopButtons === 'function') resetRunStopButtons();
      window._mobileBLEConnected = false;
    }
    if (msg.type === 'BOARD_SELECTED') setSelectedBoard(msg.board);
    if (msg.type === 'AI_MODEL_TRAINED') applyAIClasses(msg.classes, msg.board);
    if (msg.type === 'VOICE_MODEL_TRAINED') applyVoiceClasses(msg.classes);
    if (msg.type === 'POSE_MODEL_TRAINED') applyPoseClasses(msg.classes);

    if (msg.type === 'CLOSE_AI_TRAIN' || msg.type === 'CLOSE_VOICE_TRAIN_V2' || msg.type === 'CLOSE_POSE_TRAIN') {
      // Force a full workspace resize and flyout reflow
      setTimeout(function () {
        try {
          if (typeof workspace !== 'undefined' && workspace) {
            Blockly.svgResize(workspace);
            workspace.resize();
            workspace.render();
            var tb = workspace.getToolbox();
            if (tb) {
              var flyout = tb.getFlyout();
              if (flyout) {
                flyout.reflow();
              }
              // Re-select the currently selected item to force render
              var selectedItem = tb.getSelectedItem();
              if (selectedItem) {
                tb.setSelectedItem(null);
                tb.setSelectedItem(selectedItem);
              }
            }
          }
        } catch (e) { console.warn("Reflow error:", e); }
      }, 150);
    }
  } catch (e) {
    console.warn('[AI Train] message parse error:', e);
  }
});

// Standalone browser: read image classes saved by train.html before navigating back
(function checkStoredAIClasses() {
  const raw = sessionStorage.getItem('curio_ai_trained');
  if (!raw) return;
  try {
    const classes = JSON.parse(raw);
    sessionStorage.removeItem('curio_ai_trained');
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (typeof workspace !== 'undefined' && workspace) {
        clearInterval(poll); applyAIClasses(classes);
      } else if (tries > 40) { clearInterval(poll); }
    }, 100);
  } catch (e) { }
})();

// Standalone browser: read voice classes saved by train_voice_v2.html
(function checkStoredVoiceClasses() {
  const raw = sessionStorage.getItem('curio_voice_trained');
  if (!raw) return;
  try {
    const classes = JSON.parse(raw);
    sessionStorage.removeItem('curio_voice_trained');
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (typeof workspace !== 'undefined' && workspace) {
        clearInterval(poll); applyVoiceClasses(classes);
      } else if (tries > 40) { clearInterval(poll); }
    }, 100);
  } catch (e) { }
})();

// Standalone browser: read pose classes saved by pose.html
(function checkStoredPoseClasses() {
  const raw = sessionStorage.getItem('curio_pose_trained');
  if (!raw) return;
  try {
    const classes = JSON.parse(raw);
    sessionStorage.removeItem('curio_pose_trained');
    var tries = 0;
    var poll = setInterval(function () {
      tries++;
      if (typeof workspace !== 'undefined' && workspace) {
        clearInterval(poll); applyPoseClasses(classes);
      } else if (tries > 40) { clearInterval(poll); }
    }, 100);
  } catch (e) { }
})();

// Override Field getText to show P1, P2... instead of D3, D4... visually
(function () {
  function patchBlocklyField() {
    if (window.Blockly && window.Blockly.Field && !window.Blockly.Field.prototype._isPatchedForPorts) {
      const origGetText = window.Blockly.Field.prototype.getText;
      const PORT_D_TO_P = {
        'D3': 'P1', 'D4': 'P2', 'D5': 'P3', 'D6': 'P4', 'D7': 'P5', 'E0': 'P6', 'E1': 'P7', 'G3': 'P8', 'G0': 'P9', 'G1': 'P10', 'G2': 'P11',
        'C0': 'P1', 'C1': 'P2', 'C2': 'P3', 'F9': 'P4', 'C4': 'P5', 'C5': 'P6', 'A1': 'P7', 'A2': 'P8', 'A4': 'P9', 'F8': 'P10', 'A6': 'P11'
      };

      function patchedGetText() {
        const val = origGetText.call(this);
        if (this.name === 'MOTORS' && typeof val === 'string') {
          let res = [];
          if (val.includes('E11') || val.includes('E12')) res.push('P1');
          if (val.includes('B8') || val.includes('B9')) res.push('P2');
          if (val.includes('E13') || val.includes('B15')) res.push('P3');
          if (val.includes('D15') || val.includes('E14')) res.push('P4');
          if (res.length > 0) return res.join(',');
        } else if (this.name === 'PORTS' && typeof val === 'string') {
          return val.split(',').map(s => PORT_D_TO_P[s.trim()] || s).join(',');
        }
        return val;
      }

      window.Blockly.Field.prototype.getText = patchedGetText;
      if (window.Blockly.FieldLabel && window.Blockly.FieldLabel.prototype.getText === origGetText) {
        window.Blockly.FieldLabel.prototype.getText = patchedGetText;
      }
      window.Blockly.Field.prototype._isPatchedForPorts = true;

      // Force rerender all existing blocks if workspace exists
      if (typeof workspace !== 'undefined' && workspace) {
        workspace.getAllBlocks(false).forEach(b => {
          if (b.getField('PORTS')) b.getField('PORTS').forceRerender();
          if (b.getField('MOTORS')) b.getField('MOTORS').forceRerender();
        });
      }
    }
  }

  // Try now, or wait for Blockly to load
  if (window.Blockly && window.Blockly.Field) {
    patchBlocklyField();
  } else {
    window.addEventListener('load', () => setTimeout(patchBlocklyField, 1500));
  }
})();
