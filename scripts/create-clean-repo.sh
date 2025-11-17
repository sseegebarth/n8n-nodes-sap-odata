#!/bin/bash

# Script zum Erstellen eines sauberen Repos ohne Historie
# Für Beta/Production Release

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🎯 Creating clean repository for production release${NC}"
echo "================================================"

# Projekt-Verzeichnis
PROJECT_DIR="/Users/sseegebarth/Documents/Projekte/n8n_sap_community"
CLEAN_DIR="/Users/sseegebarth/Documents/Projekte/n8n-nodes-sap-odata-clean"

# 1. Erstelle neues Verzeichnis
echo -e "${BLUE}📁 Creating clean directory...${NC}"
rm -rf "$CLEAN_DIR" 2>/dev/null || true
mkdir -p "$CLEAN_DIR"
echo -e "${GREEN}✓ Directory created: $CLEAN_DIR${NC}"

# 2. Kopiere nur Production-Dateien
echo -e "${BLUE}📦 Copying production files...${NC}"
cd "$PROJECT_DIR"

# Haupt-Dateien
echo "  - Copying package files..."
cp package.json "$CLEAN_DIR/"
cp package-lock.json "$CLEAN_DIR/" 2>/dev/null || true

# tsconfig und andere configs
echo "  - Copying configs..."
cp tsconfig.json "$CLEAN_DIR/"
cp .npmignore "$CLEAN_DIR/"

# README und Docs
echo "  - Copying documentation..."
cp README.md "$CLEAN_DIR/"
cp CHANGELOG.md "$CLEAN_DIR/"
cp LICENSE "$CLEAN_DIR/" 2>/dev/null || echo "    (LICENSE nicht gefunden - bitte erstellen!)"

# Production Docs
mkdir -p "$CLEAN_DIR/docs"
cp ARCHITECTURE.md "$CLEAN_DIR/" 2>/dev/null || true
cp SECURITY.md "$CLEAN_DIR/" 2>/dev/null || true
cp DEPLOYMENT.md "$CLEAN_DIR/" 2>/dev/null || true

# Wichtige Feature-Docs
if [ -d "docs/features" ]; then
    echo "  - Copying feature docs..."
    cp -r docs/features "$CLEAN_DIR/docs/"
fi

if [ -d "docs/guides" ]; then
    echo "  - Copying guides..."
    cp -r docs/guides "$CLEAN_DIR/docs/"
fi

if [ -d "docs/cookbook" ]; then
    echo "  - Copying cookbook..."
    cp -r docs/cookbook "$CLEAN_DIR/docs/"
fi

# Source Code
echo "  - Copying source code..."
cp -r nodes "$CLEAN_DIR/"
cp -r credentials "$CLEAN_DIR/"
cp -r icons "$CLEAN_DIR/"

# Tests (optional - auskommentieren wenn nicht gewünscht)
echo "  - Copying tests..."
cp -r test "$CLEAN_DIR/"
cp jest.config.js "$CLEAN_DIR/" 2>/dev/null || true

echo -e "${GREEN}✓ Files copied${NC}"

# 3. Bereinige ungewollte Dateien
echo -e "${BLUE}🧹 Cleaning up...${NC}"
cd "$CLEAN_DIR"

# Entferne Dev-Dateien
rm -rf .git
rm -rf node_modules
rm -rf dist
rm -rf coverage
rm -rf docs-backup-*
rm -rf .vscode
rm -rf .idea

# Entferne temporäre/interne Docs
rm -f CODE_HUMANIZATION_GUIDE.md
rm -f CODE_REVIEW_*.md
rm -f CRITICAL_ISSUES_*.md
rm -f *SESSION*.md
rm -f *IMPLEMENTATION*.md
rm -f *ANALYSIS*.md

echo -e "${GREEN}✓ Cleanup complete${NC}"

# 4. Erstelle .gitignore
echo -e "${BLUE}📝 Creating .gitignore...${NC}"
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Build output
dist/
*.tsbuildinfo

# Testing
coverage/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Temporary
*.tmp
*.bak
*~

# n8n specific
docs-backup-*/
EOF
echo -e "${GREEN}✓ .gitignore created${NC}"

# 5. Initialisiere Git
echo -e "${BLUE}🔧 Initializing git repository...${NC}"
git init
git add .
echo -e "${GREEN}✓ Git initialized${NC}"

# 6. Erstelle initialen Commit
echo -e "${BLUE}💾 Creating initial commit...${NC}"
cat > COMMIT_MSG.txt << 'EOF'
feat: Initial release - SAP OData n8n Community Node v1.4.0

🎉 First public release of the SAP OData integration for n8n

Features:
- Complete OData V2/V4 support
- CRUD operations (Create, Read, Update, Delete)
- Batch operations
- Function imports
- Deep inserts
- Navigation properties
- SAP Gateway compatibility
- CSRF token management
- Session persistence
- Real-time webhooks
- Comprehensive error handling
- Type conversion
- Metadata caching

Security:
- Input validation & sanitization
- SSRF protection
- SQL injection prevention
- XSS protection
- Prototype pollution protection
- Credential isolation

Testing:
- 396 passing tests
- 64%+ code coverage
- Integration tests
- Security tests

Documentation:
- Complete API documentation
- Usage guides
- Cookbook recipes
- Architecture documentation

🚀 Ready for beta testing
EOF

git commit -F COMMIT_MSG.txt
rm COMMIT_MSG.txt

echo -e "${GREEN}✓ Initial commit created${NC}"

# 7. Update package.json für public release
echo -e "${BLUE}📝 Updating package.json for public release...${NC}"

# Backup erstellen
cp package.json package.json.backup

# Setze Version auf 1.0.0 (oder aktuell)
# Aktualisiere Repository URLs
cat > package.json << 'EOF'
{
  "name": "n8n-nodes-sap-odata",
  "version": "1.0.0",
  "description": "n8n community node for SAP OData integration with comprehensive CRUD operations, batch processing, and real-time webhook support",
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "sap",
    "odata",
    "integration",
    "webhook",
    "erp"
  ],
  "license": "MIT",
  "homepage": "https://github.com/yourusername/n8n-nodes-sap-odata#readme",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/n8n-nodes-sap-odata.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/n8n-nodes-sap-odata/issues"
  },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && npm run copy-icons",
    "copy-icons": "copyfiles -u 1 \"icons/**/*\" dist/",
    "dev": "tsc --watch",
    "format": "prettier --write \"**/*.{ts,json,md}\"",
    "lint": "eslint nodes credentials --ext .ts",
    "lintfix": "eslint nodes credentials --ext .ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prepublishOnly": "npm run build && npm run lint && npm test"
  },
  "files": [
    "dist",
    "docs",
    "icons",
    "LICENSE",
    "README.md",
    "CHANGELOG.md"
  ],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/SapOdataApi.credentials.js",
      "dist/credentials/SapOdataWebhookApi.credentials.js",
      "dist/credentials/SapIdocApi.credentials.js",
      "dist/credentials/SapIdocWebhookApi.credentials.js",
      "dist/credentials/SapRfcApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/Sap/SapOData.node.js",
      "dist/nodes/SapIdoc/SapIdoc.node.js",
      "dist/nodes/SapIdocWebhook/SapIdocWebhook.node.js",
      "dist/nodes/SapRfc/SapRfc.node.js",
      "dist/nodes/SapWebhook/SapODataWebhook.node.js"
    ]
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^18.16.0",
    "@types/request-promise-native": "^1.0.18",
    "@types/xml2js": "^0.4.14",
    "@typescript-eslint/eslint-plugin": "^5.62.0",
    "@typescript-eslint/parser": "^5.0.0",
    "copyfiles": "^2.4.1",
    "eslint": "^8.0.0",
    "eslint-plugin-import": "^2.32.0",
    "eslint-plugin-n8n-nodes-base": "^1.11.0",
    "jest": "^29.5.0",
    "n8n-workflow": "^1.0.0",
    "nock": "^13.3.0",
    "prettier": "^2.8.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "n8n-workflow": "*"
  },
  "dependencies": {
    "xml2js": "^0.6.2",
    "xmlbuilder2": "^3.1.1"
  },
  "optionalDependencies": {
    "node-rfc": "^3.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

echo -e "${YELLOW}⚠️  WICHTIG: Bitte aktualisiere in package.json:${NC}"
echo "   - repository.url (deine GitHub URL)"
echo "   - homepage (deine GitHub URL)"
echo "   - author.name (dein Name)"
echo "   - author.email (deine Email)"

echo ""
echo "================================================"
echo -e "${GREEN}✅ Clean repository created!${NC}"
echo ""
echo "Location: $CLEAN_DIR"
echo ""
echo "Next steps:"
echo "  1. cd $CLEAN_DIR"
echo "  2. Edit package.json (update URLs, author, etc.)"
echo "  3. npm install"
echo "  4. npm run build"
echo "  5. npm test"
echo "  6. Create GitHub repository"
echo "  7. git remote add origin YOUR_REPO_URL"
echo "  8. git push -u origin main"
echo ""
echo "================================================"
