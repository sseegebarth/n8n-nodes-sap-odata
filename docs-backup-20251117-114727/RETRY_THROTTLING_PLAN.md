# Retry & Throttling Configuration - Implementation Plan

## Executive Summary

**Feature**: Configurable retry mechanism with exponential backoff and request throttling
**Current State**: Retry logic exists (`RetryUtils.ts`) but is not UI-configurable
**Target State**: Full UI control over retry behavior and optional request throttling
**Estimated Effort**: 8-12 hours

---

## Current State Analysis

### Existing Implementation

#### 1. **RetryUtils.ts** (Lines 79-129)
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: IRetryOptions = {},
): Promise<T>
```
- ✅ Exponential backoff with jitter
- ✅ Configurable retry options
- ✅ Network error detection
- ✅ Status code-based retry logic
- ❌ Not integrated with main request flow
- ❌ No UI configuration
- ❌ No throttling

#### 2. **Constants** (constants.ts:57-60)
```typescript
MAX_RETRY_ATTEMPTS = 3
INITIAL_RETRY_DELAY = 1000  // 1 second
MAX_RETRY_DELAY = 10000     // 10 seconds
RETRY_STATUS_CODES = [429, 503, 504]
```
- ✅ Default values defined
- ❌ Hardcoded, not configurable

#### 3. **Current Usage**
- `withRetry()` function exists but is **NOT USED** in production code
- No integration in `sapOdataApiRequest()`
- Logger already integrated (Line 114-120)

---

## Proposed Implementation

### 1. UI Configuration Structure

```typescript
// New section in Advanced Options
{
  displayName: 'Resilience',
  name: 'resilience',
  type: 'collection',
  placeholder: 'Configure retry and throttling',
  default: {},
  options: [
    // Retry Configuration
    {
      displayName: 'Enable Retry',
      name: 'retryEnabled',
      type: 'boolean',
      default: true,
      description: 'Automatically retry failed requests',
      hint: 'Retries on network errors and specific status codes (429, 503, 504)',
    },
    {
      displayName: 'Max Retry Attempts',
      name: 'maxRetries',
      type: 'number',
      default: 3,
      displayOptions: { show: { retryEnabled: [true] } },
      typeOptions: { minValue: 1, maxValue: 10 },
      description: 'Maximum number of retry attempts',
      hint: 'Each retry uses exponential backoff (1s, 2s, 4s, ...)',
    },
    {
      displayName: 'Initial Retry Delay (ms)',
      name: 'initialRetryDelay',
      type: 'number',
      default: 1000,
      displayOptions: { show: { retryEnabled: [true] } },
      typeOptions: { minValue: 100, maxValue: 10000 },
      description: 'Initial delay before first retry',
      hint: 'Subsequent retries double this delay (exponential backoff)',
    },
    {
      displayName: 'Max Retry Delay (ms)',
      name: 'maxRetryDelay',
      type: 'number',
      default: 10000,
      displayOptions: { show: { retryEnabled: [true] } },
      typeOptions: { minValue: 1000, maxValue: 60000 },
      description: 'Maximum delay between retries',
      hint: 'Caps the exponential backoff to prevent excessive waits',
    },
    {
      displayName: 'Backoff Factor',
      name: 'backoffFactor',
      type: 'number',
      default: 2,
      displayOptions: { show: { retryEnabled: [true] } },
      typeOptions: { minValue: 1.5, maxValue: 4, numberPrecision: 1 },
      description: 'Multiplication factor for exponential backoff',
      hint: 'Factor of 2 means: 1s → 2s → 4s → 8s',
    },
    {
      displayName: 'Retryable Status Codes',
      name: 'retryStatusCodes',
      type: 'string',
      default: '429,503,504',
      displayOptions: { show: { retryEnabled: [true] } },
      description: 'Comma-separated HTTP status codes to retry',
      placeholder: '429,503,504,502',
      hint: 'Common: 429 (Rate Limit), 503 (Service Unavailable), 504 (Gateway Timeout)',
    },
    {
      displayName: 'Retry on Network Errors',
      name: 'retryNetworkErrors',
      type: 'boolean',
      default: true,
      displayOptions: { show: { retryEnabled: [true] } },
      description: 'Retry on ECONNRESET, ETIMEDOUT, etc.',
      hint: 'Helps with transient network issues',
    },

    // Throttling Configuration
    {
      displayName: 'Enable Throttling',
      name: 'throttleEnabled',
      type: 'boolean',
      default: false,
      description: 'Limit requests per second',
      hint: 'Prevents overwhelming SAP Gateway with too many concurrent requests',
    },
    {
      displayName: 'Max Requests Per Second',
      name: 'maxRequestsPerSecond',
      type: 'number',
      default: 10,
      displayOptions: { show: { throttleEnabled: [true] } },
      typeOptions: { minValue: 1, maxValue: 100 },
      description: 'Maximum requests per second',
      hint: 'SAP Gateway default limit is often 10-20 req/s',
    },
    {
      displayName: 'Throttle Strategy',
      name: 'throttleStrategy',
      type: 'options',
      default: 'delay',
      displayOptions: { show: { throttleEnabled: [true] } },
      options: [
        {
          name: 'Delay',
          value: 'delay',
          description: 'Delay requests to stay under limit',
        },
        {
          name: 'Drop',
          value: 'drop',
          description: 'Drop requests exceeding limit',
        },
        {
          name: 'Queue',
          value: 'queue',
          description: 'Queue requests and process when slot available',
        },
      ],
      description: 'How to handle requests exceeding the limit',
    },
    {
      displayName: 'Throttle Burst Size',
      name: 'throttleBurstSize',
      type: 'number',
      default: 5,
      displayOptions: { show: { throttleEnabled: [true] } },
      typeOptions: { minValue: 1, maxValue: 50 },
      description: 'Allow burst of requests before throttling',
      hint: 'Allows short bursts while maintaining average rate',
    },

    // Logging
    {
      displayName: 'Log Retry Attempts',
      name: 'logRetries',
      type: 'boolean',
      default: true,
      description: 'Log retry attempts to console',
      hint: 'Helps debug retry behavior in n8n logs',
    },
    {
      displayName: 'Log Throttle Events',
      name: 'logThrottling',
      type: 'boolean',
      default: true,
      displayOptions: { show: { throttleEnabled: [true] } },
      description: 'Log when requests are throttled',
    },
  ],
}
```

---

### 2. Enhanced RetryUtils Implementation

```typescript
// RetryUtils.ts - Enhanced version

export interface IRetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableStatusCodes?: number[];
  retryNetworkErrors?: boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

export class RetryHandler {
  private options: Required<IRetryOptions>;

  constructor(options: IRetryOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 10000,
      backoffFactor: options.backoffFactor ?? 2,
      retryableStatusCodes: options.retryableStatusCodes ?? [429, 503, 504],
      retryNetworkErrors: options.retryNetworkErrors ?? true,
      onRetry: options.onRetry ?? (() => {}),
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          throw error;
        }

        if (attempt >= this.options.maxAttempts - 1) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        this.options.onRetry(attempt + 1, error, delay);

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.initialDelay *
      Math.pow(this.options.backoffFactor, attempt);

    // Add jitter (0-20%)
    const jitter = exponentialDelay * 0.2 * Math.random();

    return Math.min(exponentialDelay + jitter, this.options.maxDelay);
  }

  private isRetryable(error: any): boolean {
    // Check HTTP status codes
    const statusCode = this.extractStatusCode(error);
    if (statusCode && this.options.retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    // Check network errors
    if (this.options.retryNetworkErrors && this.isNetworkError(error)) {
      return true;
    }

    return false;
  }

  private extractStatusCode(error: any): number | null {
    if (error instanceof NodeApiError && error.httpCode) {
      return typeof error.httpCode === 'string'
        ? parseInt(error.httpCode, 10)
        : error.httpCode;
    }
    if (error.statusCode) {
      return error.statusCode;
    }
    return null;
  }

  private isNetworkError(error: any): boolean {
    const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
    return error.code && networkErrors.includes(error.code);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### 3. Throttling Implementation

```typescript
// ThrottleManager.ts - New file

export interface IThrottleOptions {
  maxRequestsPerSecond: number;
  strategy: 'delay' | 'drop' | 'queue';
  burstSize: number;
  onThrottle?: (waitTime: number) => void;
}

export class ThrottleManager {
  private options: IThrottleOptions;
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(options: IThrottleOptions) {
    this.options = options;
    this.tokens = options.burstSize;
    this.lastRefill = Date.now();

    // Start token refill timer
    this.startRefillTimer();
  }

  async acquire(): Promise<boolean> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    switch (this.options.strategy) {
      case 'delay':
        return this.delayUntilAvailable();

      case 'drop':
        return false;

      case 'queue':
        return this.queueRequest();

      default:
        return false;
    }
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.options.maxRequestsPerSecond;

    this.tokens = Math.min(
      this.options.burstSize,
      this.tokens + Math.floor(tokensToAdd)
    );

    if (Math.floor(tokensToAdd) > 0) {
      this.lastRefill = now;
    }
  }

  private async delayUntilAvailable(): Promise<boolean> {
    const waitTime = this.calculateWaitTime();

    if (this.options.onThrottle) {
      this.options.onThrottle(waitTime);
    }

    await this.sleep(waitTime);
    return this.acquire();
  }

  private async queueRequest(): Promise<boolean> {
    return new Promise(resolve => {
      this.queue.push(() => resolve(true));
    });
  }

  private calculateWaitTime(): number {
    const tokensNeeded = 1;
    const timeToWait = (tokensNeeded / this.options.maxRequestsPerSecond) * 1000;
    return Math.ceil(timeToWait);
  }

  private startRefillTimer(): void {
    setInterval(() => {
      this.refillTokens();
      this.processQueue();
    }, 100); // Check every 100ms
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens > 0) {
      const next = this.queue.shift();
      if (next) {
        this.tokens--;
        next();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy(): void {
    // Clean up timer when done
    this.queue = [];
  }
}
```

---

### 4. Integration in GenericFunctions.ts

```typescript
// GenericFunctions.ts - Modified sapOdataApiRequest

import { RetryHandler } from './RetryUtils';
import { ThrottleManager } from './ThrottleManager';

// Global throttle manager (singleton per workflow)
let throttleManager: ThrottleManager | null = null;

export async function sapOdataApiRequest(
  this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
  method: string,
  resource: string,
  body: IDataObject = {},
  qs: IDataObject = {},
  uri?: string,
  option: IDataObject = {},
): Promise<any> {
  // Get resilience options
  const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IDataObject;
  const resilience = advancedOptions.resilience as IDataObject || {};

  // Initialize throttling if enabled
  if (resilience.throttleEnabled && !throttleManager) {
    throttleManager = new ThrottleManager({
      maxRequestsPerSecond: resilience.maxRequestsPerSecond as number || 10,
      strategy: resilience.throttleStrategy as 'delay' | 'drop' | 'queue' || 'delay',
      burstSize: resilience.throttleBurstSize as number || 5,
      onThrottle: (waitTime) => {
        if (resilience.logThrottling) {
          Logger.info(`Request throttled`, {
            module: 'ThrottleManager',
            waitTime: `${waitTime}ms`,
            strategy: resilience.throttleStrategy,
          });
        }
      },
    });
  }

  // Apply throttling
  if (throttleManager) {
    const allowed = await throttleManager.acquire();
    if (!allowed && resilience.throttleStrategy === 'drop') {
      throw new NodeOperationError(
        this.getNode(),
        'Request dropped due to rate limiting',
        { description: 'Too many requests. Try reducing the request rate.' }
      );
    }
  }

  // Create request function
  const makeRequest = async () => {
    // ... existing request logic ...
    return response;
  };

  // Apply retry logic if enabled
  if (resilience.retryEnabled) {
    const retryHandler = new RetryHandler({
      maxAttempts: resilience.maxRetries as number || 3,
      initialDelay: resilience.initialRetryDelay as number || 1000,
      maxDelay: resilience.maxRetryDelay as number || 10000,
      backoffFactor: resilience.backoffFactor as number || 2,
      retryableStatusCodes: parseStatusCodes(resilience.retryStatusCodes as string),
      retryNetworkErrors: resilience.retryNetworkErrors !== false,
      onRetry: (attempt, error, delay) => {
        if (resilience.logRetries) {
          Logger.info('Retrying request', {
            module: 'RetryHandler',
            attempt,
            maxAttempts: resilience.maxRetries,
            delay: `${delay}ms`,
            error: error.message || 'Unknown error',
            method,
            resource,
          });
        }
      },
    });

    return retryHandler.execute(makeRequest);
  }

  // No retry - execute directly
  return makeRequest();
}

function parseStatusCodes(codes: string): number[] {
  if (!codes) return [429, 503, 504];

  return codes
    .split(',')
    .map(code => parseInt(code.trim(), 10))
    .filter(code => !isNaN(code));
}
```

---

### 5. Testing Strategy

#### Unit Tests

```typescript
// test/RetryHandler.test.ts

describe('RetryHandler', () => {
  it('should retry on retryable status codes', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ statusCode: 503 })
      .mockRejectedValueOnce({ statusCode: 429 })
      .mockResolvedValueOnce({ success: true });

    const handler = new RetryHandler({
      maxAttempts: 3,
      initialDelay: 100,
      retryableStatusCodes: [429, 503],
    });

    const result = await handler.execute(fn);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true });
  });

  it('should not retry on non-retryable errors', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ statusCode: 400 });

    const handler = new RetryHandler({
      retryableStatusCodes: [429, 503],
    });

    await expect(handler.execute(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should apply exponential backoff', async () => {
    const delays: number[] = [];
    const handler = new RetryHandler({
      maxAttempts: 4,
      initialDelay: 100,
      backoffFactor: 2,
      onRetry: (_, __, delay) => delays.push(delay),
    });

    const fn = jest.fn()
      .mockRejectedValue({ statusCode: 503 });

    try {
      await handler.execute(fn);
    } catch {}

    // Check delays are exponentially increasing (with jitter)
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[0]).toBeLessThanOrEqual(120); // 100 + 20% jitter
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[2]).toBeGreaterThanOrEqual(400);
  });
});

// test/ThrottleManager.test.ts

describe('ThrottleManager', () => {
  it('should limit requests per second', async () => {
    const manager = new ThrottleManager({
      maxRequestsPerSecond: 2,
      strategy: 'delay',
      burstSize: 2,
    });

    const startTime = Date.now();

    // Make 4 requests
    await Promise.all([
      manager.acquire(),
      manager.acquire(),
      manager.acquire(),
      manager.acquire(),
    ]);

    const duration = Date.now() - startTime;

    // Should take at least 1 second for 4 requests at 2/sec
    expect(duration).toBeGreaterThanOrEqual(1000);
  });

  it('should drop requests when strategy is drop', async () => {
    const manager = new ThrottleManager({
      maxRequestsPerSecond: 1,
      strategy: 'drop',
      burstSize: 1,
    });

    const result1 = await manager.acquire();
    const result2 = await manager.acquire();

    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });
});
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (4 hours)
1. ✅ Create `ThrottleManager.ts`
2. ✅ Enhance `RetryUtils.ts` with `RetryHandler` class
3. ✅ Add unit tests for both components
4. ✅ Update types and interfaces

### Phase 2: UI Configuration (3 hours)
1. ✅ Add "Resilience" section to Advanced Options
2. ✅ Add all configuration fields with proper validation
3. ✅ Add helpful hints and descriptions
4. ✅ Test UI in n8n editor

### Phase 3: Integration (3 hours)
1. ✅ Integrate RetryHandler in `sapOdataApiRequest`
2. ✅ Integrate ThrottleManager
3. ✅ Update Logger calls
4. ✅ Handle cleanup (destroy throttle manager)

### Phase 4: Testing & Documentation (2 hours)
1. ✅ Integration tests
2. ✅ Performance tests with large datasets
3. ✅ Update README with resilience configuration
4. ✅ Add troubleshooting guide

---

## Benefits

### For Users
1. **Customizable Resilience**: Adapt to specific SAP Gateway configurations
2. **Reduced Failures**: Automatic retry on transient errors
3. **Rate Limit Protection**: Avoid 429 errors from SAP
4. **Better Debugging**: Clear logging of retry/throttle events
5. **Performance Control**: Fine-tune based on SAP system capabilities

### For Operations
1. **Reduced Manual Intervention**: Fewer failed workflows
2. **System Protection**: Prevent overwhelming SAP Gateway
3. **Monitoring**: Clear visibility into retry patterns
4. **Compliance**: Respect SAP rate limits

### Technical Benefits
1. **Clean Separation**: Retry and throttle logic separated from business logic
2. **Testable**: Full unit test coverage
3. **Configurable**: All parameters exposed via UI
4. **Extensible**: Easy to add new strategies

---

## Configuration Examples

### Conservative SAP System
```json
{
  "resilience": {
    "retryEnabled": true,
    "maxRetries": 5,
    "initialRetryDelay": 2000,
    "backoffFactor": 2,
    "throttleEnabled": true,
    "maxRequestsPerSecond": 5,
    "throttleStrategy": "delay"
  }
}
```

### High-Performance SAP System
```json
{
  "resilience": {
    "retryEnabled": true,
    "maxRetries": 2,
    "initialRetryDelay": 500,
    "throttleEnabled": true,
    "maxRequestsPerSecond": 50,
    "throttleStrategy": "queue",
    "throttleBurstSize": 20
  }
}
```

### Development/Testing
```json
{
  "resilience": {
    "retryEnabled": false,
    "throttleEnabled": false,
    "logRetries": true,
    "logThrottling": true
  }
}
```

---

## Migration Path

### Backward Compatibility
- Default configuration matches current behavior
- No breaking changes
- Retry disabled by default until explicitly enabled

### Rollout Strategy
1. Deploy with retry disabled by default
2. Users can opt-in via UI
3. Monitor logs for retry patterns
4. Adjust defaults based on usage

---

## Monitoring & Metrics

### Log Events
```
[INFO] RetryHandler: Retrying request (attempt 1/3, delay: 1000ms)
[INFO] ThrottleManager: Request throttled (wait: 200ms, strategy: delay)
[WARN] RetryHandler: Max retries exhausted for GET /EntitySet
[INFO] ThrottleManager: Queue processed (5 requests completed)
```

### Metrics to Track
- Retry success rate
- Average retry attempts
- Throttle events per minute
- Queue depth (for queue strategy)

---

## Risk Assessment

### Low Risk
- ✅ Opt-in feature (disabled by default)
- ✅ Extensive testing coverage
- ✅ Clear logging for debugging
- ✅ No changes to existing behavior

### Mitigation
- Comprehensive error handling
- Circuit breaker pattern for repeated failures
- Maximum timeout to prevent indefinite retries
- Memory limits for queue strategy

---

## Next Steps

1. **Review & Approval**: Review plan with stakeholders
2. **Implementation**: Follow phases 1-4
3. **Testing**: Extensive testing with real SAP systems
4. **Documentation**: Complete user guide
5. **Release**: Gradual rollout with monitoring

---

## Appendix: SAP Gateway Limits

Common SAP Gateway default limits:
- **Concurrent Requests**: 10-50 (varies by system)
- **Requests per Second**: 10-20
- **Timeout**: 60-600 seconds
- **Common Error Codes**:
  - 429: Too Many Requests
  - 503: Service Temporarily Unavailable
  - 504: Gateway Timeout
  - 500: Internal Server Error (sometimes retryable)

Recommended starting configuration for most SAP systems:
- Max retries: 3
- Initial delay: 1000ms
- Backoff factor: 2
- Max requests/sec: 10
- Burst size: 5