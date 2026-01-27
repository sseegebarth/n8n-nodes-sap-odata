"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeRequest = executeRequest;
exports.resetThrottleManager = resetThrottleManager;
const n8n_workflow_1 = require("n8n-workflow");
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const constants_1 = require("../constants");
const CacheManager_1 = require("../utils/CacheManager");
const ErrorHandler_1 = require("../utils/ErrorHandler");
const RetryUtils_1 = require("../utils/RetryUtils");
const SapGatewaySession_1 = require("../utils/SapGatewaySession");
const ThrottleManager_1 = require("../utils/ThrottleManager");
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
            const statusCode = ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.statusCode) || (error === null || error === void 0 ? void 0 : error.statusCode);
            if (statusCode === 404) {
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
    });
    return retryHandler.execute(makeRequest);
}
function resetThrottleManager() {
}
