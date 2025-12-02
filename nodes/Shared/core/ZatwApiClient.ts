/**
 * ZATW API Client
 *
 * HTTP-based communication with SAP ZATW (Z ABAP Toolbox Wrapper) service.
 * Provides RFC/BAPI execution and IDoc operations without native dependencies.
 */

import {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import {
	ZATW_BASE_PATH,
	ZATW_ENDPOINTS,
	ZATW_TIMEOUT,
	ZATW_HEALTH_TIMEOUT,
	ZATW_CREDENTIAL_TYPE,
	ZATW_ERROR_MESSAGES,
	ZATW_HEADERS,
	MAX_RETRY_ATTEMPTS,
	INITIAL_RETRY_DELAY,
	MAX_RETRY_DELAY,
	RETRY_STATUS_CODES,
} from '../constants';
import {
	ISapConnectorCredentials,
	IZatwHealthResponse,
	IZatwFmMetadata,
	IZatwFmSearchResult,
	IZatwRfcRequest,
	IZatwRfcResponse,
	IZatwRfcBatchRequest,
	IZatwRfcBatchResponse,
	IZatwIdocRequest,
	IZatwIdocResponse,
	IZatwIdocStatusResponse,
	IZatwIdocTypeMetadata,
	IZatwError,
	IZatwApiResponse,
} from '../types/zatw';
import { Logger } from '../utils/Logger';
import { RetryHandler } from '../utils/RetryUtils';
import { sanitizeErrorMessage } from '../utils/SecurityUtils';

type ZatwContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

/**
 * ZATW API Client - HTTP-based SAP integration
 */
export class ZatwApiClient {
	// ============================================
	// Health Check
	// ============================================

	/**
	 * Check ZATW service health and connectivity
	 */
	static async healthCheck(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
	): Promise<IZatwHealthResponse> {
		const response = await this.makeRequest<IZatwHealthResponse>(
			context,
			credentials,
			'GET',
			ZATW_ENDPOINTS.HEALTH,
			undefined,
			{ timeout: ZATW_HEALTH_TIMEOUT },
		);

		if (!response.success || !response.data) {
			throw new NodeOperationError(
				context.getNode(),
				response.error?.message || ZATW_ERROR_MESSAGES.CONNECTION_FAILED,
				{
					description: 'Please verify that the ZATW service is installed and activated on your SAP system.',
				},
			);
		}

		return response.data;
	}

	// ============================================
	// Function Module Metadata
	// ============================================

	/**
	 * Search for function modules by pattern
	 */
	static async searchFunctions(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		pattern: string,
	): Promise<IZatwFmSearchResult[]> {
		const response = await this.makeRequest<IZatwFmSearchResult[]>(
			context,
			credentials,
			'GET',
			ZATW_ENDPOINTS.META,
			undefined,
			{
				qs: {
					action: 'search_fm',
					pattern: pattern || '*',
				},
			},
		);

		if (!response.success) {
			throw new NodeOperationError(
				context.getNode(),
				response.error?.message || 'Failed to search function modules',
			);
		}

		return response.data || [];
	}

	/**
	 * Get function module metadata (signature)
	 */
	static async getFunctionMetadata(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		functionName: string,
	): Promise<IZatwFmMetadata> {
		if (!functionName) {
			throw new NodeOperationError(
				context.getNode(),
				'Function name is required',
			);
		}

		const response = await this.makeRequest<IZatwFmMetadata>(
			context,
			credentials,
			'GET',
			ZATW_ENDPOINTS.META,
			undefined,
			{
				qs: {
					action: 'get_fm',
					name: functionName,
				},
			},
		);

		if (!response.success || !response.data) {
			throw new NodeOperationError(
				context.getNode(),
				response.error?.message || ZATW_ERROR_MESSAGES.FM_NOT_FOUND,
				{
					description: `Function module "${functionName}" not found or not RFC-enabled.`,
				},
			);
		}

		return response.data;
	}

	// ============================================
	// RFC Execution
	// ============================================

	/**
	 * Call a single RFC/BAPI function
	 */
	static async callFunction(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		request: IZatwRfcRequest,
	): Promise<IZatwRfcResponse> {
		if (!request.functionName) {
			throw new NodeOperationError(
				context.getNode(),
				'Function name is required',
			);
		}

		const response = await this.makeRequest<IZatwRfcResponse>(
			context,
			credentials,
			'POST',
			ZATW_ENDPOINTS.RFC,
			request,
		);

		if (!response.success) {
			const error = response.error;
			throw new NodeOperationError(
				context.getNode(),
				error?.message || ZATW_ERROR_MESSAGES.RFC_EXECUTION_FAILED,
				{
					description: error?.details || `Failed to execute function "${request.functionName}"`,
				},
			);
		}

		return response.data || {
			success: true,
			functionName: request.functionName,
		};
	}

	/**
	 * Call multiple RFC/BAPI functions in sequence (stateful)
	 */
	static async callMultipleFunctions(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		request: IZatwRfcBatchRequest,
	): Promise<IZatwRfcBatchResponse> {
		if (!request.functions || request.functions.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'At least one function is required',
			);
		}

		const response = await this.makeRequest<IZatwRfcBatchResponse>(
			context,
			credentials,
			'POST',
			`${ZATW_ENDPOINTS.RFC}/batch`,
			request,
		);

		if (!response.success) {
			const error = response.error;
			throw new NodeOperationError(
				context.getNode(),
				error?.message || 'Batch RFC execution failed',
				{
					description: error?.details,
				},
			);
		}

		return response.data || {
			success: true,
			results: [],
		};
	}

	// ============================================
	// IDoc Operations
	// ============================================

	/**
	 * Send an IDoc to SAP
	 */
	static async sendIdoc(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		request: IZatwIdocRequest,
	): Promise<IZatwIdocResponse> {
		if (!request.controlRecord?.idoctyp) {
			throw new NodeOperationError(
				context.getNode(),
				'IDoc type is required',
			);
		}

		const response = await this.makeRequest<IZatwIdocResponse>(
			context,
			credentials,
			'POST',
			ZATW_ENDPOINTS.IDOC,
			request,
		);

		if (!response.success) {
			const error = response.error;
			throw new NodeOperationError(
				context.getNode(),
				error?.message || ZATW_ERROR_MESSAGES.IDOC_SEND_FAILED,
				{
					description: error?.details,
				},
			);
		}

		return response.data || {
			success: false,
			idocNumber: '',
			status: '',
			statusText: 'Unknown response',
		};
	}

	/**
	 * Get IDoc status
	 */
	static async getIdocStatus(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		idocNumber: string,
	): Promise<IZatwIdocStatusResponse> {
		if (!idocNumber) {
			throw new NodeOperationError(
				context.getNode(),
				'IDoc number is required',
			);
		}

		const response = await this.makeRequest<IZatwIdocStatusResponse>(
			context,
			credentials,
			'GET',
			ZATW_ENDPOINTS.IDOC_STATUS,
			undefined,
			{
				qs: { docnum: idocNumber },
			},
		);

		if (!response.success || !response.data) {
			throw new NodeOperationError(
				context.getNode(),
				response.error?.message || 'Failed to get IDoc status',
			);
		}

		return response.data;
	}

	/**
	 * Search for IDoc types
	 */
	static async searchIdocTypes(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		pattern: string,
	): Promise<IZatwIdocTypeMetadata[]> {
		const response = await this.makeRequest<IZatwIdocTypeMetadata[]>(
			context,
			credentials,
			'GET',
			ZATW_ENDPOINTS.META,
			undefined,
			{
				qs: {
					action: 'search_idoc',
					pattern: pattern || '*',
				},
			},
		);

		if (!response.success) {
			throw new NodeOperationError(
				context.getNode(),
				response.error?.message || 'Failed to search IDoc types',
			);
		}

		return response.data || [];
	}

	/**
	 * Get IDoc type metadata
	 */
	static async getIdocTypeMetadata(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		idocType: string,
	): Promise<IZatwIdocTypeMetadata> {
		if (!idocType) {
			throw new NodeOperationError(
				context.getNode(),
				'IDoc type is required',
			);
		}

		const response = await this.makeRequest<IZatwIdocTypeMetadata>(
			context,
			credentials,
			'GET',
			ZATW_ENDPOINTS.META,
			undefined,
			{
				qs: {
					action: 'get_idoc',
					name: idocType,
				},
			},
		);

		if (!response.success || !response.data) {
			throw new NodeOperationError(
				context.getNode(),
				response.error?.message || ZATW_ERROR_MESSAGES.IDOC_TYPE_NOT_FOUND,
				{
					description: `IDoc type "${idocType}" not found.`,
				},
			);
		}

		return response.data;
	}

	// ============================================
	// Private HTTP Methods
	// ============================================

	/**
	 * Make HTTP request to ZATW service
	 */
	private static async makeRequest<T>(
		context: ZatwContext,
		credentials: ISapConnectorCredentials,
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		endpoint: string,
		body?: IDataObject | IZatwRfcRequest | IZatwRfcBatchRequest | IZatwIdocRequest,
		options?: {
			timeout?: number;
			qs?: IDataObject;
		},
	): Promise<IZatwApiResponse<T>> {
		const host = credentials.host.replace(/\/$/, '');
		const url = `${host}${ZATW_BASE_PATH}${endpoint}`;

		// Build request headers
		const headers: Record<string, string> = {
			[ZATW_HEADERS.CONTENT_TYPE]: 'application/json',
			[ZATW_HEADERS.ACCEPT]: 'application/json',
			[ZATW_HEADERS.SAP_CLIENT]: credentials.client,
			[ZATW_HEADERS.SAP_LANGUAGE]: credentials.language || 'EN',
		};

		// Build base request options
		const requestOptions: IHttpRequestOptions = {
			method,
			url,
			headers,
			timeout: options?.timeout || ZATW_TIMEOUT,
		};

		// Add query parameters
		if (options?.qs) {
			requestOptions.qs = options.qs;
		}

		// Add body for POST/PUT
		if (body && (method === 'POST' || method === 'PUT')) {
			requestOptions.body = body;
			requestOptions.json = true;
		}

		// Handle SSL certificate validation
		if (credentials.allowUnauthorizedCerts) {
			requestOptions.skipSslCertificateValidation = true;
			Logger.warn('SSL certificate validation disabled - use only in development!', {
				module: 'ZatwApiClient',
			});
		}

		// Create retry handler
		const retryHandler = new RetryHandler({
			maxAttempts: MAX_RETRY_ATTEMPTS,
			initialDelay: INITIAL_RETRY_DELAY,
			maxDelay: MAX_RETRY_DELAY,
			backoffFactor: 2,
			retryableStatusCodes: RETRY_STATUS_CODES,
			retryNetworkErrors: true,
			onRetry: (attempt, error, delay) => {
				Logger.info('Retrying ZATW request', {
					module: 'ZatwApiClient',
					attempt,
					maxAttempts: MAX_RETRY_ATTEMPTS,
					delay: `${delay}ms`,
					error: error instanceof Error ? error.message : 'Unknown error',
					endpoint,
				});
			},
		});

		// Execute request with retry
		const executeRequest = async (): Promise<IZatwApiResponse<T>> => {
			try {
				Logger.debug('ZATW API Request', {
					module: 'ZatwApiClient',
					method,
					url,
					endpoint,
				});

				const startTime = Date.now();
				const response = await context.helpers.httpRequestWithAuthentication.call(
					context,
					ZATW_CREDENTIAL_TYPE,
					requestOptions,
				);
				const duration = Date.now() - startTime;

				Logger.debug('ZATW API Response', {
					module: 'ZatwApiClient',
					duration: `${duration}ms`,
					endpoint,
				});

				// Parse response - ZATW returns wrapped response
				if (typeof response === 'object' && response !== null) {
					// Check if it's already in our expected format
					if ('success' in response) {
						return response as IZatwApiResponse<T>;
					}
					// Wrap raw response
					return {
						success: true,
						data: response as T,
						timestamp: new Date().toISOString(),
					};
				}

				// Try to parse string response
				if (typeof response === 'string') {
					try {
						const parsed = JSON.parse(response);
						if ('success' in parsed) {
							return parsed as IZatwApiResponse<T>;
						}
						return {
							success: true,
							data: parsed as T,
							timestamp: new Date().toISOString(),
						};
					} catch {
						// Not JSON, return as-is
						return {
							success: true,
							data: response as unknown as T,
							timestamp: new Date().toISOString(),
						};
					}
				}

				return {
					success: true,
					data: response as T,
					timestamp: new Date().toISOString(),
				};
			} catch (error) {
				const errorResponse = this.handleError(error, endpoint);
				return {
					success: false,
					error: errorResponse,
					timestamp: new Date().toISOString(),
				};
			}
		};

		return retryHandler.execute(executeRequest);
	}

	/**
	 * Handle and normalize errors
	 */
	private static handleError(error: unknown, endpoint: string): IZatwError {
		const httpError = error as {
			message?: string;
			response?: {
				statusCode?: number;
				body?: {
					error?: IZatwError;
					message?: string;
				};
			};
			statusCode?: number;
		};

		// Extract status code
		const statusCode = httpError?.response?.statusCode || httpError?.statusCode;

		// Map status codes to error types
		if (statusCode === 401 || statusCode === 403) {
			return {
				code: 'ZATW002',
				message: ZATW_ERROR_MESSAGES.AUTH_FAILED,
				details: 'Check your username and password in the credentials.',
			};
		}

		if (statusCode === 404) {
			return {
				code: 'ZATW001',
				message: ZATW_ERROR_MESSAGES.ZATW_NOT_INSTALLED,
				details: `Endpoint ${endpoint} not found. Ensure ZATW ABAP package is installed.`,
			};
		}

		if (statusCode === 500) {
			// Try to get error from response body
			const bodyError = httpError?.response?.body?.error;
			if (bodyError) {
				return bodyError;
			}
		}

		// Extract error message
		const message = httpError?.response?.body?.message
			|| httpError?.message
			|| 'Unknown error occurred';

		return {
			code: 'ZATW999',
			message: sanitizeErrorMessage(message),
			details: `Endpoint: ${endpoint}, Status: ${statusCode || 'unknown'}`,
		};
	}
}
