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
