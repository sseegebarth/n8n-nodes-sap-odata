import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { BaseEntityStrategy } from './BaseEntityStrategy';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for getting a single entity by key
 */
export class GetEntityStrategy extends BaseEntityStrategy implements IOperationStrategy {
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

		// Make API request
		const response = await sapOdataApiRequest.call(
			context,
			'GET',
			`/${entitySet}(${formattedKey})`,
			{},
			query,
		);

		return [
			{
				json: this.extractResult(response),
				pairedItem: { item: itemIndex },
			},
		];
	}
}
