import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sendIdoc } from '../../../SapIdoc/IdocFunctions';
import { LoggerAdapter } from '../../utils/LoggerAdapter';
import { sanitizeErrorMessage } from '../../utils/SecurityUtils';
import { IIdocOperationStrategy } from './IIdocOperationStrategy';

/**
 * Strategy for sending IDocs to SAP systems.
 * Handles IDoc transmission and response processing.
 */
export class SendIdocStrategy implements IIdocOperationStrategy {

	public async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		try {
			// Log operation start
			const idocType = context.getNodeParameter('idocType', itemIndex) as string;
			LoggerAdapter.debug('SendIdocStrategy', {
				operation: 'send',
				idocType,
				itemIndex,
			});

			// Send IDoc to SAP using existing logic
			const result = await sendIdoc.call(context, itemIndex);

			// Format response according to strategy pattern
			const executionData: INodeExecutionData = {
				json: result,
				pairedItem: { item: itemIndex },
			};

			// Log successful execution
			LoggerAdapter.debug('SendIdocStrategy', {
				operation: 'send',
				idocType,
				status: 'success',
				hasResult: !!result,
			});

			return [executionData];
		} catch (error) {
			// Sanitize and log error
			const errorMessage = sanitizeErrorMessage(
				error instanceof Error ? error.message : String(error)
			);

			LoggerAdapter.error('SendIdocStrategy error', error instanceof Error ? error : new Error(errorMessage), {
				operation: 'send',
				itemIndex,
			});

			// Re-throw for node-level error handling
			throw error;
		}
	}
}