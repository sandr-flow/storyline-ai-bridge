# Storyline Usage Scenarios (Same-Origin)

These scenarios assume a Storyline Web Object pointing to `same-origin_API/index.html` and an initialized `window.WebRecorder`.

## Scenario 1: Single Request, No History

Use when you do not need memory between requests.

```javascript
(function(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  if (!iframe) return;
  var WR = iframe.contentWindow.WebRecorder;
  WR.setMode('mixed');
  WR.setSessionId(''); // No history
  WR.setSystem('You are a helpful assistant. Answer briefly.');
  WR.setPrompt('Explain the difference between UI and UX.');
  WR.send();
})();
```

## Scenario 2: Dialogue With History

Use when you want session memory across multiple turns.

```javascript
(function(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  if (!iframe) return;
  var WR = iframe.contentWindow.WebRecorder;

  // Create a session ID once per slide if missing
  if (!WR || !WR.newSessionId) return;
  WR.newSessionId('sr');

  // Set a shared system prompt for the session
  WR.setSystem('You are a friendly tutor. Keep context across turns.');
})();
```

Send each user request:

```javascript
(function(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  if (!iframe) return;
  var WR = iframe.contentWindow.WebRecorder;
  WR.setPrompt('My next question: how is API different from SDK?');
  WR.send();
})();
```

## Scenario 3: Dialogue + Final Analysis

Use when you want a final analysis of the whole session.

```javascript
(function(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  if (!iframe) return;
  var WR = iframe.contentWindow.WebRecorder;
  WR.setMode('text');
  WR.setSystem('You are a conversation analyst.');
  WR.setPrompt('Analyze the session and summarize key takeaways and gaps.');
  WR.send();
})();
```

Optional cleanup (end session after analysis):

```javascript
(function(){
  var iframe = Array.from(document.getElementsByTagName('iframe')).find(function(f){
    try { return (f.src || '').indexOf('same-origin_API') !== -1; } catch (e) { return false; }
  });
  if (!iframe) return;
  var WR = iframe.contentWindow.WebRecorder;
  WR.endSession();
  WR.send();
})();
```
