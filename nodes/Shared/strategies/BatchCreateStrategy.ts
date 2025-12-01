/**
 * BatchCreateStrategy - Bulk entity creation using SAP OData $batch
 *
 * Creates multiple entities in a single HTTP request
 * Supports both transactional (ChangeSet) and independent mode
 */

import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { executeRequest } from '../core/ApiClient';
import {
	BatchRequestBuilder,
	BatchOperationType,
	IBatchOperation,
} from '../utils/BatchRequestBuilder';
import { Logger } from '../utils/Logger';
import {
	getEntitySet,
	getServicePath,
	validateAndParseJson,
	applyTypeConversion,
	formatSuccessResponse,
	handleOperationError,
} from '../utils/StrategyHelpers';
import { CrudStrategy } from './base/CrudStrategy';

export class BatchCreateStrategy extends CrudStrategy {
	async execute(
		this: IExecuteFunctions,
		itemIndex: number
	): Promise<INodeExecutionData[]> {
		try {
			// Get configuration
			const entitySet = getEntitySet(this, itemIndex);
			const servicePath = getServicePath(this, itemIndex);
			const batchMode = this.getNodeParameter('batchMode', itemIndex, 'changeset') as string;
			const batchSize = this.getNodeParameter('batchSize', itemIndex, 100) as number;

			// Get input data (multiple entities)
			const itemsInput = this.getNodeParameter('items', itemIndex, '[]') as string;
			const entities = validateAndParseJson(itemsInput, 'items', this.getNode());

			// Validate it's an array
			if (!Array.isArray(entities)) {
				throw new Error('Items must be an array of entity objects');
			}

			if (entities.length === 0) {
				throw new Error('No entities provided for batch creation');
			}

			Logger.info('Batch Create started', {
				module: 'BatchCreateStrategy',
				entitySet,
				entityCount: entities.length,
				batchMode,
			});

			// Build batch operations
			const operations: IBatchOperation[] = entities.map((entity) => ({
				type: BatchOperationType.CREATE,
				entitySet,
				data: entity as IDataObject,
			}));

			// Validate operations
			const validation = BatchRequestBuilder.validateOperations(operations);
			if (!validation.valid) {
				throw new Error(`Batch validation failed: ${validation.errors.join(', ')}`);
			}

			// Split into batches if needed
			const batches = BatchRequestBuilder.splitIntoBatches(operations, batchSize);

			Logger.debug('Batch operations prepared', {
				module: 'BatchCreateStrategy',
				totalOperations: operations.length,
				numberOfBatches: batches.length,
			});

			// Execute each batch
			const allResults: any[] = [];

			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				const batchOps = batches[batchIndex];

				Logger.debug('Executing batch', {
					module: 'BatchCreateStrategy',
					batchIndex: batchIndex + 1,
					totalBatches: batches.length,
					operationCount: batchOps.length,
				});

				// Build batch request
				const batchRequest = BatchRequestBuilder.buildBatchRequest({
					operations: batchOps,
					servicePath,
					useChangeSet: batchMode === 'changeset',
				});

				// Execute batch request
				const response = await executeRequest.call(this, {
					method: 'POST',
					resource: '$batch',
					body: {},
					uri: undefined,
					servicePath,
					options: {
						body: batchRequest.body,
						headers: {
							'Content-Type': batchRequest.contentType,
						},
					},
				});

				// Parse batch response
				const batchResponse = BatchRequestBuilder.parseBatchResponse(
					String(response),
					batchRequest.boundary
				);

				// Collect results
				batchResponse.results.forEach((result, idx) => {
					if (result.success) {
						allResults.push({
							success: true,
							entity: result.data,
							index: batchIndex * batchSize + idx,
						});
					} else {
						allResults.push({
							success: false,
							error: result.error,
							statusCode: result.statusCode,
							index: batchIndex * batchSize + idx,
						});
					}
				});

				Logger.info('Batch executed', {
					module: 'BatchCreateStrategy',
					batchIndex: batchIndex + 1,
					successCount: batchResponse.results.filter(r => r.success).length,
					failureCount: batchResponse.results.filter(r => !r.success).length,
				});
			}

			// Apply type conversion to results
			const convertedResults = allResults.map(result =>
				applyTypeConversion(result, this, itemIndex)
			);

			// Format response
			return formatSuccessResponse(
				{
					totalOperations: operations.length,
					successfulOperations: allResults.filter(r => r.success).length,
					failedOperations: allResults.filter(r => !r.success).length,
					results: convertedResults,
				},
				'Batch Create'
			);

		} catch (error) {
			return handleOperationError(
				error,
				this,
				itemIndex,
				this.continueOnFail()
			);
		}
	}
}
