"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchUpdateStrategy = void 0;
const ApiClient_1 = require("../core/ApiClient");
const BatchRequestBuilder_1 = require("../utils/BatchRequestBuilder");
const Logger_1 = require("../utils/Logger");
const StrategyHelpers_1 = require("../utils/StrategyHelpers");
const CrudStrategy_1 = require("./base/CrudStrategy");
class BatchUpdateStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(itemIndex) {
        try {
            const entitySet = (0, StrategyHelpers_1.getEntitySet)(this, itemIndex);
            const servicePath = (0, StrategyHelpers_1.getServicePath)(this, itemIndex);
            const batchMode = this.getNodeParameter('batchMode', itemIndex, 'changeset');
            const batchSize = this.getNodeParameter('batchSize', itemIndex, 100);
            const updatesInput = this.getNodeParameter('updates', itemIndex, '[]');
            const updates = (0, StrategyHelpers_1.validateAndParseJson)(updatesInput, 'updates', this.getNode());
            if (!Array.isArray(updates)) {
                throw new Error('Updates must be an array of {key, data} objects');
            }
            Logger_1.Logger.info('Batch Update started', {
                module: 'BatchUpdateStrategy',
                entitySet,
                updateCount: updates.length,
            });
            const operations = updates.map((update) => {
                if (!update.key) {
                    throw new Error('Each update must have a "key" property');
                }
                if (!update.data) {
                    throw new Error('Each update must have a "data" property');
                }
                return {
                    type: BatchRequestBuilder_1.BatchOperationType.UPDATE,
                    entitySet,
                    entityKey: (0, StrategyHelpers_1.validateAndFormatKey)(update.key, this.getNode()),
                    data: update.data,
                };
            });
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
                    var _a;
                    allResults.push({
                        success: result.success,
                        entity: result.data,
                        error: result.error,
                        statusCode: result.statusCode,
                        index: batchIndex * batchSize + idx,
                        key: (_a = updates[batchIndex * batchSize + idx]) === null || _a === void 0 ? void 0 : _a.key,
                    });
                });
                Logger_1.Logger.info('Update batch executed', {
                    module: 'BatchUpdateStrategy',
                    batchIndex: batchIndex + 1,
                    successCount: batchResponse.results.filter(r => r.success).length,
                });
            }
            const convertedResults = allResults.map(result => (0, StrategyHelpers_1.applyTypeConversion)(result, this, itemIndex));
            return (0, StrategyHelpers_1.formatSuccessResponse)({
                totalUpdates: operations.length,
                successfulUpdates: allResults.filter(r => r.success).length,
                failedUpdates: allResults.filter(r => !r.success).length,
                results: convertedResults,
            }, 'Batch Update');
        }
        catch (error) {
            return (0, StrategyHelpers_1.handleOperationError)(error, this, itemIndex, this.continueOnFail());
        }
    }
}
exports.BatchUpdateStrategy = BatchUpdateStrategy;
