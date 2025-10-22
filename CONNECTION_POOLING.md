# Connection Pooling in SAP OData Node

## Overview

The SAP OData node implements HTTP/HTTPS connection pooling to optimize network performance and resource utilization when communicating with SAP systems. Connection pooling reuses TCP connections across multiple requests, significantly reducing overhead and improving throughput.

## Benefits

### 1. **Performance Improvements**
- **Reduced Latency**: Reusing existing connections eliminates the need for repeated TCP handshakes and SSL/TLS negotiations
- **Lower CPU Usage**: Fewer connection establishments mean less cryptographic overhead
- **Higher Throughput**: More efficient use of network resources allows for more concurrent requests

### 2. **Resource Efficiency**
- **Connection Reuse**: Idle connections are kept alive for a configurable period
- **Controlled Concurrency**: Maximum socket limits prevent overwhelming SAP servers
- **Memory Management**: Automatic cleanup of idle connections prevents memory leaks

### 3. **Reliability**
- **Graceful Degradation**: Health checks detect connection pool issues
- **Statistics Tracking**: Monitor active/free sockets and pending requests
- **Configurable Timeouts**: Fine-tune behavior for different network conditions

## Default Configuration

The SAP OData node ships with sensible defaults optimized for typical SAP OData services:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `keepAlive` | `true` | Keep connections alive for reuse |
| `maxSockets` | `10` | Maximum concurrent connections per host |
| `maxFreeSockets` | `5` | Maximum idle connections to keep in pool |
| `timeout` | `120000` (2 min) | Socket timeout in milliseconds |
| `freeSocketTimeout` | `30000` (30 sec) | Idle connection timeout |
| `scheduling` | `fifo` | Connection scheduling strategy |

## Configuration Options

### Basic Configuration

Connection pooling is **enabled by default** with no configuration required. For most use cases, the default settings provide optimal performance.

### Advanced Configuration

For specialized scenarios, you can customize connection pool behavior through the **Advanced Options** section in the node configuration:

#### 1. Connection Pool - Max Sockets

Controls the maximum number of concurrent connections per host.

- **Range**: 1-50
- **Default**: 10
- **When to adjust**:
  - Increase (20-30) for high-throughput scenarios with many parallel requests
  - Decrease (3-5) for rate-limited SAP systems or to reduce server load
  - Keep low (5-10) for development/test environments

```
💡 Tip: Monitor SAP server CPU and memory usage when increasing maxSockets
```

#### 2. Connection Pool - Max Free Sockets

Controls how many idle connections to keep in the pool.

- **Range**: 0-25
- **Default**: 5
- **When to adjust**:
  - Increase (10-15) for workflows with frequent bursts of requests
  - Decrease (2-3) to reduce memory usage in long-running workflows
  - Set to 0 to disable connection pooling (not recommended)

```
💡 Tip: Higher values improve response time for subsequent requests
```

#### 3. Connection Pool - Keep Alive

Whether to keep connections alive for reuse.

- **Type**: Boolean
- **Default**: true (recommended)
- **When to disable**:
  - Troubleshooting connection-related issues
  - Working with SAP systems that don't support keep-alive
  - Testing connection establishment logic

#### 4. Connection Pool - Socket Timeout

Time to wait before closing an active connection.

- **Range**: 10000-300000 ms (10 sec - 5 min)
- **Default**: 120000 ms (2 minutes)
- **When to adjust**:
  - Increase (180000+) for long-running function imports or batch operations
  - Decrease (60000) for fast, simple queries
  - Match your SAP server's timeout configuration

```
⚠️ Warning: Setting too low may cause premature connection termination
```

#### 5. Connection Pool - Free Socket Timeout

Time to wait before closing an idle connection.

- **Range**: 5000-120000 ms (5 sec - 2 min)
- **Default**: 30000 ms (30 seconds)
- **When to adjust**:
  - Increase (60000+) for workflows with intermittent bursts
  - Decrease (10000-15000) to free up resources faster
  - Match your SAP server's keep-alive timeout

## Architecture

### Singleton Pattern

The `ConnectionPoolManager` uses the singleton pattern to ensure a single connection pool instance is shared across all node executions within an n8n workflow:

```typescript
const poolManager = ConnectionPoolManager.getInstance(config);
const agent = poolManager.getAgent(protocol);
```

This design ensures:
- Connection reuse across multiple node executions
- Consistent configuration throughout the workflow
- Efficient resource management

### HTTP/HTTPS Agent Management

The connection pool maintains separate agents for HTTP and HTTPS protocols:

- **HTTP Agent**: Used for non-encrypted connections
- **HTTPS Agent**: Used for SSL/TLS encrypted connections (most common)

Both agents share the same configuration and are managed identically.

### Request Flow

```
┌─────────────────┐
│  SAP OData Node │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ sapOdataApiRequest()    │
│ (GenericFunctions.ts)   │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────┐
│ ConnectionPoolManager    │
│ .getAgent(protocol)      │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ HTTP/HTTPS Agent         │
│ (Node.js built-in)       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Connection Pool          │
│ • Active Sockets         │
│ • Free Sockets (reused)  │
│ • Pending Requests       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ SAP OData Service        │
└──────────────────────────┘
```

## Monitoring and Statistics

### Health Checks

The connection pool includes built-in health monitoring:

```typescript
const isHealthy = poolManager.isHealthy();
```

The pool is considered unhealthy if:
- Pending requests exceed `maxSockets × 2`
- Active sockets exceed `maxSockets`

### Statistics Tracking

Get real-time statistics about connection pool usage:

```typescript
const stats = poolManager.getStats();
console.log(stats);
// {
//   activeSockets: 3,
//   freeSockets: 2,
//   pendingRequests: 0,
//   totalRequests: 150,
//   totalConnectionsCreated: 8,
//   totalConnectionsReused: 142
// }
```

Statistics include:
- **activeSockets**: Currently active connections
- **freeSockets**: Idle connections available for reuse
- **pendingRequests**: Queued requests waiting for available sockets
- **totalRequests**: Total number of requests made
- **totalConnectionsCreated**: Total new connections established
- **totalConnectionsReused**: Total connections reused from pool

## Performance Tuning

### Scenario 1: High-Throughput Batch Processing

Processing thousands of entities in a loop:

```
Recommended Settings:
- Max Sockets: 20-30
- Max Free Sockets: 10-15
- Keep Alive: true
- Socket Timeout: 120000 ms
- Free Socket Timeout: 60000 ms
```

**Why?** Higher socket limits allow more parallel requests, and longer free socket timeout keeps connections ready for the next batch.

### Scenario 2: Infrequent Queries

Occasional queries with long idle periods:

```
Recommended Settings:
- Max Sockets: 5-10
- Max Free Sockets: 2-3
- Keep Alive: true
- Socket Timeout: 90000 ms
- Free Socket Timeout: 15000 ms
```

**Why?** Lower resource usage with faster cleanup of idle connections.

### Scenario 3: SAP Gateway with Rate Limiting

SAP system enforces request rate limits:

```
Recommended Settings:
- Max Sockets: 3-5
- Max Free Sockets: 2
- Keep Alive: true
- Socket Timeout: 180000 ms
- Free Socket Timeout: 30000 ms
```

**Why?** Respects rate limits while maintaining connection efficiency.

### Scenario 4: Development/Testing

Local testing or development environment:

```
Recommended Settings:
- Max Sockets: 5
- Max Free Sockets: 2
- Keep Alive: true
- Socket Timeout: 60000 ms
- Free Socket Timeout: 15000 ms
```

**Why?** Minimal resource usage while still benefiting from connection pooling.

## Troubleshooting

### Issue: Slow First Request, Fast Subsequent Requests

**Cause**: First request establishes new connection (TCP handshake + SSL/TLS negotiation).

**Solution**: This is expected behavior. Connection pooling ensures subsequent requests are fast.

### Issue: Connections Timing Out

**Symptoms**: Intermittent timeout errors, especially after idle periods.

**Solutions**:
1. Check SAP server keep-alive timeout and match `freeSocketTimeout`
2. Increase `timeout` for long-running operations
3. Verify network stability between n8n and SAP

### Issue: Too Many Pending Requests

**Symptoms**: Requests queuing up, slow response times.

**Solutions**:
1. Increase `maxSockets` to allow more concurrent connections
2. Check if SAP server is overloaded
3. Review n8n workflow for excessive parallelization

### Issue: Memory Usage Growing

**Symptoms**: n8n process memory increasing over time.

**Solutions**:
1. Decrease `maxFreeSockets` to limit idle connections
2. Decrease `freeSocketTimeout` to clean up idle connections faster
3. Ensure workflows are completing properly (no hanging requests)

### Issue: SAP Server Rejecting Connections

**Symptoms**: Connection refused errors, HTTP 503 errors.

**Solutions**:
1. Decrease `maxSockets` to reduce load on SAP server
2. Check SAP server connection limits
3. Coordinate with SAP administrators to adjust server configuration

## Best Practices

### 1. Start with Defaults

The default configuration is optimized for typical use cases. Only adjust settings when monitoring indicates a need.

### 2. Monitor Performance

Track these metrics to inform tuning decisions:
- Request latency (first vs. subsequent requests)
- SAP server CPU and memory usage
- n8n process memory usage
- Connection pool statistics

### 3. Match SAP Server Configuration

Align timeout settings with SAP server configuration:
- Set `freeSocketTimeout` ≤ SAP server's keep-alive timeout
- Set `timeout` appropriate for longest expected operation

### 4. Test Configuration Changes

When adjusting settings:
1. Make one change at a time
2. Test under realistic load conditions
3. Monitor for at least one full workflow cycle
4. Roll back if issues occur

### 5. Document Your Configuration

If you customize settings, document:
- Why the changes were made
- The specific scenario they address
- Monitoring results that informed the decision

## Technical Details

### Implementation

The connection pool is implemented using Node.js built-in HTTP/HTTPS agents:

- **File**: `nodes/Sap/ConnectionPoolManager.ts`
- **Integration**: `nodes/Sap/GenericFunctions.ts`
- **Configuration**: `nodes/Sap/SapOData.node.ts`

### Agent Options

The following options are passed to Node.js agents:

```typescript
{
  keepAlive: boolean,
  keepAliveMsecs: number,
  maxSockets: number,
  maxFreeSockets: number,
  timeout: number,
  freeSocketTimeout: number,
  scheduling: 'fifo' | 'lifo'
}
```

### Thread Safety

Connection pooling is thread-safe and works correctly with:
- Multiple node executions in parallel
- Multiple workflows using the same SAP credentials
- Concurrent requests within a single workflow

## References

- [Node.js HTTP Agent Documentation](https://nodejs.org/api/http.html#class-httpagent)
- [Node.js HTTPS Agent Documentation](https://nodejs.org/api/https.html#class-httpsagent)
- [SAP OData Best Practices](https://help.sap.com/docs/SAP_NETWEAVER_AS_ABAP_752/68bf513362174d54b58cddec28794093/7c0641c8f7294625a93a4c0308aeb49c.html)

## Support

If you encounter issues with connection pooling:

1. Review this documentation and troubleshooting section
2. Check the [GitHub Issues](https://github.com/n8n-io/n8n/issues)
3. Consult n8n community forums
4. Open a new issue with:
   - Connection pool configuration
   - SAP server version and configuration
   - Error messages and logs
   - Connection pool statistics
