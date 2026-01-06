# WebRecorder API Commands (Storyline)

All commands are plain JavaScript calls executed from Storyline triggers (Execute JavaScript). The API is exposed on the iframe as `window.WebRecorder`.

## Initialization

```javascript
WebRecorder.init({
  autosync: true,          // Read Storyline variables periodically
  mode: 'mixed',           // 'text' | 'voice' | 'mixed'
  autosend: false,         // Autosend on SR_Prompt change
  endpoint: undefined      // Optional override of the backend URL
});
```

Optional helper to bind the preview audio element (used in `index.html`):

```javascript
WebRecorder.setAudioElement(document.querySelector('audio'));
```

## Recording

```javascript
WebRecorder.startRecording();
WebRecorder.stopRecording();
WebRecorder.play();
```

## Sending

```javascript
WebRecorder.send(); // Sends text or audio based on the current mode and available audio
```

## Session Management

```javascript
WebRecorder.newSessionId('sr');       // Generate and store a new session ID
WebRecorder.setSessionId('session');  // Set a specific session ID
WebRecorder.setSession({ id: 'session', resetContext: false, endSession: false });
WebRecorder.resetContext();           // Clear history for the current session
WebRecorder.endSession();             // End session on the next send
```

## Settings

```javascript
WebRecorder.setPrompt('Your prompt');
WebRecorder.setSystem('System role instructions');
WebRecorder.setMode('text');          // 'text' | 'voice' | 'mixed'
WebRecorder.setAutosend(true);        // Syncs SR_AutoSend
WebRecorder.setAudioFormat('webm');   // 'webm' | 'oggopus'
WebRecorder.setEndpoint('https://your-site.netlify.app/.netlify/functions/generate');
WebRecorder.debug(true);
```

## Events (postMessage)

The bridge posts messages to the parent window:

- `SR_ready`
- `SR_response`
- `SR_transcription`
- `SR_status`

Example listener:

```javascript
window.addEventListener('message', function(e) {
  var data = e.data || {};
  if (!data.type || data.type.indexOf('SR_') !== 0) return;
  console.log(data.type, data.payload);
});
```
