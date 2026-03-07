"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapOdataOAuth2Api = void 0;
class SapOdataOAuth2Api {
    constructor() {
        this.name = 'sapOdataOAuth2Api';
        this.extends = ['oAuth2Api'];
        this.displayName = 'Avanai SAP OData OAuth2 API';
        this.documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
        this.icon = 'file:../nodes/SapOData/sap.svg';
        this.properties = [
            {
                displayName: 'Host',
                name: 'host',
                type: 'string',
                default: '',
                placeholder: 'https://your-sap-system.com:8443',
                description: 'The SAP system URL including protocol and port',
                required: true,
            },
            {
                displayName: 'SAP Client',
                name: 'sapClient',
                type: 'string',
                default: '',
                placeholder: '100',
                description: 'SAP Client number (Mandant). Not required for SAP Cloud.',
            },
            {
                displayName: 'SAP Language',
                name: 'sapLanguage',
                type: 'string',
                default: '',
                placeholder: 'EN',
                description: 'SAP language code (e.g., EN, DE, FR)',
            },
            {
                displayName: 'Ignore SSL Issues',
                name: 'allowUnauthorizedCerts',
                type: 'boolean',
                default: false,
                description: 'Whether to connect even if SSL certificate validation fails. Only use in development environments.',
            },
        ];
    }
}
exports.SapOdataOAuth2Api = SapOdataOAuth2Api;
