import { Logger } from './Logger';

/**
 * Throttle strategy options
 */
export type ThrottleStrategy = 'delay' | 'drop' | 'queue';

/**
 * Throttle configuration options
 */
export interface IThrottleOptions {
	maxRequestsPerSecond: number;
	strategy: ThrottleStrategy;
	burstSize: number;
	onThrottle?: (waitTime: number) => void;
}

/**
 * Request throttle manager using token bucket algorithm
 * Limits the rate of requests to prevent overwhelming the server
 */
export class ThrottleManager {
	private options: IThrottleOptions;
	private tokens: number;
	private lastRefill: number;
	private queue: Array<{ resolve: (value: boolean) => void; reject: (error: Error) => void }> = [];
	private refillTimer: NodeJS.Timeout | null = null;
	private destroyed = false;

	constructor(options: IThrottleOptions) {
		this.options = {
			maxRequestsPerSecond: options.maxRequestsPerSecond,
			strategy: options.strategy,
			burstSize: options.burstSize,
			onThrottle: options.onThrottle,
		};

		this.tokens = options.burstSize;
		this.lastRefill = Date.now();

		// Start token refill timer
		this.startRefillTimer();

		Logger.debug('ThrottleManager initialized', {
			module: 'ThrottleManager',
			maxRequestsPerSecond: this.options.maxRequestsPerSecond,
			strategy: this.options.strategy,
			burstSize: this.options.burstSize,
		});
	}

	/**
	 * Acquire a token to make a request
	 * Returns true if request can proceed, false if dropped
	 */
	async acquire(): Promise<boolean> {
		if (this.destroyed) {
			throw new Error('ThrottleManager has been destroyed');
		}

		this.refillTokens();

		if (this.tokens > 0) {
			this.tokens--;
			return true;
		}

		// No tokens available - apply strategy
		switch (this.options.strategy) {
			case 'delay':
				return this.delayUntilAvailable();

			case 'drop':
				Logger.warn('Request dropped due to rate limiting', {
					module: 'ThrottleManager',
					strategy: 'drop',
				});
				return false;

			case 'queue':
				return this.queueRequest();

			default:
				return false;
		}
	}

	/**
	 * Refill tokens based on time elapsed
	 */
	private refillTokens(): void {
		const now = Date.now();
		const timePassed = (now - this.lastRefill) / 1000; // seconds
		const tokensToAdd = timePassed * this.options.maxRequestsPerSecond;

		if (Math.floor(tokensToAdd) > 0) {
			this.tokens = Math.min(this.options.burstSize, this.tokens + Math.floor(tokensToAdd));
			this.lastRefill = now;

			Logger.debug('Tokens refilled', {
				module: 'ThrottleManager',
				tokens: this.tokens,
				tokensAdded: Math.floor(tokensToAdd),
			});
		}
	}

	/**
	 * Delay until a token becomes available
	 */
	private async delayUntilAvailable(): Promise<boolean> {
		const waitTime = this.calculateWaitTime();

		if (this.options.onThrottle) {
			this.options.onThrottle(waitTime);
		}

		Logger.debug('Request delayed due to throttling', {
			module: 'ThrottleManager',
			waitTime: `${waitTime}ms`,
			strategy: 'delay',
		});

		await this.sleep(waitTime);

		// After waiting, try to acquire again
		return this.acquire();
	}

	/**
	 * Queue request for later processing
	 */
	private async queueRequest(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.queue.push({ resolve, reject });

			Logger.debug('Request queued', {
				module: 'ThrottleManager',
				queueLength: this.queue.length,
				strategy: 'queue',
			});
		});
	}

	/**
	 * Calculate how long to wait for next token
	 */
	private calculateWaitTime(): number {
		const tokensNeeded = 1;
		const timePerToken = 1000 / this.options.maxRequestsPerSecond;
		return Math.ceil(tokensNeeded * timePerToken);
	}

	/**
	 * Start the token refill timer
	 */
	private startRefillTimer(): void {
		// Clear any existing timer first to prevent leaks
		if (this.refillTimer) {
			clearInterval(this.refillTimer);
			this.refillTimer = null;
		}

		this.refillTimer = setInterval(() => {
			if (this.destroyed) {
				// Clean up timer when destroyed
				if (this.refillTimer) {
					clearInterval(this.refillTimer);
					this.refillTimer = null;
				}
				return;
			}

			this.refillTokens();
			this.processQueue();
		}, 100); // Check every 100ms

		// Ensure timer doesn't prevent process exit
		if (this.refillTimer && typeof this.refillTimer.unref === 'function') {
			this.refillTimer.unref();
		}
	}

	/**
	 * Process queued requests
	 */
	private processQueue(): void {
		while (this.queue.length > 0 && this.tokens > 0) {
			const next = this.queue.shift();
			if (next) {
				this.tokens--;
				next.resolve(true);

				Logger.debug('Queued request processed', {
					module: 'ThrottleManager',
					remainingQueue: this.queue.length,
				});
			}
		}
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get current status
	 */
	public getStatus(): {
		tokens: number;
		queueLength: number;
		maxRequestsPerSecond: number;
		strategy: ThrottleStrategy;
	} {
		return {
			tokens: this.tokens,
			queueLength: this.queue.length,
			maxRequestsPerSecond: this.options.maxRequestsPerSecond,
			strategy: this.options.strategy,
		};
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.destroyed = true;

		if (this.refillTimer) {
			clearInterval(this.refillTimer);
			this.refillTimer = null;
		}

		// Reject all queued requests
		while (this.queue.length > 0) {
			const next = this.queue.shift();
			if (next) {
				next.reject(new Error('ThrottleManager destroyed'));
			}
		}

		Logger.debug('ThrottleManager destroyed', {
			module: 'ThrottleManager',
		});
	}
}
