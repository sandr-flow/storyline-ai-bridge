# WebRecorder Storyline Variables

These variables are read and written by `for LMS/same-origin_API/recorder-bridge.js`. Create them in Storyline to drive the API and receive results.

## Input Variables (from Storyline to WebRecorder)

| Variable | Type | Required | Description |
| --- | --- | --- | --- |
| `SR_Prompt` | Text | Yes | User prompt. Must be non-empty to send text or audio requests. |
| `SR_System` | Text | No | System instructions (role or behavior). |
| `SR_SessionId` | Text | No | Session ID for memory. When set, the backend stores history in Netlify Blobs. |
| `SR_ResetContext` | True/False | No | Clear history for the current session before the next send. |
| `SR_EndSession` | True/False | No | End the current session on the next send. |
| `SR_Mode` | Text | No | Request mode: `text`, `voice`, or `mixed`. Default: `mixed`. |
| `SR_AutoSend` | True/False | No | Autosend on `SR_Prompt` changes. Default: False. |
| `SR_AudioFormat` | Text | No | `webm` or `oggopus`. Default: `webm`. |
| `SR_FunctionUrl` | Text | No | Override backend URL (useful outside Netlify). |
| `SR_ModelName` | Text | No | Yandex model name override (e.g., `yandexgpt-lite`). |
| `SR_ModelUri` | Text | No | Yandex full model URI override. |
| `SR_Temperature` | Number | No | Yandex temperature override. |
| `SR_MaxTokens` | Number | No | Yandex max tokens override. |
| `SR_Provider` | Text | No | Advisory only; backend selects provider by `AI_PROVIDER`. |
| `SR_Debug` | True/False | No | Enable debug logs in the iframe. |

## Output Variables (from WebRecorder to Storyline)

| Variable | Type | Description |
| --- | --- | --- |
| `SR_Response` | Text | AI response text. |
| `SR_Transcript` | Text | Speech-to-text transcript (if available). |
| `SR_Status` | Text | Current status (recording, sending, errors). |

## Notes

- The backend requires a prompt. Voice requests still use `SR_Prompt` as context.
- `AI_PROVIDER=mistral` supports text-only requests.
- For same-origin access, the Web Object must be served from the same domain as the Storyline output.
