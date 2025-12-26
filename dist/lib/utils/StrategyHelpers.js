"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionParameterType = void 0;
exports.getEntitySet = getEntitySet;
exports.getServicePath = getServicePath;
exports.validateAndParseJson = validateAndParseJson;
exports.validateAndFormatKey = validateAndFormatKey;
exports.applyTypeConversion = applyTypeConversion;
exports.formatSuccessResponse = formatSuccessResponse;
exports.handleOperationError = handleOperationError;
exports.buildResourcePath = buildResourcePath;
exports.extractResult = extractResult;
exports.getQueryOptions = getQueryOptions;
exports.validateNavigationProperties = validateNavigationProperties;
exports.parseParameterType = parseParameterType;
const n8n_workflow_1 = require("n8n-workflow");
const QueryBuilder_1 = require("../core/QueryBuilder");
const Logger_1 = require("./Logger");
const SecurityUtils_1 = require("./SecurityUtils");
const TypeConverter_1 = require("./TypeConverter");
function getEntitySet(context, itemIndex) {
    const entitySetParam = context.getNodeParameter('entitySet', itemIndex);
    let entitySet;
    if (typeof entitySetParam === 'object' && entitySetParam !== null) {
        entitySet = entitySetParam.value || '';
    }
    else {
        entitySet = entitySetParam;
    }
    const { validateEntitySetName } = require('./SecurityUtils');
    return validateEntitySetName(entitySet, context.getNode());
}
function getServicePath(context, itemIndex) {
    const mode = context.getNodeParameter('servicePathMode', itemIndex, 'discover');
    if (mode === 'discover') {
        return context.getNodeParameter('discoveredService', itemIndex, '/sap/opu/odata/sap/');
    }
    else {
        return context.getNodeParameter('servicePath', itemIndex, '/sap/opu/odata/sap/');
    }
}
function validateAndParseJson(input, fieldName, node) {
    if (typeof input === 'object' && input !== null) {
        const { validateJsonInput } = require('./SecurityUtils');
        try {
            const jsonString = JSON.stringify(input);
            return validateJsonInput(jsonString, fieldName, node);
        }
        catch {
            return input;
        }
    }
    if (!input || (typeof input === 'string' && input.trim() === '')) {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} cannot be empty`);
    }
    const { validateJsonInput } = require('./SecurityUtils');
    return validateJsonInput(input, fieldName, node);
}
function validateAndFormatKey(key, node) {
    if (!key) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Entity key is required');
    }
    if (typeof key !== 'string') {
        const keyParts = Object.entries(key).map(([k, v]) => {
            if (typeof v === 'string') {
                return `${k}='${v}'`;
            }
            return `${k}=${v}`;
        });
        if (keyParts.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Entity key object cannot be empty');
        }
        return keyParts.join(',');
    }
    const { validateEntityKey } = require('./SecurityUtils');
    const validated = validateEntityKey(key, node);
    if (validated.includes('=')) {
        return validated;
    }
    if (/^guid'[0-9a-fA-F-]+'$/i.test(validated)) {
        return validated;
    }
    if (/^'.*'$/.test(validated)) {
        return validated;
    }
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validated)) {
        return `guid'${validated}'`;
    }
    if (/^\d+(\.\d+)?$/.test(validated)) {
        return validated;
    }
    return `'${validated}'`;
}
function applyTypeConversion(data, context, itemIndex) {
    try {
        const opts = context.getNodeParameter('advancedOptions', itemIndex, {});
        let result = data;
        if (opts.convertDataTypes !== false) {
            result = (0, TypeConverter_1.convertDataTypes)(result);
        }
        if (opts.removeMetadata !== false) {
            const { removeMetadata } = require('./TypeConverter');
            result = removeMetadata(result);
        }
        return result;
    }
    catch {
        return data;
    }
}
function formatSuccessResponse(data, operation) {
    const items = Array.isArray(data) ? data : [data];
    return items.map(item => ({
        json: {
            ...item,
            __operation: operation,
            __success: true,
        },
        pairedItem: { item: 0 },
    }));
}
function handleOperationError(error, context, itemIndex, continueOnFail) {
    const node = context.getNode();
    const errorMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(error instanceof Error ? error.message : String(error));
    Logger_1.Logger.error('Operation failed', undefined, {
        module: 'StrategyHelpers',
        error: errorMessage,
        itemIndex,
    });
    if (continueOnFail) {
        return [{
                json: {
                    error: errorMessage,
                    __success: false,
                },
                pairedItem: { item: itemIndex },
            }];
    }
    if (error instanceof n8n_workflow_1.NodeApiError || error instanceof n8n_workflow_1.NodeOperationError) {
        throw error;
    }
    throw new n8n_workflow_1.NodeOperationError(node, `Operation failed: ${errorMessage}`, { itemIndex });
}
function buildResourcePath(entitySet, entityKey, navigationProperty) {
    let path = `/${entitySet}`;
    if (entityKey) {
        path += `(${entityKey})`;
    }
    if (navigationProperty) {
        path += `/${navigationProperty}`;
    }
    return path;
}
function extractResult(response) {
    if (Array.isArray(response)) {
        return response;
    }
    if (typeof response !== 'object' || response === null) {
        return response;
    }
    const responseObj = response;
    if (responseObj.value !== undefined) {
        if (Array.isArray(responseObj.value)) {
            return responseObj.value;
        }
        return responseObj.value;
    }
    if (responseObj.d && typeof responseObj.d === 'object') {
        const dObj = responseObj.d;
        if (dObj.results) {
            return dObj.results;
        }
        return responseObj.d;
    }
    return response;
}
function getQueryOptions(context, itemIndex) {
    const options = context.getNodeParameter('options', itemIndex, {});
    return (0, QueryBuilder_1.buildODataQuery)(options);
}
function validateNavigationProperties(navProperties, node) {
    Object.entries(navProperties).forEach(([navProp, value]) => {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(navProp)) {
            throw new n8n_workflow_1.NodeOperationError(node, `Invalid navigation property name: ${navProp}. ` +
                `Must start with letter/underscore and contain only alphanumeric characters.`);
        }
        if (Array.isArray(value)) {
            if (value.some(item => typeof item !== 'object' || item === null)) {
                throw new n8n_workflow_1.NodeOperationError(node, `Navigation property '${navProp}' array must contain only objects`);
            }
        }
        else if (typeof value !== 'object' || value === null) {
            throw new n8n_workflow_1.NodeOperationError(node, `Navigation property '${navProp}' must be an object or array of objects`);
        }
    });
}
var FunctionParameterType;
(function (FunctionParameterType) {
    FunctionParameterType["String"] = "Edm.String";
    FunctionParameterType["Int32"] = "Edm.Int32";
    FunctionParameterType["Int64"] = "Edm.Int64";
    FunctionParameterType["Decimal"] = "Edm.Decimal";
    FunctionParameterType["Boolean"] = "Edm.Boolean";
    FunctionParameterType["DateTime"] = "Edm.DateTime";
    FunctionParameterType["DateTimeOffset"] = "Edm.DateTimeOffset";
    FunctionParameterType["Guid"] = "Edm.Guid";
    FunctionParameterType["Binary"] = "Edm.Binary";
})(FunctionParameterType || (exports.FunctionParameterType = FunctionParameterType = {}));
function parseParameterType(typeStr, node) {
    const typeMap = {
        'String': FunctionParameterType.String,
        'Edm.String': FunctionParameterType.String,
        'Int32': FunctionParameterType.Int32,
        'Edm.Int32': FunctionParameterType.Int32,
        'Int64': FunctionParameterType.Int64,
        'Edm.Int64': FunctionParameterType.Int64,
        'Decimal': FunctionParameterType.Decimal,
        'Edm.Decimal': FunctionParameterType.Decimal,
        'Boolean': FunctionParameterType.Boolean,
        'Edm.Boolean': FunctionParameterType.Boolean,
        'DateTime': FunctionParameterType.DateTime,
        'Edm.DateTime': FunctionParameterType.DateTime,
        'DateTimeOffset': FunctionParameterType.DateTimeOffset,
        'Edm.DateTimeOffset': FunctionParameterType.DateTimeOffset,
        'Guid': FunctionParameterType.Guid,
        'Edm.Guid': FunctionParameterType.Guid,
        'Binary': FunctionParameterType.Binary,
        'Edm.Binary': FunctionParameterType.Binary,
    };
    const type = typeMap[typeStr];
    if (!type) {
        throw new n8n_workflow_1.NodeOperationError(node, `Unknown parameter type: ${typeStr}. ` +
            `Supported types: ${Object.keys(typeMap).join(', ')}`);
    }
    return type;
}
