import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { BaseEntityStrategy } from './BaseEntityStrategy';
import { sapOdataApiRequest, sapOdataApiRequestAllItems } from '../GenericFunctions';

/**
 * Strategy for getting all entities with optional pagination
 */
export class GetAllEntitiesStrategy extends BaseEntityStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		const entitySet = this.getEntitySet(context, itemIndex);
		const returnAll = context.getNodeParameter('returnAll', itemIndex) as boolean;

		// Get query options
		const query = this.getQueryOptions(context, itemIndex);

		// Apply batch size if configured
		const options = context.getNodeParameter('options', itemIndex, {}) as any;
		if (options.batchSize) {
			query.$top = options.batchSize;
		}

		// Check if continueOnFail is enabled
		const continueOnFail = options.continueOnFail === true;
		const maxItems = typeof options.maxItems === 'number' ? options.maxItems : 0;

		let responseData: any;
		let paginationErrors: any[] | undefined;
		let limitReached = false;
		let partialMessage: string | undefined;

		if (returnAll) {
			// Fetch all pages with error recovery and memory limit support
			const result = await sapOdataApiRequestAllItems.call(
				context,
				'results',
				'GET',
				`/${entitySet}`,
				{},
				query,
				continueOnFail,
				maxItems,
			);

			// Check if result contains metadata (partial result, errors, or limit reached)
			if (result && typeof result === 'object' && result.partial === true) {
				responseData = result.data;
				paginationErrors = result.errors;
				limitReached = result.limitReached === true;
				partialMessage = result.message;
			} else {
				responseData = result;
			}
		} else {
			// Fetch only one page
			const limit = context.getNodeParameter('limit', itemIndex) as number;
			query.$top = limit;

			const response = await sapOdataApiRequest.call(
				context,
				'GET',
				`/${entitySet}`,
				{},
				query,
			);

			// Extract results from response
			// OData V2: response.d.results (array) or response.d (single)
			// OData V4: response.value (array) or response (single)
			responseData = response.d?.results || response.value || response.d || response;
		}

		// Convert to array if not already
		const dataArray = Array.isArray(responseData) ? responseData : [responseData];

		// Map to INodeExecutionData
		const executionData = dataArray.map((item) => ({
			json: item,
			pairedItem: { item: itemIndex },
		}));

		// If there were pagination errors or limit was reached, add an additional item with information
		if ((paginationErrors && paginationErrors.length > 0) || limitReached) {
			const metadata: any = {
				totalItemsFetched: dataArray.length,
				partial: true,
				message: partialMessage || `Fetched ${dataArray.length} items`,
			};

			if (paginationErrors && paginationErrors.length > 0) {
				metadata.paginationErrors = paginationErrors;
			}

			if (limitReached) {
				metadata.limitReached = true;
			}

			executionData.push({
				json: metadata,
				pairedItem: { item: itemIndex },
			});
		}

		return executionData;
	}
}
