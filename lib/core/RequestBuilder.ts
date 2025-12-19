/**
 * RequestBuilder - HTTP Request Configuration
 * Handles building HTTP request options with proper headers and security
 */

import { IDataObject, IHttpRequestOptions, INode } from 'n8n-workflow';
import { HEADERS, DEFAULT_TIMEOUT } from '../constants';
import { ISapOdataCredentials } from '../types';
import { ConnectionPoolManager } from '../utils/ConnectionPoolManager';
import { Logger } from '../utils/Logger';
import { buildSecureUrl, validateUrl, sanitizeHeaderValue } from '../utils/SecurityUtils';

/**
 * Configuration for building HTTP requests
 */
export interface IRequestConfig {
	method: string;
	resource: string;
	host: string;
	servicePath: string;
	body?: IDataObject;
	qs?: IDataObject;
	uri?: string;
	options?: IDataObject;
	credentials: ISapOdataCredentials;
	csrfToken?: string;
	poolConfig?: IDataObject;
	node: INode;
}

/**
 * Build base HTTP request options for SAP OData API calls
 *
 * @param config - Request configuration
 * @returns Configured HTTP request options ready for execution
 *
 * @example
 * const options = buildRequestOptions({
 *   method: 'GET',
 *   resource: 'ProductSet',
 *   host: 'https://api.sap.com',
 *   servicePath: '/sap/opu/odata/sap/API_PRODUCT',
 *   credentials: { ... },
 *   node: this.getNode()
 * });
 */
export function buildRequestOptions(config: IRequestConfig): IHttpRequestOptions {
	const {
		method,
		resource,
		host,
		servicePath,
		body = {},
		qs = {},
		uri,
		options = {},
		credentials,
		csrfToken,
		poolConfig = {},
		node,
	} = config;

	// Validate host URL for security (SSRF protection)
	validateUrl(host, node);

	// Build secure URL
	const url = uri || buildSecureUrl(host, servicePath, resource);

	// Special handling for $metadata requests (XML response)
	const isMetadataRequest = resource.includes('$metadata');

	// Build HTTP request options
	const requestOptions: IHttpRequestOptions = {
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

	// Add Basic Auth if credentials provided
	if (credentials.authentication === 'basicAuth' && credentials.username && credentials.password) {
		(requestOptions as any).auth = {
			username: credentials.username,
			password: credentials.password,
		};
	}

	// Add CSRF token for write operations
	if (method !== 'GET' && csrfToken) {
		// Sanitize CSRF token to prevent header injection
		requestOptions.headers = {
			...requestOptions.headers,
			'X-CSRF-Token': sanitizeHeaderValue(csrfToken),
		};
	}

	// Add SAP-specific headers
	if (credentials.sapClient) {
		requestOptions.headers = {
			...requestOptions.headers,
			'sap-client': sanitizeHeaderValue(credentials.sapClient),
		};
	}

	if (credentials.sapLanguage) {
		requestOptions.headers = {
			...requestOptions.headers,
			'sap-language': sanitizeHeaderValue(credentials.sapLanguage),
		};
	}

	// Add custom headers from credentials
	if (credentials.customHeaders) {
		try {
			const customHeaders = typeof credentials.customHeaders === 'string'
				? JSON.parse(credentials.customHeaders)
				: credentials.customHeaders;

			// Validate custom headers for security
			const forbiddenHeaders = ['authorization', 'x-csrf-token', 'cookie', 'set-cookie'];
			for (const [key, value] of Object.entries(customHeaders)) {
				// Skip empty values
				if (!value) continue;

				// Validate header name (RFC 7230)
				const headerName = String(key).toLowerCase().trim();
				if (!/^[a-z0-9-]+$/i.test(headerName)) {
					Logger.warn('Invalid custom header name skipped', {
						module: 'RequestBuilder',
						headerName: key,
					});
					continue;
				}

				// Block forbidden headers that could interfere with security
				if (forbiddenHeaders.includes(headerName)) {
					Logger.warn('Forbidden custom header skipped', {
						module: 'RequestBuilder',
						headerName: key,
					});
					continue;
				}

				requestOptions.headers = {
					...requestOptions.headers,
					[headerName]: sanitizeHeaderValue(String(value)),
				};
			}
		} catch (error) {
			Logger.warn('Failed to parse custom headers', {
				module: 'RequestBuilder',
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Add connection pool agent if poolConfig provided
	if (Object.keys(poolConfig).length > 0) {
		const poolManager = ConnectionPoolManager.getInstance();

		// Filter out undefined values
		const filteredConfig = Object.fromEntries(
			Object.entries(poolConfig).filter(([_, v]) => v !== undefined)
		);

		if (Object.keys(filteredConfig).length > 0) {
			poolManager.updateConfig(filteredConfig);
		}

		const urlObj = new URL(url);
		const agent = poolManager.getAgent(urlObj.protocol);
		(requestOptions as any).agent = agent;
	}

	// Merge additional options
	Object.assign(requestOptions, options);

	return requestOptions;
}

/**
 * Build request options specifically for CSRF token fetching
 *
 * @param host - SAP host URL
 * @param servicePath - OData service path
 * @param credentials - SAP OData credentials
 * @param node - n8n node for error context
 * @returns HTTP request options for CSRF token fetch
 */
export function buildCsrfTokenRequest(
	host: string,
	servicePath: string,
	credentials: ISapOdataCredentials,
	node: INode,
): IHttpRequestOptions {
	// Validate host URL
	validateUrl(host, node);

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

	// Add Basic Auth if credentials provided
	if (credentials.authentication === 'basicAuth' && credentials.username && credentials.password) {
		(options as any).auth = {
			username: credentials.username,
			password: credentials.password,
		};
	}

	// Add agent for connection pooling
	(options as any).agent = agent;

	return options;
}

/**
 * Parse pool configuration from advanced options
 *
 * @param advancedOptions - Node's advanced options
 * @returns Filtered pool configuration
 */
export function parsePoolConfig(advancedOptions: IDataObject): IDataObject {
	const poolConfig = {
		keepAlive: advancedOptions.keepAlive !== undefined ? advancedOptions.keepAlive as boolean : undefined,
		maxSockets: advancedOptions.maxSockets as number | undefined,
		maxFreeSockets: advancedOptions.maxFreeSockets as number | undefined,
		timeout: advancedOptions.timeout as number | undefined,
		freeSocketTimeout: advancedOptions.freeSocketTimeout as number | undefined,
	};

	// Filter out undefined values
	return Object.fromEntries(
		Object.entries(poolConfig).filter(([_, v]) => v !== undefined)
	);
}

/**
 * Parse comma-separated status codes string into number array
 *
 * @param codes - Comma-separated status codes (e.g., "429,503,504")
 * @returns Array of valid HTTP status codes
 *
 * @example
 * parseStatusCodes("429, 503, 504")
 * // Returns: [429, 503, 504]
 *
 * parseStatusCodes("")
 * // Returns: [429, 503, 504] (defaults)
 */
export function parseStatusCodes(codes: string): number[] {
	if (!codes || typeof codes !== 'string') {
		return [429, 503, 504]; // Default retryable codes
	}

	return codes
		.split(',')
		.map((code) => parseInt(code.trim(), 10))
		.filter((code) => !isNaN(code) && code >= 100 && code < 600);
}
