/**
 * ApiClient - SAP OData API Request Handler
 * Handles API requests with retry logic, throttling, and connection pooling
 */

import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	NodeOperationError,
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
import { ConnectionPoolManager } from '../utils/ConnectionPoolManager';
import { ODataErrorHandler } from '../utils/ErrorHandler';
import { Logger } from '../utils/Logger';
import { RetryHandler } from '../utils/RetryUtils';
import { ThrottleManager, ThrottleStrategy } from '../utils/ThrottleManager';
import { getOAuthToken } from '../utils/OAuthTokenManager';
import { buildRequestOptions, parsePoolConfig } from './RequestBuilder';

/**
 * Get or create throttle manager scoped to workflow execution
 * This prevents throttling interference between different workflows
 */
function getThrottleManager(
	context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	config: {
		maxRequestsPerSecond: number;
		strategy: ThrottleStrategy;
		burstSize: number;
		onThrottle?: (waitTime: number) => void;
	},
): ThrottleManager {
	// Scope throttle manager to workflow static data to prevent cross-workflow interference
	if ('getWorkflowStaticData' in context) {
		const staticData = context.getWorkflowStaticData('global');
		const key = '_sapOdataThrottleManager';

		if (!staticData[key]) {
			staticData[key] = new ThrottleManager(config);
		}
		return staticData[key] as ThrottleManager;
	}

	// Fallback for contexts without workflow static data (e.g., credential testing)
	// Use a module-level cache with workflow ID as key
	return new ThrottleManager(config);
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
): Promise<any> {
	const { method, resource, body = {}, qs = {}, uri, option = {}, csrfToken } = config;

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

	// Security warning for disabled SSL validation (only once per execution)
	if (credentials.allowUnauthorizedCerts === true) {
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

	// Initialize throttling if enabled (scoped to workflow execution)
	const throttleEnabled = advancedOptions.throttleEnabled === true;
	let throttleManager: ThrottleManager | null = null;

	if (throttleEnabled) {
		throttleManager = getThrottleManager(this, {
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

		Logger.debug('ThrottleManager retrieved/initialized', {
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

	// Parse pool configuration
	const poolConfig = parsePoolConfig(advancedOptions);

	// Create request function that will be executed with or without retry
	const makeRequest = async () => {
		// Fetch OAuth token if using OAuth 2.0 authentication
		let oauthToken: string | undefined;
		if (credentials.authentication === 'oauth2ClientCredentials') {
			if (!credentials.oauthTokenUrl || !credentials.oauthClientId || !credentials.oauthClientSecret) {
				throw new NodeOperationError(
					this.getNode(),
					'OAuth 2.0 configuration incomplete',
					{
						description: 'Token URL, Client ID, and Client Secret are required for OAuth 2.0 authentication.',
					},
				);
			}

			try {
				const token = await getOAuthToken(this, {
					tokenUrl: credentials.oauthTokenUrl,
					clientId: credentials.oauthClientId,
					clientSecret: credentials.oauthClientSecret,
					scope: credentials.oauthScope,
					allowUnauthorizedCerts: credentials.allowUnauthorizedCerts,
				});
				oauthToken = token.accessToken;

				Logger.debug('OAuth token acquired', {
					module: 'ApiClient',
					expiresIn: token.expiresIn,
					tokenType: token.tokenType,
				});
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					'Failed to acquire OAuth token',
					{
						description: error instanceof Error ? error.message : 'Unknown OAuth error',
					},
				);
			}
		}

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
			oauthToken,
			poolConfig,
			node: this.getNode(),
		});

		// Debug logging
		const debugLogging = advancedOptions.debugLogging === true;
		Logger.setDebugMode(debugLogging);
		const startTime = debugLogging ? Date.now() : 0;

		if (debugLogging) {
			Logger.logRequest(method, requestOptions.url);
			Logger.debug('Request headers', {
				module: 'ApiClient',
				headers: {
					...requestOptions.headers,
					Authorization: requestOptions.headers?.Authorization ? '*****' : undefined,
				},
			});
		}

		try {
			// Build auth object for Basic Auth (helpers.request format)
			const auth = credentials.authentication === 'basicAuth' && credentials.username && credentials.password
				? { username: credentials.username, password: credentials.password }
				: undefined;

			// Use helpers.request directly to avoid URL re-encoding
			// httpRequestWithAuthentication re-encodes URLs, turning $ into %24
			// which breaks OData query parameters like $filter, $search, $top
			const response = await this.helpers.request({
				...requestOptions,
				auth,
			} as any);

			if (debugLogging) {
				const duration = Date.now() - startTime;
				Logger.debug('Response received', {
					module: 'ApiClient',
					duration: `${duration}ms`,
					responseType: typeof response,
				});

				// Log connection pool stats
				const poolManager = ConnectionPoolManager.getInstance();
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

			// Check if 404 error - invalidate metadata cache to allow retry with fresh data
			const statusCode = (error as any)?.response?.statusCode || (error as any)?.statusCode;
			if (statusCode === 404) {
				Logger.debug('404 error detected - invalidating metadata cache', {
					module: 'ApiClient',
					resource,
				});
				await CacheManager.invalidateCacheOn404(this, credentials.host, servicePath);
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
		onRetry: (attempt, error, delay) => {
			Logger.info('Retrying request', {
				module: 'RetryHandler',
				attempt,
				maxAttempts: MAX_RETRY_ATTEMPTS,
				delay: `${delay}ms`,
				error: error instanceof Error ? error.message : 'Unknown error',
				method,
				resource,
			});
		},
	});

	return retryHandler.execute(makeRequest);
}

/**
 * Reset the throttle manager (useful for testing or workflow restarts)
 * Note: ThrottleManager is now scoped to workflow static data
 * This function is deprecated and kept for backward compatibility
 * @deprecated ThrottleManager is now workflow-scoped, no manual reset needed
 */
export function resetThrottleManager(): void {
	// No-op: ThrottleManager is now managed in workflow static data
	// Each workflow has its own instance that persists with the workflow
}
