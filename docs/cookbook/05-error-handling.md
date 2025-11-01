# Error Handling

Build resilient SAP workflows with proper error handling and retry strategies.

## Understanding SAP Errors

### HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Invalid data/parameters |
| 401 | Unauthorized | Wrong credentials |
| 403 | Forbidden | Missing SAP authorizations |
| 404 | Not Found | Wrong entity key/service path |
| 412 | Precondition Failed | ETag mismatch |
| 500 | Internal Server Error | SAP system error |
| 503 | Service Unavailable | SAP system down/overloaded |

### SAP-Specific Errors

SAP returns detailed error messages:

```json
{
  "error": {
    "code": "/IWBEP/CM_MGW_RT/021",
    "message": {
      "lang": "en",
      "value": "Entity 'SalesOrder' with key '9999999999' does not exist"
    }
  }
}
```

## Error Handling Strategies

### Strategy 1: Continue on Fail

**Use case**: Process what you can, log failures

```json
{
  "name": "Update Orders",
  "type": "n8n-nodes-sap-odata.sapOData",
  "continueOnFail": true,
  "parameters": {
    "operation": "update",
    "entitySet": "A_SalesOrder",
    "entityKey": "={{ $json.SalesOrder }}",
    "data": { "Status": "PROCESSED" }
  }
}
```

**Next node** gets both success and error items:
```javascript
// Check for errors
if ($json.error) {
  // Handle error
} else {
  // Process success
}
```

### Strategy 2: Error Trigger Workflow

**Use case**: Centralized error handling

See [workflows/sap-error-handler-example.json](../../workflows/sap-error-handler-example.json)

```json
{
  "nodes": [
    {
      "parameters": {},
      "name": "Error Trigger",
      "type": "n8n-nodes-base.errorTrigger"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.workflow.name }}",
              "operation": "contains",
              "value2": "SAP"
            }
          ]
        }
      },
      "name": "Is SAP Workflow?",
      "type": "n8n-nodes-base.if"
    },
    {
      "parameters": {
        "functionCode": "// Parse SAP error\nconst error = $input.item.json.error;\nconst errorMsg = error?.message || 'Unknown error';\nconst sapErrorMatch = errorMsg.match(/SAP Error (\\d+)/);\nconst httpStatusMatch = errorMsg.match(/status code (\\d+)/);\n\nreturn {\n  json: {\n    timestamp: new Date().toISO(),\n    workflow: $json.workflow.name,\n    sapError: sapErrorMatch ? sapErrorMatch[1] : null,\n    httpStatus: httpStatusMatch ? parseInt(httpStatusMatch[1]) : null,\n    message: errorMsg\n  }\n};"
      },
      "name": "Parse Error"
    },
    {
      "parameters": {
        "channel": "#alerts",
        "text": "SAP Error: {{ $json.message }}"
      },
      "name": "Send Slack Alert",
      "type": "n8n-nodes-base.slack"
    }
  ]
}
```

### Strategy 3: Retry Logic

**Use case**: Transient errors (network, SAP busy)

Built-in retry (already implemented in node):
- 3 attempts
- Exponential backoff
- Retries on: 429, 503, network errors

**Manual retry with Loop**:
```json
{
  "nodes": [
    {
      "parameters": {
        "values": {
          "number": [{"name": "retries", "value": 0}]
        }
      },
      "name": "Initialize"
    },
    {
      "parameters": {
        "resource": "entity",
        "operation": "create",
        "entitySet": "A_SalesOrder",
        "data": "={{ $json.orderData }}"
      },
      "name": "Create Order",
      "continueOnFail": true
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.error !== undefined }}",
              "value2": true
            }
          ],
          "number": [
            {
              "value1": "={{ $('Initialize').item.json.retries }}",
              "operation": "smaller",
              "value2": 3
            }
          ]
        }
      },
      "name": "Should Retry?",
      "type": "n8n-nodes-base.if"
    },
    {
      "parameters": {
        "amount": 5,
        "unit": "seconds"
      },
      "name": "Wait",
      "type": "n8n-nodes-base.wait"
    }
  ]
}
```

## Handling Specific Errors

### 401 Unauthorized

**Cause**: Invalid credentials

**Solution**:
```javascript
// Test credentials first
{
  "operation": "getAll",
  "entitySet": "A_BusinessPartner",
  "limit": 1
}

// If fails, alert user
```

### 403 Forbidden

**Cause**: Missing SAP authorizations

**Solution**:
- Check in SAP: Transaction `SU53` (last authorization error)
- Contact SAP Basis team
- Document required auth objects in workflow

### 404 Not Found

**Causes**:
1. Wrong service path
2. Wrong entity key
3. Entity deleted

**Solution**:
```javascript
// Validate key exists first
GET /A_SalesOrder('{{ $json.orderId }}')

// If 404, handle gracefully
if (404) {
  log("Order not found: {{ $json.orderId }}");
  skip_processing();
}
```

### 412 Precondition Failed (ETag)

**Cause**: Entity changed since last read

**Solution**:
```json
{
  "nodes": [
    {
      "name": "Read Order",
      "parameters": {
        "operation": "get",
        "entityKey": "'4500000001'"
      }
    },
    {
      "name": "Update Order",
      "continueOnFail": true,
      "parameters": {
        "operation": "update",
        "entityKey": "'4500000001'",
        "data": { "Status": "COMPLETED" },
        "advancedOptions": {
          "ifMatch": "={{ $json.__metadata.etag }}"
        }
      }
    },
    {
      "name": "If 412 Error",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.error?.httpStatus }}",
              "operation": "equal",
              "value2": 412
            }
          ]
        }
      }
    },
    {
      "name": "Re-read and Retry"
    }
  ]
}
```

### 500 Internal Server Error

**Causes**:
1. SAP function/BAPI error
2. Data validation error
3. SAP system issue

**Solution**:
```javascript
// Check SAP logs
// Transaction: /IWFND/ERROR_LOG

// Log error details
console.log({
  sapError: $json.error.code,
  message: $json.error.message.value,
  entity: $json.entitySet,
  key: $json.entityKey
});

// Alert SAP team if critical
```

## Validation Before Requests

### Pre-validate Data

```javascript
// Validate before creating
{
  "nodes": [
    {
      "parameters": {
        "functionCode": "// Validate required fields\nconst required = ['CustomerID', 'MaterialID', 'Quantity'];\nconst missing = required.filter(f => !$json[f]);\n\nif (missing.length > 0) {\n  throw new Error(`Missing required fields: ${missing.join(', ')}`);\n}\n\n// Validate data types\nif (isNaN($json.Quantity)) {\n  throw new Error('Quantity must be a number');\n}\n\nreturn { json: $json };"
      },
      "name": "Validate Data",
      "type": "n8n-nodes-base.function"
    },
    {
      "parameters": {
        "operation": "create",
        "entitySet": "A_SalesOrder",
        "data": "={{ $json }}"
      },
      "name": "Create Order"
    }
  ]
}
```

### Check Entity Exists

```javascript
{
  "nodes": [
    {
      "parameters": {
        "operation": "get",
        "entitySet": "A_BusinessPartner",
        "entityKey": "={{ $json.customerId }}"
      },
      "name": "Check Customer Exists",
      "continueOnFail": true
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.error === undefined }}",
              "value2": true
            }
          ]
        }
      },
      "name": "Customer Found?",
      "type": "n8n-nodes-base.if"
    }
  ]
}
```

## Logging and Monitoring

### Enable Metrics

```json
{
  "advancedOptions": {
    "includeMetrics": true
  }
}
```

### Log to Database

```json
{
  "nodes": [
    {
      "name": "SAP Operation",
      "type": "n8n-nodes-sap-odata.sapOData",
      "continueOnFail": true
    },
    {
      "name": "Log Result",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "insert",
        "table": "sap_operations_log",
        "columns": "workflow,operation,status,error,timestamp",
        "values": "={{ $json.workflow_name }},={{ $json.operation }},={{ $json.error ? 'failed' : 'success' }},={{ $json.error?.message }},={{ $now.toISO() }}"
      }
    }
  ]
}
```

### Alert on High Error Rate

```javascript
// Count errors in last hour
SELECT COUNT(*) as error_count 
FROM sap_operations_log 
WHERE status = 'failed' 
  AND timestamp > NOW() - INTERVAL '1 hour';

// If error_count > threshold, send alert
```

## Best Practices

1. ✅ Always set `continueOnFail: true` for bulk operations
2. ✅ Use Error Trigger workflow for centralized handling
3. ✅ Validate data before sending to SAP
4. ✅ Check entity exists before update/delete
5. ✅ Log errors to database for analysis
6. ✅ Use ETags for concurrent updates
7. ✅ Implement retry logic for transient errors
8. ✅ Alert on critical errors (Slack, Email)
9. ✅ Monitor error rates over time
10. ✅ Document SAP authorizations needed

## Production Checklist

- [ ] Error Trigger workflow active
- [ ] Metrics enabled (`includeMetrics: true`)
- [ ] Logging to database implemented
- [ ] Alerts configured (Slack/Email)
- [ ] Retry logic for transient errors
- [ ] Validation before SAP requests
- [ ] ETag handling for updates
- [ ] SAP authorizations documented
- [ ] Error monitoring dashboard
- [ ] Tested failure scenarios

---

**Next**: [Monitoring](06-monitoring.md) | **Previous**: [Pagination](04-pagination.md)
