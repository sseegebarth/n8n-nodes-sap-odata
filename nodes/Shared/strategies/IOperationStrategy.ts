import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * Interface for operation strategies
 * Each operation (create, get, update, etc.) implements this interface
 *
 * Error Handling Contract:
 * - Implementations MUST throw NodeOperationError for validation errors
 * - Implementations MUST throw NodeApiError for API/network errors
 * - Implementations SHOULD use error handlers from ErrorHandler module
 * - All errors MUST be properly sanitized (no credential leakage)
 *
 * Return Value Contract:
 * - MUST return array of INodeExecutionData
 * - Each item MUST have 'json' property containing response data
 * - Each item SHOULD have 'pairedItem' property for item tracking
 * - getAll operations MAY return multiple items per input item
 */
export interface IOperationStrategy {
	/**
	 * Execute the operation
	 * @param context - n8n execution context
	 * @param itemIndex - Index of the current item being processed
	 * @returns Array of execution data (can return multiple items for getAll)
	 * @throws NodeOperationError for validation/parameter errors
	 * @throws NodeApiError for API/network errors
	 */
	execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]>;
}
