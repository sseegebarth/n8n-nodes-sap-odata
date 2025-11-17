# OData Batch Implementation Guide

**Status**: 📋 Design Complete - Ready for Implementation
**Estimated Time**: 5-7 days
**Complexity**: High
**n8n Alignment**: ⭐⭐⭐⭐⭐ (100%)

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [What is OData Batch?](#what-is-odata-batch)
3. [Architecture](#architecture)
4. [Implementation Steps](#implementation-steps)
5. [File-by-File Breakdown](#file-by-file-breakdown)
6. [Testing Strategy](#testing-strategy)
7. [Common Pitfalls](#common-pitfalls)
8. [References](#references)

---

## Overview

### What We're Building

A complete OData `$batch` implementation that allows processing multiple operations (Create, Update, Delete) in a single HTTP request.

### Benefits

**Performance**:
- 10-50x faster than individual requests
- Reduced network overhead
- Fewer CSRF token requests

**Use Cases**:
- Bulk data imports (100s-1000s of records)
- Mass updates across entities
- Transactional operations

**Example Impact**:
```javascript
// Without Batch: 100 orders × 200ms = 20 seconds
// With Batch:    10 batches × 300ms = 3 seconds
// Result: 85% faster! 🚀
```

---

## What is OData Batch?

### Concept

OData `$batch` allows sending multiple operations in a **single HTTP request** using multipart/mixed encoding.

### Request Format

```http
POST /sap/opu/odata/sap/API_SALES_ORDER_SRV/$batch
Content-Type: multipart/mixed; boundary=batch_123

--batch_123
Content-Type: multipart/mixed; boundary=changeset_456

--changeset_456
Content-Type: application/http
Content-Transfer-Encoding: binary

POST SalesOrderSet HTTP/1.1
Content-Type: application/json

{"SoldToParty": "0010000000", "PurchaseOrderByCustomer": "PO-001"}

--changeset_456
Content-Type: application/http
Content-Transfer-Encoding: binary

POST SalesOrderSet HTTP/1.1
Content-Type: application/json

{"SoldToParty": "0010000001", "PurchaseOrderByCustomer": "PO-002"}

--changeset_456--
--batch_123--
```

### Response Format

```http
HTTP/1.1 200 OK
Content-Type: multipart/mixed; boundary=batchresponse_789

--batchresponse_789
Content-Type: multipart/mixed; boundary=changesetresponse_012

--changesetresponse_012
Content-Type: application/http

HTTP/1.1 201 Created
Content-Type: application/json

{"d": {"SalesOrder": "4500000001", "SoldToParty": "0010000000"}}

--changesetresponse_012
Content-Type: application/http

HTTP/1.1 201 Created
Content-Type: application/json

{"d": {"SalesOrder": "4500000002", "SoldToParty": "0010000001"}}

--changesetresponse_012--
--batchresponse_789--
```

### Key Concepts

#### 1. Batch Request
- Container for all operations
- Single HTTP POST to `/$batch` endpoint
- `Content-Type: multipart/mixed`

#### 2. ChangeSet
- Group of related operations
- Treated as atomic transaction (all or nothing)
- Rollback on any failure

#### 3. Boundaries
- Unique separators between parts
- Must be generated (e.g., `batch_${Date.now()}`)
- Format: `--boundary` for start, `--boundary--` for end

#### 4. Atomicity
- Operations in a ChangeSet are atomic
- SAP rolls back entire ChangeSet on error
- Multiple ChangeSets can be independent

---

## Architecture

### Component Overview

```
User Workflow (n8n)
    ↓
SapOData Node (operation: batch)
    ↓
BatchOperationStrategy.execute()
    ↓
    ├─→ BatchRequestBuilder.build()  → Multipart Request
    ├─→ sapOdataApiRequest()         → Send to SAP
    └─→ BatchResponseParser.parse()  → Individual Results
    ↓
Return Results (mapped to input items)
```

### Data Flow

```javascript
// Input: n8n items
[
  { json: { SoldToParty: "0010000000", Amount: 1000 } },
  { json: { SoldToParty: "0010000001", Amount: 2000 } },
  { json: { SoldToParty: "0010000002", Amount: 3000 } }
]

// Step 1: Build Batch Request (BatchRequestBuilder)
POST /$batch
multipart/mixed with 3 POST operations

// Step 2: Send to SAP (sapOdataApiRequest)
→ SAP processes all operations

// Step 3: Parse Response (BatchResponseParser)
[
  { status: 201, SalesOrder: "4500000001" },
  { status: 201, SalesOrder: "4500000002" },
  { status: 201, SalesOrder: "4500000003" }
]

// Output: n8n items with results
[
  { json: { SalesOrder: "4500000001", success: true } },
  { json: { SalesOrder: "4500000002", success: true } },
  { json: { SalesOrder: "4500000003", success: true } }
]
```

---

## Implementation Steps

### Phase 1: Core Components (Days 1-2)

#### Day 1: BatchRequestBuilder

**File**: `nodes/Shared/core/BatchRequestBuilder.ts`

**Responsibilities**:
- Generate unique boundaries
- Build multipart request structure
- Encode individual operations
- Handle different HTTP methods (POST, PATCH, DELETE)

**Key Functions**:
```typescript
export class BatchRequestBuilder {
  static build(
    items: INodeExecutionData[],
    operation: string,
    entitySet: string,
    servicePath: string
  ): { body: string; contentType: string }

  private static generateBoundary(type: 'batch' | 'changeset'): string
  private static buildChangeSet(items: INodeExecutionData[], ...): string
  private static buildOperation(item: INodeExecutionData[], ...): string
}
```

#### Day 2: BatchResponseParser

**File**: `nodes/Shared/core/BatchResponseParser.ts`

**Responsibilities**:
- Parse multipart response
- Extract individual operation results
- Map results back to input items
- Handle errors per operation

**Key Functions**:
```typescript
export class BatchResponseParser {
  static parse(response: string, itemCount: number): INodeExecutionData[]

  private static extractBoundary(response: string): string
  private static splitParts(response: string, boundary: string): string[]
  private static parseOperation(part: string): IOperationResult
}
```

### Phase 2: Strategy Implementation (Days 3-4)

#### Day 3: BatchOperationStrategy

**File**: `nodes/Shared/strategies/BatchOperationStrategy.ts`

**Responsibilities**:
- Orchestrate batch operation
- Split items into batches (chunk by batchSize)
- Call builder, send request, parse response
- Aggregate results

**Key Functions**:
```typescript
export class BatchOperationStrategy implements IOperationStrategy {
  async execute(
    context: IExecuteFunctions,
    itemIndex: number
  ): Promise<INodeExecutionData[]>

  private splitIntoBatches(items: INodeExecutionData[], batchSize: number)
  private processBatch(batch: INodeExecutionData[]): Promise<INodeExecutionData[]>
}
```

#### Day 4: Integration

**Files**:
- `nodes/Shared/strategies/OperationStrategyFactory.ts` - Add batch strategy
- `nodes/Sap/SapODataProperties.ts` - Add UI parameters
- `nodes/Sap/SapOData.node.ts` - Wire up batch operation

### Phase 3: Testing & Documentation (Days 5-7)

#### Day 5: Unit Tests

**Files**:
- `test/core/BatchRequestBuilder.test.ts`
- `test/core/BatchResponseParser.test.ts`
- `test/strategies/BatchOperationStrategy.test.ts`

#### Day 6: Integration Tests

**Files**:
- `test/BatchIntegration.test.ts`
- Test with mock SAP responses
- Test error scenarios

#### Day 7: Documentation

**Files**:
- `docs/BATCH_OPERATIONS.md`
- Update `docs/cookbook/07-batch-operations.md`
- Add examples to README

---

## File-by-File Breakdown

### 1. BatchRequestBuilder.ts

**Location**: `nodes/Shared/core/BatchRequestBuilder.ts`

**Size**: ~200-250 lines

**Key Implementation**:

```typescript
import { INodeExecutionData, IDataObject } from 'n8n-workflow';

export interface IBatchRequest {
  body: string;
  contentType: string;
}

export interface IBatchConfig {
  items: INodeExecutionData[];
  operation: 'create' | 'update' | 'delete';
  entitySet: string;
  servicePath: string;
  useChangeSet?: boolean; // Default: true for transactional
}

export class BatchRequestBuilder {
  /**
   * Build a complete $batch request
   */
  static build(config: IBatchConfig): IBatchRequest {
    const batchBoundary = this.generateBoundary('batch');
    const changeSetBoundary = this.generateBoundary('changeset');

    let body = `--${batchBoundary}\r\n`;

    if (config.useChangeSet !== false) {
      // Wrap in ChangeSet for atomicity
      body += `Content-Type: multipart/mixed; boundary=${changeSetBoundary}\r\n\r\n`;
      body += this.buildChangeSet(config, changeSetBoundary);
      body += `--${changeSetBoundary}--\r\n`;
    } else {
      // Individual operations (no transaction)
      body += this.buildOperations(config);
    }

    body += `--${batchBoundary}--\r\n`;

    return {
      body,
      contentType: `multipart/mixed; boundary=${batchBoundary}`,
    };
  }

  /**
   * Generate unique boundary string
   */
  private static generateBoundary(type: 'batch' | 'changeset'): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Build ChangeSet with all operations
   */
  private static buildChangeSet(config: IBatchConfig, boundary: string): string {
    let changeset = '';

    config.items.forEach((item, index) => {
      changeset += `--${boundary}\r\n`;
      changeset += `Content-Type: application/http\r\n`;
      changeset += `Content-Transfer-Encoding: binary\r\n`;
      changeset += `Content-ID: ${index + 1}\r\n\r\n`;

      changeset += this.buildOperation(item, config, index);
      changeset += `\r\n`;
    });

    return changeset;
  }

  /**
   * Build single operation (POST, PATCH, DELETE)
   */
  private static buildOperation(
    item: INodeExecutionData,
    config: IBatchConfig,
    index: number
  ): string {
    const method = this.getHttpMethod(config.operation);
    const path = this.getOperationPath(item, config);
    const body = this.getOperationBody(item, config);

    let operation = `${method} ${path} HTTP/1.1\r\n`;
    operation += `Content-Type: application/json\r\n`;

    if (body) {
      operation += `\r\n${JSON.stringify(body)}`;
    }

    return operation;
  }

  /**
   * Get HTTP method for operation
   */
  private static getHttpMethod(operation: string): string {
    const methodMap: Record<string, string> = {
      create: 'POST',
      update: 'PATCH',
      delete: 'DELETE',
    };
    return methodMap[operation] || 'POST';
  }

  /**
   * Get operation path (relative URL)
   */
  private static getOperationPath(
    item: INodeExecutionData,
    config: IBatchConfig
  ): string {
    const { operation, entitySet } = config;

    if (operation === 'create') {
      return `${entitySet}`;
    }

    // Update/Delete need entity key
    const key = this.extractEntityKey(item);
    return `${entitySet}(${key})`;
  }

  /**
   * Extract entity key from item
   */
  private static extractEntityKey(item: INodeExecutionData): string {
    // Priority: explicit _key field > first field
    if (item.json._key) {
      return this.formatKey(item.json._key as string);
    }

    // Try common key fields
    const keyFields = ['ID', 'Key', 'SalesOrder', 'BusinessPartner'];
    for (const field of keyFields) {
      if (item.json[field]) {
        return this.formatKey(item.json[field] as string);
      }
    }

    throw new Error('No entity key found in item. Add _key field or specify key field.');
  }

  /**
   * Format entity key (add quotes for strings, not for numbers)
   */
  private static formatKey(key: string | number): string {
    if (typeof key === 'number' || /^\d+(\.\d+)?$/.test(String(key))) {
      return String(key); // Numeric key, no quotes
    }
    return `'${key}'`; // String key, add quotes
  }

  /**
   * Get operation body (for POST/PATCH)
   */
  private static getOperationBody(
    item: INodeExecutionData,
    config: IBatchConfig
  ): IDataObject | null {
    if (config.operation === 'delete') {
      return null; // DELETE has no body
    }

    // Filter out metadata fields
    const body: IDataObject = {};
    for (const [key, value] of Object.entries(item.json)) {
      if (!key.startsWith('_')) {
        body[key] = value;
      }
    }

    return body;
  }

  /**
   * Build operations without ChangeSet
   */
  private static buildOperations(config: IBatchConfig): string {
    let operations = '';

    config.items.forEach((item, index) => {
      operations += `--${this.generateBoundary('batch')}\r\n`;
      operations += `Content-Type: application/http\r\n`;
      operations += `Content-Transfer-Encoding: binary\r\n\r\n`;
      operations += this.buildOperation(item, config, index);
      operations += `\r\n`;
    });

    return operations;
  }
}
```

**Key Challenges**:
1. **Boundary Generation**: Must be unique and not appear in content
2. **CRLF Line Endings**: Must use `\r\n` (not just `\n`)
3. **Content-ID**: Sequential numbering for operation tracking
4. **Entity Key Formatting**: Strings need quotes, numbers don't

**Testing**:
```typescript
// Test: Build batch with 3 creates
const config = {
  items: [
    { json: { Name: 'Customer 1', City: 'Berlin' } },
    { json: { Name: 'Customer 2', City: 'Munich' } },
    { json: { Name: 'Customer 3', City: 'Hamburg' } }
  ],
  operation: 'create',
  entitySet: 'A_BusinessPartner',
  servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/'
};

const request = BatchRequestBuilder.build(config);

expect(request.contentType).toContain('multipart/mixed');
expect(request.body).toContain('POST A_BusinessPartner HTTP/1.1');
expect(request.body).toContain('{"Name":"Customer 1","City":"Berlin"}');
```

---

### 2. BatchResponseParser.ts

**Location**: `nodes/Shared/core/BatchResponseParser.ts`

**Size**: ~150-200 lines

**Key Implementation**:

```typescript
import { INodeExecutionData } from 'n8n-workflow';

export interface IOperationResult {
  statusCode: number;
  success: boolean;
  data: any;
  error?: string;
  contentId?: number;
}

export class BatchResponseParser {
  /**
   * Parse $batch response and map to items
   */
  static parse(
    response: string,
    expectedCount: number
  ): INodeExecutionData[] {
    // Extract boundary from response
    const boundary = this.extractBoundary(response);

    // Split response into parts
    const parts = this.splitParts(response, boundary);

    // Parse each part
    const results: IOperationResult[] = [];
    for (const part of parts) {
      if (this.isChangeSetPart(part)) {
        // Nested ChangeSet - extract operations
        const changeSetBoundary = this.extractBoundary(part);
        const operations = this.splitParts(part, changeSetBoundary);

        for (const op of operations) {
          const result = this.parseOperation(op);
          if (result) results.push(result);
        }
      } else {
        // Individual operation
        const result = this.parseOperation(part);
        if (result) results.push(result);
      }
    }

    // Validate count
    if (results.length !== expectedCount) {
      console.warn(`Expected ${expectedCount} results, got ${results.length}`);
    }

    // Map to n8n items
    return this.mapToItems(results);
  }

  /**
   * Extract boundary from Content-Type header
   */
  private static extractBoundary(content: string): string {
    const match = content.match(/boundary=([^\r\n;]+)/);
    if (!match) {
      throw new Error('Could not extract boundary from batch response');
    }
    return match[1].trim();
  }

  /**
   * Split multipart content by boundary
   */
  private static splitParts(content: string, boundary: string): string[] {
    const parts: string[] = [];
    const delimiter = `--${boundary}`;
    const sections = content.split(delimiter);

    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed && trimmed !== '--') {
        parts.push(trimmed);
      }
    }

    return parts;
  }

  /**
   * Check if part is a ChangeSet
   */
  private static isChangeSetPart(part: string): boolean {
    return part.includes('Content-Type: multipart/mixed');
  }

  /**
   * Parse single operation response
   */
  private static parseOperation(part: string): IOperationResult | null {
    // Extract HTTP status
    const statusMatch = part.match(/HTTP\/1\.\d+\s+(\d+)/);
    if (!statusMatch) {
      return null; // Not an HTTP response
    }

    const statusCode = parseInt(statusMatch[1], 10);
    const success = statusCode >= 200 && statusCode < 300;

    // Extract Content-ID
    const contentIdMatch = part.match(/Content-ID:\s*(\d+)/i);
    const contentId = contentIdMatch ? parseInt(contentIdMatch[1], 10) : undefined;

    // Extract JSON body
    let data: any = {};
    let error: string | undefined;

    const jsonMatch = part.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);

        if (success) {
          // Success: extract data
          data = json.d || json;
        } else {
          // Error: extract error message
          error = json.error?.message?.value || json.error?.message || JSON.stringify(json.error);
          data = json;
        }
      } catch (e) {
        error = `Failed to parse JSON: ${e.message}`;
      }
    }

    return {
      statusCode,
      success,
      data,
      error,
      contentId,
    };
  }

  /**
   * Map operation results to n8n items
   */
  private static mapToItems(results: IOperationResult[]): INodeExecutionData[] {
    return results.map((result, index) => ({
      json: {
        ...result.data,
        _batchResult: {
          statusCode: result.statusCode,
          success: result.success,
          error: result.error,
          contentId: result.contentId,
          index: index,
        },
      },
      pairedItem: { item: result.contentId ? result.contentId - 1 : index },
    }));
  }
}
```

**Key Challenges**:
1. **Nested Parsing**: ChangeSet within Batch (2 levels)
2. **Boundary Extraction**: Must handle variations in format
3. **Error Handling**: Some operations succeed, others fail
4. **Content-ID Mapping**: Map responses back to input order

**Testing**:
```typescript
// Test: Parse batch response with 2 successes, 1 error
const response = `HTTP/1.1 200 OK
Content-Type: multipart/mixed; boundary=batchresponse_abc

--batchresponse_abc
Content-Type: multipart/mixed; boundary=changesetresponse_def

--changesetresponse_def
Content-Type: application/http
Content-ID: 1

HTTP/1.1 201 Created
Content-Type: application/json

{"d":{"SalesOrder":"4500000001"}}

--changesetresponse_def
Content-Type: application/http
Content-ID: 2

HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":{"message":{"value":"Invalid data"}}}

--changesetresponse_def
Content-Type: application/http
Content-ID: 3

HTTP/1.1 201 Created
Content-Type: application/json

{"d":{"SalesOrder":"4500000002"}}

--changesetresponse_def--
--batchresponse_abc--`;

const results = BatchResponseParser.parse(response, 3);

expect(results).toHaveLength(3);
expect(results[0].json.SalesOrder).toBe('4500000001');
expect(results[0].json._batchResult.success).toBe(true);
expect(results[1].json._batchResult.success).toBe(false);
expect(results[1].json._batchResult.error).toContain('Invalid data');
expect(results[2].json.SalesOrder).toBe('4500000002');
```

---

### 3. BatchOperationStrategy.ts

**Location**: `nodes/Shared/strategies/BatchOperationStrategy.ts`

**Size**: ~150-180 lines

**Key Implementation**:

```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { BatchRequestBuilder } from '../core/BatchRequestBuilder';
import { BatchResponseParser } from '../core/BatchResponseParser';
import { sapOdataApiRequest } from '../../Sap/GenericFunctions';

export class BatchOperationStrategy implements IOperationStrategy {
  async execute(
    context: IExecuteFunctions,
    itemIndex: number
  ): Promise<INodeExecutionData[]> {
    // Get all input items
    const items = context.getInputData();

    // Get batch configuration
    const operation = context.getNodeParameter('operation', itemIndex) as string;
    const entitySet = this.getEntitySet(context, itemIndex);
    const batchSize = context.getNodeParameter('batchSize', itemIndex, 100) as number;
    const useTransaction = context.getNodeParameter('useTransaction', itemIndex, true) as boolean;

    // Get service path
    const servicePath = this.resolveServicePath(context);

    // Split items into batches
    const batches = this.splitIntoBatches(items, batchSize);

    const allResults: INodeExecutionData[] = [];

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const results = await this.processBatch(
          context,
          batch,
          operation,
          entitySet,
          servicePath,
          useTransaction
        );

        allResults.push(...results);
      } catch (error) {
        // Handle batch error
        const errorMessage = error instanceof Error ? error.message : String(error);

        throw new NodeOperationError(
          context.getNode(),
          `Batch ${i + 1}/${batches.length} failed: ${errorMessage}`,
          {
            itemIndex: i * batchSize,
            description: `Failed to process batch of ${batch.length} items`,
          }
        );
      }
    }

    return allResults;
  }

  /**
   * Split items into batches
   */
  private splitIntoBatches(
    items: INodeExecutionData[],
    batchSize: number
  ): INodeExecutionData[][] {
    const batches: INodeExecutionData[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process a single batch
   */
  private async processBatch(
    context: IExecuteFunctions,
    items: INodeExecutionData[],
    operation: string,
    entitySet: string,
    servicePath: string,
    useTransaction: boolean
  ): Promise<INodeExecutionData[]> {
    // Build batch request
    const batchRequest = BatchRequestBuilder.build({
      items,
      operation: operation as any,
      entitySet,
      servicePath,
      useChangeSet: useTransaction,
    });

    // Send to SAP
    const response = await sapOdataApiRequest.call(
      context,
      'POST',
      '/$batch',
      batchRequest.body,
      {},
      undefined,
      {
        headers: {
          'Content-Type': batchRequest.contentType,
        },
        // Don't parse as JSON - we need raw multipart response
        json: false,
      },
      servicePath
    );

    // Parse response
    const results = BatchResponseParser.parse(
      typeof response === 'string' ? response : JSON.stringify(response),
      items.length
    );

    return results;
  }

  /**
   * Get entity set name
   */
  private getEntitySet(context: IExecuteFunctions, itemIndex: number): string {
    const entitySetMode = context.getNodeParameter('entitySetMode', itemIndex, 'list') as string;

    if (entitySetMode === 'list') {
      return context.getNodeParameter('entitySet', itemIndex) as string;
    } else {
      return context.getNodeParameter('customEntitySet', itemIndex) as string;
    }
  }

  /**
   * Resolve service path
   */
  private resolveServicePath(context: IExecuteFunctions): string {
    const { resolveServicePath } = require('../../Sap/GenericFunctions');
    return resolveServicePath(context);
  }
}
```

**Key Responsibilities**:
1. Orchestrate batch processing
2. Split items into configurable batch sizes
3. Call builder and parser
4. Aggregate results
5. Error handling per batch

---

### 4. UI Parameters (SapODataProperties.ts)

**Changes Needed**:

```typescript
// Add to operations list
{
  name: 'Batch Operations',
  value: 'batch',
  description: 'Execute multiple operations in a single request (bulk create/update/delete)',
  action: 'Batch operations',
}

// Batch-specific parameters
{
  displayName: 'Batch Operation Type',
  name: 'batchOperation',
  type: 'options',
  displayOptions: {
    show: {
      operation: ['batch'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description: 'Create multiple entities',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update multiple entities',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete multiple entities',
    },
  ],
  default: 'create',
  description: 'Type of operation to perform on all items',
},
{
  displayName: 'Batch Size',
  name: 'batchSize',
  type: 'number',
  displayOptions: {
    show: {
      operation: ['batch'],
    },
  },
  default: 100,
  description: 'Number of operations per batch request',
  hint: 'SAP supports up to 1000 operations per batch. Smaller batches = more requests but better error isolation.',
  typeOptions: {
    minValue: 1,
    maxValue: 1000,
  },
},
{
  displayName: 'Use Transaction (ChangeSet)',
  name: 'useTransaction',
  type: 'boolean',
  displayOptions: {
    show: {
      operation: ['batch'],
    },
  },
  default: true,
  description: 'Whether to use transactional ChangeSet (all or nothing)',
  hint: 'When enabled, all operations in a batch either succeed together or fail together (rollback).',
},
```

---

### 5. Factory Integration

**File**: `nodes/Shared/strategies/OperationStrategyFactory.ts`

**Changes**:

```typescript
import { BatchOperationStrategy } from './BatchOperationStrategy';

// Add to factory
case 'batch':
  return new BatchOperationStrategy();
```

---

## Testing Strategy

### Unit Tests

#### 1. BatchRequestBuilder.test.ts

```typescript
describe('BatchRequestBuilder', () => {
  it('should build batch with single create', () => {
    const config = {
      items: [{ json: { Name: 'Test' } }],
      operation: 'create' as const,
      entitySet: 'TestSet',
      servicePath: '/test/',
    };

    const result = BatchRequestBuilder.build(config);

    expect(result.contentType).toContain('multipart/mixed');
    expect(result.body).toContain('POST TestSet HTTP/1.1');
    expect(result.body).toContain('{"Name":"Test"}');
  });

  it('should format numeric keys without quotes', () => {
    // Test implementation
  });

  it('should format string keys with quotes', () => {
    // Test implementation
  });

  it('should handle composite keys', () => {
    // Test implementation
  });
});
```

#### 2. BatchResponseParser.test.ts

```typescript
describe('BatchResponseParser', () => {
  it('should parse successful batch response', () => {
    const response = '...'; // Mock multipart response

    const results = BatchResponseParser.parse(response, 2);

    expect(results).toHaveLength(2);
    expect(results[0].json._batchResult.success).toBe(true);
  });

  it('should handle mixed success and errors', () => {
    // Test implementation
  });

  it('should preserve Content-ID mapping', () => {
    // Test implementation
  });
});
```

#### 3. BatchOperationStrategy.test.ts

```typescript
describe('BatchOperationStrategy', () => {
  it('should split items into batches', () => {
    // Test implementation
  });

  it('should process batch and return results', async () => {
    // Test with mocked sapOdataApiRequest
  });

  it('should handle batch errors gracefully', async () => {
    // Test error scenarios
  });
});
```

### Integration Tests

#### BatchIntegration.test.ts

```typescript
describe('Batch Integration', () => {
  it('should create 100 entities in batches of 10', async () => {
    // Full end-to-end test with nock
  });

  it('should handle partial batch failure', async () => {
    // Test rollback behavior
  });

  it('should maintain order of results', async () => {
    // Verify Content-ID mapping
  });
});
```

---

## Common Pitfalls

### 1. CRLF Line Endings ⚠️

**Problem**: Using `\n` instead of `\r\n`

```typescript
// ❌ Wrong
body += `--boundary\n`;

// ✅ Correct
body += `--boundary\r\n`;
```

**Impact**: SAP rejects request with 400 Bad Request

### 2. Boundary in Content ⚠️

**Problem**: Boundary string appears in request content

```typescript
// ❌ Bad: Simple boundary
const boundary = 'batch';

// ✅ Good: Unique boundary
const boundary = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
```

**Impact**: Parser fails, incorrect splitting

### 3. Missing Content-Transfer-Encoding ⚠️

**Problem**: Omitting required header

```typescript
// ❌ Missing
--changeset_123
Content-Type: application/http

POST EntitySet HTTP/1.1

// ✅ Complete
--changeset_123
Content-Type: application/http
Content-Transfer-Encoding: binary

POST EntitySet HTTP/1.1
```

**Impact**: SAP may reject or misparse request

### 4. Incorrect Entity Key Format ⚠️

**Problem**: Not handling numeric vs string keys

```typescript
// ❌ Wrong: Quotes on numeric key
SalesOrderSet('123')

// ✅ Correct: No quotes for numeric
SalesOrderSet(123)

// ✅ Correct: Quotes for string
BusinessPartnerSet('0010000000')
```

**Impact**: 404 Not Found errors

### 5. Response Parsing Fragility ⚠️

**Problem**: Assuming fixed format

```typescript
// ❌ Fragile: Assumes exact spacing
const match = response.match(/HTTP\/1.1 (\d+) /);

// ✅ Robust: Flexible matching
const match = response.match(/HTTP\/1\.\d+\s+(\d+)/);
```

**Impact**: Parser fails on valid responses

### 6. Transaction vs Non-Transaction ⚠️

**Problem**: Not understanding ChangeSet behavior

```typescript
// ChangeSet (all or nothing)
- Item 1: Success
- Item 2: Fail
- Item 3: Success
Result: ALL rolled back

// No ChangeSet (independent)
- Item 1: Success ✓
- Item 2: Fail ✗
- Item 3: Success ✓
Result: 2 succeeded, 1 failed
```

**Impact**: Unexpected rollbacks

---

## References

### SAP Documentation

1. **OData V2 Batch Processing**
   - https://www.odata.org/documentation/odata-version-2-0/batch-processing/

2. **SAP Gateway Batch Operations**
   - SAP Help Portal: "SAP Gateway and OData → Batch Operations"

3. **Multipart MIME Format**
   - RFC 2046: https://tools.ietf.org/html/rfc2046

### Example SAP Services Supporting Batch

- `API_BUSINESS_PARTNER`
- `API_SALES_ORDER_SRV`
- `API_PURCHASEORDER_PROCESS_SRV`
- Most SAP S/4HANA Cloud APIs

### Testing Resources

**Mock SAP Response Generator**:
```typescript
function generateMockBatchResponse(operations: number, errorAt?: number): string {
  const boundary = 'batchresponse_test';
  const changesetBoundary = 'changesetresponse_test';

  let response = `HTTP/1.1 200 OK\r\nContent-Type: multipart/mixed; boundary=${boundary}\r\n\r\n`;
  response += `--${boundary}\r\n`;
  response += `Content-Type: multipart/mixed; boundary=${changesetBoundary}\r\n\r\n`;

  for (let i = 1; i <= operations; i++) {
    response += `--${changesetBoundary}\r\n`;
    response += `Content-Type: application/http\r\nContent-ID: ${i}\r\n\r\n`;

    if (errorAt === i) {
      response += `HTTP/1.1 400 Bad Request\r\n`;
      response += `Content-Type: application/json\r\n\r\n`;
      response += `{"error":{"message":{"value":"Test error at operation ${i}"}}}\r\n`;
    } else {
      response += `HTTP/1.1 201 Created\r\n`;
      response += `Content-Type: application/json\r\n\r\n`;
      response += `{"d":{"ID":"TEST_${i}","Name":"Entity ${i}"}}\r\n`;
    }
  }

  response += `--${changesetBoundary}--\r\n`;
  response += `--${boundary}--\r\n`;

  return response;
}
```

---

## Implementation Checklist

### Preparation (Before Starting)
- [ ] Read OData V2 Batch specification
- [ ] Review SAP Gateway documentation
- [ ] Study existing multipart implementations
- [ ] Set up test SAP system or mock

### Phase 1: Core (Days 1-2)
- [ ] Create `BatchRequestBuilder.ts`
- [ ] Implement boundary generation
- [ ] Implement multipart encoding
- [ ] Handle different operations (POST/PATCH/DELETE)
- [ ] Create `BatchResponseParser.ts`
- [ ] Implement boundary extraction
- [ ] Implement response splitting
- [ ] Implement JSON parsing
- [ ] Write unit tests for both

### Phase 2: Strategy (Days 3-4)
- [ ] Create `BatchOperationStrategy.ts`
- [ ] Implement batch splitting logic
- [ ] Integrate builder and parser
- [ ] Add error handling
- [ ] Update `OperationStrategyFactory.ts`
- [ ] Add UI parameters to `SapODataProperties.ts`
- [ ] Wire up in `SapOData.node.ts`
- [ ] Write strategy tests

### Phase 3: Testing (Days 5-6)
- [ ] Write integration tests
- [ ] Test with mock SAP responses
- [ ] Test error scenarios
- [ ] Test large batches (500-1000 items)
- [ ] Test transaction vs non-transaction
- [ ] Test all operations (create/update/delete)
- [ ] Performance testing

### Phase 4: Documentation (Day 7)
- [ ] Create `BATCH_OPERATIONS.md`
- [ ] Add cookbook guide `07-batch-operations.md`
- [ ] Update main README
- [ ] Add example workflows
- [ ] Document limitations

### Final
- [ ] Code review
- [ ] Build and lint
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Ready for production

---

## Estimated Timeline

| Phase | Task | Time | Complexity |
|-------|------|------|------------|
| **Day 1** | BatchRequestBuilder | 6-8 hours | High |
| **Day 2** | BatchResponseParser | 6-8 hours | High |
| **Day 3** | BatchOperationStrategy | 4-6 hours | Medium |
| **Day 4** | Integration & UI | 4-6 hours | Medium |
| **Day 5** | Unit Tests | 6-8 hours | Medium |
| **Day 6** | Integration Tests | 4-6 hours | Medium |
| **Day 7** | Documentation | 4-6 hours | Low |
| **Total** | | **5-7 days** | |

---

## Success Criteria

✅ **Functional Requirements**:
- Batch request building works for all operations
- Response parsing handles success and errors
- Transaction mode (ChangeSet) works correctly
- Non-transaction mode works independently
- Results correctly mapped back to input items

✅ **Performance**:
- 10-50x faster than individual requests
- Handles 1000 items in single batch
- Minimal memory overhead

✅ **Quality**:
- 100% test coverage
- All edge cases handled
- Clear error messages
- n8n-conformant

✅ **Documentation**:
- Implementation guide complete
- Cookbook guide with examples
- Troubleshooting section
- API reference

---

## Conclusion

OData Batch implementation is complex but well-defined. The key is careful attention to:
1. **Multipart encoding** (CRLF, boundaries, headers)
2. **Response parsing** (nested structures, error handling)
3. **Testing** (unit + integration with real SAP responses)

With this guide, implementation should take 5-7 days and result in a production-ready feature that provides 10-50x performance improvement for bulk operations. 🚀

---

**Status**: 📋 Ready for Implementation
**Last Updated**: 2025-10-27
