# Basic Operations (CRUD)

Learn the fundamental Create, Read, Update, and Delete operations for SAP OData entities.

## Table of Contents
- [Get Single Entity](#get-single-entity)
- [Get Multiple Entities](#get-multiple-entities)
- [Create Entity](#create-entity)
- [Update Entity](#update-entity)
- [Delete Entity](#delete-entity)
- [Best Practices](#best-practices)

---

## Get Single Entity

Retrieve a single entity by its key.

### Use Case
- Fetch specific customer details
- Retrieve one sales order
- Get product information by ID

### Node Configuration

```
Service Path Mode: Auto-Discover
Service: Business Partner API (API_BUSINESS_PARTNER)
Resource: Entity
Operation: Get
Entity Set Mode: From List
Entity Set: A_BusinessPartner
Entity Key: '0010000000'
```

### n8n Workflow JSON

```json
{
  "nodes": [
    {
      "parameters": {
        "servicePathMode": "discover",
        "discoveredService": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/",
        "resource": "entity",
        "operation": "get",
        "entitySetMode": "list",
        "entitySet": "A_BusinessPartner",
        "entityKey": "'0010000000'"
      },
      "name": "Get Business Partner",
      "type": "n8n-nodes-sap-odata.sapOData",
      "typeVersion": 1,
      "position": [250, 300]
    }
  ]
}
```

### Entity Key Formats

SAP OData uses different key formats:

#### String Keys (Most Common)
```javascript
'0010000000'           // BusinessPartner
'A'                    // Status codes
'CUST001'              // Custom IDs
```
**Rule**: Wrap in **single quotes**

#### Numeric Keys
```javascript
123                    // Numeric IDs
1234567890            // Large numbers
```
**Rule**: **No quotes**

#### Composite Keys
```javascript
SalesOrder='4500000001',ItemNo='10'
ProductID='P123',Year=2024
```
**Rule**: Combine with commas, strings in quotes

### Dynamic Keys from Previous Nodes

```javascript
// From previous node output
{{ $json.BusinessPartner }}

// With quotes (for string keys)
'{{ $json.BusinessPartner }}'

// Multiple items
{{ $item(0).$node["Get Customers"].json.CustomerID }}
```

### Example: Get Customer by ID

**Scenario**: Fetch customer details from previous workflow step

```json
{
  "nodes": [
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "customer_id",
              "value": "0010000123"
            }
          ]
        }
      },
      "name": "Set Customer ID",
      "type": "n8n-nodes-base.set",
      "position": [250, 300]
    },
    {
      "parameters": {
        "servicePathMode": "discover",
        "discoveredService": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/",
        "resource": "entity",
        "operation": "get",
        "entitySet": "A_BusinessPartner",
        "entityKey": "='{{ $json.customer_id }}'"
      },
      "name": "Get Customer Details",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [450, 300]
    }
  ]
}
```

---

## Get Multiple Entities

Retrieve multiple entities (entity set).

### Use Case
- List all open sales orders
- Get all products
- Fetch customer list

### Node Configuration

```
Resource: Entity
Operation: Get All
Entity Set: A_SalesOrder
Return All: false
Limit: 50
```

### Basic Query

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "returnAll": false,
    "limit": 50
  }
}
```

### With Select (Choose Fields)

```
Options:
  $select: SalesOrder,SoldToParty,TotalNetAmount,SalesOrderDate
```

**Result**: Only specified fields returned (faster, less data)

### Example: Get Open Orders

```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "entity",
        "operation": "getAll",
        "entitySet": "A_SalesOrder",
        "returnAll": false,
        "limit": 100,
        "options": {
          "$select": "SalesOrder,SoldToParty,TotalNetAmount,TransactionCurrency",
          "$filter": "OverallSDProcessStatus eq 'A'",
          "$orderby": "SalesOrderDate desc"
        }
      },
      "name": "Get Open Sales Orders",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [250, 300]
    }
  ]
}
```

### Return All vs Limit

| Return All | Limit | Use Case |
|------------|-------|----------|
| `true` | N/A | Small datasets (<1000 items) |
| `false` | 50 | Default - good performance |
| `false` | 500 | Large queries (may be slow) |

⚠️ **Warning**: `returnAll: true` can timeout on large datasets. See [Pagination](04-pagination.md) for better approaches.

---

## Create Entity

Create a new entity in an entity set.

### Use Case
- Create new business partner
- Post new sales order
- Add product

### Node Configuration

```
Resource: Entity
Operation: Create
Entity Set: A_BusinessPartner
Data: { JSON object }
```

### Example: Create Business Partner

```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "entity",
        "operation": "create",
        "entitySet": "A_BusinessPartner",
        "data": {
          "BusinessPartnerCategory": "1",
          "BusinessPartnerGrouping": "0001",
          "FirstName": "John",
          "LastName": "Doe",
          "OrganizationBPName1": "ACME Corporation",
          "BusinessPartnerIsBlocked": false
        }
      },
      "name": "Create Business Partner",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [250, 300]
    }
  ]
}
```

### Field Requirements

Check SAP API documentation for:
- **Required fields** (marked with `Nullable="false"` in `$metadata`)
- **Field types** (Edm.String, Edm.Decimal, Edm.DateTime)
- **Max lengths** (MaxLength attribute)

### Data Types

#### String
```json
{
  "FirstName": "John",
  "LastName": "Doe"
}
```

#### Number
```json
{
  "TotalNetAmount": 1234.56,
  "Quantity": 10
}
```

#### Boolean
```json
{
  "IsBlocked": false,
  "IsMarkedForDeletion": false
}
```

#### Date/DateTime
```json
{
  "BirthDate": "1990-01-15T00:00:00",
  "CreatedAt": "2024-03-15T14:30:00"
}
```

### Dynamic Data from Previous Node

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "create",
    "entitySet": "A_BusinessPartner",
    "data": "={{ $json }}"
  }
}
```

**Expression**:
```javascript
{
  "FirstName": "{{ $json.first_name }}",
  "LastName": "{{ $json.last_name }}",
  "OrganizationBPName1": "{{ $json.company_name }}"
}
```

### Example: Create Customer from Webhook

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "create-customer",
        "responseMode": "responseNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "entity",
        "operation": "create",
        "entitySet": "A_BusinessPartner",
        "data": {
          "BusinessPartnerCategory": "={{ $json.body.type }}",
          "FirstName": "={{ $json.body.first_name }}",
          "LastName": "={{ $json.body.last_name }}",
          "BusinessPartnerIsBlocked": false
        }
      },
      "name": "Create in SAP",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [450, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { success: true, businessPartner: $json.BusinessPartner } }}"
      },
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [650, 300]
    }
  ]
}
```

---

## Update Entity

Update an existing entity (partial update with PATCH).

### Use Case
- Update customer address
- Change order status
- Modify product price

### Node Configuration

```
Resource: Entity
Operation: Update
Entity Set: A_BusinessPartner
Entity Key: '0010000000'
Data: { fields to update }
```

### Example: Update Customer

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "update",
    "entitySet": "A_BusinessPartner",
    "entityKey": "'0010000123'",
    "data": {
      "OrganizationBPName1": "ACME Corporation Ltd.",
      "BusinessPartnerIsBlocked": false
    }
  }
}
```

### Partial Update (PATCH)

Only include fields you want to change:

```json
{
  "data": {
    "BusinessPartnerIsBlocked": true
  }
}
```

✅ **Advantage**: Other fields remain unchanged

### Update with ETag (Optimistic Locking)

SAP uses ETags to prevent concurrent update conflicts:

```
Advanced Options:
  If-Match: W/"20240315143000"
```

**How to get ETag:**
1. Read entity first (GET)
2. Extract `__metadata.etag` from response
3. Use in update

```javascript
// Expression for If-Match
{{ $json.__metadata.etag }}
```

### Example: Conditional Update

```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "entity",
        "operation": "get",
        "entitySet": "A_SalesOrder",
        "entityKey": "'4500000001'"
      },
      "name": "Read Order",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "entity",
        "operation": "update",
        "entitySet": "A_SalesOrder",
        "entityKey": "'4500000001'",
        "data": {
          "OverallSDProcessStatus": "C"
        },
        "advancedOptions": {
          "ifMatch": "={{ $json.__metadata.etag }}"
        }
      },
      "name": "Update Order Status",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [450, 300]
    }
  ]
}
```

### Handling Update Errors

Common errors:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 404 | Entity not found | Check entity key |
| 412 | ETag mismatch | Re-read entity, get new ETag |
| 400 | Invalid data | Check field names/types |
| 403 | No authorization | Check SAP authorizations |

---

## Delete Entity

Delete an entity from the system.

### Use Case
- Remove obsolete data
- Cancel draft orders
- Clean up test data

### Node Configuration

```
Resource: Entity
Operation: Delete
Entity Set: A_BusinessPartner
Entity Key: '0010000000'
```

### Example: Delete Entity

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "delete",
    "entitySet": "A_BusinessPartner",
    "entityKey": "'0010000123'"
  }
}
```

### Delete with ETag

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "delete",
    "entitySet": "A_SalesOrder",
    "entityKey": "'4500000001'",
    "advancedOptions": {
      "ifMatch": "={{ $json.__metadata.etag }}"
    }
  }
}
```

### Bulk Delete

Use **Loop** or **Split In Batches** node:

```json
{
  "nodes": [
    {
      "parameters": {
        "resource": "entity",
        "operation": "getAll",
        "entitySet": "A_SalesOrder",
        "options": {
          "$filter": "OverallSDProcessStatus eq 'X'"
        }
      },
      "name": "Get Orders to Delete",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "entity",
        "operation": "delete",
        "entitySet": "A_SalesOrder",
        "entityKey": "={{ $json.SalesOrder }}"
      },
      "name": "Delete Order",
      "type": "n8n-nodes-sap-odata.sapOData",
      "position": [450, 300]
    }
  ]
}
```

⚠️ **Warning**: Be careful with bulk deletes. Test with small batches first.

---

## Best Practices

### 1. Always Use Auto-Discover

```
✅ Service Path Mode: Auto-Discover
✅ Entity Set Mode: From List
❌ Manual path entry (error-prone)
```

### 2. Use $select for Performance

```javascript
// ❌ Bad: Fetches all fields (slow, large payload)
{
  "operation": "getAll",
  "entitySet": "A_SalesOrder"
}

// ✅ Good: Only needed fields
{
  "operation": "getAll",
  "entitySet": "A_SalesOrder",
  "options": {
    "$select": "SalesOrder,SoldToParty,TotalNetAmount"
  }
}
```

### 3. Handle Errors Gracefully

Use **Error Trigger** workflow or set **Continue on Fail**:

```json
{
  "continueOnFail": true
}
```

### 4. Use ETag for Updates

```javascript
// ✅ Prevents concurrent update conflicts
{
  "advancedOptions": {
    "ifMatch": "={{ $json.__metadata.etag }}"
  }
}
```

### 5. Test in Sandbox First

- ✅ Create test data with prefix "TEST_"
- ✅ Use SAP Client for testing (e.g., 300)
- ✅ Verify with SAP GUI before production

### 6. Use Meaningful Names

```javascript
// ❌ Bad
"SAP OData"
"SAP Node 1"

// ✅ Good
"Get Customer Details"
"Create Sales Order"
"Update Product Price"
```

---

## Next Steps

- **[Filtering & Sorting](02-filtering-sorting.md)** - Advanced queries
- **[Function Imports](03-function-imports.md)** - Execute SAP functions
- **[Error Handling](05-error-handling.md)** - Production-ready workflows

---

**Questions?** Check the [main README](README.md) or [open an issue](https://github.com/yourusername/n8n-nodes-sap-odata/issues).
