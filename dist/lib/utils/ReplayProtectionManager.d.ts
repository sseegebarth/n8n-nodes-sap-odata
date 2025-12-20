export interface IReplayCheckResult {
    isReplay: boolean;
    error?: string;
    age?: number;
    isExpired?: boolean;
}
export interface IReplayProtectionConfig {
    nonceTTL: number;
    cleanupIntervalMs: number;
    maxNonces: number;
    requireTimestamp: boolean;
    maxClockSkewMs: number;
}
export declare class ReplayProtectionManager {
    private static instance;
    private nonceStore;
    private cleanupTimer;
    private config;
    private static readonly DEFAULT_CONFIG;
    private constructor();
    static getInstance(config?: Partial<IReplayProtectionConfig>): ReplayProtectionManager;
    static resetInstance(): void;
    destroy(): void;
    checkNonce(nonce: string): IReplayCheckResult;
    checkNonceWithTimestamp(nonce: string, timestamp: string | number, toleranceMs?: number): IReplayCheckResult;
    storeNonce(nonce: string, signature?: string, ttl?: number): boolean;
    private validateTimestamp;
    cleanup(): void;
    private startCleanup;
    stopCleanup(): void;
    clearAll(): void;
    getStats(): {
        size: number;
        maxSize: number;
        utilizationPercent: number;
    };
    static generateNonce(length?: number): string;
    private truncateNonce;
}
