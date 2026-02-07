A minimal technical spike to validate the voice → LLM → voice pipeline using Google Cloud services with Application Default Credentials (ADC).

🎯 What This Does
User speaks into microphone
Google Speech-to-Text converts speech to text
Gemini API generates a natural response
Google Text-to-Speech converts response to audio
Browser plays the audio response
🔧 Prerequisites
GCP SDK installed

# Check if installed
gcloud --version
ADC authentication configured

gcloud auth application-default login
GCP Project ID

Know your GCP project ID
Set as environment variable:
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"  # Optional, defaults to us-central1
GCP APIs enabled

Speech-to-Text API
Text-to-Speech API
Vertex AI API
Ensure billing is enabled
🚀 Setup & Run
Install dependencies

npm install
Start the server

GCP_PROJECT_ID="your-project-id" node server.js
Open in browser

http://localhost:3000
Test the pipeline

Click "Start Recording"
Speak a phrase (e.g., "Hello, how are you?")
Click "Stop Recording"
Wait for the response to play
📁 Project Structure
voice-pipeline-experiment/
├── server.js           # Express server with 3 endpoints
├── package.json        # Dependencies
├── public/
│   ├── index.html     # Minimal UI
│   ├── app.js         # Frontend logic
│   └── style.css      # Styling
└── README.md          # This file
🔌 API Endpoints
POST /transcribe
Input: Audio file (multipart/form-data)
Output: { text: "transcribed text" }
Uses: Google Cloud Speech-to-Text (ADC)
POST /chat
Input: { text: "user message" }
Output: { response: "gemini response" }
Uses: Vertex AI - Gemini 2.0 Flash (ADC)
POST /synthesize
Input: { text: "text to speak" }
Output: { audio: "base64-encoded-mp3" }
Uses: Google Cloud Text-to-Speech (ADC)
🐛 Troubleshooting
"ADC not configured" error
gcloud auth application-default login
"GCP_PROJECT_ID not set" error
export GCP_PROJECT_ID="your-project-id"
node server.js
"API not enabled" error
Go to GCP Console
Enable Speech-to-Text API
Enable Text-to-Speech API
Enable Vertex AI API
Ensure billing is enabled
Microphone access denied
Check browser permissions
Use HTTPS or localhost only
⚡ Expected Performance
Round-trip time: ~1-2 seconds
Transcription: ~200-500ms
Gemini response: ~500-800ms
TTS synthesis: ~300-500ms
Network overhead: ~200-400ms
🎯 Success Criteria
✅ User can speak into microphone
✅ Speech is correctly transcribed
✅ Gemini returns a natural response
✅ Response is spoken back clearly
✅ Total round-trip feels fast (~1-2s)
✅ Loop works consistently

📝 Notes
This is a technical validation only, not a production system
No memory, database, or user authentication
Hardcoded voice settings (en-US-Neural2-F)
Console logging for debugging
Minimal error handling
🔒 Authentication
All services use Application Default Credentials (ADC):

Speech-to-Text: ADC ✅
Vertex AI (Gemini): ADC ✅
Text-to-Speech: ADC ✅
No service account JSON files needed!
No API keys needed!

Just run: gcloud auth application-default login



sage is my project name and i wan to add it in my cv 
Krishimitr | React.js, Node.js, Express.js, MongoDB, Tailwind CSS	Github
•	Developed KrishiMitr, a platform enabling farmers to directly connect with consumers and retailers, enhancing market access and reducing intermediaries.
•	Designed an intuitive and easy-to-use user interface to simplify navigation and improve adoption among farmers and consumers.
•	Built a feature-rich product listing system, allowing farmers to showcase their produce with detailed descriptions and real-time availability updates.
•	Integrated a feedback mechanism for farmers and consumers, fostering trust and encouraging long-term collaboration.

