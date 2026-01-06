/**
 * Storyline iframe bridge for Netlify Functions.
 */

// Use '*' for development; set your LMS origin in production.
const PARENT_WINDOW_ORIGIN = '*';

let mediaRecorder;
let audioChunks = [];
let currentAudioPrompt = "";
let recordedAudioBlob = null; 
let audioPreviewElement = null; 


/**
 * Post a status message to the parent window.
 *
 * Args:
 *   type: Message type string.
 *   payload: Payload object or value.
 *
 * Returns:
 *   None.
 */
function postStatusToParent(type, payload) {
    const message = { type, payload };
    try { if (window.top) window.top.postMessage(message, PARENT_WINDOW_ORIGIN); } catch (_) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage(message, PARENT_WINDOW_ORIGIN); } catch (_) {}
    console.log(`Sending to parent: ${type}`, payload);
}



/**
 * Start microphone recording and collect audio chunks.
 *
 * Returns:
 *   None.
 */
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordedAudioBlob = null; 

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        
        mediaRecorder.onstop = () => {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            postStatusToParent('recordingState', { status: 'recorded', message: 'Запись завершена. Готово к прослушиванию или отправке.' });
        };
        
        mediaRecorder.start();
        postStatusToParent('recordingState', { status: 'recording', message: 'Идет запись...' });

    } catch (err) {
        postStatusToParent('error', { context: 'mic_access', message: `Ошибка доступа к микрофону: ${err.message}` });
    }
}

/**
 * Stop the active recording if one is running.
 *
 * Returns:
 *   None.
 */
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); 
    } else {
        postStatusToParent('error', { context: 'recorder_stop', message: 'Запись не была активна.' });
    }
}


/**
 * Play the last recorded audio preview.
 *
 * Returns:
 *   None.
 */
function playPreview() {
    if (!recordedAudioBlob) {
        postStatusToParent('error', { context: 'playback', message: 'Нет записанного аудио для прослушивания.' });
        return;
    }
    if (!audioPreviewElement) {
        audioPreviewElement = new Audio();
        audioPreviewElement.onended = () => postStatusToParent('playbackState', { status: 'stopped' });
    }
    audioPreviewElement.src = URL.createObjectURL(recordedAudioBlob);
    audioPreviewElement.play();
    postStatusToParent('playbackState', { status: 'playing' });
}


/**
 * Send the cached recording to the backend and clear it.
 *
 * Returns:
 *   None.
 */
function sendRecordedAudio() {
    if (!recordedAudioBlob) {
        postStatusToParent('error', { context: 'send_audio', message: 'Нет записанного аудио для отправки.' });
        return;
    }
    
    sendAudioToBackend(currentAudioPrompt, recordedAudioBlob);
    recordedAudioBlob = null; 
}



// Handle messages sent from Storyline to the iframe bridge.
window.addEventListener('message', (event) => {
    
    if (!event.data || !event.data.type) return;

    const { type, payload } = event.data;

    switch (type) {
        
        case 'sendTextOnly':
            postStatusToParent('bridgeStatus', `Текстовый запрос получен: "${payload}". Отправка...`);
            sendTextToBackend(payload);
            break;

        
        case 'setAudioPrompt':
            currentAudioPrompt = payload;
            postStatusToParent('bridgeStatus', `Промпт для аудио "${payload}" установлен.`);
            break;
        case 'startRecording':
            startRecording();
            break;
        case 'stopRecording':
            stopRecording();
            break;
        
        case 'playPreview':
            playPreview();
            break;
        case 'sendRecordedAudio':
            sendRecordedAudio();
            break;
    }
});




/**
 * Send a text-only prompt to the backend.
 *
 * Args:
 *   prompt: Prompt text.
 *
 * Returns:
 *   None.
 */
async function sendTextToBackend(prompt) {
    postStatusToParent('requestState', { status: 'processing', message: 'Отправка текстового запроса...' });
    try {
        const response = await fetch('/.netlify/functions/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Ошибка сервера: ${response.status}`);
        }

        console.log('[Bridge] Raw response:', data);
        if (data && typeof data.provider !== 'undefined') console.log(`[Bridge] Provider used: ${data.provider}`);
        if (data && Object.prototype.hasOwnProperty.call(data, 'transcript')) {
            console.log(`[Bridge] Transcript: ${data.transcript}`);
            postStatusToParent('transcription', data.transcript ?? '');
        }
        postStatusToParent('geminiResponse', data.generatedText);
        postStatusToParent('requestState', { status: 'idle', message: 'Готов к новому запросу.' });

    } catch (error) {
        postStatusToParent('error', { context: 'backend_request_text', message: error.message });
        postStatusToParent('requestState', { status: 'idle', message: 'Ошибка, готов к новой попытке.' });
    }
}


/**
 * Send audio with an optional prompt to the backend.
 *
 * Args:
 *   prompt: Prompt text.
 *   audioBlob: Recorded audio data.
 *
 * Returns:
 *   None.
 */
async function sendAudioToBackend(prompt, audioBlob) {
    postStatusToParent('recordingState', { status: 'processing', message: 'Отправка аудио на сервер...' });
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('audio', audioBlob, 'recording.webm');

    try {
        const response = await fetch('/.netlify/functions/generate', {
            method: 'POST',
            body: formData, 
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Ошибка сервера: ${response.status}`);
        }

        console.log('[Bridge] Raw response:', data);
        if (data && typeof data.provider !== 'undefined') console.log(`[Bridge] Provider used: ${data.provider}`);
        if (data && Object.prototype.hasOwnProperty.call(data, 'transcript')) {
            console.log(`[Bridge] Transcript: ${data.transcript}`);
            postStatusToParent('transcription', data.transcript ?? '');
        }
        postStatusToParent('geminiResponse', data.generatedText);
        postStatusToParent('recordingState', { status: 'idle', message: 'Готов к новой записи.' });

    } catch (error) {
        postStatusToParent('error', { context: 'backend_request_audio', message: error.message });
        postStatusToParent('recordingState', { status: 'idle', message: 'Ошибка, готов к новой попытке.' });
    }
}



postStatusToParent('bridgeReady', true);
postStatusToParent('requestState', { status: 'idle', message: 'Готов к работе.' });
postStatusToParent('recordingState', { status: 'idle', message: 'Готов к записи.' });
