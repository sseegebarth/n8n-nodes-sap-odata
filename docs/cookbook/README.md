# SAP OData API Cookbook

Welcome to the SAP OData API Cookbook! This guide provides practical, copy-paste-ready examples for working with SAP systems via OData in n8n.

## 📚 Table of Contents

1. **[Basic Operations](01-basic-operations.md)** - CRUD operations (Create, Read, Update, Delete)
2. **[Filtering & Sorting](02-filtering-sorting.md)** - Advanced queries with `$filter`, `$orderby`, `$top`, `$skip`
3. **[Function Imports](03-function-imports.md)** - Execute SAP-specific function imports
4. **[Pagination](04-pagination.md)** - Handle large datasets with server-driven paging
5. **[Error Handling](05-error-handling.md)** - Robust error handling and retry strategies
6. **[Monitoring](06-monitoring.md)** - Performance tracking and workflow monitoring

---

## 🚀 Getting Started

### Prerequisites

Before using these examples, ensure you have:

1. **n8n installed** - Version 1.0.0 or higher
2. **SAP OData node installed** - `npm install n8n-nodes-sap-odata`
3. **SAP credentials configured** - Host, Username, Password, SAP Client
4. **Network access** - Your n8n instance can reach the SAP system

### Quick Test

Verify your setup with this simple workflow:

1. Add SAP OData node
2. Configure credentials
3. Service Path Mode: **Auto-Discover**
4. Resource: **Entity**
5. Operation: **Get All**
6. Entity Set: Select any entity (e.g., "A_BusinessPartner")
7. Click **Execute Node**

✅ If you see data, you're ready to go!

---

## 💡 How to Use This Cookbook

Each guide includes:
- 📖 **Concept explanation** - What the feature does and when to use it
- 💻 **Code examples** - Copy-paste-ready n8n node configurations
- 🎯 **Real-world scenarios** - Practical use cases
- ⚠️ **Common pitfalls** - What to avoid
- 🔍 **Troubleshooting** - Solutions to common issues

### Example Format

Examples are provided in three formats:

#### 1. Node Configuration (UI)
```
Resource: Entity
Operation: Get All
Entity Set: A_BusinessPartner
Options:
  $filter: BusinessPartnerCategory eq '1'
  $top: 10
```

#### 2. JSON (Workflow)
```json
{
  "nodes": [{
    "parameters": {
      "resource": "entity",
      "operation": "getAll",
      "entitySet": "A_BusinessPartner"
    },
    "type": "n8n-nodes-sap-odata.sapOData"
  }]
}
```

#### 3. Expression (Dynamic Values)
```javascript
// In n8n expressions
$json["customer_id"]
{{ $json.customer_id }}
```

---

## 🎓 Learning Path

### Beginner
Start here if you're new to SAP OData:
1. [Basic Operations](01-basic-operations.md) - Learn CRUD
2. [Filtering & Sorting](02-filtering-sorting.md) - Query data effectively

### Intermediate
You know the basics, now level up:
3. [Function Imports](03-function-imports.md) - SAP business logic
4. [Pagination](04-pagination.md) - Handle large datasets

### Advanced
Production-ready workflows:
5. [Error Handling](05-error-handling.md) - Resilient workflows
6. [Monitoring](06-monitoring.md) - Performance optimization

---

## 📋 Common SAP Services

### SAP S/4HANA Cloud APIs (Most Popular)

| API Name | Technical Name | Entity Sets | Use Case |
|----------|---------------|-------------|----------|
| **Business Partner API** | `API_BUSINESS_PARTNER` | A_BusinessPartner, A_Customer, A_Supplier | Customer/Vendor management |
| **Sales Order API** | `API_SALES_ORDER_SRV` | A_SalesOrder, A_SalesOrderItem | Order processing |
| **Purchase Order API** | `API_PURCHASEORDER_PROCESS_SRV` | A_PurchaseOrder, A_PurchaseOrderItem | Procurement |
| **Product Master API** | `API_PRODUCT_SRV` | A_Product, A_ProductDescription | Product data |
| **Material Document API** | `API_MATERIAL_DOCUMENT_SRV` | A_MaterialDocumentHeader | Inventory movements |
| **Invoice API** | `API_BILLING_DOCUMENT_SRV` | A_BillingDocument | Billing/Invoicing |
| **Delivery API** | `API_OUTBOUND_DELIVERY_SRV` | A_OutbDeliveryHeader | Shipping |

💡 **Tip**: Use **Auto-Discover** mode to see all available services in your SAP system!

---

## 🔧 SAP System Configuration

### Required SAP Authorizations

Your SAP user needs these authorization objects:

```
S_SERVICE    - Gateway Service Groups
S_ICF        - Internet Communication Framework
S_TABU_DIS   - Table Maintenance (for data access)
```

**Specific to API:**
- Business Partner: Authorization object `F_BUPA_ALL`
- Sales Order: Authorization object `V_VBAK_VKO`
- Purchase Order: Authorization object `M_EINK_EKO`

💡 **Ask your SAP Basis team** if you get "403 Forbidden" errors.

### Required SAP Services

Ensure these services are active in transaction `SICF`:

```
/sap/opu/odata/          → OData Gateway
/sap/opu/odata/IWFND/    → Gateway Catalog Service
/sap/bc/srt/             → Service Runtime
```

### Gateway Service Activation

Activate your OData service in transaction `/IWFND/MAINT_SERVICE`:
1. Go to transaction `/IWFND/MAINT_SERVICE`
2. Click "Add Service"
3. System Alias: `LOCAL`
4. Search for your service (e.g., `API_BUSINESS_PARTNER`)
5. Click "Add Selected Services"

---

## 🎯 Quick Reference

### OData Query Options

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `$filter` | Filter results | `Status eq 'A'` |
| `$select` | Choose fields | `Name,Price,Description` |
| `$orderby` | Sort results | `CreatedAt desc` |
| `$top` | Limit results | `10` |
| `$skip` | Skip results | `20` |
| `$expand` | Include related data | `ToItems,ToPartner` |
| `$count` | Get total count | `true` |
| `$format` | Response format | `json` |

### Filter Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | Equal | `Status eq 'A'` |
| `ne` | Not equal | `Status ne 'X'` |
| `gt` | Greater than | `Price gt 100` |
| `ge` | Greater or equal | `Price ge 100` |
| `lt` | Less than | `Price lt 1000` |
| `le` | Less or equal | `Price le 1000` |
| `and` | Logical AND | `Status eq 'A' and Price gt 100` |
| `or` | Logical OR | `Status eq 'A' or Status eq 'B'` |

### String Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `substringof` | Contains | `substringof('Bike', Name)` |
| `startswith` | Starts with | `startswith(Name, 'B')` |
| `endswith` | Ends with | `endswith(Name, 'bike')` |
| `tolower` | Lowercase | `tolower(Name) eq 'bicycle'` |
| `toupper` | Uppercase | `toupper(Name) eq 'BICYCLE'` |

---

## 🐛 Common Issues

### "Service not found" (404)
- ✅ Check service path in SAP Gateway (`/IWFND/MAINT_SERVICE`)
- ✅ Verify service is activated
- ✅ Use **Auto-Discover** to see available services

### "Unauthorized" (401)
- ✅ Verify username/password
- ✅ Check SAP Client number
- ✅ Test with SAP GUI or Postman first

### "Forbidden" (403)
- ✅ Check user authorizations in SAP
- ✅ Contact SAP Basis for authorization objects
- ✅ Verify service group authorizations

### "Metadata not found"
- ✅ Switch to **Custom** mode for entity sets
- ✅ Check `/$metadata` endpoint access
- ✅ Verify network connectivity

### "CSRF token validation failed"
- ✅ Node handles this automatically
- ✅ Check if credentials are correct
- ✅ Verify SSL settings

---

## 📖 Additional Resources

### SAP Documentation
- [SAP API Business Hub](https://api.sap.com/) - Official API documentation
- [OData V2 Specification](https://www.odata.org/documentation/odata-version-2-0/) - Protocol standard
- [SAP Gateway Developer Guide](https://help.sap.com/docs/SAP_GATEWAY) - Technical deep-dive

### n8n Resources
- [n8n Documentation](https://docs.n8n.io/) - Workflow automation
- [n8n Community Forum](https://community.n8n.io/) - Get help
- [n8n Workflow Templates](https://n8n.io/workflows/) - Example workflows

### This Project
- [GitHub Repository](https://github.com/yourusername/n8n-nodes-sap-odata) - Source code
- [Issue Tracker](https://github.com/yourusername/n8n-nodes-sap-odata/issues) - Report bugs
- [Changelog](../../README.md#version-history) - Version history

---

## 🤝 Contributing

Found an error or have a great example? Contributions welcome!

1. Fork the repository
2. Add your example to the appropriate guide
3. Submit a pull request

**Guidelines:**
- Keep examples simple and focused
- Test examples before submitting
- Include explanatory comments
- Follow existing formatting

---

## 📝 License

This documentation is part of the n8n-nodes-sap-odata project and is licensed under MIT.

---

**Ready to start?** → [Basic Operations](01-basic-operations.md)
