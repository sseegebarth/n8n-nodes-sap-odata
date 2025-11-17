#!/bin/bash

# Start n8n with development settings
# Disables secure cookie for local HTTP access

echo "🚀 Starting n8n in development mode..."
echo "   URL: http://localhost:5678"
echo ""
echo "Press Ctrl+C to stop n8n"
echo ""

N8N_SECURE_COOKIE=false n8n start
