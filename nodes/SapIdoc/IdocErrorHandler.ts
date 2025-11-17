/**
 * IDoc Error Handler
 *
 * Provides comprehensive error IDoc handling including:
 * - Error detection and classification
 * - Automatic retry logic
 * - Error IDoc retrieval
 * - Status-based error recovery
 *
 * @module IdocErrorHandler
 */

import { Logger } from '../Shared/utils/Logger';
import { IdocStatusTracker, IIdocInfo, IIdocStatus } from './IdocStatusTracker';

/**
 * Error retry strategy
 *
 * @enum {string}
 * @readonly
 */
export enum RetryStrategy {
	/** No retry */
	None = 'none',
	/** Immediate retry */
	Immediate = 'immediate',
	/** Exponential backoff */
	Exponential = 'exponential',
	/** Fixed interval */
	FixedInterval = 'fixed',
}

/**
 * Retry options
 *
 * @interface IRetryOptions
 * @property {RetryStrategy} strategy - Retry strategy
 * @property {number} maxAttempts - Maximum retry attempts
 * @property {number} initialDelayMs - Initial delay between retries
 * @property {number} maxDelayMs - Maximum delay between retries
 * @property {number} backoffMultiplier - Multiplier for exponential backoff
 * @property {boolean} retryOnTransientErrors - Retry on transient errors only
 */
export interface IRetryOptions {
	strategy: RetryStrategy;
	maxAttempts: number;
	initialDelayMs: number;
	maxDelayMs: number;
	backoffMultiplier: number;
	retryOnTransientErrors: boolean;
}

/**
 * Error classification
 *
 * @interface IErrorClassification
 * @property {boolean} isTransient - Error is likely transient (retryable)
 * @property {boolean} isDataError - Error is due to invalid data
 * @property {boolean} isSystemError - Error is due to system/configuration issue
 * @property {string} category - Error category
 * @property {string} recommendation - Recommended action
 */
export interface IErrorClassification {
	isTransient: boolean;
	isDataError: boolean;
	isSystemError: boolean;
	category: string;
	recommendation: string;
}

/**
 * Retry result
 *
 * @interface IRetryResult
 * @property {boolean} success - Whether retry succeeded
 * @property {number} attempts - Number of attempts made
 * @property {IIdocStatus} [finalStatus] - Final status after retries
 * @property {string} [error] - Error message if failed
 */
export interface IRetryResult {
	success: boolean;
	attempts: number;
	finalStatus?: IIdocStatus;
	error?: string;
}

/**
 * IDoc Error Handler
 *
 * Handles error IDocs with intelligent retry logic and error classification.
 *
 * @class IdocErrorHandler
 *
 *
 */
export class IdocErrorHandler {
	private client: any;
	private statusTracker: IdocStatusTracker;

	/**
	 * Creates an instance of IdocErrorHandler
	 *
	 * @param {any} client - SAP RFC client instance
	 */
	constructor(client: any) {
		this.client = client;
		this.statusTracker = new IdocStatusTracker(client);
	}

	/**
	 * Get all error IDocs within a date range
	 *
	 * @param {string} dateFrom - Start date (YYYYMMDD)
	 * @param {string} dateTo - End date (YYYYMMDD)
	 * @returns {Promise<IIdocInfo[]>} Array of error IDocs
	 */
	async getErrorIdocs(dateFrom: string, dateTo: string): Promise<IIdocInfo[]> {
		return this.statusTracker.getErrorIdocs(dateFrom, dateTo);
	}

	/**
	 * Classify an error IDoc
	 *
	 * Analyzes the error status and provides classification with recommendations.
	 *
	 * @param {IIdocInfo} idoc - IDoc information
	 * @returns {IErrorClassification} Error classification
	 *
	 */
	classifyError(idoc: IIdocInfo): IErrorClassification {
		const status = idoc.currentStatus.status;

		// Status 4: Error within control record (data error)
		if (status === 4) {
			return {
				isTransient: false,
				isDataError: true,
				isSystemError: false,
				category: 'Control Record Error',
				recommendation: 'Check and correct control record fields (partner, message type, etc.)',
			};
		}

		// Status 5: Error during translation (configuration error)
		if (status === 5) {
			return {
				isTransient: false,
				isDataError: false,
				isSystemError: true,
				category: 'Translation Error',
				recommendation: 'Check port configuration and partner profile settings',
			};
		}

		// Status 7: Error during syntax check (data error)
		if (status === 7) {
			return {
				isTransient: false,
				isDataError: true,
				isSystemError: false,
				category: 'Syntax Error',
				recommendation: 'Check IDoc structure and mandatory fields',
			};
		}

		// Status 9: Error during IDoc application (may be transient)
		if (status === 9) {
			// Check if error message indicates transient issue
			const message = idoc.currentStatus.message || '';
			const isLockError = message.includes('locked') || message.includes('LOCK');
			const isConnectionError = message.includes('connection') || message.includes('RFC');

			return {
				isTransient: isLockError || isConnectionError,
				isDataError: !isLockError && !isConnectionError,
				isSystemError: isConnectionError,
				category: 'Application Error',
				recommendation: isLockError
					? 'Retry after lock is released'
					: isConnectionError
						? 'Check system connectivity'
						: 'Check application log and correct data',
			};
		}

		// Status 13: Error during ALE service (system error, may be transient)
		if (status === 13) {
			return {
				isTransient: true,
				isDataError: false,
				isSystemError: true,
				category: 'ALE Service Error',
				recommendation: 'Check ALE configuration and retry',
			};
		}

		// Status 65: Error during dispatch (system error, may be transient)
		if (status === 65) {
			return {
				isTransient: true,
				isDataError: false,
				isSystemError: true,
				category: 'Dispatch Error',
				recommendation: 'Check RFC connection and retry',
			};
		}

		// Default: Unknown error
		return {
			isTransient: false,
			isDataError: false,
			isSystemError: true,
			category: 'Unknown Error',
			recommendation: 'Check IDoc status details and system log',
		};
	}

	/**
	 * Retry error IDoc
	 *
	 * Attempts to reprocess an error IDoc using RFC function IDOC_INBOUND_PROCESS.
	 *
	 * @param {string} docnum - IDoc document number
	 * @param {IRetryOptions} options - Retry options
	 * @returns {Promise<IRetryResult>} Retry result
	 *
	 */
	async retryErrorIdoc(docnum: string, options: IRetryOptions): Promise<IRetryResult> {
		const { strategy, maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier, retryOnTransientErrors } =
			options;

		Logger.info('Starting IDoc retry', {
			module: 'IdocErrorHandler',
			docnum,
			strategy,
			maxAttempts,
		});

		// Get current IDoc info
		const idoc = await this.statusTracker.getIdocStatus(docnum);

		// Check if retryable
		if (retryOnTransientErrors) {
			const classification = this.classifyError(idoc);
			if (!classification.isTransient) {
				Logger.warn('IDoc error is not transient, skipping retry', {
					module: 'IdocErrorHandler',
					docnum,
					category: classification.category,
				});

				return {
					success: false,
					attempts: 0,
					error: `Error is not transient: ${classification.category}. ${classification.recommendation}`,
				};
			}
		}

		let attempts = 0;
		let currentDelay = initialDelayMs;

		while (attempts < maxAttempts) {
			attempts++;

			Logger.debug(`Retry attempt ${attempts}/${maxAttempts}`, {
				module: 'IdocErrorHandler',
				docnum,
				delayMs: currentDelay,
			});

			// Wait before retry (except first attempt)
			if (attempts > 1) {
				await this.sleep(currentDelay);
			}

			try {
				// Reprocess IDoc using IDOC_INBOUND_PROCESS
				await this.client.call('IDOC_INBOUND_PROCESS', {
					DOCNUM: docnum,
				});

				// Wait for processing and check status
				const finalStatus = await this.statusTracker.waitForFinalStatus(docnum, 30000, 2000);

				if (finalStatus.isSuccess) {
					Logger.info('IDoc retry succeeded', {
						module: 'IdocErrorHandler',
						docnum,
						attempts,
					});

					return {
						success: true,
						attempts,
						finalStatus,
					};
				} else if (finalStatus.isError) {
					Logger.warn('IDoc retry still failed', {
						module: 'IdocErrorHandler',
						docnum,
						attempts,
						status: finalStatus.status,
					});

					// Update delay for next attempt
					currentDelay = this.calculateNextDelay(
						strategy,
						currentDelay,
						backoffMultiplier,
						maxDelayMs,
					);
				}
			} catch (error) {
				Logger.error('IDoc retry attempt failed', error as Error, {
					module: 'IdocErrorHandler',
					docnum,
					attempts,
				});

				// Update delay for next attempt
				currentDelay = this.calculateNextDelay(strategy, currentDelay, backoffMultiplier, maxDelayMs);
			}
		}

		// All retries exhausted
		Logger.warn('All retry attempts exhausted', {
			module: 'IdocErrorHandler',
			docnum,
			attempts,
		});

		const finalInfo = await this.statusTracker.getIdocStatus(docnum);

		return {
			success: false,
			attempts,
			finalStatus: finalInfo.currentStatus,
			error: `Retry failed after ${attempts} attempts`,
		};
	}

	/**
	 * Retry multiple error IDocs
	 *
	 * Batch retry for multiple error IDocs.
	 *
	 * @param {string[]} docnums - Array of IDoc document numbers
	 * @param {IRetryOptions} options - Retry options
	 * @returns {Promise<Map<string, IRetryResult>>} Map of docnum to retry result
	 *
	 */
	async retryMultipleIdocs(
		docnums: string[],
		options: IRetryOptions,
	): Promise<Map<string, IRetryResult>> {
		Logger.info('Starting multiple IDoc retry', {
			module: 'IdocErrorHandler',
			count: docnums.length,
		});

		const results = new Map<string, IRetryResult>();

		for (const docnum of docnums) {
			try {
				const result = await this.retryErrorIdoc(docnum, options);
				results.set(docnum, result);
			} catch (error) {
				Logger.error('Failed to retry IDoc', error as Error, {
					module: 'IdocErrorHandler',
					docnum,
				});

				results.set(docnum, {
					success: false,
					attempts: 0,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		const successCount = Array.from(results.values()).filter((r) => r.success).length;

		Logger.info('Multiple IDoc retry completed', {
			module: 'IdocErrorHandler',
			total: docnums.length,
			success: successCount,
			failed: docnums.length - successCount,
		});

		return results;
	}

	/**
	 * Calculate next delay based on strategy
	 *
	 * @private
	 */
	private calculateNextDelay(
		strategy: RetryStrategy,
		currentDelay: number,
		backoffMultiplier: number,
		maxDelay: number,
	): number {
		switch (strategy) {
			case RetryStrategy.Immediate:
				return 0;

			case RetryStrategy.Exponential:
				return Math.min(currentDelay * backoffMultiplier, maxDelay);

			case RetryStrategy.FixedInterval:
				return currentDelay;

			default:
				return currentDelay;
		}
	}

	/**
	 * Sleep for specified milliseconds
	 *
	 * @private
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
