# n8n SAP OData Node - Architecture Documentation

## Module Dependency Graph

This document describes the architecture and module dependencies of the n8n SAP OData node to prevent cyclic dependencies and maintain clean separation of concerns.

### Dependency Layers (Bottom-Up)

```
Layer 0: Foundation (No Dependencies)
├── types.ts                    # TypeScript interfaces and types
└── constants.ts                # Configuration constants

Layer 1: Utilities (Depends on Layer 0)
├── Logger.ts                   # Logging utility
└── SecurityUtils.ts            # Security validation functions

Layer 2: Core Services (Depends on Layers 0-1)
├── ErrorHandler.ts             # Centralized error handling
├── CacheManager.ts             # CSRF & Metadata caching
├── ConnectionPoolManager.ts    # HTTP connection pooling
└── ThrottleManager.ts          # Rate limiting

Layer 3: Core Logic (Depends on Layers 0-2)
├── core/QueryBuilder.ts        # OData query construction
├── core/PaginationHandler.ts   # Pagination logic
├── core/RequestBuilder.ts      # HTTP request building
└── core/RetryUtils.ts          # Retry logic with backoff

Layer 4: API Client (Depends on Layers 0-3)
├── core/ApiClient.ts           # Main API client
└── GenericFunctions.ts         # Helper functions for n8n

Layer 5: Strategies (Depends on Layers 0-4)
├── strategies/base/CrudStrategy.ts              # Base class
├── strategies/CreateEntityStrategy.ts
├── strategies/GetEntityStrategy.ts
├── strategies/GetAllEntitiesStrategy.ts
├── strategies/UpdateEntityStrategy.ts
├── strategies/DeleteEntityStrategy.ts
└── strategies/FunctionImportStrategy.ts

Layer 6: Node Definition (Depends on Layers 0-5)
├── strategies/OperationStrategyFactory.ts
├── SapOData.node.ts            # Main node implementation
└── credentials/SapOdataApi.credentials.ts
```

### Detailed Dependency Rules

#### ✅ Allowed Dependencies (Bottom-Up)
- **Layer N** can import from **Layer N-1 or below**
- **Utilities** can import from **Foundation**
- **Core Services** can import from **Utilities** and **Foundation**
- **Strategies** can import from **Core** and below

#### ❌ Forbidden Dependencies
- **No circular imports** between modules in the same layer
- **No upward dependencies** (e.g., Foundation cannot import from Utilities)
- **No cross-layer skipping** (e.g., Strategies should not directly import from Foundation, use intermediate layers)

### Module Descriptions

#### Layer 0: Foundation

**types.ts**
- Purpose: All TypeScript interfaces and type definitions
- Dependencies: None
- Exports: `IODataQueryOptions`, `ISapOdataCredentials`, `IErrorContext`, etc.

**constants.ts**
- Purpose: Configuration constants and defaults
- Dependencies: None
- Exports: `DEFAULT_PAGE_SIZE`, `CSRF_TOKEN_TTL`, `ERROR_MESSAGES`, etc.

#### Layer 1: Utilities

**Logger.ts**
- Purpose: Centralized logging with debug support
- Dependencies: None
- Exports: `Logger.debug()`, `Logger.info()`, `Logger.warn()`, `Logger.error()`
- Note: Thread-safe, can be called from any layer

**SecurityUtils.ts**
- Purpose: Security validation and sanitization
- Dependencies: `types.ts`, n8n-workflow
- Exports:
  - `buildSecureUrl()` - URL validation
  - `validateEntityKey()` - SQL injection prevention
  - `validateODataFilter()` - XSS prevention
  - `sanitizeErrorMessage()` - Credential masking
  - `validateJsonInput()` - JSON validation

#### Layer 2: Core Services

**ErrorHandler.ts**
- Purpose: Centralized error handling with SAP-specific errors
- Dependencies: `SecurityUtils`, `constants`, `types`
- Exports: `ODataErrorHandler.handleApiError()`, `handleValidationError()`
- Note: All errors should flow through this module

**CacheManager.ts**
- Purpose: CSRF token and metadata caching with TTL
- Dependencies: `constants`, `types`
- Exports: `getCsrfToken()`, `setCsrfToken()`, `getMetadata()`, `setMetadata()`
- Storage: Uses n8n WorkflowStaticData for persistence

**ConnectionPoolManager.ts**
- Purpose: HTTP/HTTPS connection pooling
- Dependencies: `constants`, `types`, Node.js `http/https`
- Exports: `getInstance()`, `getAgent()`, `updateConfig()`, `getStats()`
- Pattern: Singleton with per-credential isolation

**ThrottleManager.ts**
- Purpose: Rate limiting with multiple strategies
- Dependencies: `constants`, `types`
- Exports: `ThrottleManager` class
- Strategies: TokenBucket, LeakyBucket, FixedWindow, SlidingWindow
- Note: Scoped to workflow via WorkflowStaticData (not global singleton)

#### Layer 3: Core Logic

**core/QueryBuilder.ts**
- Purpose: OData query parameter construction
- Dependencies: `SecurityUtils`, `types`
- Exports:
  - `buildODataQuery()` - Build query object
  - `buildODataFilter()` - Build filter strings
  - `normalizeODataOptions()` - Add $ prefix
  - `parseMetadataForEntitySets()` - Parse $metadata XML
  - `parseMetadataForFunctionImports()` - Parse function imports

**core/PaginationHandler.ts**
- Purpose: Automatic pagination for large result sets
- Dependencies: `Logger`, `SecurityUtils`, `constants`, `types`
- Exports:
  - `fetchAllItems()` - Fetch with pagination
  - `streamAllItems()` - Generator for streaming
  - `extractItemsFromResponse()` - Extract items
  - `extractNextLink()` - Get next page URL

**core/RequestBuilder.ts**
- Purpose: Build HTTP request options
- Dependencies: `SecurityUtils`, `Logger`, `ConnectionPoolManager`, `types`
- Exports: `buildRequestOptions()`
- Features: Custom headers, SAP headers, SSL validation, connection pooling

**core/RetryUtils.ts**
- Purpose: Retry logic with exponential backoff
- Dependencies: `constants`
- Exports: `withRetry()`
- Features: Jitter, retryable error detection, configurable attempts

#### Layer 4: API Client

**core/ApiClient.ts**
- Purpose: Main API client with throttling
- Dependencies: `RequestBuilder`, `RetryUtils`, `ThrottleManager`, `ErrorHandler`
- Exports: `executeRequest()`
- Features: Throttling, retries, error handling, connection pooling

**GenericFunctions.ts**
- Purpose: Helper functions for n8n node
- Dependencies: `ApiClient`, `CacheManager`, `QueryBuilder`, `PaginationHandler`, `SecurityUtils`
- Exports:
  - `sapOdataApiRequest()` - Make authenticated request
  - `sapOdataApiRequestAllItems()` - Fetch all with pagination
  - `getCsrfToken()` - Get/fetch CSRF token
  - `formatSapODataValue()` - Format SAP data types

#### Layer 5: Strategies (Strategy Pattern)

**strategies/base/CrudStrategy.ts**
- Purpose: Base class for all operation strategies
- Dependencies: `SecurityUtils`, `QueryBuilder`, `Logger`, `types`
- Provides:
  - `getEntitySet()` - Get entity set name
  - `validateAndFormatKey()` - Validate entity keys
  - `getQueryOptions()` - Build query options
  - `extractResult()` - Extract OData response
  - `validateAndParseJson()` - Parse JSON input
  - `formatSuccessResponse()` - Format output
  - `handleOperationError()` - Error handling

**Individual Strategies**
- All extend `CrudStrategy`
- Implement `IOperationStrategy` interface
- Dependencies: `CrudStrategy`, `GenericFunctions`, `SecurityUtils`
- Each handles one operation type:
  - CreateEntityStrategy - POST new entity
  - GetEntityStrategy - GET single entity
  - GetAllEntitiesStrategy - GET collection with pagination
  - UpdateEntityStrategy - PATCH existing entity
  - DeleteEntityStrategy - DELETE entity
  - FunctionImportStrategy - Call function imports

#### Layer 6: Node Definition

**strategies/OperationStrategyFactory.ts**
- Purpose: Factory for creating strategy instances
- Dependencies: All strategy classes
- Exports: `OperationStrategyFactory.createStrategy()`
- Pattern: Factory pattern for strategy selection

**SapOData.node.ts**
- Purpose: Main n8n node implementation
- Dependencies: `OperationStrategyFactory`, `CacheManager`, `ErrorHandler`, all strategies
- Implements: n8n INodeType interface
- Features:
  - Node metadata (displayName, description, icon, etc.)
  - Properties definition (inputs/outputs)
  - LoadOptions methods (dynamic dropdowns)
  - Execute method (main entry point)

**credentials/SapOdataApi.credentials.ts**
- Purpose: Credential definition for SAP OData
- Dependencies: n8n-workflow only
- Implements: n8n ICredentialType interface
- Features: Basic Auth, SSL configuration, SAP headers

### Preventing Cyclic Dependencies

#### Rules to Follow

1. **Import Direction**: Always import from lower layers to higher layers
2. **Shared Code**: Put shared code in the lowest applicable layer
3. **Interface Segregation**: Use interfaces in lower layers, implementations in higher layers
4. **Factory Pattern**: Use factories to break circular dependencies
5. **Dependency Injection**: Pass dependencies through constructors/parameters

#### Example: Breaking a Circular Dependency

**❌ Bad** (Circular):
```typescript
// GenericFunctions.ts
import { ODataErrorHandler } from './ErrorHandler';

// ErrorHandler.ts
import { sapOdataApiRequest } from './GenericFunctions'; // Circular!
```

**✅ Good** (Using Dependency Injection):
```typescript
// GenericFunctions.ts
import { ODataErrorHandler } from './ErrorHandler';

export async function sapOdataApiRequest() {
  try {
    // ...
  } catch (error) {
    ODataErrorHandler.handleApiError(error, node);
  }
}

// ErrorHandler.ts
// No import of GenericFunctions needed!
// Errors are passed in as parameters
```

### Architecture Patterns Used

#### 1. Strategy Pattern
- **Purpose**: Different operations (Create, Get, Update, Delete)
- **Implementation**: `IOperationStrategy` interface + concrete strategies
- **Benefits**: Easy to add new operations, testable in isolation

#### 2. Factory Pattern
- **Purpose**: Create strategy instances
- **Implementation**: `OperationStrategyFactory`
- **Benefits**: Centralized strategy creation, loose coupling

#### 3. Singleton Pattern
- **Purpose**: Connection pool manager
- **Implementation**: `ConnectionPoolManager.getInstance()`
- **Benefits**: Share connections across requests, resource efficiency
- **Note**: ThrottleManager is NOT a singleton (workflow-scoped)

#### 4. Repository Pattern
- **Purpose**: Data access abstraction
- **Implementation**: `CacheManager` for CSRF/metadata
- **Benefits**: Centralized caching logic, easy to swap storage

#### 5. Template Method Pattern
- **Purpose**: Common flow in CrudStrategy
- **Implementation**: `CrudStrategy` base class with hooks
- **Benefits**: Code reuse, consistent behavior

### Testing Architecture

#### Test Layers
```
test/
├── unit/                           # Unit tests (isolated)
│   ├── GenericFunctions.test.ts
│   ├── SecurityUtils.test.ts
│   ├── ErrorHandler.test.ts
│   └── ...
├── strategies/                     # Strategy tests
│   ├── CreateEntityStrategy.test.ts
│   └── ...
├── core/                          # Core module tests
│   ├── QueryBuilder.test.ts
│   └── ...
├── EdgeCases.test.ts              # Edge case scenarios
└── fixtures/                       # Test data (shared)
    ├── metadata.xml
    └── responses/
```

#### Test Dependencies
- Tests can import from any layer
- Tests should mock external dependencies (n8n, HTTP)
- Use fixtures for complex test data

### Performance Considerations

#### Critical Paths
1. **Request Execution**: `SapOData.execute()` → Strategy → GenericFunctions → ApiClient
2. **Pagination**: `fetchAllItems()` → loop → `sapOdataApiRequest()`
3. **CSRF Flow**: Check cache → Fetch if missing → Cache result

#### Optimization Points
- **Connection Pooling**: Reuse HTTP connections (Layer 2)
- **Caching**: CSRF tokens (10min TTL), Metadata (5min TTL)
- **Throttling**: Rate limiting per workflow
- **Pagination**: Stream large datasets to avoid memory issues

### Extension Points

#### Adding a New Operation
1. Create new strategy in `strategies/` (Layer 5)
2. Extend `CrudStrategy` base class
3. Implement `IOperationStrategy.execute()`
4. Register in `OperationStrategyFactory`
5. Add node parameter in `SapOData.node.ts`
6. Write tests in `test/strategies/`

#### Adding a New Cache Type
1. Add interface to `types.ts` (Layer 0)
2. Add TTL constant to `constants.ts` (Layer 0)
3. Extend `CacheManager` (Layer 2)
4. Add get/set methods
5. Write tests

#### Adding New Security Validation
1. Add function to `SecurityUtils.ts` (Layer 1)
2. Call from appropriate layer (QueryBuilder, RequestBuilder, etc.)
3. Write tests in `test/SecurityUtils.test.ts`

### Dependencies on External Libraries

#### Runtime Dependencies
- `n8n-workflow`: Core n8n types and utilities (peerDependency)
- Node.js built-ins: `http`, `https`, `url`

#### Development Dependencies
- `typescript`: Type checking
- `jest`: Test framework
- `@types/*`: TypeScript type definitions

### Conclusion

This architecture provides:
- ✅ Clear separation of concerns
- ✅ No circular dependencies
- ✅ Easy testability
- ✅ Good extensibility
- ✅ Performance optimization points
- ✅ Consistent patterns across codebase

When adding new features, always:
1. Identify the correct layer
2. Check dependency direction
3. Reuse existing patterns
4. Write tests
5. Update this documentation
