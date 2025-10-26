/**
 * GenericFunctions - SAP OData Helper Functions
 * This module provides backward-compatible wrappers for the refactored core modules
 */

import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
} from 'n8n-workflow';

// Import core modules from Shared
import { executeRequest, IApiClientConfig } from '../Shared/core/ApiClient';
import { fetchAllItems, IPaginationConfig } from '../Shared/core/PaginationHandler';
import {
	buildODataQuery as coreBuildODataQuery,
	buildODataFilter as coreBuildODataFilter,
	parseMetadataForEntitySets as coreParseMetadataForEntitySets,
	parseMetadataForFunctionImports as coreParseMetadataForFunctionImports,
} from '../Shared/core/QueryBuilder';
import { buildCsrfTokenRequest } from '../Shared/core/RequestBuilder';

// Import dependencies from Shared
import { CREDENTIAL_TYPE } from '../Shared/constants';
import { ISapOdataCredentials, IODataQueryOptions } from '../Shared/types';

/**
 * Make an API request to SAP OData service using n8n's httpRequestWithAuthentication
 *
 * @deprecated Use executeRequest from core/ApiClient for new code
 */
export async function sapOdataApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
	customServicePath?: string,
): Promise<any> {
	// Get CSRF token for write operations
	let csrfToken: string | undefined;
	if (method !== 'GET') {
		const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;
		if (credentials) {
			const host = credentials.host.replace(/\/$/, '');
			// Get servicePath from parameter or node parameter - different methods for different contexts
			let servicePath = customServicePath || '/sap/opu/odata/sap/';
			if (!customServicePath) {
				if ('getNodeParameter' in this) {
					servicePath = (this.getNodeParameter('servicePath', 0, '/sap/opu/odata/sap/') as string).replace(/\/$/, '');
				} else if ('getCurrentNodeParameter' in this) {
					servicePath = (((this as any).getCurrentNodeParameter('servicePath') as string) || '/sap/opu/odata/sap/').replace(/\/$/, '');
				}
			}
			csrfToken = await getCsrfToken.call(this, host, servicePath);
		}
	}

	// Delegate to core ApiClient
	const config: IApiClientConfig = {
		method,
		resource,
		body,
		qs,
		uri,
		option,
		csrfToken,
	};

	return executeRequest.call(this, config);
}

/**
 * Get CSRF token for write operations
 * Uses cache to avoid unnecessary token requests
 */
export async function getCsrfToken(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	host: string,
	servicePath: string,
): Promise<string> {
	// Try to get token from cache first
	const { CacheManager } = await import('../Shared/utils/CacheManager');
	const cachedToken = CacheManager.getCsrfToken(this, host, servicePath);
	if (cachedToken) {
		return cachedToken;
	}

	const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;

	// Build request for CSRF token
	const options = buildCsrfTokenRequest(host, servicePath, credentials, this.getNode());

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_TYPE,
			options,
		);
		const token = response.headers['x-csrf-token'] || '';

		// Cache the token for future requests
		if (token) {
			CacheManager.setCsrfToken(this, host, servicePath, token);
		}

		return token;
	} catch (error) {
		// If CSRF token fetch fails, return empty string
		// This is expected for public services without authentication
		return '';
	}
}

/**
 * Make an API request with automatic pagination
 * Supports both OData V2 (__next) and V4 (@odata.nextLink) pagination
 *
 * @param continueOnFail - If true, continues pagination on errors and returns partial results
 * @param maxItems - Maximum number of items to fetch (0 = no limit)
 * @returns Data array, or object with data and errors if continueOnFail is true
 *
 * @deprecated Use fetchAllItems from core/PaginationHandler for new code
 */
export async function sapOdataApiRequestAllItems(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	resource: string,
	body: IDataObject = {},
	query: IDataObject = {},
	continueOnFail = false,
	maxItems = 0,
): Promise<any> {
	// Create request function that wraps sapOdataApiRequest
	const requestFunction = async (qs?: IDataObject, uri?: string) => {
		if (uri) {
			return sapOdataApiRequest.call(this, method, '', body, {}, uri);
		} else {
			return sapOdataApiRequest.call(this, method, resource, body, qs || query);
		}
	};

	// Delegate to core PaginationHandler
	const config: IPaginationConfig = {
		propertyName,
		continueOnFail,
		maxItems,
	};

	return fetchAllItems(requestFunction, config);
}

/**
 * Build OData filter string with proper escaping and type validation
 *
 * @deprecated Use buildODataFilter from core/QueryBuilder for new code
 */
export function buildODataFilter(filters: IDataObject): string {
	return coreBuildODataFilter(filters);
}

/**
 * Build OData query parameters
 * Supports both '$filter' and 'filter' style parameters for compatibility
 *
 * @deprecated Use buildODataQuery from core/QueryBuilder for new code
 */
export function buildODataQuery(options: IODataQueryOptions): IDataObject {
	return coreBuildODataQuery(options);
}

/**
 * Parse OData $metadata XML to extract EntitySet names
 *
 * @deprecated Use parseMetadataForEntitySets from core/QueryBuilder for new code
 */
export function parseMetadataForEntitySets(metadataXml: string): string[] {
	return coreParseMetadataForEntitySets(metadataXml);
}

/**
 * Parse OData $metadata XML to extract FunctionImport names
 *
 * @deprecated Use parseMetadataForFunctionImports from core/QueryBuilder for new code
 */
export function parseMetadataForFunctionImports(metadataXml: string): string[] {
	return coreParseMetadataForFunctionImports(metadataXml);
}

/**
 * Format a value for SAP OData based on its type
 * Handles special SAP types: datetime, GUID, decimal, date, datetimeoffset, time, and string escaping
 *
 * @param value - The value to format
 * @param typeHint - Optional type hint (Edm.DateTime, Edm.Guid, Edm.Decimal, Edm.Date, Edm.DateTimeOffset, Edm.TimeOfDay, etc.)
 * @returns Formatted string ready for OData URL or filter
 */
export function formatSapODataValue(value: any, typeHint?: string): string {
	// Handle null and undefined
	if (value === null || value === undefined) {
		return 'null';
	}

	// Normalize type hint (support both 'datetime' and 'Edm.DateTime')
	const normalizedType = typeHint?.toLowerCase().replace('edm.', '');

	// Auto-detect type from value if no hint provided
	let detectedType = normalizedType;
	if (!detectedType) {
		if (typeof value === 'boolean') {
			detectedType = 'boolean';
		} else if (typeof value === 'number') {
			detectedType = 'number';
		} else if (typeof value === 'string') {
			// Try to detect GUID pattern
			if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
				detectedType = 'guid';
			}
			// Try to detect ISO datetime with timezone (DateTimeOffset)
			else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/.test(value)) {
				detectedType = 'datetimeoffset';
			}
			// Try to detect ISO datetime pattern
			else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
				detectedType = 'datetime';
			}
			// Try to detect date-only pattern
			else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				detectedType = 'date';
			}
			// Try to detect time-only pattern
			else if (/^\d{2}:\d{2}:\d{2}/.test(value)) {
				detectedType = 'timeofday';
			}
			// Default to string
			else {
				detectedType = 'string';
			}
		}
	}

	// Format based on type
	switch (detectedType) {
		case 'datetime':
			// SAP OData V2 format: datetime'2024-01-15T10:30:00'
			// Remove timezone info if present, SAP expects local time
			const dateStr = typeof value === 'string' ? value : new Date(value).toISOString();
			const cleanDate = dateStr.replace(/\.\d{3}Z$/, '').replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
			return `datetime'${cleanDate}'`;

		case 'datetimeoffset':
			// SAP OData V4 format: 2024-01-15T10:30:00+01:00 or 2024-01-15T10:30:00Z
			// Keep timezone info for DateTimeOffset
			const offsetStr = typeof value === 'string' ? value : new Date(value).toISOString();
			return `${offsetStr}`;

		case 'date':
			// SAP OData V4 format: 2024-01-15 (date only, no time)
			let dateOnlyStr: string;
			if (typeof value === 'string') {
				dateOnlyStr = value;
			} else {
				const d = new Date(value);
				dateOnlyStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			}
			return `${dateOnlyStr}`;

		case 'timeofday':
		case 'time':
			// SAP OData V4 format: 10:30:00 or 10:30:00.123
			// Extract time portion if full datetime provided
			let timeStr: string;
			if (typeof value === 'string') {
				// If it's a full ISO datetime, extract time part
				if (value.includes('T')) {
					timeStr = value.split('T')[1].split(/[+-Z]/)[0];
				} else {
					timeStr = value;
				}
			} else {
				const d = new Date(value);
				timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
			}
			return `${timeStr}`;

		case 'guid':
			// SAP OData format: guid'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
			const guidStr = String(value).toLowerCase();
			return `guid'${guidStr}'`;

		case 'decimal':
			// SAP OData format: 12.34M or 12.34m
			// Support decimal scale if provided as object: { value: 12.34, scale: 2 }
			if (typeof value === 'object' && 'value' in value) {
				const decimalValue = value.value;
				const scale = value.scale || 2;
				return `${Number(decimalValue).toFixed(scale)}M`;
			}
			return `${value}M`;

		case 'boolean':
			// Boolean: true or false (lowercase)
			return String(value).toLowerCase();

		case 'number':
		case 'int16':
		case 'int32':
		case 'int64':
		case 'single':
		case 'double':
		case 'byte':
			// Numbers: as-is
			return String(value);

		case 'string':
		default:
			// Strings: escape single quotes by doubling them
			const escapedValue = String(value).replace(/'/g, "''");
			return `'${escapedValue}'`;
	}
}
