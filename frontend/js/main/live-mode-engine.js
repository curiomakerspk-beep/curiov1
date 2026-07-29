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

