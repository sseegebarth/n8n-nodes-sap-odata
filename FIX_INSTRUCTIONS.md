# 🔧 Fix für Icon 404 Fehler

## Problem
```
Failed to load resource: the server responded with a status of 404 (Not Found) (sap.svg, line 0)
```

## Ursache
n8n sucht die Icon-Dateien an spezifischen Orten neben den Node-JavaScript-Dateien. Die Icons müssen in jedem Node-Verzeichnis vorhanden sein.

## Lösung

### 1. Sofort-Fix (einmalig)

```bash
# Icons reparieren
./scripts/fix-icons.sh

# n8n neu starten
pkill -f n8n
./start-n8n.sh

# Browser Cache löschen
# Safari: Cmd + Option + E, dann Cmd + R
# Chrome: Cmd + Shift + R
```

### 2. Permanente Lösung (automatisch bei Build)

Das Build-System wurde bereits angepasst:

```bash
# Build mit automatischem Icon-Fix
npm run build

# Deploy mit Icon-Fix
./scripts/deploy-local.sh
```

## Was wurde geändert?

1. **Neues Script:** `scripts/fix-icons.sh`
   - Kopiert sap.svg an alle benötigten Stellen
   - Sowohl in dist/ als auch ~/.n8n/custom/

2. **package.json erweitert:**
   ```json
   "build": "tsc && npm run copy-icons && npm run fix-icons"
   ```

3. **Deploy-Script verbessert:**
   - Ruft automatisch fix-icons.sh auf

## Icon-Locations

Die sap.svg wird jetzt an folgende Orte kopiert:

```
dist/
├── nodes/
│   ├── Sap/sap.svg
│   ├── SapIdoc/sap.svg
│   ├── SapIdocWebhook/sap.svg
│   ├── SapRfc/sap.svg
│   └── SapWebhook/sap.svg
└── sap.svg

~/.n8n/custom/
├── nodes/
│   ├── Sap/sap.svg
│   ├── SapIdoc/sap.svg
│   ├── SapIdocWebhook/sap.svg
│   ├── SapRfc/sap.svg
│   └── SapWebhook/sap.svg
└── sap.svg
```

## Troubleshooting

### Icons werden immer noch nicht angezeigt?

1. **Browser Cache komplett löschen:**
   ```bash
   # Safari Developer Tools aktivieren
   Safari → Preferences → Advanced → Show Develop menu

   # Cache löschen
   Develop → Empty Caches (Cmd + Option + E)
   ```

2. **n8n Cache löschen:**
   ```bash
   rm -rf ~/.n8n/.cache
   pkill -f n8n
   n8n start
   ```

3. **Verifizieren ob Icons kopiert wurden:**
   ```bash
   ls -la ~/.n8n/custom/nodes/*/sap.svg
   ```

### Andere Fehler im Log?

- `ResponseError: Plan lacks license` - Das ist ein n8n Cloud Feature, kann ignoriert werden
- `polyfills-CIP2n-lm.js 404` - Browser Cache Problem, siehe oben

## Prävention

Bei zukünftigen Updates immer:

```bash
# Kompletter Build & Deploy Workflow
npm run build
./scripts/deploy-local.sh
pkill -f n8n
./start-n8n.sh
```

## ✅ Problem gelöst!

Nach diesen Schritten sollten alle SAP Node Icons korrekt angezeigt werden. 🎨