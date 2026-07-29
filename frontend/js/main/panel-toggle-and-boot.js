// ── Panel toggle: Split → Python full → Terminal full → Split ────────────
(function () {
  const STATES = ['split', 'pyout', 'terminal'];
  const LABELS = { split: '⬍ Split', pyout: '▣ Python', terminal: '▤ Terminal' };
  let idx = 0;
  window.cyclePanelView = function () {
    idx = (idx + 1) % STATES.length;
    const panel = document.getElementById('codePanel');
    const btn = document.getElementById('panelToggleBtn');
    panel.classList.remove('show-pyout-only', 'show-terminal-only');
    if (STATES[idx] === 'pyout') panel.classList.add('show-pyout-only');
    if (STATES[idx] === 'terminal') panel.classList.add('show-terminal-only');
    btn.textContent = LABELS[STATES[idx]];
    // Re-center action bar after panel layout change
    if (typeof positionActionBar === 'function') {
      positionActionBar();
      setTimeout(positionActionBar, 320);
    }
  };
})();

// ── Project Dropdown toggle ─────────────────────────────────────────────
window.toggleProjectDropdown = function () {
  const panel = document.getElementById('projectTabs');
  const toggle = document.getElementById('projectTabsToggle');
  if (!panel || !toggle) return;
  const isOpen = panel.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
};

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
  const wrapper = document.getElementById('projectTabsWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const panel = document.getElementById('projectTabs');
    const toggle = document.getElementById('projectTabsToggle');
    if (panel) panel.classList.remove('open');
    if (toggle) toggle.classList.remove('open');
  }
});

window.addEventListener('load', start);
