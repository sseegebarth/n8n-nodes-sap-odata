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
const SecurityUtils_1 = require("../../lib/utils/SecurityUtils");
const ODataVersionHelper_1 = require("../../lib/utils/ODataVersionHelper");
const TypeConverter_1 = require("../../lib/utils/TypeConverter");
const StrategyHelpers_1 = require("../../lib/utils/StrategyHelpers");
const GenericFunctions_1 = require("./GenericFunctions");
const ConnectionTest_1 = require("./ConnectionTest");
const SapODataLoadOptions_1 = require("./SapODataLoadOptions");
const SapODataProperties_1 = require("./SapODataProperties");
const package_json_1 = require("../../package.json");
function getEntityKeyValue(context, itemIndex) {
    const param = context.getNodeParameter('entityKey', itemIndex);
    return typeof param === 'string' ? param : param.value;
}
function toJsonResult(data, itemIndex) {
    const jsonData = (typeof data === 'object' && data !== null)
        ? data
        : { value: data };
    return [{ json: jsonData, pairedItem: { item: itemIndex } }];
}
async function executeGet(context, itemIndex) {
    const entitySet = (0, StrategyHelpers_1.getEntitySet)(context, itemIndex);
    const odataVersion = await ODataVersionHelper_1.ODataVersionHelper.getODataVersion(context);
    const entityKey = getEntityKeyValue(context, itemIndex);
    let formattedKey = (0, StrategyHelpers_1.validateAndFormatKey)(entityKey, context.getNode());
    formattedKey = ODataVersionHelper_1.ODataVersionHelper.formatEntityKey(formattedKey, odataVersion);
    const query = (0, StrategyHelpers_1.getQueryOptions)(context, itemIndex);
    const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', (0, StrategyHelpers_1.buildResourcePath)(entitySet, formattedKey), {}, query);
    const result = ODataVersionHelper_1.ODataVersionHelper.extractData(response, odataVersion);
    const converted = (0, StrategyHelpers_1.applyTypeConversion)(result, context, itemIndex);
    return toJsonResult(converted, itemIndex);
}
async function executeGetAll(context, itemIndex) {
    const entitySet = (0, StrategyHelpers_1.getEntitySet)(context, itemIndex);
    const returnAll = context.getNodeParameter('returnAll', itemIndex);
    const odataVersion = await ODataVersionHelper_1.ODataVersionHelper.getODataVersion(context);
    let query = (0, StrategyHelpers_1.getQueryOptions)(context, itemIndex);
    const hasCountOption = query.$count === true;
    if (hasCountOption) {
        delete query.$count;
        query = ODataVersionHelper_1.ODataVersionHelper.getVersionSpecificParams(odataVersion, { ...query, count: true });
    }
    const options = context.getNodeParameter('options', itemIndex, {});
    if (options.batchSize) {
        query.$top = options.batchSize;
    }
    let dataArray;
    if (returnAll) {
        const result = await GenericFunctions_1.sapOdataApiRequestAllItems.call(context, 'results', 'GET', (0, StrategyHelpers_1.buildResourcePath)(entitySet), {}, query, false, 0);
        if (Array.isArray(result)) {
            dataArray = result;
        }
        else {
            dataArray = Array.isArray(result.data) ? result.data : [result.data];
        }
    }
    else {
        if (query.$top === undefined) {
            query.$top = context.getNodeParameter('limit', itemIndex);
        }
        const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', (0, StrategyHelpers_1.buildResourcePath)(entitySet), {}, query);
        const responseData = ODataVersionHelper_1.ODataVersionHelper.extractData(response, odataVersion);
        if (Array.isArray(responseData)) {
            dataArray = responseData;
        }
        else if (responseData && typeof responseData === 'object') {
            const rd = responseData;
            if (rd.results && Array.isArray(rd.results)) {
                dataArray = rd.results;
            }
            else if (rd.d && typeof rd.d === 'object' && rd.d.results && Array.isArray(rd.d.results)) {
                dataArray = rd.d.results;
            }
            else {
                dataArray = [responseData];
            }
        }
        else {
            dataArray = responseData ? [responseData] : [];
        }
    }
    return dataArray.map((item) => {
        const converted = (0, StrategyHelpers_1.applyTypeConversion)(item, context, itemIndex);
        const jsonData = (typeof converted === 'object' && converted !== null)
            ? converted
            : { value: converted };
        return { json: jsonData, pairedItem: { item: itemIndex } };
    });
}
async function executeCreate(context, itemIndex) {
    const entitySet = (0, StrategyHelpers_1.getEntitySet)(context, itemIndex);
    const dataString = context.getNodeParameter('data', itemIndex);
    let data = (0, StrategyHelpers_1.validateAndParseJson)(dataString, 'Data', context.getNode());
    const odataVersion = await ODataVersionHelper_1.ODataVersionHelper.getODataVersion(context);
    if (odataVersion === 'v2') {
        data = (0, TypeConverter_1.convertToSapV2Format)(data);
    }
    const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'POST', (0, StrategyHelpers_1.buildResourcePath)(entitySet), data);
    const result = (0, StrategyHelpers_1.extractResult)(response);
    const converted = (0, StrategyHelpers_1.applyTypeConversion)(result, context, itemIndex);
    return toJsonResult(converted, itemIndex);
}
async function executeUpdate(context, itemIndex) {
    const entitySet = (0, StrategyHelpers_1.getEntitySet)(context, itemIndex);
    const entityKey = getEntityKeyValue(context, itemIndex);
    const dataString = context.getNodeParameter('data', itemIndex);
    const formattedKey = (0, StrategyHelpers_1.validateAndFormatKey)(entityKey, context.getNode());
    let data = (0, StrategyHelpers_1.validateAndParseJson)(dataString, 'Data', context.getNode());
    const etag = context.getNodeParameter('etag', itemIndex, '');
    const odataVersion = await ODataVersionHelper_1.ODataVersionHelper.getODataVersion(context);
    if (odataVersion === 'v2') {
        data = (0, TypeConverter_1.convertToSapV2Format)(data);
    }
    const requestOptions = { headers: { 'If-Match': etag || '*' } };
    const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'PATCH', (0, StrategyHelpers_1.buildResourcePath)(entitySet, formattedKey), data, {}, undefined, requestOptions);
    const result = (0, StrategyHelpers_1.extractResult)(response) || { success: true };
    const converted = (0, StrategyHelpers_1.applyTypeConversion)(result, context, itemIndex);
    return toJsonResult(converted, itemIndex);
}
async function executeDelete(context, itemIndex) {
    const entitySet = (0, StrategyHelpers_1.getEntitySet)(context, itemIndex);
    const entityKey = getEntityKeyValue(context, itemIndex);
    const formattedKey = (0, StrategyHelpers_1.validateAndFormatKey)(entityKey, context.getNode());
    const etag = context.getNodeParameter('etag', itemIndex, '');
    const requestOptions = { headers: { 'If-Match': etag || '*' } };
    await GenericFunctions_1.sapOdataApiRequest.call(context, 'DELETE', (0, StrategyHelpers_1.buildResourcePath)(entitySet, formattedKey), {}, {}, undefined, requestOptions);
    return [{ json: { success: true }, pairedItem: { item: itemIndex } }];
}
async function executeGetMetadata(context, itemIndex) {
    const metadataType = context.getNodeParameter('metadataType', itemIndex);
    const resource = metadataType === 'metadata' ? '/$metadata' : '/';
    const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', resource, {}, {});
    let result;
    if (metadataType === 'metadata') {
        result = {
            _type: 'metadata',
            _format: 'xml',
            content: typeof response === 'string' ? response : JSON.stringify(response),
        };
    }
    else if (typeof response === 'object' && response.d) {
        const d = response.d;
        if (d === null || d === void 0 ? void 0 : d.EntitySets) {
            result = { _type: 'serviceDocument', _version: 'v2', entitySets: d.EntitySets };
        }
        else {
            result = { _type: 'serviceDocument', _raw: true, ...response };
        }
    }
    else if (typeof response === 'object' && response.value) {
        result = { _type: 'serviceDocument', _version: 'v4', value: response.value };
    }
    else if (typeof response === 'object') {
        result = { _type: 'serviceDocument', _raw: true, ...response };
    }
    else {
        result = { _type: 'serviceDocument', _raw: true, content: response };
    }
    return [{ json: result, pairedItem: { item: itemIndex } }];
}
async function executeFunctionImport(context, itemIndex) {
    const functionNameParam = context.getNodeParameter('functionName', itemIndex);
    const rawValue = typeof functionNameParam === 'object'
        ? functionNameParam.value
        : functionNameParam;
    let callableType = '';
    let functionName;
    if (rawValue.includes('::')) {
        const parts = rawValue.split('::');
        callableType = parts[0];
        functionName = parts.slice(1).join('::');
    }
    else {
        functionName = rawValue;
    }
    functionName = (0, SecurityUtils_1.validateFunctionName)(functionName, context.getNode());
    const parametersString = context.getNodeParameter('functionParameters', itemIndex);
    const parameters = (0, StrategyHelpers_1.validateAndParseJson)(parametersString, 'Parameters', context.getNode());
    const userHttpMethod = context.getNodeParameter('functionHttpMethod', itemIndex, '');
    let httpMethod;
    if (userHttpMethod) {
        httpMethod = userHttpMethod;
    }
    else if (callableType === 'Action') {
        httpMethod = 'POST';
    }
    else if (callableType === 'Function') {
        httpMethod = 'GET';
    }
    else {
        httpMethod = 'POST';
    }
    const urlFormat = context.getNodeParameter('functionUrlFormat', itemIndex, 'canonical');
    let url;
    let body = {};
    const useUrlParams = callableType !== 'Action';
    if (useUrlParams) {
        const paramParts = [];
        for (const [key, value] of Object.entries(parameters)) {
            paramParts.push(`${key}=${(0, GenericFunctions_1.formatSapODataValue)(value, undefined, context.getNode())}`);
        }
        if (httpMethod === 'POST') {
            url = paramParts.length > 0 ? `/${functionName}?${paramParts.join('&')}` : `/${functionName}`;
        }
        else if (urlFormat === 'canonical') {
            url = paramParts.length > 0 ? `/${functionName}(${paramParts.join(',')})` : `/${functionName}()`;
        }
        else {
            url = paramParts.length > 0 ? `/${functionName}?${paramParts.join('&')}` : `/${functionName}`;
        }
    }
    else {
        url = `/${functionName}`;
        body = parameters;
    }
    const response = await GenericFunctions_1.sapOdataApiRequest.call(context, httpMethod, url, body);
    const result = (0, StrategyHelpers_1.extractResult)(response);
    const converted = (0, StrategyHelpers_1.applyTypeConversion)(result, context, itemIndex);
    return toJsonResult(converted, itemIndex);
}
class SapOData {
    constructor() {
        this.description = {
            displayName: 'avanai SAP Connect OData',
            name: 'sapOData',
            icon: { light: 'file:sap.svg', dark: 'file:sap.dark.svg' },
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: `Connect to SAP systems via OData (v${package_json_1.version})`,
            defaults: {
                name: 'SAP Connect OData',
            },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [
                {
                    name: 'sapOdataApi',
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: ['basicAuth', 'none'],
                        },
                    },
                },
                {
                    name: 'sapOdataOAuth2Api',
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: ['oauth2'],
                        },
                    },
                },
            ],
            properties: SapODataProperties_1.sapODataProperties,
            usableAsTool: true,
        };
        this.methods = {
            loadOptions: SapODataLoadOptions_1.sapODataLoadOptions,
            listSearch: SapODataLoadOptions_1.sapODataListSearch,
            credentialTest: {
                sapODataCredentialTest: ConnectionTest_1.testSapODataConnection,
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
                    : 'functionImport';
                let result;
                switch (operation) {
                    case 'get':
                        result = await executeGet(this, i);
                        break;
                    case 'getAll':
                        result = await executeGetAll(this, i);
                        break;
                    case 'create':
                        result = await executeCreate(this, i);
                        break;
                    case 'update':
                        result = await executeUpdate(this, i);
                        break;
                    case 'delete':
                        result = await executeDelete(this, i);
                        break;
                    case 'getMetadata':
                        result = await executeGetMetadata(this, i);
                        break;
                    case 'functionImport':
                        result = await executeFunctionImport(this, i);
                        break;
                    default:
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
                }
                returnData.push(...result);
                successCount++;
            }
            catch (error) {
                errorCount++;
                const rawErrorMessage = error instanceof Error ? error.message : String(error);
                const errorMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(rawErrorMessage);
                const operation = resource === 'entity'
                    ? this.getNodeParameter('operation', i, 'unknown')
                    : 'functionImport';
                const contextMessage = `Item ${i}: ${resource}/${operation}`;
                if (this.continueOnFail()) {
                    const httpStatusCode = (error === null || error === void 0 ? void 0 : error.httpStatusCode) || null;
                    const sapErrorCode = (error === null || error === void 0 ? void 0 : error.sapErrorCode) || null;
                    returnData.push({
                        json: {
                            error: errorMessage,
                            statusCode: httpStatusCode,
                            sapErrorCode,
                            context: contextMessage,
                        },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                const httpStatus = error === null || error === void 0 ? void 0 : error.httpStatusCode;
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
