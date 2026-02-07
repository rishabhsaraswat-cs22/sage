# Quick Start Guide - ADC Only

## Prerequisites
1. Install Google Cloud SDK
2. Run: `gcloud auth application-default login`
3. Set your GCP project ID

## Run the Server

```bash
cd /Users/rudrapatole/.gemini/antigravity/scratch/voice-pipeline-experiment

# Set your GCP project ID
export GCP_PROJECT_ID="your-project-id"

# Optional: Set region (defaults to us-central1)
export GCP_REGION="us-central1"

# Start server
node server.js
```

## Open Browser
Navigate to: `http://localhost:3000`

## Test
1. Click "Start Recording"
2. Speak a phrase
3. Click "Stop Recording"
4. Listen to the response

---

**All authentication uses ADC - no API keys needed!**
- Speech-to-Text: ADC ✅
- Vertex AI (Gemini): ADC ✅
- Text-to-Speech: ADC ✅
