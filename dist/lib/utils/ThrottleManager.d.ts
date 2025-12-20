export type ThrottleStrategy = 'delay' | 'drop' | 'queue';
export interface IThrottleOptions {
    maxRequestsPerSecond: number;
    strategy: ThrottleStrategy;
    burstSize: number;
    onThrottle?: (waitTime: number) => void;
}
export declare class ThrottleManager {
    private options;
    private tokens;
    private lastRefill;
    private queue;
    private refillTimer;
    private destroyed;
    constructor(options: IThrottleOptions);
    acquire(): Promise<boolean>;
    private refillTokens;
    private delayUntilAvailable;
    private queueRequest;
    private calculateWaitTime;
    private startRefillTimer;
    private processQueue;
    private sleep;
    getStatus(): {
        tokens: number;
        queueLength: number;
        maxRequestsPerSecond: number;
        strategy: ThrottleStrategy;
    };
    destroy(): void;
}
