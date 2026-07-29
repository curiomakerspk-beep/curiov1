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
    din_flame: ['async_flame', 'flame'],
    ana_flame: ['async_flame', 'flame'],
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

  // IR Sensor / Load Cell — unlike the plain sensor-read blocks above, these
  // also carry a STATE field (enable/disable the sensor itself, set via the
  // popup's power step) that gets passed as a trailing argument.
  reg['din_ir'] = b => {
    const pins = (b.getFieldValue('PORTS') || '').split(',').map(p => p.trim()).filter(Boolean);
    const state = b.getFieldValue('STATE') || '0';
    if (!pins.length) return ['# Invalid: no port', py.ORDER_NONE];
    return [`await async_get_ir(${pins.map(p => `"${p}"`).join(',')}, ${state})`, py.ORDER_FUNCTION_CALL];
  };
  reg['load_cell'] = b => {
    const pins = (b.getFieldValue('PORTS') || '').split(',').map(p => p.trim()).filter(Boolean);
    const state = b.getFieldValue('STATE') || '0';
    if (!pins.length) return ['# Invalid: no port', py.ORDER_NONE];
    return [`await async_load_cell(${pins.map(p => `"${p}"`).join(',')}, ${state})`, py.ORDER_FUNCTION_CALL];
  };

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

