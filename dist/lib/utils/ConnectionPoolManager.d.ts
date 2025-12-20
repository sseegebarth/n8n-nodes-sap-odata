import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
export interface IConnectionPoolConfig {
    keepAlive?: boolean;
    keepAliveMsecs?: number;
    maxSockets?: number;
    maxFreeSockets?: number;
    timeout?: number;
    freeSocketTimeout?: number;
    scheduling?: 'fifo' | 'lifo';
}
export interface IConnectionPoolStats {
    activeSockets: number;
    freeSockets: number;
    pendingRequests: number;
    totalRequests: number;
    totalConnectionsCreated: number;
    totalConnectionsReused: number;
}
export declare class ConnectionPoolManager {
    private static instance;
    private httpAgent;
    private httpsAgent;
    private config;
    private stats;
    private httpFreeListener;
    private httpsFreeListener;
    private static readonly DEFAULT_CONFIG;
    private constructor();
    static getInstance(config?: Partial<IConnectionPoolConfig>): ConnectionPoolManager;
    static resetInstance(): void;
    private initializeAgents;
    private setupEventListeners;
    getHttpAgent(): HttpAgent;
    getHttpsAgent(): HttpsAgent;
    getAgent(protocol: string): HttpAgent | HttpsAgent;
    getStats(): IConnectionPoolStats;
    private getAgentSockets;
    updateConfig(newConfig: Partial<IConnectionPoolConfig>): void;
    getConfig(): Required<IConnectionPoolConfig>;
    destroy(): void;
    isHealthy(): boolean;
    resetStats(): void;
}
