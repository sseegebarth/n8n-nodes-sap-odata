# SAP Credential Architecture - Warum getrennte Credentials?

## 📋 Übersicht der Credential-Typen

| Credential | Protokoll | Use Case | Voraussetzungen |
|------------|-----------|----------|-----------------|
| **SapIdocApi** | HTTP/HTTPS | IDoc über Web Services | SAP Gateway |
| **SapRfcApi** | RFC Binary | BAPI/RFC Funktionen | SAP RFC SDK |
| **SapOdataApi** | HTTP/HTTPS | OData Services | SAP Gateway |
| **SapIdocWebhookApi** | HTTP/HTTPS | Webhook Authentication | - |
| **SapOdataWebhookApi** | HTTP/HTTPS | Webhook Authentication | - |

## 🔍 Detaillierte Unterschiede

### IDoc Credentials
```javascript
{
  host: "https://sap.company.com",
  port: 8000,                    // HTTP Port
  client: "100",
  username: "USER",
  password: "PASS"
}
// → Verbindung über: https://sap.company.com:8000/sap/bc/idoc_xml
```

### RFC Credentials
```javascript
{
  connectionType: "direct",
  ashost: "192.168.1.100",      // IP oder Hostname
  sysnr: "00",                   // System Number (nicht Port!)
  client: "100",
  user: "USER",
  passwd: "PASS",

  // Erweiterte Optionen:
  saprouter: "/H/proxy/S/3299/H/",
  useSnc: true,                  // Secure Network Communication
  sncQop: "3",                   // Privacy Protection
  group: "PUBLIC"                // Load Balancing Group
}
// → Verbindung über: SAP RFC Protocol (Port 33XX)
```

## 🎯 Warum nicht kombinieren?

### 1. **Komplexität reduzieren**
Eine kombinierte Credential würde:
- 30+ Parameter haben
- Verwirrend für Benutzer sein
- Viele bedingte Felder benötigen

### 2. **Unterschiedliche Infrastruktur**

| Aspekt | IDoc/OData (HTTP) | RFC (Native) |
|--------|-------------------|--------------|
| **Firewall** | Port 8000/44300 | Port 3300-3399 |
| **Proxy** | HTTP Proxy möglich | SAProuter nötig |
| **Security** | HTTPS/TLS | SNC (Kerberos/X.509) |
| **Load Balancing** | HTTP Load Balancer | SAP Message Server |
| **SDK** | Keine | SAP RFC SDK nötig |

### 3. **Unterschiedliche Anwendungsfälle**

**IDoc über HTTP:**
- Cloud-freundlich
- Funktioniert über Internet
- Einfache Integration
- Gut für asynchrone Prozesse

**RFC Native:**
- Höhere Performance
- Transaktionale Integrität
- Zugriff auf alle BAPIs
- Interne Netzwerke

## 💡 Best Practice Empfehlungen

### Wann IDoc über HTTP verwenden:
✅ Cloud-Integrationen
✅ DMZ/Internet-Szenarien
✅ Wenn kein RFC SDK verfügbar
✅ Asynchrone Batch-Prozesse

### Wann RFC Native verwenden:
✅ Maximale Performance nötig
✅ Komplexe BAPI-Aufrufe
✅ Transaktionale Konsistenz
✅ Interne Netzwerke

## 🔒 Sicherheitsaspekte

### IDoc/OData (HTTP)
```typescript
// Sicherheit über:
- HTTPS/TLS
- Basic Auth oder OAuth
- API Keys
- IP Whitelisting
```

### RFC Native
```typescript
// Sicherheit über:
- SNC (Secure Network Communication)
- Kerberos/X.509 Zertifikate
- SAProuter für DMZ
- SAP Authorization Objects
```

## 📊 Entscheidungsmatrix

| Kriterium | IDoc/HTTP | RFC Native |
|-----------|-----------|------------|
| **Setup-Aufwand** | Niedrig ⚡ | Hoch 🔧 |
| **Performance** | Gut | Exzellent ⚡⚡ |
| **Cloud-Ready** | Ja ✅ | Nein ❌ |
| **Transaktional** | Begrenzt | Voll ✅ |
| **SDK benötigt** | Nein ✅ | Ja (node-rfc) |
| **Firewall-Freundlich** | Ja ✅ | Begrenzt |

## 🚀 Migration & Kombinationsmöglichkeiten

Falls beide Protokolle für dieselbe Funktion verfügbar sind:

```typescript
// Strategie Pattern ermöglicht Protokoll-Wechsel:
const strategy = credentials.type === 'rfc'
  ? new RfcStrategy(rfcCredentials)
  : new HttpStrategy(httpCredentials);

await strategy.callFunction('BAPI_USER_GET_DETAIL');
```

## 📝 Zusammenfassung

Die Trennung der Credentials ist **bewusst und sinnvoll**:

1. **Unterschiedliche Protokolle** = Unterschiedliche Parameter
2. **Unterschiedliche Use Cases** = Unterschiedliche Optimierungen
3. **Klarere UX** = Benutzer sehen nur relevante Felder
4. **Bessere Wartbarkeit** = Änderungen betreffen nur einen Typ

Die Alternative wäre eine "Monster-Credential" mit 30+ Feldern und komplexer Conditional Logic - das würde die Benutzerfreundlichkeit stark beeinträchtigen.