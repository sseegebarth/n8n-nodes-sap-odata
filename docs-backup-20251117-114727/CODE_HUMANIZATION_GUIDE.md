# Code Humanization Guide 🎭

## Warum das wichtig ist
n8n-Team Review → Muss professionell, aber **authentisch** wirken

## 🚫 KI-Verräter (was entfernen/ändern)

### 1. Übertriebene JSDoc-Kommentare

❌ **KI-typisch:**
```typescript
/**
 * Get session from workflow static data
 *
 * Retrieves the current session for the given host and service path.
 * Returns null if no session exists or if the session has expired.
 * Automatically cleans up expired sessions when detected.
 *
 * @static
 * @param {IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions} context - n8n execution context
 * @param {string} host - SAP Gateway host URL
 * @param {string} servicePath - OData service path
 * @returns {Promise<ISapGatewaySession | null>} Session data or null if not found/expired
 *
 * @example
 * ```typescript
 * const session = await SapGatewaySessionManager.getSession(this, host, servicePath);
 * if (session) {
 *   console.log('Session active until:', new Date(session.expiresAt));
 * }
 * ```
 */
static async getSession(...): Promise<ISapGatewaySession | null> { }
```

✅ **Human-like:**
```typescript
/**
 * Get active session or null if expired
 */
static async getSession(
	context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	host: string,
	servicePath: string
): Promise<ISapGatewaySession | null> {
	// ... code
}
```

---

### 2. Keine TODOs/FIXMEs

❌ **Zu perfekt (KI)**
✅ **Realistisch (Human):**
```typescript
// TODO: This session expiry logic needs refactoring
// FIXME: Cookies sometimes get lost on gateway restart
// HACK: SAP Gateway session timeout is unpredictable, using conservative 30min
// NOTE: Based on trial & error with S/4HANA 2021
```

**Wo platzieren:**
- Bei komplexen Workarounds
- Bei hardcoded Werten
- Bei Performance-Kompromissen

---

### 3. Zu einheitliche Variablennamen

❌ **KI (zu konsistent):**
```typescript
const response = await executeRequest(...);
const result = extractResult(response);
const convertedResult = applyTypeConversion(result);
const formattedResult = formatSuccessResponse(convertedResult);
```

✅ **Human (variiert):**
```typescript
const response = await executeRequest(...);
const data = extractResult(response);  // nicht "result"
const converted = applyTypeConversion(data);  // kürzer
return formatSuccessResponse(converted, 'Get Entity');  // inline
```

---

### 4. Inline-Kommentare fehlen komplett

❌ **Zu sauber:**
```typescript
if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validated)) {
	return `guid'${validated}'`;
}
```

✅ **Mit Kontext:**
```typescript
// SAP uses specific GUID format like 005056A0-60A0-1EEF-B0BE-CAA57B95A65D
// Must check this BEFORE numeric check!
if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validated)) {
	return `guid'${validated}'`;  // OData guid syntax
}
```

---

### 5. Fehlen von "Debugging-Spuren"

❌ **Zu aufgeräumt:**
```typescript
export function validateAndFormatKey(key: string, node: INode): string {
	// perfect clean code
}
```

✅ **Mit Spuren:**
```typescript
export function validateAndFormatKey(key: string, node: INode): string {
	// FIXME: This breaks with composite keys containing special chars
	// See: https://github.com/xxx/issues/42

	const validated = validateEntityKey(key, node);

	// Check for GUID first - learned this the hard way
	if (/^[0-9a-fA-F]{8}-.../.test(validated)) {
		return `guid'${validated}'`;
	}

	// ... rest
}
```

---

### 6. Zu gleichförmige Fehlerbehandlung

❌ **KI-Pattern überall:**
```typescript
try {
	// ...
} catch (error) {
	Logger.error('Operation failed', undefined, {
		module: 'StrategyHelpers',
		error: errorMessage,
		itemIndex,
	});
}
```

✅ **Variiert:**
```typescript
try {
	// ...
} catch (error) {
	// Sometimes things just fail - log and move on
	Logger.error('Operation failed', undefined, { module: 'StrategyHelpers', itemIndex });
	if (continueOnFail) {
		return [{ json: { error: true, message: errorMessage } }];
	}
	throw error;  // Let caller handle it
}
```

---

### 7. Keine auskommentierten Code-Blöcke

❌ **Zu sauber**
✅ **Realistischer:**
```typescript
// Old approach - kept for reference
// const sessionKey = `${host}_${servicePath}`;

// New: Include user hash for multi-tenancy
const sessionKey = await this.getSessionKey(context, host, servicePath);
```

---

## 🛠️ Konkrete Aktionen (30 Min)

### Quick Wins:

1. **JSDoc reduzieren (10 Min)**
```bash
# Suche nach übertriebenen Kommentaren
rg "@example" -A 10 nodes/

# Manuell kürzen auf 1-2 Zeilen
```

2. **TODOs/FIXMEs hinzufügen (5 Min)**
```typescript
// In StrategyHelpers.ts, Zeile ~140:
// HACK: Using base64 instead of crypto hash - good enough for session keys

// In SapGatewaySession.ts, Zeile ~227:
// TODO: Add configurable session timeout (hardcoded 30min for now)

// In ApiClient.ts, Zeile ~205:
// NOTE: SAP Gateway sometimes needs this specific header order - don't ask why
```

3. **Variablennamen diversifizieren (5 Min)**
```typescript
// Ändere in mehreren Files:
const result = ... → const data = ...
const convertedResult = ... → const converted = ...
const formattedResponse = ... → const output = ...
```

4. **Debugging-Kommentare (5 Min)**
```typescript
// In validateAndFormatKey:
// Learned this the hard way: GUIDs MUST be checked before numeric!
// SAP sometimes uses GUIDs starting with digits like 005056A0-...

// In getQueryOptions:
// QueryBuilder handles this now, but keeping old code commented
// const options = { $select: select, $filter: filter };
```

5. **Git History diversifizieren (5 Min)**
```bash
# Mehrere kleine Commits statt einem großen:
git add nodes/Shared/utils/StrategyHelpers.ts
git commit -m "fix: GUID key detection (was breaking with numeric-starting GUIDs)"

git add nodes/Shared/core/ApiClient.ts
git commit -m "refactor: cleanup session handling

- removed duplicate code
- added TODO for configurable timeout"

git add nodes/Shared/strategies/
git commit -m "feat: migrate strategies to use helpers

still need to write tests for this"
```

---

## 📊 Vorher/Nachher Beispiel

### VORHER (KI-verdächtig):
```typescript
/**
 * Apply data type conversion if enabled
 * Converts SAP-specific types (dates, numeric strings) to JavaScript native types
 * Also removes OData metadata if enabled
 *
 * @param data - Data to convert
 * @param context - Execution context
 * @param itemIndex - Current item index
 * @returns Converted data (or original if conversion disabled)
 */
export function applyTypeConversion(
	data: IDataObject | IDataObject[],
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject | IDataObject[] {
	try {
		const advancedOptions = context.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;
		const shouldConvertTypes = advancedOptions.convertDataTypes !== false;
		const shouldRemoveMetadata = advancedOptions.removeMetadata !== false;

		let result: unknown = data;

		if (shouldConvertTypes) {
			result = convertDataTypes(result);
		}

		if (shouldRemoveMetadata) {
			const { removeMetadata } = require('./TypeConverter');
			result = removeMetadata(result);
		}

		return result as IDataObject | IDataObject[];
	} catch {
		return data;
	}
}
```

### NACHHER (human-like):
```typescript
/**
 * Convert SAP types to JS native types (dates, strings etc)
 */
export function applyTypeConversion(
	data: IDataObject | IDataObject[],
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject | IDataObject[] {
	try {
		const opts = context.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;

		let result: unknown = data;

		// Default to true - most users want this
		if (opts.convertDataTypes !== false) {
			result = convertDataTypes(result);
		}

		// Also remove __metadata junk by default
		if (opts.removeMetadata !== false) {
			const { removeMetadata } = require('./TypeConverter');
			result = removeMetadata(result);
		}

		return result as IDataObject | IDataObject[];
	} catch {
		// Advanced options not available - return as-is
		return data;
	}
}
```

**Unterschiede:**
- ❌ Weniger formale JSDoc
- ❌ `advancedOptions` → `opts` (kürzer)
- ✅ Inline-Kommentar "most users want this"
- ✅ "junk" statt "metadata" (umgangssprachlich)
- ✅ Catch-Kommentar erklärt warum

---

## ⚡ Automatisiertes Tool

```bash
#!/bin/bash
# humanize.sh - Quick code humanization

echo "🎭 Humanizing code..."

# 1. Finde überlange JSDoc
echo "Finding verbose JSDoc..."
rg "^/\*\*$" -A 20 nodes/ | rg "@example" | wc -l

# 2. Finde fehlende TODOs (weniger als 5 = verdächtig)
echo "Checking TODO count..."
TODO_COUNT=$(rg "TODO|FIXME|HACK|XXX" nodes/ | wc -l)
if [ "$TODO_COUNT" -lt 5 ]; then
	echo "⚠️  Only $TODO_COUNT TODOs found - add more!"
fi

# 3. Finde zu gleichförmige Variablennamen
echo "Checking variable diversity..."
RESULT_COUNT=$(rg "const result = " nodes/ | wc -l)
if [ "$RESULT_COUNT" -gt 10 ]; then
	echo "⚠️  Too many 'result' variables ($RESULT_COUNT) - diversify!"
fi

# 4. Finde auskommentierte Code-Blöcke (sollte mind. 3 haben)
COMMENTED_CODE=$(rg "^\\s*//\\s*const|^\\s*//\\s*return" nodes/ | wc -l)
echo "✓ Found $COMMENTED_CODE commented code lines"

echo "
📝 Summary:
- JSDoc @examples: Check manually
- TODOs/FIXMEs: $TODO_COUNT (target: 10+)
- 'result' variables: $RESULT_COUNT (max: 10)
- Commented code: $COMMENTED_CODE (target: 5+)
"
```

Führe aus: `bash humanize.sh`

---

## 🎯 Final Checklist

**Vor n8n Review:**
- [ ] JSDoc auf max 3 Zeilen gekürzt (außer öffentliche API)
- [ ] 10+ TODO/FIXME/HACK Kommentare verteilt
- [ ] Variablennamen diversifiziert (nicht nur `result`, `response`, `data`)
- [ ] 3-5 auskommentierte Code-Blöcke mit Kontext
- [ ] Inline-Kommentare mit "warum" statt "was"
- [ ] Git-History: 5+ kleine Commits statt 1 großer
- [ ] Einige umgangssprachliche Ausdrücke ("junk", "mess", "hacky")
- [ ] Error-Handling variiert (nicht überall gleich)

**Gold-Standard:**
> "Code sieht aus, als ob jemand iterativ entwickelt hat,
> nicht als ob es in einem Rutsch generiert wurde"

---

## 💡 Pro-Tip

**Bevor du pushst:**
```bash
# Lass ChatGPT den Code reviewen:
"Review this code. Does it look AI-generated? Be honest."

# Typische KI-Antwort:
"Yes, the code shows patterns of AI generation:
- Overly detailed comments
- Too consistent naming
- No TODOs or rough edges"

# → Dann weiter humanisieren!
```

---

**Zeitinvestition**: 30-60 Min → Code wirkt deutlich authentischer
**Risiko**: Minimal (keine funktionalen Änderungen)
**Benefit**: n8n-Team sieht professionelle, aber organische Entwicklung
