"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapOdataWebhookApi = void 0;
class SapOdataWebhookApi {
    constructor() {
        this.name = 'sapOdataWebhookApi';
        this.displayName = 'ATW SAP OData Webhook API';
        this.documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
        this.properties = [
            {
                displayName: 'Shared Secret or Token',
                name: 'secret',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                placeholder: 'your-secret-webhook-token',
                description: 'Secret token or shared secret used for authentication. For HMAC: shared secret key. For Header/Query auth: static token.',
                required: true,
                hint: 'For HMAC: Use a strong, randomly generated secret (at least 32 characters)',
            },
            {
                displayName: 'Signature Algorithm',
                name: 'algorithm',
                type: 'options',
                options: [
                    {
                        name: 'SHA-256',
                        value: 'sha256',
                        description: 'HMAC-SHA256 (recommended)',
                    },
                    {
                        name: 'SHA-512',
                        value: 'sha512',
                        description: 'HMAC-SHA512 (more secure but slower)',
                    },
                ],
                default: 'sha256',
                description: 'Hash algorithm for HMAC signature (only used with HMAC authentication)',
            },
            {
                displayName: 'Signature Header Name',
                name: 'headerName',
                type: 'string',
                default: 'X-SAP-Signature',
                placeholder: 'X-SAP-Signature',
                description: 'Name of the HTTP header that will contain the signature or token',
            },
        ];
    }
}
exports.SapOdataWebhookApi = SapOdataWebhookApi;
