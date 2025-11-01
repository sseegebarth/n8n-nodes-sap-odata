# Pagination

Handle large datasets efficiently with proper pagination strategies.

## Why Pagination Matters

SAP systems often contain millions of records. Without pagination:
- ❌ Requests timeout
- ❌ Memory issues
- ❌ Poor performance
- ❌ SAP system overload

## Pagination Methods

### Method 1: Simple Limit (returnAll: false)

**Best for**: Small to medium datasets (<1000 items)

```json
{
  "parameters": {
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "returnAll": false,
    "limit": 100
  }
}
```

**Pros**: Simple, fast
**Cons**: Only gets first N items

### Method 2: $top & $skip (Manual Paging)

**Best for**: Known page size, manual control

```json
{
  "options": {
    "$top": 50,
    "$skip": 100,
    "$orderby": "SalesOrder asc"
  }
}
```

**Gets**: Items 101-150

### Method 3: Split In Batches Node

**Best for**: Processing all records in chunks

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "getAll",
        "entitySet": "A_SalesOrder",
        "returnAll": true
      },
      "name": "Get All Orders"
    },
    {
      "parameters": {
        "batchSize": 100,
        "options": {}
      },
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches"
    },
    {
      "parameters": {
        "resource": "entity",
        "operation": "update",
        "entitySet": "A_SalesOrder",
        "entityKey": "={{ $json.SalesOrder }}",
        "data": { "Status": "PROCESSED" }
      },
      "name": "Process Batch"
    }
  ]
}
```

### Method 4: Server-Driven Paging

**Best for**: Large datasets, automatic paging

SAP returns `__next` link for next page:

```json
{
  "d": {
    "results": [ /* data */ ],
    "__next": "https://sap-system.com/...?$skiptoken=..."
  }
}
```

Use **HTTP Request** node to follow `__next` links.

## Complete Examples

### Example 1: Process 10,000 Orders in Batches

```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "entity",
        "operation": "getAll",
        "entitySet": "A_SalesOrder",
        "returnAll": false,
        "limit": 1000,
        "options": {
          "$filter": "OverallSDProcessStatus eq 'A'",
          "$select": "SalesOrder,TotalNetAmount",
          "$orderby": "SalesOrder asc"
        }
      },
      "name": "Get Orders (Batch 1)"
    },
    {
      "parameters": {
        "batchSize": 100
      },
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches"
    },
    {
      "parameters": {
        "functionCode": "// Process each batch\nreturn items.map(item => ({\n  json: {\n    order: item.json.SalesOrder,\n    processed: true\n  }\n}));"
      },
      "name": "Process Batch",
      "type": "n8n-nodes-base.function"
    }
  ]
}
```

### Example 2: Dynamic Pagination Loop

```json
{
  "nodes": [
    {
      "parameters": {
        "values": {
          "number": [
            {"name": "page", "value": 0},
            {"name": "pageSize", "value": 100}
          ]
        }
      },
      "name": "Initialize",
      "type": "n8n-nodes-base.set"
    },
    {
      "parameters": {
        "resource": "entity",
        "operation": "getAll",
        "entitySet": "A_SalesOrder",
        "returnAll": false,
        "limit": "={{ $json.pageSize }}",
        "options": {
          "$skip": "={{ $json.page * $json.pageSize }}",
          "$orderby": "SalesOrder asc"
        }
      },
      "name": "Get Page"
    },
    {
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.length }}",
              "operation": "equal",
              "value2": "={{ $('Initialize').item.json.pageSize }}"
            }
          ]
        }
      },
      "name": "More Pages?",
      "type": "n8n-nodes-base.if"
    }
  ]
}
```

### Example 3: Incremental Sync (Last Modified)

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "options": {
      "$filter": "LastChangeDateTime gt datetime'{{ $workflow.staticData.lastSync }}'",
      "$orderby": "LastChangeDateTime asc",
      "$top": 1000
    }
  }
}
```

**After processing**:
```javascript
// Store last sync time
$workflow.staticData.lastSync = $now.toISO();
```

## Performance Tips

### 1. Always Use $orderby with Pagination

```javascript
// ❌ Bad: Inconsistent results across pages
{
  "$top": 100,
  "$skip": 100
}

// ✅ Good: Consistent ordering
{
  "$top": 100,
  "$skip": 100,
  "$orderby": "SalesOrder asc"
}
```

### 2. Use $select to Reduce Payload

```javascript
{
  "$select": "SalesOrder,TotalNetAmount",
  "$top": 500,
  "$orderby": "SalesOrder asc"
}
```

**Result**: 10x faster than fetching all fields

### 3. Filter Before Paging

```javascript
{
  "$filter": "Status eq 'A'",  // Reduces dataset first
  "$top": 100,
  "$skip": 0
}
```

### 4. Use Appropriate Batch Sizes

| Dataset Size | Recommended $top |
|--------------|------------------|
| < 1,000 | 100-200 |
| 1,000 - 10,000 | 500-1000 |
| > 10,000 | 1000-2000 |

⚠️ SAP may have server-side limits (check with Basis team)

## Common Pitfalls

### Pitfall 1: returnAll Without Filter

```javascript
// ❌ Bad: May fetch 1 million records
{
  "returnAll": true,
  "entitySet": "A_BusinessPartner"
}

// ✅ Good: Filter first
{
  "returnAll": true,
  "entitySet": "A_BusinessPartner",
  "options": {
    "$filter": "Country eq 'DE'"
  }
}
```

### Pitfall 2: No Ordering

```javascript
// ❌ Bad: Pages may have duplicates/gaps
{
  "$top": 100,
  "$skip": 100
}

// ✅ Good: Consistent with $orderby
{
  "$top": 100,
  "$skip": 100,
  "$orderby": "ID asc"
}
```

### Pitfall 3: Processing All in Memory

```javascript
// ❌ Bad: Loads all into memory
Get All (returnAll: true) → Process All

// ✅ Good: Stream processing
Get Batch → Split In Batches → Process Each Batch
```

## Monitoring Large Syncs

Enable metrics to track performance:

```json
{
  "advancedOptions": {
    "includeMetrics": true
  }
}
```

**Output**:
```json
{
  "_metrics": {
    "executionTimeMs": 45000,
    "itemsProcessed": 5000,
    "successfulItems": 4995,
    "failedItems": 5
  }
}
```

## Best Practices

1. ✅ Always use `$orderby` with pagination
2. ✅ Use `$select` to reduce payload
3. ✅ Filter before paging (`$filter`)
4. ✅ Use Split In Batches for large datasets
5. ✅ Monitor with `includeMetrics`
6. ✅ Implement error handling for timeouts
7. ✅ Test with small batches first

---

**Next**: [Error Handling](05-error-handling.md) | **Previous**: [Function Imports](03-function-imports.md)
