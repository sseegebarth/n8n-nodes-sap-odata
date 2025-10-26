# SAP OData Webhook - Example Workflows

This directory contains ready-to-use n8n workflow examples that demonstrate the SAP OData Webhook trigger node in real-world scenarios.

## Available Examples

### 1. Sales Order Notification (`01-sales-order-notification.json`)

**Use Case**: Instantly notify sales team and customers when new sales orders are created in SAP.

**Features**:
- Filters for SalesOrder entities only
- Only triggers on create operations
- Sends Slack notification to sales team
- Sends email confirmation to customer
- Parallel execution for speed

**Setup**:
1. Import workflow into n8n
2. Configure Slack credentials
3. Configure Email Send credentials
4. Update webhook authentication token
5. Activate workflow
6. Configure SAP to send webhook for sales order creation

**Expected Payload**:
```json
{
  "event": "created",
  "entityType": "SalesOrder",
  "operation": "create",
  "entityKey": "0500000001",
  "data": {
    "SalesOrder": "0500000001",
    "SoldToParty": "0001000123",
    "NetAmount": "1250.00",
    "Currency": "EUR"
  }
}
```

---

### 2. Inventory Alert System (`02-inventory-alert.json`)

**Use Case**: Monitor material stock levels and alert warehouse when inventory falls below threshold.

**Features**:
- Filters for Material entities
- Extracts changed fields to detect stock updates
- Checks if stock < threshold (10 units)
- Sends SMS alert to warehouse manager
- Creates Jira ticket for replenishment
- Logs alert to PostgreSQL database
- All actions execute in parallel

**Setup**:
1. Import workflow into n8n
2. Configure Twilio credentials (SMS)
3. Configure Jira credentials
4. Configure PostgreSQL credentials
5. Update stock threshold in IF node (default: 10)
6. Update webhook authentication token
7. Activate workflow
8. Configure SAP to send webhook for material updates

**Expected Payload**:
```json
{
  "event": "updated",
  "entityType": "Material",
  "operation": "update",
  "entityKey": "MAT-123456",
  "oldValue": {
    "Material": "MAT-123456",
    "Stock": "15"
  },
  "newValue": {
    "Material": "MAT-123456",
    "Stock": "8"
  },
  "data": {
    "Material": "MAT-123456",
    "MaterialDescription": "Sample Product",
    "Stock": "8",
    "ReorderQuantity": "50"
  }
}
```

---

### 3. Price Change Synchronization (`03-price-change-sync.json`)

**Use Case**: Keep e-commerce systems synchronized with SAP master data prices in real-time.

**Features**:
- Filters for update operations only
- Extracts changed fields to detect price changes
- Logs price history to database
- Updates e-commerce system via API
- Notifies pricing team on Slack
- Calculates price change percentage

**Setup**:
1. Import workflow into n8n
2. Configure PostgreSQL credentials
3. Configure HTTP Request credentials for e-commerce API
4. Configure Slack credentials
5. Update e-commerce API URL
6. Update webhook authentication token
7. Activate workflow
8. Configure SAP to send webhook for material price updates

**Expected Payload**:
```json
{
  "event": "updated",
  "entityType": "Material",
  "operation": "update",
  "entityKey": "MAT-123456",
  "oldValue": {
    "Material": "MAT-123456",
    "Price": "100.00"
  },
  "newValue": {
    "Material": "MAT-123456",
    "Price": "95.00"
  },
  "data": {
    "Material": "MAT-123456",
    "MaterialDescription": "Premium Widget",
    "Price": "95.00",
    "Currency": "EUR"
  }
}
```

---

## How to Import Workflows

### Method 1: Via n8n UI

1. Open n8n web interface
2. Click "Workflows" → "Import from File"
3. Select the JSON file
4. Configure credentials
5. Update webhook token
6. Save and activate

### Method 2: Via CLI

```bash
# Copy workflow file to n8n workflows directory
cp 01-sales-order-notification.json ~/.n8n/workflows/

# Restart n8n
n8n restart
```

### Method 3: Via API

```bash
curl -X POST http://localhost:5678/rest/workflows \
  -H "Content-Type: application/json" \
  -d @01-sales-order-notification.json
```

---

## Customization Guide

### Change Authentication Token

In each workflow, find the webhook node and update:

```json
{
  "headerValue": "your-secret-token-123"  // Change this!
}
```

**Security Tip**: Use a strong, random token. Generate with:
```bash
openssl rand -hex 32
```

### Adjust Entity Type Filter

To monitor different SAP entities:

```json
{
  "entityType": "Customer,Partner,BusinessPartner"  // Comma-separated
}
```

### Modify Operation Filter

To trigger on different operations:

```json
{
  "operationType": ["create", "update", "delete"]  // Array of operations
}
```

### Add IP Whitelist

For additional security:

```json
{
  "options": {
    "ipWhitelist": "192.168.1.100,10.0.0.0/8"
  }
}
```

---

## Testing Workflows

### Test with cURL

Before configuring SAP, test your workflow with cURL:

```bash
# Get your webhook URL from n8n
WEBHOOK_URL="https://your-n8n.com/webhook/abc123"

# Test sales order notification
curl -X POST $WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -H "X-SAP-Signature: your-secret-token-123" \
  -d '{
    "event": "created",
    "entityType": "SalesOrder",
    "operation": "create",
    "entityKey": "0500000001",
    "data": {
      "SalesOrder": "0500000001",
      "SoldToParty": "0001000123",
      "NetAmount": "1250.00",
      "Currency": "EUR"
    }
  }'
```

### Test with Postman

1. Create new POST request
2. Set URL to your webhook URL
3. Add header: `X-SAP-Signature: your-secret-token-123`
4. Set body to JSON (see examples above)
5. Send request
6. Check n8n executions log

---

## Common Issues

### Workflow Not Triggering

**Problem**: Webhook receives request but workflow doesn't execute

**Solutions**:
1. Check workflow is activated (toggle in top-right)
2. Verify authentication token matches
3. Check event filter settings
4. Review n8n execution logs

### Authentication Failures

**Problem**: SAP receives 401 Unauthorized

**Solutions**:
1. Verify header name is correct: `X-SAP-Signature`
2. Check token value matches exactly (no extra spaces)
3. Ensure SAP sends header with every request

### Missing Credentials

**Problem**: Workflow execution fails at Slack/Email/etc. node

**Solutions**:
1. Configure all required credentials in n8n
2. Test credentials individually
3. Check credential permissions

---

## Best Practices

### Security

✅ **Use strong authentication tokens**
```bash
openssl rand -hex 32  # Generate 64-character token
```

✅ **Enable IP whitelist when possible**
```json
"ipWhitelist": "your-sap-server-ip"
```

✅ **Use HTTPS for webhook URLs**
```
https://your-n8n.com/webhook/...  ✓
http://your-n8n.com/webhook/...   ✗
```

✅ **Rotate tokens regularly** (every 90 days)

### Performance

✅ **Use specific entity type filters**
```json
"entityType": "SalesOrder"  // Not "all"
```

✅ **Filter by operation when possible**
```json
"operationType": ["create"]  // Not all operations
```

✅ **Execute actions in parallel**
- Use multiple output connections from IF node
- All downstream nodes execute simultaneously

### Monitoring

✅ **Check workflow executions regularly**
- n8n UI → Executions
- Look for failed executions
- Review error messages

✅ **Set up error notifications**
- Add error workflow
- Send alerts on failures

✅ **Log important events**
- Add database logging nodes
- Track webhook receipts
- Monitor processing times

---

## Advanced Customization

### Add Data Transformation

Insert Function node between webhook and actions:

```javascript
// Transform SAP data format
const sapData = $json.event.data;

return {
  order: {
    id: sapData.SalesOrder,
    customer: sapData.SoldToParty,
    amount: parseFloat(sapData.NetAmount),
    currency: sapData.Currency,
    status: 'new',
    createdAt: new Date().toISOString()
  }
};
```

### Add Conditional Logic

Use Switch node for multiple entity types:

```json
{
  "mode": "expression",
  "rules": {
    "rules": [
      {
        "expression": "={{ $json.event.entityType === 'SalesOrder' }}",
        "output": 0
      },
      {
        "expression": "={{ $json.event.entityType === 'Material' }}",
        "output": 1
      }
    ]
  }
}
```

### Add Error Handling

Use Error Trigger node:

1. Create new workflow
2. Add Error Trigger node
3. Connect to notification node
4. Link to main workflow

---

## Support

For questions or issues:
- Check [WEBHOOK_GUIDE.md](../WEBHOOK_GUIDE.md) for detailed documentation
- Review [n8n community forum](https://community.n8n.io/)
- Open GitHub issue for bugs

---

## Contributing

Have a great workflow example? Submit a pull request!

**Requirements**:
- Well-documented use case
- Clear setup instructions
- Example payload
- Testing procedure

---

## Version History

- **v1.4.0**: Initial example workflows
  - Sales Order Notification
  - Inventory Alert System
  - Price Change Synchronization
