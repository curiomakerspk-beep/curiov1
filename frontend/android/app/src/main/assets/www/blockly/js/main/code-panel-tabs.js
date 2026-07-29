/* ═══════════════════════════════════════════════════════════════
   PREMIUM CODE PANEL — Global Tab Switcher & AI Chat Functions
   (must be global for onclick= attributes to work)
═══════════════════════════════════════════════════════════════ */

function switchCPTab(tab) {
  document.querySelectorAll('.cp-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.id === 'tab-' + tab);
  });
  document.querySelectorAll('.cp-pane').forEach(function (pane) {
    pane.classList.toggle('active', pane.id === 'pane-' + tab);
  });
  if (tab === 'terminal') {
    var rd = document.getElementById('responseDisplay');
    if (rd) setTimeout(function () { rd.scrollTop = rd.scrollHeight; }, 50);
  }
}

function cyclePanelView() {
  var btn = document.getElementById('panelToggleBtn');
  var panel = document.getElementById('codePanel');
  if (!panel) return;
  var states = ['split', 'code-only', 'terminal-only'];
  var current = panel.dataset.viewState || 'split';
  var next = states[(states.indexOf(current) + 1) % states.length];
  panel.dataset.viewState = next;
  if (btn) {
    var labels = {
      'split': '<i class="fa-solid fa-table-columns" style="font-size:8px"></i> Split',
      'code-only': '<i class="fa-solid fa-code" style="font-size:8px"></i> Code',
      'terminal-only': '<i class="fa-solid fa-terminal" style="font-size:8px"></i> Term'
    };
    btn.innerHTML = labels[next] || labels['split'];
  }
}

function rdClear() {
  var rd = document.getElementById('responseDisplay');
  if (rd) rd.innerHTML = '';
}

function cpAiAppendMessage(role, text) {
  var messages = document.getElementById('cpAiMessages');
  if (!messages) return;
  var div = document.createElement('div');
  if (role === 'bot') {
    div.className = 'ai-msg-bot';
    div.innerHTML = '<div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>' +
      '<div class="ai-msg-bubble">' + text + '</div>';
  } else {
    div.className = 'ai-msg-user';
    div.innerHTML = '<div class="ai-msg-user-bubble">' + text + '</div>';
  }
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function cpAiShowTyping() {
  var messages = document.getElementById('cpAiMessages');
  if (!messages) return null;
  var div = document.createElement('div');
  div.className = 'ai-typing';
  div.id = 'cpAiTyping';
  div.innerHTML = '<div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>' +
    '<div class="ai-typing-dots"><span></span><span></span><span></span></div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function cpAiSend() {
  var input = document.getElementById('cpAiInputField');
  if (!input) return;
  var text = (input.value || '').trim();
  if (!text) return;
  input.value = '';
  cpAiQuickSend(text);
}

function toggleApiKeyPanel(forceOpen) {
  var panel = document.getElementById('cpAiApiKeyPanel');
  if (!panel) return;
  var isHidden = panel.style.display === 'none' || !panel.style.display;
  if (forceOpen === true) isHidden = true;
  else if (forceOpen === false) isHidden = false;
  
  if (isHidden) {
    panel.style.display = 'flex';
    var key = localStorage.getItem('openrouter_api_key') || '';
    var input = document.getElementById('cpAiApiKeyInput');
    if (input) {
      input.value = key;
      input.focus();
    }
    
    // Load and populate the saved AI model
    var model = localStorage.getItem('openrouter_model') || 'nex-agi/nex-n2-pro:free';
    var modelSelect = document.getElementById('cpAiModelSelect');
    if (modelSelect) {
      modelSelect.value = model;
    }
    
    var status = document.getElementById('cpAiKeyStatus');
    if (status) {
      status.textContent = key ? 'API key is configured.' : 'No API key set.';
      status.style.color = key ? '#22c55e' : '#64748b';
    }
  } else {
    panel.style.display = 'none';
  }
}

function saveApiKey() {
  var input = document.getElementById('cpAiApiKeyInput');
  if (!input) return;
  var key = input.value.trim();
  var status = document.getElementById('cpAiKeyStatus');
  if (key) {
    localStorage.setItem('openrouter_api_key', key);
    if (status) {
      status.textContent = 'API key saved successfully!';
      status.style.color = '#22c55e';
    }
    setTimeout(function() {
      toggleApiKeyPanel(false);
    }, 800);
  } else {
    localStorage.removeItem('openrouter_api_key');
    if (status) {
      status.textContent = 'API key removed.';
      status.style.color = '#ef4444';
    }
  }
}

function saveAiModel() {
  var select = document.getElementById('cpAiModelSelect');
  if (select) {
    localStorage.setItem('openrouter_model', select.value);
  }
}

function cpAiFormatMarkdown(text) {
  if (!text) return '';
  
  // 1. Escape HTML
  var html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Code blocks (e.g. ```python ... ```)
  html = html.replace(/```(?:python|py|javascript|js)?\n([\s\S]*?)\n```/g, function(match, code) {
    return '<pre class="ai-code-block">' + code.trim() + '</pre>';
  });

  // 3. Inline code (e.g. `code`)
  html = html.replace(/`([^`\n]+)`/g, '<code class="ai-inline-code">$1</code>');

  // 4. Bold text
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 5. Italic text
  html = html.replace(/\*([^*]+)\*\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 6. Bullet lists
  html = html.replace(/^\s*[-*+]\s+(.+)$/gm, '<li style="margin-left: 14px; margin-top: 4px; list-style-type: disc;">$1</li>');
  
  // 7. Newlines
  html = html.replace(/\n\n/g, '</p><p style="margin-bottom: 8px;">');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap paragraphs
  html = '<p style="margin: 0; margin-bottom: 8px; line-height: 1.55;">' + html + '</p>';
  html = html.replace(/<p[^>]*><\/p>/g, '');
  
  return html;
}

function cpAiQuickSend(text) {
  cpAiAppendMessage('user', text);
  var chips = document.getElementById('cpAiChips');
  if (chips) chips.style.display = 'none';
  
  var key = localStorage.getItem('openrouter_api_key');
  if (!key) {
    setTimeout(function() {
      var warningHtml = 
        '<div style="display: flex; flex-direction: column; gap: 8px;">' +
        '  <span>To use real AI chat, please add your OpenRouter API Key. This will allow Curio to inspect your workspace blocks, generated Python code, and answer questions.</span>' +
        '  <div style="display: flex; gap: 8px; margin-top: 4px;">' +
        '    <button onclick="toggleApiKeyPanel(true)" class="ai-chip" style="background: #3D5AE0; color: #fff; border: none; margin: 0; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">Set API Key 🔑</button>' +
        '    <a href="https://openrouter.ai/keys" target="_blank" class="ai-chip" style="background: #F1F4FF; border: 1px solid #DDE1F5; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; margin: 0; padding: 6px 12px; border-radius: 6px; font-weight: 600; color: #3D5AE0;">Get Key <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px; margin-left: 4px;"></i></a>' +
        '  </div>' +
        '</div>';
      cpAiAppendMessage('bot', warningHtml);
    }, 600);
    return;
  }
  
  var model = localStorage.getItem('openrouter_model') || 'nex-agi/nex-n2-pro:free';
  var typing = cpAiShowTyping();
  var code = '';
  try {
    var pyOut = document.getElementById('pyOut');
    if (pyOut) code = pyOut.textContent || '';
  } catch (e) { }

  var terminalLogs = '';
  try {
    var rd = document.getElementById('responseDisplay');
    if (rd) {
      var rawText = rd.innerText || rd.textContent || '';
      var lines = rawText.split('\n').filter(function(line) { return line.trim() !== ''; });
      terminalLogs = lines.slice(-15).join('\n');
    }
  } catch (e) { }

  var deviceStatus = 'Not Connected';
  try {
    var statusEl = document.getElementById('dp-usb-status');
    if (statusEl) {
      deviceStatus = statusEl.textContent || statusEl.innerText || 'Not Connected';
    }
  } catch (e) { }
  
  // Construct the prompt with system role/context
  var currentDateTime = new Date().toLocaleString();
  var systemPrompt = 
    "You are Curio, a friendly and smart AI coding assistant for a Blockly-based hardware coding application.\n" +
    "The user builds hardware programs using visual blocks which generate Python code. This Python runs on their board (e.g. STM32 microcontroller).\n\n" +
    "Current date and time: " + currentDateTime + "\n\n" +
    "--- REAL-TIME HARDWARE DATA ---\n" +
    "Target Hardware Board: STM32 microcontroller\n" +
    "Hardware Connection Status: " + deviceStatus + "\n\n" +
    "Here is the user's current generated Python code:\n" +
    "```python\n" +
    (code.trim() || "# No blocks on workspace yet.") + "\n" +
    "```\n\n" +
    "Here are the latest terminal/serial logs from the board:\n" +
    "```\n" +
    (terminalLogs.trim() || "(No terminal output logs yet.)") + "\n" +
    "```\n\n" +
    "--- CUSTOM PROJECT LIBRARIES (REFERENCE) ---\n" +
    "If the code references custom project libraries, use these rules:\n" +
    "- AI2D: Hardware image preprocessor. Key methods: crop(x,y,w,h), resize(method,mode), build(in_shape,out_shape), run(input_np).\n" +
    "- AIBase: Base class for K230 KPU inference. Handles load_kmodel(), preprocess(), inference().\n" +
    "- PipeLine: K230 camera pipeline manager. CAM_CHN_ID_0 is for VO display output, CAM_CHN_ID_2 is RGB888 planar for AI input. Get frame using snapshot().\n" +
    "- YbProtocol: Robot serial protocol. String format: '$LL,II,data#\\n' where LL=length, II=function ID (e.g. 06=FACE_DETECT, 11=HAND_DETECT, 14=OBJECT_DETECT).\n\n" +
    "Please answer the user's question. Keep answers clear, engaging, and relatively short. Use bullet points and code formatting where necessary.\n" +
    "If the user is asking about errors, look at the terminal logs. If they ask about board issues, look at the connection status.";
  
  fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Curio Blockly Labs'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: systemPrompt + "\n\nUser Question: " + text
        }
      ]
    })
  })
  .then(function(response) {
    if (response.status === 402) {
      throw new Error('Payment Required (Status 402). Your OpenRouter account may need credits to use the model: ' + model + '. Please add credits or switch to a free model (e.g., Gemma 2 9B (Free)) in the settings.');
    }
    if (!response.ok) {
      throw new Error('API returned status ' + response.status);
    }
    return response.json();
  })
  .then(function(data) {
    if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
    
    var replyText = '';
    try {
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        replyText = data.choices[0].message.content;
      } else {
        replyText = "Sorry, I received an empty response. Please verify your prompt or try again.";
      }
    } catch(err) {
      replyText = "Error parsing AI response: " + err.message;
    }
    
    var replyHtml = cpAiFormatMarkdown(replyText);
    cpAiAppendMessage('bot', replyHtml);
  })
  .catch(function(error) {
    if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
    
    var errorHtml = 
      '<div style="color: #ef4444; font-weight: 500;">' +
      '  <i class="fa-solid fa-triangle-exclamation"></i> Chat failed: ' + error.message + ' (Model: ' + model + ')' +
      '</div>' +
      '<div style="font-size: 10px; margin-top: 4px; opacity: 0.8;">' +
      '  Please check your internet connection, confirm that your OpenRouter API Key is active, and try again.' +
      '</div>';
    cpAiAppendMessage('bot', errorHtml);
    console.error('OpenRouter API Error:', error);
  });
}

function cpAiClearChat() {
  var messages = document.getElementById('cpAiMessages');
  if (!messages) return;
  messages.innerHTML = '<div class="ai-msg-bot"><div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div><div class="ai-msg-bubble">Hi! I\'m Curio, your coding buddy. Ask me about your blocks, the code, or anything in the terminal — I\'ll explain it the easy way.</div></div>';
  var chips = document.getElementById('cpAiChips');
  if (chips) chips.style.display = 'flex';
}

// Automatically seed/update the OpenRouter API key and model on load
(function() {
  // Always keep the API key up to date
  var CURRENT_KEY = '';
  if (CURRENT_KEY) {
    localStorage.setItem('openrouter_api_key', CURRENT_KEY);
  }

  // Valid free models as of June 2026 — reset to default if stored model is outdated/paid
  var FREE_MODELS = [
    'nex-agi/nex-n2-pro:free',
    'google/gemma-2-9b-it:free',
    'openrouter/free'
  ];
  var storedModel = localStorage.getItem('openrouter_model');
  if (!storedModel || (FREE_MODELS.indexOf(storedModel) === -1 && storedModel !== 'qwen/qwen-2.5-coder-32b-instruct' && storedModel !== 'google/gemini-3.5-flash' && storedModel !== 'google/gemini-3.1-pro')) {
    localStorage.setItem('openrouter_model', 'nex-agi/nex-n2-pro:free');
  }
})();
