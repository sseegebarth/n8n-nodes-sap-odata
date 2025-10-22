import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { BaseEntityStrategy } from './BaseEntityStrategy';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for deleting an entity
 */
export class DeleteEntityStrategy extends BaseEntityStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		const entitySet = this.getEntitySet(context, itemIndex);
		const entityKey = context.getNodeParameter('entityKey', itemIndex) as string;

		// Validate and format the entity key
		const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

		// Make API request
		await sapOdataApiRequest.call(
			context,
			'DELETE',
			`/${entitySet}(${formattedKey})`,
		);

		return [
			{
				json: { success: true },
				pairedItem: { item: itemIndex },
			},
		];
	}
}
