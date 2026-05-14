// ═════════════════════════════════════════════════════
// ECO TRANSLATE — Bilingual Transcription & Translation
// Web Speech API + Google Translate + MyMemory
// ═════════════════════════════════════════════════════

(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  // ─── ELEMENTS ───
  const modeSelector = document.getElementById('modeSelector');
  const captionArea = document.getElementById('captionArea');
  const modeButtons = document.querySelectorAll('.mode-button');
  const micButton = document.getElementById('micButton');
  const settingsBtn = document.getElementById('settingsBtn');
  const accPanel = document.getElementById('accPanel');
  const accToggle = settingsBtn;
  const accClose = document.getElementById('accClose');
  const toolbar = document.querySelector('.toolbar');
  const captionViewport = document.querySelector('.caption-viewport');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const timerToggle = document.getElementById('timerToggle');
  const timerPanel = document.getElementById('timerPanel');
  const timerMenuWrap = document.getElementById('timerMenuWrap');

  // ─── STATE ───
  let isListening = false;
  let recognition;
  let currentLang = 'en-US';
  let capHistory = [];
  let lastTranslationTime = 0;
  let pendingTranslation = null;
  let translationTimeout = null;
  const translationDebounceMs = 1800;

  // ─── ACCESSIBILITY ───
  const fontSizeInput = document.getElementById('fontSizeInput');
  const updateSpeedInput = document.getElementById('updateSpeedInput');
  const silenceSensInput = document.getElementById('silenceSensInput');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const translationHistory = document.getElementById('translationHistory');

  // ─── INIT ───
  if (!SpeechRecognition) {
    alert('Web Speech API not supported. Use Chrome, Edge, or Safari.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  // ─── MODE SWITCHING ───
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'captions') {
        captionArea.classList.add('show');
        modeSelector.classList.add('hide');
        setTimeout(() => { modeSelector.style.display = 'none'; }, 500);
        startListening();
      } else if (mode === 'landing') {
        stopListening();
        captionArea.classList.remove('show');
        setTimeout(() => {
          modeSelector.style.display = 'flex';
          modeSelector.classList.remove('hide');
        }, 200);
      }
    });
  });

  // ─── MICROPHONE CONTROL ───
  function startListening() {
    if (isListening) return;
    isListening = true;
    micButton.classList.add('listening');
    
    recognition.start();
    recognition.lang = currentLang;
  }

  function stopListening() {
    if (!isListening) return;
    isListening = false;
    micButton.classList.remove('listening');
    recognition.abort();
  }

  micButton.addEventListener('click', () => {
    if (isListening) stopListening();
    else startListening();
  });

  // ─── SPEECH RECOGNITION ───
  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add('listening');
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove('listening');
    if (captionArea.classList.contains('show')) {
      setTimeout(() => startListening(), 500);
    }
  };

  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e.error);
    if (isListening && captionArea.classList.contains('show')) {
      setTimeout(() => startListening(), 1000);
    }
  };

  recognition.onresult = (e) => {
    let isFinal = false;
    let transcript = '';
    
    for (let i = e.resultIndex; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript + ' ';
      if (e.results[i].isFinal) isFinal = true;
    }
    
    transcript = transcript.trim();
    if (!transcript) return;

    // Detect language
    const detectedLang = detectLanguage(transcript);
    const isSpanish = detectedLang === 'es';
    
    // Display on appropriate side
    const enCol = captionViewport.querySelector('.caption-col.en .caption-text');
    const esCol = captionViewport.querySelector('.caption-col.es .caption-text');
    
    if (isSpanish) {
      if (esCol) esCol.textContent = transcript;
      if (isFinal) {
        debouncedTranslate(transcript, 'es', 'en');
      }
    } else {
      if (enCol) enCol.textContent = transcript;
      if (isFinal) {
        debouncedTranslate(transcript, 'en', 'es');
      }
    }

    if (isFinal) {
      capHistory.push({ text: transcript, lang: isSpanish ? 'es' : 'en' });
      updateHistoryDisplay();
    }
  };

  // ─── LANGUAGE DETECTION ───
  function detectLanguage(text) {
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'es', 'por', 'para', 'una', 'con', 'su', 'del', 'no', 'como', 'más', 'está', 'entre', 'también'];
    const words = text.toLowerCase().split(/\s+/);
    let spanishCount = 0;
    words.forEach(word => {
      if (spanishWords.includes(word)) spanishCount++;
    });
    return spanishCount > words.length * 0.2 ? 'es' : 'en';
  }

  // ─── TRANSLATION (debounced) ───
  function debouncedTranslate(text, fromLang, toLang) {
    clearTimeout(translationTimeout);
    pendingTranslation = { text, fromLang, toLang };
    translationTimeout = setTimeout(() => {
      if (pendingTranslation) {
        translate(pendingTranslation.text, pendingTranslation.fromLang, pendingTranslation.toLang);
        pendingTranslation = null;
      }
    }, translationDebounceMs);
  }

  async function translate(text, fromLang, toLang) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (data.responseData.translatedText) {
        const translated = data.responseData.translatedText;
        const col = toLang === 'es' ? '.caption-col.es' : '.caption-col.en';
        const textEl = captionViewport.querySelector(`${col} .caption-text`);
        if (textEl) textEl.textContent = translated;
      }
    } catch (err) {
      console.error('Translation error:', err);
    }
  }

  // ─── ACCESSIBILITY PANEL ───
  accClose.addEventListener('click', () => {
    accPanel.classList.remove('open');
    accToggle.classList.remove('open');
  });

  settingsBtn.addEventListener('click', () => {
    const isOpen = accPanel.classList.contains('open');
    if (isOpen) {
      accPanel.classList.remove('open');
      settingsBtn.classList.remove('open');
    } else {
      accPanel.classList.add('open');
      settingsBtn.classList.add('open');
      const timerPnl = document.getElementById('timerPanel');
      const timerTog = document.getElementById('timerToggle');
      if (timerPnl && timerTog) {
        timerPnl.classList.remove('open');
        timerTog.classList.remove('open');
      }
    }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    const isClickInside = accPanel.contains(e.target) || settingsBtn.contains(e.target);
    if (!isClickInside && accPanel.classList.contains('open')) {
      accPanel.classList.remove('open');
      settingsBtn.classList.remove('open');
    }
  });

  // ─── ACCESSIBILITY CONTROLS ───
  fontSizeInput.addEventListener('input', (e) => {
    const val = e.target.value;
    const captions = captionViewport.querySelectorAll('.caption-text');
    captions.forEach(cap => {
      cap.style.fontSize = `clamp(${val}px, 2vw, ${parseInt(val) + 10}px)`;
    });
  });

  updateSpeedInput.addEventListener('input', (e) => {
    const val = e.target.value;
    translationDebounceMs = parseInt(val);
  });

  silenceSensInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (recognition) recognition.maxAlternatives = Math.max(1, 3 - parseInt(val) / 50);
  });

  clearHistoryBtn.addEventListener('click', () => {
    capHistory = [];
    updateHistoryDisplay();
  });

  // ─── HISTORY DISPLAY ───
  function updateHistoryDisplay() {
    translationHistory.innerHTML = '';
    if (capHistory.length === 0) {
      translationHistory.innerHTML = '<div class="timer-history-empty">Sin histórico</div>';
      return;
    }
    capHistory.slice(-10).reverse().forEach(item => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px;border-bottom:0.5px solid rgba(255,255,255,0.07);font-size:10px;color:rgba(255,255,255,0.6);';
      div.textContent = item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '');
      translationHistory.appendChild(div);
    });
  }

  // ─── TAB AUDIO CAPTURE ───
  const tabAudioBtn = document.getElementById('tabAudioBtn');
  let mediaStream = null;

  tabAudioBtn.addEventListener('click', async () => {
    try {
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false
      });
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamAudioSource(mediaStream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const output = e.inputBuffer.getChannelData(0);
        const transcript = recognizeFromAudio(output);
        if (transcript) {
          const col = document.querySelector('.caption-col.en .caption-text');
          if (col) col.textContent = transcript;
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      tabAudioBtn.textContent = 'Stop Tab Audio';
      tabAudioBtn.classList.add('active');
    } catch (err) {
      console.log('Tab audio capture cancelled or not supported');
    }
  });

  function recognizeFromAudio(channelData) {
    // Placeholder: would need additional audio-to-text processing
    return '';
  }

  // Stop tab audio
  tabAudioBtn.addEventListener('click', () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
      tabAudioBtn.textContent = 'Capture Tab Audio';
      tabAudioBtn.classList.remove('active');
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// TIMER MODULE
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

(() => {
  // Elements
  const timerMenuWrap = document.getElementById('timerMenuWrap');
  const timerPanel = document.getElementById('timerPanel');
  const timerToggle = document.getElementById('timerToggle');
  const timerBigDisplay = document.getElementById('timerBigDisplay');
  const timerStatus = document.getElementById('timerStatus');
  const timerStartBtn = document.getElementById('timerStartBtn');
  const timerPauseBtn = document.getElementById('timerPauseBtn');
  const timerResetBtn = document.getElementById('timerResetBtn');
  const timerInputH = document.getElementById('timerInputH');
  const timerInputM = document.getElementById('timerInputM');
  const timerInputS = document.getElementById('timerInputS');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // State
  let timerSeconds = 0;
  let totalSeconds = 0;
  let isRunning = false;
  let timerInterval = null;

  // Display formatter
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Read from inputs
  function readInputSeconds() {
    const h = parseInt(timerInputH.value) || 0;
    const m = parseInt(timerInputM.value) || 0;
    const s = parseInt(timerInputS.value) || 0;
    return h * 3600 + m * 60 + s;
  }

  // Update display
  function updateDisplay() {
    if (timerBigDisplay) timerBigDisplay.textContent = formatTime(timerSeconds);
  }

  // Preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if(isRunning) return;
      const minutes = parseInt(btn.dataset.minutes);
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timerInputH.value = '00';
      timerInputM.value = String(minutes).padStart(2,'0');
      timerInputS.value = '00';
      timerSeconds = minutes * 60;
      totalSeconds = timerSeconds;
      updateDisplay();
      if(timerStatus) timerStatus.textContent = `${minutes} min`;
      timerStartBtn.disabled = false;
    });
  });

  // Auto-avance: al escribir 2 dígitos pasa al siguiente campo
  function setupAutoAdvance(inp, nextInp, max) {
    inp.addEventListener('focus', () => { inp.select(); });
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '');
      presetBtns.forEach(b => b.classList.remove('active'));
      if(inp.value.length === 2) {
        const val = parseInt(inp.value);
        if(val > max) inp.value = String(max).padStart(2,'0');
        if(nextInp) { nextInp.focus(); nextInp.select(); }
      }
      // Habilitar Iniciar si hay tiempo
      const total = readInputSeconds();
      timerSeconds = total;
      totalSeconds = total;
      updateDisplay();
      timerStartBtn.disabled = total === 0;
    });
    inp.addEventListener('keydown', e => {
      if(e.key === 'Enter') timerStartBtn.click();
    });
  }

  setupAutoAdvance(timerInputH, timerInputM, 23);
  setupAutoAdvance(timerInputM, timerInputS, 59);
  setupAutoAdvance(timerInputS, null, 59);

  // Toggle panel
  timerToggle.addEventListener('click', () => {
    const isOpen = timerPanel.classList.contains('open');
    if(isOpen) {
      timerPanel.classList.remove('open');
      timerToggle.classList.remove('open');
    } else {
      timerPanel.classList.add('open');
      timerToggle.classList.add('open');
      const accPanel = document.getElementById('accPanel');
      const accToggle = document.getElementById('accToggle');
      if(accPanel && accToggle) {
        accPanel.classList.remove('open');
        accToggle.classList.remove('open');
      }
    }
  });

  // Start button — lee los inputs en el momento de iniciar
  timerStartBtn.addEventListener('click', () => {
    if(isRunning) return;
    const total = readInputSeconds();
    if(total === 0) { if(timerStatus) timerStatus.textContent = 'Ingresa un tiempo'; return; }
    timerSeconds = total;
    totalSeconds = total;
    updateDisplay();
    isRunning = true;
    if(timerBigDisplay){ timerBigDisplay.classList.add('running'); timerBigDisplay.classList.remove('finished'); }
    timerStartBtn.style.display = 'none';
    timerPauseBtn.style.display = 'flex';
    presetBtns.forEach(btn => btn.disabled = true);
    [timerInputH, timerInputM, timerInputS].forEach(i => i.disabled = true);

    timerInterval = setInterval(() => {
      timerSeconds--;
      updateDisplay();
      if(timerSeconds <= 0) {
        clearInterval(timerInterval);
        isRunning = false;
        timerSeconds = 0;
        updateDisplay();
        if(timerBigDisplay){ timerBigDisplay.classList.remove('running'); timerBigDisplay.classList.add('finished'); }
        timerPauseBtn.style.display = 'none';
        timerStartBtn.style.display = 'flex';
        presetBtns.forEach(btn => btn.disabled = false);
        [timerInputH, timerInputM, timerInputS].forEach(i => i.disabled = false);
        if(timerStatus) timerStatus.textContent = '⏰ ¡TIEMPO!';
      }
    }, 1000);
  });

  // Pause button
  timerPauseBtn.addEventListener('click', () => {
    isRunning = false;
    clearInterval(timerInterval);
    timerPauseBtn.style.display = 'none';
    timerStartBtn.style.display = 'flex';
    if(timerBigDisplay){ timerBigDisplay.classList.remove('running'); }
    if(timerStatus) timerStatus.textContent = 'Pausado';
  });

  // Reset button
  timerResetBtn.addEventListener('click', () => {
    isRunning = false;
    clearInterval(timerInterval);
    timerSeconds = 0;
    totalSeconds = 0;
    if(timerBigDisplay){ timerBigDisplay.classList.remove('running','finished'); }
    updateDisplay();
    timerPauseBtn.style.display = 'none';
    timerStartBtn.style.display = 'flex';
    timerStartBtn.disabled = true;
    presetBtns.forEach(btn => { btn.disabled = false; btn.classList.remove('active'); });
    [timerInputH, timerInputM, timerInputS].forEach(i => { i.disabled = false; i.value = '00'; });
    if(timerStatus) timerStatus.textContent = 'Selecciona un tiempo';
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    const isClickInside = timerPanel.contains(e.target) || timerToggle.contains(e.target);
    if(!isClickInside && timerPanel.classList.contains('open')) {
      timerPanel.classList.remove('open');
      timerToggle.classList.remove('open');
    }
  });

  // Mostrar/ocultar según la página
  const observer = new MutationObserver(() => {
    const captionArea = document.getElementById('captionArea');
    if(captionArea && captionArea.classList.contains('show')) {
      timerMenuWrap.classList.add('show');
    } else {
      timerMenuWrap.classList.remove('show');
      if(isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        timerPauseBtn.style.display = 'none';
        timerStartBtn.style.display = 'flex';
      }
    }
  });

  const captionArea = document.getElementById('captionArea');
  if(captionArea) {
    observer.observe(captionArea, { attributes: true, attributeFilter: ['class'] });
  }

  updateDisplay();
  timerStartBtn.disabled = true;
})();
