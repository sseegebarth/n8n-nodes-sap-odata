# Filtering & Sorting

Master advanced OData query capabilities to efficiently retrieve exactly the data you need.

## Table of Contents
- [$filter - Filter Results](#filter---filter-results)
- [$orderby - Sort Results](#orderby---sort-results)
- [$select - Choose Fields](#select---choose-fields)
- [$expand - Include Related Data](#expand---include-related-data)
- [$top & $skip - Limit Results](#top--skip---limit-results)
- [Combining Parameters](#combining-parameters)
- [Common Patterns](#common-patterns)

---

## $filter - Filter Results

Filter data on the server side (faster than filtering in n8n).

### Basic Comparison Operators

#### Equal (`eq`)
```
$filter: Status eq 'A'
$filter: SalesOrder eq '4500000001'
$filter: IsBlocked eq false
```

#### Not Equal (`ne`)
```
$filter: Status ne 'X'
$filter: CustomerGroup ne '01'
```

#### Greater Than (`gt`) / Greater or Equal (`ge`)
```
$filter: TotalNetAmount gt 1000
$filter: Quantity ge 10
$filter: CreatedAt gt datetime'2024-01-01T00:00:00'
```

####

 Less Than (`lt`) / Less or Equal (`le`)
```
$filter: Price lt 500
$filter: Discount le 0.15
```

### Logical Operators

#### AND
```
$filter: Status eq 'A' and TotalNetAmount gt 1000
$filter: Country eq 'DE' and City eq 'Berlin'
```

#### OR
```
$filter: Status eq 'A' or Status eq 'B'
$filter: CustomerGroup eq '01' or CustomerGroup eq '02'
```

#### NOT
```
$filter: not (Status eq 'X')
$filter: not (IsBlocked eq true)
```

### String Functions

#### substringof (Contains)
```
$filter: substringof('GmbH', OrganizationBPName1)
$filter: substringof('test', Email)
```

#### startswith
```
$filter: startswith(CustomerName, 'ACME')
$filter: startswith(SalesOrder, '45')
```

#### endswith
```
$filter: endswith(Email, '@example.com')
$filter: endswith(ProductID, '-EXT')
```

#### tolower / toupper
```
$filter: tolower(CustomerName) eq 'acme corp'
$filter: toupper(Status) eq 'ACTIVE'
```

### Date/Time Filters

```
$filter: CreatedAt gt datetime'2024-01-01T00:00:00'
$filter: OrderDate ge datetime'2024-03-01T00:00:00' and OrderDate le datetime'2024-03-31T23:59:59'
$filter: year(BirthDate) eq 1990
$filter: month(OrderDate) eq 3
```

### Node Configuration Examples

#### Example 1: Active Orders Above €1000
```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "options": {
      "$filter": "OverallSDProcessStatus eq 'A' and TotalNetAmount gt 1000"
    }
  }
}
```

#### Example 2: German Customers
```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_BusinessPartner",
    "options": {
      "$filter": "Country eq 'DE' and BusinessPartnerIsBlocked eq false"
    }
  }
}
```

#### Example 3: Orders This Month
```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "options": {
      "$filter": "CreatedAt ge datetime'2024-03-01T00:00:00' and CreatedAt le datetime'2024-03-31T23:59:59'"
    }
  }
}
```

#### Example 4: Search by Name
```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_BusinessPartner",
    "options": {
      "$filter": "substringof('ACME', OrganizationBPName1) or substringof('ACME', FirstName)"
    }
  }
}
```

---

## $orderby - Sort Results

Sort results by one or more fields.

### Syntax
```
$orderby: FieldName [asc|desc]
```

### Single Field Sort

#### Ascending (default)
```
$orderby: CustomerName
$orderby: CreatedAt asc
```

#### Descending
```
$orderby: TotalNetAmount desc
$orderby: OrderDate desc
```

### Multiple Field Sort
```
$orderby: Country asc, City asc
$orderby: Status asc, CreatedAt desc
$orderby: CustomerGroup asc, TotalNetAmount desc
```

### Node Configuration

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "options": {
      "$orderby": "SalesOrderDate desc",
      "$top": 10
    }
  }
}
```

**Result**: Latest 10 orders

---

## $select - Choose Fields

Reduce payload size and improve performance by selecting only needed fields.

### Syntax
```
$select: Field1,Field2,Field3
```

### Examples

#### Select Few Fields
```
$select: BusinessPartner,FirstName,LastName
$select: SalesOrder,SoldToParty,TotalNetAmount
```

#### Performance Comparison

```javascript
// ❌ Bad: Returns ~50 fields (slow, large payload)
{
  "operation": "getAll",
  "entitySet": "A_SalesOrder"
}

// ✅ Good: Returns only 4 fields (fast, small payload)
{
  "operation": "getAll",
  "entitySet": "A_SalesOrder",
  "options": {
    "$select": "SalesOrder,SoldToParty,TotalNetAmount,SalesOrderDate"
  }
}
```

**Performance Gain**: ~80% faster, ~90% less data

### Node Configuration

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_BusinessPartner",
    "options": {
      "$select": "BusinessPartner,OrganizationBPName1,Country,City"
    }
  }
}
```

---

## $expand - Include Related Data

Fetch related entities in a single request (avoids multiple round-trips).

### Syntax
```
$expand: NavigationProperty
$expand: Nav1,Nav2,Nav3
$expand: Nav1/SubNav
```

### Examples

#### Expand Single Navigation
```
$expand: ToItems
$expand: ToPartner
$expand: ToAddress
```

#### Expand Multiple
```
$expand: ToItems,ToPartner,ToAddress
```

#### Expand with Select
```
$expand: ToItems&$select: SalesOrder,SalesOrderDate&ToItems/$select: Material,Quantity
```

### Real-World Example: Sales Order with Items

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "get",
    "entitySet": "A_SalesOrder",
    "entityKey": "'4500000001'",
    "options": {
      "$expand": "to_Item",
      "$select": "SalesOrder,SoldToParty,TotalNetAmount"
    }
  }
}
```

**Response Structure**:
```json
{
  "SalesOrder": "4500000001",
  "SoldToParty": "0010000000",
  "TotalNetAmount": "5000.00",
  "to_Item": {
    "results": [
      {
        "SalesOrderItem": "10",
        "Material": "P-100",
        "Quantity": "5"
      },
      {
        "SalesOrderItem": "20",
        "Material": "P-200",
        "Quantity": "3"
      }
    ]
  }
}
```

### Performance Benefits

```javascript
// ❌ Bad: 2 requests
// Request 1: Get order
// Request 2: Get items

// ✅ Good: 1 request with $expand
{
  "$expand": "to_Item"
}
```

---

## $top & $skip - Limit Results

Control how many results to return and where to start.

### $top - Limit Results

```
$top: 10     → First 10 results
$top: 50     → First 50 results
$top: 100    → First 100 results
```

### $skip - Skip Results

```
$skip: 10    → Skip first 10, return rest
$skip: 50    → Skip first 50, return rest
```

### Pagination Pattern

```javascript
// Page 1 (results 1-10)
{ "$top": 10, "$skip": 0 }

// Page 2 (results 11-20)
{ "$top": 10, "$skip": 10 }

// Page 3 (results 21-30)
{ "$top": 10, "$skip": 20 }
```

### Node Configuration

```json
{
  "parameters": {
    "resource": "entity",
    "operation": "getAll",
    "entitySet": "A_SalesOrder",
    "returnAll": false,
    "limit": 20,
    "options": {
      "$skip": "={{ $json.page * 20 }}",
      "$orderby": "SalesOrderDate desc"
    }
  }
}
```

See [Pagination Guide](04-pagination.md) for advanced patterns.

---

## Combining Parameters

Combine multiple query parameters for powerful queries.

### Example 1: Top 10 Active Orders by Value

```json
{
  "options": {
    "$filter": "OverallSDProcessStatus eq 'A'",
    "$orderby": "TotalNetAmount desc",
    "$top": 10,
    "$select": "SalesOrder,SoldToParty,TotalNetAmount,SalesOrderDate"
  }
}
```

### Example 2: German Customers, Sorted, Limited

```json
{
  "options": {
    "$filter": "Country eq 'DE' and BusinessPartnerIsBlocked eq false",
    "$orderby": "OrganizationBPName1 asc",
    "$top": 50,
    "$select": "BusinessPartner,OrganizationBPName1,City"
  }
}
```

### Example 3: Order with Items (Last 30 Days)

```json
{
  "options": {
    "$filter": "CreatedAt ge datetime'2024-03-01T00:00:00'",
    "$expand": "to_Item",
    "$orderby": "CreatedAt desc",
    "$select": "SalesOrder,TotalNetAmount,CreatedAt"
  }
}
```

### Parameter Order (Best Practice)

```javascript
// Recommended order (readability)
{
  "$filter": "...",    // 1. Filter first (reduces dataset)
  "$orderby": "...",   // 2. Then sort
  "$select": "...",    // 3. Choose fields
  "$expand": "...",    // 4. Include related data
  "$top": 10,          // 5. Limit results
  "$skip": 0           // 6. Pagination
}
```

---

## Common Patterns

### Pattern 1: Search with Wildcard

```json
{
  "options": {
    "$filter": "substringof('{{ $json.search_term }}', OrganizationBPName1)",
    "$orderby": "OrganizationBPName1 asc",
    "$top": 20
  }
}
```

### Pattern 2: Date Range Query

```javascript
// Dynamic date range from n8n expression
{
  "$filter": "CreatedAt ge datetime'{{ $now.minus(30, 'days').toISO() }}' and CreatedAt le datetime'{{ $now.toISO() }}'"
}
```

### Pattern 3: Status-Based Filtering

```json
{
  "options": {
    "$filter": "Status eq 'A' or Status eq 'B' or Status eq 'C'",
    "$orderby": "Priority desc, CreatedAt desc"
  }
}
```

### Pattern 4: Multi-Criteria Search

```json
{
  "options": {
    "$filter": "(Country eq 'DE' or Country eq 'AT' or Country eq 'CH') and (CustomerGroup eq '01' or CustomerGroup eq '02')",
    "$orderby": "Country asc, CustomerName asc"
  }
}
```

### Pattern 5: Exclude Blocked/Deleted

```json
{
  "options": {
    "$filter": "IsBlocked eq false and IsMarkedForDeletion eq false",
    "$select": "BusinessPartner,OrganizationBPName1,Country"
  }
}
```

---

## Troubleshooting

### Error: "Invalid filter expression"

**Cause**: Syntax error in $filter

**Solution**:
- Check operator spelling (`eq` not `==`)
- String values need single quotes: `'value'`
- DateTime needs prefix: `datetime'2024-03-01T00:00:00'`

### Error: "Property not found"

**Cause**: Field name doesn't exist in entity

**Solution**:
- Check `/$metadata` for correct field names
- SAP fields are case-sensitive
- Use Auto-Discover to see available fields

### Filter Not Working

**Cause**: Client-side filter instead of server-side

**Solution**:
```javascript
// ❌ Wrong: This is JavaScript (runs in n8n)
if ($json.Status === 'A') { ... }

// ✅ Correct: This is OData (runs on SAP server)
{
  "$filter": "Status eq 'A'"
}
```

---

## Performance Tips

### 1. Always Use $filter
```javascript
// ❌ Bad: Fetch all, filter in n8n
GET /A_SalesOrder
// Then filter in n8n

// ✅ Good: Filter on server
GET /A_SalesOrder?$filter=Status eq 'A'
```

### 2. Use $select
```javascript
// ❌ Bad: 50 fields, 500KB response
GET /A_SalesOrder

// ✅ Good: 4 fields, 50KB response
GET /A_SalesOrder?$select=SalesOrder,SoldToParty,TotalNetAmount,SalesOrderDate
```

### 3. Limit with $top
```javascript
// ❌ Bad: Returns 10,000 results
GET /A_SalesOrder

// ✅ Good: Returns 100 results
GET /A_SalesOrder?$top=100
```

### 4. Order Matters
```javascript
// ✅ Best: Filter reduces dataset first
$filter → $orderby → $select → $top

// ❌ Worst: Server sorts/selects more data
$orderby → $select → $filter → $top
```

---

## Next Steps

- **[Function Imports](03-function-imports.md)** - Execute SAP business logic
- **[Pagination](04-pagination.md)** - Handle large datasets efficiently
- **[Basic Operations](01-basic-operations.md)** - Review CRUD fundamentals

---

**Questions?** Check the [main README](README.md) or [open an issue](https://github.com/yourusername/n8n-nodes-sap-odata/issues).
