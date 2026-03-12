/**
 * ApiClient - SAP OData API Request Handler
 * Handles API requests with retry logic and throttling
 */

import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { resolveServicePath } from '../../nodes/SapOData/GenericFunctions';
import {
	CREDENTIAL_TYPE,
	ERROR_MESSAGES,
	MAX_RETRY_ATTEMPTS,
	INITIAL_RETRY_DELAY,
	MAX_RETRY_DELAY,
	RETRY_STATUS_CODES,
} from '../constants';
import { ISapOdataCredentials } from '../types';
import { CacheManager } from '../utils/CacheManager';
import { ODataErrorHandler } from '../utils/ErrorHandler';
import { RetryHandler } from '../utils/RetryUtils';
import { SapGatewayCompat } from '../utils/SapGatewayCompat';
import { SapGatewaySessionManager } from '../utils/SapGatewaySession';
import { buildCsrfTokenRequest, buildRequestOptions } from './RequestBuilder';

const lastRequestTime = new Map<string, number>();

async function throttleRequest(nodeKey: string, minIntervalMs: number): Promise<void> {
	const last = lastRequestTime.get(nodeKey) || 0;
	const elapsed = Date.now() - last;
	if (elapsed < minIntervalMs) {
		// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
		await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
	}
	lastRequestTime.set(nodeKey, Date.now());
}

/**
 * Configuration for API client
 */
export interface IApiClientConfig {
	method: string;
	resource: string;
	body?: IDataObject;
	qs?: IDataObject;
	uri?: string;
	option?: IDataObject;
	csrfToken?: string;
	servicePath?: string;
}

/**
 * Make an API request to SAP OData service with automatic retry and throttling
 *
 * @param context - n8n execution context
 * @param config - API request configuration
 * @returns API response data
 *
 * @example
 * const response = await executeRequest.call(this, {
 *   method: 'GET',
 *   resource: 'ProductSet',
 *   qs: { $top: 10 }
 * });
 */
export async function executeRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	config: IApiClientConfig,
): Promise<IDataObject> {
	const { method, resource, body = {}, qs = {}, uri, option = {} } = config;
	let { csrfToken } = config;

	// Get credentials
	const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;

	if (!credentials) {
		return ODataErrorHandler.handleValidationError(
			ERROR_MESSAGES.NO_CREDENTIALS,
			this.getNode(),
		);
	}

	const host = credentials.host.replace(/\/$/, '');

	// Use explicit service path from config (if provided), otherwise resolve from context
	// This ensures DiscoveryService and other helpers can override the service path
	const servicePath = config.servicePath || resolveServicePath(this);

	// Get advanced options if available
	let advancedOptions: IDataObject = {};
	if ('getNodeParameter' in this) {
		try {
			advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IDataObject;
		} catch {
			// Not all contexts have access to node parameters
			advancedOptions = {};
		}
	}

	// Apply throttling if enabled
	if (advancedOptions.throttleEnabled === true) {
		const maxRps = (advancedOptions.maxRequestsPerSecond as number) || 10;
		const minIntervalMs = Math.ceil(1000 / maxRps);
		const node = this.getNode();
		await throttleRequest(`${node.type}_${node.id}`, minIntervalMs);
	}

	let csrfRetried = false;

	// Create request function that will be executed with or without retry
	const makeRequest = async (): Promise<IDataObject> => {
		// Build request options
		const requestOptions = buildRequestOptions({
			method,
			resource,
			host,
			servicePath,
			body,
			qs,
			uri,
			options: option,
			credentials,
			csrfToken,
			node: this.getNode(),
		});

		// Debug logging removed

		try {
			// Build auth object for Basic Auth (helpers.request format)
			const auth = credentials.authentication === 'basicAuth' && credentials.username && credentials.password
				? { username: credentials.username, password: credentials.password }
				: undefined;

			// Get session cookies for write operations
			// This ensures the CSRF token matches the session
			let cookieHeader: string | null = null;
			if (method !== 'GET') {
				cookieHeader = await SapGatewaySessionManager.getCookieHeader(this, host, servicePath);
				if (cookieHeader) {
					requestOptions.headers = {
						...requestOptions.headers,
						Cookie: cookieHeader,
					};
				}
			}

			// Use helpers.request directly to avoid URL re-encoding
			// httpRequest re-encodes URLs, turning $ into %24
			// which breaks OData query parameters like $filter, $search, $top
			// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
			const response = await this.helpers.request({
				...requestOptions,
				auth,
			} as IHttpRequestOptions);

			return response;
		} catch (error: unknown) {
			const err = error as Record<string, unknown>;
			const statusCode = (err?.statusCode || (err?.response as Record<string, unknown>)?.statusCode || err?.httpCode) as number | undefined;

			// Invalidate metadata cache on 404
			if (statusCode === 404) {
				await CacheManager.invalidateCacheOn404(this, credentials.host, servicePath);
			}

			// CSRF token expired — clear session, refetch token, retry once
			if (statusCode === 403 && method !== 'GET' && csrfToken && !csrfRetried) {
				csrfRetried = true;
				await SapGatewayCompat.clearSession(this, host, servicePath);
				const freshToken = await SapGatewayCompat.fetchCsrfToken(
					this, host, servicePath,
					(h, sp) => buildCsrfTokenRequest(h, sp, credentials, this.getNode()),
				);
				if (freshToken) {
					csrfToken = freshToken;
					return makeRequest();
				}
			}

			// Let RetryHandler handle retryable errors directly
			if (statusCode && [429, 502, 503, 504].includes(statusCode)) {
				throw error;
			}

			return ODataErrorHandler.handleApiError(error, this.getNode(), {
				operation: method,
				resource,
			});
		}
	};

	// Apply retry logic (always enabled with fixed defaults)
	const retryHandler = new RetryHandler({
		maxAttempts: MAX_RETRY_ATTEMPTS,
		initialDelay: INITIAL_RETRY_DELAY,
		maxDelay: MAX_RETRY_DELAY,
		backoffFactor: 2,
		retryableStatusCodes: RETRY_STATUS_CODES,
		retryNetworkErrors: true,
	});

	return retryHandler.execute(makeRequest);
}

