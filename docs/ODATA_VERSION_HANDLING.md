# OData V2 vs V4 - Versionsunterschiede und Handling

## 🔍 Übersicht

SAP unterstützt sowohl **OData V2** (älter, weit verbreitet) als auch **OData V4** (neuer Standard). Die Unterschiede sind erheblich und müssen korrekt behandelt werden.

## 📊 Hauptunterschiede V2 vs V4

### Response-Struktur

#### OData V2
```json
{
  "d": {
    "results": [
      {
        "__metadata": {
          "type": "ZAPI_CUSTOMER_SRV.Customer",
          "uri": "http://sap.com/Customers('1')"
        },
        "CustomerID": "1",
        "Name": "Test AG"
      }
    ],
    "__count": "100",
    "__next": "http://sap.com/Customers?$skip=10"
  }
}
```

#### OData V4
```json
{
  "@odata.context": "$metadata#Customers",
  "@odata.count": 100,
  "@odata.nextLink": "Customers?$skip=10",
  "value": [
    {
      "@odata.type": "#Customers",
      "@odata.id": "Customers('1')",
      "CustomerID": "1",
      "Name": "Test AG"
    }
  ]
}
```

## 🎯 Unsere Lösung: `ODataVersionHelper`

### 1. **Automatische Version-Erkennung**

```typescript
// nodes/Shared/utils/ODataVersionHelper.ts
public static async detectVersion(context: IExecuteFunctions): Promise<'v2' | 'v4'> {
  // 1. Check $metadata endpoint
  const metadata = await fetch('/$metadata');

  // 2. V4 indicators
  if (metadata.includes('Version="4.0"')) return 'v4';
  if (response['@odata.context']) return 'v4';

  // 3. V2 indicators
  if (metadata.includes('Version="1.0"')) return 'v2';
  if (response.d) return 'v2';

  // 4. Default to V2 (most common in SAP)
  return 'v2';
}
```

### 2. **Response-Daten Extraktion**

```typescript
public static extractData(response: any, version: 'v2' | 'v4'): any {
  if (version === 'v2') {
    // V2: Daten in 'd' wrapper
    return response.d?.results || response.d || response;
  } else {
    // V4: Daten in 'value' property
    return response.value || response;
  }
}
```

### 3. **Query Parameter Mapping**

| Funktion | OData V2 | OData V4 |
|----------|----------|----------|
| **Count** | `$inlinecount=allpages` | `$count=true` |
| **String Keys** | `Customers('ABC')` | `Customers('ABC')` |
| **Number Keys** | `Orders(123)` | `Orders(123)` |
| **Expand** | `$expand=Items` | `$expand=Items` |
| **Filter** | `$filter=Name eq 'Test'` | `$filter=Name eq 'Test'` |

```typescript
public static getVersionSpecificParams(version: 'v2' | 'v4', params: IDataObject) {
  if (params.includeCount) {
    if (version === 'v4') {
      result['$count'] = true;
    } else {
      result['$inlinecount'] = 'allpages';
    }
  }
  return result;
}
```

### 4. **Pagination Handling**

```typescript
// V2 vs V4 Pagination
public static getNextLink(response: any, version: 'v2' | 'v4'): string | undefined {
  if (version === 'v2') {
    return response.d?.__next;        // V2: d.__next
  } else {
    return response['@odata.nextLink']; // V4: @odata.nextLink
  }
}

public static getTotalCount(response: any, version: 'v2' | 'v4'): number | undefined {
  if (version === 'v2') {
    return response.d?.__count;       // V2: d.__count
  } else {
    return response['@odata.count'];  // V4: @odata.count
  }
}
```

## 📅 Datum/Zeit Formatierung

### V2: SAP-spezifisches Format
```javascript
// V2 Datum
"/Date(1609459200000)/"  // Milliseconds seit 1970

// Parser:
const timestamp = parseInt(value.match(/\/Date\((\d+)\)\//)[1]);
const date = new Date(timestamp);
```

### V4: ISO 8601 Standard
```javascript
// V4 Datum
"2021-01-01T00:00:00Z"  // ISO 8601

// Direkt verwendbar:
const date = new Date(value);
```

### Unser DateTimeFormatter
```typescript
// nodes/Shared/utils/formatters/DateTimeFormatter.ts
export class DateTimeFormatter implements IValueFormatter {
  format(value: ODataValue, options: IFormatOptions): string {
    if (options.odataVersion === 'v2') {
      // V2: datetime'2021-01-01T00:00:00'
      return `datetime'${formatted}'`;
    } else {
      // V4: 2021-01-01T00:00:00Z
      return formatted;
    }
  }
}
```

## 🔑 Entity Key Formatierung

```typescript
public static formatEntityKey(key: string, version: 'v2' | 'v4'): string {
  // V4 erfordert Quotes für String-Keys
  if (version === 'v4') {
    if (!key.includes('=') && !key.includes(',')) {
      if (!key.startsWith("'") && isNaN(Number(key))) {
        return `'${key}'`;  // 'ABC' statt ABC
      }
    }
  }
  return key;
}
```

## ⚠️ Error Handling

### V2 Error Response
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": {
      "lang": "en",
      "value": "Invalid customer ID"
    },
    "innererror": {
      "application": {
        "component_id": "CRM",
        "service_id": "ZAPI_CUSTOMER_SRV"
      }
    }
  }
}
```

### V4 Error Response
```json
{
  "error": {
    "code": "400",
    "message": "Invalid customer ID",
    "details": [{
      "code": "INVALID_ID",
      "message": "Customer ID must be numeric"
    }]
  }
}
```

### Error Parser
```typescript
public static parseError(error: any, version: 'v2' | 'v4'): string {
  if (version === 'v4') {
    // V4: error.message direkt
    return error.error?.message || 'Unknown error';
  } else {
    // V2: error.message.value
    return error.error?.message?.value || 'Unknown error';
  }
}
```

## 🚀 Verwendung in Strategien

```typescript
// nodes/Shared/strategies/GetEntityStrategy.ts
export class GetEntityStrategy extends CrudStrategy {
  async execute(context: IExecuteFunctions, itemIndex: number) {
    // 1. Version ermitteln
    const odataVersion = await ODataVersionHelper.getODataVersion(context);

    // 2. Key formatieren
    const formattedKey = ODataVersionHelper.formatEntityKey(key, odataVersion);

    // 3. Request ausführen
    const response = await sapOdataApiRequest.call(
      context,
      'GET',
      `${entitySet}(${formattedKey})`,
      {},
      query
    );

    // 4. Response extrahieren
    const result = ODataVersionHelper.extractData(response, odataVersion);

    return this.formatSuccessResponse(result);
  }
}
```

## 🔧 Konfiguration in Credentials

```typescript
// credentials/SapOdataApi.credentials.ts
{
  displayName: 'OData Version',
  name: 'version',
  type: 'options',
  options: [
    {
      name: 'Auto-Detect',
      value: 'auto',
      description: 'Automatically detect version from service'
    },
    {
      name: 'V2',
      value: 'v2',
      description: 'OData Version 2.0 (SAP Default)'
    },
    {
      name: 'V4',
      value: 'v4',
      description: 'OData Version 4.0 (Newer Services)'
    }
  ],
  default: 'auto'
}
```

## 📈 Performance-Optimierung

```typescript
// Version-Caching zur Vermeidung wiederholter Detection
private static versionCache = new Map<string, 'v2' | 'v4'>();

public static async getODataVersion(context: IExecuteFunctions): Promise<'v2' | 'v4'> {
  const serviceUrl = credentials.host;

  // Cache-Check
  if (this.versionCache.has(serviceUrl)) {
    return this.versionCache.get(serviceUrl)!;
  }

  // Einmal detecten, dann cachen
  const version = await this.detectVersion(context, serviceUrl);
  this.versionCache.set(serviceUrl, version);

  return version;
}
```

## ✅ Unterstützte Features

| Feature | V2 | V4 | Bemerkung |
|---------|----|----|-----------|
| **Basic CRUD** | ✅ | ✅ | Vollständig |
| **$filter** | ✅ | ✅ | Identisch |
| **$select** | ✅ | ✅ | Identisch |
| **$expand** | ✅ | ✅ | Syntax gleich |
| **$count** | ✅ | ✅ | Parameter unterschiedlich |
| **$top/$skip** | ✅ | ✅ | Identisch |
| **Batch** | ✅ | ✅ | Format unterschiedlich |
| **Deep Insert** | ⚠️ | ✅ | V4 besser |
| **Actions/Functions** | ❌ | ✅ | Nur V4 |
| **Delta Queries** | ❌ | ✅ | Nur V4 |

## 🎯 Best Practices

1. **Auto-Detection verwenden** - Lasse den Helper die Version automatisch erkennen
2. **Version cachen** - Vermeide wiederholte Metadata-Requests
3. **Fallback zu V2** - Die meisten SAP-Systeme nutzen noch V2
4. **Explizite Konfiguration** für bekannte Services
5. **Type Hints nutzen** für korrekte Datum/Zeit-Formatierung

## 📝 Zusammenfassung

Der `ODataVersionHelper` abstrahiert alle Version-spezifischen Unterschiede:

- **Transparente Version-Detection**
- **Automatisches Response-Mapping**
- **Korrekte Parameter-Konvertierung**
- **Version-spezifische Formatierung**
- **Einheitliche API für beide Versionen**

Entwickler müssen sich nicht um die Unterschiede kümmern - der Helper erledigt alles automatisch! 🚀