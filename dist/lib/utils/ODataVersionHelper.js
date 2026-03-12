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
class ODataVersionHelper {
    static async getODataVersion(context) {
        const credentials = await context.getCredentials('sapOdataApi');
        const configuredVersion = credentials.version || 'auto';
        if (configuredVersion === 'v2' || configuredVersion === 'v4') {
            return configuredVersion;
        }
        const serviceUrl = credentials.host;
        const servicePath = credentials.servicePath || '';
        const cacheKey = `${serviceUrl}|${servicePath}`;
        const cached = this.versionCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
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
        return detectedVersion;
    }
    static async detectVersion(context, _serviceUrl) {
        try {
            const { sapOdataApiRequest } = await Promise.resolve().then(() => __importStar(require('../../nodes/SapOData/GenericFunctions')));
            const metadataResponse = await sapOdataApiRequest.call(context, 'GET', '/$metadata', {}, {});
            return this.analyzeMetadataVersion(metadataResponse);
        }
        catch {
            return 'v2';
        }
    }
    static analyzeMetadataVersion(response) {
        if (typeof response !== 'string') {
            if (response['@odata.context'] !== undefined) {
                return 'v4';
            }
            if (response.d !== undefined) {
                return 'v2';
            }
            return 'v2';
        }
        const xml = response;
        if (xml.includes('xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"') ||
            xml.includes("xmlns:edmx='http://schemas.microsoft.com/ado/2007/06/edmx'")) {
            return 'v2';
        }
        if (xml.includes('xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"') ||
            xml.includes("xmlns:edmx='http://docs.oasis-open.org/odata/ns/edmx'")) {
            return 'v4';
        }
        if (xml.includes('DataServiceVersion="2.0"') ||
            xml.includes('DataServiceVersion="1.0"') ||
            xml.includes("DataServiceVersion='2.0'") ||
            xml.includes("DataServiceVersion='1.0'")) {
            return 'v2';
        }
        if (xml.includes('Version="4.0"') || xml.includes('Version="4.01"') ||
            xml.includes("Version='4.0'") || xml.includes("Version='4.01'")) {
            return 'v4';
        }
        const v2EdmNamespaces = [
            'http://schemas.microsoft.com/ado/2008/09/edm',
            'http://schemas.microsoft.com/ado/2006/04/edm',
            'http://schemas.microsoft.com/ado/2007/08/dataservices',
        ];
        for (const ns of v2EdmNamespaces) {
            if (xml.includes(ns)) {
                return 'v2';
            }
        }
        if (xml.includes('http://docs.oasis-open.org/odata/ns/edm')) {
            return 'v4';
        }
        return 'v2';
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
        return result;
    }
    static extractData(response, version) {
        if (!response)
            return null;
        let data;
        if (version === 'v2') {
            const d = response.d;
            if ((d === null || d === void 0 ? void 0 : d.results) !== undefined) {
                data = d.results;
            }
            else if (d) {
                if (d.results === undefined && typeof d === 'object') {
                    data = d;
                }
                else {
                    data = d;
                }
            }
            else if (Array.isArray(response)) {
                data = response;
            }
            else {
                data = response;
            }
        }
        else {
            if (response.value !== undefined) {
                data = response.value;
            }
            else if (Array.isArray(response)) {
                data = response;
            }
            else if (response['@odata.context'] !== undefined) {
                const { '@odata.context': _, '@odata.etag': __, ...entityData } = response;
                data = entityData;
            }
            else {
                data = response;
            }
        }
        return data;
    }
    static getTotalCount(response, version) {
        if (version === 'v2') {
            const d = response.d;
            if ((d === null || d === void 0 ? void 0 : d.__count) !== undefined) {
                const parsed = parseInt(String(d.__count), 10);
                return isNaN(parsed) ? undefined : parsed;
            }
            return undefined;
        }
        else {
            return response['@odata.count'];
        }
    }
    static parseError(error, version) {
        let errorMessage = 'An unknown SAP OData error occurred';
        try {
            const errObj = error.error;
            if (version === 'v4') {
                if (errObj === null || errObj === void 0 ? void 0 : errObj.message) {
                    const msg = errObj.message;
                    errorMessage = typeof msg === 'string'
                        ? msg
                        : msg.value || errorMessage;
                }
            }
            else {
                const msg = errObj === null || errObj === void 0 ? void 0 : errObj.message;
                if (typeof msg === 'object' && (msg === null || msg === void 0 ? void 0 : msg.value)) {
                    errorMessage = msg.value;
                }
                else if (typeof msg === 'string') {
                    errorMessage = msg;
                }
            }
            const innerError = (errObj === null || errObj === void 0 ? void 0 : errObj.innererror) || (errObj === null || errObj === void 0 ? void 0 : errObj.details);
            if (innerError) {
                if (typeof innerError === 'string') {
                    errorMessage += ` - ${innerError}`;
                }
                else if (innerError.message) {
                    errorMessage += ` - ${innerError.message}`;
                }
            }
        }
        catch {
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
    }
}
exports.ODataVersionHelper = ODataVersionHelper;
ODataVersionHelper.versionCache = new Map();
