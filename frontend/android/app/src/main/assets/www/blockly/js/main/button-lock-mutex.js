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

