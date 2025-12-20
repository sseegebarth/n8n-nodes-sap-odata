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
exports.ODataVersionHelper = void 0;
const constants_1 = require("../constants");
const LoggerAdapter_1 = require("./LoggerAdapter");
class ODataVersionHelper {
    static async getODataVersion(context) {
        const credentials = await context.getCredentials('sapOdataApi');
        const configuredVersion = credentials.version || 'auto';
        if (configuredVersion === 'v2' || configuredVersion === 'v4') {
            LoggerAdapter_1.LoggerAdapter.debug('ODataVersionHelper', {
                action: 'version_configured',
                version: configuredVersion,
            });
            return configuredVersion;
        }
        const serviceUrl = credentials.host;
        const servicePath = credentials.servicePath || '';
        const cacheKey = `${serviceUrl}|${servicePath}`;
        const cached = this.versionCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            LoggerAdapter_1.LoggerAdapter.debug('ODataVersionHelper', {
                action: 'version_cached',
                version: cached.version,
                ttlRemaining: Math.round((cached.expires - Date.now()) / 1000),
            });
            return cached.version;
        }
        if (cached) {
            this.versionCache.delete(cacheKey);
        }
        const detectedVersion = await this.detectVersion(context, serviceUrl);
        this.versionCache.set(cacheKey, {
            version: detectedVersion,
            expires: Date.now() + constants_1.METADATA_CACHE_TTL,
        });
        LoggerAdapter_1.LoggerAdapter.info('ODataVersionHelper', {
            action: 'version_detected',
            version: detectedVersion,
            serviceUrl,
            servicePath,
            cacheTtl: constants_1.METADATA_CACHE_TTL,
        });
        return detectedVersion;
    }
    static async detectVersion(context, _serviceUrl) {
        try {
            const { sapOdataApiRequest } = await Promise.resolve().then(() => __importStar(require('../../nodes/SapOData/GenericFunctions')));
            try {
                const v4Response = await sapOdataApiRequest.call(context, 'GET', '/$metadata', {}, {});
                if (this.isV4Response(v4Response)) {
                    return 'v4';
                }
            }
            catch (v4Error) {
            }
            const v2Response = await sapOdataApiRequest.call(context, 'GET', '/$metadata', {}, {});
            if (this.isV2Response(v2Response)) {
                return 'v2';
            }
            return 'v2';
        }
        catch (error) {
            LoggerAdapter_1.LoggerAdapter.warn('ODataVersionHelper', {
                action: 'version_detection_failed',
                error: error instanceof Error ? error.message : String(error),
                defaulting_to: 'v2',
            });
            return 'v2';
        }
    }
    static isV4Response(response) {
        if (typeof response === 'string') {
            return response.includes('Version="4.0"') ||
                response.includes('xmlns="http://docs.oasis-open.org/odata/ns/edm"');
        }
        return response['@odata.context'] !== undefined;
    }
    static isV2Response(response) {
        if (typeof response === 'string') {
            return response.includes('Version="1.0"') ||
                response.includes('xmlns="http://schemas.microsoft.com/ado/2007/08/dataservices"');
        }
        return response.d !== undefined;
    }
    static getVersionSpecificParams(version, params) {
        const result = { ...params };
        if ('count' in params) {
            if (version === 'v4') {
                result['$count'] = params.count;
            }
            else {
                result['$inlinecount'] = params.count ? 'allpages' : 'none';
            }
            delete result.count;
        }
        if (params.includeCount === true) {
            if (version === 'v4') {
                result['$count'] = true;
            }
            else {
                result['$inlinecount'] = 'allpages';
            }
            delete result.includeCount;
        }
        LoggerAdapter_1.LoggerAdapter.debug('ODataVersionHelper', {
            action: 'params_mapped',
            version,
            original: params,
            mapped: result,
        });
        return result;
    }
    static extractData(response, version) {
        var _a;
        if (!response)
            return null;
        let data;
        if (version === 'v2') {
            data = ((_a = response.d) === null || _a === void 0 ? void 0 : _a.results) || response.d || response;
        }
        else {
            data = response.value || response;
        }
        LoggerAdapter_1.LoggerAdapter.debug('ODataVersionHelper', {
            action: 'data_extracted',
            version,
            hasD: !!response.d,
            hasValue: !!response.value,
            hasODataContext: !!response['@odata.context'],
        });
        return data;
    }
    static getTotalCount(response, version) {
        var _a;
        if (version === 'v2') {
            return (_a = response.d) === null || _a === void 0 ? void 0 : _a.__count;
        }
        else {
            return response['@odata.count'];
        }
    }
    static getNextLink(response, version) {
        var _a;
        if (version === 'v2') {
            return (_a = response.d) === null || _a === void 0 ? void 0 : _a.__next;
        }
        else {
            return response['@odata.nextLink'];
        }
    }
    static parseError(error, version) {
        var _a, _b, _c, _d, _e, _f;
        let errorMessage = 'An unknown SAP OData error occurred';
        try {
            if (version === 'v4') {
                if ((_a = error.error) === null || _a === void 0 ? void 0 : _a.message) {
                    errorMessage = typeof error.error.message === 'string'
                        ? error.error.message
                        : error.error.message.value || errorMessage;
                }
            }
            else {
                if ((_c = (_b = error.error) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.value) {
                    errorMessage = error.error.message.value;
                }
                else if ((_d = error.error) === null || _d === void 0 ? void 0 : _d.message) {
                    errorMessage = typeof error.error.message === 'string'
                        ? error.error.message
                        : errorMessage;
                }
            }
            const innerError = ((_e = error.error) === null || _e === void 0 ? void 0 : _e.innererror) || ((_f = error.error) === null || _f === void 0 ? void 0 : _f.details);
            if (innerError) {
                if (typeof innerError === 'string') {
                    errorMessage += ` - ${innerError}`;
                }
                else if (innerError.message) {
                    errorMessage += ` - ${innerError.message}`;
                }
            }
        }
        catch (parseError) {
            LoggerAdapter_1.LoggerAdapter.error('ODataVersionHelper parse error', parseError instanceof Error ? parseError : new Error(String(parseError)), {
                action: 'error_parse_failed',
                originalError: error,
            });
        }
        return errorMessage;
    }
    static formatEntityKey(key, version) {
        if (version === 'v4') {
            if (!key.includes('=') && !key.includes(',')) {
                if (!key.startsWith("'") && isNaN(Number(key))) {
                    return `'${key}'`;
                }
            }
        }
        return key;
    }
    static clearCache() {
        this.versionCache.clear();
        LoggerAdapter_1.LoggerAdapter.debug('ODataVersionHelper', {
            action: 'cache_cleared',
        });
    }
}
exports.ODataVersionHelper = ODataVersionHelper;
ODataVersionHelper.versionCache = new Map();
