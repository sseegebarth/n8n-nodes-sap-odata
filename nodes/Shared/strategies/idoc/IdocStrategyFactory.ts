import { NodeOperationError } from 'n8n-workflow';
import { IIdocOperationStrategy } from './IIdocOperationStrategy';
import { SendIdocStrategy } from './SendIdocStrategy';
import { BuildIdocXmlStrategy } from './BuildIdocXmlStrategy';

/**
 * Factory for creating IDoc operation strategies.
 * Returns the appropriate strategy based on the operation type.
 *
 * This follows the same pattern as RfcStrategyFactory and OperationStrategyFactory for consistency.
 */
export class IdocStrategyFactory {
	/**
	 * Get the appropriate strategy for the given IDoc operation
	 *
	 * @param operation - The IDoc operation type ('send' or 'build')
	 * @returns The corresponding strategy instance
	 * @throws NodeOperationError if the operation is not supported
	 */
	public static getStrategy(operation: string): IIdocOperationStrategy {
		switch (operation) {
			case 'send':
				return new SendIdocStrategy();

			case 'build':
				return new BuildIdocXmlStrategy();

			default:
				// Throw error for unknown operations
				throw new NodeOperationError(
					// @ts-ignore - null is acceptable here as we don't have node context
					null,
					`The operation "${operation}" is not supported for the IDoc node. Supported operations are: send, build`,
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
		return ['send', 'build'].includes(operation);
	}

	/**
	 * Get list of supported operations
	 *
	 * @returns Array of supported operation names
	 */
	public static getSupportedOperations(): string[] {
		return ['send', 'build'];
	}
}