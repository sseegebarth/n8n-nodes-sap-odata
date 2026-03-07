"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapOdataApi = void 0;
class SapOdataApi {
    constructor() {
        this.name = 'sapOdataApi';
        this.displayName = 'Avanai SAP OData API';
        this.documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
        this.icon = 'file:../nodes/SapOData/sap.svg';
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
                        description: 'Username and password (On-Premise SAP systems)',
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
                description: 'Whether to connect even if SSL certificate validation is not possible. Only use in development environments.',
            },
            {
                displayName: 'Allow Private Network Access',
                name: 'allowPrivateIps',
                type: 'boolean',
                default: false,
                description: 'Whether to allow connections to private IP ranges (10.x, 172.16-31.x, 192.168.x). Enable this for on-premise SAP systems.',
            },
            {
                displayName: 'SAP Client',
                name: 'sapClient',
                type: 'string',
                default: '',
                placeholder: '100',
                description: 'SAP Client number (Mandant). Will be sent as sap-client header. Common values: 100 (DEV), 200 (QA), 300 (PROD)',
            },
            {
                displayName: 'SAP Language',
                name: 'sapLanguage',
                type: 'string',
                default: '',
                placeholder: 'EN',
                description: 'SAP language code. Will be sent as sap-language header. Common codes: EN, DE, FR, ES',
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
                url: '/',
                skipSslCertificateValidation: '={{$credentials.allowUnauthorizedCerts}}',
                ignoreHttpStatusErrors: true,
            },
        };
    }
}
exports.SapOdataApi = SapOdataApi;
