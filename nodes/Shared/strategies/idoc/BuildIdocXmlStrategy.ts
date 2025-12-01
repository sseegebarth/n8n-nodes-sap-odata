import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { prepareIdocData, buildIdocXml } from '../../../SapIdoc/IdocFunctions';
import { LoggerAdapter } from '../../utils/LoggerAdapter';
import { sanitizeErrorMessage } from '../../utils/SecurityUtils';
import { IIdocOperationStrategy } from './IIdocOperationStrategy';

/**
 * Strategy for building IDoc XML without sending.
 * Useful for validation, debugging, or external processing.
 */
export class BuildIdocXmlStrategy implements IIdocOperationStrategy {

	public async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		try {
			// Log operation start
			const idocType = context.getNodeParameter('idocType', itemIndex) as string;
			LoggerAdapter.debug('BuildIdocXmlStrategy', {
				operation: 'build',
				idocType,
				itemIndex,
			});

			// Prepare IDoc data and build XML using existing logic
			const idocData = prepareIdocData.call(context, itemIndex);
			const xml = buildIdocXml(idocData);

			// Format response
			const result = {
				success: true,
				xml,
				idocType: idocData.idocType,
				docnum: idocData.controlRecord.DOCNUM,
			};

			// Format response according to strategy pattern
			const executionData: INodeExecutionData = {
				json: result,
				pairedItem: { item: itemIndex },
			};

			// Log successful execution
			LoggerAdapter.debug('BuildIdocXmlStrategy', {
				operation: 'build',
				idocType,
				status: 'success',
				docNum: idocData.controlRecord.DOCNUM,
				xmlLength: xml?.length || 0,
			});

			return [executionData];
		} catch (error) {
			// Sanitize and log error
			const errorMessage = sanitizeErrorMessage(
				error instanceof Error ? error.message : String(error)
			);

			LoggerAdapter.error('BuildIdocXmlStrategy error', error instanceof Error ? error : new Error(errorMessage), {
				operation: 'build',
				itemIndex,
			});

			// Re-throw for node-level error handling
			throw error;
		}
	}
}