/**
 * BatchDeleteStrategy - Bulk entity deletion using SAP OData $batch
 */

import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
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
	formatSuccessResponse,
	handleOperationError,
} from '../utils/StrategyHelpers';
import { CrudStrategy } from './base/CrudStrategy';

export class BatchDeleteStrategy extends CrudStrategy {
	async execute(
		this: IExecuteFunctions,
		itemIndex: number
	): Promise<INodeExecutionData[]> {
		try {
			const entitySet = getEntitySet(this, itemIndex);
			const servicePath = getServicePath(this, itemIndex);
			const batchMode = this.getNodeParameter('batchMode', itemIndex, 'changeset') as string;
			const batchSize = this.getNodeParameter('batchSize', itemIndex, 100) as number;

			// Get entity keys to delete
			const keysInput = this.getNodeParameter('keys', itemIndex, '[]') as string;
			const keys = validateAndParseJson(keysInput, 'keys', this.getNode());

			if (!Array.isArray(keys)) {
				throw new Error('Keys must be an array of entity key values');
			}

			if (keys.length === 0) {
				throw new Error('No keys provided for batch deletion');
			}

			Logger.info('Batch Delete started', {
				module: 'BatchDeleteStrategy',
				entitySet,
				deleteCount: keys.length,
			});

			// Build batch operations
			const operations: IBatchOperation[] = keys.map((key) => ({
				type: BatchOperationType.DELETE,
				entitySet,
				entityKey: validateAndFormatKey(String(key), this.getNode()),
			}));

			// Validate operations
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
						error: result.error,
						statusCode: result.statusCode,
						index: batchIndex * batchSize + idx,
						key: keys[batchIndex * batchSize + idx],
					});
				});

				Logger.info('Delete batch executed', {
					module: 'BatchDeleteStrategy',
					batchIndex: batchIndex + 1,
					successCount: batchResponse.results.filter(r => r.success).length,
				});
			}

			return formatSuccessResponse(
				{
					totalDeletions: operations.length,
					successfulDeletions: allResults.filter(r => r.success).length,
					failedDeletions: allResults.filter(r => !r.success).length,
					results: allResults,
				},
				'Batch Delete'
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
