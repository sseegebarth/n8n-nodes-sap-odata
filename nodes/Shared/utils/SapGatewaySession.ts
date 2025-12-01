/**
 * SAP Gateway Session Manager
 * Handles session persistence, CSRF tokens, and cookies for SAP Gateway
 */

import { createHash } from 'crypto';
import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { SAP_GATEWAY_SESSION_TIMEOUT, SAP_GATEWAY_CSRF_TIMEOUT } from '../constants';
import { Logger } from './Logger';

/**
 * SAP Gateway Session Data
 *
 * Contains all session-related information for a single SAP Gateway connection.
 * Sessions are isolated per workflow, host, service path, and user credentials.
 *
 * @interface ISapGatewaySession
 * @property {string} csrfToken - CSRF token for write operations (POST, PATCH, DELETE)
 * @property {string[]} cookies - Array of session cookies in "name=value" format
 * @property {string} [sapContextId] - SAP-ContextId for linking related operations
 * @property {string} [sessionId] - Unique session identifier
 * @property {number} lastActivity - Timestamp of last session activity (ms since epoch)
 * @property {number} expiresAt - Session expiration timestamp (ms since epoch)
 *
 */
export interface ISapGatewaySession {
	csrfToken: string;
	cookies: string[];
	sapContextId?: string;
	sessionId?: string;
	lastActivity: number;
	expiresAt: number;
}

/**
 * Session Configuration Options
 *
 * Configures session behavior including timeouts and feature enablement.
 * All options are optional and will use sensible defaults if not provided.
 *
 * @interface ISessionConfig
 * @property {number} [sessionTimeout] - Session timeout in milliseconds (default: 30 minutes)
 * @property {number} [csrfTimeout] - CSRF token timeout in milliseconds (default: 10 minutes)
 * @property {boolean} [persistCookies] - Enable cookie persistence across requests (default: true)
 * @property {boolean} [enableContextId] - Enable SAP-ContextId tracking (default: true)
 *
 */
export interface ISessionConfig {
	/** Session timeout in milliseconds (default: 30 minutes) */
	sessionTimeout?: number;
	/** CSRF token timeout in milliseconds (default: 10 minutes) */
	csrfTimeout?: number;
	/** Enable cookie persistence across requests */
	persistCookies?: boolean;
	/** Enable SAP-ContextId tracking */
	enableContextId?: boolean;
}

/**
 * SAP Gateway Session Manager
 *
 * Manages persistent sessions with SAP Gateway including:
 * - Cookie-based session persistence
 * - CSRF token caching with automatic refresh
 * - SAP-ContextId tracking for stateful operations
 * - Multi-tenant session isolation
 * - Automatic session expiration and cleanup
 *
 * Sessions are stored in n8n workflow static data and are isolated per:
 * - Workflow ID
 * - Host URL
 * - Service path
 * - User credentials
 *
 * This prevents session leakage between different workflows, SAP systems, and users.
 *
 * @class SapGatewaySessionManager
 *
 *
 */
export class SapGatewaySessionManager {
	private static readonly DEFAULT_SESSION_TIMEOUT = SAP_GATEWAY_SESSION_TIMEOUT;
	private static readonly DEFAULT_CSRF_TIMEOUT = SAP_GATEWAY_CSRF_TIMEOUT;

	/**
	 * Get session key for workflow isolation
	 *
	 * Generates a unique session key based on host, service path, and user credentials.
	 * This ensures sessions are properly isolated between different:
	 * - Workflows
	 * - SAP systems (hosts)
	 * - OData services (service paths)
	 * - Users (credential hashes)
	 *
	 * @private
	 * @static
	 * @param {IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions} context - n8n execution context
	 * @param {string} host - SAP Gateway host URL (e.g., "https://api.sap.com")
	 * @param {string} servicePath - OData service path (e.g., "/sap/opu/odata/sap/API_PRODUCT")
	 * @returns {string} Unique session key for storage in workflow static data
	 *
	 */
	private static async getSessionKey(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<string> {
		// Get credentials to include in key for multi-tenant isolation
		let credentialHash = '';
		try {
			const credentials = await context.getCredentials('sapOdataApi');
			if (credentials) {
				const username = (credentials.username as string) || '';
				// Use SHA-256 hash for secure credential isolation
				credentialHash = username
					? `-${createHash('sha256').update(username).digest('hex').substring(0, 16)}`
					: '';
			}
		} catch {
			// Credentials not available in this context
		}

		// Combine host, servicePath, and credential hash for unique key
		const normalizedHost = host.toLowerCase().replace(/\/$/, '');
		const normalizedPath = servicePath.toLowerCase().replace(/^\/|\/$/g, '');
		return `sap_session_${normalizedHost}_${normalizedPath}${credentialHash}`;
	}

	/**
	 * Get session from workflow static data
	 *
	 * Retrieves the current session for the given host and service path.
	 * Returns null if no session exists or if the session has expired.
	 * Automatically cleans up expired sessions when detected.
	 *
	 * @static
	 * @param {IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions} context - n8n execution context
	 * @param {string} host - SAP Gateway host URL
	 * @param {string} servicePath - OData service path
	 * @returns {Promise<ISapGatewaySession | null>} Session data or null if not found/expired
	 *
	 */
	static async getSession(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<ISapGatewaySession | null> {
		try {
			if (!('getWorkflowStaticData' in context)) {
				return null;
			}

			const staticData = context.getWorkflowStaticData('global');
			const sessionKey = await this.getSessionKey(context, host, servicePath);

			const session = staticData[sessionKey] as ISapGatewaySession | undefined;

			// Check if session exists and is not expired
			if (session && Date.now() < session.expiresAt) {
				Logger.debug('SAP Gateway session retrieved from cache', {
					module: 'SapGatewaySessionManager',
					hasToken: !!session.csrfToken,
					hasCookies: session.cookies.length > 0,
					hasContextId: !!session.sapContextId,
				});
				return session;
			}

			// Session expired or doesn't exist
			if (session) {
				Logger.debug('SAP Gateway session expired', {
					module: 'SapGatewaySessionManager',
					expiresAt: new Date(session.expiresAt).toISOString(),
					now: new Date().toISOString(),
				});
				// Clean up expired session
				delete staticData[sessionKey];
			}

			return null;
		} catch (error) {
			Logger.warn('Failed to retrieve SAP Gateway session', {
				module: 'SapGatewaySessionManager',
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/**
	 * Set session in workflow static data
	 */
	static async setSession(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
		session: Partial<ISapGatewaySession>,
		config: ISessionConfig = {},
	): Promise<void> {
		try {
			if (!('getWorkflowStaticData' in context)) {
				return;
			}

			const staticData = context.getWorkflowStaticData('global');
			const sessionKey = await this.getSessionKey(context, host, servicePath);

			// Get existing session or create new one
			const existingSession = staticData[sessionKey] as ISapGatewaySession | undefined;

			const sessionTimeout = config.sessionTimeout || this.DEFAULT_SESSION_TIMEOUT;
			const now = Date.now();

			// Merge with existing session
			const updatedSession: ISapGatewaySession = {
				csrfToken: session.csrfToken || existingSession?.csrfToken || '',
				cookies: session.cookies || existingSession?.cookies || [],
				sapContextId: session.sapContextId || existingSession?.sapContextId,
				sessionId: session.sessionId || existingSession?.sessionId,
				lastActivity: now,
				expiresAt: now + sessionTimeout,
			};

			staticData[sessionKey] = updatedSession;

			Logger.debug('SAP Gateway session updated', {
				module: 'SapGatewaySessionManager',
				hasToken: !!updatedSession.csrfToken,
				cookieCount: updatedSession.cookies.length,
				hasContextId: !!updatedSession.sapContextId,
				expiresAt: new Date(updatedSession.expiresAt).toISOString(),
			});
		} catch (error) {
			Logger.warn('Failed to set SAP Gateway session', {
				module: 'SapGatewaySessionManager',
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Get CSRF token from session
	 */
	static async getCsrfToken(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<string | null> {
		const session = await this.getSession(context, host, servicePath);
		if (!session) {
			return null;
		}

		// Check if CSRF token is still valid (10 minutes from last activity)
		const csrfTimeout = this.DEFAULT_CSRF_TIMEOUT;
		const tokenAge = Date.now() - session.lastActivity;

		if (tokenAge > csrfTimeout) {
			Logger.debug('CSRF token expired based on activity', {
				module: 'SapGatewaySessionManager',
				tokenAge: `${Math.floor(tokenAge / 1000)}s`,
				maxAge: `${Math.floor(csrfTimeout / 1000)}s`,
			});
			return null;
		}

		return session.csrfToken || null;
	}

	/**
	 * Update session with new CSRF token
	 */
	static async updateCsrfToken(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
		token: string,
	): Promise<void> {
		await this.setSession(context, host, servicePath, { csrfToken: token });
	}

	/**
	 * Get cookies from session for request header
	 */
	static async getCookieHeader(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<string | null> {
		const session = await this.getSession(context, host, servicePath);
		if (!session || session.cookies.length === 0) {
			return null;
		}

		// Join cookies with semicolon
		return session.cookies.join('; ');
	}

	/**
	 * Update session with cookies from response
	 */
	static async updateCookies(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
		setCookieHeaders: string | string[],
	): Promise<void> {
		const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

		// Parse cookies and extract name=value pairs
		const parsedCookies = cookies.map((cookie) => {
			// Extract the cookie name=value part (before first semicolon)
			const match = cookie.match(/^([^;]+)/);
			return match ? match[1].trim() : null;
		}).filter((c) => c !== null) as string[];

		if (parsedCookies.length > 0) {
			// Get existing session to merge cookies
			const existingSession = await this.getSession(context, host, servicePath);
			const existingCookies = existingSession?.cookies || [];

			// Merge cookies (new cookies override existing ones with same name)
			const cookieMap = new Map<string, string>();

			// Add existing cookies
			existingCookies.forEach((cookie) => {
				const [name] = cookie.split('=');
				if (name) {
					cookieMap.set(name, cookie);
				}
			});

			// Add/update with new cookies
			parsedCookies.forEach((cookie) => {
				const [name] = cookie.split('=');
				if (name) {
					cookieMap.set(name, cookie);
				}
			});

			// Update session with merged cookies
			await this.setSession(context, host, servicePath, {
				cookies: Array.from(cookieMap.values()),
			});

			Logger.debug('Session cookies updated', {
				module: 'SapGatewaySessionManager',
				cookieCount: cookieMap.size,
				newCookies: parsedCookies.length,
			});
		}
	}

	/**
	 * Update session with SAP-ContextId from response
	 */
	static async updateContextId(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
		contextId: string,
	): Promise<void> {
		await this.setSession(context, host, servicePath, { sapContextId: contextId });
		Logger.debug('SAP-ContextId updated', {
			module: 'SapGatewaySessionManager',
			contextId,
		});
	}

	/**
	 * Get SAP-ContextId from session
	 */
	static async getContextId(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<string | null> {
		const session = await this.getSession(context, host, servicePath);
		return session?.sapContextId || null;
	}

	/**
	 * Clear session (logout)
	 */
	static async clearSession(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
		host: string,
		servicePath: string,
	): Promise<void> {
		try {
			if (!('getWorkflowStaticData' in context)) {
				return;
			}

			const staticData = context.getWorkflowStaticData('global');
			const sessionKey = await this.getSessionKey(context, host, servicePath);

			delete staticData[sessionKey];

			Logger.debug('SAP Gateway session cleared', {
				module: 'SapGatewaySessionManager',
			});
		} catch (error) {
			Logger.warn('Failed to clear SAP Gateway session', {
				module: 'SapGatewaySessionManager',
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Clean up all expired sessions
	 */
	static cleanupExpiredSessions(
		context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	): void {
		try {
			if (!('getWorkflowStaticData' in context)) {
				return;
			}

			const staticData = context.getWorkflowStaticData('global');
			const now = Date.now();
			let cleanedCount = 0;

			// Find and delete all expired sessions
			Object.keys(staticData).forEach((key) => {
				if (key.startsWith('sap_session_')) {
					const session = staticData[key] as ISapGatewaySession | undefined;
					if (session && session.expiresAt < now) {
						delete staticData[key];
						cleanedCount++;
					}
				}
			});

			if (cleanedCount > 0) {
				Logger.debug('Expired SAP Gateway sessions cleaned up', {
					module: 'SapGatewaySessionManager',
					cleanedCount,
				});
			}
		} catch (error) {
			Logger.warn('Failed to cleanup expired sessions', {
				module: 'SapGatewaySessionManager',
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
