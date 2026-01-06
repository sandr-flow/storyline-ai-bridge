# WebRecorder Guide for Storyline

WebRecorder is a same-origin bridge that lets Articulate Storyline send text or voice requests to AI providers and receive responses through a Netlify Functions backend.

## Quick Start

1) Add a Storyline Web Object that points to:

```
for LMS/same-origin_API/index.html
```

2) Create Storyline variables (Text unless noted):

- `SR_Prompt`
- `SR_System`
- `SR_SessionId`
- `SR_Response`
- `SR_Transcript` (optional)
- `SR_Status` (optional)
- `SR_Mode` (optional: `text` | `voice` | `mixed`)
- `SR_AutoSend` (optional: True/False)

3) Initialize the API once per slide:

```javascript
(function(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  if (!iframe || !iframe.contentWindow || !iframe.contentWindow.WebRecorder) return;
  iframe.contentWindow.WebRecorder.init({ autosync: true, mode: 'mixed' });
})();
```

4) Set `SR_Prompt` and call `WebRecorder.send()` from a Storyline trigger, or enable autosend with `SR_AutoSend=True`.

## Notes

- Same-origin is required. The iframe must be served from the same domain as the Storyline output so `GetPlayer()` is accessible.
- For deployment outside Netlify, set `SR_FunctionUrl` to your function URL.

## Related Docs

- `for LMS/same-origin_API/RECORDER_COMMANDS.md`
- `for LMS/same-origin_API/RECORDER_VARS.md`
- `for LMS/same-origin_API/USAGE_SCENARIOS.md`
