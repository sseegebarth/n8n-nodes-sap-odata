"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeODataString = escapeODataString;
exports.buildODataFilter = buildODataFilter;
exports.normalizeODataOptions = normalizeODataOptions;
exports.buildODataQuery = buildODataQuery;
exports.buildEncodedQueryString = buildEncodedQueryString;
exports.parseMetadataForEntitySets = parseMetadataForEntitySets;
exports.parseMetadataForFunctionImports = parseMetadataForFunctionImports;
const SecurityUtils_1 = require("../utils/SecurityUtils");
function escapeODataString(value) {
    return value.replace(/'/g, "''");
}
function buildODataFilter(filters) {
    const filterParts = [];
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'string') {
                const escapedValue = escapeODataString(value);
                filterParts.push(`${key} eq '${escapedValue}'`);
            }
            else if (typeof value === 'number') {
                filterParts.push(`${key} eq ${value}`);
            }
            else if (typeof value === 'boolean') {
                filterParts.push(`${key} eq ${value}`);
            }
            else if (typeof value === 'object') {
                throw new Error(`Invalid filter value type for key '${key}': Objects and arrays are not supported in OData filters. Use primitive values (string, number, boolean) only.`);
            }
        }
    }
    return filterParts.join(' and ');
}
function normalizeODataOptions(options) {
    const normalized = {};
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined && value !== null && value !== '') {
            const normalizedKey = key.startsWith('$') ? key : `$${key}`;
            normalized[normalizedKey] = value;
        }
    }
    return normalized;
}
function buildODataQuery(options) {
    const normalizedOptions = normalizeODataOptions(options);
    const query = {};
    if (normalizedOptions.$filter) {
        const dummyNode = { name: 'SAP OData', type: 'n8n-nodes-sap-odata.sapOData', typeVersion: 1, position: [0, 0] };
        (0, SecurityUtils_1.validateODataFilter)(normalizedOptions.$filter, dummyNode);
        query.$filter = normalizedOptions.$filter;
    }
    if (normalizedOptions.$select) {
        query.$select = Array.isArray(normalizedOptions.$select)
            ? normalizedOptions.$select.join(',')
            : normalizedOptions.$select;
    }
    if (normalizedOptions.$expand) {
        query.$expand = Array.isArray(normalizedOptions.$expand)
            ? normalizedOptions.$expand.join(',')
            : normalizedOptions.$expand;
    }
    if (normalizedOptions.$orderby) {
        query.$orderby = normalizedOptions.$orderby;
    }
    if (normalizedOptions.$top) {
        query.$top = normalizedOptions.$top;
    }
    if (normalizedOptions.$skip) {
        query.$skip = normalizedOptions.$skip;
    }
    if (normalizedOptions.$count !== undefined) {
        query.$count = normalizedOptions.$count;
    }
    if (normalizedOptions.$search) {
        query.$search = normalizedOptions.$search;
    }
    if (normalizedOptions.$apply) {
        query.$apply = normalizedOptions.$apply;
    }
    return query;
}
function buildEncodedQueryString(params, separator = '&') {
    const parts = [];
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue;
        }
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(String(value));
        parts.push(`${encodedKey}=${encodedValue}`);
    }
    return parts.join(separator);
}
function parseMetadataForEntitySets(metadataXml) {
    const entitySets = [];
    const entitySetRegex = /<EntitySet\s+Name="([^"]+)"/g;
    let match;
    while ((match = entitySetRegex.exec(metadataXml)) !== null) {
        entitySets.push(match[1]);
    }
    return entitySets.sort();
}
function parseMetadataForFunctionImports(metadataXml) {
    const functionImports = [];
    const functionImportRegex = /<FunctionImport\s+Name="([^"]+)"/g;
    let match;
    while ((match = functionImportRegex.exec(metadataXml)) !== null) {
        functionImports.push(match[1]);
    }
    return functionImports.sort();
}
