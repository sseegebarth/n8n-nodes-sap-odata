export declare enum DeliveryStatus {
    Pending = "pending",
    InProgress = "in_progress",
    Delivered = "delivered",
    Failed = "failed",
    DeadLetter = "dead_letter"
}
export declare enum RetryStrategy {
    Immediate = "immediate",
    Fixed = "fixed",
    Exponential = "exponential",
    None = "none"
}
export interface IDeliveryAttempt {
    attemptNumber: number;
    timestamp: number;
    httpStatus: number;
    error?: string;
    durationMs: number;
}
export interface IWebhookDelivery {
    id: string;
    webhookUrl: string;
    payload: string;
    headers: Record<string, string>;
    status: DeliveryStatus;
    createdAt: number;
    lastAttemptAt?: number;
    nextRetryAt?: number;
    deliveredAt?: number;
    attempts: IDeliveryAttempt[];
    retryCount: number;
    metadata?: string;
}
export interface IRetryConfig {
    strategy: RetryStrategy;
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    deliveryTimeoutMs: number;
    retryableStatusCodes: number[];
    retryOnNetworkError: boolean;
}
export interface IDeliveryOptions {
    headers?: Record<string, string>;
    timeoutMs?: number;
    metadata?: string;
    retryConfig?: Partial<IRetryConfig>;
}
export interface IDeliveryResult {
    success: boolean;
    httpStatus: number;
    error?: string;
    attemptNumber: number;
    durationMs: number;
    willRetry: boolean;
    nextRetryAt?: number;
}
declare enum CircuitState {
    Closed = "closed",
    Open = "open",
    HalfOpen = "half_open"
}
export declare class WebhookRetryManager {
    private static instance;
    private deliveries;
    private circuits;
    private retryTimers;
    private cleanupTimer;
    private config;
    private static readonly DEFAULT_CONFIG;
    private static readonly STORAGE_CONFIG;
    private static readonly CIRCUIT_CONFIG;
    private constructor();
    static getInstance(config?: Partial<IRetryConfig>): WebhookRetryManager;
    static resetInstance(): void;
    destroy(): void;
    scheduleDelivery(webhookUrl: string, payload: unknown, options?: IDeliveryOptions): Promise<IWebhookDelivery>;
    private attemptDelivery;
    protected executeHttpRequest(_delivery: IWebhookDelivery, _options?: IDeliveryOptions): Promise<{
        success: boolean;
        httpStatus: number;
        error?: string;
    }>;
    private shouldRetry;
    private scheduleRetry;
    private calculateRetryDelay;
    retryDelivery(deliveryId: string, options?: IDeliveryOptions): Promise<IDeliveryResult>;
    markDelivered(deliveryId: string): void;
    getDeliveryStatus(deliveryId: string): DeliveryStatus | null;
    getDelivery(deliveryId: string): IWebhookDelivery | null;
    getDeliveriesByStatus(status: DeliveryStatus): IWebhookDelivery[];
    getDeadLetterQueue(): IWebhookDelivery[];
    private canAttemptDelivery;
    private recordCircuitSuccess;
    private recordCircuitFailure;
    getCircuitStatus(endpoint: string): {
        state: CircuitState;
        failureCount: number;
    } | null;
    resetCircuit(endpoint: string): void;
    clearAll(): void;
    private generateDeliveryId;
    private sanitizeUrl;
    getStats(): {
        total: number;
        delivered: number;
        pending: number;
        failed: number;
        deadLetter: number;
        activeRetries: number;
    };
    private clearRetryTimer;
    private startCleanup;
    private stopCleanup;
    private cleanupOldDeliveries;
}
export {};
