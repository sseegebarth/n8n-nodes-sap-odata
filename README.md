# n8n-nodes-sap-odata

Custom n8n node for SAP OData integration - Connect n8n to SAP systems via OData protocol.

![SAP OData Node](https://img.shields.io/badge/n8n-SAP%20OData-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-0.1.0-green)

## Features

- **Full CRUD Operations**: Create, Read, Update, Delete entities
- **OData V2 & V4 Support**: Auto-detection or manual selection
- **Multiple Authentication Methods**:
  - Basic Authentication (On-Premise SAP)
  - OAuth 2.0 Client Credentials (SAP Cloud/BTP)
  - No Authentication (Public APIs)
- **Dynamic Entity Discovery**: Automatically loads available entity sets
- **Function Import Support**: Execute SAP function imports
- **Metadata Access**: Retrieve service document and $metadata
- **Advanced Features**:
  - Connection pooling
  - Automatic retry with exponential backoff
  - Request throttling
  - CSRF token handling
  - Pagination support

## Installation

### Option 1: Install via npm (Recommended)

Install the package globally or in your n8n custom nodes directory:

```bash
# Global installation
npm install -g n8n-nodes-sap-odata

# Or in n8n custom nodes directory
cd ~/.n8n/nodes
npm install n8n-nodes-sap-odata
```

After installation, restart n8n.

### Option 2: Install from GitHub

```bash
cd ~/.n8n/nodes
npm install github:sseegebarth/n8n-nodes-sap-odata
```

### Option 3: Docker Installation

#### Method A: Custom Dockerfile

Create a `Dockerfile`:

```dockerfile
FROM n8nio/n8n:latest

USER root

# Install the SAP OData node
RUN cd /usr/local/lib/node_modules/n8n && \
    npm install n8n-nodes-sap-odata

USER node
```

Build and run:

```bash
docker build -t n8n-sap .
docker run -it --rm \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8n-sap
```

#### Method B: Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
      # Required for On-Premise SAP with private IPs
      - ALLOW_PRIVATE_IPS=true
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

With `Dockerfile`:

```dockerfile
FROM n8nio/n8n:latest

USER root

RUN cd /usr/local/lib/node_modules/n8n && \
    npm install n8n-nodes-sap-odata

USER node
```

Run with:

```bash
docker-compose up -d
```

#### Method C: Mount Custom Nodes Directory

```bash
# Create custom nodes directory
mkdir -p ~/.n8n/custom-nodes
cd ~/.n8n/custom-nodes
npm install n8n-nodes-sap-odata

# Run n8n with mounted directory
docker run -it --rm \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -v ~/.n8n/custom-nodes:/home/node/.n8n/nodes \
  -e N8N_CUSTOM_EXTENSIONS="/home/node/.n8n/nodes" \
  n8nio/n8n
```

## Configuration

### Creating Credentials

1. In n8n, go to **Credentials** → **New Credential**
2. Search for **"ATW SAP OData API"**
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

#### OAuth 2.0 (SAP Cloud/BTP)

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
| `ALLOW_PRIVATE_IPS` | Allow connections to private IP addresses (required for On-Premise SAP) | `false` |

**Docker example:**

```yaml
environment:
  - ALLOW_PRIVATE_IPS=true
```

## Usage

### Basic Example: Read Entities

1. Add the **"SAP Connect OData"** node to your workflow
2. Select your SAP credentials
3. Enter the OData service path (e.g., `/sap/opu/odata/sap/API_BUSINESS_PARTNER`)
4. Select **Resource**: `Entity`
5. Select **Operation**: `Get All`
6. Choose an **Entity Set** from the dropdown

### Query Options

| Option | Description | Example |
|--------|-------------|---------|
| $filter | Filter expression | `Country eq 'DE'` |
| $select | Select specific fields | `CustomerID,CustomerName` |
| $expand | Expand navigation properties | `to_Address` |
| $orderby | Sort results | `CustomerName desc` |
| $top | Limit results | `100` |

### Operations

| Operation | Description |
|-----------|-------------|
| **Get** | Retrieve a single entity by key |
| **Get All** | Retrieve multiple entities with optional filters |
| **Create** | Create a new entity |
| **Update** | Update an existing entity (PATCH/PUT) |
| **Delete** | Delete an entity |
| **Get Metadata** | Retrieve service document or $metadata |

### Function Imports

1. Select **Resource**: `Function Import`
2. Choose the function from the dropdown
3. Configure required parameters

## Troubleshooting

### Connection Issues

**"Access to private IP addresses is not allowed"**

Set the environment variable:
```bash
export ALLOW_PRIVATE_IPS=true
```

Or in Docker:
```yaml
environment:
  - ALLOW_PRIVATE_IPS=true
```

**"SSL Certificate error"**

Enable "Ignore SSL Issues" in credentials (development only!).

**"401 Unauthorized"**

- Check username and password
- Verify SAP Client number
- Ensure user has required authorizations

### OAuth 2.0 Issues

**"OAuth token fetch failed"**

- Verify Token URL is correct
- Check Client ID and Client Secret
- Confirm required scopes

## Development

### Build from Source

```bash
# Clone repository
git clone https://github.com/sseegebarth/n8n-nodes-sap-odata.git
cd n8n-nodes-sap-odata

# Install dependencies
npm install

# Build
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

### Link for Development

```bash
# In this project
npm link

# In your n8n installation
cd /path/to/n8n
npm link n8n-nodes-sap-odata
```

## Security Notes

- **Never disable SSL validation in production**
- Store credentials securely using n8n's credential system
- Use OAuth 2.0 for SAP Cloud environments
- Limit user permissions in SAP to only required authorizations

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

- **Issues**: [GitHub Issues](https://github.com/sseegebarth/n8n-nodes-sap-odata/issues)
- **SAP OData Documentation**: [SAP Help Portal](https://help.sap.com/viewer/product/SAP_GATEWAY/)
