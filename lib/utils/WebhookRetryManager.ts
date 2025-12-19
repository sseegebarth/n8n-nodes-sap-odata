/**
 * Webhook Retry Manager
 *
 * Provides automatic retry logic for failed webhook deliveries with:
 * - Multiple retry strategies (immediate, fixed, exponential)
 * - Delivery tracking and status management
 * - Configurable retry limits and backoff
 * - Dead letter queue for permanent failures
 * - Circuit breaker pattern for failing endpoints
 *
 * Designed for reliable webhook delivery in SAP integration scenarios.
 *
 * @module WebhookRetryManager
 */

import { Logger } from './Logger';

/**
 * Webhook delivery status
 *
 * @enum {string}
 */
export enum DeliveryStatus {
	/** Webhook is pending delivery */
	Pending = 'pending',
	/** Webhook is currently being delivered */
	InProgress = 'in_progress',
	/** Webhook was successfully delivered */
	Delivered = 'delivered',
	/** Webhook delivery failed but will be retried */
	Failed = 'failed',
	/** Webhook delivery permanently failed */
	DeadLetter = 'dead_letter',
}

/**
 * Retry strategy types
 *
 * @enum {string}
 */
export enum RetryStrategy {
	/** Retry immediately without delay */
	Immediate = 'immediate',
	/** Retry with fixed interval between attempts */
	Fixed = 'fixed',
	/** Retry with exponential backoff */
	Exponential = 'exponential',
	/** No automatic retry */
	None = 'none',
}

/**
 * Webhook delivery attempt record
 *
 * @interface IDeliveryAttempt
 * @property {number} attemptNumber - Attempt number (1-based)
 * @property {number} timestamp - When attempt was made (ms since epoch)
 * @property {number} httpStatus - HTTP status code received (0 if network error)
 * @property {string} [error] - Error message if failed
 * @property {number} durationMs - How long the attempt took
 */
export interface IDeliveryAttempt {
	attemptNumber: number;
	timestamp: number;
	httpStatus: number;
	error?: string;
	durationMs: number;
}

/**
 * Webhook delivery record
 *
 * @interface IWebhookDelivery
 * @property {string} id - Unique delivery identifier
 * @property {string} webhookUrl - Target URL
 * @property {string} payload - Webhook payload (JSON string)
 * @property {Record<string, string>} headers - HTTP headers
 * @property {DeliveryStatus} status - Current delivery status
 * @property {number} createdAt - When delivery was created (ms since epoch)
 * @property {number} [lastAttemptAt] - When last attempt was made
 * @property {number} [nextRetryAt] - When next retry is scheduled
 * @property {number} [deliveredAt] - When successfully delivered
 * @property {IDeliveryAttempt[]} attempts - All delivery attempts
 * @property {number} retryCount - Number of retries attempted
 * @property {string} [metadata] - Optional metadata (JSON string)
 */
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

/**
 * Retry configuration options
 *
 * @interface IRetryConfig
 * @property {RetryStrategy} strategy - Retry strategy to use
 * @property {number} maxRetries - Maximum retry attempts
 * @property {number} initialDelayMs - Initial retry delay in milliseconds
 * @property {number} maxDelayMs - Maximum retry delay in milliseconds
 * @property {number} backoffMultiplier - Multiplier for exponential backoff
 * @property {number} deliveryTimeoutMs - Timeout for each delivery attempt
 * @property {number[]} retryableStatusCodes - HTTP status codes to retry
 * @property {boolean} retryOnNetworkError - Retry on network errors
 */
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

/**
 * Webhook delivery options
 *
 * @interface IDeliveryOptions
 * @property {Record<string, string>} [headers] - Additional HTTP headers
 * @property {number} [timeoutMs] - Delivery timeout override
 * @property {string} [metadata] - Optional metadata
 * @property {Partial<IRetryConfig>} [retryConfig] - Retry configuration override
 */
export interface IDeliveryOptions {
	headers?: Record<string, string>;
	timeoutMs?: number;
	metadata?: string;
	retryConfig?: Partial<IRetryConfig>;
}

/**
 * Delivery result
 *
 * @interface IDeliveryResult
 * @property {boolean} success - Whether delivery was successful
 * @property {number} httpStatus - HTTP status code
 * @property {string} [error] - Error message if failed
 * @property {number} attemptNumber - Which attempt number this was
 * @property {number} durationMs - How long delivery took
 * @property {boolean} willRetry - Whether automatic retry is scheduled
 * @property {number} [nextRetryAt] - When next retry is scheduled (ms since epoch)
 */
export interface IDeliveryResult {
	success: boolean;
	httpStatus: number;
	error?: string;
	attemptNumber: number;
	durationMs: number;
	willRetry: boolean;
	nextRetryAt?: number;
}

/**
 * Circuit breaker state
 *
 * @enum {string}
 */
enum CircuitState {
	/** Circuit is closed, requests allowed */
	Closed = 'closed',
	/** Circuit is open, requests blocked */
	Open = 'open',
	/** Circuit is half-open, testing if service recovered */
	HalfOpen = 'half_open',
}

/**
 * Circuit breaker for an endpoint
 *
 * @interface ICircuitBreaker
 * @property {string} endpoint - Endpoint URL
 * @property {CircuitState} state - Current circuit state
 * @property {number} failureCount - Consecutive failures
 * @property {number} successCount - Consecutive successes (in half-open state)
 * @property {number} lastFailureAt - When last failure occurred
 * @property {number} openedAt - When circuit was opened
 */
interface ICircuitBreaker {
	endpoint: string;
	state: CircuitState;
	failureCount: number;
	successCount: number;
	lastFailureAt: number;
	openedAt: number;
}

/**
 * Webhook Retry Manager
 *
 * Manages automatic retry logic for webhook deliveries with configurable
 * retry strategies, circuit breakers, and dead letter queues.
 *
 * @class WebhookRetryManager
 *
 *
 */
export class WebhookRetryManager {
	private static instance: WebhookRetryManager;
	private deliveries: Map<string, IWebhookDelivery>;
	private circuits: Map<string, ICircuitBreaker>;
	private retryTimers: Map<string, NodeJS.Timeout>;
	private cleanupTimer: NodeJS.Timeout | null = null;
	private config: IRetryConfig;

	/**
	 * Default retry configuration
	 */
	private static readonly DEFAULT_CONFIG: IRetryConfig = {
		strategy: RetryStrategy.Exponential,
		maxRetries: 5,
		initialDelayMs: 1000, // 1 second
		maxDelayMs: 5 * 60 * 1000, // 5 minutes
		backoffMultiplier: 2,
		deliveryTimeoutMs: 30000, // 30 seconds
		retryableStatusCodes: [408, 429, 500, 502, 503, 504],
		retryOnNetworkError: true,
	};

	/**
	 * Delivery storage configuration
	 */
	private static readonly STORAGE_CONFIG = {
		deliveryTTL: 24 * 60 * 60 * 1000, // Keep completed deliveries for 24 hours
		maxDeliveries: 10000, // Maximum deliveries to store
		cleanupIntervalMs: 60 * 60 * 1000, // Cleanup every hour
	};

	/**
	 * Circuit breaker configuration
	 */
	private static readonly CIRCUIT_CONFIG = {
		failureThreshold: 5, // Open circuit after 5 consecutive failures
		successThreshold: 2, // Close circuit after 2 consecutive successes
		openDurationMs: 60000, // Keep circuit open for 1 minute
	};

	/**
	 * Creates an instance of WebhookRetryManager
	 *
	 * @private
	 * @param {Partial<IRetryConfig>} [config] - Optional configuration override
	 */
	private constructor(config?: Partial<IRetryConfig>) {
		this.config = {
			...WebhookRetryManager.DEFAULT_CONFIG,
			...config,
		};

		this.deliveries = new Map();
		this.circuits = new Map();
		this.retryTimers = new Map();

		// Start automatic cleanup of old deliveries
		this.startCleanup();

		Logger.info('Webhook Retry Manager initialized', {
			module: 'WebhookRetryManager',
			strategy: this.config.strategy,
			maxRetries: this.config.maxRetries,
		});
	}

	/**
	 * Get singleton instance
	 *
	 * @static
	 * @param {Partial<IRetryConfig>} [config] - Optional configuration (only used on first call)
	 * @returns {WebhookRetryManager} Singleton instance
	 *
	 * @remarks
	 * Configuration is only applied on first call. Subsequent calls with config will log a warning
	 * and ignore the config parameter. Use resetInstance() to recreate with new config (testing only).
	 */
	static getInstance(config?: Partial<IRetryConfig>): WebhookRetryManager {
		if (!WebhookRetryManager.instance) {
			WebhookRetryManager.instance = new WebhookRetryManager(config);
		} else if (config) {
			Logger.warn('getInstance called with config, but instance already exists. Config ignored.', {
				module: 'WebhookRetryManager',
			});
		}
		return WebhookRetryManager.instance;
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
		if (WebhookRetryManager.instance) {
			WebhookRetryManager.instance.destroy();
			WebhookRetryManager.instance = null as any;

			Logger.debug('Singleton instance reset', {
				module: 'WebhookRetryManager',
			});
		}
	}

	/**
	 * Destroy the manager and cleanup resources
	 *
	 * Clears all timers, deliveries, and circuits.
	 * Call this before destroying the instance to prevent memory leaks.
	 *
	 */
	destroy(): void {
		// Stop cleanup timer
		this.stopCleanup();

		// Clear all retry timers
		for (const timer of this.retryTimers.values()) {
			clearTimeout(timer);
		}
		this.retryTimers.clear();

		// Clear all data
		this.deliveries.clear();
		this.circuits.clear();

		Logger.info('WebhookRetryManager destroyed', {
			module: 'WebhookRetryManager',
		});
	}

	/**
	 * Schedule a webhook delivery
	 *
	 * Creates a delivery record and attempts immediate delivery.
	 * If delivery fails and retry is enabled, schedules automatic retry.
	 *
	 * @param {string} webhookUrl - Target webhook URL
	 * @param {unknown} payload - Webhook payload (will be JSON stringified)
	 * @param {IDeliveryOptions} [options] - Delivery options
	 * @returns {Promise<IWebhookDelivery>} Delivery record
	 *
	 */
	async scheduleDelivery(
		webhookUrl: string,
		payload: unknown,
		options?: IDeliveryOptions,
	): Promise<IWebhookDelivery> {
		const id = this.generateDeliveryId();
		const now = Date.now();

		const delivery: IWebhookDelivery = {
			id,
			webhookUrl,
			payload: JSON.stringify(payload),
			headers: options?.headers || {},
			status: DeliveryStatus.Pending,
			createdAt: now,
			attempts: [],
			retryCount: 0,
			metadata: options?.metadata,
		};

		this.deliveries.set(id, delivery);

		Logger.info('Webhook delivery scheduled', {
			module: 'WebhookRetryManager',
			deliveryId: id,
			url: this.sanitizeUrl(webhookUrl),
		});

		// Attempt immediate delivery
		await this.attemptDelivery(id, options);

		return this.deliveries.get(id)!;
	}

	/**
	 * Attempt webhook delivery
	 *
	 * @private
	 * @param {string} deliveryId - Delivery ID
	 * @param {IDeliveryOptions} [options] - Delivery options
	 * @returns {Promise<IDeliveryResult>} Delivery result
	 */
	private async attemptDelivery(
		deliveryId: string,
		options?: IDeliveryOptions,
	): Promise<IDeliveryResult> {
		const delivery = this.deliveries.get(deliveryId);
		if (!delivery) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		// Check circuit breaker
		if (!this.canAttemptDelivery(delivery.webhookUrl)) {
			const error = 'Circuit breaker open - endpoint unavailable';
			Logger.warn(error, {
				module: 'WebhookRetryManager',
				deliveryId,
				url: this.sanitizeUrl(delivery.webhookUrl),
			});

			// Schedule retry
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

		Logger.debug('Attempting webhook delivery', {
			module: 'WebhookRetryManager',
			deliveryId,
			attempt: attemptNumber,
			url: this.sanitizeUrl(delivery.webhookUrl),
		});

		try {
			// Simulate HTTP request (in real implementation, use axios or fetch)
			const result = await this.executeHttpRequest(delivery, options);

			const durationMs = Date.now() - startTime;
			const attempt: IDeliveryAttempt = {
				attemptNumber,
				timestamp: startTime,
				httpStatus: result.httpStatus,
				durationMs,
				error: result.error,
			};

			delivery.attempts.push(attempt);
			delivery.lastAttemptAt = startTime;

			if (result.success) {
				// Delivery succeeded
				delivery.status = DeliveryStatus.Delivered;
				delivery.deliveredAt = Date.now();

				// Clear retry timer for this delivery
				this.clearRetryTimer(deliveryId);

				this.recordCircuitSuccess(delivery.webhookUrl);

				Logger.info('Webhook delivered successfully', {
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
			} else {
				// Delivery failed
				this.recordCircuitFailure(delivery.webhookUrl);

				if (this.shouldRetry(delivery, result.httpStatus)) {
					// Schedule retry
					delivery.status = DeliveryStatus.Failed;
					this.scheduleRetry(delivery, options);

					Logger.warn('Webhook delivery failed, retry scheduled', {
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
				} else {
					// No more retries - move to dead letter queue
					delivery.status = DeliveryStatus.DeadLetter;

					// Clear retry timer for this delivery
					this.clearRetryTimer(deliveryId);

					Logger.error('Webhook delivery permanently failed', undefined, {
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
		} catch (error) {
			// Network error or exception
			const durationMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);

			const attempt: IDeliveryAttempt = {
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

				Logger.warn('Webhook delivery network error, retry scheduled', {
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
			} else {
				delivery.status = DeliveryStatus.DeadLetter;

				// Clear retry timer for this delivery
				this.clearRetryTimer(deliveryId);

				Logger.error('Webhook delivery permanently failed (network)', undefined, {
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

	/**
	 * Execute HTTP request for webhook delivery
	 *
	 * Override this method in a subclass to provide actual HTTP delivery implementation.
	 * By default, this throws an error to prevent silent failures.
	 *
	 * @protected
	 * @param {IWebhookDelivery} delivery - Delivery record
	 * @param {IDeliveryOptions} [options] - Delivery options
	 * @returns {Promise<{success: boolean; httpStatus: number; error?: string}>} Request result
	 *
	 * @throws {Error} If not implemented
	 *
	 *
	 */
	protected async executeHttpRequest(
		_delivery: IWebhookDelivery,
		_options?: IDeliveryOptions,
	): Promise<{ success: boolean; httpStatus: number; error?: string }> {
		throw new Error(
			'executeHttpRequest must be implemented. ' +
				'Either extend WebhookRetryManager and override executeHttpRequest, ' +
				'or provide an HTTP client implementation. ' +
				'See JSDoc for examples using axios or fetch.',
		);
	}

	/**
	 * Check if delivery should be retried
	 *
	 * @private
	 * @param {IWebhookDelivery} delivery - Delivery record
	 * @param {number} httpStatus - HTTP status code (0 for network errors)
	 * @returns {boolean} Whether to retry
	 */
	private shouldRetry(delivery: IWebhookDelivery, httpStatus: number): boolean {
		// Check if we've exceeded max retries
		if (delivery.retryCount >= this.config.maxRetries) {
			return false;
		}

		// Check if status code is retryable
		if (httpStatus === 0) {
			return this.config.retryOnNetworkError;
		}

		return this.config.retryableStatusCodes.includes(httpStatus);
	}

	/**
	 * Schedule automatic retry
	 *
	 * @private
	 * @param {IWebhookDelivery} delivery - Delivery record
	 * @param {IDeliveryOptions} [options] - Delivery options
	 */
	private scheduleRetry(delivery: IWebhookDelivery, options?: IDeliveryOptions): void {
		// Clear existing timer if any
		const existingTimer = this.retryTimers.get(delivery.id);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Calculate retry delay
		const delayMs = this.calculateRetryDelay(delivery.retryCount);
		const nextRetryAt = Date.now() + delayMs;

		delivery.nextRetryAt = nextRetryAt;

		// Schedule retry
		const timer = setTimeout(async () => {
			this.retryTimers.delete(delivery.id);
			await this.attemptDelivery(delivery.id, options);
		}, delayMs);

		this.retryTimers.set(delivery.id, timer);

		Logger.debug('Retry scheduled', {
			module: 'WebhookRetryManager',
			deliveryId: delivery.id,
			attempt: delivery.retryCount,
			delayMs,
			nextRetryAt: new Date(nextRetryAt).toISOString(),
		});
	}

	/**
	 * Calculate retry delay based on strategy
	 *
	 * @private
	 * @param {number} attempt - Current attempt number (1-based)
	 * @returns {number} Delay in milliseconds
	 */
	private calculateRetryDelay(attempt: number): number {
		switch (this.config.strategy) {
			case RetryStrategy.Immediate:
				return 0;

			case RetryStrategy.Fixed:
				return Math.min(this.config.initialDelayMs, this.config.maxDelayMs);

			case RetryStrategy.Exponential:
				const delay =
					this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
				return Math.min(delay, this.config.maxDelayMs);

			case RetryStrategy.None:
			default:
				return 0;
		}
	}

	/**
	 * Manually retry a failed delivery
	 *
	 * @param {string} deliveryId - Delivery ID
	 * @param {IDeliveryOptions} [options] - Delivery options override
	 * @returns {Promise<IDeliveryResult>} Delivery result
	 *
	 */
	async retryDelivery(
		deliveryId: string,
		options?: IDeliveryOptions,
	): Promise<IDeliveryResult> {
		const delivery = this.deliveries.get(deliveryId);
		if (!delivery) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		if (delivery.status === DeliveryStatus.Delivered) {
			Logger.warn('Attempted to retry already delivered webhook', {
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

		// Clear any scheduled retry
		this.clearRetryTimer(deliveryId);

		return this.attemptDelivery(deliveryId, options);
	}

	/**
	 * Mark delivery as successfully delivered
	 *
	 * Useful for external delivery mechanisms that want to use the tracking.
	 *
	 * @param {string} deliveryId - Delivery ID
	 *
	 */
	markDelivered(deliveryId: string): void {
		const delivery = this.deliveries.get(deliveryId);
		if (!delivery) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		delivery.status = DeliveryStatus.Delivered;
		delivery.deliveredAt = Date.now();

		// Clear retry timer
		this.clearRetryTimer(deliveryId);

		Logger.info('Delivery marked as delivered', {
			module: 'WebhookRetryManager',
			deliveryId,
		});
	}

	/**
	 * Get delivery status
	 *
	 * @param {string} deliveryId - Delivery ID
	 * @returns {DeliveryStatus | null} Delivery status or null if not found
	 *
	 */
	getDeliveryStatus(deliveryId: string): DeliveryStatus | null {
		const delivery = this.deliveries.get(deliveryId);
		return delivery ? delivery.status : null;
	}

	/**
	 * Get delivery record
	 *
	 * @param {string} deliveryId - Delivery ID
	 * @returns {IWebhookDelivery | null} Delivery record or null if not found
	 *
	 */
	getDelivery(deliveryId: string): IWebhookDelivery | null {
		return this.deliveries.get(deliveryId) || null;
	}

	/**
	 * Get deliveries by status
	 *
	 * @param {DeliveryStatus} status - Status to filter by
	 * @returns {IWebhookDelivery[]} Matching deliveries
	 *
	 */
	getDeliveriesByStatus(status: DeliveryStatus): IWebhookDelivery[] {
		return Array.from(this.deliveries.values()).filter((d) => d.status === status);
	}

	/**
	 * Get dead letter queue
	 *
	 * Returns all deliveries that permanently failed.
	 *
	 * @returns {IWebhookDelivery[]} Dead letter deliveries
	 *
	 */
	getDeadLetterQueue(): IWebhookDelivery[] {
		return this.getDeliveriesByStatus(DeliveryStatus.DeadLetter);
	}

	/**
	 * Circuit breaker: Check if delivery can be attempted
	 *
	 * @private
	 * @param {string} endpoint - Endpoint URL
	 * @returns {boolean} Whether delivery can be attempted
	 */
	private canAttemptDelivery(endpoint: string): boolean {
		const circuit = this.circuits.get(endpoint);
		if (!circuit) {
			return true; // No circuit breaker yet
		}

		const now = Date.now();

		switch (circuit.state) {
			case CircuitState.Closed:
				return true;

			case CircuitState.Open:
				// Check if enough time has passed to try half-open
				const timeSinceOpen = now - circuit.openedAt;
				if (timeSinceOpen >= WebhookRetryManager.CIRCUIT_CONFIG.openDurationMs) {
					circuit.state = CircuitState.HalfOpen;
					circuit.successCount = 0;
					Logger.info('Circuit breaker half-open', {
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

	/**
	 * Circuit breaker: Record successful delivery
	 *
	 * @private
	 * @param {string} endpoint - Endpoint URL
	 */
	private recordCircuitSuccess(endpoint: string): void {
		const circuit = this.circuits.get(endpoint);
		if (!circuit) {
			return;
		}

		if (circuit.state === CircuitState.HalfOpen) {
			circuit.successCount++;
			if (circuit.successCount >= WebhookRetryManager.CIRCUIT_CONFIG.successThreshold) {
				circuit.state = CircuitState.Closed;
				circuit.failureCount = 0;
				Logger.info('Circuit breaker closed', {
					module: 'WebhookRetryManager',
					endpoint: this.sanitizeUrl(endpoint),
				});
			}
		} else {
			circuit.failureCount = 0;
		}
	}

	/**
	 * Circuit breaker: Record failed delivery
	 *
	 * @private
	 * @param {string} endpoint - Endpoint URL
	 */
	private recordCircuitFailure(endpoint: string): void {
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
			// Failed in half-open state - reopen circuit
			circuit.state = CircuitState.Open;
			circuit.openedAt = Date.now();
			circuit.successCount = 0;
			Logger.warn('Circuit breaker reopened', {
				module: 'WebhookRetryManager',
				endpoint: this.sanitizeUrl(endpoint),
			});
		} else if (circuit.failureCount >= WebhookRetryManager.CIRCUIT_CONFIG.failureThreshold) {
			// Too many failures - open circuit
			circuit.state = CircuitState.Open;
			circuit.openedAt = Date.now();
			Logger.warn('Circuit breaker opened', {
				module: 'WebhookRetryManager',
				endpoint: this.sanitizeUrl(endpoint),
				failures: circuit.failureCount,
			});
		}
	}

	/**
	 * Get circuit breaker status for endpoint
	 *
	 * @param {string} endpoint - Endpoint URL
	 * @returns {{ state: CircuitState; failureCount: number } | null} Circuit status or null
	 *
	 */
	getCircuitStatus(endpoint: string): { state: CircuitState; failureCount: number } | null {
		const circuit = this.circuits.get(endpoint);
		return circuit ? { state: circuit.state, failureCount: circuit.failureCount } : null;
	}

	/**
	 * Reset circuit breaker for endpoint
	 *
	 * @param {string} endpoint - Endpoint URL
	 *
	 */
	resetCircuit(endpoint: string): void {
		this.circuits.delete(endpoint);
		Logger.info('Circuit breaker reset', {
			module: 'WebhookRetryManager',
			endpoint: this.sanitizeUrl(endpoint),
		});
	}

	/**
	 * Clear all deliveries and timers
	 *
	 * Useful for cleanup or testing.
	 */
	clearAll(): void {
		// Clear all retry timers
		for (const timer of this.retryTimers.values()) {
			clearTimeout(timer);
		}

		this.deliveries.clear();
		this.circuits.clear();
		this.retryTimers.clear();

		Logger.warn('All deliveries cleared', {
			module: 'WebhookRetryManager',
		});
	}

	/**
	 * Generate unique delivery ID
	 *
	 * @private
	 * @returns {string} Unique ID
	 */
	private generateDeliveryId(): string {
		const crypto = require('crypto');
		return `whd_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
	}

	/**
	 * Sanitize URL for logging (hide credentials)
	 *
	 * @private
	 * @param {string} url - URL to sanitize
	 * @returns {string} Sanitized URL
	 */
	private sanitizeUrl(url: string): string {
		try {
			const parsed = new URL(url);
			if (parsed.username || parsed.password) {
				return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
			}
			return url;
		} catch {
			return url;
		}
	}

	/**
	 * Get statistics
	 *
	 * @returns {{
	 *   total: number;
	 *   delivered: number;
	 *   pending: number;
	 *   failed: number;
	 *   deadLetter: number;
	 *   activeRetries: number;
	 * }} Statistics
	 *
	 */
	getStats(): {
		total: number;
		delivered: number;
		pending: number;
		failed: number;
		deadLetter: number;
		activeRetries: number;
	} {
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

	/**
	 * Clear retry timer for a delivery
	 *
	 * @private
	 * @param {string} deliveryId - Delivery ID
	 */
	private clearRetryTimer(deliveryId: string): void {
		const timer = this.retryTimers.get(deliveryId);
		if (timer) {
			clearTimeout(timer);
			this.retryTimers.delete(deliveryId);

			Logger.debug('Retry timer cleared', {
				module: 'WebhookRetryManager',
				deliveryId,
			});
		}
	}

	/**
	 * Start automatic cleanup of old deliveries
	 *
	 * @private
	 */
	private startCleanup(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanupOldDeliveries();
		}, WebhookRetryManager.STORAGE_CONFIG.cleanupIntervalMs);

		// Don't prevent process exit
		if (this.cleanupTimer.unref) {
			this.cleanupTimer.unref();
		}

		Logger.debug('Automatic delivery cleanup started', {
			module: 'WebhookRetryManager',
			intervalMs: WebhookRetryManager.STORAGE_CONFIG.cleanupIntervalMs,
		});
	}

	/**
	 * Stop automatic cleanup
	 *
	 * @private
	 */
	private stopCleanup(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;

			Logger.debug('Automatic delivery cleanup stopped', {
				module: 'WebhookRetryManager',
			});
		}
	}

	/**
	 * Cleanup old completed deliveries
	 *
	 * Removes deliveries that have been completed (delivered or dead letter)
	 * for longer than the configured TTL. Also enforces max deliveries limit.
	 *
	 * @private
	 */
	private cleanupOldDeliveries(): void {
		const now = Date.now();
		let removed = 0;

		// Remove old completed deliveries
		for (const [id, delivery] of this.deliveries.entries()) {
			if (
				delivery.status === DeliveryStatus.Delivered ||
				delivery.status === DeliveryStatus.DeadLetter
			) {
				const completedAt = delivery.deliveredAt || delivery.lastAttemptAt || delivery.createdAt;
				const age = now - completedAt;

				if (age > WebhookRetryManager.STORAGE_CONFIG.deliveryTTL) {
					this.deliveries.delete(id);
					removed++;
				}
			}
		}

		// If still over limit, remove oldest completed deliveries
		if (this.deliveries.size > WebhookRetryManager.STORAGE_CONFIG.maxDeliveries) {
			const completed = Array.from(this.deliveries.entries())
				.filter(
					([, d]) =>
						d.status === DeliveryStatus.Delivered || d.status === DeliveryStatus.DeadLetter,
				)
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
			Logger.info('Cleaned up old deliveries', {
				module: 'WebhookRetryManager',
				removed,
				remaining: this.deliveries.size,
			});
		}
	}
}
