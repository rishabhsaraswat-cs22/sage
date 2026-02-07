// Turn-based Voice Interaction - Streaming STT Version
let audioContext = null;
let mediaStream = null;
let audioProcessor = null;
let websocket = null;
let isRecording = false;

// Conversation state
let currentTurn = 0;
const maxTurns = 3;
let isConversationActive = false;
let isAISpeaking = false;

// Current transcript (accumulates partial results)
let currentTranscript = '';

// DOM elements
const startBtn = document.getElementById('startBtn');
const recordBtn = document.getElementById('recordBtn');
const statusDiv = document.getElementById('status');
const turnIndicator = document.getElementById('turnIndicator');
const logDiv = document.getElementById('log');

// Update status display
function updateStatus(message) {
    statusDiv.textContent = message;
    console.log('Status:', message);
}

// Update turn indicator
function updateTurnIndicator() {
    if (currentTurn === 0) {
        turnIndicator.textContent = 'Press "Start Conversation" to begin';
    } else if (currentTurn > maxTurns) {
        turnIndicator.textContent = 'Conversation Complete';
    } else {
        turnIndicator.textContent = `Turn ${currentTurn} of ${maxTurns}`;
    }
}

// Add log entry
function addLog(label, content, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
    <div class="log-label">${label}</div>
    <div class="log-content">${content}</div>
  `;
    logDiv.insertBefore(entry, logDiv.firstChild);
}

// Initialize audio for streaming
async function initStreamingAudio() {
    try {
        console.log('Initializing audio...');

        // Request microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            }
        });
        console.log('Microphone access granted');

        // Use browser's default sample rate, we'll downsample later
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext created, sample rate:', audioContext.sampleRate);

        return true;
    } catch (error) {
        console.error('Microphone access error:', error);
        updateStatus('❌ Microphone access denied');
        addLog('Error', 'Could not access microphone: ' + error.message, 'error');
        return false;
    }
}

// Downsample audio from source rate to target rate
function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) {
        return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

// Convert Float32 to Int16 (LINEAR16 format)
function floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

// Start streaming recording
async function startStreaming() {
    console.log('Starting streaming...');

    // Ensure we have audio context and media stream
    if (!audioContext || audioContext.state === 'closed' || !mediaStream) {
        console.log('Need to initialize audio...');
        const success = await initStreamingAudio();
        if (!success) {
            console.error('Failed to initialize audio');
            return false;
        }
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        await audioContext.resume();
    }

    // Connect WebSocket
    console.log('Connecting WebSocket...');
    websocket = new WebSocket(`ws://${window.location.host}`);

    return new Promise((resolve) => {
        websocket.onopen = () => {
            console.log('WebSocket connected, sending start signal...');

            try {
                // Send start signal
                websocket.send(JSON.stringify({ type: 'start' }));
                console.log('Start signal sent');

                // Setup audio processing after WebSocket is ready
                setupAudioProcessing();
                console.log('Audio processing setup complete');

                isRecording = true;
                currentTranscript = '';
                resolve(true);
            } catch (error) {
                console.error('Error in onopen handler:', error);
                resolve(false);
            }
        };

        websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'partial') {
                    currentTranscript = data.transcript;
                    const displayText = currentTranscript.length > 50
                        ? currentTranscript.substring(0, 50) + '...'
                        : currentTranscript;
                    updateStatus(`🎙️ "${displayText}"`);
                } else if (data.type === 'final') {
                    currentTranscript = data.transcript;
                    console.log('Final transcript received:', currentTranscript);
                } else if (data.type === 'error') {
                    console.error('STT error from server:', data.message);
                    addLog('Error', data.message, 'error');
                }
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            addLog('Error', 'WebSocket connection error', 'error');
            resolve(false);
        };

        websocket.onclose = (event) => {
            console.log('WebSocket closed, code:', event.code, 'reason:', event.reason);
        };

        // Timeout after 5 seconds
        setTimeout(() => {
            if (websocket.readyState !== WebSocket.OPEN) {
                console.error('WebSocket connection timeout');
                resolve(false);
            }
        }, 5000);
    });
}

// Setup audio processing pipeline
function setupAudioProcessing() {
    console.log('Setting up audio processing pipeline...');

    if (!mediaStream) {
        console.error('No media stream available!');
        return;
    }

    const source = audioContext.createMediaStreamSource(mediaStream);
    const inputSampleRate = audioContext.sampleRate;
    const targetSampleRate = 16000;

    // Use ScriptProcessor for compatibility
    const bufferSize = 4096;
    audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    let chunkCount = 0;

    audioProcessor.onaudioprocess = (event) => {
        if (!isRecording) return;
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not open, skipping audio chunk');
            return;
        }

        const inputData = event.inputBuffer.getChannelData(0);

        // Downsample to 16kHz
        const downsampled = downsampleBuffer(inputData, inputSampleRate, targetSampleRate);

        // Convert to LINEAR16
        const int16Data = floatTo16BitPCM(downsampled);

        // Send audio chunk to server
        websocket.send(int16Data.buffer);
        chunkCount++;

        // Log every 10th chunk for debugging
        if (chunkCount % 10 === 0) {
            console.log(`Sent ${chunkCount} audio chunks`);
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);

    console.log('Audio processing started, downsampling from', inputSampleRate, 'to', targetSampleRate);
}

// Stop streaming recording
async function stopStreaming() {
    isRecording = false;

    // Send stop signal and wait for final transcript
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'stop' }));

        // Wait for final transcript with timeout
        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 2000);
            const originalOnMessage = websocket.onmessage;
            websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'final') {
                    currentTranscript = data.transcript;
                    clearTimeout(timeout);
                    resolve();
                }
                if (originalOnMessage) originalOnMessage(event);
            };
        });

        websocket.close();
    }

    // Cleanup audio processor
    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    return currentTranscript;
}

// Start conversation - AI speaks first
async function startConversation() {
    if (isConversationActive) return;

    isConversationActive = true;
    currentTurn = 1;
    updateTurnIndicator();
    startBtn.disabled = true;
    recordBtn.disabled = true;

    addLog('🎬 Conversation', 'Starting conversation - AI speaks first', 'info');

    await generateAIResponse(true);
}

// Generate AI response (initial or reply)
async function generateAIResponse(isInitial = false) {
    const turnStartTime = Date.now();
    isAISpeaking = true;
    recordBtn.disabled = true;

    try {
        updateStatus('🤖 AI is thinking...');

        const endpoint = isInitial ? '/initial-speech' : '/chat';
        const body = isInitial ? {} : { text: window.lastUserText };

        const geminiStart = Date.now();
        const response = await fetch(`http://localhost:3000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Gemini request failed');
        }

        const data = await response.json();
        const aiText = data.response;
        const geminiLatency = data.latency?.gemini || data.latency || ((Date.now() - geminiStart) / 1000).toFixed(2);

        addLog(`🤖 AI Turn ${currentTurn}`, aiText, 'gemini');
        addLog('⏱️ Gemini latency', `${geminiLatency}s`, 'info');

        // Convert to speech
        updateStatus('🔊 Generating speech...');
        const ttsStart = Date.now();
        const ttsResponse = await fetch('http://localhost:3000/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiText }),
        });

        if (!ttsResponse.ok) {
            const error = await ttsResponse.json();
            throw new Error(error.error || 'TTS request failed');
        }

        const ttsData = await ttsResponse.json();
        const ttsLatency = ttsData.latency || ((Date.now() - ttsStart) / 1000).toFixed(2);
        addLog('⏱️ TTS latency', `${ttsLatency}s`, 'info');

        const timeToPlay = ((Date.now() - turnStartTime) / 1000).toFixed(2);
        addLog('⏱️ Time until AI speaks', `${timeToPlay}s`, 'audio');

        // Play audio
        updateStatus('▶️ AI is speaking...');
        await playAudio(ttsData.audio);

        const totalTurnTime = ((Date.now() - turnStartTime) / 1000).toFixed(2);
        addLog('⏱️ Total AI turn time', `${totalTurnTime}s`, 'audio');

        if (currentTurn >= maxTurns) {
            endConversation();
        } else {
            isAISpeaking = false;
            recordBtn.disabled = false;
            updateStatus('🎙️ Your turn - Click to record (no time limit!)');
            addLog('👤 Your turn', 'Click "Record" to speak - streaming STT enabled', 'info');
        }

    } catch (error) {
        console.error('AI response error:', error);
        updateStatus('❌ Error occurred');
        addLog('Error', error.message, 'error');
        endConversation();
    }
}

// Process user's spoken turn
async function processUserTurn(transcription) {
    const turnStartTime = Date.now();

    try {
        addLog(`👤 User Turn ${currentTurn}`, transcription, 'transcription');

        window.lastUserText = transcription;

        currentTurn++;
        updateTurnIndicator();

        await generateAIResponse(false);

    } catch (error) {
        console.error('User turn error:', error);
        updateStatus('❌ Error occurred');
        addLog('Error', error.message, 'error');
        endConversation();
    }
}

// End conversation
function endConversation() {
    isConversationActive = false;
    isAISpeaking = false;
    currentTurn = maxTurns + 1;
    updateTurnIndicator();
    updateStatus('✅ Conversation complete!');
    addLog('🎬 Conversation', 'Conversation ended after 3 AI turns', 'info');

    startBtn.disabled = false;
    startBtn.textContent = 'Start New Conversation';
    recordBtn.disabled = true;
    recordBtn.classList.remove('recording');
    recordBtn.querySelector('.btn-text').textContent = 'Record';
}

// Play audio from base64
function playAudio(audioBase64) {
    return new Promise((resolve, reject) => {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.onended = resolve;
        audio.onerror = reject;
        audio.play();
    });
}

// Start Conversation button handler
startBtn.addEventListener('click', async () => {
    const success = await initStreamingAudio();
    if (!success) return;
    await startConversation();
});

// Record button handler
recordBtn.addEventListener('click', async () => {
    if (isAISpeaking || !isConversationActive) return;

    if (!isRecording) {
        // Start streaming recording
        recordBtn.disabled = true;
        updateStatus('🎙️ Connecting...');

        const success = await startStreaming();
        if (!success) {
            updateStatus('❌ Failed to start recording');
            recordBtn.disabled = false;
            return;
        }

        recordBtn.disabled = false;
        recordBtn.classList.add('recording');
        recordBtn.querySelector('.btn-text').textContent = 'Stop';
        recordBtn.querySelector('.btn-icon').textContent = '⏹️';
        updateStatus('🎙️ Recording... (speak naturally, no time limit)');

    } else {
        // Stop recording and process
        recordBtn.classList.remove('recording');
        recordBtn.querySelector('.btn-text').textContent = 'Record';
        recordBtn.querySelector('.btn-icon').textContent = '🎙️';
        recordBtn.disabled = true;
        updateStatus('⏳ Processing...');

        const transcription = await stopStreaming();

        if (transcription && transcription.trim()) {
            await processUserTurn(transcription);
        } else {
            updateStatus('⚠️ No speech detected, try again');
            recordBtn.disabled = false;
        }
    }
});

// Initial state
console.log('Streaming STT Voice Interaction ready!');
console.log('Click "Start Conversation" to begin');
updateTurnIndicator();
