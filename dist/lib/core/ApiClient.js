"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRequest = executeRequest;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const constants_1 = require("../constants");
const CacheManager_1 = require("../utils/CacheManager");
const ErrorHandler_1 = require("../utils/ErrorHandler");
const RetryUtils_1 = require("../utils/RetryUtils");
const SapGatewayCompat_1 = require("../utils/SapGatewayCompat");
const SapGatewaySession_1 = require("../utils/SapGatewaySession");
const RequestBuilder_1 = require("./RequestBuilder");
const lastRequestTime = new Map();
async function throttleRequest(nodeKey, minIntervalMs) {
    const last = lastRequestTime.get(nodeKey) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < minIntervalMs) {
        await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
    }
    lastRequestTime.set(nodeKey, Date.now());
}
async function executeRequest(config) {
    let { method, resource, body = {}, qs = {}, uri, option = {}, csrfToken } = config;
    const credentials = (await this.getCredentials(constants_1.CREDENTIAL_TYPE));
    if (!credentials) {
        return ErrorHandler_1.ODataErrorHandler.handleValidationError(constants_1.ERROR_MESSAGES.NO_CREDENTIALS, this.getNode());
    }
    const host = credentials.host.replace(/\/$/, '');
    const servicePath = config.servicePath || (0, GenericFunctions_1.resolveServicePath)(this);
    let advancedOptions = {};
    if ('getNodeParameter' in this) {
        try {
            advancedOptions = this.getNodeParameter('advancedOptions', 0, {});
        }
        catch {
            advancedOptions = {};
        }
    }
    if (advancedOptions.throttleEnabled === true) {
        const maxRps = advancedOptions.maxRequestsPerSecond || 10;
        const minIntervalMs = Math.ceil(1000 / maxRps);
        const node = this.getNode();
        await throttleRequest(`${node.type}_${node.id}`, minIntervalMs);
    }
    let csrfRetried = false;
    const makeRequest = async () => {
        var _a;
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
            node: this.getNode(),
        });
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
                }
            }
            const response = await this.helpers.request({
                ...requestOptions,
                auth,
            });
            return response;
        }
        catch (error) {
            const statusCode = (error === null || error === void 0 ? void 0 : error.statusCode) || ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.statusCode) || (error === null || error === void 0 ? void 0 : error.httpCode);
            if (statusCode === 404) {
                await CacheManager_1.CacheManager.invalidateCacheOn404(this, credentials.host, servicePath);
            }
            if (statusCode === 403 && method !== 'GET' && csrfToken && !csrfRetried) {
                csrfRetried = true;
                await SapGatewayCompat_1.SapGatewayCompat.clearSession(this, host, servicePath);
                const freshToken = await SapGatewayCompat_1.SapGatewayCompat.fetchCsrfToken(this, host, servicePath, (h, sp) => (0, RequestBuilder_1.buildCsrfTokenRequest)(h, sp, credentials, this.getNode()));
                if (freshToken) {
                    csrfToken = freshToken;
                    return makeRequest();
                }
            }
            if (statusCode && [429, 502, 503, 504].includes(statusCode)) {
                throw error;
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
    });
    return retryHandler.execute(makeRequest);
}
