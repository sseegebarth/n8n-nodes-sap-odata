# Public OData Services for Testing

This document lists publicly available OData services that you can use to test the SAP OData node without authentication.

## SAP Gateway Demo System (ES5)

SAP provides a public Gateway Demo System (ES5) for testing purposes. While it requires registration, it's freely accessible.

### Registration
1. Visit: https://register.sapdevcenter.com/
2. Register for the ES5 Gateway Demo System
3. You'll receive credentials via email

### Connection Details
```
Host: https://sapes5.sapdevcenter.com
Service Path: /sap/opu/odata/iwbep/GWSAMPLE_BASIC/
Authentication: Basic Auth (use your registered credentials)
```

### Available Entity Sets
- `BusinessPartnerSet` - Business partners
- `ProductSet` - Products
- `SalesOrderSet` - Sales orders
- `ContactSet` - Contacts

### Example Query
```
Entity Set: ProductSet
$select: ProductID,Name,Price,CurrencyCode
$filter: Price gt 100
$orderby: Name
```

## OData.org Public Services

These services are completely public and require no authentication.

### Northwind OData V2 Service

```
Host: https://services.odata.org
Service Path: /V2/Northwind/Northwind.svc/
Authentication: None
```

**Available Entity Sets:**
- `Categories` - Product categories
- `Products` - Products with details
- `Suppliers` - Suppliers information
- `Customers` - Customer data
- `Orders` - Order information
- `Order_Details` - Order line items
- `Employees` - Employee records
- `Regions` - Geographic regions

**Example Queries:**

Get expensive products:
```
Entity Set: Products
$select: ProductID,ProductName,UnitPrice,UnitsInStock
$filter: UnitPrice gt 50
$orderby: UnitPrice desc
```

Get customers from Germany:
```
Entity Set: Customers
$select: CustomerID,CompanyName,ContactName,City
$filter: Country eq 'Germany'
```

Get orders with details:
```
Entity Set: Orders
$select: OrderID,CustomerID,OrderDate,ShipCity
$expand: Order_Details
$top: 10
```

### Northwind OData V4 Service

```
Host: https://services.odata.org
Service Path: /V4/Northwind/Northwind.svc/
Authentication: None
```

Same entity sets as V2, but using OData V4 protocol features.

### TripPin OData Service (V4)

```
Host: https://services.odata.org
Service Path: /V4/TripPinServiceRW/
Authentication: None
```

**Available Entity Sets:**
- `People` - Person records
- `Airlines` - Airline information
- `Airports` - Airport data
- `Trips` - Trip records
- `PlanItems` - Plan items

**Example Queries:**

Get all people:
```
Entity Set: People
$select: UserName,FirstName,LastName,Emails
```

Get airlines:
```
Entity Set: Airlines
$select: AirlineCode,Name
```

## SAP API Business Hub

SAP provides sandbox environments for various APIs in the API Business Hub.

### Access
1. Visit: https://api.sap.com/
2. Browse available APIs
3. Many APIs offer sandbox access without authentication
4. Some require API key (free registration)

### Popular Services

#### Product Master (Sandbox)
```
Host: https://sandbox.api.sap.com
Service Path: /s4hanacloud/sap/opu/odata/sap/API_PRODUCT_SRV/
Authentication: API Key (register on api.sap.com)
```

#### Business Partner (Sandbox)
```
Host: https://sandbox.api.sap.com
Service Path: /s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER/
Authentication: API Key (register on api.sap.com)
```

## Testing Tips

### For Public Services (No Auth)
1. Set Authentication to "None" in credentials
2. Verify the service path ends with `/` if required
3. Start with simple queries without filters
4. Check service metadata: `$metadata`

### Service Metadata
To explore available entities and properties, append `$metadata` to the service path:
```
https://services.odata.org/V2/Northwind/Northwind.svc/$metadata
```

### Testing Workflow
1. **Step 1**: Test connection with a simple GET
   - Entity Set: Choose any available entity
   - Operation: Get All
   - Options: $top: 1

2. **Step 2**: Explore data structure
   - Remove $top limit
   - Add $select to see specific fields

3. **Step 3**: Add filters and sorting
   - Use $filter for data filtering
   - Use $orderby for sorting
   - Use $expand for related entities

## Common Issues

### CORS Errors
Some public services may have CORS restrictions when accessed from browser-based tools. n8n server-side execution should not have this issue.

### Rate Limiting
Public services may have rate limits. If you encounter errors:
- Add delays between requests
- Reduce the number of returned items ($top)
- Use $skip and $top for pagination

### Service Availability
Public demo services may occasionally be unavailable for maintenance. Always have a backup service for testing.

## n8n Configuration Examples

### Example 1: Northwind Products
```json
{
  "credentials": {
    "host": "https://services.odata.org",
    "servicePath": "/V2/Northwind/Northwind.svc/",
    "authentication": "none"
  },
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "Products",
    "returnAll": false,
    "limit": 20,
    "options": {
      "select": "ProductID,ProductName,UnitPrice",
      "filter": "Discontinued eq false",
      "orderby": "ProductName"
    }
  }
}
```

### Example 2: TripPin People
```json
{
  "credentials": {
    "host": "https://services.odata.org",
    "servicePath": "/V4/TripPinServiceRW/",
    "authentication": "none"
  },
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "People",
    "returnAll": true,
    "options": {
      "select": "UserName,FirstName,LastName"
    }
  }
}
```

## Resources

- [OData.org Services](https://www.odata.org/odata-services/)
- [SAP Gateway Demo System](https://developers.sap.com/tutorials/gateway-demo-signup.html)
- [SAP API Business Hub](https://api.sap.com/)
- [OData Protocol Documentation](https://www.odata.org/documentation/)

## Contributing

If you know of other public OData services suitable for testing, please contribute by adding them to this list!
