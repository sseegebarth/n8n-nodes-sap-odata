# Monitoring & Performance

Track, measure, and optimize your SAP workflows for production use.

## Metrics Output

Enable built-in metrics to track performance:

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
    "executionTimeMs": 2340,
    "itemsProcessed": 100,
    "successfulItems": 98,
    "failedItems": 2,
    "resource": "entity",
    "operation": "getAll",
    "timestamp": "2024-03-15T14:30:00.000Z"
  }
}
```

## Performance Tracking

### Track Execution Time

```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "entity",
        "operation": "getAll",
        "entitySet": "A_SalesOrder",
        "advancedOptions": {
          "includeMetrics": true
        }
      },
      "name": "Get Orders"
    },
    {
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json._metrics.executionTimeMs }}",
              "operation": "larger",
              "value2": 5000
            }
          ]
        }
      },
      "name": "Slow Query?",
      "type": "n8n-nodes-base.if"
    },
    {
      "parameters": {
        "channel": "#alerts",
        "text": "Slow SAP query detected: {{ $json._metrics.executionTimeMs }}ms"
      },
      "name": "Alert",
      "type": "n8n-nodes-base.slack"
    }
  ]
}
```

### Track Success Rate

```javascript
{
  "nodes": [
    {
      "name": "Get Orders",
      "advancedOptions": { "includeMetrics": true }
    },
    {
      "name": "Calculate Success Rate",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "const metrics = $json._metrics;\nconst successRate = (metrics.successfulItems / metrics.itemsProcessed) * 100;\n\nreturn {\n  json: {\n    date: new Date().toISOString().split('T')[0],\n    workflow: $workflow.name,\n    successRate: successRate.toFixed(2),\n    totalItems: metrics.itemsProcessed,\n    errors: metrics.failedItems\n  }\n};"
      }
    },
    {
      "name": "Store Metrics",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "insert",
        "table": "workflow_metrics"
      }
    }
  ]
}
```

## Error Monitoring

See [workflows/sap-error-handler-example.json](../../workflows/sap-error-handler-example.json)

Key features:
- Catches all SAP workflow errors
- Parses SAP error codes
- Classifies severity (CRITICAL, HIGH, MEDIUM, LOW)
- Routes to appropriate channels

### Error Severity Classification

```javascript
// In Error Trigger workflow
const errorMsg = $input.item.json.error?.message || '';
const httpStatusMatch = errorMsg.match(/status code (\d+)/);

let severity = 'MEDIUM';
if (httpStatusMatch) {
  const status = parseInt(httpStatusMatch[1]);
  if (status >= 500) severity = 'CRITICAL';
  else if (status === 401 || status === 403) severity = 'HIGH';
  else if (status === 404) severity = 'LOW';
}
```

## Logging Strategies

### Strategy 1: Log to Database

```json
{
  "nodes": [
    {
      "name": "SAP Operation",
      "type": "n8n-nodes-sap-odata.sapOData",
      "advancedOptions": { "includeMetrics": true }
    },
    {
      "name": "Log to Postgres",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "insert",
        "table": "sap_operations",
        "columns": "timestamp,workflow,operation,execution_time,items_processed,success_rate",
        "values": "={{ $json._metrics.timestamp }},={{ $workflow.name }},={{ $json._metrics.operation }},={{ $json._metrics.executionTimeMs }},={{ $json._metrics.itemsProcessed }},={{ ($json._metrics.successfulItems / $json._metrics.itemsProcessed * 100).toFixed(2) }}"
      }
    }
  ]
}
```

### Strategy 2: Send to Prometheus/Grafana

```javascript
{
  "nodes": [
    {
      "name": "SAP Operation",
      "advancedOptions": { "includeMetrics": true }
    },
    {
      "name": "Format for Prometheus",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "const m = $json._metrics;\nreturn {\n  json: {\n    metric: 'sap_operation_duration_ms',\n    value: m.executionTimeMs,\n    labels: {\n      workflow: $workflow.name,\n      operation: m.operation,\n      resource: m.resource\n    },\n    timestamp: Date.now()\n  }\n};"
      }
    },
    {
      "name": "Push to Prometheus",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://pushgateway:9091/metrics/job/n8n_sap",
        "bodyParametersJson": "={{ $json }}"
      }
    }
  ]
}
```

### Strategy 3: Send to Datadog

```json
{
  "nodes": [
    {
      "name": "SAP Operation",
      "advancedOptions": { "includeMetrics": true }
    },
    {
      "name": "Send to Datadog",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://api.datadoghq.com/api/v1/series",
        "authentication": "headerAuth",
        "headerParametersJson": "={ \"DD-API-KEY\": \"your-api-key\" }",
        "bodyParametersJson": "={\n  \"series\": [{\n    \"metric\": \"sap.operation.duration\",\n    \"points\": [[{{ Date.now() / 1000 }}, {{ $json._metrics.executionTimeMs }}]],\n    \"type\": \"gauge\",\n    \"tags\": [\n      \"workflow:{{ $workflow.name }}\",\n      \"operation:{{ $json._metrics.operation }}\"\n    ]\n  }]\n}"
      }
    }
  ]
}
```

## Performance Optimization

### 1. Use $select

```javascript
// ❌ Bad: Fetches all 50 fields
GET /A_SalesOrder

// ✅ Good: Fetches only 4 fields (~80% faster)
GET /A_SalesOrder?$select=SalesOrder,TotalNetAmount,Status,Date
```

### 2. Use $filter

```javascript
// ❌ Bad: Fetches 10,000 orders, filters in n8n
GET /A_SalesOrder
// Then filter in n8n

// ✅ Good: SAP filters, returns only 100
GET /A_SalesOrder?$filter=Status eq 'A'
```

### 3. Batch Operations

See [next_steps_suggestions_n8n_compliant.md](../../next_steps_suggestions_n8n_compliant.md) - OData Batch Support (planned)

Current workaround:
```json
{
  "nodes": [
    {
      "name": "Split In Batches",
      "parameters": { "batchSize": 100 }
    },
    {
      "name": "Process Batch",
      "type": "n8n-nodes-sap-odata.sapOData"
    }
  ]
}
```

### 4. Cache Metadata

Metadata is automatically cached by the node:
- First request: ~2 seconds
- Subsequent requests: <50ms

### 5. Connection Pooling

Built-in connection pooling (automatic):
- Reuses HTTP connections
- Reduces handshake overhead
- Configurable in Advanced Options

## Monitoring Dashboard

### Grafana Dashboard Example

**Metrics to track**:
1. Request duration (p50, p95, p99)
2. Success rate
3. Error rate by type
4. Requests per minute
5. SAP system health

**Sample Query** (Prometheus):
```promql
# Average execution time
avg(sap_operation_duration_ms) by (workflow)

# Success rate
sum(rate(sap_operations_success[5m])) / 
sum(rate(sap_operations_total[5m])) * 100

# Error rate
sum(rate(sap_operations_errors[5m])) by (error_code)
```

## Alerts

### Alert Rules

#### Slow Queries
```
IF execution_time > 10 seconds
THEN alert "Slow SAP query"
```

#### High Error Rate
```
IF error_rate > 5% in last 10 minutes
THEN alert "High SAP error rate"
```

#### SAP System Down
```
IF consecutive_503_errors > 3
THEN alert "SAP system unavailable"
```

### Alert Channels

**Slack** (recommended):
```json
{
  "name": "Alert to Slack",
  "type": "n8n-nodes-base.slack",
  "parameters": {
    "channel": "#sap-alerts",
    "text": "Alert: {{ $json.alert_message }}",
    "attachments": [
      {
        "color": "danger",
        "fields": [
          {
            "title": "Workflow",
            "value": "={{ $json.workflow }}",
            "short": true
          },
          {
            "title": "Error",
            "value": "={{ $json.error }}",
            "short": true
          }
        ]
      }
    ]
  }
}
```

**Email** (critical):
```json
{
  "name": "Alert via Email",
  "type": "n8n-nodes-base.gmail",
  "parameters": {
    "to": "sap-team@company.com",
    "subject": "CRITICAL: SAP System Alert",
    "message": "{{ $json.alert_details }}"
  }
}
```

**PagerDuty** (incidents):
```json
{
  "name": "Create PagerDuty Incident",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.pagerduty.com/incidents",
    "authentication": "headerAuth",
    "bodyParametersJson": "={\n  \"incident\": {\n    \"type\": \"incident\",\n    \"title\": \"SAP System Error\",\n    \"service\": { \"id\": \"your-service-id\" },\n    \"urgency\": \"high\",\n    \"body\": {\n      \"type\": \"incident_body\",\n      \"details\": \"{{ $json.error_details }}\"\n    }\n  }\n}"
  }
}
```

## Production Monitoring Checklist

- [ ] Metrics enabled on all SAP nodes
- [ ] Error Trigger workflow active
- [ ] Logs stored in database
- [ ] Grafana dashboard created
- [ ] Slack alerts configured
- [ ] PagerDuty integration (critical)
- [ ] Performance baselines established
- [ ] Alert thresholds tuned
- [ ] On-call rotation defined
- [ ] Runbooks documented

## Performance Baselines

Track these metrics:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Execution Time | <2s | 2-5s | >5s |
| Success Rate | >99% | 95-99% | <95% |
| Error Rate | <1% | 1-5% | >5% |
| Requests/min | <1000 | 1000-2000 | >2000 |

## Troubleshooting Performance

### Slow Queries

1. Check `$select` - are you fetching unnecessary fields?
2. Check `$filter` - is filtering happening on SAP or n8n?
3. Check `$expand` - are you expanding too much data?
4. Check dataset size - use pagination for large results

### High Memory Usage

1. Use `Split In Batches` for large datasets
2. Set `returnAll: false` with appropriate limit
3. Use `$select` to reduce payload size

### Connection Timeouts

1. Check SAP system performance (transaction ST03)
2. Increase timeout in Advanced Options
3. Implement retry logic
4. Check network connectivity

---

**Previous**: [Error Handling](05-error-handling.md) | **Back to**: [Cookbook Home](README.md)
