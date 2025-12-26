/**
 * OAuthTokenManager - OAuth 2.0 Token Management
 * Handles token fetching, caching, and automatic refresh for SAP Cloud authentication
 */

import { ICredentialTestFunctions, IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { Logger } from './Logger';

/**
 * OAuth token response structure
 */
export interface IOAuthToken {
	accessToken: string;
	tokenType: string;
	expiresIn: number;
	expiresAt: number;  // Timestamp when token expires
	scope?: string;
}

/**
 * OAuth credentials structure
 * Field names are simplified since values are extracted from full credential names
 */
export interface IOAuthCredentials {
	tokenUrl: string;
	clientId: string;
	clientSecret: string;
	scope?: string;
	allowUnauthorizedCerts?: boolean;
}

/**
 * Token cache entry
 */
interface ITokenCacheEntry {
	token: IOAuthToken;
	cacheKey: string;
}

/**
 * Token cache - stores tokens per client ID to support multiple credentials
 */
const tokenCache = new Map<string, ITokenCacheEntry>();

/**
 * Safety margin before token expiration (5 minutes)
 * Refresh token if it expires within this time
 */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Generate cache key for token storage
 */
function generateCacheKey(credentials: IOAuthCredentials): string {
	// Use client ID + token URL as unique identifier
	return `${credentials.clientId}|${credentials.tokenUrl}`;
}

/**
 * Check if token is still valid (not expired)
 */
function isTokenValid(token: IOAuthToken): boolean {
	const now = Date.now();
	const expiresAt = token.expiresAt - TOKEN_REFRESH_MARGIN_MS;
	return now < expiresAt;
}

/**
 * Fetch new OAuth token using Client Credentials flow
 */
async function fetchToken(
	context: ICredentialTestFunctions | IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	credentials: IOAuthCredentials,
): Promise<IOAuthToken> {
	const { tokenUrl, clientId, clientSecret, scope, allowUnauthorizedCerts } = credentials;

	Logger.debug('Fetching new OAuth token', {
		module: 'OAuthTokenManager',
		tokenUrl,
		clientId: clientId.substring(0, 10) + '...',
		hasScope: !!scope,
	});

	// Build form data for token request
	const formData: Record<string, string> = {
		grant_type: 'client_credentials',
	};

	if (scope) {
		formData.scope = scope;
	}

	try {
		// Use type assertion for request options to support all context types
		const requestOptions = {
			method: 'POST',
			url: tokenUrl,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json',
			},
			auth: {
				username: clientId,
				password: clientSecret,
			},
			form: formData,
			json: true,
			skipSslCertificateValidation: allowUnauthorizedCerts === true,
			timeout: 30000, // 30 seconds timeout for token fetch
		} as any;

		const response = await context.helpers.request(requestOptions);

		// Parse token response
		const accessToken = response.access_token;
		const tokenType = response.token_type || 'Bearer';
		const expiresIn = response.expires_in || 3600; // Default 1 hour
		const scope = response.scope;

		if (!accessToken) {
			throw new Error('OAuth token response missing access_token');
		}

		const token: IOAuthToken = {
			accessToken,
			tokenType,
			expiresIn,
			expiresAt: Date.now() + (expiresIn * 1000),
			scope,
		};

		Logger.info('OAuth token fetched successfully', {
			module: 'OAuthTokenManager',
			tokenType,
			expiresIn: `${expiresIn}s`,
			hasScope: !!scope,
		});

		return token;

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		Logger.error('Failed to fetch OAuth token', error instanceof Error ? error : new Error(errorMessage), {
			module: 'OAuthTokenManager',
			tokenUrl,
		});

		// Provide helpful error messages
		if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
			throw new Error('OAuth authentication failed: Invalid client credentials. Check Client ID and Client Secret.');
		}
		if (errorMessage.includes('400') || errorMessage.includes('invalid_grant')) {
			throw new Error('OAuth authentication failed: Invalid grant type or scope. Check the OAuth configuration.');
		}
		if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
			throw new Error(`OAuth token URL not reachable: ${tokenUrl}. Check the Token URL configuration.`);
		}

		throw new Error(`OAuth token fetch failed: ${errorMessage}`);
	}
}

/**
 * Get valid OAuth token (from cache or fetch new)
 *
 * @param context - n8n execution context
 * @param credentials - OAuth credentials
 * @returns Valid OAuth token
 */
export async function getOAuthToken(
	context: ICredentialTestFunctions | IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	credentials: IOAuthCredentials,
): Promise<IOAuthToken> {
	const cacheKey = generateCacheKey(credentials);

	// Check cache for valid token
	const cached = tokenCache.get(cacheKey);
	if (cached && isTokenValid(cached.token)) {
		Logger.debug('Using cached OAuth token', {
			module: 'OAuthTokenManager',
			expiresIn: `${Math.round((cached.token.expiresAt - Date.now()) / 1000)}s`,
		});
		return cached.token;
	}

	// Fetch new token
	const token = await fetchToken(context, credentials);

	// Cache the token
	tokenCache.set(cacheKey, {
		token,
		cacheKey,
	});

	return token;
}

/**
 * Get Authorization header value for OAuth
 *
 * @param context - n8n execution context
 * @param credentials - OAuth credentials
 * @returns Authorization header value (e.g., "Bearer xxx")
 */
export async function getOAuthAuthorizationHeader(
	context: ICredentialTestFunctions | IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	credentials: IOAuthCredentials,
): Promise<string> {
	const token = await getOAuthToken(context, credentials);
	return `${token.tokenType} ${token.accessToken}`;
}

/**
 * Clear cached tokens (useful for testing or credential changes)
 *
 * @param credentials - Optional specific credentials to clear. If not provided, clears all.
 */
export function clearTokenCache(credentials?: IOAuthCredentials): void {
	if (credentials) {
		const cacheKey = generateCacheKey(credentials);
		tokenCache.delete(cacheKey);
		Logger.debug('Cleared specific OAuth token from cache', {
			module: 'OAuthTokenManager',
			clientId: credentials.clientId.substring(0, 10) + '...',
		});
	} else {
		tokenCache.clear();
		Logger.debug('Cleared all OAuth tokens from cache', {
			module: 'OAuthTokenManager',
		});
	}
}

/**
 * Check if credentials are OAuth type
 * Note: This checks the raw credential structure (with oauth prefixed names)
 */
export function isOAuthCredentials(credentials: any): boolean {
	return credentials.authentication === 'oauth2ClientCredentials' &&
		!!credentials.oauthTokenUrl &&
		!!credentials.oauthClientId &&
		!!credentials.oauthClientSecret;
}
