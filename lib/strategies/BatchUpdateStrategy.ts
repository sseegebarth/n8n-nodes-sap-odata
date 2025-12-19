/**
 * BatchUpdateStrategy - Bulk entity updates using SAP OData $batch
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
	validateAndFormatKey,
	applyTypeConversion,
	formatSuccessResponse,
	handleOperationError,
} from '../utils/StrategyHelpers';
import { CrudStrategy } from './base/CrudStrategy';

export class BatchUpdateStrategy extends CrudStrategy {
	async execute(
		this: IExecuteFunctions,
		itemIndex: number
	): Promise<INodeExecutionData[]> {
		try {
			const entitySet = getEntitySet(this, itemIndex);
			const servicePath = getServicePath(this, itemIndex);
			const batchMode = this.getNodeParameter('batchMode', itemIndex, 'changeset') as string;
			const batchSize = this.getNodeParameter('batchSize', itemIndex, 100) as number;

			// Get updates (array of {key, data})
			const updatesInput = this.getNodeParameter('updates', itemIndex, '[]') as string;
			const updates = validateAndParseJson(updatesInput, 'updates', this.getNode());

			if (!Array.isArray(updates)) {
				throw new Error('Updates must be an array of {key, data} objects');
			}

			Logger.info('Batch Update started', {
				module: 'BatchUpdateStrategy',
				entitySet,
				updateCount: updates.length,
			});

			// Build batch operations
			const operations: IBatchOperation[] = updates.map((update: any) => {
				if (!update.key) {
					throw new Error('Each update must have a "key" property');
				}
				if (!update.data) {
					throw new Error('Each update must have a "data" property');
				}

				return {
					type: BatchOperationType.UPDATE,
					entitySet,
					entityKey: validateAndFormatKey(update.key, this.getNode()),
					data: update.data as IDataObject,
				};
			});

			// Validate and execute batches
			const validation = BatchRequestBuilder.validateOperations(operations);
			if (!validation.valid) {
				throw new Error(`Batch validation failed: ${validation.errors.join(', ')}`);
			}

			const batches = BatchRequestBuilder.splitIntoBatches(operations, batchSize);
			const allResults: any[] = [];

			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				const batchOps = batches[batchIndex];

				const batchRequest = BatchRequestBuilder.buildBatchRequest({
					operations: batchOps,
					servicePath,
					useChangeSet: batchMode === 'changeset',
				});

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

				const batchResponse = BatchRequestBuilder.parseBatchResponse(
					String(response),
					batchRequest.boundary
				);

				batchResponse.results.forEach((result, idx) => {
					allResults.push({
						success: result.success,
						entity: result.data,
						error: result.error,
						statusCode: result.statusCode,
						index: batchIndex * batchSize + idx,
						key: updates[batchIndex * batchSize + idx]?.key,
					});
				});

				Logger.info('Update batch executed', {
					module: 'BatchUpdateStrategy',
					batchIndex: batchIndex + 1,
					successCount: batchResponse.results.filter(r => r.success).length,
				});
			}

			const convertedResults = allResults.map(result =>
				applyTypeConversion(result, this, itemIndex)
			);

			return formatSuccessResponse(
				{
					totalUpdates: operations.length,
					successfulUpdates: allResults.filter(r => r.success).length,
					failedUpdates: allResults.filter(r => !r.success).length,
					results: convertedResults,
				},
				'Batch Update'
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
