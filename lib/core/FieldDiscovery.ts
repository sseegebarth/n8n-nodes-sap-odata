/**
 * FieldDiscovery - Discover fields and navigation properties from metadata
 *
 * Provides methods to:
 * - Fetch and cache $metadata
 * - Extract fields for specific entity sets
 * - Extract navigation properties
 * - Build dropdown options for n8n UI
 */

import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { sapOdataApiRequest } from '../../nodes/SapOData/GenericFunctions';
import { CacheManager } from '../utils/CacheManager';
import { LoggerAdapter } from '../utils/LoggerAdapter';
import { MetadataParser, IEntityType, IParsedMetadata } from './MetadataParser';

/**
 * Fetch and parse $metadata for a service
 */
export async function fetchMetadata(
	context: ILoadOptionsFunctions,
	host: string,
	servicePath: string,
): Promise<IParsedMetadata> {
	// Check cache first
	const cached = await CacheManager.getMetadata(context, host, servicePath);
	if (cached && cached.parsedMetadata) {
		return cached.parsedMetadata as IParsedMetadata;
	}

	// Fetch $metadata from SAP
	const metadataUrl = `${servicePath}$metadata`;
	const metadataXml = await sapOdataApiRequest.call(
		context,
		'GET',
		metadataUrl,
		{},
		{},
		undefined,
		undefined,
		'text', // Return raw XML
	);

	// Parse metadata
	const parsedMetadata = await MetadataParser.parseMetadata(metadataXml as string);

	// Cache parsed metadata (store in cache with entitySets and functionImports for backward compatibility)
	const entitySetNames = Array.from(parsedMetadata.entitySets.keys());
	await CacheManager.setMetadata(context, host, servicePath, entitySetNames, []);

	// Store parsed metadata in extended cache entry
	// Note: We extend the cache to include parsedMetadata without breaking existing structure
	const staticData = context.getWorkflowStaticData('node');
	const credentialId = await getCredentialId(context);
	const cacheKey = getCacheKey(host, servicePath, credentialId);
	const metadataCacheKey = `metadata_${cacheKey}`;

	if (staticData[metadataCacheKey]) {
		(staticData[metadataCacheKey] as any).parsedMetadata = parsedMetadata;
	}

	return parsedMetadata;
}

/**
 * Get entity type for a given entity set
 */
export function getEntityTypeForSet(
	metadata: IParsedMetadata,
	entitySetName: string,
): IEntityType | undefined {
	const entitySet = metadata.entitySets.get(entitySetName);
	if (!entitySet) return undefined;

	return metadata.entityTypes.get(entitySet.entityType);
}

/**
 * Get fields for an entity set as dropdown options
 */
export async function getEntityFields(
	context: ILoadOptionsFunctions,
	entitySetName: string,
): Promise<INodePropertyOptions[]> {
	try {
		// Get credentials and service path
		const credentials = await context.getCredentials('sapOdataApi');
		const host = credentials.host as string;

		// Determine service path
		const servicePathMode = context.getNodeParameter('servicePathMode', 0) as string;
		let servicePath: string;

		if (servicePathMode === 'discover') {
			servicePath = context.getNodeParameter('discoveredService', 0) as string;
		} else {
			servicePath = context.getNodeParameter('servicePath', 0) as string;
		}

		// Ensure service path ends with /
		if (!servicePath.endsWith('/')) {
			servicePath += '/';
		}

		// Fetch metadata
		const metadata = await fetchMetadata(context, host, servicePath);

		// Get entity type for this entity set
		const entityType = getEntityTypeForSet(metadata, entitySetName);
		if (!entityType) {
			return [];
		}

		// Build dropdown options from properties
		const options: INodePropertyOptions[] = entityType.properties.map((property) => ({
			name: property.name,
			value: property.name,
			description: MetadataParser.buildFieldDescription(property),
		}));

		// Sort by name
		options.sort((a, b) => a.name.localeCompare(b.name));

		return options;
	} catch (error) {
		// Return empty array on error (prevents UI from breaking)
		LoggerAdapter.debug('Failed to fetch entity fields', {
			module: 'FieldDiscovery',
			operation: 'getEntityFields',
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

/**
 * Get navigation properties for an entity set as dropdown options
 */
export async function getNavigationProperties(
	context: ILoadOptionsFunctions,
	entitySetName: string,
): Promise<INodePropertyOptions[]> {
	try {
		// Get credentials and service path
		const credentials = await context.getCredentials('sapOdataApi');
		const host = credentials.host as string;

		// Determine service path
		const servicePathMode = context.getNodeParameter('servicePathMode', 0) as string;
		let servicePath: string;

		if (servicePathMode === 'discover') {
			servicePath = context.getNodeParameter('discoveredService', 0) as string;
		} else {
			servicePath = context.getNodeParameter('servicePath', 0) as string;
		}

		// Ensure service path ends with /
		if (!servicePath.endsWith('/')) {
			servicePath += '/';
		}

		// Fetch metadata
		const metadata = await fetchMetadata(context, host, servicePath);

		// Get entity type for this entity set
		const entityType = getEntityTypeForSet(metadata, entitySetName);
		if (!entityType) {
			return [];
		}

		// Build dropdown options from navigation properties
		const options: INodePropertyOptions[] = entityType.navigationProperties.map((navProp) => {
			const targetType = navProp.targetEntityType || 'Related Entity';
			return {
				name: navProp.name,
				value: navProp.name,
				description: `Navigate to ${targetType}`,
			};
		});

		// Sort by name
		options.sort((a, b) => a.name.localeCompare(b.name));

		return options;
	} catch (error) {
		// Return empty array on error (prevents UI from breaking)
		LoggerAdapter.debug('Failed to fetch navigation properties', {
			module: 'FieldDiscovery',
			operation: 'getNavigationProperties',
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

/**
 * Helper: Extract credential identifier (copied from CacheManager)
 */
async function getCredentialId(context: ILoadOptionsFunctions): Promise<string | undefined> {
	try {
		const credentials = await context.getCredentials('sapOdataApi');
		const username = credentials.username as string || '';
		const host = credentials.host as string || '';
		return username && host ? `${username}@${host}` : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Helper: Get cache key (copied from CacheManager)
 */
function getCacheKey(host: string, servicePath: string, credentialId?: string): string {
	const baseKey = `${host}${servicePath}`;
	const fullKey = credentialId ? `${credentialId}_${baseKey}` : baseKey;
	return fullKey.replace(/[^a-zA-Z0-9_]/g, '_');
}
