import { NodeApiError } from 'n8n-workflow';
import {
	MAX_RETRY_ATTEMPTS,
	INITIAL_RETRY_DELAY,
	MAX_RETRY_DELAY,
	RETRY_STATUS_CODES,
} from '../constants';
import { Logger } from './Logger';

/**
 * Retry configuration options
 */
export interface IRetryOptions {
	maxAttempts?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffFactor?: number;
	retryableStatusCodes?: number[];
	retryNetworkErrors?: boolean;
	onRetry?: (attempt: number, error: any, delay: number) => void;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(
	attempt: number,
	initialDelay: number,
	maxDelay: number,
	backoffFactor: number,
): number {
	// Exponential backoff: delay = initialDelay * backoffFactor^attempt
	const exponentialDelay = initialDelay * Math.pow(backoffFactor, attempt);

	// Add jitter (random 0-20% variation) to avoid thundering herd
	const jitter = exponentialDelay * 0.2 * Math.random();

	// Cap at maxDelay
	return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry handler class with configurable exponential backoff
 */
export class RetryHandler {
	private options: Required<IRetryOptions>;

	constructor(options: IRetryOptions = {}) {
		this.options = {
			maxAttempts: options.maxAttempts ?? MAX_RETRY_ATTEMPTS,
			initialDelay: options.initialDelay ?? INITIAL_RETRY_DELAY,
			maxDelay: options.maxDelay ?? MAX_RETRY_DELAY,
			backoffFactor: options.backoffFactor ?? 2,
			retryableStatusCodes: options.retryableStatusCodes ?? RETRY_STATUS_CODES,
			retryNetworkErrors: options.retryNetworkErrors ?? true,
			onRetry: options.onRetry ?? (() => { /* no-op */ }),
		};
	}

	/**
	 * Execute function with retry logic
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		let lastError: any;

		for (let attempt = 0; attempt < this.options.maxAttempts; attempt++) {
			try {
				return await fn();
			} catch (error) {
				lastError = error;

				if (!this.isRetryable(error)) {
					throw error;
				}

				if (attempt >= this.options.maxAttempts - 1) {
					Logger.warn('Max retry attempts exhausted', {
						module: 'RetryHandler',
						maxAttempts: this.options.maxAttempts,
						error: error instanceof Error ? error.message : 'Unknown error',
					});
					throw error;
				}

				const delay = this.calculateDelay(attempt);
				this.options.onRetry(attempt + 1, error, delay);

				await sleep(delay);
			}
		}

		throw lastError;
	}

	/**
	 * Calculate exponential backoff delay
	 */
	private calculateDelay(attempt: number): number {
		return calculateDelay(
			attempt,
			this.options.initialDelay,
			this.options.maxDelay,
			this.options.backoffFactor,
		);
	}

	/**
	 * Check if error is retryable
	 */
	private isRetryable(error: any): boolean {
		const statusCode = this.extractStatusCode(error);
		if (statusCode && this.options.retryableStatusCodes.includes(statusCode)) {
			return true;
		}

		if (this.options.retryNetworkErrors && this.isNetworkError(error)) {
			return true;
		}

		return false;
	}

	/**
	 * Extract HTTP status code from error
	 */
	private extractStatusCode(error: any): number | null {
		if (error instanceof NodeApiError && error.httpCode) {
			return typeof error.httpCode === 'string'
				? parseInt(error.httpCode, 10)
				: error.httpCode;
		}
		if (error.statusCode) {
			return error.statusCode;
		}
		return null;
	}

	/**
	 * Check if error is a network error
	 */
	private isNetworkError(error: any): boolean {
		const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
		return error.code && networkErrors.includes(error.code);
	}
}

/**
 * Execute a function with exponential backoff retry logic
 * @deprecated Use RetryHandler class instead
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to function result
 * @throws Last error if all retries exhausted
 *
 * @example
 * const result = await withRetry(
 *   () => sapOdataApiRequest.call(this, 'GET', '/EntitySet'),
 *   { maxAttempts: 3 }
 * );
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: IRetryOptions = {},
): Promise<T> {
	const handler = new RetryHandler(options);
	return handler.execute(fn);
}
