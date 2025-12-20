"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookRetryManager = exports.RetryStrategy = exports.DeliveryStatus = void 0;
const Logger_1 = require("./Logger");
var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["Pending"] = "pending";
    DeliveryStatus["InProgress"] = "in_progress";
    DeliveryStatus["Delivered"] = "delivered";
    DeliveryStatus["Failed"] = "failed";
    DeliveryStatus["DeadLetter"] = "dead_letter";
})(DeliveryStatus || (exports.DeliveryStatus = DeliveryStatus = {}));
var RetryStrategy;
(function (RetryStrategy) {
    RetryStrategy["Immediate"] = "immediate";
    RetryStrategy["Fixed"] = "fixed";
    RetryStrategy["Exponential"] = "exponential";
    RetryStrategy["None"] = "none";
})(RetryStrategy || (exports.RetryStrategy = RetryStrategy = {}));
var CircuitState;
(function (CircuitState) {
    CircuitState["Closed"] = "closed";
    CircuitState["Open"] = "open";
    CircuitState["HalfOpen"] = "half_open";
})(CircuitState || (CircuitState = {}));
class WebhookRetryManager {
    constructor(config) {
        this.cleanupTimer = null;
        this.config = {
            ...WebhookRetryManager.DEFAULT_CONFIG,
            ...config,
        };
        this.deliveries = new Map();
        this.circuits = new Map();
        this.retryTimers = new Map();
        this.startCleanup();
        Logger_1.Logger.info('Webhook Retry Manager initialized', {
            module: 'WebhookRetryManager',
            strategy: this.config.strategy,
            maxRetries: this.config.maxRetries,
        });
    }
    static getInstance(config) {
        if (!WebhookRetryManager.instance) {
            WebhookRetryManager.instance = new WebhookRetryManager(config);
        }
        else if (config) {
            Logger_1.Logger.warn('getInstance called with config, but instance already exists. Config ignored.', {
                module: 'WebhookRetryManager',
            });
        }
        return WebhookRetryManager.instance;
    }
    static resetInstance() {
        if (WebhookRetryManager.instance) {
            WebhookRetryManager.instance.destroy();
            WebhookRetryManager.instance = null;
            Logger_1.Logger.debug('Singleton instance reset', {
                module: 'WebhookRetryManager',
            });
        }
    }
    destroy() {
        this.stopCleanup();
        for (const timer of this.retryTimers.values()) {
            clearTimeout(timer);
        }
        this.retryTimers.clear();
        this.deliveries.clear();
        this.circuits.clear();
        Logger_1.Logger.info('WebhookRetryManager destroyed', {
            module: 'WebhookRetryManager',
        });
    }
    async scheduleDelivery(webhookUrl, payload, options) {
        const id = this.generateDeliveryId();
        const now = Date.now();
        const delivery = {
            id,
            webhookUrl,
            payload: JSON.stringify(payload),
            headers: (options === null || options === void 0 ? void 0 : options.headers) || {},
            status: DeliveryStatus.Pending,
            createdAt: now,
            attempts: [],
            retryCount: 0,
            metadata: options === null || options === void 0 ? void 0 : options.metadata,
        };
        this.deliveries.set(id, delivery);
        Logger_1.Logger.info('Webhook delivery scheduled', {
            module: 'WebhookRetryManager',
            deliveryId: id,
            url: this.sanitizeUrl(webhookUrl),
        });
        await this.attemptDelivery(id, options);
        return this.deliveries.get(id);
    }
    async attemptDelivery(deliveryId, options) {
        const delivery = this.deliveries.get(deliveryId);
        if (!delivery) {
            throw new Error(`Delivery not found: ${deliveryId}`);
        }
        if (!this.canAttemptDelivery(delivery.webhookUrl)) {
            const error = 'Circuit breaker open - endpoint unavailable';
            Logger_1.Logger.warn(error, {
                module: 'WebhookRetryManager',
                deliveryId,
                url: this.sanitizeUrl(delivery.webhookUrl),
            });
            this.scheduleRetry(delivery, options);
            return {
                success: false,
                httpStatus: 0,
                error,
                attemptNumber: delivery.retryCount + 1,
                durationMs: 0,
                willRetry: true,
                nextRetryAt: delivery.nextRetryAt,
            };
        }
        delivery.status = DeliveryStatus.InProgress;
        delivery.retryCount++;
        const attemptNumber = delivery.retryCount;
        const startTime = Date.now();
        Logger_1.Logger.debug('Attempting webhook delivery', {
            module: 'WebhookRetryManager',
            deliveryId,
            attempt: attemptNumber,
            url: this.sanitizeUrl(delivery.webhookUrl),
        });
        try {
            const result = await this.executeHttpRequest(delivery, options);
            const durationMs = Date.now() - startTime;
            const attempt = {
                attemptNumber,
                timestamp: startTime,
                httpStatus: result.httpStatus,
                durationMs,
                error: result.error,
            };
            delivery.attempts.push(attempt);
            delivery.lastAttemptAt = startTime;
            if (result.success) {
                delivery.status = DeliveryStatus.Delivered;
                delivery.deliveredAt = Date.now();
                this.clearRetryTimer(deliveryId);
                this.recordCircuitSuccess(delivery.webhookUrl);
                Logger_1.Logger.info('Webhook delivered successfully', {
                    module: 'WebhookRetryManager',
                    deliveryId,
                    attempt: attemptNumber,
                    durationMs,
                    url: this.sanitizeUrl(delivery.webhookUrl),
                });
                return {
                    success: true,
                    httpStatus: result.httpStatus,
                    attemptNumber,
                    durationMs,
                    willRetry: false,
                };
            }
            else {
                this.recordCircuitFailure(delivery.webhookUrl);
                if (this.shouldRetry(delivery, result.httpStatus)) {
                    delivery.status = DeliveryStatus.Failed;
                    this.scheduleRetry(delivery, options);
                    Logger_1.Logger.warn('Webhook delivery failed, retry scheduled', {
                        module: 'WebhookRetryManager',
                        deliveryId,
                        attempt: attemptNumber,
                        httpStatus: result.httpStatus,
                        error: result.error,
                        nextRetry: delivery.nextRetryAt
                            ? new Date(delivery.nextRetryAt).toISOString()
                            : 'none',
                    });
                    return {
                        success: false,
                        httpStatus: result.httpStatus,
                        error: result.error,
                        attemptNumber,
                        durationMs,
                        willRetry: true,
                        nextRetryAt: delivery.nextRetryAt,
                    };
                }
                else {
                    delivery.status = DeliveryStatus.DeadLetter;
                    this.clearRetryTimer(deliveryId);
                    Logger_1.Logger.error('Webhook delivery permanently failed', undefined, {
                        module: 'WebhookRetryManager',
                        deliveryId,
                        attempt: attemptNumber,
                        httpStatus: result.httpStatus,
                        error: result.error,
                    });
                    return {
                        success: false,
                        httpStatus: result.httpStatus,
                        error: result.error,
                        attemptNumber,
                        durationMs,
                        willRetry: false,
                    };
                }
            }
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const attempt = {
                attemptNumber,
                timestamp: startTime,
                httpStatus: 0,
                error: errorMessage,
                durationMs,
            };
            delivery.attempts.push(attempt);
            delivery.lastAttemptAt = startTime;
            this.recordCircuitFailure(delivery.webhookUrl);
            if (this.shouldRetry(delivery, 0)) {
                delivery.status = DeliveryStatus.Failed;
                this.scheduleRetry(delivery, options);
                Logger_1.Logger.warn('Webhook delivery network error, retry scheduled', {
                    module: 'WebhookRetryManager',
                    deliveryId,
                    attempt: attemptNumber,
                    error: errorMessage,
                    nextRetry: delivery.nextRetryAt
                        ? new Date(delivery.nextRetryAt).toISOString()
                        : 'none',
                });
                return {
                    success: false,
                    httpStatus: 0,
                    error: errorMessage,
                    attemptNumber,
                    durationMs,
                    willRetry: true,
                    nextRetryAt: delivery.nextRetryAt,
                };
            }
            else {
                delivery.status = DeliveryStatus.DeadLetter;
                this.clearRetryTimer(deliveryId);
                Logger_1.Logger.error('Webhook delivery permanently failed (network)', undefined, {
                    module: 'WebhookRetryManager',
                    deliveryId,
                    attempt: attemptNumber,
                    error: errorMessage,
                });
                return {
                    success: false,
                    httpStatus: 0,
                    error: errorMessage,
                    attemptNumber,
                    durationMs,
                    willRetry: false,
                };
            }
        }
    }
    async executeHttpRequest(_delivery, _options) {
        throw new Error('executeHttpRequest must be implemented. ' +
            'Either extend WebhookRetryManager and override executeHttpRequest, ' +
            'or provide an HTTP client implementation. ' +
            'See JSDoc for examples using axios or fetch.');
    }
    shouldRetry(delivery, httpStatus) {
        if (delivery.retryCount >= this.config.maxRetries) {
            return false;
        }
        if (httpStatus === 0) {
            return this.config.retryOnNetworkError;
        }
        return this.config.retryableStatusCodes.includes(httpStatus);
    }
    scheduleRetry(delivery, options) {
        const existingTimer = this.retryTimers.get(delivery.id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const delayMs = this.calculateRetryDelay(delivery.retryCount);
        const nextRetryAt = Date.now() + delayMs;
        delivery.nextRetryAt = nextRetryAt;
        const timer = setTimeout(async () => {
            this.retryTimers.delete(delivery.id);
            await this.attemptDelivery(delivery.id, options);
        }, delayMs);
        this.retryTimers.set(delivery.id, timer);
        Logger_1.Logger.debug('Retry scheduled', {
            module: 'WebhookRetryManager',
            deliveryId: delivery.id,
            attempt: delivery.retryCount,
            delayMs,
            nextRetryAt: new Date(nextRetryAt).toISOString(),
        });
    }
    calculateRetryDelay(attempt) {
        switch (this.config.strategy) {
            case RetryStrategy.Immediate:
                return 0;
            case RetryStrategy.Fixed:
                return Math.min(this.config.initialDelayMs, this.config.maxDelayMs);
            case RetryStrategy.Exponential:
                const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
                return Math.min(delay, this.config.maxDelayMs);
            case RetryStrategy.None:
            default:
                return 0;
        }
    }
    async retryDelivery(deliveryId, options) {
        const delivery = this.deliveries.get(deliveryId);
        if (!delivery) {
            throw new Error(`Delivery not found: ${deliveryId}`);
        }
        if (delivery.status === DeliveryStatus.Delivered) {
            Logger_1.Logger.warn('Attempted to retry already delivered webhook', {
                module: 'WebhookRetryManager',
                deliveryId,
            });
            return {
                success: true,
                httpStatus: 200,
                attemptNumber: delivery.retryCount,
                durationMs: 0,
                willRetry: false,
            };
        }
        this.clearRetryTimer(deliveryId);
        return this.attemptDelivery(deliveryId, options);
    }
    markDelivered(deliveryId) {
        const delivery = this.deliveries.get(deliveryId);
        if (!delivery) {
            throw new Error(`Delivery not found: ${deliveryId}`);
        }
        delivery.status = DeliveryStatus.Delivered;
        delivery.deliveredAt = Date.now();
        this.clearRetryTimer(deliveryId);
        Logger_1.Logger.info('Delivery marked as delivered', {
            module: 'WebhookRetryManager',
            deliveryId,
        });
    }
    getDeliveryStatus(deliveryId) {
        const delivery = this.deliveries.get(deliveryId);
        return delivery ? delivery.status : null;
    }
    getDelivery(deliveryId) {
        return this.deliveries.get(deliveryId) || null;
    }
    getDeliveriesByStatus(status) {
        return Array.from(this.deliveries.values()).filter((d) => d.status === status);
    }
    getDeadLetterQueue() {
        return this.getDeliveriesByStatus(DeliveryStatus.DeadLetter);
    }
    canAttemptDelivery(endpoint) {
        const circuit = this.circuits.get(endpoint);
        if (!circuit) {
            return true;
        }
        const now = Date.now();
        switch (circuit.state) {
            case CircuitState.Closed:
                return true;
            case CircuitState.Open:
                const timeSinceOpen = now - circuit.openedAt;
                if (timeSinceOpen >= WebhookRetryManager.CIRCUIT_CONFIG.openDurationMs) {
                    circuit.state = CircuitState.HalfOpen;
                    circuit.successCount = 0;
                    Logger_1.Logger.info('Circuit breaker half-open', {
                        module: 'WebhookRetryManager',
                        endpoint: this.sanitizeUrl(endpoint),
                    });
                    return true;
                }
                return false;
            case CircuitState.HalfOpen:
                return true;
            default:
                return true;
        }
    }
    recordCircuitSuccess(endpoint) {
        const circuit = this.circuits.get(endpoint);
        if (!circuit) {
            return;
        }
        if (circuit.state === CircuitState.HalfOpen) {
            circuit.successCount++;
            if (circuit.successCount >= WebhookRetryManager.CIRCUIT_CONFIG.successThreshold) {
                circuit.state = CircuitState.Closed;
                circuit.failureCount = 0;
                Logger_1.Logger.info('Circuit breaker closed', {
                    module: 'WebhookRetryManager',
                    endpoint: this.sanitizeUrl(endpoint),
                });
            }
        }
        else {
            circuit.failureCount = 0;
        }
    }
    recordCircuitFailure(endpoint) {
        let circuit = this.circuits.get(endpoint);
        if (!circuit) {
            circuit = {
                endpoint,
                state: CircuitState.Closed,
                failureCount: 0,
                successCount: 0,
                lastFailureAt: 0,
                openedAt: 0,
            };
            this.circuits.set(endpoint, circuit);
        }
        circuit.failureCount++;
        circuit.lastFailureAt = Date.now();
        if (circuit.state === CircuitState.HalfOpen) {
            circuit.state = CircuitState.Open;
            circuit.openedAt = Date.now();
            circuit.successCount = 0;
            Logger_1.Logger.warn('Circuit breaker reopened', {
                module: 'WebhookRetryManager',
                endpoint: this.sanitizeUrl(endpoint),
            });
        }
        else if (circuit.failureCount >= WebhookRetryManager.CIRCUIT_CONFIG.failureThreshold) {
            circuit.state = CircuitState.Open;
            circuit.openedAt = Date.now();
            Logger_1.Logger.warn('Circuit breaker opened', {
                module: 'WebhookRetryManager',
                endpoint: this.sanitizeUrl(endpoint),
                failures: circuit.failureCount,
            });
        }
    }
    getCircuitStatus(endpoint) {
        const circuit = this.circuits.get(endpoint);
        return circuit ? { state: circuit.state, failureCount: circuit.failureCount } : null;
    }
    resetCircuit(endpoint) {
        this.circuits.delete(endpoint);
        Logger_1.Logger.info('Circuit breaker reset', {
            module: 'WebhookRetryManager',
            endpoint: this.sanitizeUrl(endpoint),
        });
    }
    clearAll() {
        for (const timer of this.retryTimers.values()) {
            clearTimeout(timer);
        }
        this.deliveries.clear();
        this.circuits.clear();
        this.retryTimers.clear();
        Logger_1.Logger.warn('All deliveries cleared', {
            module: 'WebhookRetryManager',
        });
    }
    generateDeliveryId() {
        const crypto = require('crypto');
        return `whd_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    sanitizeUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.username || parsed.password) {
                return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
            }
            return url;
        }
        catch {
            return url;
        }
    }
    getStats() {
        const deliveries = Array.from(this.deliveries.values());
        return {
            total: deliveries.length,
            delivered: deliveries.filter((d) => d.status === DeliveryStatus.Delivered).length,
            pending: deliveries.filter((d) => d.status === DeliveryStatus.Pending).length,
            failed: deliveries.filter((d) => d.status === DeliveryStatus.Failed).length,
            deadLetter: deliveries.filter((d) => d.status === DeliveryStatus.DeadLetter).length,
            activeRetries: this.retryTimers.size,
        };
    }
    clearRetryTimer(deliveryId) {
        const timer = this.retryTimers.get(deliveryId);
        if (timer) {
            clearTimeout(timer);
            this.retryTimers.delete(deliveryId);
            Logger_1.Logger.debug('Retry timer cleared', {
                module: 'WebhookRetryManager',
                deliveryId,
            });
        }
    }
    startCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldDeliveries();
        }, WebhookRetryManager.STORAGE_CONFIG.cleanupIntervalMs);
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
        Logger_1.Logger.debug('Automatic delivery cleanup started', {
            module: 'WebhookRetryManager',
            intervalMs: WebhookRetryManager.STORAGE_CONFIG.cleanupIntervalMs,
        });
    }
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            Logger_1.Logger.debug('Automatic delivery cleanup stopped', {
                module: 'WebhookRetryManager',
            });
        }
    }
    cleanupOldDeliveries() {
        const now = Date.now();
        let removed = 0;
        for (const [id, delivery] of this.deliveries.entries()) {
            if (delivery.status === DeliveryStatus.Delivered ||
                delivery.status === DeliveryStatus.DeadLetter) {
                const completedAt = delivery.deliveredAt || delivery.lastAttemptAt || delivery.createdAt;
                const age = now - completedAt;
                if (age > WebhookRetryManager.STORAGE_CONFIG.deliveryTTL) {
                    this.deliveries.delete(id);
                    removed++;
                }
            }
        }
        if (this.deliveries.size > WebhookRetryManager.STORAGE_CONFIG.maxDeliveries) {
            const completed = Array.from(this.deliveries.entries())
                .filter(([, d]) => d.status === DeliveryStatus.Delivered || d.status === DeliveryStatus.DeadLetter)
                .sort((a, b) => {
                const aTime = a[1].deliveredAt || a[1].lastAttemptAt || a[1].createdAt;
                const bTime = b[1].deliveredAt || b[1].lastAttemptAt || b[1].createdAt;
                return aTime - bTime;
            });
            const toRemove = this.deliveries.size - WebhookRetryManager.STORAGE_CONFIG.maxDeliveries;
            for (let i = 0; i < Math.min(toRemove, completed.length); i++) {
                this.deliveries.delete(completed[i][0]);
                removed++;
            }
        }
        if (removed > 0) {
            Logger_1.Logger.info('Cleaned up old deliveries', {
                module: 'WebhookRetryManager',
                removed,
                remaining: this.deliveries.size,
            });
        }
    }
}
exports.WebhookRetryManager = WebhookRetryManager;
WebhookRetryManager.DEFAULT_CONFIG = {
    strategy: RetryStrategy.Exponential,
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 5 * 60 * 1000,
    backoffMultiplier: 2,
    deliveryTimeoutMs: 30000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryOnNetworkError: true,
};
WebhookRetryManager.STORAGE_CONFIG = {
    deliveryTTL: 24 * 60 * 60 * 1000,
    maxDeliveries: 10000,
    cleanupIntervalMs: 60 * 60 * 1000,
};
WebhookRetryManager.CIRCUIT_CONFIG = {
    failureThreshold: 5,
    successThreshold: 2,
    openDurationMs: 60000,
};
