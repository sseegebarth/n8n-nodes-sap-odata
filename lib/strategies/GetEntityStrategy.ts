import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sapOdataApiRequest } from '../../nodes/SapOData/GenericFunctions';
import { ODataVersionHelper } from '../utils/ODataVersionHelper';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';

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

			// Get OData version
			const odataVersion = await ODataVersionHelper.getODataVersion(context);

			// Extract entity key from Resource Locator
			const entityKeyParam = context.getNodeParameter('entityKey', itemIndex) as string | { mode: string; value: string };
			const entityKey = typeof entityKeyParam === 'string'
				? entityKeyParam
				: entityKeyParam.value;

			// Validate and format the entity key with version-specific formatting
			let formattedKey = this.validateAndFormatKey(entityKey, context.getNode());
			formattedKey = ODataVersionHelper.formatEntityKey(formattedKey, odataVersion);

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

			// Extract result using version-specific logic and apply type conversion
			const result = ODataVersionHelper.extractData(response, odataVersion);
			const convertedResult = this.applyTypeConversion(context, itemIndex, result);
			return this.formatSuccessResponse(convertedResult, itemIndex);
	}
}
