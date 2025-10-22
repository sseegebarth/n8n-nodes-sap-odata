import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { CrudStrategy } from './base/CrudStrategy';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for updating an existing entity
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class UpdateEntityStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		
			const entitySet = this.getEntitySet(context, itemIndex);
			const entityKey = context.getNodeParameter('entityKey', itemIndex) as string;
			const dataString = context.getNodeParameter('data', itemIndex) as string;

			// Validate and format the entity key
			const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

			// Validate and parse JSON input using base class method
			const data = this.validateAndParseJson(dataString, 'Data', context.getNode());

			// Log operation for debugging
			this.logOperation('UPDATE', {
				entitySet,
				entityKey: formattedKey,
				itemIndex,
			});

			// Make API request (PATCH for partial update)
			const response = await sapOdataApiRequest.call(
				context,
				'PATCH',
				this.buildResourcePath(entitySet, formattedKey),
				data,
			);

			// Extract and format result
			// PATCH may return empty response, provide default success object
			const result = this.extractResult(response) || { success: true };
			return this.formatSuccessResponse(result, itemIndex);
	}
}
