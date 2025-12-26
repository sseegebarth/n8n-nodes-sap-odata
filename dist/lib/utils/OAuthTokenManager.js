"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuthToken = getOAuthToken;
exports.getOAuthAuthorizationHeader = getOAuthAuthorizationHeader;
exports.clearTokenCache = clearTokenCache;
exports.isOAuthCredentials = isOAuthCredentials;
const Logger_1 = require("./Logger");
const tokenCache = new Map();
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
function generateCacheKey(credentials) {
    return `${credentials.clientId}|${credentials.tokenUrl}`;
}
function isTokenValid(token) {
    const now = Date.now();
    const expiresAt = token.expiresAt - TOKEN_REFRESH_MARGIN_MS;
    return now < expiresAt;
}
async function fetchToken(context, credentials) {
    const { tokenUrl, clientId, clientSecret, scope, allowUnauthorizedCerts } = credentials;
    Logger_1.Logger.debug('Fetching new OAuth token', {
        module: 'OAuthTokenManager',
        tokenUrl,
        clientId: clientId.substring(0, 10) + '...',
        hasScope: !!scope,
    });
    const formData = {
        grant_type: 'client_credentials',
    };
    if (scope) {
        formData.scope = scope;
    }
    try {
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
            timeout: 30000,
        };
        const response = await context.helpers.request(requestOptions);
        const accessToken = response.access_token;
        const tokenType = response.token_type || 'Bearer';
        const expiresIn = response.expires_in || 3600;
        const scope = response.scope;
        if (!accessToken) {
            throw new Error('OAuth token response missing access_token');
        }
        const token = {
            accessToken,
            tokenType,
            expiresIn,
            expiresAt: Date.now() + (expiresIn * 1000),
            scope,
        };
        Logger_1.Logger.info('OAuth token fetched successfully', {
            module: 'OAuthTokenManager',
            tokenType,
            expiresIn: `${expiresIn}s`,
            hasScope: !!scope,
        });
        return token;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger_1.Logger.error('Failed to fetch OAuth token', error instanceof Error ? error : new Error(errorMessage), {
            module: 'OAuthTokenManager',
            tokenUrl,
        });
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
async function getOAuthToken(context, credentials) {
    const cacheKey = generateCacheKey(credentials);
    const cached = tokenCache.get(cacheKey);
    if (cached && isTokenValid(cached.token)) {
        Logger_1.Logger.debug('Using cached OAuth token', {
            module: 'OAuthTokenManager',
            expiresIn: `${Math.round((cached.token.expiresAt - Date.now()) / 1000)}s`,
        });
        return cached.token;
    }
    const token = await fetchToken(context, credentials);
    tokenCache.set(cacheKey, {
        token,
        cacheKey,
    });
    return token;
}
async function getOAuthAuthorizationHeader(context, credentials) {
    const token = await getOAuthToken(context, credentials);
    return `${token.tokenType} ${token.accessToken}`;
}
function clearTokenCache(credentials) {
    if (credentials) {
        const cacheKey = generateCacheKey(credentials);
        tokenCache.delete(cacheKey);
        Logger_1.Logger.debug('Cleared specific OAuth token from cache', {
            module: 'OAuthTokenManager',
            clientId: credentials.clientId.substring(0, 10) + '...',
        });
    }
    else {
        tokenCache.clear();
        Logger_1.Logger.debug('Cleared all OAuth tokens from cache', {
            module: 'OAuthTokenManager',
        });
    }
}
function isOAuthCredentials(credentials) {
    return credentials.authentication === 'oauth2ClientCredentials' &&
        !!credentials.oauthTokenUrl &&
        !!credentials.oauthClientId &&
        !!credentials.oauthClientSecret;
}
