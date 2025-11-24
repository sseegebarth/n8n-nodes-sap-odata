import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * Defines the contract for an RFC operation strategy.
 * All RFC operations (callFunction, callMultiple) must implement this interface.
 *
 * This follows the same pattern as the OData strategies for consistency.
 */
export interface IRfcOperationStrategy {
	/**
	 * Executes the specific RFC operation.
	 *
	 * @param context - The execution context from the node
	 * @param itemIndex - The index of the current item being processed
	 * @returns Promise resolving to array of node execution data
	 * @throws NodeOperationError for validation/parameter errors
	 * @throws NodeApiError for SAP system/network errors
	 */
	execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]>;
}