import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { BaseEntityStrategy } from './BaseEntityStrategy';
import { validateJsonInput } from '../SecurityUtils';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for updating an existing entity
 */
export class UpdateEntityStrategy extends BaseEntityStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		const entitySet = this.getEntitySet(context, itemIndex);
		const entityKey = context.getNodeParameter('entityKey', itemIndex) as string;
		const dataString = context.getNodeParameter('data', itemIndex) as string;

		// Validate and format the entity key
		const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

		// Validate and parse JSON input
		const data = validateJsonInput(dataString, 'Data', context.getNode());

		// Make API request (PATCH for partial update)
		const response = await sapOdataApiRequest.call(
			context,
			'PATCH',
			`/${entitySet}(${formattedKey})`,
			data as IDataObject,
		);

		return [
			{
				json: this.extractResult(response) || { success: true },
				pairedItem: { item: itemIndex },
			},
		];
	}
}
