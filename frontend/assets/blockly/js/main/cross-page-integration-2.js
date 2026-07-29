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

