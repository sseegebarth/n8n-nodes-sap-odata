import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import {
	DEFAULT_POOL_SIZE,
	DEFAULT_POOL_TIMEOUT,
	DEFAULT_KEEP_ALIVE_TIMEOUT,
} from '../constants';

/**
 * Connection Pool Configuration
 */
export interface IConnectionPoolConfig {
	keepAlive?: boolean;
	keepAliveMsecs?: number;
	maxSockets?: number;
	maxFreeSockets?: number;
	timeout?: number;
	freeSocketTimeout?: number;
	scheduling?: 'fifo' | 'lifo';
}

/**
 * Connection Pool Statistics
 */
export interface IConnectionPoolStats {
	activeSockets: number;
	freeSockets: number;
	pendingRequests: number;
	totalRequests: number;
	totalConnectionsCreated: number;
	totalConnectionsReused: number;
}

/**
 * Manages HTTP/HTTPS connection pools for efficient request handling
 *
 * Benefits:
 * - Reuses TCP connections (reduces handshake overhead)
 * - Configurable socket limits (prevents overwhelming SAP servers)
 * - Keep-alive support (maintains persistent connections)
 * - Automatic socket cleanup (prevents memory leaks)
 */
export class ConnectionPoolManager {
	private static instance: ConnectionPoolManager | undefined;
	private httpAgent: HttpAgent | null = null;
	private httpsAgent: HttpsAgent | null = null;
	private config: Required<IConnectionPoolConfig>;
	private stats: IConnectionPoolStats;
	// Store event listener references for cleanup (prevents memory leaks)
	private httpFreeListener: (() => void) | null = null;
	private httpsFreeListener: (() => void) | null = null;

	// Default configuration optimized for SAP OData services
	private static readonly DEFAULT_CONFIG: Required<IConnectionPoolConfig> = {
		keepAlive: true,
		keepAliveMsecs: 1000, // 1 second
		maxSockets: DEFAULT_POOL_SIZE, // Max concurrent connections per host
		maxFreeSockets: Math.floor(DEFAULT_POOL_SIZE / 2), // Max idle connections to keep
		timeout: DEFAULT_POOL_TIMEOUT, // Request timeout
		freeSocketTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT, // Idle timeout
		scheduling: 'fifo', // First-in-first-out
	};

	private constructor(config?: Partial<IConnectionPoolConfig>) {
		this.config = {
			...ConnectionPoolManager.DEFAULT_CONFIG,
			...config,
		};

		this.stats = {
			activeSockets: 0,
			freeSockets: 0,
			pendingRequests: 0,
			totalRequests: 0,
			totalConnectionsCreated: 0,
			totalConnectionsReused: 0,
		};

		this.initializeAgents();
	}

	/**
	 * Get singleton instance of ConnectionPoolManager
	 *
	 * Note: This uses a singleton pattern for connection pooling efficiency.
	 * The config parameter is only used when creating the first instance.
	 * To change configuration after initialization, use updateConfig() method.
	 *
	 * @param config - Optional configuration (only applied on first call)
	 * @returns The singleton ConnectionPoolManager instance
	 */
	public static getInstance(config?: Partial<IConnectionPoolConfig>): ConnectionPoolManager {
		if (!ConnectionPoolManager.instance) {
			ConnectionPoolManager.instance = new ConnectionPoolManager(config);
		} else if (config) {
			// If config is provided and instance exists, update the config
			ConnectionPoolManager.instance.updateConfig(config);
		}
		return ConnectionPoolManager.instance;
	}

	/**
	 * Reset singleton instance (useful for testing)
	 */
	public static resetInstance(): void {
		if (ConnectionPoolManager.instance) {
			ConnectionPoolManager.instance.destroy();
			ConnectionPoolManager.instance = undefined;
		}
	}

	/**
	 * Initialize HTTP and HTTPS agents
	 */
	private initializeAgents(): void {
		const agentOptions = {
			keepAlive: this.config.keepAlive,
			keepAliveMsecs: this.config.keepAliveMsecs,
			maxSockets: this.config.maxSockets,
			maxFreeSockets: this.config.maxFreeSockets,
			timeout: this.config.timeout,
			freeSocketTimeout: this.config.freeSocketTimeout,
			scheduling: this.config.scheduling,
		};

		this.httpAgent = new HttpAgent(agentOptions);
		this.httpsAgent = new HttpsAgent(agentOptions);

		// Setup event listeners for statistics
		this.setupEventListeners(this.httpAgent, 'http');
		this.setupEventListeners(this.httpsAgent, 'https');
	}

	/**
	 * Setup event listeners for connection statistics
	 */
	private setupEventListeners(agent: HttpAgent | HttpsAgent, protocol: string): void {
		// Wrap the original createConnection to track new connections
		const originalCreateConnection = (agent as any).createConnection;
		if (originalCreateConnection) {
			(agent as any).createConnection = (...args: unknown[]) => {
				this.stats.totalConnectionsCreated++;
				return originalCreateConnection.apply(agent, args);
			};
		}

		// Track when sockets become free (reused) - store reference for cleanup
		const freeListener = () => {
			this.stats.totalConnectionsReused++;
		};
		agent.on('free', freeListener);

		// Store listener reference based on protocol for later cleanup
		if (protocol === 'http') {
			this.httpFreeListener = freeListener;
		} else {
			this.httpsFreeListener = freeListener;
		}
	}

	/**
	 * Get HTTP agent for connection pooling
	 */
	public getHttpAgent(): HttpAgent {
		if (!this.httpAgent) {
			throw new Error('HTTP agent not initialized');
		}
		return this.httpAgent;
	}

	/**
	 * Get HTTPS agent for connection pooling
	 */
	public getHttpsAgent(): HttpsAgent {
		if (!this.httpsAgent) {
			throw new Error('HTTPS agent not initialized');
		}
		return this.httpsAgent;
	}

	/**
	 * Get agent based on protocol
	 */
	public getAgent(protocol: string): HttpAgent | HttpsAgent {
		this.stats.totalRequests++;

		if (protocol === 'https:') {
			return this.getHttpsAgent();
		}
		return this.getHttpAgent();
	}

	/**
	 * Get connection pool statistics
	 */
	public getStats(): IConnectionPoolStats {
		const httpSockets = this.getAgentSockets(this.httpAgent);
		const httpsSockets = this.getAgentSockets(this.httpsAgent);

		return {
			...this.stats,
			activeSockets: httpSockets.active + httpsSockets.active,
			freeSockets: httpSockets.free + httpsSockets.free,
			pendingRequests: httpSockets.pending + httpsSockets.pending,
		};
	}

	/**
	 * Get socket information from an agent
	 */
	private getAgentSockets(agent: HttpAgent | HttpsAgent | null): {
		active: number;
		free: number;
		pending: number;
	} {
		if (!agent) {
			return { active: 0, free: 0, pending: 0 };
		}

		const sockets = (agent as any).sockets || {};
		const freeSockets = (agent as any).freeSockets || {};
		const requests = (agent as any).requests || {};

		// Count sockets across all hosts
		const countSockets = (obj: any) => {
			return Object.values(obj).reduce((sum: number, arr: any) => {
				return sum + (Array.isArray(arr) ? arr.length : 0);
			}, 0);
		};

		return {
			active: countSockets(sockets),
			free: countSockets(freeSockets),
			pending: countSockets(requests),
		};
	}

	/**
	 * Update configuration (only recreates agents if config actually changed)
	 */
	public updateConfig(newConfig: Partial<IConnectionPoolConfig>): void {
		// Check if config actually changed
		const hasChanged = Object.entries(newConfig).some(([key, value]) => {
			const configKey = key as keyof IConnectionPoolConfig;
			return this.config[configKey] !== value;
		});

		// Only recreate agents if config changed
		if (!hasChanged) {
			return;
		}

		this.config = {
			...this.config,
			...newConfig,
		};

		// Recreate agents with new configuration
		this.destroy();
		this.initializeAgents();
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): Required<IConnectionPoolConfig> {
		return { ...this.config };
	}

	/**
	 * Destroy all agents and cleanup connections
	 */
	public destroy(): void {
		// Remove event listeners before destroying agents (prevents memory leaks)
		if (this.httpAgent && this.httpFreeListener) {
			this.httpAgent.removeListener('free', this.httpFreeListener);
			this.httpFreeListener = null;
		}

		if (this.httpsAgent && this.httpsFreeListener) {
			this.httpsAgent.removeListener('free', this.httpsFreeListener);
			this.httpsFreeListener = null;
		}

		if (this.httpAgent) {
			this.httpAgent.destroy();
			this.httpAgent = null;
		}

		if (this.httpsAgent) {
			this.httpsAgent.destroy();
			this.httpsAgent = null;
		}
	}

	/**
	 * Check if connection pool is healthy
	 */
	public isHealthy(): boolean {
		const stats = this.getStats();

		// Check for issues
		if (stats.pendingRequests > this.config.maxSockets * 2) {
			// Too many pending requests
			return false;
		}

		if (stats.activeSockets > this.config.maxSockets) {
			// Somehow exceeded max sockets
			return false;
		}

		return true;
	}

	/**
	 * Reset statistics
	 */
	public resetStats(): void {
		this.stats = {
			activeSockets: 0,
			freeSockets: 0,
			pendingRequests: 0,
			totalRequests: 0,
			totalConnectionsCreated: 0,
			totalConnectionsReused: 0,
		};
	}
}
