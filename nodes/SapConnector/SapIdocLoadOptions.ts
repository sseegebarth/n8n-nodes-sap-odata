/**
 * SAP IDoc Node - Load Options Methods
 *
 * Dynamic dropdown population and search methods for the SAP IDoc node.
 */

import {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { ZATW_CREDENTIAL_TYPE, COMMON_IDOC_TYPES } from '../Shared/constants';
import { ZatwApiClient } from '../Shared/core/ZatwApiClient';
import { ISapConnectorCredentials } from '../Shared/types/zatw';
import { FmMetadataCache } from '../Shared/utils/FmMetadataCache';
import { Logger } from '../Shared/utils/Logger';

/**
 * Get credentials with error handling
 */
async function getCredentials(context: ILoadOptionsFunctions): Promise<ISapConnectorCredentials | null> {
	try {
		return await context.getCredentials(ZATW_CREDENTIAL_TYPE) as ISapConnectorCredentials;
	} catch {
		return null;
	}
}

/**
 * Resolve IDoc type from resource locator parameter
 */
function resolveIdocType(context: ILoadOptionsFunctions): string {
	try {
		const idocTypeParam = context.getCurrentNodeParameter('idocType') as
			| string
			| { mode: string; value: string }
			| undefined;

		if (typeof idocTypeParam === 'object' && idocTypeParam !== null) {
			return idocTypeParam.value || '';
		}
		if (typeof idocTypeParam === 'string') {
			return idocTypeParam;
		}
	} catch {
		// Parameter not available
	}
	return '';
}

/**
 * Load Options Methods
 */
export const sapIdocLoadOptions = {
	/**
	 * Get segments for selected IDoc type
	 */
	async getIdocSegments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await getCredentials(this);
		if (!credentials) {
			return [{ name: 'No credentials configured', value: '' }];
		}

		const idocType = resolveIdocType(this);
		if (!idocType) {
			return [{ name: 'Select an IDoc type first', value: '' }];
		}

		try {
			// Try cache first
			const cached = await FmMetadataCache.getIdocType(this, credentials.host, idocType);
			if (cached) {
				return cached.segments.map((s) => ({
					name: `${s.segmentType} - ${s.description || 'No description'}`,
					value: s.segmentType,
					description: `Min: ${s.minOccurs}, Max: ${s.maxOccurs}`,
				}));
			}

			// Fetch from API
			const metadata = await ZatwApiClient.getIdocTypeMetadata(this, credentials, idocType);

			// Cache it
			await FmMetadataCache.setIdocType(this, credentials.host, idocType, metadata);

			return metadata.segments.map((s) => ({
				name: `${s.segmentType} - ${s.description || 'No description'}`,
				value: s.segmentType,
				description: `Min: ${s.minOccurs}, Max: ${s.maxOccurs}`,
			}));
		} catch (error) {
			Logger.warn('Failed to get IDoc segments', {
				module: 'SapIdocLoadOptions',
				idocType,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return [{ name: `Could not load segments for ${idocType}`, value: '' }];
		}
	},

	/**
	 * Get message types for selected IDoc type
	 */
	async getMessageTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await getCredentials(this);
		if (!credentials) {
			return [{ name: 'No credentials configured', value: '' }];
		}

		const idocType = resolveIdocType(this);
		if (!idocType) {
			return [{ name: 'Select an IDoc type first', value: '' }];
		}

		try {
			// Try cache first
			const cached = await FmMetadataCache.getIdocType(this, credentials.host, idocType);
			if (cached && cached.messageTypes.length > 0) {
				return cached.messageTypes.map((mt) => ({
					name: mt,
					value: mt,
				}));
			}

			// Fetch from API
			const metadata = await ZatwApiClient.getIdocTypeMetadata(this, credentials, idocType);

			// Cache it
			await FmMetadataCache.setIdocType(this, credentials.host, idocType, metadata);

			if (metadata.messageTypes.length === 0) {
				return [{ name: '(No message types found)', value: '' }];
			}

			return metadata.messageTypes.map((mt) => ({
				name: mt,
				value: mt,
			}));
		} catch (error) {
			Logger.warn('Failed to get message types', {
				module: 'SapIdocLoadOptions',
				idocType,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return [{ name: 'Enter message type manually', value: '' }];
		}
	},
};

/**
 * List Search Methods for Resource Locator
 */
export const sapIdocListSearch = {
	/**
	 * Search IDoc types with pattern matching
	 */
	async searchIdocTypes(
		this: ILoadOptionsFunctions,
		filter?: string,
		_paginationToken?: unknown,
	): Promise<INodeListSearchResult> {
		const credentials = await getCredentials(this);

		if (!credentials) {
			// Return common IDoc types as fallback
			return {
				results: [
					{ name: 'No credentials configured - Showing common types', value: '' },
					...COMMON_IDOC_TYPES.map((t) => ({ name: t, value: t })),
				],
			};
		}

		try {
			// Search via ZATW API
			const searchResults = await ZatwApiClient.searchIdocTypes(
				this,
				credentials,
				filter || '*',
			);

			// Sort: common types first, then alphabetically
			const sorted = [...searchResults].sort((a, b) => {
				const aIsCommon = COMMON_IDOC_TYPES.includes(a.idocType as typeof COMMON_IDOC_TYPES[number]);
				const bIsCommon = COMMON_IDOC_TYPES.includes(b.idocType as typeof COMMON_IDOC_TYPES[number]);

				if (aIsCommon && !bIsCommon) return -1;
				if (!aIsCommon && bIsCommon) return 1;
				return a.idocType.localeCompare(b.idocType);
			});

			const results: INodeListSearchItems[] = sorted.map((t) => ({
				name: `${t.idocType}${t.description ? ` - ${t.description.substring(0, 40)}` : ''}`,
				value: t.idocType,
			}));

			return { results };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			Logger.warn('IDoc type search failed, showing common types', {
				module: 'SapIdocLoadOptions',
				error: errorMessage,
			});

			// Fallback to common IDoc types
			let filteredTypes = [...COMMON_IDOC_TYPES];
			if (filter) {
				const lowerFilter = filter.toLowerCase();
				filteredTypes = COMMON_IDOC_TYPES.filter((t) =>
					t.toLowerCase().includes(lowerFilter),
				);
			}

			return {
				results: [
					{
						name: `Search failed: ${errorMessage.substring(0, 40)} - Showing common types`,
						value: '',
					},
					...filteredTypes.map((t) => ({ name: t, value: t })),
				],
			};
		}
	},
};
