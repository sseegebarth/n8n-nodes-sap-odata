/**
 * SAP Gateway Compatibility Utility
 * Provides enhanced compatibility with SAP Gateway including session management,
 * message parsing, and SAP-specific HTTP headers
 */

import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { Logger } from './Logger';
import { SapGatewaySessionManager } from './SapGatewaySession';
import { SapMessageParser, ISapMessage } from './SapMessageParser';

/**
 * SAP Gateway Request Options
 */
export interface ISapGatewayRequestOptions {
	/** Enable session persistence */
	enableSession?: boolean;
	/** Enable SAP-ContextId tracking */
	enableContextId?: boolean;
	/** Enable message parsing */
	enableMessageParsing?: boolean;
	/** Prefer representation for response handling */
	preferRepresentation?: 'minimal' | 'representation';
	/** Enable batch mode headers */
	batchMode?: boolean;
}

/**
 * SAP Gateway Response
 */
export interface ISapGatewayResponse {
	/** Response body */
	body: unknown;
	/** HTTP status code */
	statusCode: number;
	/** Response headers */
	headers: IDataObject;
	/** Parsed SAP messages */
	messages?: ISapMessage[];
	/** SAP-ContextId */
	contextId?: string;
	/** CSRF token from response */
	csrfToken?: string;
}

/**
 * SAP Gateway Compatibility Utility
 */
export class SapGatewayCompat {
	/**
	 * Enhance request options with SAP Gateway-specific headers
	 */
	static async enhanceRequestOptions(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		requestOptions: IHttpRequestOptions,
		host: string,
		servicePath: string,
		gatewayOptions: ISapGatewayRequestOptions = {},
	): Promise<IHttpRequestOptions> {
		const {
			enableSession = true,
			enableContextId = true,
			enableMessageParsing = true,
			preferRepresentation = 'representation',
			batchMode = false,
		} = gatewayOptions;

		const enhancedOptions = { ...requestOptions };
		const headers = { ...(requestOptions.headers || {}) };

		// Add session cookies if enabled
		if (enableSession) {
			const cookieHeader = await SapGatewaySessionManager.getCookieHeader(context, host, servicePath);
			if (cookieHeader) {
				headers['Cookie'] = cookieHeader;
				Logger.debug('Added session cookies to request', {
					module: 'SapGatewayCompat',
					cookieCount: cookieHeader.split(';').length,
				});
			}
		}

		// Add SAP-ContextId if available and enabled
		if (enableContextId) {
			const contextId = await SapGatewaySessionManager.getContextId(context, host, servicePath);
			if (contextId) {
				headers['SAP-ContextId'] = contextId;
				Logger.debug('Added SAP-ContextId to request', {
					module: 'SapGatewayCompat',
					contextId,
				});
			}
		}

		// Add Prefer header for better response handling
		// This tells SAP Gateway what kind of response we want
		if (!batchMode) {
			if (preferRepresentation === 'minimal') {
				// Minimal representation - only returns status, useful for DELETE
				headers['Prefer'] = 'return=minimal';
			} else {
				// Full representation - returns the created/updated entity
				headers['Prefer'] = 'return=representation';
			}
		}

		// Enable SAP message parsing
		// This requests SAP Gateway to include detailed messages in response
		if (enableMessageParsing) {
			headers['sap-message-scope'] = 'BusinessObject';
		}

		// Add DataServiceVersion headers
		// These headers help SAP Gateway understand the OData version we're using
		if (!headers['DataServiceVersion']) {
			headers['DataServiceVersion'] = '2.0';
		}
		if (!headers['MaxDataServiceVersion']) {
			headers['MaxDataServiceVersion'] = '2.0';
		}

		enhancedOptions.headers = headers;

		// Enable full response to capture headers
		enhancedOptions.returnFullResponse = true;

		Logger.debug('Request options enhanced with SAP Gateway compatibility', {
			module: 'SapGatewayCompat',
			enableSession,
			enableContextId,
			enableMessageParsing,
			preferRepresentation,
		});

		return enhancedOptions;
	}

	/**
	 * Get header value case-insensitively
	 * HTTP headers are case-insensitive, but libraries may store them in different cases
	 */
	private static getHeader(headers: IDataObject, name: string): unknown {
		const lowerName = name.toLowerCase();
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === lowerName) {
				return value;
			}
		}
		return undefined;
	}

	/**
	 * Process response and extract SAP Gateway-specific information
	 */
	static async processResponse(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		response: unknown,
		host: string,
		servicePath: string,
		gatewayOptions: ISapGatewayRequestOptions = {},
	): Promise<ISapGatewayResponse> {
		const { enableSession = true, enableContextId = true, enableMessageParsing = true } = gatewayOptions;

		// Handle full response format
		let body: unknown;
		let statusCode = 200;
		let headers: IDataObject = {};

		if (response && typeof response === 'object' && 'body' in response) {
			const fullResponse = response as {
				body: unknown;
				statusCode: number;
				headers: IDataObject;
			};
			body = fullResponse.body;
			statusCode = fullResponse.statusCode;
			headers = fullResponse.headers || {};
		} else {
			body = response;
		}

		Logger.debug('Processing response', {
			module: 'SapGatewayCompat',
			statusCode,
			hasHeaders: Object.keys(headers).length > 0,
			headerKeys: Object.keys(headers),
		});

		const result: ISapGatewayResponse = {
			body,
			statusCode,
			headers,
		};

		// Update session with cookies if enabled (case-insensitive header lookup)
		const setCookie = this.getHeader(headers, 'set-cookie');
		if (enableSession && setCookie) {
			await SapGatewaySessionManager.updateCookies(
				context,
				host,
				servicePath,
				setCookie as string | string[],
			);
			Logger.debug('Session cookies extracted', {
				module: 'SapGatewayCompat',
				cookieCount: Array.isArray(setCookie) ? setCookie.length : 1,
			});
		}

		// Extract and store SAP-ContextId if enabled (case-insensitive)
		const contextIdHeader = this.getHeader(headers, 'sap-contextid');
		if (enableContextId && contextIdHeader) {
			const contextId = String(contextIdHeader);
			result.contextId = contextId;
			await SapGatewaySessionManager.updateContextId(context, host, servicePath, contextId);
		}

		// Extract CSRF token if present (case-insensitive)
		const csrfTokenHeader = this.getHeader(headers, 'x-csrf-token');
		if (csrfTokenHeader) {
			const csrfToken = String(csrfTokenHeader);
			Logger.debug('CSRF token header found', {
				module: 'SapGatewayCompat',
				tokenValue: csrfToken.substring(0, 10) + '...',
				isRequired: csrfToken === 'Required',
				isFetch: csrfToken === 'Fetch',
			});
			// Only update if it's not the "Required" message
			if (csrfToken && csrfToken !== 'Required' && csrfToken !== 'Fetch') {
				result.csrfToken = csrfToken;
				await SapGatewaySessionManager.updateCsrfToken(context, host, servicePath, csrfToken);
				Logger.debug('CSRF token extracted from response', {
					module: 'SapGatewayCompat',
					tokenLength: csrfToken.length,
				});
			}
		}

		// Parse SAP messages if enabled
		if (enableMessageParsing) {
			const messages = SapMessageParser.extractAllMessages(headers, body);
			if (messages.length > 0) {
				result.messages = messages;
				Logger.debug('SAP messages extracted from response', {
					module: 'SapGatewayCompat',
					messageCount: messages.length,
					errorCount: messages.filter((m) => m.severity === 'error').length,
					warningCount: messages.filter((m) => m.severity === 'warning').length,
				});
			}
		}

		return result;
	}

	/**
	 * Fetch CSRF token with enhanced session management
	 */
	static async fetchCsrfToken(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
		requestBuilder: (host: string, servicePath: string) => IHttpRequestOptions,
	): Promise<string> {
		// Try to get token from session first
		const cachedToken = await SapGatewaySessionManager.getCsrfToken(context, host, servicePath);
		if (cachedToken) {
			Logger.debug('Using cached CSRF token from session', {
				module: 'SapGatewayCompat',
			});
			return cachedToken;
		}

		// Fetch new token
		Logger.debug('Fetching new CSRF token', {
			module: 'SapGatewayCompat',
			host,
			servicePath,
		});

		try {
			// Build request options
			const requestOptions = requestBuilder(host, servicePath);

			// Enhance with session support
			const enhancedOptions = await this.enhanceRequestOptions(
				context,
				requestOptions,
				host,
				servicePath,
				{
					enableSession: true,
					enableContextId: true,
					enableMessageParsing: false, // Not needed for CSRF fetch
				},
			);

			// Get credentials for authentication
			const credentials = await context.getCredentials('sapOdataApi');

			// Build auth object for Basic Auth
			const auth = credentials?.authentication === 'basicAuth' && credentials?.username && credentials?.password
				? { username: credentials.username as string, password: credentials.password as string }
				: undefined;

			Logger.debug('CSRF token request details', {
				module: 'SapGatewayCompat',
				url: enhancedOptions.url,
				hasAuth: !!auth,
				headers: Object.keys(enhancedOptions.headers || {}),
			});

			// Use helpers.request directly (same as ApiClient) to ensure consistent behavior
			// httpRequestWithAuthentication may not return headers properly
			const response = await context.helpers.request({
				...enhancedOptions,
				auth,
				resolveWithFullResponse: true, // Get full response with headers
			} as any);

			Logger.debug('CSRF token response received', {
				module: 'SapGatewayCompat',
				hasHeaders: !!response?.headers,
				statusCode: response?.statusCode,
			});

			// Process response to extract token and session data
			const processedResponse = await this.processResponse(
				context,
				response,
				host,
				servicePath,
				{
					enableSession: true,
					enableContextId: true,
					enableMessageParsing: false,
				},
			);

			if (processedResponse.csrfToken) {
				Logger.debug('CSRF token extracted successfully', {
					module: 'SapGatewayCompat',
					tokenLength: processedResponse.csrfToken.length,
				});
				return processedResponse.csrfToken;
			}

			// Fallback: try to extract from headers directly
			if (processedResponse.headers['x-csrf-token']) {
				const token = String(processedResponse.headers['x-csrf-token']);
				if (token && token !== 'Required' && token !== 'Fetch') {
					await SapGatewaySessionManager.updateCsrfToken(context, host, servicePath, token);
					Logger.debug('CSRF token extracted from headers fallback', {
						module: 'SapGatewayCompat',
						tokenLength: token.length,
					});
					return token;
				}
			}

			Logger.warn('CSRF token not found in response', {
				module: 'SapGatewayCompat',
				responseHeaders: Object.keys(processedResponse.headers),
			});

			return '';
		} catch (error) {
			Logger.warn('Failed to fetch CSRF token', {
				module: 'SapGatewayCompat',
				error: error instanceof Error ? error.message : String(error),
			});
			return '';
		}
	}

	/**
	 * Clear session (useful for testing or explicit logout)
	 */
	static clearSession(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): void {
		SapGatewaySessionManager.clearSession(context, host, servicePath);
		Logger.info('SAP Gateway session cleared', {
			module: 'SapGatewayCompat',
			host,
			servicePath,
		});
	}

	/**
	 * Get current session status
	 */
	static async getSessionStatus(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<{
		hasSession: boolean;
		hasCsrfToken: boolean;
		hasContextId: boolean;
		cookieCount: number;
		expiresAt?: string;
	}> {
		const session = await SapGatewaySessionManager.getSession(context, host, servicePath);

		if (!session) {
			return {
				hasSession: false,
				hasCsrfToken: false,
				hasContextId: false,
				cookieCount: 0,
			};
		}

		return {
			hasSession: true,
			hasCsrfToken: !!session.csrfToken,
			hasContextId: !!session.sapContextId,
			cookieCount: session.cookies.length,
			expiresAt: new Date(session.expiresAt).toISOString(),
		};
	}

	/**
	 * Format error messages from SAP Gateway response
	 */
	static formatErrorMessage(
		messages: ISapMessage[] | undefined,
		fallbackMessage: string,
	): string {
		if (!messages || messages.length === 0) {
			return fallbackMessage;
		}

		// Get primary error message
		const errorMessages = messages.filter((m) => m.severity === 'error' || m.severity === 'abort');

		if (errorMessages.length > 0) {
			const formatted = SapMessageParser.formatMessages(errorMessages);
			const primaryMessage = errorMessages[0];
			const description = SapMessageParser.getErrorDescription(primaryMessage);

			return `${formatted}\n\nDescription: ${description}`;
		}

		// If no errors, show all messages
		return SapMessageParser.formatMessages(messages);
	}
}
