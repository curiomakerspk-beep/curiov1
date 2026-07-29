
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
// Both start hidden (see js/main/toolbox-config.js). Picking K230 adds "K230 AI Vision";
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
