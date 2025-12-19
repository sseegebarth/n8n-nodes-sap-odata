import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sapOdataApiRequest } from '../../nodes/SapOData/GenericFunctions';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';

/**
 * Strategy for creating a new entity
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class CreateEntityStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		
			const entitySet = this.getEntitySet(context, itemIndex);
			const dataString = context.getNodeParameter('data', itemIndex) as string;

			// Validate and parse JSON input using base class method
			const data = this.validateAndParseJson(dataString, 'Data', context.getNode());

			// Log operation for debugging
			this.logOperation('CREATE', {
				entitySet,
				itemIndex,
			});

			// Make API request
			const response = await sapOdataApiRequest.call(
				context,
				'POST',
				this.buildResourcePath(entitySet),
				data,
			);

			// Extract result and apply type conversion
			const result = this.extractResult(response);
			const convertedResult = this.applyTypeConversion(context, itemIndex, result);
			return this.formatSuccessResponse(convertedResult, itemIndex);
	}
}
