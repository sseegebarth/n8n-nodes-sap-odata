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
import { CREDENTIAL_TYPE } from '../../lib/constants';
import { executeRequest, IApiClientConfig } from '../../lib/core/ApiClient';
import {
	fetchAllItems,
	IPaginationConfig,
	IPaginationResult,
} from '../../lib/core/PaginationHandler';
import {
	buildODataQuery as coreBuildODataQuery,
	buildODataFilter as coreBuildODataFilter,
	parseMetadataForEntitySets as coreParseMetadataForEntitySets,
	parseMetadataForFunctionImports as coreParseMetadataForFunctionImports,
} from '../../lib/core/QueryBuilder';
import { buildCsrfTokenRequest } from '../../lib/core/RequestBuilder';
import { ISapOdataCredentials, IODataQueryOptions } from '../../lib/types';
import { formatODataValue } from '../../lib/utils/ODataValueFormatter';
import { resolveServicePath } from '../../lib/utils/ServicePathResolver';

// Re-export for backward compatibility
export { resolveServicePath };

/**
 * Make an API request to SAP OData service using n8n's httpRequestWithAuthentication
 *
 * @typeParam T - Expected response data type
 * @deprecated Use executeRequest from core/ApiClient for new code
 */
export async function sapOdataApiRequest<T = unknown>(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
	customServicePath?: string,
): Promise<T> {
	// Resolve service path and get CSRF token for write operations
	const resolvedServicePath = resolveServicePath(this, customServicePath);
	let csrfToken: string | undefined;
	if (method !== 'GET') {
		const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;
		if (credentials) {
			const host = credentials.host.replace(/\/$/, '');
			csrfToken = await getCsrfToken.call(this, host, resolvedServicePath);
		}
	}

	// Delegate to core ApiClient with explicit service path
	const config: IApiClientConfig = {
		method,
		resource,
		body,
		qs,
		uri,
		option,
		csrfToken,
		servicePath: resolvedServicePath,
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
	// Use SAP Gateway compatibility utility for enhanced session management
	const { SapGatewayCompat } = await import('../../lib/utils/SapGatewayCompat');

	const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;

	// Fetch token with enhanced session management
	return SapGatewayCompat.fetchCsrfToken(
		this,
		host,
		servicePath,
		(h, sp) => buildCsrfTokenRequest(h, sp, credentials, this.getNode()),
	);
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
): Promise<IDataObject[] | IPaginationResult> {
	// Resolve service path once for all requests
	const resolvedServicePath = resolveServicePath(this);

	// Get CSRF token for write operations
	let csrfToken: string | undefined;
	if (method !== 'GET') {
		const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;
		if (credentials) {
			const host = credentials.host.replace(/\/$/, '');
			csrfToken = await getCsrfToken.call(this, host, resolvedServicePath);
		}
	}

	// Create request function that calls executeRequest directly
	const requestFunction = async (qs?: IDataObject, uri?: string) => {
		const config: IApiClientConfig = {
			method,
			resource: uri ? '' : resource,
			body,
			qs: qs || query,
			uri,
			option: {},
			csrfToken,
			servicePath: resolvedServicePath,
		};
		return executeRequest.call(this, config);
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
	// Use new refactored formatter
	// Default options: autoDetect enabled for backward compatibility
	return formatODataValue(value, typeHint, { autoDetect: true, warnOnAutoDetect: false });
}
