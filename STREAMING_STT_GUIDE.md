# Google Streaming Speech-to-Text - Reference Guide

A reusable guide for implementing real-time streaming STT with Google Cloud and WebSocket.

---

## Architecture

```
Browser Microphone
    ↓ (16kHz LINEAR16 audio chunks)
WebSocket Connection
    ↓
Node.js Server
    ↓ (streamingRecognize)
Google Cloud Speech-to-Text
    ↓
Partial/Final Transcripts → Browser
```

---

## Prerequisites

```bash
# 1. Google Cloud Authentication
gcloud auth application-default login

# 2. Dependencies
npm install @google-cloud/speech ws express
```

---

## Server Code (Node.js)

```javascript
const WebSocket = require('ws');
const speech = require('@google-cloud/speech');
const http = require('http');
const express = require('express');

const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const speechClient = new speech.SpeechClient();

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    let recognizeStream = null;
    let finalTranscript = '';
    
    const streamingConfig = {
        config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
        },
        interimResults: true,
    };
    
    function startStream() {
        finalTranscript = '';
        recognizeStream = speechClient
            .streamingRecognize(streamingConfig)
            .on('error', (err) => {
                console.error('STT Error:', err.message);
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
            })
            .on('data', (data) => {
                if (data.results?.[0]) {
                    const result = data.results[0];
                    const transcript = result.alternatives[0]?.transcript || '';
                    
                    if (result.isFinal) {
                        finalTranscript += transcript + ' ';
                    }
                    
                    ws.send(JSON.stringify({
                        type: 'partial',
                        transcript: finalTranscript + (result.isFinal ? '' : transcript)
                    }));
                }
            });
    }
    
    // IMPORTANT: Try JSON first, then treat as audio
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'start') startStream();
            if (data.type === 'stop') {
                recognizeStream?.end();
                setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'final', transcript: finalTranscript.trim() }));
                }, 500);
            }
        } catch (e) {
            // Not JSON = audio data
            recognizeStream?.write(message);
        }
    });
    
    ws.on('close', () => recognizeStream?.end());
});

server.listen(3000, () => console.log('Server on :3000'));
```

---

## Client Code (Browser)

```javascript
let audioContext, mediaStream, audioProcessor, websocket;
let isRecording = false;

// Downsample from browser rate (48kHz) to target rate (16kHz)
function downsample(buffer, inputRate, outputRate) {
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        let sum = 0;
        for (let j = start; j < end && j < buffer.length; j++) sum += buffer[j];
        result[i] = sum / (end - start);
    }
    return result;
}

// Convert Float32 to Int16 (LINEAR16)
function floatTo16BitPCM(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
}

async function startRecording() {
    // Get microphone
    mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true }
    });
    
    audioContext = new AudioContext();
    const inputRate = audioContext.sampleRate; // Usually 48000
    
    // Connect WebSocket
    websocket = new WebSocket(`ws://${location.host}`);
    websocket.onopen = () => {
        websocket.send(JSON.stringify({ type: 'start' }));
        
        // Setup audio pipeline
        const source = audioContext.createMediaStreamSource(mediaStream);
        audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        audioProcessor.onaudioprocess = (e) => {
            if (!isRecording || websocket.readyState !== WebSocket.OPEN) return;
            
            const input = e.inputBuffer.getChannelData(0);
            const downsampled = downsample(input, inputRate, 16000);
            const int16 = floatTo16BitPCM(downsampled);
            websocket.send(int16.buffer);
        };
        
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        isRecording = true;
    };
    
    websocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'partial' || data.type === 'final') {
            console.log('Transcript:', data.transcript);
        }
    };
}

function stopRecording() {
    isRecording = false;
    websocket?.send(JSON.stringify({ type: 'stop' }));
    audioProcessor?.disconnect();
    mediaStream?.getTracks().forEach(t => t.stop());
}
```

---

## Key Gotchas

| Issue | Solution |
|-------|----------|
| `ws` library sends ALL messages as Buffer | Try `JSON.parse()` first, treat as audio only if it fails |
| Browser uses 48kHz, Google needs 16kHz | Downsample before sending |
| Audio must be LINEAR16 format | Convert Float32 to Int16 |
| Streaming has 5-minute limit | Restart stream before limit (for very long sessions) |

---

## Quick Test

```bash
# Start server
npm start

# Open browser
http://localhost:3000/stt-test.html
```

---

## Links

- [Google Cloud STT Streaming Docs](https://cloud.google.com/speech-to-text/docs/streaming-recognize)
- [ws npm package](https://www.npmjs.com/package/ws)
