#!/bin/bash

# Voice Pipeline Experiment - Quick Start Script
# This script sets up environment variables and starts the server

export GCP_PROJECT_ID="project-1c1dcaad-b126-4e92-8ed"
export GCP_REGION="us-central1"

echo "🚀 Starting Voice Pipeline Experiment..."
echo "📌 Using GCP Project: $GCP_PROJECT_ID"
echo "📌 Using Region: $GCP_REGION"
echo ""

node server.js
