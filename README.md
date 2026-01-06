# Storyline AI Bridge

Integrates AI text and voice interactions into Articulate Storyline courses via Netlify Functions.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Configuration](#configuration)
- [License](#license)

## Background

Storyline AI Bridge connects Storyline courses to AI providers through a small Netlify Functions backend and two browser-side bridges:

- A simple iframe bridge for Storyline web objects (`index.html` + `bridge-netlify.js`).
- A same-origin WebRecorder API for LMS deployments (`for LMS/same-origin_API/recorder-bridge.js`).

Key features:

- Text and voice requests to Gemini, OpenAI, or Yandex.
- Session memory stored in Netlify Blobs.
- Same-origin WebRecorder API for reading Storyline variables safely.

## Install

Prerequisites:

- Node.js 18 (matches `netlify.toml`)
- Netlify CLI
- API keys for the provider you plan to use

Steps:

```bash
npm install
```

```bash
netlify dev
```

## Usage

Local development:

```bash
netlify dev
```

API endpoint:

- `POST /.netlify/functions/generate`
- `Content-Type: application/json` or `multipart/form-data`

Example JSON request:

```bash
curl -X POST http://localhost:8888/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello","system":"","sessionId":"demo-session"}'
```

Same-origin LMS bridge:

- Use `for LMS/same-origin_API/index.html` as a Storyline Web Object.
- See the LMS guides in `for LMS/` for setup and Storyline variables.

## Configuration

Create a `.env` file based on `.env.example`, or set the variables in Netlify.

| Variable | Required | Description |
| --- | --- | --- |
| `AI_PROVIDER` | Yes | Provider selector: `gemini`, `openai`, or `yandex`. |
| `GEMINI_API_KEY` | If `AI_PROVIDER=gemini` | Google Gemini API key. |
| `OPENAI_API_KEY` | If `AI_PROVIDER=openai` | OpenAI API key. |
| `YANDEX_API_KEY` | If `AI_PROVIDER=yandex` | Yandex Cloud API key. |
| `YANDEX_FOLDER_ID` | If `AI_PROVIDER=yandex` | Yandex Cloud folder ID. |
| `NETLIFY_SITE_ID` | Optional | Netlify site ID for manual Blobs config. |
| `NETLIFY_BLOBS_TOKEN` | Optional | Netlify Blobs token for manual config. |
| `N_SITE_ID` | Optional | Alias for `NETLIFY_SITE_ID`. |
| `N_BLOB_TOKEN` | Optional | Alias for `NETLIFY_BLOBS_TOKEN`. |

External resources:

- Netlify: https://www.netlify.com/
- Netlify CLI: https://docs.netlify.com/cli/get-started/
- Google AI Studio (Gemini keys): https://aistudio.google.com/
- OpenAI API keys: https://platform.openai.com/api-keys
- Yandex Cloud console: https://console.cloud.yandex.com/

## License

ISC
