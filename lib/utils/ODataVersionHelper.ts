import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { METADATA_CACHE_TTL } from '../constants';
import { LoggerAdapter } from './LoggerAdapter';

/**
 * Cache entry for OData version with TTL support
 */
interface IVersionCacheEntry {
	version: 'v2' | 'v4';
	expires: number;
}

/**
 * Helper class for handling OData V2 and V4 version-specific logic.
 * Provides methods for version detection, query parameter mapping,
 * and response parsing based on OData protocol version.
 *
 * Implements caching to avoid repeated metadata calls for version detection.
 * Cache is keyed by service URL + service path for precise matching.
 */
export class ODataVersionHelper {
	private static versionCache = new Map<string, IVersionCacheEntry>();

	/**
	 * Get the OData version from credentials or detect it automatically
	 *
	 * @param context - Execution context
	 * @returns The OData version ('v2' or 'v4')
	 */
	public static async getODataVersion(context: IExecuteFunctions): Promise<'v2' | 'v4'> {
		const credentials = await context.getCredentials('sapOdataApi');
		const configuredVersion = credentials.version as string || 'auto';

		// If explicitly configured, use that
		if (configuredVersion === 'v2' || configuredVersion === 'v4') {
			LoggerAdapter.debug('ODataVersionHelper', {
				action: 'version_configured',
				version: configuredVersion,
			});
			return configuredVersion;
		}

		// Auto-detect version
		const serviceUrl = credentials.host as string;
		const servicePath = credentials.servicePath as string || '';
		// Cache key includes both host and service path for precise matching
		const cacheKey = `${serviceUrl}|${servicePath}`;

		// Check cache first (with TTL validation)
		const cached = this.versionCache.get(cacheKey);
		if (cached && cached.expires > Date.now()) {
			LoggerAdapter.debug('ODataVersionHelper', {
				action: 'version_cached',
				version: cached.version,
				ttlRemaining: Math.round((cached.expires - Date.now()) / 1000),
			});
			return cached.version;
		}

		// Clean up expired entry if present
		if (cached) {
			this.versionCache.delete(cacheKey);
		}

		// Detect version from service metadata
		const detectedVersion = await this.detectVersion(context, serviceUrl);

		// Cache with TTL
		this.versionCache.set(cacheKey, {
			version: detectedVersion,
			expires: Date.now() + METADATA_CACHE_TTL,
		});

		LoggerAdapter.info('ODataVersionHelper', {
			action: 'version_detected',
			version: detectedVersion,
			serviceUrl,
			servicePath,
			cacheTtl: METADATA_CACHE_TTL,
		});

		return detectedVersion;
	}

	/**
	 * Detect OData version from service metadata
	 *
	 * @param context - Execution context
	 * @param serviceUrl - Service base URL
	 * @returns Detected version
	 */
	private static async detectVersion(
		context: IExecuteFunctions,
		_serviceUrl: string,
	): Promise<'v2' | 'v4'> {
		try {
			// Try to fetch metadata to detect version
			const { sapOdataApiRequest } = await import('../../nodes/SapOData/GenericFunctions');

			// First try V4 metadata endpoint
			try {
				const v4Response = await sapOdataApiRequest.call(
					context,
					'GET',
					'/$metadata',
					{},
					{},
				);

				// Check for V4 indicators
				if (this.isV4Response(v4Response)) {
					return 'v4';
				}
			} catch (v4Error) {
				// V4 failed, try V2
			}

			// Try V2 metadata endpoint
			const v2Response = await sapOdataApiRequest.call(
				context,
				'GET',
				'/$metadata',
				{},
				{},
			);

			// Check for V2 indicators
			if (this.isV2Response(v2Response)) {
				return 'v2';
			}

			// Default to V2 (most common in SAP)
			return 'v2';
		} catch (error) {
			LoggerAdapter.warn('ODataVersionHelper', {
				action: 'version_detection_failed',
				error: error instanceof Error ? error.message : String(error),
				defaulting_to: 'v2',
			});
			// Default to V2 if detection fails
			return 'v2';
		}
	}

	/**
	 * Check if response is OData V4
	 */
	private static isV4Response(response: any): boolean {
		// V4 specific indicators
		if (typeof response === 'string') {
			return response.includes('Version="4.0"') ||
			       response.includes('xmlns="http://docs.oasis-open.org/odata/ns/edm"');
		}
		// Check for V4 response structure (no 'd' wrapper)
		return response['@odata.context'] !== undefined;
	}

	/**
	 * Check if response is OData V2
	 */
	private static isV2Response(response: any): boolean {
		// V2 specific indicators
		if (typeof response === 'string') {
			return response.includes('Version="1.0"') ||
			       response.includes('xmlns="http://schemas.microsoft.com/ado/2007/08/dataservices"');
		}
		// Check for V2 response structure ('d' wrapper)
		return response.d !== undefined;
	}

	/**
	 * Get version-specific query parameters
	 *
	 * @param version - OData version
	 * @param params - Common parameter names
	 * @returns Version-specific parameter mapping
	 */
	public static getVersionSpecificParams(
		version: 'v2' | 'v4',
		params: IDataObject,
	): IDataObject {
		const result: IDataObject = { ...params };

		// Handle count parameter
		if ('count' in params) {
			if (version === 'v4') {
				result['$count'] = params.count;
			} else {
				result['$inlinecount'] = params.count ? 'allpages' : 'none';
			}
			delete result.count;
		}

		// Handle pagination count
		if (params.includeCount === true) {
			if (version === 'v4') {
				result['$count'] = true;
			} else {
				result['$inlinecount'] = 'allpages';
			}
			delete result.includeCount;
		}

		LoggerAdapter.debug('ODataVersionHelper', {
			action: 'params_mapped',
			version,
			original: params,
			mapped: result,
		});

		return result;
	}

	/**
	 * Extract data from version-specific response structure
	 * Handles various SAP OData response formats robustly
	 *
	 * @param response - OData response
	 * @param version - OData version
	 * @returns Extracted data (array for collections, object for single entities)
	 */
	public static extractData(response: any, version: 'v2' | 'v4'): any {
		if (!response) return null;

		let data;

		if (version === 'v2') {
			// V2: data is wrapped in 'd' property
			// Collection: { d: { results: [...], __count: "n" } }
			// Single entity: { d: { Property1: "...", Property2: "..." } }
			if (response.d?.results !== undefined) {
				// Collection response - return the results array
				data = response.d.results;
			} else if (response.d) {
				// Single entity response - return the entity object
				// But check if 'd' itself looks like a wrapper with results
				if (response.d.results === undefined && typeof response.d === 'object') {
					data = response.d;
				} else {
					data = response.d;
				}
			} else if (Array.isArray(response)) {
				// Already an array (sometimes happens with pre-processed responses)
				data = response;
			} else {
				// Fallback - return as-is
				data = response;
			}
		} else {
			// V4: data is in 'value' property or root
			// Collection: { value: [...], @odata.context: "..." }
			// Single entity: { Property1: "...", @odata.context: "..." }
			if (response.value !== undefined) {
				data = response.value;
			} else if (Array.isArray(response)) {
				data = response;
			} else if (response['@odata.context'] !== undefined) {
				// This is a V4 response but without 'value' - likely a single entity
				// Remove OData metadata properties and return the entity
				const { '@odata.context': _, '@odata.etag': __, ...entityData } = response;
				data = entityData;
			} else {
				data = response;
			}
		}

		LoggerAdapter.debug('ODataVersionHelper', {
			action: 'data_extracted',
			version,
			hasD: !!response.d,
			hasDResults: !!response.d?.results,
			hasValue: !!response.value,
			hasODataContext: !!response['@odata.context'],
			isArray: Array.isArray(data),
			itemCount: Array.isArray(data) ? data.length : 1,
		});

		return data;
	}

	/**
	 * Get total count from response
	 *
	 * @param response - OData response
	 * @param version - OData version
	 * @returns Total count or undefined
	 */
	public static getTotalCount(response: any, version: 'v2' | 'v4'): number | undefined {
		if (version === 'v2') {
			// V2: count in d.__count
			return response.d?.__count;
		} else {
			// V4: count in @odata.count
			return response['@odata.count'];
		}
	}

	/**
	 * Get next link from response for pagination
	 *
	 * @param response - OData response
	 * @param version - OData version
	 * @returns Next link URL or undefined
	 */
	public static getNextLink(response: any, version: 'v2' | 'v4'): string | undefined {
		if (version === 'v2') {
			// V2: next link in d.__next
			return response.d?.__next;
		} else {
			// V4: next link in @odata.nextLink
			return response['@odata.nextLink'];
		}
	}

	/**
	 * Parse error response based on version
	 *
	 * @param error - Error response
	 * @param version - OData version
	 * @returns Parsed error message
	 */
	public static parseError(error: any, version: 'v2' | 'v4'): string {
		let errorMessage = 'An unknown SAP OData error occurred';

		try {
			if (version === 'v4') {
				// V4 error structure
				if (error.error?.message) {
					errorMessage = typeof error.error.message === 'string'
						? error.error.message
						: error.error.message.value || errorMessage;
				}
			} else {
				// V2 error structure
				if (error.error?.message?.value) {
					errorMessage = error.error.message.value;
				} else if (error.error?.message) {
					errorMessage = typeof error.error.message === 'string'
						? error.error.message
						: errorMessage;
				}
			}

			// Check for innererror details
			const innerError = error.error?.innererror || error.error?.details;
			if (innerError) {
				if (typeof innerError === 'string') {
					errorMessage += ` - ${innerError}`;
				} else if (innerError.message) {
					errorMessage += ` - ${innerError.message}`;
				}
			}
		} catch (parseError) {
			LoggerAdapter.error('ODataVersionHelper parse error', parseError instanceof Error ? parseError : new Error(String(parseError)), {
				action: 'error_parse_failed',
				originalError: error,
			});
		}

		return errorMessage;
	}

	/**
	 * Format entity key based on OData version
	 *
	 * @param key - Entity key value(s)
	 * @param version - OData version
	 * @returns Formatted key
	 */
	public static formatEntityKey(key: string, version: 'v2' | 'v4'): string {
		// V4 requires string keys to be in quotes
		if (version === 'v4') {
			// Check if it's a simple string key (not composite)
			if (!key.includes('=') && !key.includes(',')) {
				// Check if it's not already quoted and not a number
				if (!key.startsWith("'") && isNaN(Number(key))) {
					return `'${key}'`;
				}
			}
		}
		return key;
	}

	/**
	 * Clear version cache (useful for testing or credential changes)
	 */
	public static clearCache(): void {
		this.versionCache.clear();
		LoggerAdapter.debug('ODataVersionHelper', {
			action: 'cache_cleared',
		});
	}
}