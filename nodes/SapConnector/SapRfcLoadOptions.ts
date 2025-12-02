/**
 * SAP RFC Node - Load Options Methods
 *
 * Dynamic dropdown population and search methods for the SAP RFC node.
 */

import {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { ZATW_CREDENTIAL_TYPE, COMMON_BAPIS } from '../Shared/constants';
import { ZatwApiClient } from '../Shared/core/ZatwApiClient';
import { ISapConnectorCredentials, IZatwFmMetadata } from '../Shared/types/zatw';
import { FmMetadataCache } from '../Shared/utils/FmMetadataCache';
import { Logger } from '../Shared/utils/Logger';

/**
 * Resolve function name from resource locator parameter
 */
function resolveFunctionName(context: ILoadOptionsFunctions): string {
	try {
		const functionNameParam = context.getCurrentNodeParameter('functionName') as
			| string
			| { mode: string; value: string }
			| undefined;

		if (typeof functionNameParam === 'object' && functionNameParam !== null) {
			return functionNameParam.value || '';
		}
		if (typeof functionNameParam === 'string') {
			return functionNameParam;
		}
	} catch {
		// Parameter not available
	}
	return '';
}

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
 * Get function metadata with caching
 */
async function getFunctionMetadata(
	context: ILoadOptionsFunctions,
	credentials: ISapConnectorCredentials,
	functionName: string,
): Promise<IZatwFmMetadata | null> {
	// Try cache first
	const cached = await FmMetadataCache.get(context, credentials.host, functionName);
	if (cached) {
		return cached;
	}

	try {
		// Fetch from ZATW API
		const metadata = await ZatwApiClient.getFunctionMetadata(context, credentials, functionName);

		// Cache it
		await FmMetadataCache.set(context, credentials.host, functionName, metadata);

		return metadata;
	} catch (error) {
		Logger.warn('Failed to get function metadata', {
			module: 'SapRfcLoadOptions',
			functionName,
			error: error instanceof Error ? error.message : 'Unknown error',
		});
		return null;
	}
}

/**
 * Load Options Methods
 */
export const sapRfcLoadOptions = {
	/**
	 * Get import parameters for selected function
	 */
	async getImportParameters(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await getCredentials(this);
		if (!credentials) {
			return [{ name: '⚠️ No credentials configured', value: '' }];
		}

		const functionName = resolveFunctionName(this);
		if (!functionName) {
			return [{ name: '⚠️ Select a function first', value: '' }];
		}

		const metadata = await getFunctionMetadata(this, credentials, functionName);
		if (!metadata) {
			return [{ name: `⚠️ Could not load metadata for ${functionName}`, value: '' }];
		}

		// Filter for IMPORTING parameters
		const importParams = metadata.parameters.filter((p) => p.type === 'IMPORTING');

		if (importParams.length === 0) {
			return [{ name: '(No import parameters)', value: '' }];
		}

		return importParams.map((p) => ({
			name: `${p.name}${p.optional ? '' : ' *'} (${p.dataType})`,
			value: p.name,
			description: p.description || `Type: ${p.dataType}`,
		}));
	},

	/**
	 * Get table parameters for selected function
	 */
	async getTableParameters(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await getCredentials(this);
		if (!credentials) {
			return [{ name: '⚠️ No credentials configured', value: '' }];
		}

		const functionName = resolveFunctionName(this);
		if (!functionName) {
			return [{ name: '⚠️ Select a function first', value: '' }];
		}

		const metadata = await getFunctionMetadata(this, credentials, functionName);
		if (!metadata) {
			return [{ name: `⚠️ Could not load metadata for ${functionName}`, value: '' }];
		}

		// Filter for TABLES parameters
		const tableParams = metadata.parameters.filter((p) => p.type === 'TABLES');

		if (tableParams.length === 0) {
			return [{ name: '(No table parameters)', value: '' }];
		}

		return tableParams.map((p) => ({
			name: `${p.name} (${p.dataType})`,
			value: p.name,
			description: p.description || `Type: ${p.dataType}`,
		}));
	},

	/**
	 * Get export parameters for selected function (for reference)
	 */
	async getExportParameters(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await getCredentials(this);
		if (!credentials) {
			return [{ name: '⚠️ No credentials configured', value: '' }];
		}

		const functionName = resolveFunctionName(this);
		if (!functionName) {
			return [{ name: '⚠️ Select a function first', value: '' }];
		}

		const metadata = await getFunctionMetadata(this, credentials, functionName);
		if (!metadata) {
			return [{ name: `⚠️ Could not load metadata for ${functionName}`, value: '' }];
		}

		// Filter for EXPORTING parameters
		const exportParams = metadata.parameters.filter((p) => p.type === 'EXPORTING');

		if (exportParams.length === 0) {
			return [{ name: '(No export parameters)', value: '' }];
		}

		return exportParams.map((p) => ({
			name: `${p.name} (${p.dataType})`,
			value: p.name,
			description: p.description || `Type: ${p.dataType}`,
		}));
	},

	/**
	 * Get changing parameters for selected function
	 */
	async getChangingParameters(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const credentials = await getCredentials(this);
		if (!credentials) {
			return [{ name: '⚠️ No credentials configured', value: '' }];
		}

		const functionName = resolveFunctionName(this);
		if (!functionName) {
			return [{ name: '⚠️ Select a function first', value: '' }];
		}

		const metadata = await getFunctionMetadata(this, credentials, functionName);
		if (!metadata) {
			return [{ name: `⚠️ Could not load metadata for ${functionName}`, value: '' }];
		}

		// Filter for CHANGING parameters
		const changingParams = metadata.parameters.filter((p) => p.type === 'CHANGING');

		if (changingParams.length === 0) {
			return [{ name: '(No changing parameters)', value: '' }];
		}

		return changingParams.map((p) => ({
			name: `${p.name}${p.optional ? '' : ' *'} (${p.dataType})`,
			value: p.name,
			description: p.description || `Type: ${p.dataType}`,
		}));
	},
};

/**
 * List Search Methods for Resource Locator
 */
export const sapRfcListSearch = {
	/**
	 * Search functions with pattern matching
	 */
	async searchFunctions(
		this: ILoadOptionsFunctions,
		filter?: string,
		_paginationToken?: unknown,
	): Promise<INodeListSearchResult> {
		const credentials = await getCredentials(this);

		if (!credentials) {
			// Return common BAPIs as fallback
			return {
				results: [
					{ name: '⚠️ No credentials configured - Showing common BAPIs', value: '' },
					...COMMON_BAPIS.map((fn) => ({ name: fn, value: fn })),
				],
			};
		}

		try {
			// Check cache first
			const cachedResults = await FmMetadataCache.getSearchResults(
				this,
				credentials.host,
				filter || '*',
			);

			if (cachedResults && cachedResults.length > 0) {
				return {
					results: cachedResults.map((fn) => ({
						name: `${fn.functionName}${fn.description ? ` - ${fn.description.substring(0, 40)}` : ''}`,
						value: fn.functionName,
					})),
				};
			}

			// Search via ZATW API
			const searchResults = await ZatwApiClient.searchFunctions(
				this,
				credentials,
				filter || '*',
			);

			// Cache results
			await FmMetadataCache.setSearchResults(this, credentials.host, filter || '*', searchResults);

			// Sort: common BAPIs first, then alphabetically
			const sorted = [...searchResults].sort((a, b) => {
				const aIsCommon = COMMON_BAPIS.includes(a.functionName as typeof COMMON_BAPIS[number]);
				const bIsCommon = COMMON_BAPIS.includes(b.functionName as typeof COMMON_BAPIS[number]);

				if (aIsCommon && !bIsCommon) return -1;
				if (!aIsCommon && bIsCommon) return 1;
				return a.functionName.localeCompare(b.functionName);
			});

			const results: INodeListSearchItems[] = sorted.map((fn) => ({
				name: `${fn.functionName}${fn.description ? ` - ${fn.description.substring(0, 40)}` : ''}`,
				value: fn.functionName,
			}));

			return { results };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			Logger.warn('Function search failed, showing common BAPIs', {
				module: 'SapRfcLoadOptions',
				error: errorMessage,
			});

			// Fallback to common BAPIs
			let filteredBapis = [...COMMON_BAPIS];
			if (filter) {
				const lowerFilter = filter.toLowerCase();
				filteredBapis = COMMON_BAPIS.filter((fn) =>
					fn.toLowerCase().includes(lowerFilter),
				);
			}

			return {
				results: [
					{
						name: `⚠️ Search failed: ${errorMessage.substring(0, 40)} - Showing common BAPIs`,
						value: '',
					},
					...filteredBapis.map((fn) => ({ name: fn, value: fn })),
				],
			};
		}
	},
};
