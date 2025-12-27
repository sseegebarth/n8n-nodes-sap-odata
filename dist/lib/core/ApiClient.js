"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRequest = executeRequest;
exports.resetThrottleManager = resetThrottleManager;
const n8n_workflow_1 = require("n8n-workflow");
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const constants_1 = require("../constants");
const CacheManager_1 = require("../utils/CacheManager");
const ConnectionPoolManager_1 = require("../utils/ConnectionPoolManager");
const ErrorHandler_1 = require("../utils/ErrorHandler");
const Logger_1 = require("../utils/Logger");
const RetryUtils_1 = require("../utils/RetryUtils");
const SapGatewaySession_1 = require("../utils/SapGatewaySession");
const ThrottleManager_1 = require("../utils/ThrottleManager");
const OAuthTokenManager_1 = require("../utils/OAuthTokenManager");
const RequestBuilder_1 = require("./RequestBuilder");
function getThrottleManager(context, config) {
    if ('getWorkflowStaticData' in context) {
        const staticData = context.getWorkflowStaticData('global');
        const key = '_sapOdataThrottleManager';
        if (!staticData[key]) {
            staticData[key] = new ThrottleManager_1.ThrottleManager(config);
        }
        return staticData[key];
    }
    return new ThrottleManager_1.ThrottleManager(config);
}
async function executeRequest(config) {
    const { method, resource, body = {}, qs = {}, uri, option = {}, csrfToken } = config;
    const credentials = (await this.getCredentials(constants_1.CREDENTIAL_TYPE));
    if (!credentials) {
        return ErrorHandler_1.ODataErrorHandler.handleValidationError(constants_1.ERROR_MESSAGES.NO_CREDENTIALS, this.getNode());
    }
    const host = credentials.host.replace(/\/$/, '');
    const servicePath = config.servicePath || (0, GenericFunctions_1.resolveServicePath)(this);
    if (credentials.allowUnauthorizedCerts === true) {
        const warningKey = 'sslWarningShown';
        try {
            const staticData = 'getWorkflowStaticData' in this
                ? this.getWorkflowStaticData('global')
                : {};
            if (!staticData[warningKey]) {
                Logger_1.Logger.logSecurityWarning('SSL certificate validation is DISABLED! ' +
                    'This should ONLY be used in development environments. ' +
                    'Production systems must use valid SSL certificates to prevent man-in-the-middle attacks.');
                staticData[warningKey] = true;
            }
        }
        catch {
            Logger_1.Logger.logSecurityWarning('SSL validation disabled - use only in development!');
        }
    }
    let advancedOptions = {};
    if ('getNodeParameter' in this) {
        try {
            advancedOptions = this.getNodeParameter('advancedOptions', 0, {});
        }
        catch {
            advancedOptions = {};
        }
    }
    const throttleEnabled = advancedOptions.throttleEnabled === true;
    let throttleManager = null;
    if (throttleEnabled) {
        throttleManager = getThrottleManager(this, {
            maxRequestsPerSecond: advancedOptions.maxRequestsPerSecond || 10,
            strategy: advancedOptions.throttleStrategy || 'delay',
            burstSize: advancedOptions.throttleBurstSize || 5,
            onThrottle: (waitTime) => {
                if (advancedOptions.logThrottling) {
                    Logger_1.Logger.info('Request throttled', {
                        module: 'ThrottleManager',
                        waitTime: `${waitTime}ms`,
                        strategy: advancedOptions.throttleStrategy,
                        method,
                        resource,
                    });
                }
            },
        });
        Logger_1.Logger.debug('ThrottleManager retrieved/initialized', {
            module: 'ThrottleManager',
            maxRequestsPerSecond: advancedOptions.maxRequestsPerSecond,
            strategy: advancedOptions.throttleStrategy,
        });
    }
    if (throttleManager) {
        const allowed = await throttleManager.acquire();
        if (!allowed && advancedOptions.throttleStrategy === 'drop') {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Request dropped due to rate limiting', {
                description: 'Too many requests. Try reducing the request rate or changing the throttle strategy.',
            });
        }
    }
    const poolConfig = (0, RequestBuilder_1.parsePoolConfig)(advancedOptions);
    const makeRequest = async () => {
        var _a, _b, _c, _d;
        let oauthToken;
        if (credentials.authentication === 'oauth2ClientCredentials') {
            if (!credentials.oauthTokenUrl || !credentials.oauthClientId || !credentials.oauthClientSecret) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'OAuth 2.0 configuration incomplete', {
                    description: 'Token URL, Client ID, and Client Secret are required for OAuth 2.0 authentication.',
                });
            }
            try {
                const token = await (0, OAuthTokenManager_1.getOAuthToken)(this, {
                    tokenUrl: credentials.oauthTokenUrl,
                    clientId: credentials.oauthClientId,
                    clientSecret: credentials.oauthClientSecret,
                    scope: credentials.oauthScope,
                    allowUnauthorizedCerts: credentials.allowUnauthorizedCerts,
                });
                oauthToken = token.accessToken;
                Logger_1.Logger.debug('OAuth token acquired', {
                    module: 'ApiClient',
                    expiresIn: token.expiresIn,
                    tokenType: token.tokenType,
                });
            }
            catch (error) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Failed to acquire OAuth token', {
                    description: error instanceof Error ? error.message : 'Unknown OAuth error',
                });
            }
        }
        const requestOptions = (0, RequestBuilder_1.buildRequestOptions)({
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
        const debugLogging = advancedOptions.debugLogging === true;
        Logger_1.Logger.setDebugMode(debugLogging);
        const startTime = debugLogging ? Date.now() : 0;
        if (debugLogging) {
            Logger_1.Logger.logRequest(method, requestOptions.url);
            Logger_1.Logger.debug('Request headers', {
                module: 'ApiClient',
                headers: {
                    ...requestOptions.headers,
                    Authorization: ((_a = requestOptions.headers) === null || _a === void 0 ? void 0 : _a.Authorization) ? '*****' : undefined,
                    'X-CSRF-Token': ((_b = requestOptions.headers) === null || _b === void 0 ? void 0 : _b['X-CSRF-Token']) ? '(token present)' : undefined,
                    Cookie: ((_c = requestOptions.headers) === null || _c === void 0 ? void 0 : _c.Cookie) ? '(cookies present)' : undefined,
                },
            });
            if (method !== 'GET') {
                Logger_1.Logger.debug('CSRF token status', {
                    module: 'ApiClient',
                    hasToken: !!csrfToken,
                    tokenLength: csrfToken ? csrfToken.length : 0,
                });
            }
        }
        try {
            const auth = credentials.authentication === 'basicAuth' && credentials.username && credentials.password
                ? { username: credentials.username, password: credentials.password }
                : undefined;
            let cookieHeader = null;
            if (method !== 'GET') {
                cookieHeader = await SapGatewaySession_1.SapGatewaySessionManager.getCookieHeader(this, host, servicePath);
                if (cookieHeader) {
                    requestOptions.headers = {
                        ...requestOptions.headers,
                        Cookie: cookieHeader,
                    };
                    Logger_1.Logger.debug('Session cookies added to request', {
                        module: 'ApiClient',
                        cookieCount: cookieHeader.split(';').length,
                    });
                }
            }
            const response = await this.helpers.request({
                ...requestOptions,
                auth,
            });
            if (debugLogging) {
                const duration = Date.now() - startTime;
                Logger_1.Logger.debug('Response received', {
                    module: 'ApiClient',
                    duration: `${duration}ms`,
                    responseType: typeof response,
                });
                const poolManager = ConnectionPoolManager_1.ConnectionPoolManager.getInstance();
                const stats = poolManager.getStats();
                Logger_1.Logger.logPoolStats({
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
        }
        catch (error) {
            if (debugLogging) {
                const duration = Date.now() - startTime;
                Logger_1.Logger.error('Request failed', error, {
                    module: 'ApiClient',
                    duration: `${duration}ms`,
                    method,
                    resource,
                });
            }
            const statusCode = ((_d = error === null || error === void 0 ? void 0 : error.response) === null || _d === void 0 ? void 0 : _d.statusCode) || (error === null || error === void 0 ? void 0 : error.statusCode);
            if (statusCode === 404) {
                Logger_1.Logger.debug('404 error detected - invalidating metadata cache', {
                    module: 'ApiClient',
                    resource,
                });
                await CacheManager_1.CacheManager.invalidateCacheOn404(this, credentials.host, servicePath);
            }
            return ErrorHandler_1.ODataErrorHandler.handleApiError(error, this.getNode(), {
                operation: method,
                resource,
            });
        }
    };
    const retryHandler = new RetryUtils_1.RetryHandler({
        maxAttempts: constants_1.MAX_RETRY_ATTEMPTS,
        initialDelay: constants_1.INITIAL_RETRY_DELAY,
        maxDelay: constants_1.MAX_RETRY_DELAY,
        backoffFactor: 2,
        retryableStatusCodes: constants_1.RETRY_STATUS_CODES,
        retryNetworkErrors: true,
        onRetry: (attempt, error, delay) => {
            Logger_1.Logger.info('Retrying request', {
                module: 'RetryHandler',
                attempt,
                maxAttempts: constants_1.MAX_RETRY_ATTEMPTS,
                delay: `${delay}ms`,
                error: error instanceof Error ? error.message : 'Unknown error',
                method,
                resource,
            });
        },
    });
    return retryHandler.execute(makeRequest);
}
function resetThrottleManager() {
}
