# Strategy Pattern Implementation - SAP OData Node

## 🎯 Overview

Das Strategy Pattern wurde erfolgreich implementiert, um die komplexe `execute()` Methode von **180+ Zeilen auf 35 Zeilen** zu reduzieren.

## 📊 Vorher vs. Nachher

### Vorher (180+ Zeilen)
```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    for (let i = 0; i < items.length; i++) {
        if (resource === 'entity') {
            if (operation === 'create') {
                // 20+ Zeilen Create-Logik
            } else if (operation === 'get') {
                // 20+ Zeilen Get-Logik
            } else if (operation === 'update') {
                // 20+ Zeilen Update-Logik
            } else if (operation === 'delete') {
                // 15+ Zeilen Delete-Logik
            } else if (operation === 'getAll') {
                // 30+ Zeilen GetAll-Logik mit Pagination
            }
        } else if (resource === 'functionImport') {
            // 25+ Zeilen Function Import-Logik
        }
    }
}
```

### Nachher (35 Zeilen)
```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;

    for (let i = 0; i < items.length; i++) {
        try {
            const operation = resource === 'entity'
                ? (this.getNodeParameter('operation', i) as string)
                : undefined;

            const strategy = OperationStrategyFactory.getStrategy(resource, operation);
            const results = await strategy.execute(this, i);

            returnData.push(...results);
        } catch (error) {
            if (this.continueOnFail()) {
                returnData.push({
                    json: { error: error.message },
                    pairedItem: { item: i },
                });
                continue;
            }
            throw error;
        }
    }

    return [returnData];
}
```

## 🗂️ Dateistruktur

```
nodes/Sap/
├── strategies/
│   ├── index.ts                          # Exports all strategies
│   ├── IOperationStrategy.ts             # Interface (16 lines)
│   ├── BaseEntityStrategy.ts             # Base class (47 lines)
│   ├── CreateEntityStrategy.ts           # Create operation (35 lines)
│   ├── GetEntityStrategy.ts              # Get operation (37 lines)
│   ├── GetAllEntitiesStrategy.ts         # GetAll + Pagination (61 lines)
│   ├── UpdateEntityStrategy.ts           # Update operation (40 lines)
│   ├── DeleteEntityStrategy.ts           # Delete operation (30 lines)
│   ├── FunctionImportStrategy.ts         # Function Import (50 lines)
│   └── OperationStrategyFactory.ts       # Factory (62 lines)
└── SapOData.node.ts                      # Main node (now much cleaner!)
```

## 📐 Architecture

### 1. Interface: `IOperationStrategy`

Definiert den Vertrag, den alle Strategien implementieren müssen:

```typescript
export interface IOperationStrategy {
    execute(
        context: IExecuteFunctions,
        itemIndex: number,
    ): Promise<INodeExecutionData[]>;
}
```

### 2. Base Class: `BaseEntityStrategy`

Bietet gemeinsame Funktionalität für alle Entity-Operationen:

```typescript
export abstract class BaseEntityStrategy {
    protected getEntitySet(context, itemIndex): string
    protected validateAndFormatKey(key, node): string
    protected getQueryOptions(context, itemIndex): IDataObject
    protected extractResult(response): any
}
```

**Vorteile:**
- ✅ Code-Wiederverwendung
- ✅ Konsistente Validierung
- ✅ DRY Principle

### 3. Concrete Strategies

Jede Operation hat ihre eigene Klasse:

#### CreateEntityStrategy
```typescript
export class CreateEntityStrategy extends BaseEntityStrategy {
    async execute(context, itemIndex) {
        const entitySet = this.getEntitySet(context, itemIndex);
        const data = validateJsonInput(...);
        const response = await sapOdataApiRequest.call(context, 'POST', ...);
        return [{ json: this.extractResult(response), ... }];
    }
}
```

#### GetEntityStrategy
```typescript
export class GetEntityStrategy extends BaseEntityStrategy {
    async execute(context, itemIndex) {
        const entitySet = this.getEntitySet(context, itemIndex);
        const entityKey = context.getNodeParameter('entityKey', itemIndex);
        const formattedKey = this.validateAndFormatKey(entityKey, ...);
        const query = this.getQueryOptions(context, itemIndex);
        const response = await sapOdataApiRequest.call(context, 'GET', ...);
        return [{ json: this.extractResult(response), ... }];
    }
}
```

#### GetAllEntitiesStrategy
```typescript
export class GetAllEntitiesStrategy extends BaseEntityStrategy {
    async execute(context, itemIndex) {
        // Handles both returnAll and limit scenarios
        // Supports pagination with batch size
        // Returns multiple INodeExecutionData items
    }
}
```

### 4. Factory: `OperationStrategyFactory`

Erstellt die richtige Strategie basierend auf Resource und Operation:

```typescript
export class OperationStrategyFactory {
    static getStrategy(resource: string, operation?: string): IOperationStrategy {
        if (resource === 'entity') {
            return this.getEntityStrategy(operation);
        }
        if (resource === 'functionImport') {
            return this.getFunctionImportStrategy();
        }
        throw new Error(`Unknown resource: ${resource}`);
    }

    static getEntityStrategy(operation: string): IOperationStrategy {
        switch (operation) {
            case 'create': return new CreateEntityStrategy();
            case 'get': return new GetEntityStrategy();
            case 'getAll': return new GetAllEntitiesStrategy();
            case 'update': return new UpdateEntityStrategy();
            case 'delete': return new DeleteEntityStrategy();
            default: throw new Error(`Unknown operation: ${operation}`);
        }
    }
}
```

## ✅ Vorteile

### 1. **Single Responsibility Principle**
Jede Klasse hat **genau eine Verantwortung**:
- `CreateEntityStrategy` → Nur Create
- `GetEntityStrategy` → Nur Get
- Etc.

### 2. **Open/Closed Principle**
- **Open for Extension**: Neue Operationen ohne Änderung bestehenden Codes
- **Closed for Modification**: Bestehende Strategies bleiben unberührt

```typescript
// Neue Operation hinzufügen? Einfach neue Klasse erstellen!
export class BulkCreateStrategy extends BaseEntityStrategy {
    async execute(context, itemIndex) {
        // Neue Logik hier
    }
}

// In Factory registrieren:
case 'bulkCreate': return new BulkCreateStrategy();
```

### 3. **Testbarkeit** ⭐⭐⭐⭐⭐

```typescript
// Vorher: Gesamte execute() Methode mocken (schwierig)
// Nachher: Jede Strategy isoliert testen (einfach)

describe('CreateEntityStrategy', () => {
    it('should validate JSON and create entity', async () => {
        const strategy = new CreateEntityStrategy();
        const result = await strategy.execute(mockContext, 0);
        expect(result[0].json).toHaveProperty('ProductID');
    });
});
```

### 4. **Code-Reduktion**

| Datei | Vorher | Nachher | Reduktion |
|-------|--------|---------|-----------|
| execute() | 180 Zeilen | 35 Zeilen | **-80%** |
| Gesamtcode | 180 Zeilen | 378 Zeilen | +110% |

**Aber:**
- Code ist auf 9 Dateien verteilt (wartbar!)
- Jede Datei ist klein und fokussiert
- Viel bessere Separation of Concerns

### 5. **Wartbarkeit** ⭐⭐⭐⭐⭐

```typescript
// Bug in Create-Operation?
// Vorher: Suche in 180 Zeilen execute()
// Nachher: Öffne CreateEntityStrategy.ts (35 Zeilen)

// Neue Validierung für Update?
// Vorher: Finde Update-Block in execute()
// Nachher: UpdateEntityStrategy.ts bearbeiten
```

## 🧪 Tests

### Strategy Tests
```
test/strategies/
├── CreateEntityStrategy.test.ts
├── GetEntityStrategy.test.ts
├── GetAllEntitiesStrategy.test.ts
├── UpdateEntityStrategy.test.ts
├── DeleteEntityStrategy.test.ts
├── FunctionImportStrategy.test.ts
└── OperationStrategyFactory.test.ts
```

### Factory Tests
```typescript
describe('OperationStrategyFactory', () => {
    it('should return CreateEntityStrategy for create', () => {
        const strategy = OperationStrategyFactory.getEntityStrategy('create');
        expect(strategy).toBeInstanceOf(CreateEntityStrategy);
    });

    it('should throw for unknown operation', () => {
        expect(() => {
            OperationStrategyFactory.getEntityStrategy('unknown');
        }).toThrow('Unknown entity operation');
    });
});
```

## 📈 Performance Impact

### Memory
- **Vorher**: Einmal große Funktion im Memory
- **Nachher**: Kleine Strategy-Instanzen werden bei Bedarf erstellt
- **Impact**: Neutral bis leicht positiv

### Execution Speed
- **Vorher**: Mehrere if-else Checks
- **Nachher**: Direkte Strategy-Auswahl via Factory
- **Impact**: Neutral bis leicht positiv (weniger Conditionals)

### Code Loading
- **Vorher**: 180 Zeilen werden geladen
- **Nachher**: Nur benötigte Strategy wird geladen
- **Impact**: Positiv (besonders bei Tree-Shaking)

## 🔄 Erweiterbarkeit

### Neue Operation hinzufügen

1. **Strategy erstellen**
```typescript
// nodes/Sap/strategies/BulkUpdateStrategy.ts
export class BulkUpdateStrategy extends BaseEntityStrategy {
    async execute(context: IExecuteFunctions, itemIndex: number) {
        const entities = context.getNodeParameter('entities', itemIndex);
        // Bulk update Logik
    }
}
```

2. **In Factory registrieren**
```typescript
// nodes/Sap/strategies/OperationStrategyFactory.ts
case 'bulkUpdate':
    return new BulkUpdateStrategy();
```

3. **In Node Properties hinzufügen**
```typescript
// nodes/Sap/SapOData.node.ts
options: [
    // ... existing operations
    {
        name: 'Bulk Update',
        value: 'bulkUpdate',
    },
]
```

4. **Test schreiben**
```typescript
// test/strategies/BulkUpdateStrategy.test.ts
describe('BulkUpdateStrategy', () => {
    it('should update multiple entities', async () => {
        // Test implementation
    });
});
```

**Fertig! Kein bestehender Code wurde geändert.**

## 🎓 Best Practices

### 1. Gemeinsame Logik in Base Class
```typescript
// ✅ GOOD
protected validateAndFormatKey(key: string, node: INode): string {
    // Wiederverwendbar für Get, Update, Delete
}

// ❌ BAD
// Validierung in jeder Strategy wiederholen
```

### 2. Error Handling in Strategies
```typescript
// ✅ GOOD - Spezifische Fehler in Strategy
async execute(context, itemIndex) {
    const data = validateJsonInput(dataString, 'Data', context.getNode());
    // validateJsonInput wirft NodeOperationError
}

// ❌ BAD - Generische Fehler
async execute(context, itemIndex) {
    try {
        const data = JSON.parse(dataString);
    } catch (e) {
        throw new Error('Invalid JSON'); // Zu generisch
    }
}
```

### 3. Return Consistency
```typescript
// ✅ GOOD - Immer Array zurückgeben
return [{ json: result, pairedItem: { item: itemIndex } }];

// Auch wenn nur ein Item (konsistent mit Interface)
```

## 🚀 Migration Guide

### Für andere n8n Nodes

1. **Identify Complex execute()**
   - Mehr als 100 Zeilen?
   - Mehrere if-else/switch Blöcke?
   - Verschiedene Operationen?

2. **Extract Operations**
   - Eine Strategy pro Operation
   - Gemeinsame Logik in Base Class

3. **Create Factory**
   - Zentrale Strategy-Erstellung
   - Clear error messages

4. **Update execute()**
   - Factory aufrufen
   - Strategy ausführen
   - Error handling beibehalten

5. **Write Tests**
   - Strategy-Tests (isoliert)
   - Factory-Tests (Routing)
   - Integration-Tests (E2E)

## 📚 Weitere Ressourcen

- [Strategy Pattern - Wikipedia](https://en.wikipedia.org/wiki/Strategy_pattern)
- [n8n Node Development](https://docs.n8n.io/integrations/creating-nodes/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## 🎉 Zusammenfassung

Das Strategy Pattern hat den SAP OData Node:

✅ **Vereinfacht**: Von 180 → 35 Zeilen in execute()
✅ **Testbar gemacht**: Jede Operation isoliert testbar
✅ **Erweiterbar gemacht**: Neue Operationen ohne Risiko
✅ **Wartbar gemacht**: Klare Struktur, kleine Dateien
✅ **SOLID konform**: Single Responsibility, Open/Closed

**Result: Production-Ready, Maintainable, Extensible Code! 🚀**
