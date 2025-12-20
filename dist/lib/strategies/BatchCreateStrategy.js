"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchCreateStrategy = void 0;
const ApiClient_1 = require("../core/ApiClient");
const BatchRequestBuilder_1 = require("../utils/BatchRequestBuilder");
const Logger_1 = require("../utils/Logger");
const StrategyHelpers_1 = require("../utils/StrategyHelpers");
const CrudStrategy_1 = require("./base/CrudStrategy");
class BatchCreateStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(itemIndex) {
        try {
            const entitySet = (0, StrategyHelpers_1.getEntitySet)(this, itemIndex);
            const servicePath = (0, StrategyHelpers_1.getServicePath)(this, itemIndex);
            const batchMode = this.getNodeParameter('batchMode', itemIndex, 'changeset');
            const batchSize = this.getNodeParameter('batchSize', itemIndex, 100);
            const itemsInput = this.getNodeParameter('items', itemIndex, '[]');
            const entities = (0, StrategyHelpers_1.validateAndParseJson)(itemsInput, 'items', this.getNode());
            if (!Array.isArray(entities)) {
                throw new Error('Items must be an array of entity objects');
            }
            if (entities.length === 0) {
                throw new Error('No entities provided for batch creation');
            }
            Logger_1.Logger.info('Batch Create started', {
                module: 'BatchCreateStrategy',
                entitySet,
                entityCount: entities.length,
                batchMode,
            });
            const operations = entities.map((entity) => ({
                type: BatchRequestBuilder_1.BatchOperationType.CREATE,
                entitySet,
                data: entity,
            }));
            const validation = BatchRequestBuilder_1.BatchRequestBuilder.validateOperations(operations);
            if (!validation.valid) {
                throw new Error(`Batch validation failed: ${validation.errors.join(', ')}`);
            }
            const batches = BatchRequestBuilder_1.BatchRequestBuilder.splitIntoBatches(operations, batchSize);
            Logger_1.Logger.debug('Batch operations prepared', {
                module: 'BatchCreateStrategy',
                totalOperations: operations.length,
                numberOfBatches: batches.length,
            });
            const allResults = [];
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batchOps = batches[batchIndex];
                Logger_1.Logger.debug('Executing batch', {
                    module: 'BatchCreateStrategy',
                    batchIndex: batchIndex + 1,
                    totalBatches: batches.length,
                    operationCount: batchOps.length,
                });
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
                    if (result.success) {
                        allResults.push({
                            success: true,
                            entity: result.data,
                            index: batchIndex * batchSize + idx,
                        });
                    }
                    else {
                        allResults.push({
                            success: false,
                            error: result.error,
                            statusCode: result.statusCode,
                            index: batchIndex * batchSize + idx,
                        });
                    }
                });
                Logger_1.Logger.info('Batch executed', {
                    module: 'BatchCreateStrategy',
                    batchIndex: batchIndex + 1,
                    successCount: batchResponse.results.filter(r => r.success).length,
                    failureCount: batchResponse.results.filter(r => !r.success).length,
                });
            }
            const convertedResults = allResults.map(result => (0, StrategyHelpers_1.applyTypeConversion)(result, this, itemIndex));
            return (0, StrategyHelpers_1.formatSuccessResponse)({
                totalOperations: operations.length,
                successfulOperations: allResults.filter(r => r.success).length,
                failedOperations: allResults.filter(r => !r.success).length,
                results: convertedResults,
            }, 'Batch Create');
        }
        catch (error) {
            return (0, StrategyHelpers_1.handleOperationError)(error, this, itemIndex, this.continueOnFail());
        }
    }
}
exports.BatchCreateStrategy = BatchCreateStrategy;
