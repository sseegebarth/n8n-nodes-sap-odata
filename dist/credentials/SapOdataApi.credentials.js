"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapOdataApi = void 0;
class SapOdataApi {
    constructor() {
        this.name = 'sapOdataApi';
        this.displayName = 'ATW SAP OData API';
        this.documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
        this.properties = [
            {
                displayName: 'Host',
                name: 'host',
                type: 'string',
                default: '',
                placeholder: 'https://your-sap-system.com:8443',
                description: 'The SAP system URL including protocol and port (e.g., https://sap-server.com:8443)',
                required: true,
            },
            {
                displayName: 'Authentication',
                name: 'authentication',
                type: 'options',
                options: [
                    {
                        name: 'None',
                        value: 'none',
                        description: 'No authentication (for public OData services)',
                    },
                    {
                        name: 'Basic Auth',
                        value: 'basicAuth',
                    },
                ],
                default: 'none',
                description: 'Authentication method to use',
            },
            {
                displayName: 'Username',
                name: 'username',
                type: 'string',
                default: '',
                displayOptions: {
                    show: {
                        authentication: ['basicAuth'],
                    },
                },
                required: true,
            },
            {
                displayName: 'Password',
                name: 'password',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                displayOptions: {
                    show: {
                        authentication: ['basicAuth'],
                    },
                },
                required: true,
            },
            {
                displayName: 'Ignore SSL Issues',
                name: 'allowUnauthorizedCerts',
                type: 'boolean',
                default: false,
                description: 'Whether to connect even if SSL certificate validation is not possible',
                hint: '⚠️ SECURITY WARNING: Only use in development environments! Production systems should always use valid SSL certificates. Disabling SSL validation exposes your connection to man-in-the-middle attacks.',
            },
            {
                displayName: 'SAP Client',
                name: 'sapClient',
                type: 'string',
                default: '',
                placeholder: '100',
                description: 'SAP Client number (Mandant). Will be sent as sap-client header.',
                hint: 'Common SAP client numbers: 100 (DEV), 200 (QA), 300 (PROD)',
            },
            {
                displayName: 'SAP Language',
                name: 'sapLanguage',
                type: 'string',
                default: '',
                placeholder: 'EN',
                description: 'SAP language code. Will be sent as sap-language header.',
                hint: 'Common language codes: EN (English), DE (German), FR (French), ES (Spanish)',
            },
            {
                displayName: 'Custom Headers',
                name: 'customHeaders',
                type: 'json',
                default: '{}',
                description: 'Additional HTTP headers to send with every request (as JSON object)',
                placeholder: '{"X-Custom-Header": "value"}',
            },
            {
                displayName: 'OData Version',
                name: 'version',
                type: 'options',
                options: [
                    {
                        name: 'Auto-Detect',
                        value: 'auto',
                        description: 'Automatically detect OData version from service metadata',
                    },
                    {
                        name: 'OData V2',
                        value: 'v2',
                        description: 'Use OData V2 protocol (most common in SAP)',
                    },
                    {
                        name: 'OData V4',
                        value: 'v4',
                        description: 'Use OData V4 protocol (newer SAP services)',
                    },
                ],
                default: 'auto',
                description: 'The OData protocol version. Auto-detect will determine the version from the service response.',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                auth: {
                    username: '={{$credentials.username}}',
                    password: '={{$credentials.password}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.host}}',
                url: '/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/',
                method: 'GET',
                skipSslCertificateValidation: '={{$credentials.allowUnauthorizedCerts}}',
                headers: {
                    'sap-client': '={{$credentials.sapClient}}',
                    'sap-language': '={{$credentials.sapLanguage}}',
                },
            },
        };
    }
}
exports.SapOdataApi = SapOdataApi;
