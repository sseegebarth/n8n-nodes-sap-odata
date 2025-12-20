"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSapODataConnection = testSapODataConnection;
const constants_1 = require("../../lib/constants");
const GenericFunctions_1 = require("./GenericFunctions");
async function testSapODataConnection(credential) {
    var _a;
    const startTime = Date.now();
    const host = ((_a = credential.host) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, '')) || '';
    const authentication = credential.authentication;
    const allowUnauthorizedCerts = credential.allowUnauthorizedCerts;
    const sapClient = credential.sapClient;
    const sapLanguage = credential.sapLanguage;
    try {
        const parsedUrl = new URL(host);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return {
                status: 'Error',
                message: `Invalid protocol: ${parsedUrl.protocol}\n\nOnly HTTP and HTTPS are allowed.`,
            };
        }
        const allowPrivateIps = process.env.ALLOW_PRIVATE_IPS === 'true' || process.env.ALLOW_PRIVATE_IPS === '1';
        const hostname = parsedUrl.hostname.toLowerCase();
        if (!allowPrivateIps) {
            const localhostPatterns = ['localhost', '127.', '0.0.0.0', '::1'];
            if (localhostPatterns.some(pattern => hostname.includes(pattern))) {
                return {
                    status: 'Error',
                    message: 'Access to localhost is not allowed\n\n' +
                        'For internal/on-premise SAP systems, set environment variable:\n' +
                        'ALLOW_PRIVATE_IPS=true',
                };
            }
            const privateIpPatterns = [
                /^10\./,
                /^172\.(1[6-9]|2\d|3[01])\./,
                /^192\.168\./,
            ];
            if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
                return {
                    status: 'Error',
                    message: 'Access to private IP addresses is not allowed\n\n' +
                        'For internal/on-premise SAP systems, set environment variable:\n' +
                        'ALLOW_PRIVATE_IPS=true\n\n' +
                        'In Docker, add to your docker-compose.yml:\n' +
                        'environment:\n' +
                        '  - ALLOW_PRIVATE_IPS=true',
                };
            }
        }
    }
    catch (error) {
        return {
            status: 'Error',
            message: `Invalid host URL: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    const auth = authentication === 'basicAuth'
        ? {
            username: credential.username,
            password: credential.password,
        }
        : undefined;
    try {
        let catalogServiceAvailable = false;
        let catalogResponseTime = 0;
        try {
            const catalogStartTime = Date.now();
            await this.helpers.request({
                method: 'GET',
                url: `${host}/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/`,
                auth,
                skipSslCertificateValidation: allowUnauthorizedCerts,
                timeout: constants_1.CONNECTION_TEST_TIMEOUT,
                headers: buildSapHeaders(sapClient, sapLanguage),
            });
            catalogResponseTime = Date.now() - catalogStartTime;
            catalogServiceAvailable = true;
        }
        catch (error) {
            catalogServiceAvailable = false;
        }
        let metadataXml = null;
        let metadataAccessible = false;
        const testPaths = [
            '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata',
            '/sap/opu/odata/iwbep/GWSAMPLE_BASIC/$metadata',
        ];
        for (const path of testPaths) {
            try {
                const metadataResponse = await this.helpers.request({
                    method: 'GET',
                    url: `${host}${path}`,
                    auth,
                    skipSslCertificateValidation: allowUnauthorizedCerts,
                    timeout: constants_1.CONNECTION_TEST_TIMEOUT,
                    headers: buildSapHeaders(sapClient, sapLanguage),
                });
                metadataXml = typeof metadataResponse === 'string'
                    ? metadataResponse
                    : JSON.stringify(metadataResponse);
                metadataAccessible = true;
                break;
            }
            catch (error) {
                continue;
            }
        }
        let entitySets = [];
        if (metadataXml && metadataAccessible) {
            try {
                entitySets = (0, GenericFunctions_1.parseMetadataForEntitySets)(metadataXml);
            }
            catch (error) {
                entitySets = [];
            }
        }
        const totalResponseTime = Date.now() - startTime;
        if (catalogServiceAvailable || metadataAccessible) {
            const entitySetPreview = entitySets.slice(0, 5);
            const moreCount = entitySets.length - 5;
            let message = 'Connection successful!\n\n';
            if (catalogServiceAvailable) {
                message += `Catalog Service: Available (${catalogResponseTime}ms)\n`;
            }
            if (metadataAccessible) {
                message += `Metadata Access: OK\n`;
                message += `Entity Sets Found: ${entitySets.length}\n`;
                if (entitySetPreview.length > 0) {
                    message += `\nSample Entity Sets:\n`;
                    entitySetPreview.forEach((es, idx) => {
                        message += `   ${idx + 1}. ${es}\n`;
                    });
                    if (moreCount > 0) {
                        message += `   ... and ${moreCount} more\n`;
                    }
                }
            }
            message += `\nResponse Time: ${totalResponseTime}ms`;
            if (sapClient) {
                message += `\nSAP Client: ${sapClient}`;
            }
            return {
                status: 'OK',
                message,
            };
        }
        return {
            status: 'Error',
            message: '❌ Connection failed\n\n' +
                'Unable to access SAP OData services.\n' +
                'Please check:\n' +
                '• Host URL is correct\n' +
                '• Authentication credentials\n' +
                '• Network connectivity / VPN\n' +
                '• SAP Gateway is running',
        };
    }
    catch (error) {
        const totalResponseTime = Date.now() - startTime;
        const { getHttpStatusCode, isNetworkError, isTimeoutError, isCertificateError, getErrorMessage } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/TypeGuards')));
        const statusCode = getHttpStatusCode(error);
        const errorMessage = getErrorMessage(error);
        if (statusCode === 401) {
            return {
                status: 'Error',
                message: 'Authentication failed\n\n' +
                    'Invalid username or password.\n' +
                    'Please check your credentials.\n\n' +
                    `Response Time: ${totalResponseTime}ms`,
            };
        }
        if (statusCode === 403) {
            return {
                status: 'Error',
                message: 'Access forbidden\n\n' +
                    'User does not have permission to access OData services.\n' +
                    'Please check SAP authorizations.\n\n' +
                    `Response Time: ${totalResponseTime}ms`,
            };
        }
        if (isTimeoutError(error)) {
            return {
                status: 'Error',
                message: 'Connection timeout\n\n' +
                    'SAP system not reachable.\n' +
                    'Please check:\n' +
                    '• Is VPN connected?\n' +
                    '• Is the SAP system running?\n' +
                    '• Firewall settings\n\n' +
                    `Timeout after: ${totalResponseTime}ms`,
            };
        }
        if (isNetworkError(error) && !isCertificateError(error)) {
            return {
                status: 'Error',
                message: 'Host not found\n\n' +
                    'Cannot resolve hostname or connection refused.\n' +
                    'Please check:\n' +
                    '• Host URL spelling\n' +
                    '• DNS resolution\n' +
                    '• Network connectivity\n\n' +
                    `Host: ${host}`,
            };
        }
        if (isCertificateError(error)) {
            return {
                status: 'Error',
                message: 'SSL Certificate error\n\n' +
                    'Cannot verify SSL certificate.\n\n' +
                    'Options:\n' +
                    '• Enable "Ignore SSL Issues" (not recommended for production)\n' +
                    '• Install proper SSL certificate on SAP system\n' +
                    '• Use corporate CA certificate',
            };
        }
        return {
            status: 'Error',
            message: 'Connection test failed\n\n' +
                `Error: ${sanitizeErrorMessage(errorMessage)}\n\n` +
                `Response Time: ${totalResponseTime}ms`,
        };
    }
}
function buildSapHeaders(sapClient, sapLanguage) {
    const headers = {};
    if (sapClient) {
        headers['sap-client'] = sapClient;
    }
    if (sapLanguage) {
        headers['sap-language'] = sapLanguage;
    }
    return headers;
}
function sanitizeErrorMessage(message) {
    return message
        .replace(/password[=:]\s*['"]?[^'"\s]+['"]?/gi, 'password=***')
        .replace(/token[=:]\s*['"]?[^'"\s]+['"]?/gi, 'token=***')
        .substring(0, 200);
}
