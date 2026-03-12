# n8n-nodes-sap-odata

Custom n8n community node for SAP OData integration — connect n8n to SAP systems via OData protocol.

![SAP OData Node](https://img.shields.io/badge/n8n-SAP%20OData-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/npm/v/n8n-nodes-sap-odata)

> **Beta**: This package is in active development. Feedback and bug reports are welcome.

## Features

- **Full CRUD Operations**: Create, Read, Update, Delete entities
- **OData V2 & V4 Support**: Auto-detection from service metadata
- **Function Imports / Actions / Functions**: Execute SAP business logic (V2 FunctionImports, V4 Actions & Functions)
- **Dynamic Service Discovery**: Automatically discovers available OData services from SAP Gateway Catalog (on-premise / S/4HANA)
- **Dynamic Entity Set Discovery**: Loads available entity sets from service metadata
- **Trigger Node**: Receive real-time SAP events via webhook with HMAC authentication, rate limiting, and IP whitelisting
- **Multiple Authentication Methods**:
  - Basic Authentication (On-Premise SAP)
  - OAuth 2.0 Client Credentials (SAP Cloud / BTP)
  - No Authentication (Public APIs / Sandbox)
- **Advanced Features**:
  - Automatic retry with exponential backoff
  - Request throttling
  - CSRF token handling with automatic refresh
  - Automatic pagination (V2 `__next`, V4 `@odata.nextLink`)
  - SAP date format conversion (V2 `/Date()/` to ISO 8601)
  - Metadata caching for improved performance

## Installation

### Option 1: n8n Community Nodes (Recommended)

1. Open n8n
2. Go to **Settings** > **Community Nodes**
3. Search for `n8n-nodes-sap-odata`
4. Click **Install**

### Option 2: Install via npm

```bash
# In n8n custom nodes directory
cd ~/.n8n/nodes
npm install n8n-nodes-sap-odata
```

After installation, restart n8n.

### Option 3: Install from GitHub

```bash
cd ~/.n8n/nodes
npm install github:sseegebarth/n8n-nodes-sap-odata
```

### Option 4: Docker

```dockerfile
FROM n8nio/n8n:latest

USER root
RUN cd /usr/local/lib/node_modules/n8n && \
    npm install n8n-nodes-sap-odata
USER node
```

## Configuration

### Creating Credentials

1. In n8n, go to **Credentials** > **New Credential**
2. Search for **"avanai SAP OData API"**
3. Configure the connection:

#### Basic Authentication (On-Premise SAP)

| Field | Description | Example |
|-------|-------------|---------|
| Host | SAP system URL | `https://sap-server.company.com:8443` |
| Authentication | Select "Basic Auth" | - |
| Username | SAP username | `SAP_USER` |
| Password | SAP password | `********` |
| SAP Client | Mandant number | `100` |
| SAP Language | Language code | `EN` |

#### OAuth 2.0 (SAP Cloud / BTP)

| Field | Description | Example |
|-------|-------------|---------|
| Host | SAP API URL | `https://api.sap.com` |
| Authentication | Select "OAuth 2.0 Client Credentials" | - |
| Token URL | OAuth token endpoint | `https://tenant.authentication.eu10.hana.ondemand.com/oauth/token` |
| Client ID | From service key | `sb-xxxxx` |
| Client Secret | From service key | `********` |
| Scope | Optional scopes | `API_BUSINESS_PARTNER` |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOW_PRIVATE_IPS` | Allow connections to private IP addresses (required for on-premise SAP) | `false` |

## Usage

### Selecting a Service

The node provides two modes for selecting an OData service:

- **From List**: Automatically discovers services from the SAP Gateway Catalog (`CATALOGSERVICE`). Available on on-premise and S/4HANA systems that expose the catalog service.
- **By Path**: Manual entry of the service path. Works with all systems — on-premise, SAP Cloud / BTP, and public APIs like `api.sap.com`.

### Read Entities (Get All)

1. Add the **"avanai SAP Connect OData"** node to your workflow
2. Select your SAP credentials
3. Select a service (from list or by path)
4. Select **Resource**: `Entity`
5. Select **Operation**: `Get All`
6. Choose an **Entity Set** (from list, by name, or by URL)

### Read a Single Entity (Get)

1. Select **Operation**: `Get`
2. Enter the **Entity Key** — e.g. `'1000'` for a single key or `CompanyCode='1000',FiscalYear='2024'` for a compound key

### Create an Entity

1. Select **Operation**: `Create`
2. Choose the **Entity Set**
3. Provide the entity data as JSON in the **Body** field:

```json
{
  "CustomerID": "CUST001",
  "CustomerName": "Acme Corp",
  "Country": "DE"
}
```

### Update an Entity

1. Select **Operation**: `Update`
2. Enter the **Entity Key** — e.g. `'CUST001'`
3. Provide the fields to update as JSON in the **Body** field:

```json
{
  "CustomerName": "Acme Corporation",
  "Country": "US"
}
```

The node uses PATCH by default (partial update). CSRF tokens are handled automatically.

### Delete an Entity

1. Select **Operation**: `Delete`
2. Enter the **Entity Key** — e.g. `'CUST001'`

### Get Metadata

1. Select **Operation**: `Get Metadata`
2. Choose the **Metadata Type**:
   - **Service Document**: Returns available entity sets with their names and URLs
   - **$metadata**: Returns the full XML schema definition (entity types, properties, associations, annotations)

### Function Imports / Actions / Functions

1. Select **Resource**: `Function Import`
2. Choose the function from the dropdown — labels indicate the type (V2 FunctionImport, V4 Action, V4 Function)
3. HTTP method is auto-determined: POST for FunctionImports and Actions, GET for Functions
4. Provide parameters as JSON:

```json
{
  "AirlineID": "LH",
  "ConnectionID": "0400"
}
```

V2 FunctionImport parameters are sent as URL query string. V4 Action parameters are sent in the request body.

### Query Options

| Option | Description | Example |
|--------|-------------|---------|
| `$filter` | Filter expression | `Country eq 'DE'` |
| `$select` | Select specific fields | `CustomerID,CustomerName` |
| `$expand` | Expand navigation properties | `to_Address` |
| `$orderby` | Sort results | `CustomerName desc` |
| `$top` | Limit results | `100` |
| `$count` | Include total count of matching entities | `true` (V4: `$count`, V2: `$inlinecount=allpages`) |
| `$search` | Full-text search (V4 only) | `Berlin` |

## Trigger Node

The **avanai SAP Connect OData Trigger** node receives real-time events from SAP systems via webhook.

### How It Works

1. The trigger node creates a webhook URL
2. Configure your SAP system to send event notifications to this URL (e.g. via SAP Gateway Event Hub / `NOTIFICATION_SRV`)
3. The node processes incoming events and triggers your workflow

### Event Filtering

- **All Events**: Process every incoming event
- **Specific Entity Type**: Filter by entity (e.g. `SalesOrder`, `Material`)
- **Specific Operation**: Filter by operation type (Create, Update, Delete)

### Authentication

| Method | Description |
|--------|-------------|
| **HMAC Signature** | Validates request signature using SHA256 or SHA512 |
| **Header Auth** | Validates a token in a custom header |
| **Query Auth** | Validates a token as query parameter |
| **None** | No authentication (not recommended for production) |

### Advanced Options

- **Rate Limiting**: Enabled by default (100 requests/min per IP)
- **IP Whitelist**: Restrict access to specific IPs or CIDR ranges
- **Extract Changed Fields**: Compare old vs. new values
- **Parse SAP Date Formats**: Automatically convert to ISO 8601
- **Custom Response Code and Body**: Configure the webhook response

## Troubleshooting

### Connection Issues

**"Access to private IP addresses is not allowed"**

Set the environment variable `ALLOW_PRIVATE_IPS=true` in your n8n instance.

**"SSL Certificate error"**

Enable "Ignore SSL Issues" in credentials (development only!).

**"401 Unauthorized"**

- Check username and password
- Verify SAP Client number
- Ensure user has required authorizations (SU01)

### OData Issues

**"Invalid OData syntax" (HTTP 400)**

- Check `$filter` syntax — string values need single quotes: `Name eq 'Value'`
- V2 uses `substringof('text', Field)`, V4 uses `contains(Field, 'text')`
- Date filter V2: `datetime'2024-01-15T00:00:00'`

**"HTTP 501 Not Implemented"**

- The field may not be filterable — check `$metadata` for field annotations

### Service Discovery Issues

**"From List" shows no services or only common services**

- The SAP Gateway Catalog Service (`/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/`) may not be available on your system
- Switch to **"By Path"** mode and enter the service path manually
- For SAP Cloud / BTP systems, use "By Path" with the full service path

## Development

```bash
git clone https://github.com/sseegebarth/n8n-nodes-sap-odata.git
cd n8n-nodes-sap-odata

npm install
npm run build
npm run lint
npm test
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Sascha Seegebarth (sascha.seegebarth@avanai.io)

## Support

- **Issues**: [GitHub Issues](https://github.com/sseegebarth/n8n-nodes-sap-odata/issues)
- **SAP OData Documentation**: [SAP Help Portal](https://help.sap.com/viewer/product/SAP_GATEWAY/)
