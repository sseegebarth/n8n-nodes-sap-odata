# n8n-nodes-sap-odata

This is an n8n community node that lets you interact with SAP systems via OData services in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Table of Contents

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Compatibility](#compatibility)
- [Security](#security)
- [Usage](#usage)
- [Examples](#examples)
- [Performance](#performance)
- [Resources](#resources)
- [Version History](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Using npm

```bash
npm install n8n-nodes-sap-odata
```

### Manual Installation

1. Navigate to your n8n installation directory
2. Go to `~/.n8n/nodes` (create if it doesn't exist)
3. Clone or copy this repository into that directory
4. Restart n8n

## Operations

This node supports the following operations:

### Entity Operations

- **Create**: Create a new entity in an entity set
- **Delete**: Delete an existing entity
- **Get**: Retrieve a single entity by key
- **Get All**: Retrieve multiple entities with optional filtering
- **Update**: Update an existing entity

### Function Import

- Execute SAP function imports with parameters

## Credentials

This node supports multiple authentication methods for connecting to SAP OData services:

### General Settings
- **Host**: Your SAP system URL (e.g., `https://your-sap-system.com`)
- **Service Path**: OData service path (e.g., `/sap/opu/odata/sap/`)

### Authentication Options

#### None (Public Services)
- **Use Case**: For connecting to public OData services that don't require authentication
- **Configuration**: Simply select "None" as authentication method
- **Example**: Public demo services or open data endpoints

#### Basic Authentication
- **Username**: SAP username
- **Password**: SAP password
- **Use Case**: Most common authentication method for SAP systems


### Additional Options
- **Ignore SSL Issues**: Enable for self-signed certificates (not recommended for production)
- **SAP Client**: SAP Client number (Mandant) - e.g., 100, 200, 300
- **SAP Language**: SAP language code - e.g., EN, DE, FR, ES
- **Custom Headers**: Additional HTTP headers as JSON object
- **Test Connection**: Click to validate your SAP connection and credentials

## Compatibility

- Tested with n8n version 1.0.0+
- Compatible with SAP Gateway OData V2 and V4
- Works with SAP S/4HANA, SAP ECC, and SAP Business Suite

## Security

This node implements comprehensive security features to protect against common attacks:

### Implemented Protections

- **SSRF Prevention**: Blocks access to localhost, private IPs, and cloud metadata endpoints
- **SQL Injection**: Validates entity keys, names, and filters
- **XSS Prevention**: Filters dangerous patterns in OData filters
- **Prototype Pollution**: Blocks dangerous JavaScript object keys (__proto__, constructor)
- **Header Injection**: Sanitizes all HTTP header values
- **DoS Protection**: Limits JSON size (10MB) and nesting depth (100 levels)
- **Rate Limiting**: Configurable request rate limiting
- **Credential Masking**: Automatic sanitization in logs and error messages

### Security Best Practices

✅ **Always use HTTPS** in production environments
✅ **Enable SSL certificate validation** (disable `allowUnauthorizedCerts`)
✅ **Use service accounts** with minimal required permissions
✅ **Rotate credentials** regularly
✅ **Monitor activity** via SAP transaction logs (/IWFND/ERROR_LOG)

For detailed security documentation, see [SECURITY.md](SECURITY.md)

### Reporting Security Issues

Please report security vulnerabilities via [GitHub Security Advisories](https://github.com/your-repo/security/advisories/new) - **do not** create public issues.

## Usage

### Understanding Operations and HTTP Methods

This node maps n8n operations to the appropriate HTTP methods used by OData services:

| n8n Operation | HTTP Method | OData Action | Use Case |
|--------------|-------------|--------------|----------|
| **Get** | GET | Read single entity | Retrieve one entity by key |
| **Get All** | GET | Query entity set | Retrieve multiple entities with filters |
| **Create** | POST | Create entity | Add new entity to collection |
| **Update** | PATCH | Update entity | Modify existing entity (partial update) |
| **Delete** | DELETE | Delete entity | Remove entity from collection |
| **Function Import** | GET or POST | Execute function | Call custom SAP function (configurable) |

**Important Notes:**
- **GET vs POST for Function Imports:** SAP OData services use both methods. Select based on the function definition in `$metadata` (look for `m:HttpMethod` attribute)
- **PATCH vs PUT:** This node uses PATCH for partial updates (only changed fields), which is the recommended approach for OData
- **CSRF Tokens:** Automatically handled for write operations (POST, PATCH, DELETE)

### Basic Entity Query

1. Add the SAP OData node to your workflow
2. Select "Entity" as the resource
3. Choose "Get All" operation
4. Select entity set name:
   - **From List** (default): Select from dropdown populated from `$metadata`
   - **Custom**: Manually enter entity set name (use if `$metadata` fails or entity not listed)
5. Configure optional filters, selection, or sorting in the "Options" section

### Working with Restrictive SAP Systems

If your SAP system restricts `$metadata` access or the dropdown lists are empty:

1. **Switch to Custom Mode**:
   - For entities: Change "Entity Set Mode" to "Custom"
   - For function imports: Change "Function Name Mode" to "Custom"

2. **Find Entity/Function Names**:
   - In SAP Gateway Client: Transaction `/IWFND/GW_CLIENT`
   - In SAP Service Maintenance: Transaction `/IWFND/MAINT_SERVICE`
   - From SAP documentation or service developer

3. **Enter Name Manually**:
   - Entity Set examples: `ProductSet`, `A_SalesOrder`, `ZMY_CUSTOM_ENTITY`
   - Function Import examples: `GetSalesOrder`, `CALCULATE_PRICE`, `Z_MY_FUNCTION`

**Example scenarios where Custom Mode is helpful:**
- ✅ `$metadata` endpoint returns 403 Forbidden
- ✅ Service is not registered in SAP Gateway
- ✅ Working with newly created custom entities
- ✅ Restrictive authorization settings
- ✅ Network/firewall blocks metadata requests

### Create Entity

1. Select "Create" operation
2. Enter the entity set name
3. Provide the data as JSON in the "Data" field

Example:
```json
{
  "CustomerName": "ACME Corp",
  "SalesAmount": 10000,
  "Currency": "EUR"
}
```

### Update Entity

1. Select "Update" operation
2. Enter the entity set name
3. Provide the entity key (e.g., `'0500000001'`)
4. Provide the updated data as JSON

### Query with Filters

Use the Options section to add OData query parameters:

- **$select**: `Name,Price,Description`
- **$filter**: `Status eq 'A' and Price gt 100`
- **$expand**: `ToItems,ToPartner`
- **$orderby**: `CreatedAt desc`
- **$skip**: `10`
- **$count**: `true`

## Examples

### Example 1: Connect to Public OData Service (No Authentication)

```
Credentials:
  Host: https://services.odata.org
  Service Path: /V2/Northwind/Northwind.svc/
  Authentication: None

Resource: Entity
Operation: Get All
Entity Set Name: Products
Options:
  $filter: UnitPrice gt 20
  $orderby: ProductName
  $select: ProductID,ProductName,UnitPrice
  $top: 10
```

### Example 2: Get All Sales Orders (Basic Auth)

```
Resource: Entity
Operation: Get All
Entity Set Name: SalesOrderSet
Options:
  $filter: Status eq 'OPEN'
  $orderby: CreatedAt desc
  $select: SalesOrderID,CustomerName,TotalAmount
```

### Example 3: Create a New Customer

```
Resource: Entity
Operation: Create
Entity Set Name: CustomerSet
Data:
{
  "CustomerID": "CUST001",
  "Name": "Example Customer",
  "Country": "DE",
  "City": "Berlin"
}
```

### Example 4: Update Sales Order Status

```
Resource: Entity
Operation: Update
Entity Set Name: SalesOrderSet
Entity Key: '0500000001'
Data:
{
  "Status": "COMPLETED",
  "CompletedDate": "2024-01-15"
}
```

### Example 5: Execute Function Import

```
Resource: Function Import
Function Name: GetSalesOrderDetails
Parameters:
{
  "SalesOrderID": "0500000001",
  "IncludeItems": true
}
```

## OData Query Syntax

### Filter Operators

- **eq**: Equal (`Status eq 'A'`)
- **ne**: Not equal (`Status ne 'X'`)
- **gt**: Greater than (`Price gt 100`)
- **ge**: Greater or equal (`Price ge 100`)
- **lt**: Less than (`Price lt 1000`)
- **le**: Less or equal (`Price le 1000`)
- **and**: Logical AND (`Status eq 'A' and Price gt 100`)
- **or**: Logical OR (`Status eq 'A' or Status eq 'B'`)

### String Functions

- **substringof**: `substringof('Bike', Name)`
- **startswith**: `startswith(Name, 'B')`
- **endswith**: `endswith(Name, 'bike')`

### Select and Expand

- **$select**: Choose specific fields (`Name,Price`)
- **$expand**: Include related entities (`ToItems,ToPartner`)

## Performance

### Connection Pooling

This node implements **HTTP/HTTPS connection pooling** for optimal performance when communicating with SAP systems. Connection pooling provides:

- **Reduced Latency**: Reuses existing TCP connections, eliminating handshake overhead
- **Higher Throughput**: More efficient network resource utilization
- **Lower CPU Usage**: Fewer SSL/TLS negotiations for HTTPS connections
- **Better Resource Management**: Automatic cleanup of idle connections

#### Default Configuration

Connection pooling is **enabled by default** with sensible settings optimized for typical SAP OData services:

- Max Concurrent Connections: 10 per host
- Max Idle Connections: 5
- Connection Keep-Alive: Enabled
- Socket Timeout: 2 minutes
- Idle Connection Timeout: 30 seconds

#### Advanced Configuration

For specialized scenarios, you can customize connection pool behavior through the **Advanced Options** section:

- **Connection Pool - Max Sockets**: Maximum concurrent connections (1-50, default: 10)
- **Connection Pool - Max Free Sockets**: Maximum idle connections to keep (0-25, default: 5)
- **Connection Pool - Keep Alive**: Enable connection reuse (recommended: true)
- **Connection Pool - Socket Timeout**: Active connection timeout in ms (10000-300000, default: 120000)
- **Connection Pool - Free Socket Timeout**: Idle connection timeout in ms (5000-120000, default: 30000)

#### When to Adjust Settings

**Increase Max Sockets (20-30)** for:
- High-throughput batch processing
- Many parallel requests
- Processing large datasets

**Decrease Max Sockets (3-5)** for:
- Rate-limited SAP systems
- Development/testing environments
- Reducing server load

**Increase Free Socket Timeout (60000+)** for:
- Workflows with frequent bursts of requests
- Reducing connection establishment overhead

**Decrease Free Socket Timeout (10000-15000)** for:
- Reducing memory usage
- Infrequent queries with long idle periods

For detailed information about connection pooling, including architecture, monitoring, and troubleshooting, see [CONNECTION_POOLING.md](CONNECTION_POOLING.md).

### Resilience Configuration

This node implements **automatic retry with exponential backoff** and **request throttling** to handle transient errors and respect SAP system rate limits.

#### Retry Mechanism

Automatically retries failed requests with exponential backoff to handle transient network errors and temporary service unavailability.

**Default Configuration**:
- Retry Enabled: Yes
- Max Retry Attempts: 3
- Initial Retry Delay: 1000ms (1 second)
- Max Retry Delay: 10000ms (10 seconds)
- Backoff Factor: 2 (delays: 1s, 2s, 4s, 8s...)
- Retryable Status Codes: 429 (Too Many Requests), 503 (Service Unavailable), 504 (Gateway Timeout)
- Retry Network Errors: Yes (ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED)

**Advanced Options** (in "Resilience" section):

- **Enable Retry**: Enable/disable automatic retry (default: true)
- **Max Retry Attempts**: Number of retry attempts (1-10, default: 3)
- **Initial Retry Delay**: Starting delay in milliseconds (100-5000, default: 1000)
- **Max Retry Delay**: Maximum delay cap in milliseconds (1000-60000, default: 10000)
- **Backoff Factor**: Exponential multiplier (1.5-3.0, default: 2.0)
- **Retry Status Codes**: Comma-separated HTTP status codes to retry (default: "429,503,504")
- **Retry Network Errors**: Retry on network connection errors (default: true)
- **Log Retries**: Enable retry logging (default: true)

**Example**: With backoffFactor=2 and initialRetryDelay=1000ms:
- Attempt 1: Immediate
- Attempt 2: Wait 1000ms
- Attempt 3: Wait 2000ms
- Attempt 4: Wait 4000ms

#### Request Throttling

Controls the rate of requests sent to SAP to prevent overwhelming the server or hitting rate limits.

**Default Configuration**:
- Throttling Enabled: No (disabled by default)
- Max Requests Per Second: 10
- Throttle Strategy: delay
- Burst Size: 5 requests

**Throttle Strategies**:

1. **delay** (recommended): Wait until a request slot is available
   - Ensures all requests eventually succeed
   - Adds latency when rate limit is reached
   - Best for: Production workflows with strict success requirements

2. **drop**: Reject requests when rate limit is reached
   - Fails immediately with error
   - No waiting or queueing
   - Best for: Optional requests, monitoring, non-critical operations

3. **queue**: Queue requests and process when slots become available
   - FIFO (first-in-first-out) queue
   - All requests eventually succeed
   - Best for: Batch processing with large request volumes

**Advanced Options** (in "Resilience" section):

- **Enable Throttling**: Enable/disable request throttling (default: false)
- **Max Requests Per Second**: Maximum requests per second (1-100, default: 10)
- **Throttle Strategy**: How to handle rate limits (delay/drop/queue, default: delay)
- **Throttle Burst Size**: Number of requests that can burst (1-50, default: 5)
- **Log Throttling**: Enable throttle logging (default: true)

#### Configuration Examples

**Conservative SAP System** (strict rate limits, high latency tolerance):
```json
{
  "retryEnabled": true,
  "maxRetries": 5,
  "initialRetryDelay": 2000,
  "backoffFactor": 2,
  "throttleEnabled": true,
  "maxRequestsPerSecond": 5,
  "throttleStrategy": "delay",
  "throttleBurstSize": 3
}
```

**High-Performance SAP System** (minimal restrictions, optimized for speed):
```json
{
  "retryEnabled": true,
  "maxRetries": 2,
  "initialRetryDelay": 500,
  "backoffFactor": 1.5,
  "throttleEnabled": true,
  "maxRequestsPerSecond": 50,
  "throttleStrategy": "queue",
  "throttleBurstSize": 20
}
```

**Development/Testing** (no resilience, maximum logging):
```json
{
  "retryEnabled": false,
  "throttleEnabled": false,
  "logRetries": true,
  "logThrottling": true
}
```

**Batch Processing** (balanced for large datasets):
```json
{
  "retryEnabled": true,
  "maxRetries": 3,
  "retryStatusCodes": "429,503,504,502",
  "throttleEnabled": true,
  "maxRequestsPerSecond": 20,
  "throttleStrategy": "queue",
  "throttleBurstSize": 10
}
```

#### When to Adjust Settings

**Increase maxRetries (5-10)** for:
- Unreliable network connections
- SAP systems with frequent transient errors
- Critical workflows that must succeed

**Decrease maxRetries (1-2)** for:
- Fast-failing workflows
- Time-sensitive operations
- Development/testing

**Enable Throttling** for:
- SAP systems returning 429 errors
- Avoiding rate limit violations
- Protecting SAP Gateway from overload
- Multi-tenant SAP environments

**Increase maxRequestsPerSecond (30-100)** for:
- High-performance SAP systems
- Dedicated SAP instances
- Large batch operations

**Decrease maxRequestsPerSecond (1-5)** for:
- Shared SAP systems
- Development environments
- Systems with strict rate limits

#### Monitoring and Troubleshooting

**Retry Logging** (when `logRetries: true`):
```
INFO: Retrying request {
  module: 'RetryHandler',
  attempt: 2,
  maxAttempts: 3,
  delay: '2000ms',
  error: 'Request failed with status 503',
  method: 'GET',
  resource: '/EntitySet'
}
```

**Throttle Logging** (when `logThrottling: true`):
```
INFO: Request throttled {
  module: 'ThrottleManager',
  waitTime: '150ms',
  strategy: 'delay',
  method: 'POST',
  resource: '/EntitySet'
}
```

**Common Issues**:

- **All retries exhausted**: Check SAP system availability, increase maxRetries or initialRetryDelay
- **Requests dropped**: Change throttleStrategy from "drop" to "delay" or "queue"
- **High latency**: Reduce maxRetries, decrease initialRetryDelay, or disable throttling
- **429 errors**: Enable throttling or decrease maxRequestsPerSecond

### Pagination

The node automatically handles pagination for "Get All" operations:

- **Return All**: Fetches all results across multiple requests
- **Batch Size**: Configure items per request (default: 100, range: 10-1000)
- **Protocol Support**: Both OData V2 and V4 pagination formats

Adjust batch size based on your needs:
- **Lower values (10-50)**: Reduce memory usage, suitable for large entities
- **Higher values (500-1000)**: Reduce API calls, faster for small entities

## Troubleshooting

### Common Error Messages and Solutions

#### 401 Unauthorized

**Error Message:** `Authentication failed. Please verify your credentials and try again.`

**Possible Causes:**
- Incorrect username or password
- User account locked or expired
- Wrong authentication method selected

**Solutions:**
1. Verify credentials in n8n credential manager
2. Test credentials directly in SAP GUI or browser
3. Check if Basic Auth is enabled on the SAP system
4. Ensure authentication method is set to "Basic Auth" (not "None")

#### 403 Forbidden

**Error Message:** `Access forbidden - You do not have permission to access this resource.`

**Possible Causes:**
- User lacks authorization for the OData service
- Missing SAP authorization object (S_SERVICE)
- Service not activated in transaction /IWFND/MAINT_SERVICE

**Solutions:**
1. Check user authorizations in SAP (transaction SU53 after error)
2. Verify service is activated in /IWFND/MAINT_SERVICE
3. Contact SAP basis team to grant required authorizations

#### 404 Not Found

**Error Message:** `Resource not found - The requested resource 'EntitySet' does not exist.`

**Possible Causes:**
- Typo in entity set name
- Wrong service path
- Entity set not part of this service

**Solutions:**
1. Check `$metadata` endpoint: `https://your-sap-system.com/service/path/$metadata`
2. Verify entity set name matches exactly (case-sensitive)
3. Use the entity set dropdown (populated from $metadata) instead of manual entry
4. If dropdown is empty, switch to "Custom" mode and verify the name from SAP Gateway Client (/IWFND/GW_CLIENT)

#### 405 Method Not Allowed

**Error Message:** `Method not allowed`

**Possible Causes (Function Imports):**
- Using POST for a GET-only function import
- Using GET for a POST-only function import

**Solutions:**
1. Check `$metadata` for the function import definition
2. Look for `m:HttpMethod` attribute: `<FunctionImport Name="..." m:HttpMethod="GET">`
3. Select the correct HTTP Method in the node configuration

#### 500 Internal Server Error

**Error Message:** `The SAP server encountered an error.`

**Possible Causes:**
- Invalid JSON in request body
- Required field missing
- Business logic error in SAP backend
- Malformed OData query

**Solutions:**
1. Enable detailed error messages in SAP (transaction /IWFND/ERROR_LOG)
2. Check SAP gateway logs: /IWFND/ERROR_LOG
3. Validate JSON syntax in "Data" field
4. Test the same request in SAP Gateway Client (transaction /IWFND/GW_CLIENT)

### CSRF Token Issues

**Error Message:** `Failed to fetch CSRF token for write operation`

For write operations (Create, Update, Delete), the node automatically fetches and includes CSRF tokens. If you encounter issues:

1. Ensure your SAP system supports CSRF token handling (enabled by default in modern SAP Gateway)
2. Check that your credentials have proper permissions
3. Verify the service path is correct
4. Test CSRF token manually: Send GET request with header `X-CSRF-Token: Fetch`

### SSL Certificate Errors

**Error Message:** `SSL certificate validation failed` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

If you encounter SSL certificate errors:

1. **For development:** Enable "Ignore SSL Issues" in credentials (NOT recommended for production)
2. **For production:** Install proper SSL certificates on your SAP system
3. Import SAP server certificates into n8n's certificate store
4. Use a reverse proxy with valid certificates

### Entity Key Format

Entity keys should be formatted as:
- **Simple key:** `'value'` (e.g., `'0500000001'`)
  - Single quotes required for string values
  - No quotes for numeric IDs: `12345`
- **Composite key:** `Key1='value1',Key2='value2'`
  - Multiple key-value pairs separated by commas
  - Example: `OrderID='SO001',ItemID='10'`

**Common Mistakes:**
- ❌ `0500000001` (missing quotes for strings)
- ❌ `"0500000001"` (wrong quote type)
- ❌ `Key1=value1` (missing quotes around value in composite keys)
- ✅ `'0500000001'` (correct)
- ✅ `OrderID='SO001',ItemID='10'` (correct composite)

### Pagination Issues

**Problem:** Not all results are returned

**Solutions:**
1. Enable "Return All" option for complete result sets
2. Increase "Batch Size" in Options (default: 100, max: 1000)
3. Check if SAP service has pagination limits (some services cap at 1000 records)
4. For large datasets, use `$filter` to reduce result size

**Problem:** Memory issues with large result sets

**Solutions:**
1. Decrease "Batch Size" to 10-50 (reduces memory per request)
2. Use `$select` to retrieve only needed fields
3. Add `$filter` to reduce result count
4. Process data in smaller chunks using `$skip` and `$top`

### Empty Dropdown Lists (Entity Sets / Function Imports)

**Problem:** The entity set or function import dropdown is empty or shows an error message

**Possible Causes:**
- `$metadata` endpoint is blocked or returns 403 Forbidden
- SAP system has restrictive security settings
- Service is not registered in SAP Gateway
- Network/firewall blocks metadata requests
- Service path is incorrect

**Solutions:**
1. **Use Custom Mode** (Recommended):
   - Switch "Entity Set Mode" or "Function Name Mode" to "Custom"
   - Enter the name manually (you'll see helpful placeholders)
   - Find names in SAP Gateway Client (`/IWFND/GW_CLIENT`) or documentation

2. **Fix Metadata Access**:
   - Test metadata URL directly: `https://your-sap:port/service/path/$metadata`
   - Check SAP authorizations (transaction SU53 after error)
   - Verify service is activated in `/IWFND/MAINT_SERVICE`
   - Clear cache with "Advanced Options" → "Cache: Clear Before Execution"

3. **Example Custom Names**:
   - Entity Sets: `ProductSet`, `A_SalesOrder`, `ZMY_ENTITY`
   - Function Imports: `GetSalesOrder`, `CALCULATE_PRICE`, `Z_FUNCTION`

**Note:** The dropdown shows a warning message like "⚠️ Could not load entity sets - [error]" when metadata fails. This is expected behavior - just switch to Custom mode to continue.

### Filtering Not Working

**Problem:** `$filter` returns no results or wrong results

**Common Mistakes:**
- ❌ `Name = "Test"` (wrong syntax - use `eq` not `=`)
- ❌ `Price > 100` (wrong syntax - use `gt` not `>`)
- ❌ `Status eq Active` (missing quotes - should be `Status eq 'Active'`)

**Correct Examples:**
- ✅ `Status eq 'Active'` (string comparison)
- ✅ `Price gt 100` (numeric comparison)
- ✅ `Status eq 'A' and Price lt 500` (combined filters)
- ✅ `substringof('Bike', Name)` (string function)

### Debug Mode

To get detailed error information:

1. **Enable n8n error details:** Check execution logs in n8n UI
2. **SAP Gateway Error Log:** Transaction /IWFND/ERROR_LOG
3. **SAP Gateway Client:** Test requests in /IWFND/GW_CLIENT
4. **Browser DevTools:** Check Network tab for raw HTTP requests/responses
5. **Connection Pool Stats:** Monitor via ConnectionPoolManager.getStats() (for developers)

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [SAP Gateway and OData Documentation](https://help.sap.com/docs/SAP_GATEWAY)
- [OData Protocol Documentation](https://www.odata.org/documentation/)

## Development

### Build

```bash
npm install
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Lint

```bash
npm run lint
npm run lintfix
```

### Format

```bash
npm run format
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Recent Releases

- **1.3.x**: Service Discovery & Architecture Improvements
  - Automatic service discovery from SAP Gateway Catalog
  - Service category filtering (Standard APIs, Custom Services)
  - Enhanced connection testing with SAP headers
  - Refactored to shared module architecture
  - Improved code organization for v2.0 development

- **1.3.0**: Service Discovery & Category Filtering
  - Service path dropdown with auto-discovery
  - Entity key validation improvements
  - Type conversion enhancements
  - 404 cache invalidation

- **1.2.0**: Performance & Resilience
  - Streaming mode for large datasets
  - Retry logic with exponential backoff
  - Rate limiting and throttling
  - Connection pooling
  - Comprehensive error handling

- **1.1.0**: Custom Modes & Caching
  - Custom entity set mode
  - Custom function import mode
  - Metadata and CSRF token caching
  - SAP-specific headers support

- **1.0.0**: Initial Release
  - Entity CRUD operations
  - Function import support
  - Basic Auth support
  - OData query parameters ($filter, $select, $expand, etc.)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- Open an issue on GitHub
- Join the n8n community forum
- Check SAP documentation for OData service specifics

## Author

Your Name - your.email@example.com

## Acknowledgments

- n8n team for the excellent workflow automation platform
- SAP community for OData documentation and support
