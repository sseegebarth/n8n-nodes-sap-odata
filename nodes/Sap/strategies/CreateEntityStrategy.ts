import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { BaseEntityStrategy } from './BaseEntityStrategy';
import { validateJsonInput } from '../SecurityUtils';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for creating a new entity
 */
export class CreateEntityStrategy extends BaseEntityStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		const entitySet = this.getEntitySet(context, itemIndex);
		const dataString = context.getNodeParameter('data', itemIndex) as string;

		// Validate and parse JSON input
		const data = validateJsonInput(dataString, 'Data', context.getNode());

		// Make API request
		const response = await sapOdataApiRequest.call(
			context,
			'POST',
			`/${entitySet}`,
			data as IDataObject,
		);

		return [
			{
				json: this.extractResult(response),
				pairedItem: { item: itemIndex },
			},
		];
	}
}
