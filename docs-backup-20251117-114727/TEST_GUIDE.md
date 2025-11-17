# SAP OData Node - Test Guide

**Version**: 1.4.0 (Post-Session 3)
**Date**: 2025-10-28

Dieser Guide zeigt dir, wie du die neuen Verbesserungen aus Session 3 testen kannst.

---

## Voraussetzungen

1. **SAP-System Zugang**
   - SAP Gateway verfügbar
   - OData-Service aktiviert (z.B. `/sap/opu/odata/sap/API_SALES_ORDER_SRV`)
   - Benutzer mit entsprechenden Berechtigungen

2. **n8n Installation**
   - n8n lokal installiert (empfohlen: >= 1.0.0)
   - Node.js >= 18.x
   - npm >= 9.x

---

## Installation & Setup

### Option 1: Development Setup (Empfohlen für Tests)

```bash
# 1. Repository bauen
cd /Users/sseegebarth/Documents/Projekte/n8n_sap_community
npm run build

# 2. In n8n custom nodes verlinken
mkdir -p ~/.n8n/custom
ln -sf $(pwd) ~/.n8n/custom/n8n-nodes-sap-odata

# 3. n8n starten
n8n start
```

### Option 2: npm Package Installation

```bash
# Node als Package installieren
cd /Users/sseegebarth/Documents/Projekte/n8n_sap_community
npm pack

# In n8n installieren
cd ~/.n8n
npm install /Users/sseegebarth/Documents/Projekte/n8n_sap_community/n8n-nodes-sap-odata-1.4.0.tgz

# n8n neu starten
n8n start
```

### Option 3: Docker Setup

```bash
# docker-compose.yml erstellen (siehe unten)
docker-compose up -d

# n8n öffnen
open http://localhost:5678
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=admin
    volumes:
      # Gemountetes dist-Verzeichnis
      - ./dist:/home/node/.n8n/custom/n8n-nodes-sap-odata
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

---

## Test 1: Cache Key Normalization

**Was wird getestet**: Service Paths mit/ohne trailing slash nutzen denselben Cache

### n8n Workflow

1. **Node 1: SAP OData (Service mit trailing slash)**
   ```
   Credentials: Deine SAP Credentials
   Service Path Mode: Custom
   Service Path: /sap/opu/odata/sap/API_SALES_ORDER_SRV/  ← Mit Slash!
   Resource: Entity
   Operation: Get All
   Entity Set: SalesOrderSet
   Options > Return All: true
   Options > Max Items: 5
   ```

2. **Node 2: SAP OData (Service ohne trailing slash)**
   ```
   Credentials: Dieselben SAP Credentials
   Service Path Mode: Custom
   Service Path: /sap/opu/odata/sap/API_SALES_ORDER_SRV   ← Ohne Slash!
   Resource: Entity
   Operation: Get All
   Entity Set: SalesOrderSet
   Options > Return All: true
   Options > Max Items: 5
   ```

### Erwartetes Ergebnis

- ✅ Beide Nodes nutzen denselben Cache
- ✅ Zweiter Request ist deutlich schneller (kein $metadata-Fetch)
- ✅ Keine redundanten SAP Gateway Calls

### Validierung

```javascript
// Code-Node nach beiden SAP OData Nodes
const startTime1 = new Date($node["SAP OData 1"].json.executionTime).getTime();
const startTime2 = new Date($node["SAP OData 2"].json.executionTime).getTime();

// Cache Hit: Node 2 sollte < 50ms brauchen
if (startTime2 < 50) {
  return {
    json: {
      status: "✅ Cache Working",
      node1Time: startTime1 + "ms",
      node2Time: startTime2 + "ms",
      cacheHit: true
    }
  };
}
```

---

## Test 2: Query String URL Encoding

**Was wird getestet**: Sonderzeichen in Function Import Parametern werden korrekt encodiert

### n8n Workflow

**Node: SAP OData - Function Import**
```
Credentials: Deine SAP Credentials
Service Path: /sap/opu/odata/sap/YOUR_SERVICE
Resource: Function Import
Operation: Function Import
Function Name Mode: Custom
Function Name: GetCustomerData
HTTP Method: GET
URL Format: Query String
Parameters: {"CustomerName":"Müller & Co.","City":"München"}
```

### Erwartetes Ergebnis

- ✅ Request erfolgreich (Status 200)
- ✅ Keine SAP Gateway Fehler wegen Sonderzeichen
- ✅ Parameter korrekt übertragen:
  - `Müller` → `M%C3%BCller`
  - `& Co.` → `%26%20Co.`
  - `München` → `M%C3%BCnchen`

### Test mit verschiedenen Sonderzeichen

```json
{
  "param1": "Test & Test",
  "param2": "Value=100%",
  "param3": "Zürich",
  "param4": "Name+Value",
  "param5": "Test/Path"
}
```

**Alle sollten funktionieren ohne SAP-Fehler!**

---

## Test 3: Service Path DRY (Code Duplication Fix)

**Was wird getestet**: Load Options verwenden zentrale `resolveServicePath` Funktion

### n8n Workflow - Teil 1: Auto-Discover Mode

1. **Node: SAP OData**
   ```
   Credentials: Deine SAP Credentials
   Service Path Mode: Auto-Discover
   Discovered Service: [Wähle einen Service aus Dropdown]
   Resource: Entity
   Operation: Get All
   Entity Set Mode: From List
   Entity Set: [Wähle aus Dropdown]
   ```

### Erwartetes Ergebnis

- ✅ Service-Dropdown zeigt verfügbare Services
- ✅ Entity Set-Dropdown zeigt korrekte Entity Sets für gewählten Service
- ✅ Keine "Service not found" Fehler

### n8n Workflow - Teil 2: Custom Mode

2. **Node: SAP OData**
   ```
   Service Path Mode: Custom
   Service Path: /sap/opu/odata/sap/API_SALES_ORDER_SRV
   Resource: Entity
   Operation: Get All
   Entity Set Mode: From List
   Entity Set: [Wähle aus Dropdown]
   ```

### Erwartetes Ergebnis

- ✅ Entity Set-Dropdown funktioniert auch in Custom Mode
- ✅ Metadata wird korrekt für eingegebenen Service Path geladen

---

## Test 4: Multi-Item Execution (Session 2 Fix)

**Was wird getestet**: Credential Isolation bei Multi-Item Workflows

### n8n Workflow

1. **Node 1: Code (Erstelle Test-Items)**
   ```javascript
   return [
     {
       json: {
         servicePath: "/sap/opu/odata/sap/API_SALES_ORDER_SRV",
         entitySet: "SalesOrderSet",
         filter: "SalesOrder eq '1'"
       }
     },
     {
       json: {
         servicePath: "/sap/opu/odata/sap/API_BUSINESS_PARTNER",
         entitySet: "A_BusinessPartner",
         filter: "BusinessPartner eq '1000'"
       }
     }
   ];
   ```

2. **Node 2: SAP OData (Mit Expression Mode)**
   ```
   Credentials: {{ $json.credentials }} (oder fixe Credentials)
   Service Path Mode: Custom
   Service Path: {{ $json.servicePath }}
   Resource: Entity
   Operation: Get All
   Entity Set Mode: Custom
   Entity Set: {{ $json.entitySet }}
   Options > Filters > Add Filter:
     - Filter: {{ $json.filter }}
   Options > Max Items: 1
   ```

### Erwartetes Ergebnis

- ✅ Jedes Item wird mit eigenem Service Path verarbeitet
- ✅ Keine Cache-Vermischung zwischen Items
- ✅ Korrekte Daten für jeden Request

---

## Test 5: EDM Type Literals (Session 2 Fix)

**Was wird getestet**: OData EDM Type Prefixes für SAP Gateway Compliance

### Test-Cases für verschiedene Datentypen

**Node: SAP OData - Update Entity**
```
Service Path: /sap/opu/odata/sap/YOUR_SERVICE
Resource: Entity
Operation: Update
Entity Set: YOUR_ENTITY
Entity Key: 'TEST001'
Data to Update: siehe unten
```

#### Test Case 1: DateTime
```json
{
  "CreatedAt": "2025-10-28T10:00:00Z"
}
```
**Erwartetes URL-Format**: `datetime'2025-10-28T10:00:00Z'`

#### Test Case 2: DateTimeOffset
```json
{
  "ModifiedAt": "2025-10-28T10:00:00+01:00"
}
```
**Erwartetes URL-Format**: `datetimeoffset'2025-10-28T10:00:00+01:00'`

#### Test Case 3: Time
```json
{
  "WorkStartTime": "08:30:00"
}
```
**Erwartetes URL-Format**: `time'08:30:00'`

#### Test Case 4: GUID
```json
{
  "ID": "005056A0-1234-5678-9ABC-DEF012345678"
}
```
**Erwartetes URL-Format**: `guid'005056A0-1234-5678-9ABC-DEF012345678'`

#### Test Case 5: Decimal
```json
{
  "Amount": 123456.78
}
```
**Erwartetes URL-Format**: `123456.78M`

### Erwartetes Ergebnis für alle Cases

- ✅ Keine SAP Gateway Fehler
- ✅ Korrekte OData-Literal-Syntax
- ✅ Update erfolgreich durchgeführt

---

## Test 6: GUID Detection Order

**Was wird getestet**: GUID-Pattern wird VOR numerischer Prüfung erkannt

### Test-Cases

**Node: SAP OData - Get Entity**

#### Case 1: GUID mit führenden Nullen (SAP-typisch)
```
Entity Set: BusinessPartnerSet
Entity Key: 005056A0-1234-5678-9ABC-DEF012345678
```
**Erwartetes Format**: `guid'005056A0-1234-5678-9ABC-DEF012345678'`
**Nicht**: `'005056A0-1234-5678-9ABC-DEF012345678'` (als String)

#### Case 2: Standard GUID
```
Entity Key: A0B1C2D3-E4F5-6789-ABCD-EF0123456789
```
**Erwartetes Format**: `guid'A0B1C2D3-E4F5-6789-ABCD-EF0123456789'`

#### Case 3: Numerischer Key (Regression Test)
```
Entity Key: 123456
```
**Erwartetes Format**: `123456` (ohne Quotes)

---

## Integration Test - Komplettes Szenario

### Workflow: "SAP Sales Order Processing"

Dieser Workflow testet alle neuen Features zusammen:

1. **Start Node**: Manual Trigger

2. **SAP OData 1**: Auto-Discover Service List
   ```
   Service Path Mode: Auto-Discover
   → Dropdown sollte Services zeigen
   ```

3. **SAP OData 2**: Get All Sales Orders (mit Cache)
   ```
   Service Path Mode: Discover
   Service: API_SALES_ORDER_SRV/  ← Mit Slash
   Entity Set: SalesOrderSet
   Return All: false
   Max Items: 10
   ```

4. **Code Node**: Transform Data
   ```javascript
   return $items.map(item => ({
     json: {
       orderId: item.json.SalesOrder,
       // GUID aus SAP
       guid: item.json.SalesOrderUUID,
       customer: item.json.SoldToParty,
       // Sonderzeichen für Function Import Test
       searchText: `Order & Customer ${item.json.SoldToParty}`
     }
   }));
   ```

5. **SAP OData 3**: Get Order Details (Cache Hit Test)
   ```
   Service Path Mode: Custom
   Service Path: /sap/opu/odata/sap/API_SALES_ORDER_SRV  ← Ohne Slash!
   Entity Set: SalesOrderSet
   Entity Key: {{ $json.orderId }}
   → Sollte Cache nutzen von Node 2
   ```

6. **SAP OData 4**: Function Import (URL Encoding Test)
   ```
   Service Path: /sap/opu/odata/sap/API_SALES_ORDER_SRV
   Function: SearchOrders
   HTTP Method: GET
   URL Format: Query String
   Parameters: {"SearchText":"{{ $json.searchText }}"}
   → Sonderzeichen sollten encodiert werden
   ```

### Erwartetes End-Ergebnis

- ✅ Alle Nodes erfolgreich
- ✅ Node 3 nutzt Cache von Node 2 (schnell)
- ✅ Node 4 encodiert Sonderzeichen korrekt
- ✅ Keine SAP Gateway Errors
- ✅ Korrekte Daten zurück

---

## Performance Tests

### Test: Cache Hit Rate Improvement

**Setup**: Erstelle Workflow mit 3 identischen SAP OData Requests

```
Node 1: Get Metadata (Service Path mit /)
Node 2: Get Metadata (Service Path ohne /)
Node 3: Get Metadata (Service Path mit /)
```

**Messung**:
```javascript
// Code Node nach allen 3 Nodes
const times = [
  $node["SAP OData 1"].json.executionTime,
  $node["SAP OData 2"].json.executionTime,
  $node["SAP OData 3"].json.executionTime
];

return {
  json: {
    node1: times[0] + "ms (erster Request, kein Cache)",
    node2: times[1] + "ms (sollte Cache Hit sein)",
    node3: times[2] + "ms (sollte Cache Hit sein)",
    cacheHitRate: times[1] < 50 && times[2] < 50 ? "✅ 100%" : "❌ Failed"
  }
};
```

**Erwartete Cache Hit Rate**: > 95% (Node 2 & 3 sollten < 50ms sein)

---

## Debugging & Troubleshooting

### Problem: Node erscheint nicht in n8n

**Lösung 1**: Custom Nodes Pfad prüfen
```bash
# Prüfe ob Symlink existiert
ls -la ~/.n8n/custom/

# Sollte zeigen:
# n8n-nodes-sap-odata -> /Users/sseegebarth/Documents/Projekte/n8n_sap_community
```

**Lösung 2**: n8n komplett neu starten
```bash
# Alle n8n Prozesse beenden
pkill -f n8n

# n8n neu starten
n8n start
```

**Lösung 3**: Build nochmal ausführen
```bash
cd /Users/sseegebarth/Documents/Projekte/n8n_sap_community
npm run build
```

### Problem: Cache funktioniert nicht

**Diagnose**:
```javascript
// Code Node im Workflow
const staticData = $workflow.staticData;
console.log("Cache Keys:", Object.keys(staticData));
return { json: { cacheKeys: Object.keys(staticData) } };
```

**Erwartung**: Sollte Keys wie `csrf_username@host...`, `metadata_username@host...` zeigen

### Problem: URL Encoding funktioniert nicht

**Diagnose**: SAP Gateway Logs prüfen
- Transaction: `/IWFND/ERROR_LOG`
- Suche nach HTTP 400 Errors
- Request URL sollte encoded characters zeigen (`%C3%BC` statt `ü`)

### Problem: Multi-Item Execution schlägt fehl

**Diagnose**:
```javascript
// Code Node nach SAP OData Multi-Item Node
return $items.map((item, index) => ({
  json: {
    itemIndex: index,
    success: item.json.error ? false : true,
    servicePath: item.json._servicePath || "unknown",
    credentials: item.json._credentials || "unknown"
  }
}));
```

---

## Automatisierte Tests ausführen

### Unit Tests
```bash
cd /Users/sseegebarth/Documents/Projekte/n8n_sap_community

# Alle Tests
npm test

# Einzelner Test
npm test -- CacheManager.test.ts

# Mit Coverage
npm test -- --coverage

# Watch Mode
npm test -- --watch
```

### ESLint
```bash
# Alle Checks
npm run lint

# Auto-Fix
npm run lintfix
```

### TypeScript Build
```bash
# Kompilieren
npm run build

# Watch Mode
npm run build:watch
```

---

## Test-Checkliste

Vor Production Deployment:

- [ ] Unit Tests: 382/382 passing
- [ ] Build: 0 TypeScript Errors
- [ ] ESLint: 0 Errors
- [ ] Cache Key Normalization funktioniert
- [ ] URL Encoding für Sonderzeichen funktioniert
- [ ] Service Path DRY (keine Code-Duplikation)
- [ ] Multi-Item Execution funktioniert
- [ ] EDM Type Literals korrekt (datetime, datetimeoffset, time, guid, decimal)
- [ ] GUID Detection für SAP-typische Keys (005056A0-...)
- [ ] Credential Isolation bei Multi-Tenant
- [ ] Performance: Cache Hit Rate > 95%
- [ ] SAP Gateway Logs: Keine unerwarteten Fehler

---

## Weitere Ressourcen

### Dokumentation
- [ARCHITECTURAL_IMPROVEMENTS_SESSION3.md](ARCHITECTURAL_IMPROVEMENTS_SESSION3.md)
- [SECURITY_FIX_CREDENTIAL_ISOLATION.md](SECURITY_FIX_CREDENTIAL_ISOLATION.md)
- [FINAL_SESSION_SUMMARY.md](FINAL_SESSION_SUMMARY.md)

### SAP OData Referenz
- OData V2 Specification: https://www.odata.org/documentation/odata-version-2-0/
- SAP Gateway Documentation: https://help.sap.com/docs/SAP_GATEWAY

### n8n Custom Nodes
- n8n Docs: https://docs.n8n.io/integrations/creating-nodes/
- Community Nodes: https://www.npmjs.com/search?q=n8n-nodes

---

*Viel Erfolg beim Testen! 🚀*
