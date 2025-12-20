"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchDeleteStrategy = void 0;
const ApiClient_1 = require("../core/ApiClient");
const BatchRequestBuilder_1 = require("../utils/BatchRequestBuilder");
const Logger_1 = require("../utils/Logger");
const StrategyHelpers_1 = require("../utils/StrategyHelpers");
const CrudStrategy_1 = require("./base/CrudStrategy");
class BatchDeleteStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(itemIndex) {
        try {
            const entitySet = (0, StrategyHelpers_1.getEntitySet)(this, itemIndex);
            const servicePath = (0, StrategyHelpers_1.getServicePath)(this, itemIndex);
            const batchMode = this.getNodeParameter('batchMode', itemIndex, 'changeset');
            const batchSize = this.getNodeParameter('batchSize', itemIndex, 100);
            const keysInput = this.getNodeParameter('keys', itemIndex, '[]');
            const keys = (0, StrategyHelpers_1.validateAndParseJson)(keysInput, 'keys', this.getNode());
            if (!Array.isArray(keys)) {
                throw new Error('Keys must be an array of entity key values');
            }
            if (keys.length === 0) {
                throw new Error('No keys provided for batch deletion');
            }
            Logger_1.Logger.info('Batch Delete started', {
                module: 'BatchDeleteStrategy',
                entitySet,
                deleteCount: keys.length,
            });
            const operations = keys.map((key) => ({
                type: BatchRequestBuilder_1.BatchOperationType.DELETE,
                entitySet,
                entityKey: (0, StrategyHelpers_1.validateAndFormatKey)(String(key), this.getNode()),
            }));
            const validation = BatchRequestBuilder_1.BatchRequestBuilder.validateOperations(operations);
            if (!validation.valid) {
                throw new Error(`Batch validation failed: ${validation.errors.join(', ')}`);
            }
            const batches = BatchRequestBuilder_1.BatchRequestBuilder.splitIntoBatches(operations, batchSize);
            const allResults = [];
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batchOps = batches[batchIndex];
                const batchRequest = BatchRequestBuilder_1.BatchRequestBuilder.buildBatchRequest({
                    operations: batchOps,
                    servicePath,
                    useChangeSet: batchMode === 'changeset',
                });
                const response = await ApiClient_1.executeRequest.call(this, {
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
                const batchResponse = BatchRequestBuilder_1.BatchRequestBuilder.parseBatchResponse(String(response), batchRequest.boundary);
                batchResponse.results.forEach((result, idx) => {
                    allResults.push({
                        success: result.success,
                        error: result.error,
                        statusCode: result.statusCode,
                        index: batchIndex * batchSize + idx,
                        key: keys[batchIndex * batchSize + idx],
                    });
                });
                Logger_1.Logger.info('Delete batch executed', {
                    module: 'BatchDeleteStrategy',
                    batchIndex: batchIndex + 1,
                    successCount: batchResponse.results.filter(r => r.success).length,
                });
            }
            return (0, StrategyHelpers_1.formatSuccessResponse)({
                totalDeletions: operations.length,
                successfulDeletions: allResults.filter(r => r.success).length,
                failedDeletions: allResults.filter(r => !r.success).length,
                results: allResults,
            }, 'Batch Delete');
        }
        catch (error) {
            return (0, StrategyHelpers_1.handleOperationError)(error, this, itemIndex, this.continueOnFail());
        }
    }
}
exports.BatchDeleteStrategy = BatchDeleteStrategy;
