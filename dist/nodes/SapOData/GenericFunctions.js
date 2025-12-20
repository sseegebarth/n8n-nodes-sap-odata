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
exports.resolveServicePath = void 0;
exports.sapOdataApiRequest = sapOdataApiRequest;
exports.getCsrfToken = getCsrfToken;
exports.sapOdataApiRequestAllItems = sapOdataApiRequestAllItems;
exports.buildODataFilter = buildODataFilter;
exports.buildODataQuery = buildODataQuery;
exports.parseMetadataForEntitySets = parseMetadataForEntitySets;
exports.parseMetadataForFunctionImports = parseMetadataForFunctionImports;
exports.formatSapODataValue = formatSapODataValue;
const constants_1 = require("../../lib/constants");
const ApiClient_1 = require("../../lib/core/ApiClient");
const PaginationHandler_1 = require("../../lib/core/PaginationHandler");
const QueryBuilder_1 = require("../../lib/core/QueryBuilder");
const RequestBuilder_1 = require("../../lib/core/RequestBuilder");
const ODataValueFormatter_1 = require("../../lib/utils/ODataValueFormatter");
const ServicePathResolver_1 = require("../../lib/utils/ServicePathResolver");
Object.defineProperty(exports, "resolveServicePath", { enumerable: true, get: function () { return ServicePathResolver_1.resolveServicePath; } });
async function sapOdataApiRequest(method, resource, body = {}, qs = {}, uri, option = {}, customServicePath) {
    const resolvedServicePath = (0, ServicePathResolver_1.resolveServicePath)(this, customServicePath);
    let csrfToken;
    if (method !== 'GET') {
        const credentials = (await this.getCredentials(constants_1.CREDENTIAL_TYPE));
        if (credentials) {
            const host = credentials.host.replace(/\/$/, '');
            csrfToken = await getCsrfToken.call(this, host, resolvedServicePath);
        }
    }
    const config = {
        method,
        resource,
        body,
        qs,
        uri,
        option,
        csrfToken,
        servicePath: resolvedServicePath,
    };
    return ApiClient_1.executeRequest.call(this, config);
}
async function getCsrfToken(host, servicePath) {
    const { SapGatewayCompat } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/SapGatewayCompat')));
    const credentials = (await this.getCredentials(constants_1.CREDENTIAL_TYPE));
    return SapGatewayCompat.fetchCsrfToken(this, host, servicePath, (h, sp) => (0, RequestBuilder_1.buildCsrfTokenRequest)(h, sp, credentials, this.getNode()));
}
async function sapOdataApiRequestAllItems(propertyName, method, resource, body = {}, query = {}, continueOnFail = false, maxItems = 0) {
    const resolvedServicePath = (0, ServicePathResolver_1.resolveServicePath)(this);
    let csrfToken;
    if (method !== 'GET') {
        const credentials = (await this.getCredentials(constants_1.CREDENTIAL_TYPE));
        if (credentials) {
            const host = credentials.host.replace(/\/$/, '');
            csrfToken = await getCsrfToken.call(this, host, resolvedServicePath);
        }
    }
    const requestFunction = async (qs, uri) => {
        const config = {
            method,
            resource: uri ? '' : resource,
            body,
            qs: qs || query,
            uri,
            option: {},
            csrfToken,
            servicePath: resolvedServicePath,
        };
        return ApiClient_1.executeRequest.call(this, config);
    };
    const config = {
        propertyName,
        continueOnFail,
        maxItems,
    };
    return (0, PaginationHandler_1.fetchAllItems)(requestFunction, config);
}
function buildODataFilter(filters) {
    return (0, QueryBuilder_1.buildODataFilter)(filters);
}
function buildODataQuery(options) {
    return (0, QueryBuilder_1.buildODataQuery)(options);
}
function parseMetadataForEntitySets(metadataXml) {
    return (0, QueryBuilder_1.parseMetadataForEntitySets)(metadataXml);
}
function parseMetadataForFunctionImports(metadataXml) {
    return (0, QueryBuilder_1.parseMetadataForFunctionImports)(metadataXml);
}
function formatSapODataValue(value, typeHint) {
    return (0, ODataValueFormatter_1.formatODataValue)(value, typeHint, { autoDetect: true, warnOnAutoDetect: false });
}
