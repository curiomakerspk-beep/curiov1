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

