const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware - Configurable CORS for deployment
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Load GCP credentials (supports both local JSON file and base64 env var for cloud deployment)


// Initialize Google Cloud clients with credentials
const speechClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

// Initialize Vertex AI with credentials
const projectId = 'project-91ad2b7f-5b05-4cbc-990';
const location = process.env.GCP_REGION || 'us-central1';
const vertexAI = new VertexAI({
    project: projectId,
    location: location
});


// Endpoint: Initial AI Speech (AI speaks first)
app.post('/initial-speech', async (req, res) => {
    try {
        console.log('🎤 Generating AI initial speech...');
        const startTime = Date.now();

        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        const prompt = `You are starting a casual conversation with someone about AI in daily life.
Speak naturally as if you're having a friendly chat.
Speak for approximately 15–25 seconds (about 150-250 words).
Use natural spoken language with conversational pauses.
Share your thoughts openly and warmly.
Do not ask questions at the end.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.candidates[0].content.parts[0].text;

        const geminiTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ AI initial text generated (${geminiTime}s):`, responseText.substring(0, 100) + '...');

        res.json({
            response: responseText,
            latency: {
                gemini: geminiTime
            }
        });
    } catch (error) {
        console.error('❌ Initial speech error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 2: Chat with Gemini via Vertex AI
app.post('/chat', async (req, res) => {
    try {
        console.log('🤖 Sending to Gemini via Vertex AI...');
        const startTime = Date.now();

        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        const prompt = `User said: "${text}"

Respond naturally as if speaking in a conversation.
Speak for approximately 15–25 seconds (about 150-250 words).
Use natural spoken language.
Do not summarize.
Do not ask questions.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.candidates[0].content.parts[0].text;

        const geminiTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Gemini response (${geminiTime}s):`, responseText.substring(0, 100) + '...');
        res.json({
            response: responseText,
            latency: geminiTime
        });
    } catch (error) {
        console.error('❌ Gemini error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 3: Text-to-Speech (with speaker-aware voice selection)
app.post('/synthesize', async (req, res) => {
    try {
        const startTime = Date.now();
        const { text, speaker } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // Different voices for AI_1  and AI_2
        let voiceConfig;
        if (speaker === 'AI_1') {
            // AI_1: Male voice, slightly slower, deeper
            voiceConfig = {
                languageCode: 'en-US',
                name: 'en-US-Neural2-D',  // Male voice
                ssmlGender: 'MALE',
            };
            console.log('🔊 Synthesizing AI_1 (Male, calm)...');
        } else if (speaker === 'AI_2') {
            // AI_2: Female voice, slightly faster, higher pitch
            voiceConfig = {
                languageCode: 'en-US',
                name: 'en-US-Neural2-F',  // Female voice
                ssmlGender: 'FEMALE',
            };
            console.log('🔊 Synthesizing AI_2 (Female, energetic)...');
        } else if (speaker === 'AI_3') {
            // AI_3: Different male voice, moderate pace
            voiceConfig = {
                languageCode: 'en-US',
                name: 'en-US-Neural2-A',  // Different male voice
                ssmlGender: 'MALE',
            };
            console.log('🔊 Synthesizing AI_3 (Male, moderate)...');
        } else if (speaker === 'AI_4') {
            // AI_4: Different female voice, slightly different prosody
            voiceConfig = {
                languageCode: 'en-US',
                name: 'en-US-Neural2-C',  // Different female voice
                ssmlGender: 'FEMALE',
            };
            console.log('🔊 Synthesizing AI_4 (Female, distinct)...');
        } else {
            // Default voice
            voiceConfig = {
                languageCode: 'en-US',
                name: 'en-US-Neural2-F',
                ssmlGender: 'FEMALE',
            };
            console.log('🔊 Synthesizing speech...');
        }

        // Audio config with prosody adjustments
        let audioConfig = {
            audioEncoding: 'MP3',
        };

        // Add speaking rate variation
        if (speaker === 'AI_1') {
            audioConfig.speakingRate = 0.95;  // Slightly slower
            audioConfig.pitch = -3.5;         // lower pitch
        } else if (speaker === 'AI_2') {
            audioConfig.speakingRate = 0.9;   // Normal pace (was 1.1)
            audioConfig.pitch = 2.0;          // Slightly higher pitch
        } else if (speaker === 'AI_3') {
            audioConfig.speakingRate = 1.05;   // Normal pace
            audioConfig.pitch = -0.5;          // Normal pitch
        } else if (speaker === 'AI_4') {
            audioConfig.speakingRate = 1.0;  // Normal pace
            audioConfig.pitch = 1.2;          // Slightly higher pitch
        }

        const request = {
            input: { text },
            voice: voiceConfig,
            audioConfig: audioConfig,
        };

        const [response] = await ttsClient.synthesizeSpeech(request);

        const ttsTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Audio synthesized (${ttsTime}s)`);

        const audioBase64 = response.audioContent.toString('base64');
        res.json({
            audio: audioBase64,
            latency: ttsTime
        });
    } catch (error) {
        console.error('❌ TTS error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== MINI V4: Two AI Participants with Memory ==========

// Endpoint: V4 AI Response with Memory
app.post('/v4/ai-response', async (req, res) => {
    try {
        const { speaker, memory, topic } = req.body;

        if (!speaker) {
            return res.status(400).json({ error: 'No speaker provided' });
        }

        console.log(`🤖 [V4] ${speaker} generating response...`);
        const startTime = Date.now();

        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        // Use provided topic or fallback
        const gdTopic = topic || 'In the age of AI, are traditional university degrees becoming obsolete?';

        // ========== MEMORY STRATEGY ==========
        // 1. Fixed Discussion Intro (ALWAYS INCLUDED - verbatim)
        const discussionIntro = `Discussion Topic:
"${gdTopic}"

Context:
This is a group discussion (GD) with multiple participants exploring different
perspectives, trade-offs, and implications of the topic.

`;

        // Participant names mapping
        const historyNames = { 'AI_1': 'Parth', 'AI_2': 'Sneha', 'AI_3': 'Harsh', 'AI_4': 'Anshika', 'User': 'You (the human participant)' };

        // 2. Rolling Conversation Window (LAST 3 TURNS ONLY)
        let conversationHistory = '';
        // Opening turn is ONLY for the very first speaker (AI_1) when memory is empty
        let isOpeningTurn = (!memory || memory.length === 0) && speaker === 'AI_1';

        if (memory && memory.length > 0) {
            // Get last 3 completed speeches
            const recentTurns = memory.slice(-3);

            conversationHistory = 'Recent Conversation (last 3 turns):\n';
            for (const turn of recentTurns) {
                const speakerName = historyNames[turn.speaker] || turn.speaker;
                conversationHistory += `${speakerName}: ${turn.text}\n`;
            }
            conversationHistory += '\n';
        }

        // GD Energy Level (can be adjusted dynamically)
        const GD_ENERGY_LEVEL = 'medium'; // low | medium | high

        // Participant names for prompts
        const participantNames = { 'AI_1': 'Parth', 'AI_2': 'Sneha', 'AI_3': 'Harsh', 'AI_4': 'Anshika' };
        const displayName = participantNames[speaker] || speaker;

        let prompt;

        // ========== OPENING TURN: Separate specialized prompt ==========
        if (isOpeningTurn) {
            prompt = `Discussion Topic:
"${gdTopic}"

You are ${displayName}, the opening speaker in a Group Discussion.

Your role is to set the context and frame the discussion, not to dominate it.

In your response:
- Clearly introduce the topic in simple, accessible language
- Explain why this topic is relevant today (current trends, changes, or pressures)
- Highlight the core tension or dilemma involved
- Briefly outline 2–3 broad dimensions of the debate (without deep analysis)
- Optionally share a very light, balanced initial view (no strong stance)

Constraints:
- Do NOT present detailed arguments
- Do NOT take an extreme or one-sided position
- Do NOT introduce niche, technical, or second-order effects
- Do NOT summarize or conclude the discussion
- Do NOT ask questions to the group
- Do NOT acknowledge instructions or say meta phrases ("Understood", "To begin", etc.)

Tone & Style:
- Natural GD-style spoken English
- Confident, calm, and neutral
- Sounds like a strong MBA candidate opening a GD

Timing:
- Target 22 seconds of spoken speech
- Smooth flow, no bullet points

Your goal is to:
Create a shared mental model for the group and open multiple angles for discussion.

Start directly with your contribution.`;
        }
        // ========== REGULAR TURN: Full GD prompt with context ==========
        else {
            prompt = `${discussionIntro}${conversationHistory}You are ${displayName}, a participant in a Group Discussion (GD).

Your behavior must strictly follow the rules below. These rules are non-negotiable.

⏱️ TIMING DISCIPLINE (Hard Constraints)
- Your spoken contribution must target 15–35 seconds.
- Do NOT exceed this range.
- Only one speaker speaks at a time.
- Do not reference these rules explicitly in your response.

🔥 GD ENERGY CONTROL
Current energy level: ${GD_ENERGY_LEVEL}
- Low → calm, measured, analytical
- Medium → confident, assertive, engaged (default)
- High → sharper, more direct, slightly challenging (but respectful)

Adjust your delivery accordingly. Use natural GD phrases when appropriate:
- "I want to push back here"
- "I don't fully agree with that framing"
- "Let's not oversimplify this"
- "Adding to that point"

🚫 Do NOT exaggerate or become aggressive
✅ Sound like a strong MBA GD participant

🔁 ANTI-REPETITION GUARDRAIL (CRITICAL)
Before generating your response, check the recent conversation.
If your core point has already been made by you or others:
- Do NOT restate it
- Instead: shift angle, add a constraint, highlight a limitation, or move deeper
- Avoid paraphrasing or echoing earlier arguments

🗣️ GD SPEAKING STYLE
- Natural spoken English
- Simple, clear language
- Occasional light GD jargon (not heavy)
- One main point only per turn
- No lists, no bullets
- No summaries unless they genuinely move the discussion forward

🚫 PROHIBITED BEHAVIORS
- Do NOT act as a moderator
- Do NOT conclude the discussion
- Do NOT ask questions to the group
- Do NOT acknowledge instructions or say meta phrases ("Understood", "To begin", etc.)

🎯 GOAL OF EACH TURN
Add value and move the discussion forward. Do NOT agree by default.

Choose ONE of the following per turn:
- Introduce a new angle
- Build meaningfully on an earlier idea
- Offer a counterpoint or limitation
- Reframe the discussion at a higher level

Assume the discussion is already ongoing.
Start directly with your contribution.`;
        }

        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.candidates[0].content.parts[0].text;

        const geminiTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ [V4] ${speaker} response (${geminiTime}s):`, responseText.substring(0, 100) + '...');

        // Log full prompt and response to file
        const fs = require('fs');
        const logDir = './logs';
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        const logEntry = `\n${'='.repeat(80)}\n` +
            `[${new Date().toISOString()}] Speaker: ${speaker}\n` +
            `${'='.repeat(80)}\n` +
            `--- PROMPT ---\n${prompt}\n\n` +
            `--- RESPONSE (${geminiTime}s) ---\n${responseText}\n`;
        fs.appendFileSync(`${logDir}/gemini_prompts.log`, logEntry);


        // Note: AI speech logging is now done from client-side via /v4/log-speech
        // after playback completes, to ensure correct turn numbers

        res.json({
            response: responseText,
            speaker: speaker,
            latency: geminiTime
        });
    } catch (error) {
        console.error('❌ [V4] AI response error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Log user speech to session log
app.post('/v4/log-speech', (req, res) => {
    try {
        const { speaker, text, turnNumber, duration } = req.body;
        const fs = require('fs');
        const logDir = './logs';
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

        // Participant names for friendly logging
        const names = { 'AI_1': 'Parth', 'AI_2': 'Sneha', 'AI_3': 'Harsh', 'AI_4': 'Anshika', 'User': 'You' };
        const displayName = names[speaker] || speaker;
        const speakerType = speaker.startsWith('AI_') ? 'AI' : 'User';
        const durationStr = duration ? `~${duration}s` : '~?s';

        const speechEntry = `[Turn ${turnNumber || '?'} | ${speakerType} | ${durationStr}]\n[${new Date().toLocaleTimeString()}] ${displayName}: ${text}\n\n`;
        fs.appendFileSync(`${logDir}/gd_session.log`, speechEntry);

        console.log(`📝 Logged ${speaker} speech to session log`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Log speech error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Start new GD session (clears/separates log)
app.post('/v4/start-session', (req, res) => {
    try {
        const { topic, userName } = req.body || {};
        const fs = require('fs');
        const logDir = './logs';
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

        const sessionHeader = `\n${'═'.repeat(60)}\n` +
            `   NEW GD SESSION - ${new Date().toLocaleString()}\n` +
            `   GD Mode: Practice\n` +
            (userName ? `   Participant: ${userName}\n` : '') +
            (topic ? `   Topic: ${topic}\n` : '') +
            `${'═'.repeat(60)}\n\n`;
        fs.appendFileSync(`${logDir}/gd_session.log`, sessionHeader);

        console.log('📋 New GD session started, log header written');
        if (topic) console.log(`📌 Topic: ${topic}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Start session error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Log session summary at end of GD
app.post('/v4/end-session', (req, res) => {
    try {
        const { totalDuration, totalTurns, userTurns, participants } = req.body || {};
        const fs = require('fs');
        const logDir = './logs';
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

        const sessionSummary = `\n${'─'.repeat(60)}\n` +
            `   SESSION SUMMARY\n` +
            `${'─'.repeat(60)}\n` +
            `   Total Duration: ${totalDuration || 'N/A'}\n` +
            `   Total Turns: ${totalTurns || 'N/A'}\n` +
            `   User Turns: ${userTurns || 'N/A'}\n` +
            `   Participants: ${participants || 'N/A'}\n` +
            `${'─'.repeat(60)}\n\n`;
        fs.appendFileSync(`${logDir}/gd_session.log`, sessionSummary);

        console.log('📋 Session summary logged');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ End session error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Analyze GD session for post-discussion feedback
app.post('/v4/analyze-session', async (req, res) => {
    try {
        const { transcript, topic, userName, totalDuration, participantCount, turnCounts } = req.body;

        if (!transcript || !topic) {
            return res.status(400).json({ error: 'Missing transcript or topic' });
        }

        console.log('📊 Analyzing GD session...');
        const startTime = Date.now();

        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        // Format transcript for analysis
        const transcriptText = transcript.map((turn, i) =>
            `[Turn ${i + 1}] ${turn.speaker === 'User' ? userName || 'User' : turn.speaker}: ${turn.text}`
        ).join('\n\n');

        const userTurns = transcript.filter(t => t.speaker === 'User');
        const userTurnTexts = userTurns.map((t, i) => `Turn ${transcript.indexOf(t) + 1}: "${t.text}"`).join('\n');

        const analysisPrompt = `You are a professional GD evaluator and coach. Analyze this Group Discussion and provide structured feedback.

DISCUSSION TOPIC:
"${topic}"

SESSION DETAILS:
- Participant: ${userName || 'User'}
- Duration: ${totalDuration || 'Not recorded'}
- Total Participants: ${participantCount || 5} (1 human + 4 AI)
- User's Speaking Turns: ${userTurns.length}

FULL TRANSCRIPT:
${transcriptText}

USER'S CONTRIBUTIONS:
${userTurnTexts || 'No contributions recorded'}

Provide your analysis in the following JSON format. Be specific, supportive, and actionable. Do NOT use generic advice.

{
  "gdSummary": "A 4-6 sentence paragraph summarizing what the discussion covered, how it evolved (early framing to deeper trade-offs), and whether it stayed focused or fragmented. Write in plain English.",
  
  "keyThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4", "Theme 5"],
  
  "userContributions": [
    {"turn": 1, "summary": "2-3 line summary of what the user said and its purpose"},
    ...
  ],
  
  "feedback": {
    "strengths": [
      "Specific strength 1 with evidence",
      "Specific strength 2 with evidence"
    ],
    "improvements": [
      "Specific improvement area 1 with actionable tip",
      "Specific improvement area 2 with actionable tip"
    ]
  },
  
  "missedAngles": [
    "An angle that wasn't explored and why it would have been valuable",
    "Another unexplored perspective"
  ],
  
  "flowAssessment": {
    "flow": "smooth / uneven / fragmented",
    "balance": "well-balanced / dominated by few / under-participated",
    "engagement": "high / moderate / low"
  }
}

IMPORTANT:
- If user had 0 contributions, note this sensitively and focus on listening/observation feedback
- Be encouraging but honest
- Reference specific moments from the transcript
- Keep userContributions array empty if user didn't speak`;

        const result = await model.generateContent(analysisPrompt);
        const responseText = result.response.candidates[0].content.parts[0].text;

        // Parse JSON from response
        let analysis;
        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                [null, responseText];
            analysis = JSON.parse(jsonMatch[1] || responseText);
        } catch (parseError) {
            console.error('Failed to parse analysis JSON:', parseError);
            // Return a basic structure if parsing fails
            analysis = {
                gdSummary: "Analysis could not be fully processed. The discussion covered the topic with multiple perspectives shared.",
                keyThemes: ["Unable to extract themes"],
                userContributions: [],
                feedback: {
                    strengths: ["Participated in the discussion"],
                    improvements: ["Consider speaking more frequently"]
                },
                missedAngles: ["Analysis unavailable"],
                flowAssessment: {
                    flow: "moderate",
                    balance: "varied",
                    engagement: "moderate"
                }
            };
        }

        const analysisTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Analysis complete in ${analysisTime}s`);

        res.json({
            success: true,
            analysis: analysis,
            sessionOverview: {
                topic: topic,
                duration: totalDuration,
                participantCount: participantCount || 5,
                userTurnCount: userTurns.length
            }
        });

    } catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Generate topic from genre using Gemini
app.post('/v4/generate-topic', async (req, res) => {
    try {
        const { genre } = req.body;

        if (!genre) {
            return res.status(400).json({ error: 'No genre provided' });
        }

        console.log(`🎯 Generating topic for genre: ${genre}`);

        const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const genreDescriptions = {
            'politics': 'Politics & Governance',
            'business': 'Business & Economy',
            'education': 'Education & Careers',
            'environment': 'Environment & Climate',
            'technology': 'Technology & AI',
            'healthcare': 'Healthcare & Wellness',
            'society': 'Society & Culture',
            'ethics': 'Ethics & Philosophy',
            'innovation': 'Innovation & Startups',
            'global': 'Global Affairs'
        };

        const genreName = genreDescriptions[genre] || genre;

        const prompt = `Generate a single, thought-provoking Group Discussion (GD) topic in the category of "${genreName}".

Requirements:
- The topic should be debatable with multiple valid perspectives
- It should be relevant to current events or trends
- It should be suitable for a 10-15 minute discussion
- Format: A clear, concise statement or question (1-2 sentences max)

Respond with ONLY the topic text, nothing else.`;

        const result = await model.generateContent(prompt);
        const topic = result.response.candidates[0].content.parts[0].text.trim();

        console.log(`✅ Generated topic: ${topic}`);
        res.json({ topic });
    } catch (error) {
        console.error('❌ Topic generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for streaming STT
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected for streaming STT');

    let recognizeStream = null;
    let finalTranscript = '';

    // Streaming STT configuration
    const streamingConfig = {
        config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
        },
        interimResults: true,
    };

    // Start streaming recognition
    function startStream() {
        finalTranscript = '';

        recognizeStream = speechClient
            .streamingRecognize(streamingConfig)
            .on('error', (error) => {
                console.error('❌ Streaming STT error:', error.message);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'error', message: error.message }));
                }
            })
            .on('data', (data) => {
                if (data.results && data.results[0]) {
                    const result = data.results[0];
                    const transcript = result.alternatives[0]?.transcript || '';

                    if (result.isFinal) {
                        finalTranscript += transcript + ' ';
                        console.log('📝 Final chunk:', transcript);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'partial',
                                transcript: finalTranscript.trim(),
                                isFinal: false
                            }));
                        }
                    } else {
                        // Send interim result
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'partial',
                                transcript: finalTranscript + transcript,
                                isFinal: false
                            }));
                        }
                    }
                }
            })
            .on('end', () => {
                console.log('✅ Streaming STT session ended');
            });

        console.log('🎙️ Started streaming STT session');
    }

    // Handle incoming messages
    ws.on('message', (message) => {
        // Try to parse as JSON first (control messages)
        // If it fails, treat as binary audio data
        let messageStr;
        try {
            messageStr = message.toString();
            const data = JSON.parse(messageStr);

            // It's a valid JSON control message
            console.log('📩 Received control message:', data.type);

            if (data.type === 'start') {
                console.log('▶️ Starting streaming STT...');
                startStream();
            } else if (data.type === 'stop') {
                console.log('⏹️ Stopping streaming STT...');
                if (recognizeStream) {
                    recognizeStream.end();

                    // Send final transcript
                    setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'final',
                                transcript: finalTranscript.trim()
                            }));
                            console.log('✅ Final transcript sent:', finalTranscript.trim().substring(0, 100) + '...');
                        }
                    }, 500);
                }
            }
        } catch (e) {
            // Not valid JSON - treat as binary audio data
            if (recognizeStream && !recognizeStream.destroyed) {
                recognizeStream.write(message);
            }
        }
    });

    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        if (recognizeStream && !recognizeStream.destroyed) {
            recognizeStream.end();
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        if (recognizeStream && !recognizeStream.destroyed) {
            recognizeStream.end();
        }
    });
});

const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('📌 Auth: Application Default Credentials (ADC)');
    console.log(`📌 GCP Project: ${projectId}`);
    console.log(`📌 Region: ${location}`);
    console.log('📌 Model: gemini-2.5-pro');
    console.log('📌 WebSocket streaming STT enabled');
    if (process.env.FRONTEND_URL) {
        console.log(`📌 CORS Origin: ${process.env.FRONTEND_URL}`);
    }
});