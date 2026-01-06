/**
 * Yandex GPT provider adapter for text and audio generation.
 */

// Default model for Yandex GPT when not overridden.
const DEFAULT_MODEL_NAME = 'yandexgpt-lite';

/**
 * Generate a text response with Yandex GPT.
 *
 * Args:
 *   apiKey: Yandex Cloud API key.
 *   folderId: Yandex Cloud folder ID.
 *   input: Either a string prompt, an object with prompt/system, or an array of messages.
 *   options: Optional model overrides.
 *
 * Returns:
 *   The assistant message text.
 */
async function generateTextWithYandex(apiKey, folderId, input, options) {
	const resolved = resolveYandexOptions(folderId, options);
	
	let messages;
	if (Array.isArray(input)) {
		
		messages = input.map(msg => ({
			role: msg.role,
			text: msg.text
		}));
	} else {
		
		const { prompt, system } = normalizeInput(input);
		messages = [];
		if (system && system.trim().length > 0) {
			messages.push({ role: 'system', text: system });
		}
		messages.push({ role: 'user', text: prompt });
	}

	const body = {
		modelUri: resolved.modelUri,
		completionOptions: {
			stream: false,
			temperature: resolved.temperature,
			maxTokens: resolved.maxTokens,
		},
		messages,
	};

	const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Api-Key ${apiKey}`,
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errText = await safeReadText(response);
		throw new Error(`YandexGPT error ${response.status}: ${errText}`);
	}
	const data = await response.json();
	const text = data?.result?.alternatives?.[0]?.message?.text ?? '';
	return text;
}

/**
 * Resolve Yandex GPT model options and defaults.
 *
 * Args:
 *   folderId: Yandex Cloud folder ID.
 *   options: Optional overrides.
 *
 * Returns:
 *   Normalized options object.
 */
function resolveYandexOptions(folderId, options) {
	const defaults = {
		modelUri: `gpt://${folderId}/${DEFAULT_MODEL_NAME}/latest`,
		temperature: 0.6,
		maxTokens: 2000,
	};

	const modelUri = options?.modelUri
		? String(options.modelUri)
		: (options?.modelName
			? `gpt://${folderId}/${String(options.modelName)}/latest`
			: defaults.modelUri);

	const temperature = isFiniteNumber(options?.temperature)
		? Number(options.temperature)
		: defaults.temperature;

	const maxTokens = isFiniteInteger(options?.maxTokens)
		? Number(options.maxTokens)
		: defaults.maxTokens;
	return { modelUri, temperature, maxTokens };
}

/**
 * Check if a value is a finite number.
 *
 * Args:
 *   v: Value to check.
 *
 * Returns:
 *   True when v is a finite number.
 */
function isFiniteNumber(v) {
	return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Check if a value is a finite integer.
 *
 * Args:
 *   v: Value to check.
 *
 * Returns:
 *   True when v is a finite integer.
 */
function isFiniteInteger(v) {
	return (typeof v === 'number' || typeof v === 'string') && Number.isInteger(Number(v));
}

/**
 * Safely read a response body as text.
 *
 * Args:
 *   res: Fetch Response object.
 *
 * Returns:
 *   Body text or a placeholder string.
 */
async function safeReadText(res) {
	try { return await res.text(); } catch (_) { return '(no body)'; }
}

/**
 * Normalize prompt input to a consistent shape.
 *
 * Args:
 *   input: String or { prompt, system } object.
 *
 * Returns:
 *   Object with prompt and system fields.
 */
function normalizeInput(input) {
	if (typeof input === 'string') {
		return { prompt: input, system: '' };
	}
	return { prompt: input?.prompt || '', system: input?.system || '' };
}

module.exports = { generateTextWithYandex };


/**
 * Transcribe audio with Yandex Speech-to-Text.
 *
 * Args:
 *   apiKey: Yandex Cloud API key.
 *   folderId: Yandex Cloud folder ID.
 *   audioBuffer: Raw audio buffer.
 *   opts: STT options (lang, format, sampleRateHertz).
 *
 * Returns:
 *   Transcript text.
 */
async function transcribeWithYandexSTT(apiKey, folderId, audioBuffer, opts = {}) {
	
	const lang = opts.lang || 'ru-RU';
	const format = opts.format || 'oggopus';
	const sampleRateHertz = opts.sampleRateHertz || 48000;

	const url = `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?lang=${encodeURIComponent(lang)}&format=${encodeURIComponent(format)}&sampleRateHertz=${encodeURIComponent(String(sampleRateHertz))}`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Api-Key ${apiKey}`,
			'Content-Type': 'application/octet-stream',
			'x-folder-id': folderId,
		},
		body: audioBuffer,
	});
	if (!response.ok) {
		const errText = await safeReadText(response);
		throw new Error(`Yandex STT error ${response.status}: ${errText}`);
	}
	const data = await response.json().catch(() => null);
	if (!data) {
		// Some responses arrive as text; attempt to parse JSON.
		const txt = await response.text();
		try {
			const parsed = JSON.parse(txt);
			return parsed.result || '';
		} catch (_) {
			return '';
		}
	}
	return data.result || '';
}

/**
 * Transcribe audio and generate a response with Yandex GPT.
 *
 * Args:
 *   apiKey: Yandex Cloud API key.
 *   folderId: Yandex Cloud folder ID.
 *   input: Either a string prompt, an object with prompt/system, or an array of messages.
 *   audioBase64: Base64-encoded audio.
 *   sttOpts: STT options (lang, format, sampleRateHertz).
 *
 * Returns:
 *   Object with message text and transcript.
 */
async function generateTextWithYandexAndAudio(apiKey, folderId, input, audioBase64, sttOpts) {
	const audioBuffer = Buffer.from(audioBase64, 'base64');
	const transcript = await transcribeWithYandexSTT(apiKey, folderId, audioBuffer, sttOpts);
	
	let messagesWithAudio;
	if (Array.isArray(input)) {
		
		messagesWithAudio = [...input];
		
		if (messagesWithAudio.length > 0 && messagesWithAudio[messagesWithAudio.length - 1].role === 'user') {
			const lastMessage = messagesWithAudio[messagesWithAudio.length - 1];
			messagesWithAudio[messagesWithAudio.length - 1] = {
				...lastMessage,
				text: `${lastMessage.text}\n\nТранскрипция аудио:\n${transcript}`
			};
		}
	} else {
		
		const { prompt, system } = normalizeInput(input);
		let mergedPrompt;
		if (prompt && prompt.trim()) {
			mergedPrompt = system
				? `${prompt}\n\nТранскрипция аудио:\n${transcript}`
				: `${prompt}\n\nТранскрипция аудио:\n${transcript}`;
		} else {
			mergedPrompt = `Транскрипция аудио:\n${transcript}`;
		}
		messagesWithAudio = { prompt: mergedPrompt, system };
	}

	const text = await generateTextWithYandex(apiKey, folderId, messagesWithAudio);
	return { message: text, transcript };
}

module.exports.generateTextWithYandexAndAudio = generateTextWithYandexAndAudio;


