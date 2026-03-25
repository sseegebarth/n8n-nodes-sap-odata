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
exports.sapODataListSearch = exports.sapODataLoadOptions = void 0;
const QueryBuilder_1 = require("../../lib/core/QueryBuilder");
const GenericFunctions_1 = require("./GenericFunctions");
exports.sapODataLoadOptions = {
    async getServices() {
        try {
            const { discoverServices, getCommonServices } = await Promise.resolve().then(() => __importStar(require('./DiscoveryService')));
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            const credentials = await this.getCredentials('sapOdataApi');
            const cached = await CacheManager.getServiceCatalog(this, credentials.host);
            if (cached && cached.length > 0) {
                return cached.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description,
                }));
            }
            const discoveredServices = await discoverServices(this);
            if (discoveredServices && discoveredServices.length > 0) {
                await CacheManager.setServiceCatalog(this, credentials.host, discoveredServices);
                return discoveredServices.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description,
                }));
            }
            const commonServices = getCommonServices();
            return [
                {
                    name: '[Warning] Could Not Load Services From SAP - Showing Common Services',
                    value: '',
                    description: 'Switch to "Custom" mode to enter service path manually',
                },
                ...commonServices.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description,
                })),
            ];
        }
        catch {
            const { getCommonServices } = await Promise.resolve().then(() => __importStar(require('./DiscoveryService')));
            const commonServices = getCommonServices();
            return [
                {
                    name: '[Warning] Service Discovery Failed - Showing Common Services',
                    value: '',
                    description: 'Switch to "Custom" mode to enter service path manually',
                },
                ...commonServices.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description,
                })),
            ];
        }
    },
    async getDiscoveredServices() {
        var _a, _b, _c, _d;
        try {
            const { discoverServices, getCommonServices } = await Promise.resolve().then(() => __importStar(require('./DiscoveryService')));
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            const credentials = await this.getCredentials('sapOdataApi');
            const cached = await CacheManager.getServiceCatalog(this, credentials.host);
            if (cached && cached.length > 0) {
                return cached.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description || 'No description available',
                }));
            }
            const discoveredServices = await discoverServices(this);
            if (discoveredServices && discoveredServices.length > 0) {
                await CacheManager.setServiceCatalog(this, credentials.host, discoveredServices);
                const sortedServices = discoveredServices.sort((a, b) => {
                    const aIsStandard = a.technicalName.startsWith('API_') || a.technicalName.startsWith('C_');
                    const bIsStandard = b.technicalName.startsWith('API_') || b.technicalName.startsWith('C_');
                    const aIsCustom = a.technicalName.startsWith('Z') || a.technicalName.startsWith('Y');
                    const bIsCustom = b.technicalName.startsWith('Z') || b.technicalName.startsWith('Y');
                    if (aIsStandard && !bIsStandard)
                        return -1;
                    if (!aIsStandard && bIsStandard)
                        return 1;
                    if (aIsCustom && !bIsCustom)
                        return 1;
                    if (!aIsCustom && bIsCustom)
                        return -1;
                    return a.technicalName.localeCompare(b.technicalName);
                });
                return sortedServices.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description || 'No description available',
                }));
            }
            const commonServices = getCommonServices();
            return [
                ...commonServices.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description || 'No description available',
                })),
                {
                    name: '─────────────────────────────────',
                    value: ((_a = commonServices[0]) === null || _a === void 0 ? void 0 : _a.servicePath) || '/sap/opu/odata/sap/',
                    description: 'Separator',
                },
                {
                    name: '[Warning] Auto-Discovery Unavailable - Using Common Services List',
                    value: ((_b = commonServices[0]) === null || _b === void 0 ? void 0 : _b.servicePath) || '/sap/opu/odata/sap/',
                    description: 'Check credentials and Gateway Catalog Service (/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/) access or switch to Custom mode',
                },
            ];
        }
        catch {
            const { getCommonServices } = await Promise.resolve().then(() => __importStar(require('./DiscoveryService')));
            const commonServices = getCommonServices();
            return [
                ...commonServices.map((service) => ({
                    name: `${service.title} (${service.technicalName})`,
                    value: service.servicePath,
                    description: service.description || 'No description available',
                })),
                {
                    name: '─────────────────────────────────',
                    value: ((_c = commonServices[0]) === null || _c === void 0 ? void 0 : _c.servicePath) || '/sap/opu/odata/sap/',
                    description: 'Separator',
                },
                {
                    name: '[Warning] Auto-Discovery Failed - Using Common Services List',
                    value: ((_d = commonServices[0]) === null || _d === void 0 ? void 0 : _d.servicePath) || '/sap/opu/odata/sap/',
                    description: 'Check connection or switch to "Custom" mode to enter service path manually',
                },
            ];
        }
    },
    async getEntitySets() {
        try {
            const credentials = await this.getCredentials('sapOdataApi');
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            let servicePath = '';
            const servicePathMode = this.getCurrentNodeParameter('servicePathMode') || '';
            if (servicePathMode === 'discover') {
                servicePath = this.getCurrentNodeParameter('discoveredService') || '';
            }
            else if (servicePathMode === 'custom') {
                servicePath = this.getCurrentNodeParameter('servicePath') || '';
            }
            if (!servicePath || servicePath === '') {
                const discovered = this.getCurrentNodeParameter('discoveredService') || '';
                const custom = this.getCurrentNodeParameter('servicePath') || '';
                servicePath = discovered || custom || '';
            }
            if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap' || servicePath === '/sap/opu/odata/sap/') {
                return [
                    {
                        name: '[Warning] No Service Selected',
                        value: '',
                        description: 'Please select a service from the "Service" dropdown above first',
                    },
                ];
            }
            const cached = await CacheManager.getMetadata(this, credentials.host, servicePath);
            if (cached && cached.entitySets) {
                return cached.entitySets.map((entitySet) => ({
                    name: entitySet,
                    value: entitySet,
                }));
            }
            const metadataXml = await GenericFunctions_1.sapOdataApiRequest.call(this, 'GET', '/$metadata');
            const entitySets = (0, QueryBuilder_1.parseMetadataForEntitySets)(typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml));
            const functionImports = (0, QueryBuilder_1.parseMetadataForFunctionImports)(typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml));
            await CacheManager.setMetadata(this, credentials.host, servicePath, entitySets, functionImports);
            return entitySets.map((entitySet) => ({
                name: entitySet,
                value: entitySet,
            }));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isForbidden = errorMessage.toLowerCase().includes('forbidden') ||
                errorMessage.toLowerCase().includes('403');
            if (isForbidden) {
                return [
                    {
                        name: '[Warning] Access Forbidden - Missing SAP Authorizations',
                        value: '',
                        description: 'Your SAP user lacks permissions for this service. Contact SAP Administrator or switch to "Custom" mode.',
                    },
                ];
            }
            return [
                {
                    name: `[Warning] Could not load entity sets - ${errorMessage.substring(0, 60)}`,
                    value: '',
                    description: 'Switch to "Custom" mode in "Entity Set Mode" to enter the name manually',
                },
            ];
        }
    },
    async getFunctionImports() {
        try {
            const credentials = await this.getCredentials('sapOdataApi');
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            const servicePath = (0, GenericFunctions_1.resolveServicePath)(this);
            const cached = await CacheManager.getMetadata(this, credentials.host, servicePath);
            if (cached && cached.functionImports) {
                return cached.functionImports.map((functionImport) => ({
                    name: functionImport,
                    value: functionImport,
                }));
            }
            const metadataXml = await GenericFunctions_1.sapOdataApiRequest.call(this, 'GET', '/$metadata');
            const entitySets = (0, QueryBuilder_1.parseMetadataForEntitySets)(typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml));
            const functionImports = (0, QueryBuilder_1.parseMetadataForFunctionImports)(typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml));
            await CacheManager.setMetadata(this, credentials.host, servicePath, entitySets, functionImports);
            return functionImports.map((functionImport) => ({
                name: functionImport,
                value: functionImport,
            }));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return [
                {
                    name: `[Warning] Could not load function imports - ${errorMessage.substring(0, 60)}`,
                    value: '',
                    description: 'Switch to "Custom" mode in "Function Name Mode" to enter the name manually',
                },
            ];
        }
    },
};
exports.sapODataListSearch = {
    async servicePathSearch(filter, _paginationToken) {
        try {
            const { discoverServices, getCommonServices } = await Promise.resolve().then(() => __importStar(require('./DiscoveryService')));
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            const credentials = await this.getCredentials('sapOdataApi');
            const host = credentials.host;
            let services = await CacheManager.getServiceCatalog(this, host);
            if (!services || services.length === 0) {
                const discoveredServices = await discoverServices(this);
                if (discoveredServices && discoveredServices.length > 0) {
                    await CacheManager.setServiceCatalog(this, host, discoveredServices);
                    services = discoveredServices;
                }
                else {
                    services = getCommonServices();
                }
            }
            let filteredServices = services;
            if (filter) {
                const lowerFilter = filter.toLowerCase();
                filteredServices = services.filter((service) => service.title.toLowerCase().includes(lowerFilter) ||
                    service.technicalName.toLowerCase().includes(lowerFilter) ||
                    service.servicePath.toLowerCase().includes(lowerFilter));
            }
            filteredServices.sort((a, b) => {
                const aIsStandard = a.technicalName.startsWith('API_') || a.technicalName.startsWith('C_');
                const bIsStandard = b.technicalName.startsWith('API_') || b.technicalName.startsWith('C_');
                if (aIsStandard && !bIsStandard)
                    return -1;
                if (!aIsStandard && bIsStandard)
                    return 1;
                return a.technicalName.localeCompare(b.technicalName);
            });
            const results = filteredServices.map((service) => ({
                name: `${service.title} (${service.technicalName})`,
                value: service.servicePath,
                url: `${host}${service.servicePath}`,
            }));
            return { results };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const { getCommonServices } = await Promise.resolve().then(() => __importStar(require('./DiscoveryService')));
            const commonServices = getCommonServices();
            return {
                results: [
                    {
                        name: `[Warning] Discovery failed: ${errorMessage.substring(0, 40)}`,
                        value: '',
                    },
                    ...commonServices.map((service) => ({
                        name: `${service.title} (${service.technicalName})`,
                        value: service.servicePath,
                    })),
                ],
            };
        }
    },
    async entitySetSearch(filter, _paginationToken) {
        try {
            const credentials = await this.getCredentials('sapOdataApi');
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            const servicePathParam = this.getCurrentNodeParameter('servicePath');
            let servicePath = '';
            if (typeof servicePathParam === 'object' && servicePathParam !== null) {
                servicePath = servicePathParam.value || '';
            }
            else if (typeof servicePathParam === 'string') {
                servicePath = servicePathParam;
            }
            if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap' || servicePath === '/sap/opu/odata/sap/') {
                return {
                    results: [{
                            name: '[Warning] No Service Selected - Please Select a Service First',
                            value: '',
                        }],
                };
            }
            let entitySets = [];
            const cached = await CacheManager.getMetadata(this, credentials.host, servicePath);
            if (cached && cached.entitySets) {
                entitySets = cached.entitySets;
            }
            else {
                const metadataXml = await GenericFunctions_1.sapOdataApiRequest.call(this, 'GET', '/$metadata');
                entitySets = (0, QueryBuilder_1.parseMetadataForEntitySets)(typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml));
                const functionImports = (0, QueryBuilder_1.parseMetadataForFunctionImports)(typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml));
                await CacheManager.setMetadata(this, credentials.host, servicePath, entitySets, functionImports);
            }
            let filteredEntitySets = entitySets;
            if (filter) {
                const lowerFilter = filter.toLowerCase();
                filteredEntitySets = entitySets.filter((entitySet) => entitySet.toLowerCase().includes(lowerFilter));
            }
            const host = credentials.host;
            const results = filteredEntitySets.map((entitySet) => ({
                name: entitySet,
                value: entitySet,
                url: `${host}${servicePath}${entitySet}`,
            }));
            return { results };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const isForbidden = errorMessage.toLowerCase().includes('forbidden') ||
                errorMessage.toLowerCase().includes('403');
            if (isForbidden) {
                return {
                    results: [{
                            name: '[Warning] Access Forbidden - Missing SAP Authorizations',
                            value: '',
                        }],
                };
            }
            return {
                results: [{
                        name: `[Warning] Error: ${errorMessage.substring(0, 50)}`,
                        value: '',
                    }],
            };
        }
    },
    async functionImportSearch(filter, _paginationToken) {
        try {
            const credentials = await this.getCredentials('sapOdataApi');
            const { CacheManager } = await Promise.resolve().then(() => __importStar(require('../../lib/utils/CacheManager')));
            const servicePathParam = this.getCurrentNodeParameter('servicePath');
            let servicePath = '';
            if (typeof servicePathParam === 'object' && servicePathParam !== null) {
                servicePath = servicePathParam.value || '';
            }
            else if (typeof servicePathParam === 'string') {
                servicePath = servicePathParam;
            }
            if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap' || servicePath === '/sap/opu/odata/sap/') {
                return {
                    results: [{
                            name: '[Warning] No Service Selected - Please Select a Service First',
                            value: '',
                        }],
                };
            }
            const metadataXml = await GenericFunctions_1.sapOdataApiRequest.call(this, 'GET', '/$metadata');
            const metadataStr = typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml);
            const callables = (0, QueryBuilder_1.parseMetadataForCallables)(metadataStr);
            const entitySets = (0, QueryBuilder_1.parseMetadataForEntitySets)(metadataStr);
            const functionImports = callables.map((c) => c.name);
            await CacheManager.setMetadata(this, credentials.host, servicePath, entitySets, functionImports);
            let filtered = callables;
            if (filter) {
                const lowerFilter = filter.toLowerCase();
                filtered = callables.filter((c) => c.name.toLowerCase().includes(lowerFilter));
            }
            const typeLabels = {
                FunctionImport: 'Function Import',
                Action: 'Action',
                Function: 'Function',
            };
            const results = filtered.map((c) => ({
                name: `[${typeLabels[c.type]}] ${c.name}`,
                value: `${c.type}::${c.name}`,
            }));
            return { results };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                results: [{
                        name: `[Warning] Error: ${errorMessage.substring(0, 50)}`,
                        value: '',
                    }],
            };
        }
    },
};
