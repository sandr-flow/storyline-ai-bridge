
/**
 * Same-origin WebRecorder bridge for Storyline courses.
 */

(function(){
  'use strict';

  // Same-origin bridge for Storyline Web Objects.
  const ORIGIN = '*';
  // Default behavior for polling, autosend, mode, and backend endpoint.
  const DEFAULTS = {
    pollIntervalMs: 250,
    autosync: true,
    autosend: false, 
    mode: 'mixed',   
    audioFormat: 'webm',
    endpoint: 'https://nord-m-gemini.netlify.app/.netlify/functions/generate', 
  };

  
  // Storyline variable names used by the bridge.
  const VARS = {
    prompt: 'SR_Prompt',
    system: 'SR_System',
    sessionId: 'SR_SessionId',
    resetContext: 'SR_ResetContext',
    endSession: 'SR_EndSession',
    mode: 'SR_Mode', 
    autosend: 'SR_AutoSend', 
    audioFormat: 'SR_AudioFormat', 
    modelName: 'SR_ModelName',
    modelUri: 'SR_ModelUri',
    temperature: 'SR_Temperature',
    maxTokens: 'SR_MaxTokens',
    provider: 'SR_Provider', 
    debug: 'SR_Debug',
    response: 'SR_Response',       
    transcript: 'SR_Transcript',   
    statusOut: 'SR_Status',        
    functionUrl: 'SR_FunctionUrl', 
  };

  
  // Runtime config and state.
  let cfg = { ...DEFAULTS };
  let state = {
    prompt: '',
    system: '',
    sessionId: '',
    resetContext: false,
    endSession: false,
    mode: DEFAULTS.mode,
    autosend: DEFAULTS.autosend,
    audioFormat: DEFAULTS.audioFormat,
    modelName: undefined,
    modelUri: undefined,
    temperature: undefined,
    maxTokens: undefined,
    provider: undefined,
    debug: false,
    functionUrl: undefined,
  };

  let player = null;
  let pollTimer = null;

  let mediaRecorder = null;
  let audioChunks = [];
  let recordedAudioBlob = null;
  let audioPreviewElement = null;

  
  const log = (...args) => { if (state.debug) { try { console.log('[SR]', ...args); } catch(_) {} } };
  const status = (text) => {
    postToParent('SR_status', text);
    setVar(VARS.statusOut, String(text || ''));
  };
  const responseMsg = (payload) => {
    postToParent('SR_response', payload);
    
    try { setVar(VARS.response, String(payload ?? '')); } catch(_) {}
  };

  /**
   * Post a message to the parent window.
   *
   * Args:
   *   type: Message type string.
   *   payload: Payload object or value.
   *
   * Returns:
   *   None.
   */
  function postToParent(type, payload) {
    try { window.parent && window.parent.postMessage({ type, payload }, ORIGIN); } catch(_) {}
    try { window.top && window.top.postMessage({ type, payload }, ORIGIN); } catch(_) {}
  }

  /**
   * Safely access the Storyline player from the parent window.
   *
   * Returns:
   *   Storyline player instance or null.
   */
  function getPlayerSafe(){
    try {
      if (window.parent && typeof window.parent.GetPlayer === 'function') {
        return window.parent.GetPlayer();
      }
    } catch(_) {}
    return null;
  }

  
  const varPresenceCache = Object.create(null);

  /**
   * Read a Storyline variable with a presence cache.
   *
   * Args:
   *   name: Variable name.
   *
   * Returns:
   *   Variable value or undefined when missing.
   */
  function readVar(name){
    if (!player) return undefined;
    if (varPresenceCache[name] === false) return undefined;
    try {
      const v = player.GetVar(name);
      
      if (typeof v === 'undefined') { varPresenceCache[name] = false; return undefined; }
      varPresenceCache[name] = true;
      return v;
    } catch(_) {
      varPresenceCache[name] = false;
      return undefined;
    }
  }

  /**
   * Write a Storyline variable safely.
   *
   * Args:
   *   name: Variable name.
   *   value: Value to set.
   *
   * Returns:
   *   None.
   */
  function setVar(name, value){
    try {
      if (player && typeof player.SetVar === 'function') {
        player.SetVar(name, value);
      }
    } catch(_) {}
  }

  /**
   * Normalize common types to boolean.
   *
   * Args:
   *   v: Value to convert.
   *
   * Returns:
   *   Boolean value.
   */
  function toBool(v){
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    if (typeof v === 'number') return v !== 0;
    return false;
  }

  /**
   * Create a debounced function.
   *
   * Args:
   *   fn: Function to debounce.
   *   ms: Delay in milliseconds.
   *
   * Returns:
   *   Debounced function.
   */
  function debounce(fn, ms){
    let t;
    return function(...args){
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   * Generate a unique session ID with a prefix.
   *
   * Args:
   *   prefix: Prefix string.
   *
   * Returns:
   *   Unique ID string.
   */
  function generateId(prefix = 'sr'){
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return (prefix ? prefix + '-' : '') + crypto.randomUUID();
      }
    } catch(_) {}
    const rnd = Math.random().toString(36).slice(2);
    const ts = Date.now().toString(36);
    return (prefix ? prefix + '-' : '') + ts + '-' + rnd;
  }

  
  /**
   * Set and persist the session ID.
   *
   * Args:
   *   v: Session ID value.
   *
   * Returns:
   *   Normalized session ID string.
   */
  function setSessionIdImpl(v){
    const newId = String(v || '');
    state.sessionId = newId;
    setVar(VARS.sessionId, newId);
    return newId;
  }

  /**
   * Generate and persist a new session ID.
   *
   * Args:
   *   prefix: Prefix string.
   *
   * Returns:
   *   New session ID string.
   */
  function newSessionIdImpl(prefix){
    const id = generateId(prefix);
    state.sessionId = id;
    setVar(VARS.sessionId, id);
    return id;
  }

  const debouncedAutoSend = debounce(() => {
    if (state.autosend) {
      
      send().catch(e => log('AutoSend error', e));
    }
  }, 300);

  /**
   * Sync state from Storyline variables.
   *
   * Returns:
   *   None.
   */
  function syncFromPlayer(){
    if (!player) return;
    const newState = { ...state };
    const vPrompt = readVar(VARS.prompt);
    const vSystem = readVar(VARS.system);
    const vSession = readVar(VARS.sessionId);
    const vReset = readVar(VARS.resetContext);
    const vEnd = readVar(VARS.endSession);
    const vMode = readVar(VARS.mode);
    const vAutosend = readVar(VARS.autosend);
    const vAudioFormat = readVar(VARS.audioFormat);
    const vModelName = readVar(VARS.modelName);
    const vModelUri = readVar(VARS.modelUri);
    const vTemp = readVar(VARS.temperature);
    const vMax = readVar(VARS.maxTokens);
    const vProvider = readVar(VARS.provider);
    const vDebug = readVar(VARS.debug);
    const vFunctionUrl = readVar(VARS.functionUrl);

    if (typeof vPrompt !== 'undefined') newState.prompt = String(vPrompt ?? '');
    if (typeof vSystem !== 'undefined') newState.system = String(vSystem ?? '');
    if (typeof vSession !== 'undefined') newState.sessionId = String(vSession ?? '');
    if (typeof vReset !== 'undefined') newState.resetContext = toBool(vReset);
    if (typeof vEnd !== 'undefined') newState.endSession = toBool(vEnd);
    if (typeof vMode !== 'undefined' && vMode) newState.mode = String(vMode);
    
    newState.autosend = toBool(vAutosend);
    if (typeof vAudioFormat !== 'undefined' && vAudioFormat) newState.audioFormat = String(vAudioFormat);
    if (typeof vModelName !== 'undefined') newState.modelName = vModelName ? String(vModelName) : undefined;
    if (typeof vModelUri !== 'undefined') newState.modelUri = vModelUri ? String(vModelUri) : undefined;
    if (typeof vTemp !== 'undefined') newState.temperature = (vTemp === '' || vTemp === null) ? undefined : Number(vTemp);
    if (typeof vMax !== 'undefined') newState.maxTokens = (vMax === '' || vMax === null) ? undefined : Number(vMax);
    if (typeof vProvider !== 'undefined') newState.provider = vProvider ? String(vProvider) : undefined;
    if (typeof vDebug !== 'undefined') newState.debug = toBool(vDebug);
    if (typeof vFunctionUrl !== 'undefined') newState.functionUrl = vFunctionUrl ? String(vFunctionUrl) : undefined;

    const promptChanged = newState.prompt !== state.prompt;
    const autosendChanged = newState.autosend !== state.autosend;
    state = newState;

    if (promptChanged) {
      log('Prompt changed ->', state.prompt);
      log('Autosend enabled:', state.autosend);
      if (state.autosend) {
        log('Triggering autosend...');
        debouncedAutoSend();
      } else {
        log('Autosend disabled, skipping');
      }
    }
    
    if (autosendChanged) {
      log('Autosend setting changed to:', state.autosend);
    }
  }

  /**
   * Start periodic synchronization with Storyline variables.
   *
   * Returns:
   *   None.
   */
  function startPolling(){
    if (pollTimer) return;
    pollTimer = setInterval(syncFromPlayer, cfg.pollIntervalMs);
  }

  /**
   * Stop periodic synchronization with Storyline variables.
   *
   * Returns:
   *   None.
   */
  function stopPolling(){
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  
  /**
   * Start microphone recording and collect audio chunks.
   *
   * Returns:
   *   None.
   */
  async function startRecording(){
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      recordedAudioBlob = null;

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        try {
          if (audioPreviewElement) {
            audioPreviewElement.src = URL.createObjectURL(recordedAudioBlob);
            try { audioPreviewElement.currentTime = 0; } catch(_) {}
          }
        } catch(_) {}
        status('Recorded. Ready to play or send.');
      };

      mediaRecorder.start();
      status('Recording...');
    } catch (err) {
      status('Mic access error: ' + err.message);
      throw err;
    }
  }

  /**
   * Stop the active recording if one is running.
   *
   * Returns:
   *   None.
   */
  function stopRecording(){
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    else status('Recorder not active.');
  }

  /**
   * Play the last recorded audio preview.
   *
   * Returns:
   *   None.
   */
  function play(){
    if (!recordedAudioBlob) { status('No recorded audio.'); return; }
    if (!audioPreviewElement) {
      audioPreviewElement = new Audio();
      audioPreviewElement.onended = () => status('Playback stopped');
    }
    audioPreviewElement.src = URL.createObjectURL(recordedAudioBlob);
    audioPreviewElement.play();
    status('Playing...');
  }

  
  
  /**
   * Ensure a recorded audio blob exists by stopping the recorder if needed.
   *
   * Returns:
   *   True if a blob is ready, otherwise false.
   */
  async function ensureAudioReady(){
    if (recordedAudioBlob) return true;
    try {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        log('ensureAudioReady(): stopping MediaRecorder...');
        const ready = new Promise((resolve) => {
          const prevOnStop = mediaRecorder.onstop;
          mediaRecorder.onstop = (...args) => {
            try { if (typeof prevOnStop === 'function') prevOnStop.apply(mediaRecorder, args); } catch(_) {}
            resolve(true);
          };
        });
        mediaRecorder.stop();
        await ready;
        log('ensureAudioReady(): onstop fired, blob ready?', !!recordedAudioBlob);
        return !!recordedAudioBlob;
      }
    } catch(_) {}
    return !!recordedAudioBlob;
  }

  /**
   * Send a request based on the current mode and available audio.
   *
   * Returns:
   *   Provider response object.
   */
  async function send(){
    
    const mode = (state.mode || 'mixed').toLowerCase();
    
    if (mode !== 'text') {
      await ensureAudioReady();
    }
    const hasAudio = !!recordedAudioBlob;
    log('send() mode=', mode, 'hasAudio=', hasAudio);
    if (mode === 'text') return sendText();
    if (mode === 'voice') {
      if (!hasAudio) throw new Error('No recorded audio to send');
      return sendAudio();
    }
    
    if (hasAudio) return sendAudio();
    return sendText();
  }

  /**
   * Send a text request to the backend.
   *
   * Returns:
   *   Provider response object.
   */
  async function sendText(){
    status('Sending text...');
    
    let promptText = state.prompt || '';
    if (!promptText) {
      try {
        const p = getPlayerSafe();
        if (p) {
          const ur = (function(){
            try { return p.GetVar('UserResponse'); } catch(_) { return undefined; }
          })() ?? (function(){
            try { return p.GetVar('UserResponce'); } catch(_) { return undefined; }
          })();
          if (typeof ur !== 'undefined' && ur !== null) {
            promptText = String(ur);
          }
        }
      } catch(_) {}
    }
    if (!promptText || !String(promptText).trim()) {
      status('No text to send');
      throw new Error('No text to send');
    }
    const body = {
      prompt: String(promptText),
      system: state.system || '',
      sessionId: state.sessionId || undefined,
      endSession: !!state.endSession,
      resetContext: !!state.resetContext,
      modelName: state.modelName,
      modelUri: state.modelUri,
      temperature: state.temperature,
      maxTokens: state.maxTokens
      
    };
    try{
      const url = state.functionUrl || cfg.endpoint || '/.netlify/functions/generate';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data && data.error || ('HTTP '+res.status));
      if (data && typeof data.transcript !== 'undefined') {
        const tr = data.transcript || '';
        postToParent('SR_transcription', tr);
        setVar(VARS.transcript, String(tr));
      }
      responseMsg(data.generatedText || '');
      status('Idle');
      return data;
    }catch(e){
      status('Error: ' + e.message);
      throw e;
    }
  }

  /**
   * Send an audio request to the backend.
   *
   * Returns:
   *   Provider response object.
   */
  async function sendAudio(){
    if (!recordedAudioBlob) throw new Error('No recorded audio to send');
    status('Sending audio...');

    const fd = new FormData();
    fd.append('prompt', state.prompt || '');
    fd.append('system', state.system || '');
    if (state.sessionId) fd.append('sessionId', state.sessionId);
    if (state.endSession) fd.append('endSession', 'true');
    if (state.resetContext) fd.append('resetContext', 'true');
    if (state.modelName) fd.append('modelName', state.modelName);
    if (state.modelUri) fd.append('modelUri', state.modelUri);
    if (typeof state.temperature === 'number') fd.append('temperature', String(state.temperature));
    if (typeof state.maxTokens === 'number') fd.append('maxTokens', String(state.maxTokens));
    if (state.audioFormat) fd.append('audioFormat', state.audioFormat);

    const filename = state.audioFormat === 'oggopus' ? 'recording.ogg' : 'recording.webm';
    fd.append('audio', recordedAudioBlob, filename);

    try{
      const url = state.functionUrl || cfg.endpoint || '/.netlify/functions/generate';
      const res = await fetch(url, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data && data.error || ('HTTP '+res.status));
      if (data && typeof data.transcript !== 'undefined') {
        const tr = data.transcript || '';
        postToParent('SR_transcription', tr);
        setVar(VARS.transcript, String(tr));
      }
      responseMsg(data.generatedText || '');
      status('Idle');
      
      
      return data;
    }catch(e){
      status('Error: ' + e.message);
      throw e;
    }
  }

  
  const WebRecorder = {
    /**
     * Initialize the bridge and optionally start autosync.
     *
     * Args:
     *   options: Optional configuration overrides.
     *
     * Returns:
     *   True when initialization completes.
     */
    init(options){
      cfg = { ...DEFAULTS, ...(options || {}) };
      state.mode = cfg.mode;
      state.autosend = !!cfg.autosend;
      if (cfg.endpoint && typeof cfg.endpoint === 'string') {
        state.functionUrl = cfg.endpoint;
      }
      status('Initializing...');
      
      player = getPlayerSafe();
      if (player && cfg.autosync) startPolling();
      postToParent('SR_ready', true);
      status('Idle');
      return true;
    },
    /**
     * Start microphone recording.
     *
     * Returns:
     *   Promise that resolves when recording starts.
     */
    startRecording,
    /**
     * Stop the active recording.
     *
     * Returns:
     *   None.
     */
    stopRecording,
    /**
     * Play the recorded audio preview.
     *
     * Returns:
     *   None.
     */
    play,
    /**
     * Send a request based on mode and audio availability.
     *
     * Returns:
     *   Provider response object.
     */
    send,
    /**
     * Set the current prompt text.
     *
     * Args:
     *   v: Prompt text.
     *
     * Returns:
     *   None.
     */
    setPrompt(v){
      const oldPrompt = state.prompt;
      state.prompt = String(v || ''); 
      
      if (oldPrompt !== state.prompt && state.autosend) {
        debouncedAutoSend();
      }
    },
    /**
     * Set the current system instructions.
     *
     * Args:
     *   v: System text.
     *
     * Returns:
     *   None.
     */
    setSystem(v){ state.system = String(v || ''); },
    /**
     * Set the request mode.
     *
     * Args:
     *   v: Mode value: text, voice, or mixed.
     *
     * Returns:
     *   None.
     */
    setMode(v){ if (v) state.mode = String(v); },
    /**
     * Set session metadata in one call.
     *
     * Args:
     *   id: Session ID.
     *   resetContext: Whether to clear history.
     *   endSession: Whether to end the session on next send.
     *
     * Returns:
     *   None.
     */
    setSession({ id, resetContext, endSession } = {}){
      if (typeof id !== 'undefined') { setSessionIdImpl(id); }
      if (typeof resetContext !== 'undefined') state.resetContext = !!resetContext;
      if (typeof endSession !== 'undefined') state.endSession = !!endSession;
    },
    /**
     * Mark the next request to reset the session context.
     *
     * Returns:
     *   None.
     */
    resetContext(){ state.resetContext = true; },
    /**
     * Mark the next request to end the session.
     *
     * Returns:
     *   None.
     */
    endSession(){ state.endSession = true; },
    /**
     * Set the session ID.
     *
     * Args:
     *   v: Session ID.
     *
     * Returns:
     *   Session ID string.
     */
    setSessionId(v){ return setSessionIdImpl(v); },
    /**
     * Generate and set a new session ID.
     *
     * Args:
     *   prefix: Prefix string.
     *
     * Returns:
     *   Session ID string.
     */
    newSessionId(prefix){ return newSessionIdImpl(prefix); },
    /**
     * Set the provider hint (backend still chooses by env).
     *
     * Args:
     *   v: Provider name.
     *
     * Returns:
     *   None.
     */
    setProvider(v){ state.provider = v ? String(v) : undefined; },
    /**
     * Enable or disable autosend when SR_Prompt changes.
     *
     * Args:
     *   v: Boolean-like value.
     *
     * Returns:
     *   None.
     */
    setAutosend(v){
      state.autosend = !!v;
      
      try { setVar(VARS.autosend, state.autosend); } catch(_) {}
    },
    /**
     * Set the audio format used for uploads.
     *
     * Args:
     *   v: Audio format string.
     *
     * Returns:
     *   None.
     */
    setAudioFormat(v){ if (v) state.audioFormat = String(v); },
    /**
     * Enable or disable debug logging.
     *
     * Args:
     *   on: Boolean-like value.
     *
     * Returns:
     *   None.
     */
    debug(on){ state.debug = !!on; },
    /**
     * Override the backend endpoint URL.
     *
     * Args:
     *   v: URL string.
     *
     * Returns:
     *   None.
     */
    setEndpoint(v){ state.functionUrl = v ? String(v) : undefined; },
    /**
     * Bind a preview audio element to the recorder.
     *
     * Args:
     *   el: HTMLAudioElement instance.
     *
     * Returns:
     *   None.
     */
    setAudioElement(el){ try { if (el && el.tagName === 'AUDIO') { audioPreviewElement = el; } } catch(_) {}
    },
  };

  window.WebRecorder = WebRecorder;
})();
