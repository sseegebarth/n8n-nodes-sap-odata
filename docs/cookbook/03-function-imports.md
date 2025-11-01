# Function Imports

Execute SAP-specific business logic through OData function imports.

## What Are Function Imports?

Function imports are custom SAP functions exposed via OData. They allow you to:
- Execute complex business logic
- Call SAP BAPIs
- Trigger SAP workflows
- Perform calculations

## Basic Usage

```json
{
  "parameters": {
    "resource": "functionImport",
    "functionName": "GetSalesOrderDetails",
    "parameters": {
      "SalesOrderID": "4500000001",
      "IncludeItems": true
    }
  }
}
```

## HTTP Method Selection

Function imports use either GET or POST:

**GET** - Read operations
```
Function Name: GetCustomerBalance
HTTP Method: GET
Parameters in URL: Yes
```

**POST** - Write operations  
```
Function Name: CreateSalesOrder
HTTP Method: POST
Parameters in Body: Yes
```

Check `$metadata` for the correct method (`m:HttpMethod` attribute).

## Common Examples

### Example 1: Get Customer Balance

```json
{
  "parameters": {
    "resource": "functionImport",
    "functionName": "GetCustomerBalance",
    "httpMethod": "GET",
    "parameters": {
      "CustomerID": "0010000000"
    }
  }
}
```

### Example 2: Calculate Price

```json
{
  "parameters": {
    "resource": "functionImport",
    "functionName": "CalculatePrice",
    "httpMethod": "POST",
    "parameters": {
      "ProductID": "P-100",
      "Quantity": 5,
      "Currency": "EUR"
    }
  }
}
```

### Example 3: Trigger Workflow

```json
{
  "parameters": {
    "resource": "functionImport",
    "functionName": "TriggerApprovalWorkflow",
    "httpMethod": "POST",
    "parameters": {
      "DocumentID": "4500000001",
      "ApproverID": "USER001"
    }
  }
}
```

## Parameter Types

### String Parameters
```json
{
  "CustomerID": "0010000000",
  "Status": "A"
}
```

### Numeric Parameters
```json
{
  "Quantity": 10,
  "Price": 99.99
}
```

### Boolean Parameters
```json
{
  "IncludeItems": true,
  "CalculateTax": false
}
```

### Date Parameters
```json
{
  "FromDate": "2024-03-01",
  "ToDate": "2024-03-31"
}
```

## Dynamic Parameters

From previous node:
```javascript
{
  "SalesOrderID": "={{ $json.order_id }}",
  "Quantity": "={{ $json.quantity }}"
}
```

## Finding Function Imports

### Method 1: Auto-Discover
1. Select service in node
2. Resource: Function Import
3. Function Name dropdown shows all available functions

### Method 2: $metadata
Visit: `https://your-sap-system.com/sap/opu/odata/sap/YOUR_SERVICE/$metadata`

Look for:
```xml
<FunctionImport Name="GetCustomerBalance" 
                ReturnType="Edm.Decimal" 
                m:HttpMethod="GET">
  <Parameter Name="CustomerID" Type="Edm.String" />
</FunctionImport>
```

### Method 3: SAP Transaction
- `/IWFND/GW_CLIENT` - Gateway Client
- Test function imports here

## Best Practices

### 1. Check HTTP Method
```javascript
// ❌ Wrong method = 405 error
GET /CreateOrder

// ✅ Correct
POST /CreateOrder
```

### 2. Validate Parameters
```javascript
// ❌ Missing required parameter
{
  "Quantity": 5
}

// ✅ All required parameters
{
  "ProductID": "P-100",
  "Quantity": 5,
  "Currency": "EUR"
}
```

### 3. Handle Return Types
```javascript
// Function returns single value
$json.d.GetCustomerBalance

// Function returns collection
$json.d.results

// Function returns entity
$json.d
```

## Error Handling

Common errors:

| Error | Cause | Solution |
|-------|-------|----------|
| 404 | Function not found | Check name in $metadata |
| 405 | Wrong HTTP method | Check m:HttpMethod |
| 400 | Invalid parameters | Validate types/names |
| 500 | SAP function error | Check SAP logs (/IWFND/ERROR_LOG) |

## Complete Workflow Example

```json
{
  "nodes": [
    {
      "parameters": {
        "values": {
          "string": [
            {"name": "customer_id", "value": "0010000000"}
          ]
        }
      },
      "name": "Set Customer",
      "type": "n8n-nodes-base.set"
    },
    {
      "parameters": {
        "resource": "functionImport",
        "functionName": "GetCustomerBalance",
        "httpMethod": "GET",
        "parameters": {
          "CustomerID": "={{ $json.customer_id }}"
        }
      },
      "name": "Get Balance",
      "type": "n8n-nodes-sap-odata.sapOData"
    },
    {
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.Balance }}",
              "operation": "larger",
              "value2": 10000
            }
          ]
        }
      },
      "name": "High Balance?",
      "type": "n8n-nodes-base.if"
    }
  ]
}
```

---

**Next**: [Pagination](04-pagination.md) | **Previous**: [Filtering & Sorting](02-filtering-sorting.md)
