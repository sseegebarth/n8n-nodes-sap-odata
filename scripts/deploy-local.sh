#!/bin/bash

# Deploy Script für lokale n8n Installation
# Kopiert den SAP OData Node nach ~/.n8n/custom/

set -e  # Exit bei Fehler

echo "🚀 Deploying SAP OData Node to local n8n..."
echo "================================================"

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Projekt-Root
PROJECT_DIR="/Users/sseegebarth/Documents/Projekte/n8n_sap_community"
N8N_CUSTOM_DIR="$HOME/.n8n/custom"

# 1. Build das Projekt
echo -e "${BLUE}📦 Building project...${NC}"
cd "$PROJECT_DIR"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# 2. Stoppe n8n
echo -e "${BLUE}🛑 Stopping n8n...${NC}"
pkill -f "n8n" 2>/dev/null || echo "n8n war nicht gestartet"
sleep 2

# 3. Backup erstellen (optional)
BACKUP_DIR="$HOME/.n8n/custom_backup_$(date +%Y%m%d_%H%M%S)"
echo -e "${BLUE}💾 Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
cp -r "$N8N_CUSTOM_DIR/nodes" "$BACKUP_DIR/" 2>/dev/null || echo "Kein nodes Verzeichnis zum Backup"
cp -r "$N8N_CUSTOM_DIR/credentials" "$BACKUP_DIR/" 2>/dev/null || echo "Kein credentials Verzeichnis zum Backup"
cp "$N8N_CUSTOM_DIR/package.json" "$BACKUP_DIR/" 2>/dev/null || echo "Keine package.json zum Backup"
echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"

# 4. Kopiere neue Dateien
echo -e "${BLUE}📁 Copying files to ~/.n8n/custom/${NC}"

# Nodes kopieren
echo "  - Copying nodes..."
cp -r "$PROJECT_DIR/nodes" "$N8N_CUSTOM_DIR/"

# Credentials kopieren
echo "  - Copying credentials..."
cp -r "$PROJECT_DIR/credentials" "$N8N_CUSTOM_DIR/"

# Dist kopieren
echo "  - Copying dist..."
cp -r "$PROJECT_DIR/dist" "$N8N_CUSTOM_DIR/"

# Package.json kopieren
echo "  - Copying package.json..."
cp "$PROJECT_DIR/package.json" "$N8N_CUSTOM_DIR/"

# Icons kopieren (falls vorhanden)
if [ -d "$PROJECT_DIR/icons" ]; then
    echo "  - Copying icons..."
    cp -r "$PROJECT_DIR/icons" "$N8N_CUSTOM_DIR/"

    # Icons auch direkt zu den Node-Verzeichnissen kopieren
    echo "  - Fixing icon paths..."
    bash "$PROJECT_DIR/scripts/fix-icons.sh" > /dev/null 2>&1
fi

echo -e "${GREEN}✓ Files copied successfully${NC}"

# 5. Dependencies installieren (falls package.json geändert)
echo -e "${BLUE}📦 Installing dependencies in ~/.n8n/custom/${NC}"
cd "$N8N_CUSTOM_DIR"
npm install --production --no-audit 2>&1 | grep -v "npm WARN" || true

echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo "================================================"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "To start n8n with SAP nodes, run:"
echo ""
echo -e "${BLUE}  N8N_SECURE_COOKIE=false n8n start${NC}"
echo ""
echo "Or in the background:"
echo "  N8N_SECURE_COOKIE=false n8n start &"
echo ""
echo "Then visit: http://localhost:5678"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "================================================"
