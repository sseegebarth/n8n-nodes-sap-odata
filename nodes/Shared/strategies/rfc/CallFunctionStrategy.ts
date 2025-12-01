import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { invokeRfc } from '../../../SapRfc/RfcFunctions';
import { LoggerAdapter } from '../../utils/LoggerAdapter';
import { sanitizeErrorMessage } from '../../utils/SecurityUtils';
import { IRfcOperationStrategy } from './IRfcOperationStrategy';

/**
 * Strategy for calling a single RFC function module or BAPI.
 * Handles function execution, auto-commit, and error processing.
 */
export class CallFunctionStrategy implements IRfcOperationStrategy {

	public async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		try {
			// Log operation start
			const functionName = context.getNodeParameter('functionName', itemIndex) as string;
			LoggerAdapter.debug('CallFunctionStrategy', {
				operation: 'callFunction',
				functionName,
				itemIndex,
			});

			// Execute the RFC function using existing logic
			// The .call(context, itemIndex) ensures proper 'this' binding
			const result = await invokeRfc.call(context, itemIndex);

			// Format response according to strategy pattern
			const executionData: INodeExecutionData = {
				json: result,
				pairedItem: { item: itemIndex },
			};

			// Log successful execution
			LoggerAdapter.debug('CallFunctionStrategy', {
				operation: 'callFunction',
				functionName,
				status: 'success',
				hasResult: !!result,
			});

			return [executionData];
		} catch (error) {
			// Sanitize and log error
			const errorMessage = sanitizeErrorMessage(
				error instanceof Error ? error.message : String(error)
			);

			LoggerAdapter.error('CallFunctionStrategy error', error instanceof Error ? error : new Error(errorMessage), {
				operation: 'callFunction',
				itemIndex,
			});

			// Re-throw for node-level error handling
			throw error;
		}
	}
}