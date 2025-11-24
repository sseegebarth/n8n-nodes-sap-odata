# SAP n8n Nodes - Test Guide

## 📋 Inhalt
1. [Installation & Deployment](#installation--deployment)
2. [Webhook Testing](#webhook-testing)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)

---

## Installation & Deployment

### 1. Build und Deploy der Nodes

```bash
# Build das Projekt
npm run build

# Deploy zu lokaler n8n Installation
./scripts/deploy-local.sh

# Oder manuell:
npm run build
cp -r nodes credentials dist ~/.n8n/custom/
```

### 2. n8n starten

```bash
# Mit dem Start-Skript
./start-n8n.sh

# Oder manuell
N8N_SECURE_COOKIE=false npx n8n start

# Im Hintergrund
N8N_SECURE_COOKIE=false npx n8n start &
```

### 3. Überprüfen ob Nodes geladen wurden

1. Öffne n8n im Browser: http://localhost:5678
2. Erstelle einen neuen Workflow
3. Suche nach "SAP" in der Node-Palette
4. Du solltest sehen:
   - SAP Connect IDoc Webhook
   - SAP Connect OData Webhook
   - SAP Connect IDoc
   - SAP Connect RFC
   - SAP Connect OData

---

## Webhook Testing

### Test-Workflow erstellen

1. Füge "SAP Connect IDoc Webhook" Node hinzu
2. Konfiguriere die Authentication-Methode
3. Aktiviere den Workflow
4. Kopiere die Webhook-URL (wird in der Node angezeigt)

### 1. Test ohne Authentifizierung

```bash
# Webhook URL von n8n (Beispiel)
WEBHOOK_URL="http://localhost:5678/webhook/abc123"

# Sende Test IDoc
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40>
    <TABNAM>EDI_DC40</TABNAM>
    <DOCNUM>0000000001</DOCNUM>
    <IDOCTYP>DEBMAS07</IDOCTYP>
    <MESTYP>DEBMAS</MESTYP>
    <SNDPRN>SAP_TEST</SNDPRN>
  </EDI_DC40>
  <E1KNA1M>
    <KUNNR>0000012345</KUNNR>
    <NAME1>Test Customer GmbH</NAME1>
    <STRAS>Teststraße 123</STRAS>
    <PSTLZ>12345</PSTLZ>
    <ORT01>Teststadt</ORT01>
    <LAND1>DE</LAND1>
  </E1KNA1M>
</IDOC>'
```

### 2. Test mit HMAC Authentication

#### Credentials konfigurieren
1. Gehe zu Credentials in n8n
2. Erstelle neue "SAP IDoc Webhook API" Credentials
3. Wähle `authType`: "HMAC Authentication"
4. Setze `secret`: "your-shared-secret-key-123456789"
5. Wähle `algorithm`: "SHA-256"

#### Test mit HMAC Signature

```bash
WEBHOOK_URL="http://localhost:5678/webhook/abc123"
SECRET="your-shared-secret-key-123456789"

# IDoc Payload
PAYLOAD='<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40>
    <DOCNUM>0000000001</DOCNUM>
    <IDOCTYP>DEBMAS07</IDOCTYP>
  </EDI_DC40>
</IDOC>'

# HMAC-SHA256 Signature generieren
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

# Request mit Signature Header
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/xml" \
  -H "X-SAP-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### 3. Test mit Basic Authentication (Legacy)

#### Credentials konfigurieren
1. Gehe zu Credentials in n8n
2. Erstelle neue "SAP IDoc Webhook API" Credentials
3. Wähle `authType`: "Basic Authentication"
4. Setze `username`: "sapuser"
5. Setze `password`: "sappass123"

#### Test mit Basic Auth

```bash
WEBHOOK_URL="https://localhost:5678/webhook/abc123"  # HTTPS erforderlich!
USERNAME="sapuser"
PASSWORD="sappass123"

# Basic Auth Header erstellen
AUTH=$(echo -n "$USERNAME:$PASSWORD" | base64)

# Request mit Authorization Header
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/xml" \
  -H "Authorization: Basic $AUTH" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40>
    <DOCNUM>0000000002</DOCNUM>
    <IDOCTYP>MATMAS05</IDOCTYP>
  </EDI_DC40>
</IDOC>'
```

**⚠️ Hinweis:** Basic Auth erfordert HTTPS! Für lokale Tests:
```bash
# n8n mit HTTPS starten (self-signed certificate)
N8N_PROTOCOL=https N8N_SSL_KEY=server.key N8N_SSL_CERT=server.cert n8n start
```

---

## Unit Tests

### Tests ausführen

```bash
# Alle Tests
npm test

# Mit Coverage
npm run test:coverage

# Watch Mode (für Entwicklung)
npm run test:watch
```

### Beispiel Unit Test für Webhook Utils

```typescript
// test/utils/WebhookUtils.test.ts
import { verifyHmacSignature, isIpAllowed } from '../../nodes/Shared/utils/WebhookUtils';

describe('WebhookUtils', () => {
  describe('verifyHmacSignature', () => {
    it('should verify valid HMAC-SHA256 signature', () => {
      const payload = 'test payload';
      const secret = 'secret123';
      const signature = 'kHR0HBYub+jmHfLTq8L8CjHYTuJ7UQKvgLXyjfqp0qg=';

      expect(verifyHmacSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = 'test payload';
      const secret = 'secret123';
      const signature = 'invalid_signature';

      expect(verifyHmacSignature(payload, signature, secret)).toBe(false);
    });
  });

  describe('isIpAllowed', () => {
    it('should allow IP in CIDR range', () => {
      const whitelist = ['192.168.1.0/24'];

      expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
      expect(isIpAllowed('192.168.2.100', whitelist)).toBe(false);
    });
  });
});
```

---

## Integration Tests

### 1. End-to-End Workflow Test

```bash
# test/integration/webhook-flow.test.js
#!/usr/bin/env node

const axios = require('axios');
const { exec } = require('child_process');

// Start n8n in test mode
console.log('Starting n8n...');
exec('N8N_SECURE_COOKIE=false npx n8n start', (error) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
});

// Wait for n8n to start
setTimeout(async () => {
  try {
    // Test webhook
    const response = await axios.post('http://localhost:5678/webhook/test', {
      data: 'test'
    });

    console.log('✅ Webhook test successful:', response.status);
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }

  // Stop n8n
  exec('pkill -f n8n');
}, 5000);
```

### 2. Postman Collection

Erstelle eine Postman Collection mit Tests:

```json
{
  "info": {
    "name": "SAP n8n Webhook Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Test HMAC Authentication",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/xml"
          },
          {
            "key": "X-SAP-Signature",
            "value": "{{hmac_signature}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "<?xml version=\"1.0\"?><IDOC><EDI_DC40><DOCNUM>001</DOCNUM></EDI_DC40></IDOC>"
        },
        "url": "{{webhook_url}}"
      },
      "event": [
        {
          "listen": "prerequest",
          "script": {
            "exec": [
              "// Calculate HMAC signature",
              "const crypto = require('crypto');",
              "const secret = pm.environment.get('secret');",
              "const body = pm.request.body.raw;",
              "const signature = crypto.createHmac('sha256', secret)",
              "  .update(body)",
              "  .digest('base64');",
              "pm.environment.set('hmac_signature', signature);"
            ]
          }
        }
      ]
    }
  ]
}
```

---

## Performance Testing

### Load Test mit Apache Bench

```bash
# Test mit 100 Requests, 10 concurrent
ab -n 100 -c 10 \
   -p test-payload.xml \
   -T "application/xml" \
   -H "X-SAP-Signature: test123" \
   http://localhost:5678/webhook/abc123/
```

### Stress Test mit curl

```bash
# Parallele Requests
for i in {1..50}; do
  curl -X POST http://localhost:5678/webhook/test \
    -H "Content-Type: application/xml" \
    -d "<IDOC><DOCNUM>$i</DOCNUM></IDOC>" &
done
wait
```

---

## Debug Tips

### 1. n8n Logs anzeigen

```bash
# Live Logs
tail -f /tmp/n8n.log

# Oder mit mehr Details
N8N_LOG_LEVEL=debug n8n start
```

### 2. Node Development Mode

```bash
# Development Mode mit Hot-Reload
npx n8n-node-dev build --watch
```

### 3. TypeScript Fehler überprüfen

```bash
# Type checking
npx tsc --noEmit

# Mit Watch Mode
npx tsc --noEmit --watch
```

### 4. Webhook Request Details loggen

In der Webhook Node:
```typescript
console.log('Headers:', this.getHeaderData());
console.log('Body:', this.getBodyData());
console.log('Query:', this.getQueryData());
```

---

## Troubleshooting

### Problem: Nodes werden nicht in n8n angezeigt

```bash
# Check ob Nodes korrekt kopiert wurden
ls -la ~/.n8n/custom/nodes/

# n8n Cache löschen und neu starten
rm -rf ~/.n8n/.cache
n8n start
```

### Problem: HMAC Signature stimmt nicht überein

```bash
# Test Signature Generation
echo -n "test payload" | openssl dgst -sha256 -hmac "secret" -binary | base64
# Erwartetes Ergebnis: Wh3kjPNNpXlrqGh3jAGvnTB3DkAQvocK7xr4LW+PrX4=
```

### Problem: Basic Auth schlägt fehl

- Stelle sicher, dass HTTPS verwendet wird
- Überprüfe Base64 Encoding:
```bash
echo -n "user:pass" | base64
# Ergebnis sollte mit Authorization Header übereinstimmen
```

---

## Nützliche Befehle

```bash
# n8n Status
ps aux | grep n8n

# Port überprüfen
lsof -i :5678

# Alle n8n Prozesse beenden
pkill -f n8n

# Logs in Echtzeit
tail -f ~/.n8n/.logs/main.log

# Build und Deploy in einem Schritt
npm run build && ./scripts/deploy-local.sh && ./start-n8n.sh
```