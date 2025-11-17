# SAP OData Webhook Integration Guide

This guide explains how to set up and use the SAP OData Webhook Trigger node to receive real-time events from your SAP system.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Event Filtering](#event-filtering)
- [SAP Configuration](#sap-configuration)
- [Testing](#testing)
- [Use Cases](#use-cases)
- [Troubleshooting](#troubleshooting)

---

## Overview

The **SAP OData Webhook** trigger node allows n8n to receive real-time notifications from SAP systems instead of polling for changes. This provides:

✅ **Near-instant notifications** (< 1 second latency)
✅ **Reduced SAP system load** (no continuous polling)
✅ **Lower n8n resource usage** (event-driven)
✅ **Guaranteed event delivery** (push-based)

### How It Works

```
SAP System               n8n Workflow
-----------              ------------
  Event
  occurs    ─────────>   Webhook
  (Create,               receives
   Update,               event
   Delete)
            HTTP POST
            ───────────> Triggers
                         workflow
```

---

## Quick Start

### 1. Add Webhook Trigger to Workflow

1. Create a new workflow in n8n
2. Add the **SAP OData Webhook** trigger node
3. Configure authentication (recommended: Header Auth)
4. Copy the webhook URL

### 2. Get Your Webhook URL

After adding the node, n8n generates a unique webhook URL:

```
https://your-n8n-instance.com/webhook/sap-odata-webhook-abc123
```

### 3. Configure SAP to Send Events

Configure your SAP system to send HTTP POST requests to this URL when events occur.

---

## Authentication

### Option 1: Header Authentication (Recommended)

**n8n Configuration:**
```
Authentication: Header Auth
Header Name: X-SAP-Signature
Header Value: your-secret-token-123
```

**SAP Must Send:**
```http
POST /webhook/sap-odata-webhook-abc123
Host: your-n8n-instance.com
Content-Type: application/json
X-SAP-Signature: your-secret-token-123

{
  "event": "created",
  "entityType": "SalesOrder",
  "data": { ... }
}
```

### Option 2: Query String Authentication

**n8n Configuration:**
```
Authentication: Query String
Query Parameter Name: token
Query Parameter Value: your-secret-token-123
```

**SAP Must Send:**
```http
POST /webhook/sap-odata-webhook-abc123?token=your-secret-token-123
Host: your-n8n-instance.com
Content-Type: application/json

{
  "event": "created",
  "entityType": "SalesOrder",
  "data": { ... }
}
```

### Option 3: No Authentication

⚠️ **Not recommended** for production! Only use for testing.

```
Authentication: None
```

---

## Event Filtering

Filter which events trigger your workflow to reduce unnecessary executions.

### Filter by Entity Type

Only trigger for specific SAP entities:

```
Event Filter: Specific Entity Type
Entity Type: SalesOrder, Material, Customer
```

This workflow will **only** trigger for events related to Sales Orders, Materials, or Customers.

### Filter by Operation

Only trigger for specific operations:

```
Event Filter: Specific Operation
Operation Type: Create, Update
```

This workflow will **only** trigger for create and update operations (not deletes).

### Combine Filters

For maximum precision, combine both filters:

```
Event Filter: Specific Entity Type + Operation
Entity Type: SalesOrder
Operation Type: Create
```

This workflow will **only** trigger when new Sales Orders are created.

---

## SAP Configuration

### Method 1: ABAP HTTP Client (Recommended)

Create a custom ABAP program to send webhook notifications:

```abap
*&---------------------------------------------------------------------*
*& Report  Z_SEND_ODATA_WEBHOOK
*&---------------------------------------------------------------------*
REPORT z_send_odata_webhook.

DATA: lo_http_client TYPE REF TO if_http_client,
      lv_url         TYPE string,
      lv_json        TYPE string,
      lv_response    TYPE string.

* Webhook URL from n8n
lv_url = 'https://your-n8n-instance.com/webhook/sap-odata-webhook-abc123'.

* Build JSON payload
lv_json = '{'                                 &&
          '  "event": "created",'             &&
          '  "entityType": "SalesOrder",'     &&
          '  "operation": "create",'          &&
          '  "entityKey": "0500000001",'      &&
          '  "timestamp": "2024-10-26T12:00:00Z",' &&
          '  "data": {'                       &&
          '    "SalesOrder": "0500000001",'   &&
          '    "SoldToParty": "0001000123",'  &&
          '    "NetAmount": "1250.00"'        &&
          '  }'                                &&
          '}'.

* Create HTTP client
cl_http_client=>create_by_url(
  EXPORTING
    url                = lv_url
  IMPORTING
    client             = lo_http_client
  EXCEPTIONS
    argument_not_found = 1
    plugin_not_active  = 2
    internal_error     = 3
    OTHERS             = 4 ).

IF sy-subrc <> 0.
  WRITE: / 'Error creating HTTP client'.
  RETURN.
ENDIF.

* Set HTTP method
lo_http_client->request->set_method( 'POST' ).

* Set content type
lo_http_client->request->set_content_type( 'application/json' ).

* Add authentication header
lo_http_client->request->set_header_field(
  name  = 'X-SAP-Signature'
  value = 'your-secret-token-123' ).

* Set request body
lo_http_client->request->set_cdata( lv_json ).

* Send request
lo_http_client->send(
  EXCEPTIONS
    http_communication_failure = 1
    http_invalid_state         = 2
    http_processing_failed     = 3
    OTHERS                     = 4 ).

IF sy-subrc <> 0.
  WRITE: / 'Error sending HTTP request'.
  lo_http_client->close( ).
  RETURN.
ENDIF.

* Receive response
lo_http_client->receive(
  EXCEPTIONS
    http_communication_failure = 1
    http_invalid_state         = 2
    http_processing_failed     = 3
    OTHERS                     = 4 ).

IF sy-subrc = 0.
  lv_response = lo_http_client->response->get_cdata( ).
  WRITE: / 'Webhook sent successfully'.
  WRITE: / 'Response:', lv_response.
ELSE.
  WRITE: / 'Error receiving response'.
ENDIF.

* Close connection
lo_http_client->close( ).
```

### Method 2: SAP Gateway Push Notifications

For SAP Gateway-based services, you can configure push notifications in transaction `/IWFND/MAINT_SERVICE`:

1. Go to transaction `/IWFND/MAINT_SERVICE`
2. Select your OData service
3. Go to "Push Notifications" tab
4. Configure webhook URL
5. Set authentication headers

### Method 3: Change Documents (CDHDR/CDPOS)

Monitor SAP change documents and send webhooks:

```abap
* Check for changes to material master
SELECT * FROM cdhdr
  WHERE objectclas = 'MATERIAL'
    AND udate = sy-datum
  INTO TABLE @DATA(lt_changes).

LOOP AT lt_changes INTO DATA(ls_change).
  * Send webhook for each change
  PERFORM send_webhook USING ls_change.
ENDLOOP.
```

---

## Testing

### Test with cURL

Send a test webhook from your command line:

```bash
curl -X POST https://your-n8n-instance.com/webhook/sap-odata-webhook-abc123 \
  -H "Content-Type: application/json" \
  -H "X-SAP-Signature: your-secret-token-123" \
  -d '{
    "event": "created",
    "entityType": "SalesOrder",
    "operation": "create",
    "entityKey": "0500000001",
    "timestamp": "2024-10-26T12:00:00Z",
    "data": {
      "SalesOrder": "0500000001",
      "SoldToParty": "0001000123",
      "NetAmount": "1250.00",
      "Currency": "EUR"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "received"
}
```

### Test with Postman

1. Create new POST request
2. Set URL: `https://your-n8n-instance.com/webhook/sap-odata-webhook-abc123`
3. Add header: `X-SAP-Signature: your-secret-token-123`
4. Set body type: `raw` (JSON)
5. Paste test JSON payload
6. Send request

### Test Event Payloads

#### Sales Order Created
```json
{
  "event": "created",
  "entityType": "SalesOrder",
  "operation": "create",
  "entityKey": "0500000001",
  "timestamp": "2024-10-26T12:00:00Z",
  "data": {
    "SalesOrder": "0500000001",
    "SoldToParty": "0001000123",
    "PurchaseOrderByCustomer": "PO-2024-001",
    "NetAmount": "1250.00",
    "Currency": "EUR",
    "SalesOrganization": "1000",
    "DistributionChannel": "10"
  }
}
```

#### Material Master Updated
```json
{
  "event": "updated",
  "entityType": "Material",
  "operation": "update",
  "entityKey": "MAT-123456",
  "timestamp": "2024-10-26T12:00:00Z",
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
    "MaterialDescription": "Sample Material",
    "Price": "95.00",
    "Currency": "EUR"
  }
}
```

#### Customer Deleted
```json
{
  "event": "deleted",
  "entityType": "Customer",
  "operation": "delete",
  "entityKey": "0001000123",
  "timestamp": "2024-10-26T12:00:00Z",
  "data": {
    "Customer": "0001000123",
    "CustomerName": "ACME Corp"
  }
}
```

---

## Use Cases

### Use Case 1: Sales Order Notifications

**Scenario:** Notify sales team immediately when new orders are created

```
SAP: New sales order created
  ↓ Webhook
n8n: Receive event
  ↓ Parse order details
Slack: Send notification to #sales channel
Email: Send confirmation to customer
Salesforce: Update opportunity
Database: Log order for analytics
```

### Use Case 2: Inventory Alerts

**Scenario:** Alert warehouse when stock falls below threshold

```
SAP: Material stock updated
  ↓ Webhook
n8n: Receive event
  ↓ Check stock level
  ↓ If below threshold:
SMS: Alert warehouse manager
Jira: Create replenishment ticket
Dashboard: Update real-time metrics
```

### Use Case 3: Price Change Tracking

**Scenario:** Track and sync material price changes

```
SAP: Material price changed
  ↓ Webhook
n8n: Detect price change
  ↓ Extract old/new price
PostgreSQL: Log price history
E-commerce API: Update product prices
Slack: Notify pricing team
```

### Use Case 4: Customer Master Sync

**Scenario:** Keep CRM synchronized with SAP customer data

```
SAP: Customer data updated
  ↓ Webhook
n8n: Receive customer changes
  ↓ Transform data format
Salesforce: Update account
HubSpot: Update contact
Database: Update master data
```

---

## Troubleshooting

### Webhook Not Triggering

**Check 1: Is workflow activated?**
- Webhook only works when workflow is active
- Check workflow status in top-right corner

**Check 2: Is authentication correct?**
- Verify header name matches exactly
- Verify token value matches exactly
- Check for extra spaces or hidden characters

**Check 3: Check n8n logs**
```bash
# Check n8n logs for webhook requests
docker logs n8n 2>&1 | grep webhook
```

### Authentication Errors (401)

**Problem:** SAP receives `401 Unauthorized` response

**Solutions:**
1. Check header name is correct (case-sensitive)
2. Verify token value matches exactly
3. Ensure SAP sends header with every request

**Test authentication:**
```bash
curl -X POST your-webhook-url \
  -H "X-SAP-Signature: wrong-token" \
  -d '{"test": true}'

# Should return 401 error
```

### Events Being Filtered

**Problem:** Webhook receives event but workflow doesn't trigger

**Check:**
1. Event Filter settings in node
2. Entity Type matches payload
3. Operation Type matches payload

**Debug:**
- Set Event Filter to "All Events"
- Check if workflow triggers
- If yes, adjust filters accordingly

### SAP Date Format Issues

**Problem:** SAP dates not parsing correctly

**Solution:** Enable "Parse SAP Date Formats" option

This converts:
```
/Date(1698336000000)/  →  2024-10-26T12:00:00.000Z
```

### IP Whitelist

**Problem:** Requests from SAP blocked

**Solution:** Add SAP system IP to whitelist

```
Options → IP Whitelist: 192.168.1.100,10.0.0.0/8
```

---

## Advanced Configuration

### Extract Changed Fields Only

When SAP sends both old and new values, extract only what changed:

```
Options → Extract Changed Fields Only: ✓
```

**Input:**
```json
{
  "oldValue": {"Price": "100.00", "Stock": "50"},
  "newValue": {"Price": "95.00", "Stock": "50"}
}
```

**Output:**
```json
{
  "changedFields": {
    "Price": {
      "old": "100.00",
      "new": "95.00"
    }
  }
}
```

### Custom Response Body

Return custom JSON response to SAP:

```json
{
  "status": "received",
  "processed": true,
  "timestamp": "2024-10-26T12:00:00Z",
  "workflow": "sales-order-processing"
}
```

### Validate Payload Format

Ensure incoming webhooks match SAP OData format:

```
Options → Validate SAP Payload Format: ✓
```

This checks for:
- OData V2 structure (`d` property)
- OData V4 structure (`value` property)
- Event metadata fields

---

## Security Best Practices

✅ **Always use authentication** (Header Auth or Query String)
✅ **Use HTTPS** for webhook URLs
✅ **Rotate tokens regularly** (every 90 days)
✅ **Use IP whitelist** when possible
✅ **Monitor failed authentication attempts**
✅ **Set up rate limiting** in n8n (if high volume)

---

## Next Steps

1. ✅ Configure webhook in n8n
2. ✅ Test with cURL or Postman
3. ✅ Implement SAP-side webhook sender
4. ✅ Test end-to-end flow
5. ✅ Add error handling in workflow
6. ✅ Monitor webhook executions
7. ✅ Document for your team

---

## Support

For issues or questions:
- Check [n8n community forum](https://community.n8n.io/)
- Review [SAP Gateway documentation](https://help.sap.com/viewer/product/SAP_GATEWAY/)
- Open GitHub issue for bugs

---

## Version History

- **v1.4.0**: Initial webhook trigger node release
  - Header and query string authentication
  - Entity type and operation filtering
  - SAP date format parsing
  - Changed field extraction
  - IP whitelist support
