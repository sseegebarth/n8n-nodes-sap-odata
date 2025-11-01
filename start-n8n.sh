#!/bin/bash
# n8n Development Start Script
# Startet n8n mit lokaler Konfiguration für SAP OData Node Development

echo "🚀 Starting n8n for SAP OData development..."

# Stop any running n8n instances
pkill -f n8n 2>/dev/null
sleep 2

# Environment variables for local development
export N8N_SECURE_COOKIE=false
export N8N_BASIC_AUTH_ACTIVE=false
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false
export DB_SQLITE_POOL_SIZE=5
export N8N_RUNNERS_ENABLED=true
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false
export N8N_GIT_NODE_DISABLE_BARE_REPOS=true

# Start n8n in background
cd ~
n8n start > /tmp/n8n.log 2>&1 &

echo "⏳ Waiting for n8n to start..."
sleep 5

# Check if n8n is running
if pgrep -f "n8n" > /dev/null; then
    echo "✅ n8n is running!"
    echo ""
    echo "🌐 Editor: http://localhost:5678"
    echo "📋 Logs:   tail -f /tmp/n8n.log"
    echo ""
    echo "To stop n8n: pkill -f n8n"

    # Open browser (macOS)
    sleep 2
    open http://localhost:5678
else
    echo "❌ n8n failed to start. Check logs:"
    echo "   tail -50 /tmp/n8n.log"
    exit 1
fi
