"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRequestOptions = buildRequestOptions;
exports.buildCsrfTokenRequest = buildCsrfTokenRequest;
exports.parsePoolConfig = parsePoolConfig;
exports.parseStatusCodes = parseStatusCodes;
const constants_1 = require("../constants");
const ConnectionPoolManager_1 = require("../utils/ConnectionPoolManager");
const Logger_1 = require("../utils/Logger");
const SecurityUtils_1 = require("../utils/SecurityUtils");
function buildRequestOptions(config) {
    const { method, resource, host, servicePath, body = {}, qs = {}, uri, options = {}, credentials, csrfToken, poolConfig = {}, node, } = config;
    (0, SecurityUtils_1.validateUrl)(host, node);
    const url = uri || (0, SecurityUtils_1.buildSecureUrl)(host, servicePath, resource);
    const isMetadataRequest = resource.includes('$metadata');
    const requestOptions = {
        method,
        url,
        headers: {
            Accept: isMetadataRequest ? 'application/xml' : constants_1.HEADERS.ACCEPT,
            'Content-Type': constants_1.HEADERS.CONTENT_TYPE,
        },
        body,
        qs,
        json: !isMetadataRequest,
        returnFullResponse: false,
        skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
        timeout: constants_1.DEFAULT_TIMEOUT,
    };
    if (credentials.authentication === 'basicAuth' && credentials.username && credentials.password) {
        requestOptions.auth = {
            username: credentials.username,
            password: credentials.password,
        };
    }
    if (method !== 'GET' && csrfToken) {
        requestOptions.headers = {
            ...requestOptions.headers,
            'X-CSRF-Token': (0, SecurityUtils_1.sanitizeHeaderValue)(csrfToken),
        };
    }
    if (credentials.sapClient) {
        requestOptions.headers = {
            ...requestOptions.headers,
            'sap-client': (0, SecurityUtils_1.sanitizeHeaderValue)(credentials.sapClient),
        };
    }
    if (credentials.sapLanguage) {
        requestOptions.headers = {
            ...requestOptions.headers,
            'sap-language': (0, SecurityUtils_1.sanitizeHeaderValue)(credentials.sapLanguage),
        };
    }
    if (credentials.customHeaders) {
        try {
            const customHeaders = typeof credentials.customHeaders === 'string'
                ? JSON.parse(credentials.customHeaders)
                : credentials.customHeaders;
            const forbiddenHeaders = ['authorization', 'x-csrf-token', 'cookie', 'set-cookie'];
            for (const [key, value] of Object.entries(customHeaders)) {
                if (!value)
                    continue;
                const headerName = String(key).toLowerCase().trim();
                if (!/^[a-z0-9-]+$/i.test(headerName)) {
                    Logger_1.Logger.warn('Invalid custom header name skipped', {
                        module: 'RequestBuilder',
                        headerName: key,
                    });
                    continue;
                }
                if (forbiddenHeaders.includes(headerName)) {
                    Logger_1.Logger.warn('Forbidden custom header skipped', {
                        module: 'RequestBuilder',
                        headerName: key,
                    });
                    continue;
                }
                requestOptions.headers = {
                    ...requestOptions.headers,
                    [headerName]: (0, SecurityUtils_1.sanitizeHeaderValue)(String(value)),
                };
            }
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to parse custom headers', {
                module: 'RequestBuilder',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    if (Object.keys(poolConfig).length > 0) {
        const poolManager = ConnectionPoolManager_1.ConnectionPoolManager.getInstance();
        const filteredConfig = Object.fromEntries(Object.entries(poolConfig).filter(([_, v]) => v !== undefined));
        if (Object.keys(filteredConfig).length > 0) {
            poolManager.updateConfig(filteredConfig);
        }
        const urlObj = new URL(url);
        const agent = poolManager.getAgent(urlObj.protocol);
        requestOptions.agent = agent;
    }
    Object.assign(requestOptions, options);
    return requestOptions;
}
function buildCsrfTokenRequest(host, servicePath, credentials, node) {
    (0, SecurityUtils_1.validateUrl)(host, node);
    const url = (0, SecurityUtils_1.buildSecureUrl)(host, servicePath, '');
    const poolManager = ConnectionPoolManager_1.ConnectionPoolManager.getInstance();
    const urlObj = new URL(url);
    const agent = poolManager.getAgent(urlObj.protocol);
    const options = {
        method: 'GET',
        url,
        headers: {
            'X-CSRF-Token': 'Fetch',
            Accept: constants_1.HEADERS.ACCEPT,
        },
        json: true,
        returnFullResponse: true,
        skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
        timeout: constants_1.DEFAULT_TIMEOUT,
    };
    if (credentials.authentication === 'basicAuth' && credentials.username && credentials.password) {
        options.auth = {
            username: credentials.username,
            password: credentials.password,
        };
    }
    options.agent = agent;
    return options;
}
function parsePoolConfig(advancedOptions) {
    const poolConfig = {
        keepAlive: advancedOptions.keepAlive !== undefined ? advancedOptions.keepAlive : undefined,
        maxSockets: advancedOptions.maxSockets,
        maxFreeSockets: advancedOptions.maxFreeSockets,
        timeout: advancedOptions.timeout,
        freeSocketTimeout: advancedOptions.freeSocketTimeout,
    };
    return Object.fromEntries(Object.entries(poolConfig).filter(([_, v]) => v !== undefined));
}
function parseStatusCodes(codes) {
    if (!codes || typeof codes !== 'string') {
        return [429, 503, 504];
    }
    return codes
        .split(',')
        .map((code) => parseInt(code.trim(), 10))
        .filter((code) => !isNaN(code) && code >= 100 && code < 600);
}
