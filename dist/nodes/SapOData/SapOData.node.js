"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapOData = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const strategies_1 = require("../../lib/strategies");
const SecurityUtils_1 = require("../../lib/utils/SecurityUtils");
const SapODataLoadOptions_1 = require("./SapODataLoadOptions");
const SapODataProperties_1 = require("./SapODataProperties");
const ConnectionTest_1 = require("./ConnectionTest");
const package_json_1 = require("../../package.json");
class SapOData {
    constructor() {
        this.description = {
            displayName: 'ATW SAP Connect OData',
            name: 'sapOData',
            icon: 'file:sap.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: `Connect to SAP systems via OData (v${package_json_1.version})`,
            defaults: {
                name: 'SAP Connect OData',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                {
                    name: 'sapOdataApi',
                    required: true,
                },
            ],
            properties: SapODataProperties_1.sapODataProperties,
        };
        this.methods = {
            loadOptions: SapODataLoadOptions_1.sapODataLoadOptions,
            listSearch: SapODataLoadOptions_1.sapODataListSearch,
            credentialTest: {
                async sapODataCredentialTest(credential) {
                    return ConnectionTest_1.testSapODataConnection.call(this, credential.data);
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const resource = this.getNodeParameter('resource', 0);
        const startTime = Date.now();
        let errorCount = 0;
        let successCount = 0;
        const advancedOptions = this.getNodeParameter('advancedOptions', 0, {});
        if (advancedOptions.clearCache === true) {
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            CacheManager.clearAllCache(this);
        }
        const includeMetrics = advancedOptions.includeMetrics === true;
        for (let i = 0; i < items.length; i++) {
            try {
                const operation = resource === 'entity'
                    ? this.getNodeParameter('operation', i)
                    : 'execute';
                const strategy = strategies_1.OperationStrategyFactory.getStrategy(resource, operation);
                const result = await strategy.execute(this, i);
                returnData.push(...result);
                successCount++;
            }
            catch (error) {
                errorCount++;
                const rawErrorMessage = error instanceof Error ? error.message : String(error);
                const errorMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(rawErrorMessage);
                const operation = resource === 'entity'
                    ? this.getNodeParameter('operation', i, 'unknown')
                    : 'execute';
                const contextMessage = `Item ${i}: ${resource}/${operation}`;
                if (this.continueOnFail()) {
                    const httpStatusCode = error.httpStatusCode || null;
                    const sapErrorCode = error.sapErrorCode || null;
                    returnData.push({
                        json: {
                            error: errorMessage,
                            statusCode: httpStatusCode,
                            sapErrorCode: sapErrorCode,
                            context: contextMessage,
                            __success: false,
                        },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                const httpStatus = error.httpStatusCode;
                const statusInfo = httpStatus ? ` [HTTP ${httpStatus}]` : '';
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `${contextMessage}${statusInfo} - ${errorMessage}`, {
                    itemIndex: i,
                    description: errorMessage,
                });
            }
        }
        if (includeMetrics) {
            const executionTime = Date.now() - startTime;
            returnData.push({
                json: {
                    _metrics: {
                        executionTimeMs: executionTime,
                        itemsProcessed: items.length,
                        successfulItems: successCount,
                        failedItems: errorCount,
                        resource,
                        timestamp: new Date().toISOString(),
                    },
                },
                pairedItem: items.map((_, index) => ({ item: index })),
            });
        }
        return [returnData];
    }
}
exports.SapOData = SapOData;
