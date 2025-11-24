import { NodeOperationError } from 'n8n-workflow';
import { IRfcOperationStrategy } from './IRfcOperationStrategy';
import { CallFunctionStrategy } from './CallFunctionStrategy';
import { CallMultipleStrategy } from './CallMultipleStrategy';

/**
 * Factory for creating RFC operation strategies.
 * Returns the appropriate strategy based on the operation type.
 *
 * This follows the same pattern as OperationStrategyFactory for consistency.
 */
export class RfcStrategyFactory {
	/**
	 * Get the appropriate strategy for the given RFC operation
	 *
	 * @param operation - The RFC operation type ('callFunction' or 'callMultiple')
	 * @returns The corresponding strategy instance
	 * @throws NodeOperationError if the operation is not supported
	 */
	public static getStrategy(operation: string): IRfcOperationStrategy {
		switch (operation) {
			case 'callFunction':
				return new CallFunctionStrategy();

			case 'callMultiple':
				return new CallMultipleStrategy();

			default:
				// Throw error for unknown operations
				throw new NodeOperationError(
					// @ts-ignore - null is acceptable here as we don't have node context
					null,
					`The operation "${operation}" is not supported for the RFC node. Supported operations are: callFunction, callMultiple`,
				);
		}
	}

	/**
	 * Check if an operation is supported
	 *
	 * @param operation - The operation to check
	 * @returns True if the operation is supported
	 */
	public static isOperationSupported(operation: string): boolean {
		return ['callFunction', 'callMultiple'].includes(operation);
	}

	/**
	 * Get list of supported operations
	 *
	 * @returns Array of supported operation names
	 */
	public static getSupportedOperations(): string[] {
		return ['callFunction', 'callMultiple'];
	}
}