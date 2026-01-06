/**
 * Gemini provider adapter for text and audio generation.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Generate a text response with Gemini.
 *
 * Args:
 *   apiKey: Gemini API key.
 *   input: Either a string prompt, an object with prompt/system, or an array of messages.
 *
 * Returns:
 *   The assistant message text.
 */
async function generateTextWithGemini(apiKey, input) {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  if (Array.isArray(input)) {
    const systemMessage = input.find(msg => msg.role === 'system');
    const systemInstruction = systemMessage ? systemMessage.text : '';
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      ...(systemInstruction ? { systemInstruction } : {}) 
    });
    
    // Convert history into a single text prompt for Gemini.
    const parts = input
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n\n');
    
    const result = await model.generateContent([parts]);
    const response = await result.response;
    return response.text();
  } else {
    const { prompt, system } = normalizeInput(input);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", ...(system ? { systemInstruction: system } : {}) });
    const result = await model.generateContent([prompt]);
    const response = await result.response;
    return response.text();
  }
}

/**
 * Generate a response with Gemini using an audio payload.
 *
 * Args:
 *   apiKey: Gemini API key.
 *   input: Either a string prompt, an object with prompt/system, or an array of messages.
 *   audioBase64: Base64-encoded WebM audio.
 *
 * Returns:
 *   The assistant message text.
 */
async function generateTextWithGeminiAndAudio(apiKey, input, audioBase64) {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  if (Array.isArray(input)) {
    const systemMessage = input.find(msg => msg.role === 'system');
    const systemInstruction = systemMessage ? systemMessage.text : '';
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      ...(systemInstruction ? { systemInstruction } : {}) 
    });
    
    // Combine text history with the audio input.
    const conversationHistory = input
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n\n');
    
    const parts = [
      conversationHistory,
      {
        inlineData: {
          data: audioBase64,
          mimeType: "audio/webm",
        },
      },
    ];
    
    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
  } else {
    const { prompt, system } = normalizeInput(input);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", ...(system ? { systemInstruction: system } : {}) });
    const parts = [];
    
    // Include prompt text only when present, then append audio.
    if (prompt && prompt.trim()) {
      parts.push(prompt);
    }
    
    
    parts.push({
      inlineData: {
        data: audioBase64,
        mimeType: "audio/webm",
      },
    });

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
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

module.exports = {
  generateTextWithGemini,
  generateTextWithGeminiAndAudio,
};


