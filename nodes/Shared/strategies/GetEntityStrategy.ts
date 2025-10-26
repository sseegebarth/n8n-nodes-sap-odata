import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { CrudStrategy } from './base/CrudStrategy';
import { sapOdataApiRequest } from '../../Sap/GenericFunctions';

/**
 * Strategy for getting a single entity by key
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class GetEntityStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		
			const entitySet = this.getEntitySet(context, itemIndex);
			const entityKey = context.getNodeParameter('entityKey', itemIndex) as string;

			// Validate and format the entity key
			const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

			// Get query options
			const query = this.getQueryOptions(context, itemIndex);

			// Log operation for debugging
			this.logOperation('GET', {
				entitySet,
				entityKey: formattedKey,
				itemIndex,
			});

			// Make API request
			const response = await sapOdataApiRequest.call(
				context,
				'GET',
				this.buildResourcePath(entitySet, formattedKey),
				{},
				query,
			);

			// Extract result and apply type conversion
			const result = this.extractResult(response);
			const convertedResult = this.applyTypeConversion(context, itemIndex, result);
			return this.formatSuccessResponse(convertedResult, itemIndex);
	}
}
