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

