// Override Field getText to show P1, P2... instead of D3, D4... visually
(function () {
  function patchBlocklyField() {
    if (window.Blockly && window.Blockly.Field && !window.Blockly.Field.prototype._isPatchedForPorts) {
      const origGetText = window.Blockly.Field.prototype.getText;
      const PORT_D_TO_P = {
        'D3': 'P1', 'D4': 'P2', 'D5': 'P3', 'D6': 'P4', 'D7': 'P5', 'E0': 'P6', 'E1': 'P7', 'G3': 'P8', 'G0': 'P9', 'G1': 'P10', 'G2': 'P11',
        'C0': 'P1', 'C1': 'P2', 'C2': 'P3', 'F9': 'P4', 'C4': 'P5', 'C5': 'P6', 'A1': 'P7', 'A2': 'P8', 'A4': 'P9', 'F8': 'P10', 'A6': 'P11'
      };

      function patchedGetText() {
        const val = origGetText.call(this);
        if (this.name === 'MOTORS' && typeof val === 'string') {
          let res = [];
          if (val.includes('E11') || val.includes('E12')) res.push('P1');
          if (val.includes('B8') || val.includes('B9')) res.push('P2');
          if (val.includes('E13') || val.includes('B15')) res.push('P3');
          if (val.includes('D15') || val.includes('E14')) res.push('P4');
          if (res.length > 0) return res.join(',');
        } else if (this.name === 'PORTS' && typeof val === 'string') {
          return val.split(',').map(s => PORT_D_TO_P[s.trim()] || s).join(',');
        }
        return val;
      }

      window.Blockly.Field.prototype.getText = patchedGetText;
      if (window.Blockly.FieldLabel && window.Blockly.FieldLabel.prototype.getText === origGetText) {
        window.Blockly.FieldLabel.prototype.getText = patchedGetText;
      }
      window.Blockly.Field.prototype._isPatchedForPorts = true;

      // Force rerender all existing blocks if workspace exists
      if (typeof workspace !== 'undefined' && workspace) {
        workspace.getAllBlocks(false).forEach(b => {
          if (b.getField('PORTS')) b.getField('PORTS').forceRerender();
          if (b.getField('MOTORS')) b.getField('MOTORS').forceRerender();
        });
      }
    }
  }

  // Try now, or wait for Blockly to load
  if (window.Blockly && window.Blockly.Field) {
    patchBlocklyField();
  } else {
    window.addEventListener('load', () => setTimeout(patchBlocklyField, 1500));
  }
})();
