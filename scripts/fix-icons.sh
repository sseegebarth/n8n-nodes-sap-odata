#!/bin/bash

# Fix Icons Script - Kopiert SAP Icons an alle benötigten Stellen
# Löst das 404 Problem bei den SAP Node Icons

set -e

echo "🎨 Fixing SAP Node Icons..."
echo "================================"

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Pfade
ICON_SOURCE="icons/sap.svg"
PROJECT_DIR="/Users/sseegebarth/Documents/Projekte/n8n_sap_community"

# Prüfe ob Icon existiert
if [ ! -f "$PROJECT_DIR/$ICON_SOURCE" ]; then
    echo "❌ Icon file not found: $ICON_SOURCE"
    echo "Creating default SAP icon..."
    mkdir -p "$PROJECT_DIR/icons"

    # Create a simple SAP logo SVG if it doesn't exist
    cat > "$PROJECT_DIR/$ICON_SOURCE" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0070b1"/>
  <text x="50" y="60" font-family="Arial,sans-serif" font-size="35" font-weight="bold" text-anchor="middle" fill="white">SAP</text>
</svg>
EOF
    echo -e "${GREEN}✓ Created default SAP icon${NC}"
fi

echo -e "${BLUE}📁 Copying icons to project build directories...${NC}"

# Kopiere Icons zu allen Node-Verzeichnissen im dist Ordner
DESTINATIONS=(
    "dist/nodes/Sap/"
    "dist/nodes/SapIdoc/"
    "dist/nodes/SapIdocWebhook/"
    "dist/nodes/SapRfc/"
    "dist/nodes/SapWebhook/"
    "dist/"
)

cd "$PROJECT_DIR"

for dest in "${DESTINATIONS[@]}"; do
    if [ -d "$dest" ]; then
        echo "  → Copying to $dest"
        cp "$ICON_SOURCE" "$dest"
    else
        echo "  ⚠️  Directory not found, creating: $dest"
        mkdir -p "$dest"
        cp "$ICON_SOURCE" "$dest"
    fi
done

echo -e "${GREEN}✓ Icons copied to dist directories${NC}"

# Wenn n8n custom directory existiert, kopiere auch dorthin
if [ -d "$HOME/.n8n/custom" ]; then
    echo -e "${BLUE}📁 Copying to n8n custom directory...${NC}"

    # WICHTIG: Icons müssen in die dist/nodes Verzeichnisse!
    CUSTOM_DESTINATIONS=(
        "$HOME/.n8n/custom/dist/nodes/Sap/"
        "$HOME/.n8n/custom/dist/nodes/SapIdoc/"
        "$HOME/.n8n/custom/dist/nodes/SapIdocWebhook/"
        "$HOME/.n8n/custom/dist/nodes/SapRfc/"
        "$HOME/.n8n/custom/dist/nodes/SapWebhook/"
        "$HOME/.n8n/custom/dist/"
        # Auch in die alten Verzeichnisse für Kompatibilität
        "$HOME/.n8n/custom/nodes/Sap/"
        "$HOME/.n8n/custom/nodes/SapIdoc/"
        "$HOME/.n8n/custom/nodes/SapIdocWebhook/"
        "$HOME/.n8n/custom/nodes/SapRfc/"
        "$HOME/.n8n/custom/nodes/SapWebhook/"
        "$HOME/.n8n/custom/"
    )

    for dest in "${CUSTOM_DESTINATIONS[@]}"; do
        if [ -d "$dest" ]; then
            echo "  → Copying to $dest"
            cp "$ICON_SOURCE" "$dest"
        else
            echo -e "${YELLOW}  ⚠️  Creating directory and copying: $dest${NC}"
            mkdir -p "$dest"
            cp "$ICON_SOURCE" "$dest"
        fi
    done

    echo -e "${GREEN}✓ Icons copied to n8n custom directory${NC}"

    # Verify icons are in place
    echo ""
    echo -e "${BLUE}🔍 Verifying icon deployment...${NC}"
    ICON_COUNT=$(find "$HOME/.n8n/custom/dist/nodes" -name "sap.svg" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Found $ICON_COUNT icons in dist/nodes directories"

    if [ "$ICON_COUNT" -ge 5 ]; then
        echo -e "${GREEN}✓ Icon deployment verified!${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Expected at least 5 icons, found $ICON_COUNT${NC}"
        echo "  Listing deployed icons:"
        find "$HOME/.n8n/custom/dist/nodes" -name "sap.svg" 2>/dev/null
    fi
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ Icon fix complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart n8n:"
echo "   pkill -f n8n && n8n start"
echo ""
echo "2. Clear browser cache:"
echo "   Safari: Cmd + Option + E, then Cmd + R"
echo "   Chrome: Cmd + Shift + R"
echo ""
echo "3. The SAP icons should now appear correctly"
echo ""
echo -e "${YELLOW}Note: Icons must be in dist/nodes/* directories for n8n to find them!${NC}"
echo ""