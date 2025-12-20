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
exports.discoverServices = discoverServices;
exports.getCommonServices = getCommonServices;
exports.searchServices = searchServices;
exports.groupServicesByCategory = groupServicesByCategory;
const LoggerAdapter_1 = require("../../lib/utils/LoggerAdapter");
const CATALOGSERVICE_PATH = '/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/';
async function discoverServices(context) {
    var _a;
    try {
        const { sapOdataApiRequest } = await Promise.resolve().then(() => __importStar(require('./GenericFunctions')));
        const response = await sapOdataApiRequest.call(context, 'GET', '/ServiceCollection', {}, {
            $orderby: 'Title asc',
        }, undefined, {}, CATALOGSERVICE_PATH);
        const results = ((_a = response === null || response === void 0 ? void 0 : response.d) === null || _a === void 0 ? void 0 : _a.results) || [];
        const services = results
            .filter((entry) => {
            return entry.TechnicalServiceName && entry.ID;
        })
            .map((entry) => {
            let servicePath;
            if (entry.ServiceUrl) {
                servicePath = entry.ServiceUrl;
                if (!servicePath.endsWith('/')) {
                    servicePath += '/';
                }
            }
            else if (entry.BaseUrl) {
                servicePath = entry.BaseUrl;
                if (!servicePath.endsWith('/')) {
                    servicePath += '/';
                }
            }
            else {
                const serviceNameForUrl = entry.ID || entry.TechnicalServiceName;
                const namespace = entry.Namespace || 'sap';
                servicePath = constructServicePath(serviceNameForUrl, entry.TechnicalServiceVersion, namespace);
            }
            return {
                id: entry.ID,
                title: entry.Title || entry.TechnicalServiceName || 'Unknown Service',
                technicalName: entry.TechnicalServiceName,
                servicePath,
                version: entry.TechnicalServiceVersion || '1',
                description: entry.Description,
            };
        });
        return services;
    }
    catch (error) {
        LoggerAdapter_1.LoggerAdapter.debug('Catalog service unavailable', {
            module: 'DiscoveryService',
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}
function constructServicePath(serviceName, version, namespace = 'sap') {
    let path = `/sap/opu/odata/${namespace}/${serviceName}/`;
    if (version && version !== '1' && version !== '0001') {
        path = `/sap/opu/odata/${namespace}/${serviceName};v=${version}/`;
    }
    return path;
}
function getCommonServices() {
    return [
        {
            id: 'api_business_partner',
            title: 'Business Partner API',
            technicalName: 'API_BUSINESS_PARTNER',
            servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
            version: '1',
            description: 'Manage business partners, customers, and suppliers',
        },
        {
            id: 'api_sales_order',
            title: 'Sales Order API',
            technicalName: 'API_SALES_ORDER_SRV',
            servicePath: '/sap/opu/odata/sap/API_SALES_ORDER_SRV/',
            version: '1',
            description: 'Create, read, update sales orders',
        },
        {
            id: 'api_purchase_order',
            title: 'Purchase Order API',
            technicalName: 'API_PURCHASEORDER_PROCESS_SRV',
            servicePath: '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/',
            version: '1',
            description: 'Manage purchase orders',
        },
        {
            id: 'api_material_document',
            title: 'Material Document API',
            technicalName: 'API_MATERIAL_DOCUMENT_SRV',
            servicePath: '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/',
            version: '1',
            description: 'Post goods movements and inventory transactions',
        },
        {
            id: 'api_product',
            title: 'Product Master API',
            technicalName: 'API_PRODUCT_SRV',
            servicePath: '/sap/opu/odata/sap/API_PRODUCT_SRV/',
            version: '1',
            description: 'Manage product master data',
        },
        {
            id: 'api_invoice',
            title: 'Invoice API',
            technicalName: 'API_BILLING_DOCUMENT_SRV',
            servicePath: '/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/',
            version: '1',
            description: 'Create and manage billing documents and invoices',
        },
        {
            id: 'api_delivery',
            title: 'Delivery API',
            technicalName: 'API_OUTBOUND_DELIVERY_SRV',
            servicePath: '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV/',
            version: '1',
            description: 'Manage outbound deliveries',
        },
        {
            id: 'z_custom_service',
            title: 'Custom Service Example',
            technicalName: 'Z_CUSTOM_SERVICE',
            servicePath: '/sap/opu/odata/sap/Z_CUSTOM_SERVICE/',
            version: '1',
            description: 'Customer-specific service (example)',
        },
        {
            id: 'y_custom_service',
            title: 'Y-Namespace Example',
            technicalName: 'Y_CUSTOM_API',
            servicePath: '/sap/opu/odata/sap/Y_CUSTOM_API/',
            version: '1',
            description: 'Customer-specific Y-namespace service (example)',
        },
    ];
}
function searchServices(services, keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return services.filter((service) => {
        var _a;
        return service.title.toLowerCase().includes(lowerKeyword) ||
            service.technicalName.toLowerCase().includes(lowerKeyword) ||
            ((_a = service.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(lowerKeyword));
    });
}
function groupServicesByCategory(services) {
    const groups = {
        'SAP Standard APIs': [],
        'Custom Services (Z*)': [],
        'Other Services': [],
    };
    services.forEach((service) => {
        const isStandardAPI = service.technicalName.startsWith('API_') ||
            service.technicalName.startsWith('C_') ||
            service.title.startsWith('API_') ||
            service.title.startsWith('C_');
        const isWrappedStandardAPI = /^Z(API_|C_)/.test(service.technicalName);
        if (isStandardAPI || isWrappedStandardAPI) {
            groups['SAP Standard APIs'].push(service);
        }
        else if (service.technicalName.startsWith('Z') || service.technicalName.startsWith('Y')) {
            groups['Custom Services (Z*)'].push(service);
        }
        else {
            groups['Other Services'].push(service);
        }
    });
    return groups;
}
