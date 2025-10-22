import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { CrudStrategy } from './base/CrudStrategy';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for deleting an entity
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class DeleteEntityStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		
			const entitySet = this.getEntitySet(context, itemIndex);
			const entityKey = context.getNodeParameter('entityKey', itemIndex) as string;

			// Validate and format the entity key
			const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

			// Log operation for debugging
			this.logOperation('DELETE', {
				entitySet,
				entityKey: formattedKey,
				itemIndex,
			});

			// Make API request
			await sapOdataApiRequest.call(
				context,
				'DELETE',
				this.buildResourcePath(entitySet, formattedKey),
			);

			// DELETE typically returns empty response, return success
			return this.formatSuccessResponse({ success: true }, itemIndex);
	}
}
