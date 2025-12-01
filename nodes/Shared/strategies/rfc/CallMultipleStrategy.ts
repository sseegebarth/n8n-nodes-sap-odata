import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { executeStatefulCalls } from '../../../SapRfc/RfcFunctions';
import { LoggerAdapter } from '../../utils/LoggerAdapter';
import { sanitizeErrorMessage } from '../../utils/SecurityUtils';
import { IRfcOperationStrategy } from './IRfcOperationStrategy';

/**
 * Strategy for calling multiple RFC functions in a stateful session.
 * Maintains transaction context across multiple function calls.
 */
export class CallMultipleStrategy implements IRfcOperationStrategy {

	public async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		try {
			// Log operation start
			const functions = context.getNodeParameter('functions', itemIndex) as any[];
			LoggerAdapter.debug('CallMultipleStrategy', {
				operation: 'callMultiple',
				functionCount: functions?.length || 0,
				itemIndex,
			});

			// Execute stateful RFC calls using existing logic
			const result = await executeStatefulCalls.call(context, itemIndex);

			// Format response according to strategy pattern
			const executionData: INodeExecutionData = {
				json: result,
				pairedItem: { item: itemIndex },
			};

			// Log successful execution
			LoggerAdapter.debug('CallMultipleStrategy', {
				operation: 'callMultiple',
				status: 'success',
				hasResult: !!result,
				resultCount: Array.isArray(result) ? result.length : 1,
			});

			return [executionData];
		} catch (error) {
			// Sanitize and log error
			const errorMessage = sanitizeErrorMessage(
				error instanceof Error ? error.message : String(error)
			);

			LoggerAdapter.error('CallMultipleStrategy error', error instanceof Error ? error : new Error(errorMessage), {
				operation: 'callMultiple',
				itemIndex,
			});

			// Re-throw for node-level error handling
			throw error;
		}
	}
}