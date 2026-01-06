/**
 * Mistral provider adapter for text generation.
 */

/**
 * Generate a text response with Mistral chat completions.
 *
 * Args:
 *   apiKey: Mistral API key.
 *   input: Either a string prompt, an object with prompt/system, or an array of messages.
 *
 * Returns:
 *   The assistant message text.
 */
async function generateTextWithMistral(apiKey, input) {
  const primaryModel = "magistral-medium-2509";
  const fallbackModel = "mistral-small-latest";
  let modelUsed = primaryModel;

  let messages;
  let systemPrompt = "";
  if (Array.isArray(input)) {
    const systemMsg = input.find(m => m.role === 'system');
    systemPrompt = systemMsg ? (systemMsg.text || "") : "";
    messages = input
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: typeof msg.text === 'string' ? msg.text : String(msg.text || '')
      }))
      .filter(msg => msg.content.trim().length > 0);
  } else {
    const { prompt, system } = normalizeInput(input);
    systemPrompt = system || "";
    messages = [ { role: 'user', content: prompt } ];
  }

  if (!messages || messages.length === 0) {
    throw new Error('Mistral: no valid messages to send.');
  }

  const primaryBody = {
    model: primaryModel,
    messages,
    temperature: 1,
    max_tokens: 1024,
    ...(systemPrompt ? { system_prompt: systemPrompt } : {})
  };

  let response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(primaryBody),
  });

  if (!response.ok && [400, 404, 422, 429].includes(response.status)) {
    const errText = await safeReadText(response);
    console.warn(`[Mistral] Primary model failed (${primaryModel}). Falling back to ${fallbackModel}. Details: ${errText}`);
    modelUsed = fallbackModel;
    const fallbackBody = {
      model: fallbackModel,
      messages,
      temperature: 1,
      max_tokens: 1024,
      ...(systemPrompt ? { system_prompt: systemPrompt } : {})
    };
    response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(fallbackBody),
    });
  }

  if (!response.ok) {
    const errText = await safeReadText(response);
    throw new Error(`Mistral chat error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const message = extractTextFromMessage(data?.choices?.[0]?.message) || '';
  console.log(`[Mistral] Text generation model: ${modelUsed}`);
  return message;
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
  try {
    return await res.text();
  } catch (_) {
    return "(no body)";
  }
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

/**
 * Extract text from a Mistral message object.
 *
 * Args:
 *   msg: Message object returned by the API.
 *
 * Returns:
 *   Concatenated text content.
 */
function extractTextFromMessage(msg) {
  if (!msg) return '';
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part && part.type === 'text' && typeof part.text === 'string')
      .map(part => part.text)
      .join('');
  }
  return '';
}

module.exports = {
  generateTextWithMistral,
};
