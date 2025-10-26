import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { CrudStrategy } from './base/CrudStrategy';
import { sapOdataApiRequest, sapOdataApiRequestAllItems } from '../../Sap/GenericFunctions';

/**
 * Strategy for getting all entities with optional pagination
 * Supports automatic pagination, error recovery, and memory limits
 *
 * Note: For streaming large datasets with minimal memory usage,
 * use streamAllItems from core/PaginationHandler directly
 */
export class GetAllEntitiesStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		try {
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

			// Log operation for debugging
			this.logOperation('GET_ALL', {
				entitySet,
				returnAll,
				maxItems,
				continueOnFail,
				itemIndex,
			});

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
					this.buildResourcePath(entitySet),
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
					this.buildResourcePath(entitySet),
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

			// Map to INodeExecutionData with optional type conversion
			const executionData = dataArray.map((item) => ({
				json: this.applyTypeConversion(context, itemIndex, item),
				pairedItem: { item: itemIndex },
			}));

			// If there were pagination errors or limit was reached, add metadata item
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
		} catch (error) {
			// Handle errors with base class error handler
			const continueOnFail = context.continueOnFail();
			return this.handleOperationError(
				error as Error,
				'Get All Entities',
				itemIndex,
				continueOnFail,
			);
		}
	}
}
