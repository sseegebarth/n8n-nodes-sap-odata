import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { buildSecureUrl, validateUrl, sanitizeHeaderValue, validateODataFilter } from './SecurityUtils';
import { ODataErrorHandler } from './ErrorHandler';
import {
	DEFAULT_PAGE_SIZE,
	DEFAULT_TIMEOUT,
	HEADERS,
	ERROR_MESSAGES,
	CREDENTIAL_TYPE,
} from './constants';
import {
	IODataQueryOptions,
	ISapOdataCredentials,
} from './types';
import { ConnectionPoolManager } from './ConnectionPoolManager';
import { Logger } from './Logger';
import { RetryHandler } from './RetryUtils';
import { ThrottleManager, ThrottleStrategy } from './ThrottleManager';
import { NodeOperationError } from 'n8n-workflow';

// Global throttle manager (singleton per workflow execution)
let throttleManager: ThrottleManager | null = null;

/**
 * Parse comma-separated status codes string into number array
 */
function parseStatusCodes(codes: string): number[] {
	if (!codes || typeof codes !== 'string') {
		return [429, 503, 504]; // Default retryable codes
	}

	return codes
		.split(',')
		.map((code) => parseInt(code.trim(), 10))
		.filter((code) => !isNaN(code) && code >= 100 && code < 600);
}

/**
 * Make an API request to SAP OData service using n8n's httpRequestWithAuthentication
 */
export async function sapOdataApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
): Promise<any> {
	const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;

	if (!credentials) {
		return ODataErrorHandler.handleValidationError(
			ERROR_MESSAGES.NO_CREDENTIALS,
			this.getNode(),
		);
	}

	const host = credentials.host.replace(/\/$/, '');
	const servicePath = credentials.servicePath.replace(/\/$/, '');

	// Validate host URL for security (SSRF protection)
	validateUrl(host, this.getNode());

	// Security warning for disabled SSL validation (only once per execution)
	if (credentials.allowUnauthorizedCerts === true) {
		// Use static flag to prevent warning spam
		const warningKey = 'sslWarningShown';
		try {
			const staticData = 'getWorkflowStaticData' in this
				? this.getWorkflowStaticData('global')
				: {};

			if (!staticData[warningKey]) {
				Logger.logSecurityWarning(
					'SSL certificate validation is DISABLED! ' +
					'This should ONLY be used in development environments. ' +
					'Production systems must use valid SSL certificates to prevent man-in-the-middle attacks.'
				);
				staticData[warningKey] = true;
			}
		} catch {
			// If staticData not available, just warn once per function call
			Logger.logSecurityWarning('SSL validation disabled - use only in development!');
		}
	}

	// Build secure URL
	const url = uri || buildSecureUrl(host, servicePath, resource);

	// Get advanced options (connection pool configuration) if available
	let advancedOptions: IDataObject = {};
	if ('getNodeParameter' in this) {
		try {
			advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IDataObject;
		} catch {
			// Not all contexts have access to node parameters
			advancedOptions = {};
		}
	}

	// Initialize throttling if enabled (once per workflow)
	const throttleEnabled = advancedOptions.throttleEnabled === true;
	if (throttleEnabled && !throttleManager) {
		throttleManager = new ThrottleManager({
			maxRequestsPerSecond: (advancedOptions.maxRequestsPerSecond as number) || 10,
			strategy: (advancedOptions.throttleStrategy as ThrottleStrategy) || 'delay',
			burstSize: (advancedOptions.throttleBurstSize as number) || 5,
			onThrottle: (waitTime) => {
				if (advancedOptions.logThrottling) {
					Logger.info('Request throttled', {
						module: 'ThrottleManager',
						waitTime: `${waitTime}ms`,
						strategy: advancedOptions.throttleStrategy,
						method,
						resource,
					});
				}
			},
		});

		Logger.debug('ThrottleManager initialized', {
			module: 'ThrottleManager',
			maxRequestsPerSecond: advancedOptions.maxRequestsPerSecond,
			strategy: advancedOptions.throttleStrategy,
		});
	}

	// Apply throttling
	if (throttleManager) {
		const allowed = await throttleManager.acquire();
		if (!allowed && advancedOptions.throttleStrategy === 'drop') {
			throw new NodeOperationError(
				this.getNode(),
				'Request dropped due to rate limiting',
				{
					description: 'Too many requests. Try reducing the request rate or changing the throttle strategy.',
				},
			);
		}
	}

	// Create request function that will be executed with or without retry
	const makeRequest = async () => {
		// Build pool configuration from advanced options
		const poolConfig = {
			keepAlive: advancedOptions.keepAlive !== undefined ? advancedOptions.keepAlive as boolean : undefined,
			maxSockets: advancedOptions.maxSockets as number | undefined,
			maxFreeSockets: advancedOptions.maxFreeSockets as number | undefined,
			timeout: advancedOptions.timeout as number | undefined,
			freeSocketTimeout: advancedOptions.freeSocketTimeout as number | undefined,
		};

		// Filter out undefined values
		const filteredConfig = Object.fromEntries(
			Object.entries(poolConfig).filter(([_, v]) => v !== undefined)
		);

		// Get connection pool instance and update config if needed
		// This ensures each request uses the correct config, even in multi-tenant scenarios
		const poolManager = ConnectionPoolManager.getInstance();
		if (Object.keys(filteredConfig).length > 0) {
			poolManager.updateConfig(filteredConfig);
		}
		const urlObj = new URL(url);
		const agent = poolManager.getAgent(urlObj.protocol);

		// Special handling for $metadata requests (XML response)
		const isMetadataRequest = resource.includes('$metadata');

		const options: IHttpRequestOptions = {
			method,
			url,
			headers: {
				Accept: isMetadataRequest ? 'application/xml' : HEADERS.ACCEPT,
				'Content-Type': HEADERS.CONTENT_TYPE,
			},
			body,
			qs,
			json: !isMetadataRequest, // $metadata returns XML, not JSON
			returnFullResponse: false,
			skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
			timeout: DEFAULT_TIMEOUT,
		} as IHttpRequestOptions & { agent?: any };

		// Add agent for connection pooling
		(options as any).agent = agent;

		// Add CSRF token for write operations
		if (method !== 'GET') {
			const csrfToken = await getCsrfToken.call(this, host, servicePath);
			if (csrfToken) {
				// Sanitize CSRF token to prevent header injection
				options.headers = {
					...options.headers,
					'X-CSRF-Token': sanitizeHeaderValue(csrfToken),
				};
			}
		}

		// Merge additional options
		Object.assign(options, option);

		// Debug logging
		const debugLogging = advancedOptions.debugLogging === true;
		Logger.setDebugMode(debugLogging);
		const startTime = debugLogging ? Date.now() : 0;

		if (debugLogging) {
			Logger.logRequest(method, url);
			Logger.debug('Request headers', {
				module: 'ApiClient',
				headers: {
					...options.headers,
					Authorization: options.headers?.Authorization ? '*****' : undefined,
				},
			});
		}

		try {
			// Use httpRequestWithAuthentication for automatic credential handling
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				CREDENTIAL_TYPE,
				options,
			);

			if (debugLogging) {
				const duration = Date.now() - startTime;
				Logger.debug('Response received', {
					module: 'ApiClient',
					duration: `${duration}ms`,
					responseType: typeof response,
				});

				// Log connection pool stats
				const stats = poolManager.getStats();
				Logger.logPoolStats({
					activeSockets: stats.activeSockets,
					freeSockets: stats.freeSockets,
					pendingRequests: stats.pendingRequests,
					totalRequests: stats.totalRequests,
					connectionsCreated: stats.totalConnectionsCreated,
					connectionsReused: stats.totalConnectionsReused,
					reuseRate: stats.totalRequests > 0
						? `${((stats.totalConnectionsReused / stats.totalRequests) * 100).toFixed(1)}%`
						: '0%',
				});
			}

			return response;
		} catch (error) {
			if (debugLogging) {
				const duration = Date.now() - startTime;
				Logger.error('Request failed', error as Error, {
					module: 'ApiClient',
					duration: `${duration}ms`,
					method,
					resource,
				});
			}

			return ODataErrorHandler.handleApiError(error, this.getNode(), {
				operation: method,
				resource,
			});
		}
	};

	// Apply retry logic if enabled
	const retryEnabled = advancedOptions.retryEnabled !== false; // Default to true
	if (retryEnabled) {
		const retryHandler = new RetryHandler({
			maxAttempts: (advancedOptions.maxRetries as number) || 3,
			initialDelay: (advancedOptions.initialRetryDelay as number) || 1000,
			maxDelay: (advancedOptions.maxRetryDelay as number) || 10000,
			backoffFactor: (advancedOptions.backoffFactor as number) || 2,
			retryableStatusCodes: parseStatusCodes(advancedOptions.retryStatusCodes as string),
			retryNetworkErrors: advancedOptions.retryNetworkErrors !== false,
			onRetry: (attempt, error, delay) => {
				if (advancedOptions.logRetries !== false) {
					Logger.info('Retrying request', {
						module: 'RetryHandler',
						attempt,
						maxAttempts: (advancedOptions.maxRetries as number) || 3,
						delay: `${delay}ms`,
						error: error instanceof Error ? error.message : 'Unknown error',
						method,
						resource,
					});
				}
			},
		});

		return retryHandler.execute(makeRequest);
	}

	// No retry - execute directly
	return makeRequest();
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
	const { CacheManager } = await import('./CacheManager');
	const cachedToken = CacheManager.getCsrfToken(this, host, servicePath);
	if (cachedToken) {
		return cachedToken;
	}

	const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;

	// Build secure URL for CSRF token fetch
	const url = buildSecureUrl(host, servicePath, '');

	// Get connection pool agent based on protocol
	const poolManager = ConnectionPoolManager.getInstance();
	const urlObj = new URL(url);
	const agent = poolManager.getAgent(urlObj.protocol);

	const options: IHttpRequestOptions = {
		method: 'GET',
		url,
		headers: {
			'X-CSRF-Token': 'Fetch',
			Accept: HEADERS.ACCEPT,
		},
		json: true,
		returnFullResponse: true,
		skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
		timeout: DEFAULT_TIMEOUT,
	} as IHttpRequestOptions & { agent?: any };

	// Add agent for connection pooling
	(options as any).agent = agent;

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
	const returnData: IDataObject[] = [];
	const errors: any[] = [];

	let responseData;
	let nextLink: string | undefined;
	let pageNumber = 1;
	let maxItemsReached = false;

	// Clone query to avoid mutation
	const initialQuery = { ...query };
	initialQuery.$top = initialQuery.$top || DEFAULT_PAGE_SIZE;

	do {
		try {
			// Use nextLink if available, otherwise use resource with query
			if (nextLink) {
				responseData = await sapOdataApiRequest.call(this, method, '', body, {}, nextLink);
			} else {
				responseData = await sapOdataApiRequest.call(this, method, resource, body, initialQuery);
			}

			// Extract data using propertyName or fall back to detecting structure
			let items: any[] = [];

			if (propertyName && responseData[propertyName]) {
				// Use specified property name
				items = Array.isArray(responseData[propertyName])
					? responseData[propertyName]
					: [responseData[propertyName]];
			} else if (responseData.d?.results) {
				// OData V2 format
				items = responseData.d.results;
			} else if (responseData.value) {
				// OData V4 format
				items = responseData.value;
			} else if (responseData.d) {
				// Single item in OData V2 format
				items = [responseData.d];
			} else {
				// Raw response
				items = Array.isArray(responseData) ? responseData : [responseData];
			}

			// Check if adding all items would exceed maxItems limit
			if (maxItems > 0 && returnData.length + items.length > maxItems) {
				// Only add items up to the limit
				const itemsToAdd = maxItems - returnData.length;
				returnData.push(...items.slice(0, itemsToAdd));
				maxItemsReached = true;
				Logger.info('Max items limit reached', {
					module: 'PaginationHandler',
					maxItems,
					pageNumber,
					itemsFetched: returnData.length,
				});
				break;
			}

			returnData.push(...items);

			// Check for next link (OData V2: __next, OData V4: @odata.nextLink)
			if (responseData.d?.__next) {
				nextLink = responseData.d.__next;
			} else if (responseData['@odata.nextLink']) {
				nextLink = responseData['@odata.nextLink'];
			} else {
				nextLink = undefined;
			}

			// If no next link but we got a full page, try manual skip increment
			// (fallback for servers that don't provide next links)
			if (!nextLink && items.length === initialQuery.$top) {
				const currentSkip = typeof initialQuery.$skip === 'number' ? initialQuery.$skip : 0;
				initialQuery.$skip = currentSkip + items.length;
			} else if (!nextLink) {
				// No next link and partial page = end of data
				break;
			}

			pageNumber++;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const paginationError = {
				page: pageNumber,
				error: errorMessage,
				itemsFetchedSoFar: returnData.length,
			};

			if (continueOnFail) {
				// Log error and collect it
				Logger.warn('Pagination error - continuing with partial results', {
					module: 'PaginationHandler',
					pageNumber,
					errorMessage,
					itemsFetchedSoFar: returnData.length,
				});
				errors.push(paginationError);
				// Stop pagination on error
				break;
			} else {
				// Re-throw error if not continuing on fail
				throw error;
			}
		}
	} while (nextLink !== undefined);

	// Return data with metadata if special conditions occurred
	if ((continueOnFail && errors.length > 0) || maxItemsReached) {
		const result: any = {
			data: returnData,
			partial: false,
			message: '',
		};

		if (continueOnFail && errors.length > 0) {
			result.errors = errors;
			result.partial = true;
			result.message = `Fetched ${returnData.length} items before encountering ${errors.length} error(s)`;
		}

		if (maxItemsReached) {
			result.partial = true;
			result.limitReached = true;
			result.message = result.message
				? `${result.message}. Max items limit (${maxItems}) reached.`
				: `Fetched ${returnData.length} items. Max items limit (${maxItems}) reached - more data may be available.`;
		}

		return result;
	}

	return returnData;
}

/**
 * Escape single quotes in OData filter values
 * OData spec: Single quotes must be escaped by doubling them
 */
function escapeODataString(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Build OData filter string with proper escaping and type validation
 */
export function buildODataFilter(filters: IDataObject): string {
	const filterParts: string[] = [];

	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== null && value !== '') {
			if (typeof value === 'string') {
				// Escape single quotes according to OData spec
				const escapedValue = escapeODataString(value);
				filterParts.push(`${key} eq '${escapedValue}'`);
			} else if (typeof value === 'number') {
				filterParts.push(`${key} eq ${value}`);
			} else if (typeof value === 'boolean') {
				filterParts.push(`${key} eq ${value}`);
			} else if (typeof value === 'object') {
				// Reject complex objects/arrays - they cannot be used in OData filters
				throw new Error(
					`Invalid filter value type for key '${key}': Objects and arrays are not supported in OData filters. Use primitive values (string, number, boolean) only.`,
				);
			}
		}
	}

	return filterParts.join(' and ');
}

/**
 * Normalize OData query options to support both $ prefix and non-prefix keys
 * UI uses 'filter', 'select' etc. but OData spec requires '$filter', '$select'
 */
function normalizeODataOptions(options: any): IODataQueryOptions {
	const normalized: any = {};

	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined && value !== null && value !== '') {
			// Add $ prefix if not present for standard OData parameters
			const normalizedKey = key.startsWith('$') ? key : `$${key}`;
			normalized[normalizedKey] = value;
		}
	}

	return normalized as IODataQueryOptions;
}

/**
 * Build OData query parameters
 * Supports both '$filter' and 'filter' style parameters for compatibility
 */
export function buildODataQuery(options: IODataQueryOptions): IDataObject {
	// Normalize options to ensure $ prefix
	const normalizedOptions = normalizeODataOptions(options);
	const query: IDataObject = {};

	if (normalizedOptions.$filter) {
		// Validate filter for security (prevent XSS/injection)
		// Note: We create a minimal node object for validation since we don't have access to this context
		const dummyNode = { name: 'SAP OData', type: 'n8n-nodes-sap-odata.sapOData', typeVersion: 1, position: [0, 0] };
		validateODataFilter(normalizedOptions.$filter as string, dummyNode as any);
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

/**
 * Parse OData $metadata XML to extract EntitySet names
 */
export function parseMetadataForEntitySets(metadataXml: string): string[] {
	const entitySets: string[] = [];

	// Simple regex-based XML parsing for EntitySet elements
	// Matches: <EntitySet Name="ProductSet" ...>
	const entitySetRegex = /<EntitySet\s+Name="([^"]+)"/g;
	let match;

	while ((match = entitySetRegex.exec(metadataXml)) !== null) {
		entitySets.push(match[1]);
	}

	return entitySets.sort();
}

/**
 * Parse OData $metadata XML to extract FunctionImport names
 */
export function parseMetadataForFunctionImports(metadataXml: string): string[] {
	const functionImports: string[] = [];

	// Matches: <FunctionImport Name="GetSalesOrder" ...>
	const functionImportRegex = /<FunctionImport\s+Name="([^"]+)"/g;
	let match;

	while ((match = functionImportRegex.exec(metadataXml)) !== null) {
		functionImports.push(match[1]);
	}

	return functionImports.sort();
}
