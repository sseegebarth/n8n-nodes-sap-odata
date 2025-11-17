# SAP OData Node - Deployment Guide für 3-Wochen-Challenge

## 🚀 Quick Start: Deployment in 30 Minuten

### Phase 1: Package für Beta-Testing vorbereiten (JETZT)

#### 1. package.json aktualisieren
```bash
# Version auf Beta setzen
npm version 0.1.0-beta.1 --no-git-tag-version

# Dann in package.json manuell anpassen:
# - "author": Dein Name/Email
# - "repository": Dein GitHub Repo
# - "homepage": Dein GitHub Repo
```

#### 2. .npmignore erstellen
```bash
cat > .npmignore << 'EOF'
# Source files
nodes/
credentials/
test/
*.ts
!*.d.ts

# Config files
tsconfig.json
.eslintrc.js
jest.config.js

# Development files
.git
.github
.vscode
*.md
!README.md

# Build artifacts
coverage/
*.log
node_modules/

# Documentation (außer README)
docs/
*.md
!README.md
!CHANGELOG.md
EOF
```

#### 3. README.md für Tester erstellen
```bash
cat > README.md << 'EOF'
# n8n-nodes-sap-odata (BETA)

🚧 **3-Wochen-Challenge - Week 1**

SAP OData Integration für n8n mit Webhook-Support.

## ⚠️ Beta-Tester Warnung
Dies ist eine **aktive Beta**. Tägliche Updates erwartet!
- Bugs werden täglich gefixt
- Breaking Changes möglich
- Feedback erwünscht!

## 🚀 Installation

### Option A: NPM Install (Empfohlen für Tester)
\`\`\`bash
cd ~/.n8n/custom
npm install n8n-nodes-sap-odata@beta
# n8n restart erforderlich
\`\`\`

### Option B: Entwickler-Setup
\`\`\`bash
cd ~/.n8n/custom
git clone https://github.com/DEIN-USERNAME/n8n-nodes-sap-odata.git
cd n8n-nodes-sap-odata
npm install && npm run build
\`\`\`

## 📦 Was ist enthalten?
- ✅ SAP OData Node (Read/Write)
- ✅ SAP OData Webhook
- ✅ SAP IDoc Node
- ✅ SAP IDoc Webhook
- ✅ SAP RFC Node

## 🔧 SAP Verbindung einrichten

### Credentials erstellen:
1. n8n öffnen → Credentials → New Credential
2. "SAP OData API" auswählen
3. Eingeben:
   - **Host**: https://your-sap-system.com
   - **Username**: SAP_USER
   - **Password**: ••••••••
   - **Client**: 100 (optional)

## 📚 Beispiel-Workflows

### OData: Alle Kunden lesen
\`\`\`
SAP OData Node
├─ Operation: Get All Entities
├─ Entity Set: CustomerSet
└─ Output: Array von Kunden
\`\`\`

### Webhook: Bei neuem Auftrag triggern
\`\`\`
SAP OData Webhook
├─ Entity Set: SalesOrderSet
├─ Trigger: On Create
└─ Automation startet automatisch
\`\`\`

## 🐛 Bekannte Probleme (Week 1)
- [ ] Function Imports teilweise instabil
- [ ] Navigation Properties bei großen Datasets langsam
- [ ] RFC-Support benötigt node-rfc Installation

## 💬 Feedback
- GitHub Issues: https://github.com/DEIN-USERNAME/n8n-nodes-sap-odata/issues
- Discord: #sap-integration
- Email: deine@email.com

## 🗓️ Update-Frequenz
- **Week 1**: Täglich (Bugfixes)
- **Week 2-3**: 2x täglich (Features + Fixes)

## 📝 Changelog
Siehe [CHANGELOG.md](CHANGELOG.md)

---

**Teil der #21DaysSAPChallenge** 🚀
EOF
\`\`\`

#### 4. CHANGELOG.md erstellen
```bash
cat > CHANGELOG.md << 'EOF'
# Changelog

## [0.1.0-beta.1] - 2024-11-17

### Added
- Initial beta release
- SAP OData Node (CRUD operations)
- SAP OData Webhook
- SAP IDoc Node
- SAP IDoc Webhook
- SAP RFC Node
- Connection pooling
- Session management
- CSRF token handling
- Error handling with SAP messages

### Known Issues
- Function Import parameter encoding incomplete
- Large dataset navigation properties slow
- Test coverage at 45% (target: 80%)

### Notes
- Part of 3-Week Challenge
- Daily updates expected
- Breaking changes possible
EOF
```

---

## 🚢 Deployment-Optionen

### Option 1: NPM Public Package (Empfohlen für Challenge)

**Vorbereitung:**
```bash
# 1. npm Account erstellen (falls nicht vorhanden)
npm login

# 2. Package-Name prüfen
npm view n8n-nodes-sap-odata
# Falls vergeben → Namen ändern in package.json

# 3. Testbuild
npm run build
npm run lint  # Sollte ohne Fehler durchlaufen

# 4. Als Beta publishen
npm publish --tag beta --access public
```

**Tester Installation:**
```bash
npm install n8n-nodes-sap-odata@beta
```

**Updates deployen (täglich):**
```bash
npm version prerelease --preid=beta  # Erhöht auf 0.1.0-beta.2
npm publish --tag beta
```

---

### Option 2: GitHub Releases + Direct Install

**Vorbereitung:**
```bash
# 1. Repo auf GitHub pushen
git add .
git commit -m "feat: Beta release for 3-week challenge"
git push origin main

# 2. Release erstellen
git tag v0.1.0-beta.1
git push --tags
```

**Tester Installation:**
```bash
cd ~/.n8n/custom
git clone https://github.com/DEIN-USERNAME/n8n-nodes-sap-odata.git
cd n8n-nodes-sap-odata
npm install && npm run build
```

**Updates:**
```bash
git pull && npm run build
```

---

### Option 3: Hybrid (NPM + GitHub) - **BESTE OPTION für dich!**

**Workflow:**
```bash
# Morgens: Code fix
git add .
git commit -m "fix: Session timeout handling"
git push

# Beta-Version publishen
npm version prerelease --preid=beta
npm publish --tag beta

# Tester benachrichtigen
echo "Beta $(npm pkg get version) released!
- npm update n8n-nodes-sap-odata@beta
- oder: git pull && npm run build"
```

---

## 📊 Tester-Tracking Dashboard

Erstelle ein Google Sheet oder Notion Board:

| Tester | Install Methode | SAP System | Status | Letzte Aktivität |
|--------|----------------|------------|--------|------------------|
| John D | npm beta | S/4HANA | ✅ Active | 2024-11-17 |
| Sarah M | git clone | ECC 6.0 | ⚠️ Issues | 2024-11-16 |
| ... | ... | ... | ... | ... |

---

## 🎯 Timeline für Week 1 (JETZT bis 24.11)

### **Tag 1-2 (Heute + Morgen): Deployment Setup**
- [x] Build funktioniert ✅
- [ ] package.json finalisieren
- [ ] README.md erstellen
- [ ] CHANGELOG.md erstellen
- [ ] .npmignore erstellen
- [ ] npm publish --tag beta

### **Tag 3: Tester-Rekrutierung** (20.11)
- [ ] LinkedIn Post mit Install-Anleitung
- [ ] GitHub Issues Template erstellen
- [ ] Discord Channel setup
- [ ] First 5 Testers onboarden

### **Tag 4-7: Pre-Testing** (21-24.11)
- [ ] Tägliche Updates basierend auf Feedback
- [ ] Known Issues dokumentieren
- [ ] Quick Fixes deployen
- [ ] 15 Tester-Commitment bis 24.11

---

## 🚨 Emergency Rollback

Falls kritischer Bug:
```bash
# NPM: Previous version installieren
npm install n8n-nodes-sap-odata@0.1.0-beta.1

# Git: Revert
git revert HEAD
git push
npm version patch
npm publish --tag beta
```

---

## 📞 Support-Kanäle für Tester

**GitHub Issues Template** (.github/ISSUE_TEMPLATE/bug_report.md):
```markdown
---
name: Bug Report (Beta Tester)
about: Report an issue during 3-week challenge
---

**SAP Environment:**
- SAP System: [ECC/S4HANA/Gateway]
- OData Version: [V2/V4]
- n8n Version: [1.x.x]

**Node Version:**
\`n8n-nodes-sap-odata@0.1.0-beta.x\`

**What happened:**
[Beschreibung]

**Expected:**
[Was erwartet wurde]

**Steps to Reproduce:**
1. ...
2. ...

**Screenshots/Logs:**
[Falls vorhanden]
```

---

## 🎉 Launch Checklist

**Vor erstem npm publish:**
- [ ] `npm run build` erfolgreich
- [ ] `npm run lint` ohne Fehler
- [ ] `npm run test` > 45% coverage
- [ ] package.json vollständig
- [ ] README.md vorhanden
- [ ] CHANGELOG.md vorhanden
- [ ] .npmignore korrekt
- [ ] GitHub Repo public
- [ ] License file vorhanden

**Nach publish:**
- [ ] Installation testen: `npm install n8n-nodes-sap-odata@beta`
- [ ] n8n Node sichtbar
- [ ] Credentials funktionieren
- [ ] Beispiel-Workflow läuft

---

## 💡 Pro-Tips für schnelle Iteration

1. **Pre-commit Hook für Build:**
```bash
# .git/hooks/pre-commit
#!/bin/bash
npm run build || exit 1
```

2. **Auto-Deployment Script:**
```bash
#!/bin/bash
# deploy.sh
npm run build && \
npm run lint && \
npm version prerelease --preid=beta && \
npm publish --tag beta && \
git push && \
echo "✅ Deployed $(npm pkg get version)"
```

3. **Tester-Broadcast:**
```bash
# announce-update.sh
VERSION=$(npm pkg get version)
echo "🚀 New Beta: $VERSION

Changes:
- [List fixes/features]

Update:
\`npm update n8n-nodes-sap-odata@beta\`

Known Issues:
- [List]
" | pbcopy  # Kopiert in Clipboard für Discord/LinkedIn
```

---

**Ready to deploy?** Führe aus:
```bash
npm version 0.1.0-beta.1 --no-git-tag-version
npm publish --tag beta --access public
```

🎯 **Zeitinvestition**: 30 Min Setup → Dann 5 Min pro Update!
