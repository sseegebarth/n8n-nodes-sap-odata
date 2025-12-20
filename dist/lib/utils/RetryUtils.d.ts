export interface IRetryOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryableStatusCodes?: number[];
    retryNetworkErrors?: boolean;
    onRetry?: (attempt: number, error: any, delay: number) => void;
}
export declare class RetryHandler {
    private options;
    constructor(options?: IRetryOptions);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private calculateDelay;
    private isRetryable;
    private extractStatusCode;
    private isNetworkError;
}
export declare function withRetry<T>(fn: () => Promise<T>, options?: IRetryOptions): Promise<T>;
