# SAP n8n Workflow Examples

This directory contains example workflows demonstrating n8n-native monitoring and error handling patterns for SAP integrations.

## 📁 Available Workflows

### 1. SAP Error Handler (`sap-error-handler-example.json`)

**Purpose**: Centralized error handling for SAP workflows with automatic alerting and logging.

**Features**:
- ✅ Catches errors from any SAP workflow
- ✅ Parses SAP-specific error codes and HTTP status
- ✅ Severity classification (LOW, MEDIUM, HIGH, CRITICAL)
- ✅ Automatic Slack notifications
- ✅ Database logging for trend analysis
- ✅ Different alerts for critical vs. normal errors

**How it works**:
```
Error Trigger → Filter SAP Workflows → Parse Error → Check Severity
                                                    ├─→ Critical: Slack Alert + DB Log
                                                    └─→ Normal: Slack Notification + DB Log
```

**Setup**:
1. Import the workflow into n8n
2. Configure Slack credentials (or replace with Email, Teams, etc.)
3. Configure Database credentials (optional - remove if not needed)
4. Workflow automatically activates for all SAP workflow errors

**Error Severity Logic**:
- **CRITICAL**: HTTP 500+ errors (SAP system failures)
- **HIGH**: HTTP 401/403 (authentication issues)
- **LOW**: HTTP 404 (entity not found)
- **MEDIUM**: All other errors

---

## 🎯 Using Metrics Output

The SAP nodes support an **optional `includeMetrics` parameter** that adds performance data to the output.

### Enable Metrics

1. Open your SAP OData or SAP Advanced node
2. Go to **Advanced Options**
3. Enable **"Include Metrics in Output"**

### Example Output

When enabled, the last item includes a `_metrics` object:

```json
{
  "ProductID": "P123",
  "Name": "Product Name",
  "_metrics": {
    "executionTimeMs": 245,
    "itemsProcessed": 10,
    "successfulItems": 9,
    "failedItems": 1,
    "resource": "entity",
    "timestamp": "2025-01-27T10:30:45.123Z"
  }
}
```

### Use Cases

**Performance Monitoring**:
```javascript
// In Function node after SAP node
const metrics = $input.last().json._metrics;

if (metrics.executionTimeMs > 5000) {
  // Alert: Slow SAP response
  return {
    alert: 'SLOW_RESPONSE',
    time: metrics.executionTimeMs,
    threshold: 5000
  };
}
```

**Success Rate Tracking**:
```javascript
// Calculate success rate
const metrics = $input.last().json._metrics;
const successRate = (metrics.successfulItems / metrics.itemsProcessed) * 100;

return {
  date: new Date().toISOString().split('T')[0],
  workflow: $workflow.name,
  successRate: successRate.toFixed(2),
  totalItems: metrics.itemsProcessed,
  errors: metrics.failedItems
};

// Store in database or send to monitoring service
```

**Dashboard Integration**:
```javascript
// Send metrics to Prometheus/Datadog/NewRelic
const metrics = $input.last().json._metrics;

return {
  metric_name: 'sap_execution_time',
  metric_value: metrics.executionTimeMs,
  tags: {
    workflow: $workflow.name,
    resource: metrics.resource,
    status: metrics.failedItems > 0 ? 'partial' : 'success'
  },
  timestamp: metrics.timestamp
};
```

---

## 🔧 Best Practices

### 1. **Error Workflow Pattern**
- ✅ One central error workflow for all SAP integrations
- ✅ Use Error Trigger node (not webhook)
- ✅ Filter by workflow name or tags
- ✅ Parse errors for SAP-specific information
- ✅ Route by severity

### 2. **Monitoring Pattern**
- ✅ Use `includeMetrics` for critical workflows
- ✅ Extract metrics in Function node
- ✅ Store in time-series database (optional)
- ✅ Create alerts for thresholds
- ✅ Minimal overhead (<1ms per execution)

### 3. **Logging Pattern**
- ✅ n8n automatically logs all executions
- ✅ Use workflow tags for organization
- ✅ Structured error messages in node outputs
- ✅ Optional: Send to external logging service

---

## 📊 Example: Complete Monitoring Workflow

```
Schedule (every 5min)
  ↓
SAP OData (with includeMetrics=true)
  ↓
Function (extract metrics)
  ↓
IF (check thresholds)
  ├─→ OK: Store in DB
  └─→ ALERT: Slack + Store in DB
```

**Thresholds to Monitor**:
- Execution time > 5 seconds
- Error rate > 5%
- Failed items > 0
- No successful items (complete failure)

---

## 🚀 Getting Started

1. **Import Example Workflow**:
   - Go to n8n → Workflows → Import
   - Select `sap-error-handler-example.json`
   - Configure credentials

2. **Enable Metrics** (optional):
   - Open SAP node
   - Advanced Options → Include Metrics in Output
   - Add Function node to process metrics

3. **Test**:
   - Run a SAP workflow with an error
   - Check Error Handler workflow executions
   - Verify alerts/logs

---

## 📝 Customization

### Replace Slack with Email
Replace Slack nodes with Email nodes:
```json
{
  "type": "n8n-nodes-base.emailSend",
  "parameters": {
    "to": "sap-team@company.com",
    "subject": "SAP Error Alert",
    "text": "={{ $json.error.message }}"
  }
}
```

### Add PagerDuty Integration
Add PagerDuty node for critical errors:
```json
{
  "type": "n8n-nodes-base.pagerDuty",
  "parameters": {
    "operation": "createIncident",
    "title": "Critical SAP Error",
    "urgency": "high"
  }
}
```

### Send to External Monitoring
Use HTTP Request node to send to Prometheus, Datadog, etc.:
```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.datadoghq.com/api/v1/series",
    "authentication": "headerAuth",
    "headerParameters": {
      "parameters": [
        {
          "name": "DD-API-KEY",
          "value": "={{ $credentials.datadogApiKey }}"
        }
      ]
    },
    "body": "={{ $json.metrics }}"
  }
}
```

---

## 💡 Tips

- **Keep it Simple**: Start with error workflow only
- **Metrics are Optional**: Only use for critical workflows
- **n8n Native**: Use n8n's built-in features (Error Trigger, continueOnFail)
- **No Custom Dashboards**: Use n8n's execution view or send to existing monitoring
- **Community Sharing**: Share your workflows in n8n community

---

## 📖 Related Documentation

- [n8n Error Workflows](https://docs.n8n.io/workflows/error-workflows/)
- [n8n Execution Data](https://docs.n8n.io/workflows/executions/)
- [SAP OData Node Docs](../README.md)

---

**Questions?** Open an issue or discussion on GitHub!
