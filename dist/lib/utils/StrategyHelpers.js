"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEntitySet = getEntitySet;
exports.validateAndParseJson = validateAndParseJson;
exports.validateAndFormatKey = validateAndFormatKey;
exports.applyTypeConversion = applyTypeConversion;
exports.buildResourcePath = buildResourcePath;
exports.extractResult = extractResult;
exports.getQueryOptions = getQueryOptions;
const n8n_workflow_1 = require("n8n-workflow");
const QueryBuilder_1 = require("../core/QueryBuilder");
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
    return (0, SecurityUtils_1.validateEntitySetName)(entitySet, context.getNode());
}
function validateAndParseJson(input, fieldName, node) {
    if (typeof input === 'object' && input !== null) {
        try {
            const jsonString = JSON.stringify(input);
            return (0, SecurityUtils_1.validateJsonInput)(jsonString, fieldName, node);
        }
        catch {
            return input;
        }
    }
    if (!input || (typeof input === 'string' && input.trim() === '')) {
        throw new n8n_workflow_1.NodeOperationError(node, `${fieldName} cannot be empty`);
    }
    return (0, SecurityUtils_1.validateJsonInput)(input, fieldName, node);
}
function validateAndFormatKey(key, node) {
    if (!key) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Entity key is required');
    }
    if (typeof key !== 'string') {
        const keyParts = Object.entries(key).map(([k, v]) => {
            if (typeof v === 'string') {
                const escaped = v.replace(/'/g, "''");
                return `${k}='${escaped}'`;
            }
            return `${k}=${v}`;
        });
        if (keyParts.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Entity key object cannot be empty');
        }
        return keyParts.join(',');
    }
    const validated = (0, SecurityUtils_1.validateEntityKey)(key, node);
    if (validated.includes('='))
        return validated;
    if (/^guid'[0-9a-fA-F-]+'$/i.test(validated))
        return validated;
    if (/^'.*'$/.test(validated))
        return validated;
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validated)) {
        return `guid'${validated}'`;
    }
    if (/^\d+(\.\d+)?$/.test(validated))
        return validated;
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
            result = (0, TypeConverter_1.removeMetadata)(result);
        }
        result = (0, TypeConverter_1.unwrapNavigationProperties)(result);
        return result;
    }
    catch {
        return data;
    }
}
function buildResourcePath(entitySet, entityKey) {
    let path = `/${entitySet}`;
    if (entityKey) {
        path += `(${entityKey})`;
    }
    return path;
}
function extractResult(response) {
    if (Array.isArray(response))
        return response;
    if (typeof response !== 'object' || response === null)
        return response;
    const responseObj = response;
    if (responseObj.value !== undefined) {
        if (Array.isArray(responseObj.value))
            return responseObj.value;
        return responseObj.value;
    }
    if (responseObj.d && typeof responseObj.d === 'object') {
        const dObj = responseObj.d;
        if (dObj.results)
            return dObj.results;
        return responseObj.d;
    }
    return response;
}
function getQueryOptions(context, itemIndex) {
    const options = context.getNodeParameter('options', itemIndex, {});
    return (0, QueryBuilder_1.buildODataQuery)(options, context.getNode());
}
