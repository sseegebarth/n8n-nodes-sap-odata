#!/bin/bash

# Test Script für SAP n8n Webhook Nodes
# Testet verschiedene Authentifizierungsmethoden

set -e

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Konfiguration
BASE_URL="${N8N_URL:-http://localhost:5678}"
WEBHOOK_PATH="/webhook-test"  # Wird vom Benutzer angepasst

echo "================================================"
echo -e "${BLUE}SAP n8n Webhook Test Suite${NC}"
echo "================================================"
echo ""

# Funktion für Test-Output
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# 1. Test ohne Authentifizierung
echo -e "${YELLOW}Test 1: Ohne Authentifizierung${NC}"
echo "--------------------------------"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -d '<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40>
    <DOCNUM>0000000001</DOCNUM>
    <IDOCTYP>DEBMAS07</IDOCTYP>
    <MESTYP>DEBMAS</MESTYP>
  </EDI_DC40>
  <E1KNA1M>
    <KUNNR>TEST001</KUNNR>
    <NAME1>Test Customer</NAME1>
  </E1KNA1M>
</IDOC>' 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
    test_result 0 "Request ohne Auth erfolgreich (HTTP $RESPONSE)"
else
    test_result 1 "Request ohne Auth fehlgeschlagen (HTTP $RESPONSE)"
fi
echo ""

# 2. Test mit HMAC-SHA256
echo -e "${YELLOW}Test 2: HMAC-SHA256 Authentication${NC}"
echo "-----------------------------------"

SECRET="test-secret-key-123456789"
PAYLOAD='<?xml version="1.0" encoding="UTF-8"?>
<IDOC BEGIN="1">
  <EDI_DC40>
    <DOCNUM>0000000002</DOCNUM>
    <IDOCTYP>DEBMAS07</IDOCTYP>
  </EDI_DC40>
</IDOC>'

# Generate HMAC signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

echo "Secret: $SECRET"
echo "Signature: $SIGNATURE"
echo ""

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -H "X-SAP-Signature: $SIGNATURE" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
    test_result 0 "HMAC-SHA256 Auth erfolgreich (HTTP $RESPONSE)"
else
    test_result 1 "HMAC-SHA256 Auth fehlgeschlagen (HTTP $RESPONSE)"
fi
echo ""

# 3. Test mit HMAC-SHA512
echo -e "${YELLOW}Test 3: HMAC-SHA512 Authentication${NC}"
echo "-----------------------------------"

# Generate HMAC-SHA512 signature
SIGNATURE_512=$(echo -n "$PAYLOAD" | openssl dgst -sha512 -hmac "$SECRET" -binary | base64)

echo "Signature (SHA-512): $SIGNATURE_512"
echo ""

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -H "X-SAP-Signature: $SIGNATURE_512" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ]; then
    test_result 0 "HMAC-SHA512 Auth erfolgreich (HTTP $RESPONSE)"
else
    test_result 1 "HMAC-SHA512 Auth fehlgeschlagen (HTTP $RESPONSE)"
fi
echo ""

# 4. Test mit Basic Auth (nur über HTTPS)
echo -e "${YELLOW}Test 4: Basic Authentication${NC}"
echo "-----------------------------"

USERNAME="testuser"
PASSWORD="testpass123"
AUTH=$(echo -n "$USERNAME:$PASSWORD" | base64)

echo "Username: $USERNAME"
echo "Auth Header: Basic $AUTH"
echo ""

# Test über HTTP (sollte fehlschlagen)
echo "Test über HTTP (sollte fehlschlagen):"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -H "Authorization: Basic $AUTH" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")

if [ "$RESPONSE" != "200" ]; then
    test_result 0 "HTTP mit Basic Auth korrekt abgelehnt (HTTP $RESPONSE)"
else
    test_result 1 "HTTP mit Basic Auth fälschlicherweise akzeptiert!"
fi

# Test über HTTPS (sollte funktionieren, wenn HTTPS verfügbar)
if [[ "$BASE_URL" == https://* ]]; then
    echo "Test über HTTPS:"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "${BASE_URL}${WEBHOOK_PATH}" \
        -H "Content-Type: application/xml" \
        -H "Authorization: Basic $AUTH" \
        -d "$PAYLOAD" 2>/dev/null || echo "000")

    if [ "$RESPONSE" = "200" ]; then
        test_result 0 "HTTPS mit Basic Auth erfolgreich (HTTP $RESPONSE)"
    else
        test_result 1 "HTTPS mit Basic Auth fehlgeschlagen (HTTP $RESPONSE)"
    fi
else
    echo -e "${YELLOW}⚠️  HTTPS nicht konfiguriert - überspringe HTTPS Test${NC}"
fi
echo ""

# 5. Test mit ungültiger Signature
echo -e "${YELLOW}Test 5: Ungültige HMAC Signature${NC}"
echo "---------------------------------"

INVALID_SIGNATURE="invalid_signature_123"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -H "X-SAP-Signature: $INVALID_SIGNATURE" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
    test_result 0 "Ungültige Signature korrekt abgelehnt (HTTP $RESPONSE)"
else
    test_result 1 "Ungültige Signature nicht korrekt behandelt (HTTP $RESPONSE)"
fi
echo ""

# 6. Test mit verschiedenen IDoc-Typen
echo -e "${YELLOW}Test 6: Verschiedene IDoc-Typen${NC}"
echo "--------------------------------"

# DEBMAS (Customer Master)
echo "Testing DEBMAS..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -d '<?xml version="1.0"?>
<IDOC>
  <EDI_DC40>
    <IDOCTYP>DEBMAS07</IDOCTYP>
    <MESTYP>DEBMAS</MESTYP>
  </EDI_DC40>
</IDOC>' 2>/dev/null || echo "000")
test_result $([ "$RESPONSE" = "200" ] && echo 0 || echo 1) "DEBMAS IDoc (HTTP $RESPONSE)"

# MATMAS (Material Master)
echo "Testing MATMAS..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "${BASE_URL}${WEBHOOK_PATH}" \
    -H "Content-Type: application/xml" \
    -d '<?xml version="1.0"?>
<IDOC>
  <EDI_DC40>
    <IDOCTYP>MATMAS05</IDOCTYP>
    <MESTYP>MATMAS</MESTYP>
  </EDI_DC40>
</IDOC>' 2>/dev/null || echo "000")
test_result $([ "$RESPONSE" = "200" ] && echo 0 || echo 1) "MATMAS IDoc (HTTP $RESPONSE)"

echo ""
echo "================================================"
echo -e "${GREEN}Test Suite abgeschlossen!${NC}"
echo "================================================"
echo ""
echo -e "${YELLOW}Hinweise:${NC}"
echo "1. Stelle sicher, dass n8n läuft: ${BASE_URL}"
echo "2. Konfiguriere den Webhook-Pfad in diesem Skript"
echo "3. Konfiguriere die Credentials in n8n entsprechend"
echo "4. Für HTTPS Tests: N8N_PROTOCOL=https n8n start"
echo ""