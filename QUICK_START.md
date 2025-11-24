# 🚀 Quick Start - SAP n8n Nodes testen

## 1️⃣ Build & Deploy (30 Sekunden)

```bash
# Einmal ausführen um die Nodes zu installieren
npm install
npm run build
./scripts/deploy-local.sh
```

## 2️⃣ n8n starten

```bash
# n8n mit den SAP Nodes starten
./start-n8n.sh

# Oder manuell:
N8N_SECURE_COOKIE=false npx n8n start
```

Browser öffnet sich automatisch: http://localhost:5678

## 3️⃣ Webhook testen

### A) Workflow erstellen

1. Neuer Workflow in n8n
2. Node hinzufügen: **"SAP Connect IDoc Webhook"**
3. Authentication wählen:
   - **None** - Zum schnellen Testen
   - **HMAC Signature** - Empfohlen für Produktion
   - **Basic Auth (Legacy)** - Nur mit HTTPS

4. Workflow aktivieren ✅
5. Webhook-URL kopieren (wird in der Node angezeigt)

### B) Test ohne Auth (Quick Test)

```bash
# Webhook URL aus n8n kopieren, z.B.:
WEBHOOK_URL="http://localhost:5678/webhook-test/abc123"

# Test IDoc senden
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
<IDOC>
  <EDI_DC40>
    <DOCNUM>TEST001</DOCNUM>
    <IDOCTYP>DEBMAS07</IDOCTYP>
  </EDI_DC40>
  <E1KNA1M>
    <KUNNR>0001</KUNNR>
    <NAME1>Test GmbH</NAME1>
  </E1KNA1M>
</IDOC>'
```

### C) Test mit HMAC (Sicher)

1. **Credentials in n8n erstellen:**
   - Settings → Credentials → New
   - Type: "SAP IDoc Webhook API"
   - Auth Type: "HMAC Authentication"
   - Secret: `test-secret-123`
   - Algorithm: SHA-256

2. **Test mit Signature:**

```bash
SECRET="test-secret-123"
PAYLOAD='<IDOC><EDI_DC40><DOCNUM>001</DOCNUM></EDI_DC40></IDOC>'

# Signature generieren
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

# Request senden
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/xml" \
  -H "X-SAP-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### D) Automatisierter Test

```bash
# Alle Auth-Methoden testen
./scripts/test-webhooks.sh
```

## 4️⃣ TypeScript & Tests

```bash
# TypeScript überprüfen
npx tsc --noEmit

# Unit Tests ausführen
npm test

# Mit Coverage
npm run test:coverage
```

## 5️⃣ Troubleshooting

### Nodes erscheinen nicht in n8n?

```bash
# Cache löschen und neu starten
rm -rf ~/.n8n/.cache
./start-n8n.sh
```

### Webhook antwortet nicht?

1. Workflow aktiviert? ✅
2. URL korrekt kopiert?
3. n8n läuft? `ps aux | grep n8n`

### HMAC Signature falsch?

```bash
# Test-Signature generieren:
echo -n "test" | openssl dgst -sha256 -hmac "secret" -binary | base64
# Erwartetes Ergebnis: Wgxh+Gq0MbNnDkN0ZId7vOOdgLvLxD1tnKZjUqRlnXY=
```

## 📚 Weitere Infos

- [TEST_GUIDE.md](TEST_GUIDE.md) - Ausführliche Testanleitung
- [scripts/test-webhooks.sh](scripts/test-webhooks.sh) - Automatisierte Tests
- [test/utils/WebhookUtils.test.ts](test/utils/WebhookUtils.test.ts) - Unit Test Beispiele

## ⚡ Befehle Cheat Sheet

```bash
# Build & Deploy
npm run build && ./scripts/deploy-local.sh

# n8n starten
./start-n8n.sh

# Logs anzeigen
tail -f /tmp/n8n.log

# n8n stoppen
pkill -f n8n

# Alles in einem
npm run build && ./scripts/deploy-local.sh && ./start-n8n.sh
```