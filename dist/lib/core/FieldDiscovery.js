"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMetadata = fetchMetadata;
exports.getEntityTypeForSet = getEntityTypeForSet;
exports.getEntityFields = getEntityFields;
exports.getNavigationProperties = getNavigationProperties;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const CacheManager_1 = require("../utils/CacheManager");
const LoggerAdapter_1 = require("../utils/LoggerAdapter");
const MetadataParser_1 = require("./MetadataParser");
async function fetchMetadata(context, host, servicePath) {
    const cached = await CacheManager_1.CacheManager.getMetadata(context, host, servicePath);
    if (cached && cached.parsedMetadata) {
        return cached.parsedMetadata;
    }
    const metadataUrl = `${servicePath}$metadata`;
    const metadataXml = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', metadataUrl, {}, {}, undefined, undefined, 'text');
    const parsedMetadata = await MetadataParser_1.MetadataParser.parseMetadata(metadataXml);
    const entitySetNames = Array.from(parsedMetadata.entitySets.keys());
    await CacheManager_1.CacheManager.setMetadata(context, host, servicePath, entitySetNames, []);
    const staticData = context.getWorkflowStaticData('node');
    const credentialId = await getCredentialId(context);
    const cacheKey = getCacheKey(host, servicePath, credentialId);
    const metadataCacheKey = `metadata_${cacheKey}`;
    if (staticData[metadataCacheKey]) {
        staticData[metadataCacheKey].parsedMetadata = parsedMetadata;
    }
    return parsedMetadata;
}
function getEntityTypeForSet(metadata, entitySetName) {
    const entitySet = metadata.entitySets.get(entitySetName);
    if (!entitySet)
        return undefined;
    return metadata.entityTypes.get(entitySet.entityType);
}
async function getEntityFields(context, entitySetName) {
    try {
        const credentials = await context.getCredentials('sapOdataApi');
        const host = credentials.host;
        const servicePathMode = context.getNodeParameter('servicePathMode', 0);
        let servicePath;
        if (servicePathMode === 'discover') {
            servicePath = context.getNodeParameter('discoveredService', 0);
        }
        else {
            servicePath = context.getNodeParameter('servicePath', 0);
        }
        if (!servicePath.endsWith('/')) {
            servicePath += '/';
        }
        const metadata = await fetchMetadata(context, host, servicePath);
        const entityType = getEntityTypeForSet(metadata, entitySetName);
        if (!entityType) {
            return [];
        }
        const options = entityType.properties.map((property) => ({
            name: property.name,
            value: property.name,
            description: MetadataParser_1.MetadataParser.buildFieldDescription(property),
        }));
        options.sort((a, b) => a.name.localeCompare(b.name));
        return options;
    }
    catch (error) {
        LoggerAdapter_1.LoggerAdapter.debug('Failed to fetch entity fields', {
            module: 'FieldDiscovery',
            operation: 'getEntityFields',
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}
async function getNavigationProperties(context, entitySetName) {
    try {
        const credentials = await context.getCredentials('sapOdataApi');
        const host = credentials.host;
        const servicePathMode = context.getNodeParameter('servicePathMode', 0);
        let servicePath;
        if (servicePathMode === 'discover') {
            servicePath = context.getNodeParameter('discoveredService', 0);
        }
        else {
            servicePath = context.getNodeParameter('servicePath', 0);
        }
        if (!servicePath.endsWith('/')) {
            servicePath += '/';
        }
        const metadata = await fetchMetadata(context, host, servicePath);
        const entityType = getEntityTypeForSet(metadata, entitySetName);
        if (!entityType) {
            return [];
        }
        const options = entityType.navigationProperties.map((navProp) => {
            const targetType = navProp.targetEntityType || 'Related Entity';
            return {
                name: navProp.name,
                value: navProp.name,
                description: `Navigate to ${targetType}`,
            };
        });
        options.sort((a, b) => a.name.localeCompare(b.name));
        return options;
    }
    catch (error) {
        LoggerAdapter_1.LoggerAdapter.debug('Failed to fetch navigation properties', {
            module: 'FieldDiscovery',
            operation: 'getNavigationProperties',
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}
async function getCredentialId(context) {
    try {
        const credentials = await context.getCredentials('sapOdataApi');
        const username = credentials.username || '';
        const host = credentials.host || '';
        return username && host ? `${username}@${host}` : undefined;
    }
    catch {
        return undefined;
    }
}
function getCacheKey(host, servicePath, credentialId) {
    const baseKey = `${host}${servicePath}`;
    const fullKey = credentialId ? `${credentialId}_${baseKey}` : baseKey;
    return fullKey.replace(/[^a-zA-Z0-9_]/g, '_');
}
