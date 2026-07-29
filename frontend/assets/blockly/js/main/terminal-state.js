// v12: set Blockly.Python alias (runs after python_compressed.js in deferred order)
if (typeof python !== 'undefined' && python.pythonGenerator) {
  Blockly.Python = python.pythonGenerator;
}

let workspace = null;
let pyGen = null; // v12: set after Blockly loads
let defaultToolboxConfig = typeof window !== 'undefined' && window.toolboxConfig ? JSON.parse(JSON.stringify(window.toolboxConfig)) : null;

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
    
    // Re-apply any selected boards so their categories aren't lost when resetting the toolbox
    try {
      if (typeof window.setSelectedBoard === 'function') {
        var _savedBoards = JSON.parse(localStorage.getItem('blockly_selected_boards') || 'null');
        if (!_savedBoards) {
          var _legacyBoard = localStorage.getItem('blockly_selected_board');
          _savedBoards = _legacyBoard ? [_legacyBoard] : [];
        }
        // Calling setSelectedBoard will internally update the toolbox and persist the category
        _savedBoards.forEach(function (b) { window.setSelectedBoard(b); });
      }
    } catch(e) {}

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
    selectedBoards: window._selectedBoards || null,
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

