import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { sapOdataApiRequest, sapOdataApiRequestAllItems } from '../../nodes/SapOData/GenericFunctions';
import { ODataVersionHelper } from '../utils/ODataVersionHelper';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';
import { IOperationOptions, IPaginationError } from './types';

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

			// Get OData version
			const odataVersion = await ODataVersionHelper.getODataVersion(context);

			// Get query options
			let query = this.getQueryOptions(context, itemIndex);

			// Check if user requested $count in options
			const hasCountOption = query.$count === true;

			// Apply version-specific parameter mapping
			// For returnAll: always include count for pagination
			// For limit mode: only apply version mapping if user explicitly requested $count
			if (returnAll) {
				query = ODataVersionHelper.getVersionSpecificParams(odataVersion, {
					...query,
					includeCount: true,
				});
			} else if (hasCountOption) {
				// User explicitly requested $count - apply version-specific mapping
				// OData V2 needs $inlinecount=allpages instead of $count=true
				delete query.$count;
				query = ODataVersionHelper.getVersionSpecificParams(odataVersion, {
					...query,
					count: true,
				});
			}

			// Apply batch size if configured
			const options = context.getNodeParameter('options', itemIndex, {}) as IOperationOptions;
			if (options.batchSize) {
				query.$top = options.batchSize;
			}

			// Use fixed defaults for pagination behavior
			const continueOnFail = false; // Don't continue on pagination errors
			const maxItems = 0; // No limit (fetch all)

			// Log operation for debugging
			this.logOperation('GET_ALL', {
				entitySet,
				returnAll,
				itemIndex,
			});

			let responseData: IDataObject | IDataObject[];
			let paginationErrors: IPaginationError[] | undefined;
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

				// Check if result is IPaginationResult (has data property) or IDataObject[]
				if (Array.isArray(result)) {
					// Result is IDataObject[] (simple array)
					responseData = result;
				} else {
					// Result is IPaginationResult (object with data property)
					responseData = result.data;
					// Map PaginationHandler errors to IPaginationError format
					paginationErrors = result.errors?.map((err) => ({
						page: err.page,
						error: err.error,
						timestamp: new Date(),
					}));
					limitReached = result.limitReached === true;
					partialMessage = result.message;
				}
			} else {
				// Fetch only one page
				const limit = context.getNodeParameter('limit', itemIndex) as number;
				query.$top = limit;

				const response: any = await sapOdataApiRequest.call(
					context,
					'GET',
					this.buildResourcePath(entitySet),
					{},
					query,
				);

				// Extract results from response using version-specific logic
				responseData = ODataVersionHelper.extractData(response, odataVersion);

				// Log extraction result for debugging
				this.logOperation('DATA_EXTRACTED', {
					isArray: Array.isArray(responseData),
					itemCount: Array.isArray(responseData) ? responseData.length : 1,
					hasD: !!(response as any)?.d,
					hasDResults: !!(response as any)?.d?.results,
				});
			}

			// Convert to array if not already
			// Safety check: if responseData looks like a wrapper object with results, extract them
			let dataArray: IDataObject[];
			if (Array.isArray(responseData)) {
				dataArray = responseData;
			} else if (responseData && typeof responseData === 'object') {
				// Check if this is still a wrapper object (extraction didn't work properly)
				if ((responseData as any).results && Array.isArray((responseData as any).results)) {
					// This is still wrapped - extract the results
					dataArray = (responseData as any).results;
					this.logOperation('FALLBACK_EXTRACTION', {
						message: 'Extracted results from wrapper object',
						itemCount: dataArray.length,
					});
				} else if ((responseData as any).d?.results && Array.isArray((responseData as any).d.results)) {
					// Double-wrapped - extract from d.results
					dataArray = (responseData as any).d.results;
					this.logOperation('FALLBACK_EXTRACTION', {
						message: 'Extracted results from d.results wrapper',
						itemCount: dataArray.length,
					});
				} else {
					// Single entity or unknown structure - wrap in array
					dataArray = [responseData];
				}
			} else {
				dataArray = responseData ? [responseData] : [];
			}

			// Map to INodeExecutionData with optional type conversion
			const executionData: INodeExecutionData[] = dataArray.map((item) => {
				const converted = this.applyTypeConversion(context, itemIndex, item);
				const jsonData: IDataObject = (typeof converted === 'object' && converted !== null)
					? converted as IDataObject
					: { value: converted as string | number | boolean };
				return {
					json: jsonData,
					pairedItem: { item: itemIndex },
				};
			});

			// If there were pagination errors or limit was reached, add metadata item
			if ((paginationErrors && paginationErrors.length > 0) || limitReached) {
				const metadata: IDataObject = {
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
