/**
 * RFC Transaction Manager
 *
 * Provides transaction management for SAP RFC/BAPI calls including:
 * - Explicit COMMIT/ROLLBACK
 * - Transaction grouping
 * - Error handling with automatic rollback
 * - LUW (Logical Unit of Work) management
 *
 * @module RfcTransactionManager
 */

import { Logger } from '../Shared/utils/Logger';

/**
 * Transaction options
 *
 * @interface ITransactionOptions
 * @property {boolean} [autoCommit=false] - Automatically commit after successful operation
 * @property {boolean} [autoRollback=true] - Automatically rollback on error
 * @property {boolean} [wait=true] - Wait for commit to complete (WAIT parameter)
 * @property {boolean} [throwOnError=true] - Throw error if commit/rollback fails
 */
export interface ITransactionOptions {
	autoCommit?: boolean;
	autoRollback?: boolean;
	wait?: boolean;
	throwOnError?: boolean;
}

/**
 * Transaction result
 *
 * @interface ITransactionResult
 * @property {boolean} success - Whether transaction was successful
 * @property {string} operation - Operation performed (commit/rollback)
 * @property {any} [return] - RETURN parameter from BAPI_TRANSACTION_*
 * @property {string} [error] - Error message if failed
 */
export interface ITransactionResult {
	success: boolean;
	operation: 'commit' | 'rollback';
	return?: any;
	error?: string;
}

/**
 * RFC Transaction Manager
 *
 * Manages SAP transactions (LUW - Logical Unit of Work) for BAPI calls.
 * Provides explicit control over COMMIT and ROLLBACK operations.
 *
 * @class RfcTransactionManager
 *
 *
 */
export class RfcTransactionManager {
	private client: any;
	private inTransaction: boolean = false;
	private operations: string[] = [];

	/**
	 * Creates an instance of RfcTransactionManager
	 *
	 * @param {any} client - SAP RFC client instance (from node-rfc)
	 */
	constructor(client: any) {
		this.client = client;
	}

	/**
	 * Commit the current transaction (LUW)
	 *
	 * Executes BAPI_TRANSACTION_COMMIT to save all changes made
	 * in the current Logical Unit of Work to the database.
	 *
	 * @param {ITransactionOptions} [options={}] - Transaction options
	 * @returns {Promise<ITransactionResult>} Transaction result
	 *
	 */
	async commit(options: ITransactionOptions = {}): Promise<ITransactionResult> {
		const { wait = true, throwOnError = true } = options;

		Logger.debug('Executing BAPI_TRANSACTION_COMMIT', {
			module: 'RfcTransactionManager',
			wait,
			operations: this.operations.length,
		});

		try {
			const result = await this.client.call('BAPI_TRANSACTION_COMMIT', {
				WAIT: wait ? 'X' : '',
			});

			this.inTransaction = false;
			const operationCount = this.operations.length;
			this.operations = [];

			Logger.info('Transaction committed successfully', {
				module: 'RfcTransactionManager',
				operationsCommitted: operationCount,
			});

			return {
				success: true,
				operation: 'commit',
				return: result.RETURN,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			Logger.error('Transaction commit failed', error as Error, {
				module: 'RfcTransactionManager',
			});

			if (throwOnError) {
				throw new Error(`BAPI_TRANSACTION_COMMIT failed: ${errorMessage}`);
			}

			return {
				success: false,
				operation: 'commit',
				error: errorMessage,
			};
		}
	}

	/**
	 * Rollback the current transaction (LUW)
	 *
	 * Executes BAPI_TRANSACTION_ROLLBACK to discard all changes made
	 * in the current Logical Unit of Work.
	 *
	 * @param {ITransactionOptions} [options={}] - Transaction options
	 * @returns {Promise<ITransactionResult>} Transaction result
	 *
	 */
	async rollback(options: ITransactionOptions = {}): Promise<ITransactionResult> {
		const { throwOnError = false } = options;

		Logger.debug('Executing BAPI_TRANSACTION_ROLLBACK', {
			module: 'RfcTransactionManager',
			operations: this.operations.length,
		});

		try {
			const result = await this.client.call('BAPI_TRANSACTION_ROLLBACK', {});

			this.inTransaction = false;
			const operationCount = this.operations.length;
			this.operations = [];

			Logger.info('Transaction rolled back successfully', {
				module: 'RfcTransactionManager',
				operationsRolledBack: operationCount,
			});

			return {
				success: true,
				operation: 'rollback',
				return: result.RETURN,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			Logger.error('Transaction rollback failed', error as Error, {
				module: 'RfcTransactionManager',
			});

			if (throwOnError) {
				throw new Error(`BAPI_TRANSACTION_ROLLBACK failed: ${errorMessage}`);
			}

			return {
				success: false,
				operation: 'rollback',
				error: errorMessage,
			};
		}
	}

	/**
	 * Execute a function with automatic commit/rollback
	 *
	 * Wraps a function execution with automatic transaction management:
	 * - Commits if function succeeds
	 * - Rolls back if function throws error
	 *
	 * @template T
	 * @param {() => Promise<T>} fn - Function to execute
	 * @param {ITransactionOptions} [options={}] - Transaction options
	 * @returns {Promise<T>} Function result
	 *
	 */
	async executeWithAutoCommit<T>(
		fn: () => Promise<T>,
		options: ITransactionOptions = {},
	): Promise<T> {
		const { autoRollback = true, wait = true } = options;

		this.startTransaction();

		try {
			const result = await fn();

			// Auto-commit on success
			await this.commit({ wait, throwOnError: true });

			return result;
		} catch (error) {
			// Auto-rollback on error
			if (autoRollback) {
				try {
					await this.rollback({ throwOnError: false });
				} catch (rollbackError) {
					Logger.warn('Rollback after error failed', {
						module: 'RfcTransactionManager',
						originalError: error instanceof Error ? error.message : String(error),
						rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
					});
				}
			}

			throw error;
		}
	}

	/**
	 * Execute multiple operations in a single transaction
	 *
	 * Executes an array of operations sequentially within a single LUW.
	 * Commits if all succeed, rolls back if any fails.
	 *
	 * @template T
	 * @param {Array<() => Promise<T>>} operations - Array of async operations
	 * @param {ITransactionOptions} [options={}] - Transaction options
	 * @returns {Promise<T[]>} Array of results
	 *
	 */
	async executeMultiple<T>(
		operations: Array<() => Promise<T>>,
		options: ITransactionOptions = {},
	): Promise<T[]> {
		const { autoRollback = true, wait = true } = options;

		this.startTransaction();

		const results: T[] = [];

		try {
			// Execute all operations sequentially
			for (let i = 0; i < operations.length; i++) {
				Logger.debug(`Executing operation ${i + 1}/${operations.length}`, {
					module: 'RfcTransactionManager',
				});

				const result = await operations[i]();
				results.push(result);

				this.registerOperation(`Operation ${i + 1}`);
			}

			// Commit all changes
			await this.commit({ wait, throwOnError: true });

			Logger.info('Multiple operations committed successfully', {
				module: 'RfcTransactionManager',
				count: operations.length,
			});

			return results;
		} catch (error) {
			Logger.error('Multiple operations failed', error as Error, {
				module: 'RfcTransactionManager',
				completedOperations: results.length,
				totalOperations: operations.length,
			});

			// Auto-rollback on error
			if (autoRollback) {
				try {
					await this.rollback({ throwOnError: false });
				} catch (rollbackError) {
					Logger.warn('Rollback after error failed', {
						module: 'RfcTransactionManager',
					});
				}
			}

			throw error;
		}
	}

	/**
	 * Start a new transaction
	 *
	 * Marks the beginning of a new Logical Unit of Work.
	 * Mainly for internal tracking purposes.
	 *
	 * @private
	 */
	private startTransaction(): void {
		if (this.inTransaction) {
			Logger.warn('Starting new transaction while previous transaction is still active', {
				module: 'RfcTransactionManager',
				previousOperations: this.operations.length,
			});
		}

		this.inTransaction = true;
		this.operations = [];

		Logger.debug('Transaction started', {
			module: 'RfcTransactionManager',
		});
	}

	/**
	 * Register an operation in the current transaction
	 *
	 * Tracks operations for logging and debugging purposes.
	 *
	 * @param {string} operationName - Name of the operation
	 * @private
	 */
	private registerOperation(operationName: string): void {
		this.operations.push(operationName);
	}

	/**
	 * Check if currently in a transaction
	 *
	 * @returns {boolean} True if transaction is active
	 */
	isInTransaction(): boolean {
		return this.inTransaction;
	}

	/**
	 * Get number of operations in current transaction
	 *
	 * @returns {number} Operation count
	 */
	getOperationCount(): number {
		return this.operations.length;
	}

	/**
	 * Get list of operations in current transaction
	 *
	 * @returns {string[]} Array of operation names
	 */
	getOperations(): string[] {
		return [...this.operations];
	}
}

/**
 * Check BAPI RETURN parameter for errors
 *
 * Analyzes the RETURN structure from BAPI calls and throws/logs errors.
 * Supports both single RETURN structures and RETURN tables.
 *
 * @param {any} returnParam - RETURN parameter from BAPI
 * @param {boolean} [throwOnError=true] - Whether to throw on error
 * @returns {boolean} True if no errors found
 *
 */
export function checkBapiReturn(returnParam: any, throwOnError: boolean = true): boolean {
	if (!returnParam) {
		return true; // No return parameter = success
	}

	// Handle RETURN table (array)
	if (Array.isArray(returnParam)) {
		const errors = returnParam.filter((msg) => msg.TYPE === 'E' || msg.TYPE === 'A');
		const warnings = returnParam.filter((msg) => msg.TYPE === 'W');

		if (warnings.length > 0) {
			Logger.warn('BAPI warnings', {
				module: 'RfcTransactionManager',
				warnings: warnings.map((w) => `${w.ID}/${w.NUMBER}: ${w.MESSAGE}`),
			});
		}

		if (errors.length > 0) {
			const errorMessages = errors.map((e) => `${e.ID}/${e.NUMBER}: ${e.MESSAGE}`).join('; ');

			Logger.error('BAPI errors', new Error(errorMessages), {
				module: 'RfcTransactionManager',
				errors,
			});

			if (throwOnError) {
				throw new Error(`BAPI error: ${errorMessages}`);
			}

			return false;
		}
	}
	// Handle single RETURN structure
	else if (returnParam.TYPE === 'E' || returnParam.TYPE === 'A') {
		const errorMessage = `${returnParam.ID}/${returnParam.NUMBER}: ${returnParam.MESSAGE}`;

		Logger.error('BAPI error', new Error(errorMessage), {
			module: 'RfcTransactionManager',
			return: returnParam,
		});

		if (throwOnError) {
			throw new Error(`BAPI error: ${errorMessage}`);
		}

		return false;
	} else if (returnParam.TYPE === 'W') {
		Logger.warn('BAPI warning', {
			module: 'RfcTransactionManager',
			warning: `${returnParam.ID}/${returnParam.NUMBER}: ${returnParam.MESSAGE}`,
		});
	}

	return true;
}
