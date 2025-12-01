/**
 * Replay Protection Manager
 *
 * Prevents replay attacks on webhooks by tracking:
 * - Nonces (unique request identifiers)
 * - Request timestamps
 * - Request signatures
 *
 * Uses in-memory storage with automatic cleanup of expired entries.
 * For production with multiple n8n instances, consider Redis integration.
 *
 * @module ReplayProtectionManager
 */

import { Logger } from './Logger';

/**
 * Nonce entry in storage
 *
 * @interface INonceEntry
 * @property {string} nonce - Unique identifier
 * @property {number} timestamp - When nonce was created (ms since epoch)
 * @property {number} expiresAt - When nonce expires (ms since epoch)
 * @property {string} [signature] - Optional signature for extra validation
 */
interface INonceEntry {
	nonce: string;
	timestamp: number;
	expiresAt: number;
	signature?: string;
}

/**
 * Replay check result
 *
 * @interface IReplayCheckResult
 * @property {boolean} isReplay - Whether request is a replay
 * @property {string} [error] - Error message if replay detected
 * @property {number} [age] - Age of nonce in milliseconds (if exists)
 * @property {boolean} [isExpired] - Whether nonce has expired
 */
export interface IReplayCheckResult {
	isReplay: boolean;
	error?: string;
	age?: number;
	isExpired?: boolean;
}

/**
 * Replay Protection Configuration
 *
 * @interface IReplayProtectionConfig
 * @property {number} nonceTTL - How long to keep nonces (ms)
 * @property {number} cleanupIntervalMs - How often to cleanup expired nonces (ms)
 * @property {number} maxNonces - Maximum nonces to store (prevents memory exhaustion)
 * @property {boolean} requireTimestamp - Require timestamp validation
 * @property {number} maxClockSkewMs - Maximum allowed clock skew (ms)
 */
export interface IReplayProtectionConfig {
	nonceTTL: number;
	cleanupIntervalMs: number;
	maxNonces: number;
	requireTimestamp: boolean;
	maxClockSkewMs: number;
}

/**
 * Replay Protection Manager
 *
 * Detects and prevents replay attacks by tracking unique nonces.
 *
 * @class ReplayProtectionManager
 *
 *
 */
export class ReplayProtectionManager {
	private static instance: ReplayProtectionManager;
	private nonceStore: Map<string, INonceEntry>;
	private cleanupTimer: NodeJS.Timeout | null = null;
	private config: IReplayProtectionConfig;

	/**
	 * Default configuration
	 */
	private static readonly DEFAULT_CONFIG: IReplayProtectionConfig = {
		nonceTTL: 5 * 60 * 1000, // 5 minutes
		cleanupIntervalMs: 60 * 1000, // 1 minute
		maxNonces: 10000, // 10k nonces max
		requireTimestamp: true,
		maxClockSkewMs: 60 * 1000, // 1 minute
	};

	/**
	 * Creates an instance of ReplayProtectionManager
	 *
	 * @private
	 * @param {IReplayProtectionConfig} [config] - Optional configuration
	 */
	private constructor(config?: Partial<IReplayProtectionConfig>) {
		this.config = {
			...ReplayProtectionManager.DEFAULT_CONFIG,
			...config,
		};

		this.nonceStore = new Map();

		// Start automatic cleanup
		this.startCleanup();

		Logger.info('Replay Protection Manager initialized', {
			module: 'ReplayProtectionManager',
			nonceTTL: this.config.nonceTTL,
			maxNonces: this.config.maxNonces,
		});
	}

	/**
	 * Get singleton instance
	 *
	 * @static
	 * @param {Partial<IReplayProtectionConfig>} [config] - Optional configuration (only used on first call)
	 * @returns {ReplayProtectionManager} Singleton instance
	 *
	 * @remarks
	 * Configuration is only applied on first call. Subsequent calls with config will log a warning
	 * and ignore the config parameter. Use resetInstance() to recreate with new config (testing only).
	 */
	static getInstance(config?: Partial<IReplayProtectionConfig>): ReplayProtectionManager {
		if (!ReplayProtectionManager.instance) {
			ReplayProtectionManager.instance = new ReplayProtectionManager(config);
		} else if (config) {
			Logger.warn('getInstance called with config, but instance already exists. Config ignored.', {
				module: 'ReplayProtectionManager',
			});
		}
		return ReplayProtectionManager.instance;
	}

	/**
	 * Reset singleton instance
	 *
	 * Destroys the current instance and allows creating a new one.
	 * This is primarily for testing purposes.
	 *
	 * @static
	 * @internal
	 *
	 */
	static resetInstance(): void {
		if (ReplayProtectionManager.instance) {
			ReplayProtectionManager.instance.destroy();
			ReplayProtectionManager.instance = null as any;

			Logger.debug('Singleton instance reset', {
				module: 'ReplayProtectionManager',
			});
		}
	}

	/**
	 * Destroy the manager and cleanup resources
	 *
	 * Stops cleanup timer and clears all nonces.
	 * Call this before destroying the instance to prevent memory leaks.
	 *
	 */
	destroy(): void {
		this.stopCleanup();
		this.clearAll();

		Logger.info('ReplayProtectionManager destroyed', {
			module: 'ReplayProtectionManager',
		});
	}

	/**
	 * Check if nonce has been seen before
	 *
	 * Does NOT store the nonce - call storeNonce() separately after validation.
	 *
	 * @param {string} nonce - Unique request identifier
	 * @returns {IReplayCheckResult} Check result
	 *
	 */
	checkNonce(nonce: string): IReplayCheckResult {
		if (!nonce || nonce.length === 0) {
			return {
				isReplay: true,
				error: 'Nonce is required',
			};
		}

		// Check if nonce exists
		const entry = this.nonceStore.get(nonce);

		if (!entry) {
			// Nonce not seen before - OK
			return {
				isReplay: false,
			};
		}

		// Nonce exists - check if expired
		const now = Date.now();
		const age = now - entry.timestamp;

		if (entry.expiresAt < now) {
			// Nonce expired - can be reused (will be cleaned up soon)
			Logger.debug('Expired nonce reused (allowed)', {
				module: 'ReplayProtectionManager',
				nonce: this.truncateNonce(nonce),
				age: `${Math.floor(age / 1000)}s`,
			});

			return {
				isReplay: false,
				isExpired: true,
			};
		}

		// Nonce exists and not expired - REPLAY!
		Logger.warn('Replay attack detected', {
			module: 'ReplayProtectionManager',
			nonce: this.truncateNonce(nonce),
			age: `${Math.floor(age / 1000)}s`,
		});

		return {
			isReplay: true,
			error: 'Nonce already used',
			age,
		};
	}

	/**
	 * Check nonce with timestamp validation
	 *
	 * Combines nonce checking with timestamp validation for extra security.
	 *
	 * @param {string} nonce - Unique request identifier
	 * @param {string | number} timestamp - Request timestamp (ISO string or Unix timestamp)
	 * @param {number} [toleranceMs] - Maximum age tolerance (default from config)
	 * @returns {IReplayCheckResult} Check result
	 *
	 */
	checkNonceWithTimestamp(
		nonce: string,
		timestamp: string | number,
		toleranceMs?: number,
	): IReplayCheckResult {
		// First check nonce
		const nonceResult = this.checkNonce(nonce);
		if (nonceResult.isReplay) {
			return nonceResult;
		}

		// Then validate timestamp
		const timestampResult = this.validateTimestamp(timestamp, toleranceMs);
		if (!timestampResult.isValid) {
			return {
				isReplay: true,
				error: timestampResult.error || 'Invalid timestamp',
			};
		}

		return {
			isReplay: false,
		};
	}

	/**
	 * Store nonce to prevent future replays
	 *
	 * Call this AFTER successful validation of the request.
	 *
	 * @param {string} nonce - Unique request identifier
	 * @param {string} [signature] - Optional signature for extra validation
	 * @param {number} [ttl] - Custom TTL in milliseconds (default from config)
	 * @returns {boolean} True if stored successfully
	 *
	 */
	storeNonce(nonce: string, signature?: string, ttl?: number): boolean {
		if (!nonce || nonce.length === 0) {
			Logger.warn('Attempted to store empty nonce', {
				module: 'ReplayProtectionManager',
			});
			return false;
		}

		// Check if we're at capacity
		if (this.nonceStore.size >= this.config.maxNonces) {
			// Force cleanup
			this.cleanup();

			// If still at capacity, reject
			if (this.nonceStore.size >= this.config.maxNonces) {
				Logger.error('Nonce store at maximum capacity', undefined, {
					module: 'ReplayProtectionManager',
					size: this.nonceStore.size,
					max: this.config.maxNonces,
				});
				return false;
			}
		}

		const now = Date.now();
		const effectiveTTL = ttl || this.config.nonceTTL;

		const entry: INonceEntry = {
			nonce,
			timestamp: now,
			expiresAt: now + effectiveTTL,
			signature,
		};

		this.nonceStore.set(nonce, entry);

		Logger.debug('Nonce stored', {
			module: 'ReplayProtectionManager',
			nonce: this.truncateNonce(nonce),
			expiresIn: `${Math.floor(effectiveTTL / 1000)}s`,
			storeSize: this.nonceStore.size,
		});

		return true;
	}

	/**
	 * Validate timestamp
	 *
	 * @private
	 * @param {string | number} timestamp - Timestamp to validate
	 * @param {number} [toleranceMs] - Maximum age tolerance
	 * @returns {{ isValid: boolean; error?: string }} Validation result
	 */
	private validateTimestamp(
		timestamp: string | number,
		toleranceMs?: number,
	): { isValid: boolean; error?: string } {
		const tolerance = toleranceMs || this.config.nonceTTL;
		let timestampMs: number;

		// Parse timestamp
		if (typeof timestamp === 'string') {
			if (timestamp.includes('T') || timestamp.includes('-')) {
				// ISO 8601 format
				const date = new Date(timestamp);
				if (isNaN(date.getTime())) {
					return {
						isValid: false,
						error: 'Invalid timestamp format',
					};
				}
				timestampMs = date.getTime();
			} else {
				// Unix timestamp string
				const ts = parseInt(timestamp, 10);
				if (isNaN(ts)) {
					return {
						isValid: false,
						error: 'Invalid timestamp format',
					};
				}
				timestampMs = ts < 10000000000 ? ts * 1000 : ts;
			}
		} else {
			// Numeric timestamp
			timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
		}

		const now = Date.now();
		const age = now - timestampMs;

		// Check if too old
		if (age > tolerance) {
			return {
				isValid: false,
				error: `Timestamp too old: ${Math.floor(age / 1000)}s (max ${Math.floor(tolerance / 1000)}s)`,
			};
		}

		// Check if too far in the future (clock skew)
		if (age < -this.config.maxClockSkewMs) {
			return {
				isValid: false,
				error: `Timestamp in the future: ${Math.floor(-age / 1000)}s`,
			};
		}

		return {
			isValid: true,
		};
	}

	/**
	 * Cleanup expired nonces
	 *
	 * Removes nonces that have expired from the store.
	 * Called automatically on interval, but can be called manually.
	 */
	cleanup(): void {
		const now = Date.now();
		let cleanedCount = 0;

		for (const [nonce, entry] of this.nonceStore.entries()) {
			if (entry.expiresAt < now) {
				this.nonceStore.delete(nonce);
				cleanedCount++;
			}
		}

		if (cleanedCount > 0) {
			Logger.debug('Cleaned up expired nonces', {
				module: 'ReplayProtectionManager',
				cleaned: cleanedCount,
				remaining: this.nonceStore.size,
			});
		}
	}

	/**
	 * Start automatic cleanup
	 *
	 * @private
	 */
	private startCleanup(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.config.cleanupIntervalMs);

		// Don't prevent process exit
		if (this.cleanupTimer.unref) {
			this.cleanupTimer.unref();
		}

		Logger.debug('Automatic cleanup started', {
			module: 'ReplayProtectionManager',
			intervalMs: this.config.cleanupIntervalMs,
		});
	}

	/**
	 * Stop automatic cleanup
	 */
	stopCleanup(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;

			Logger.debug('Automatic cleanup stopped', {
				module: 'ReplayProtectionManager',
			});
		}
	}

	/**
	 * Clear all nonces
	 *
	 * Removes all nonces from the store. Use with caution!
	 */
	clearAll(): void {
		const count = this.nonceStore.size;
		this.nonceStore.clear();

		Logger.warn('All nonces cleared', {
			module: 'ReplayProtectionManager',
			count,
		});
	}

	/**
	 * Get current statistics
	 *
	 * @returns {{ size: number; maxSize: number; utilizationPercent: number }} Statistics
	 */
	getStats(): { size: number; maxSize: number; utilizationPercent: number } {
		const size = this.nonceStore.size;
		const maxSize = this.config.maxNonces;
		const utilizationPercent = (size / maxSize) * 100;

		return {
			size,
			maxSize,
			utilizationPercent: Math.round(utilizationPercent * 100) / 100,
		};
	}

	/**
	 * Generate unique nonce
	 *
	 * Creates a cryptographically secure random nonce.
	 *
	 * @static
	 * @param {number} [length=32] - Nonce length in bytes
	 * @returns {string} Hex-encoded nonce
	 *
	 */
	static generateNonce(length = 32): string {
		const crypto = require('crypto');
		return crypto.randomBytes(length).toString('hex');
	}

	/**
	 * Truncate nonce for logging
	 *
	 * @private
	 * @param {string} nonce - Full nonce
	 * @returns {string} Truncated nonce
	 */
	private truncateNonce(nonce: string): string {
		if (nonce.length <= 16) {
			return nonce;
		}
		return `${nonce.substring(0, 8)}...${nonce.substring(nonce.length - 8)}`;
	}
}
