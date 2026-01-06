# WebRecorder API Commands (Storyline)

All commands are plain JavaScript calls executed from Storyline triggers (Execute JavaScript). The API lives inside the Web Object iframe as `window.WebRecorder`, so call it via `iframe.contentWindow.WebRecorder`.

Helper to get a safe handle:

```javascript
function getWebRecorder(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  var WR = iframe && iframe.contentWindow && iframe.contentWindow.WebRecorder;
  return { iframe: iframe, WR: WR };
}
```

## Initialization

```javascript
var ctx = getWebRecorder();
var WR = ctx && ctx.WR;
if (!WR) return;

WR.init({
  autosync: true,          // Read Storyline variables periodically
  mode: 'mixed',           // 'text' | 'voice' | 'mixed'
  autosend: false,         // Autosend on SR_Prompt change
  endpoint: undefined      // Optional override of the backend URL
});
```

Optional helper to bind the preview audio element (used in `index.html`):

```javascript
var ctx = getWebRecorder();
var WR = ctx && ctx.WR;
if (!WR || !ctx.iframe) return;
WR.setAudioElement(ctx.iframe.contentWindow.document.querySelector('audio'));
```

## Recording

```javascript
var ctx = getWebRecorder();
var WR = ctx && ctx.WR;
if (!WR) return;
WR.startRecording();
WR.stopRecording();
WR.play();
```

## Sending

```javascript
var ctx = getWebRecorder();
var WR = ctx && ctx.WR;
if (!WR) return;
WR.send(); // Sends text or audio based on the current mode and available audio
```

## Session Management

```javascript
var ctx = getWebRecorder();
var WR = ctx && ctx.WR;
if (!WR) return;
WR.newSessionId('sr');       // Generate and store a new session ID
WR.setSessionId('session');  // Set a specific session ID
WR.setSession({ id: 'session', resetContext: false, endSession: false });
WR.resetContext();           // Clear history for the current session
WR.endSession();             // End session on the next send
```

## Settings

```javascript
var ctx = getWebRecorder();
var WR = ctx && ctx.WR;
if (!WR) return;
WR.setPrompt('Your prompt');
WR.setSystem('System role instructions');
WR.setMode('text');          // 'text' | 'voice' | 'mixed'
WR.setAutosend(true);        // Syncs SR_AutoSend
WR.setAudioFormat('webm');   // 'webm' | 'oggopus'
WR.setEndpoint('https://your-site.netlify.app/.netlify/functions/generate');
WR.debug(true);
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
