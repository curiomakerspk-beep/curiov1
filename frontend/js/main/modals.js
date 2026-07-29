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

let currentMinifanBlock = null;

function openMinifanSelectionModal(block) {
  currentMinifanBlock = block;
  const rawTxt = block.getFieldValue('PORTS') || '';
  
  // Reset all to unselected
  ['P1', 'P2', 'P3', 'P4'].forEach(p => {
    const radio = document.querySelector(`input[name="minifanPort"][value="${p}"]`);
    if (radio) radio.checked = false;
  });

  if (rawTxt.includes('E11') || rawTxt.includes('E12')) {
    const radio = document.querySelector(`input[name="minifanPort"][value="P1"]`);
    if (radio) radio.checked = true;
  } else if (rawTxt.includes('B8') || rawTxt.includes('B9')) {
    const radio = document.querySelector(`input[name="minifanPort"][value="P2"]`);
    if (radio) radio.checked = true;
  } else if (rawTxt.includes('E13') || rawTxt.includes('B15')) {
    const radio = document.querySelector(`input[name="minifanPort"][value="P3"]`);
    if (radio) radio.checked = true;
  } else if (rawTxt.includes('D15') || rawTxt.includes('E14')) {
    const radio = document.querySelector(`input[name="minifanPort"][value="P4"]`);
    if (radio) radio.checked = true;
  } else {
    // default to P1
    const radio = document.querySelector(`input[name="minifanPort"][value="P1"]`);
    if (radio) radio.checked = true;
  }
  
  // Power state (from STATE field)
  const state = block.getFieldValue('STATE') || 'stop';
  if (state === 'stop') {
    document.querySelector(`input[name="minifanState"][value="OFF"]`).checked = true;
  } else {
    document.querySelector(`input[name="minifanState"][value="ON"]`).checked = true;
  }

  updateMinifanPortUI();
  updateMinifanPowerUI();
  updateMinifanSliderColor(document.getElementById('minifanSpeed'));

  document.getElementById('minifanSelectionModal').style.display = 'flex';
  setTimeout(() => { initMinifan3D(); }, 50);
}

function updateMinifanSliderColor(slider) {
  if (!slider) return;
  const val = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.background = `linear-gradient(to right, #FF9800 ${val}%, #ddd ${val}%)`;
}

function closeMinifanModal() {
  document.getElementById('minifanSelectionModal').style.display = 'none';
  destroyMinifan3D();
}

// ══════════════════════════════════════════════════════════════
// 3D Minifan Simulation (Three.js r128)
// ══════════════════════════════════════════════════════════════
let minifan3D = { scene: null, camera: null, renderer: null, propGroup: null, targetRPM: 0, currentRPM: 0, animId: null, initialized: false };

function initMinifan3D() {
  if (minifan3D.initialized) return;
  const canvas = document.getElementById('minifan3DCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.width = W * 2; canvas.height = H * 2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xE8F0FE);
  scene.fog = new THREE.Fog(0xE8F0FE, 8, 18);

  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  camera.position.set(3, 1.5, 4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(2);
  renderer.shadowMap.enabled = true;

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(3, 5, 4);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Minifan base/motor body
  const baseGroup = new THREE.Group();
  const motorGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 32);
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x4285F4, metalness: 0.3, roughness: 0.5 });
  const motor = new THREE.Mesh(motorGeo, motorMat);
  motor.rotation.x = Math.PI / 2;
  motor.castShadow = true;
  baseGroup.add(motor);
  scene.add(baseGroup);

  // Propeller group
  const propGroup = new THREE.Group();
  
  // Hub
  const hubGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.8, roughness: 0.2 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.45;
  propGroup.add(hub);

  // Blades
  const bladeGeo = new THREE.BoxGeometry(1.4, 0.25, 0.02);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xFBBC05, transparent: true, opacity: 0.9 });
  
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.z = 0.45;
    blade.rotation.z = (i * Math.PI * 2) / 3;
    // slight pitch
    blade.rotation.x = 0.2;
    propGroup.add(blade);
  }
  
  scene.add(propGroup);

  // Orbit drag
  let isDrag = false, prevM = { x: 0, y: 0 };
  let camTheta = 0.7, camPhi = 0.4, camDist = 5;
  function updateCam() {
    camera.position.x = camDist * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.y = camDist * Math.cos(camPhi);
    camera.position.z = camDist * Math.sin(camPhi) * Math.sin(camTheta);
    camera.lookAt(0, 0, 0);
  }
  canvas.addEventListener('pointerdown', (e) => { isDrag = true; prevM = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!isDrag) return; camTheta += (e.clientX - prevM.x) * 0.01; camPhi = Math.max(0.1, Math.min(1.4, camPhi + (e.clientY - prevM.y) * 0.01)); prevM = { x: e.clientX, y: e.clientY }; updateCam(); });
  canvas.addEventListener('pointerup', () => { isDrag = false; });
  canvas.addEventListener('pointerleave', () => { isDrag = false; });

  minifan3D.scene = scene; minifan3D.camera = camera; minifan3D.renderer = renderer;
  minifan3D.propGroup = propGroup; minifan3D.initialized = true;
  
  // initialize speed
  updateMinifanPowerUI(); // to sync state

  animateMinifan3D();
}

function updateMinifan3DSpeed(isOn, speedVal) {
  if (isOn) {
    minifan3D.targetRPM = (speedVal / 10) * 15;
  } else {
    minifan3D.targetRPM = 0;
  }
}

function animateMinifan3D() {
  if (!minifan3D.initialized) return;
  minifan3D.animId = requestAnimationFrame(animateMinifan3D);
  minifan3D.currentRPM += (minifan3D.targetRPM - minifan3D.currentRPM) * 0.05;
  if (minifan3D.propGroup) minifan3D.propGroup.rotation.z -= minifan3D.currentRPM * 0.05;
  minifan3D.renderer.render(minifan3D.scene, minifan3D.camera);
}

function destroyMinifan3D() {
  if (minifan3D.animId) cancelAnimationFrame(minifan3D.animId);
  if (minifan3D.renderer) minifan3D.renderer.dispose();
  minifan3D = { scene: null, camera: null, renderer: null, propGroup: null, targetRPM: 0, currentRPM: 0, animId: null, initialized: false };
}

function saveMinifanSelection() {
  if (!currentMinifanBlock) { closeMinifanModal(); return; }
  
  const selectedPort = document.querySelector('input[name="minifanPort"]:checked');
  if (selectedPort) {
    const val = selectedPort.value;
    let ports = '';
    if (val === 'P1') ports = 'E11,E12';
    else if (val === 'P2') ports = 'B9,B8';
    else if (val === 'P3') ports = 'E13,B15';
    else if (val === 'P4') ports = 'D15,E14';
    currentMinifanBlock.setFieldValue(ports, 'PORTS');
  }

  const powerElem = document.querySelector('input[name="minifanState"]:checked');
  if (powerElem) {
    const power = powerElem.value;
    // If ON, we default to 'forward' for now as that's what the block generator expects. 
    // If OFF, 'stop'.
    currentMinifanBlock.setFieldValue(power === 'ON' ? 'forward' : 'stop', 'STATE');
  }
  
  closeMinifanModal();
}

function updateMinifanPortUI() {
  const radios = document.querySelectorAll('input[name="minifanPort"]');
  radios.forEach(r => {
    const box = r.nextElementSibling;
    const check = box.querySelector('.mf-port-check');
    if (r.checked) {
      box.classList.add('selected');
      if (check) check.classList.add('selected');
    } else {
      box.classList.remove('selected');
      if (check) check.classList.remove('selected');
    }
  });
}

function updateMinifanPowerUI() {
  const radios = document.querySelectorAll('input[name="minifanState"]');
  let isOn = false;
  radios.forEach(r => {
    const box = r.nextElementSibling;
    if (r.checked) {
      box.classList.add('selected');
      if (r.value === 'ON') isOn = true;
    } else {
      box.classList.remove('selected');
    }
  });
  
  if (typeof updateMinifan3DSpeed === 'function') {
    const speedEl = document.getElementById('minifanSpeed');
    const speed = speedEl ? parseInt(speedEl.value) || 0 : 0;
    updateMinifan3DSpeed(isOn, speed);
  }
}

// =====================================================================
// SENSOR POPUP TEMPLATE — config-driven, reused by IR Sensor / Relay /
// Load Cell (and any future sensor). Reuses the exact mf-* markup/CSS the
// Minifan modal above uses (see css/main.css "Sensor popup template" for
// the --modal-accent colours per modal id).
//
// To add or change a sensor's popup: edit SENSOR_POPUP_CONFIGS below.
//   - pins: which physical pins show up as tiles, and how many — just
//     add/remove pin codes from the array (order = tile order).
//   - withPower: true adds the ON/OFF power step (Relay-style); omit it
//     for read-only sensors like IR/Load Cell.
//   - glbModel: path to a .glb to show as an orbitable 3D model, or
//   - image: path to a flat PNG/JPG shown instead. Leave both unset and
//     the left panel is just blank — no placeholder shape is ever drawn.
// The modal's HTML shell (header/title/icon/badge copy) still lives in
// index.html per sensor, same as every other modal in this file — only
// the pin grid and the 3D view are generated from config, since those are
// the two things that actually change per sensor/board revision.
// =====================================================================

// Friendly on-screen labels for the generic digital pin set. P1-P11 match
// the labels port-label-field-patch.js already shows on the block itself;
// P12-P15 are this popup's own numbering for the 4 pins that patch doesn't
// cover. Purely cosmetic — the stored field value is always the raw code.
const ALL_PORT_LABELS = {
  D3: 'P1', D4: 'P2', D5: 'P3', D6: 'P4', D7: 'P5', E0: 'P6', E1: 'P7',
  G3: 'P8', G0: 'P9', G1: 'P10', G2: 'P11',
  E3: 'P12', G4: 'P13', G5: 'P14', G6: 'P15',
};

const SENSOR_POPUP_CONFIGS = {
  ir: {
    modalId: 'irSelectionModal', canvasId: 'ir3DCanvas', pinsContainerId: 'irPins',
    accent: '#b9ec10',
    pins: ['D3', 'D4', 'D5', 'D6', 'D7', 'E0', 'E1', 'G3'], // 8 pins — edit to add/remove
    withPower: true,
    powerRadioName: 'irState',
    glbModel: 'img/IRSENSOR.glb',
    image: null, // set to e.g. 'img/ir_sensor.png' to show a flat photo instead of a .glb
  },
  relay: {
    modalId: 'relaySelectionModal', canvasId: 'relay3DCanvas', pinsContainerId: 'relayPins',
    accent: '#154360',
    pins: ['D3', 'D4', 'D5', 'D6', 'D7', 'E0', 'E1', 'G3'], // 8 pins — edit to add/remove
    withPower: true,
    powerRadioName: 'relayState',
    glbModel: null, // set to e.g. 'assets/models/relay.glb' once you have a real model
    image: 'img/relaysensor.png', // or set to e.g. 'img/relay.png' for a flat photo instead of a .glb
  },
  loadcell: {
    modalId: 'loadcellSelectionModal', canvasId: 'loadcell3DCanvas', pinsContainerId: 'loadcellPins',
    accent: '#6B7280',
    pins: ['D3', 'D4', 'D5', 'D6', 'D7', 'E0', 'E1', 'G3'], // 8 pins — edit to add/remove
    withPower: true,
    powerRadioName: 'loadcellState',
    glbModel: null, // set to e.g. 'assets/models/load_cell.glb' once you have a real model
    image: null, // or set to e.g. 'img/load_cell.png' for a flat photo instead of a .glb
  },
  waterpump: {
    modalId: 'waterpumpSelectionModal', canvasId: 'waterpump3DCanvas', pinsContainerId: 'waterpumpPins',
    accent: '#0EA5E9',
    pins: ['D3', 'D4', 'D5', 'D6', 'D7', 'E0', 'E1', 'G3'], // 8 pins — edit to add/remove
    withPower: true,
    powerRadioName: 'waterpumpState',
    // Waterpump has no separate STATE field — reuse its existing ANGLE
    // field for the ON/OFF toggle instead (ON = fully open, OFF = closed).
    powerFieldName: 'ANGLE', powerOnValue: '180', powerOffValue: '0',
    glbModel: null, // set to e.g. 'img/WATERPUMP.glb' once you have a real model
    image: null, // or set to e.g. 'img/waterpump.png' for a flat photo instead of a .glb
  },
};

const currentSensorBlock = {}; // sensor key -> the Blockly block instance the popup is editing

// Builds (once) the checkbox tiles for a sensor's pin grid from its config,
// reusing the exact same tile markup/classes the Minifan modal hand-writes.
function renderSensorPinGrid(key) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  const container = document.getElementById(cfg.pinsContainerId);
  if (!container || container.dataset.rendered === '1') return;
  container.innerHTML = cfg.pins.map(code => `
    <label class="mf-pin-label">
      <input type="checkbox" id="${key}Pin${code}" style="display:none;" onchange="updateSensorPinUI('${key}')">
      <div class="mf-port-box">
        ${ALL_PORT_LABELS[code] || code}
        <div class="mf-port-check">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
    </label>`).join('');
  container.dataset.rendered = '1';
}

// Syncs the .selected class on every pin tile for a sensor to match its checkboxes.
function updateSensorPinUI(key) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  if (!cfg) return;
  cfg.pins.forEach(code => {
    const cb = document.getElementById(key + 'Pin' + code);
    if (!cb) return;
    const box = cb.nextElementSibling;
    const check = box && box.querySelector('.mf-port-check');
    if (cb.checked) {
      box.classList.add('selected');
      if (check) check.classList.add('selected');
    } else {
      box.classList.remove('selected');
      if (check) check.classList.remove('selected');
    }
  });
}

function updateSensorPowerUI(key) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  if (!cfg || !cfg.withPower) return;
  const radios = document.querySelectorAll(`input[name="${cfg.powerRadioName}"]`);
  radios.forEach(r => {
    const box = r.nextElementSibling;
    if (r.checked) box.classList.add('selected'); else box.classList.remove('selected');
  });
}

// Updates a slider step's numeric readout + filled-track gradient to match
// its current value — same visual treatment as the Minifan speed slider,
// generalised so any sensor with a numeric field (angle, speed, %...) can
// use it via cfg.withSlider instead of copy-pasting the fan's slider code.
function updateSensorSliderUI(key) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  if (!cfg || !cfg.withSlider) return;
  const slider = document.getElementById(key + 'Slider');
  const valueEl = document.getElementById(key + 'SliderVal');
  if (!slider) return;
  if (valueEl) valueEl.textContent = slider.value;
  const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.background = `linear-gradient(to right, var(--modal-accent, #FF9800) ${pct}%, #ddd ${pct}%)`;
}

function openSensorModal(key, block) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  if (!cfg) return;
  currentSensorBlock[key] = block;
  renderSensorPinGrid(key);

  const selected = new Set((block.getFieldValue('PORTS') || '').split(',').map(s => s.trim()).filter(Boolean));
  cfg.pins.forEach(code => {
    const cb = document.getElementById(key + 'Pin' + code);
    if (cb) cb.checked = selected.has(code);
  });
  updateSensorPinUI(key);

  if (cfg.withPower) {
    // Defaults match Relay/IR/Load Cell's plain STATE 0/1 field. A sensor
    // can point this at a different field/values instead — e.g. Water Pump
    // reuses its existing ANGLE field, ON=180 OFF=0, rather than needing a
    // separate STATE field just for the popup.
    const fieldName = cfg.powerFieldName || 'STATE';
    const onValue = cfg.powerOnValue !== undefined ? cfg.powerOnValue : '1';
    const state = String(block.getFieldValue(fieldName) ?? '0');
    const radio = document.querySelector(`input[name="${cfg.powerRadioName}"][value="${state === String(onValue) ? 'ON' : 'OFF'}"]`);
    if (radio) radio.checked = true;
    updateSensorPowerUI(key);
  }

  if (cfg.withSlider) {
    const slider = document.getElementById(key + 'Slider');
    if (slider) {
      const val = block.getFieldValue(cfg.sliderFieldName);
      slider.value = (val === '' || val === null || typeof val === 'undefined') ? cfg.sliderDefault : val;
      updateSensorSliderUI(key);
    }
  }

  document.getElementById(cfg.modalId).style.display = 'flex';
  setTimeout(() => setupSensorLeftPanel(key, cfg), 50);
}

// Decides what the left panel actually shows: a real .glb (3D, orbitable),
// a flat photo, or — if neither is configured for this sensor yet — nothing
// at all. No placeholder/generated shape is ever shown; an unconfigured
// sensor's left panel is just blank until you set glbModel or image.
function setupSensorLeftPanel(key, cfg) {
  const canvas = document.getElementById(cfg.canvasId);
  const img = document.getElementById(key + 'Image');
  const hint = canvas && canvas.parentElement && canvas.parentElement.querySelector('.mf-3d-hint');
  const loadMsg = document.getElementById(key + 'LoadMsg');

  if (cfg.glbModel) {
    if (img) img.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    if (hint) hint.style.display = '';
    initSensorBoard3D(cfg.canvasId, cfg);
  } else if (cfg.image) {
    if (canvas) canvas.style.display = 'none';
    if (hint) hint.style.display = 'none';
    if (loadMsg) loadMsg.style.display = 'none';
    if (img) { img.src = cfg.image; img.style.display = 'block'; }
  } else {
    if (canvas) canvas.style.display = 'none';
    if (img) img.style.display = 'none';
    if (hint) hint.style.display = 'none';
    if (loadMsg) loadMsg.style.display = 'none';
  }
}

function closeSensorModal(key) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  if (!cfg) return;
  document.getElementById(cfg.modalId).style.display = 'none';
  destroySensorBoard3D(cfg.canvasId);
}

function saveSensorSelection(key) {
  const cfg = SENSOR_POPUP_CONFIGS[key];
  const block = currentSensorBlock[key];
  if (!cfg || !block) { closeSensorModal(key); return; }

  const sel = [];
  cfg.pins.forEach(code => { const cb = document.getElementById(key + 'Pin' + code); if (cb && cb.checked) sel.push(code); });
  block.setFieldValue(sel.length ? sel.join(',') : '', 'PORTS');

  if (cfg.withPower) {
    const fieldName = cfg.powerFieldName || 'STATE';
    const onValue = cfg.powerOnValue !== undefined ? cfg.powerOnValue : '1';
    const offValue = cfg.powerOffValue !== undefined ? cfg.powerOffValue : '0';
    const powerElem = document.querySelector(`input[name="${cfg.powerRadioName}"]:checked`);
    if (powerElem) block.setFieldValue(powerElem.value === 'ON' ? onValue : offValue, fieldName);
  }

  if (cfg.withSlider) {
    const slider = document.getElementById(key + 'Slider');
    if (slider) block.setFieldValue(slider.value, cfg.sliderFieldName);
  }

  closeSensorModal(key);
}

// ══════════════════════════════════════════════════════════════
// Reusable "sensor board" 3D preview rig (Three.js r128) — orbit-drag
// camera + render loop + lighting, same as the Minifan/Bike viewers.
// Only called (from setupSensorLeftPanel) when cfg.glbModel is set; it
// loads that .glb (same loader/scale/centre pattern as
// js/main/bike-3d-model.js). No procedural placeholder is ever drawn — if
// the load fails, the canvas just stays empty and the on-screen message
// says why (see loadSensorGlb below).
// ══════════════════════════════════════════════════════════════
const sensorBoard3D = {}; // canvasId -> per-canvas Three.js state

function initSensorBoard3D(canvasId, cfg) {
  const state = sensorBoard3D[canvasId] || (sensorBoard3D[canvasId] = { initialized: false });
  if (state.initialized) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof THREE === 'undefined') return;

  const rect = canvas.parentElement.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.width = W * 2; canvas.height = H * 2;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
  camera.position.set(2.4, 1.8, 2.4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(2);

  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(5, 7, 6);
  scene.add(dirLight);

  // Orbit drag (same rig as the Minifan/Bike 3D viewers)
  let isDrag = false, prevM = { x: 0, y: 0 };
  let camTheta = 0.7, camPhi = 0.6, camDist = 3.2;
  function updateCam() {
    camera.position.x = camDist * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.y = camDist * Math.cos(camPhi);
    camera.position.z = camDist * Math.sin(camPhi) * Math.sin(camTheta);
    camera.lookAt(0, 0, 0);
  }
  canvas.addEventListener('pointerdown', (e) => { isDrag = true; prevM = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!isDrag) return; camTheta += (e.clientX - prevM.x) * 0.01; camPhi = Math.max(0.15, Math.min(1.4, camPhi + (e.clientY - prevM.y) * 0.01)); prevM = { x: e.clientX, y: e.clientY }; updateCam(); });
  canvas.addEventListener('pointerup', () => { isDrag = false; });
  canvas.addEventListener('pointerleave', () => { isDrag = false; });

  state.scene = scene; state.camera = camera; state.renderer = renderer;
  state.initialized = true; state.t = 0;

  // Optional <span id="{key}LoadMsg"> next to the canvas — shows load
  // progress/errors so a failed/missing .glb is visible instead of just
  // silently leaving a blank canvas with no explanation.
  const loadMsg = document.getElementById(canvasId.replace('3DCanvas', 'LoadMsg'));

  if (typeof THREE.GLTFLoader === 'undefined') {
    console.error('[SensorGLB]', cfg.glbModel, 'set but THREE.GLTFLoader is not loaded — check offline_libs/three/GLTFLoader.js is included before modals.js');
    if (loadMsg) { loadMsg.textContent = 'GLTFLoader unavailable'; loadMsg.style.display = 'block'; }
  } else {
    if (loadMsg) { loadMsg.textContent = 'Loading model…'; loadMsg.style.display = 'block'; }
    loadSensorGlb(scene, cfg.glbModel, (sceneObjects, error) => {
      state.sceneObjects = sceneObjects;
      if (loadMsg) {
        if (error) { loadMsg.textContent = 'Model failed to load: ' + (error.message || error); }
        else { loadMsg.style.display = 'none'; }
      }
    });
  }

  animateSensorBoard3D(canvasId);
}

// Loads a .glb model into a sensor's scene, auto-scaled to a consistent
// ~1.6 unit footprint and centred/sat on the ground — same approach as
// js/main/bike-3d-model.js's bike.glb loader. onReady is called as
// onReady(sceneObjects, errorOrNull); on error, sceneObjects is null and
// the canvas is left empty (see initSensorBoard3D) rather than drawing a
// placeholder shape.
function loadSensorGlb(scene, glbPath, onReady) {
  try {
    const loader = new THREE.GLTFLoader();
    // Draco-compressed .glb (exported with mesh compression, e.g. from
    // Blender's glTF exporter) needs a DRACOLoader or GLTFLoader throws
    // "No DRACOLoader instance provided" instead of loading. Same decoder
    // path the soil-sensor 3D popup already uses successfully above.
    if (typeof THREE.DRACOLoader !== 'undefined') {
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('offline_libs/draco/');
      loader.setDRACOLoader(dracoLoader);
    }
    loader.load(glbPath, function (gltf) {
      const model = gltf.scene;
      if (!model) { onReady(null, new Error('glb had no scene')); return; }

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = 1.6 / Math.max(size.x, size.y, size.z, 0.0001);
      model.scale.setScalar(scale);

      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box2.min.y;

      model.traverse(child => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      scene.add(model);
      console.log('[SensorGLB] loaded', glbPath, '- scaled x' + scale.toFixed(3));
      onReady({ model }, null);
    }, undefined, function (err) {
      console.error('[SensorGLB] load error for', glbPath, err);
      onReady(null, err || new Error('load error'));
    });
  } catch (e) {
    console.error('[SensorGLB] init error for', glbPath, e);
    onReady(null, e);
  }
}

function animateSensorBoard3D(canvasId) {
  const state = sensorBoard3D[canvasId];
  if (!state || !state.initialized) return;
  state.animId = requestAnimationFrame(() => animateSensorBoard3D(canvasId));
  state.t += 0.04;
  if (state.sceneObjects && typeof state.sceneObjects.animate === 'function') {
    state.sceneObjects.animate(state.t);
  }
  state.renderer.render(state.scene, state.camera);
}

function destroySensorBoard3D(canvasId) {
  const state = sensorBoard3D[canvasId];
  if (!state) return;
  if (state.animId) cancelAnimationFrame(state.animId);
  if (state.renderer) state.renderer.dispose();
  sensorBoard3D[canvasId] = { initialized: false };
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

