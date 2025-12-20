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
exports.SapODataWebhook = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const constants_1 = require("../../lib/constants");
const LoggerAdapter_1 = require("../../lib/utils/LoggerAdapter");
const SecurityUtils_1 = require("../../lib/utils/SecurityUtils");
const WebhookUtils_1 = require("../../lib/utils/WebhookUtils");
const constants_2 = require("../../lib/constants");
class SapODataWebhook {
    constructor() {
        this.description = {
            displayName: 'ATW SAP Connect OData Webhook',
            name: 'sapODataTrigger',
            icon: 'file:sap.svg',
            group: ['trigger'],
            version: 1,
            subtitle: '={{$parameter["event"]}}',
            description: 'Receives SAP events via webhook (real-time notifications for OData changes)',
            defaults: {
                name: 'SAP Connect OData Webhook',
            },
            inputs: [],
            outputs: ['main'],
            credentials: [
                {
                    name: 'sapOdataWebhookApi',
                    required: false,
                    displayOptions: {
                        show: {
                            authentication: ['headerAuth'],
                        },
                    },
                },
            ],
            webhooks: [
                {
                    name: 'default',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                    path: 'webhook',
                },
            ],
            properties: [
                {
                    displayName: 'Authentication',
                    name: 'authentication',
                    type: 'options',
                    options: [
                        {
                            name: 'None',
                            value: 'none',
                            description: 'No authentication (not recommended)',
                        },
                        {
                            name: 'HMAC Signature',
                            value: 'hmacSignature',
                            description: 'Validate using HMAC signature (recommended)',
                        },
                        {
                            name: 'Header Auth',
                            value: 'headerAuth',
                            description: 'Validate using HTTP header token',
                        },
                        {
                            name: 'Query String',
                            value: 'queryAuth',
                            description: 'Validate using query parameter token',
                        },
                    ],
                    default: 'hmacSignature',
                    description: 'Method to authenticate incoming webhook requests',
                },
                {
                    displayName: 'Header Name',
                    name: 'headerName',
                    type: 'string',
                    displayOptions: {
                        show: {
                            authentication: ['headerAuth', 'hmacSignature'],
                        },
                    },
                    default: 'X-SAP-Signature',
                    placeholder: 'X-SAP-Signature',
                    description: 'Name of the header that contains the signature or authentication token',
                    required: true,
                },
                {
                    displayName: 'Header Value',
                    name: 'headerValue',
                    type: 'string',
                    displayOptions: {
                        show: {
                            authentication: ['headerAuth'],
                        },
                    },
                    default: '',
                    placeholder: 'your-secret-token',
                    description: 'Expected value of the authentication header',
                    required: true,
                    typeOptions: {
                        password: true,
                    },
                },
                {
                    displayName: 'Query Parameter Name',
                    name: 'queryParameterName',
                    type: 'string',
                    displayOptions: {
                        show: {
                            authentication: ['queryAuth'],
                        },
                    },
                    default: 'token',
                    placeholder: 'token',
                    description: 'Name of the query parameter that contains the authentication token',
                    required: true,
                },
                {
                    displayName: 'Query Parameter Value',
                    name: 'queryParameterValue',
                    type: 'string',
                    displayOptions: {
                        show: {
                            authentication: ['queryAuth'],
                        },
                    },
                    default: '',
                    placeholder: 'your-secret-token',
                    description: 'Expected value of the query parameter',
                    required: true,
                    typeOptions: {
                        password: true,
                    },
                },
                {
                    displayName: 'Response',
                    name: 'responseMode',
                    type: 'options',
                    options: [
                        {
                            name: 'Immediately',
                            value: 'immediate',
                            description: 'Respond immediately with success',
                        },
                        {
                            name: 'When Workflow Finishes',
                            value: 'afterWorkflow',
                            description: 'Wait for workflow to finish before responding',
                        },
                    ],
                    default: 'immediate',
                    description: 'When to respond to the webhook request',
                },
                {
                    displayName: 'Response Code',
                    name: 'responseCode',
                    type: 'number',
                    typeOptions: {
                        minValue: 100,
                        maxValue: 599,
                    },
                    default: 200,
                    description: 'HTTP status code to return',
                },
                {
                    displayName: 'Event Filter',
                    name: 'eventFilter',
                    type: 'options',
                    options: [
                        {
                            name: 'All Events',
                            value: 'all',
                            description: 'Trigger on all incoming events',
                        },
                        {
                            name: 'Specific Entity Type',
                            value: 'entityType',
                            description: 'Filter by SAP entity type (e.g., SalesOrder)',
                        },
                        {
                            name: 'Specific Operation',
                            value: 'operation',
                            description: 'Filter by operation type (Create, Update, Delete)',
                        },
                    ],
                    default: 'all',
                    description: 'Filter which events should trigger the workflow',
                },
                {
                    displayName: 'Entity Type',
                    name: 'entityType',
                    type: 'string',
                    displayOptions: {
                        show: {
                            eventFilter: ['entityType'],
                        },
                    },
                    default: '',
                    placeholder: 'SalesOrder, Material, Customer',
                    description: 'Only trigger for this entity type (comma-separated for multiple)',
                },
                {
                    displayName: 'Operation Type',
                    name: 'operationType',
                    type: 'multiOptions',
                    displayOptions: {
                        show: {
                            eventFilter: ['operation'],
                        },
                    },
                    options: [
                        {
                            name: 'Create',
                            value: 'create',
                        },
                        {
                            name: 'Update',
                            value: 'update',
                        },
                        {
                            name: 'Delete',
                            value: 'delete',
                        },
                    ],
                    default: ['create', 'update'],
                    description: 'Only trigger for these operation types',
                },
                {
                    displayName: 'Options',
                    name: 'options',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    options: [
                        {
                            displayName: 'Validate SAP Payload Format',
                            name: 'validatePayload',
                            type: 'boolean',
                            default: true,
                            description: 'Whether to validate that the payload matches SAP OData event format',
                        },
                        {
                            displayName: 'Extract Changed Fields Only',
                            name: 'extractChangedFields',
                            type: 'boolean',
                            default: false,
                            description: 'Whether to extract only the fields that changed (requires old/new values in payload)',
                        },
                        {
                            displayName: 'Parse SAP Date Formats',
                            name: 'parseDates',
                            type: 'boolean',
                            default: true,
                            description: 'Whether to convert SAP date formats (/Date(...)/) to ISO 8601',
                        },
                        {
                            displayName: 'IP Whitelist',
                            name: 'ipWhitelist',
                            type: 'string',
                            default: '',
                            placeholder: '10.0.0.1,192.168.0.0/24,172.16.0.0/12',
                            description: 'Comma-separated list of allowed IP addresses or CIDR ranges. Leave empty to allow all IPs. Only requests from whitelisted IPs will be accepted.',
                        },
                        {
                            displayName: 'Custom Response Body',
                            name: 'responseBody',
                            type: 'json',
                            default: '{"status": "received"}',
                            placeholder: '{"status": "received"}',
                            description: 'Custom JSON response body to return',
                        },
                        {
                            displayName: 'Enable Rate Limiting',
                            name: 'enableRateLimiting',
                            type: 'boolean',
                            default: true,
                            description: 'Whether to limit requests per IP address to prevent abuse',
                        },
                        {
                            displayName: 'Rate Limit (Requests/Minute)',
                            name: 'rateLimit',
                            type: 'number',
                            default: 100,
                            displayOptions: {
                                show: {
                                    enableRateLimiting: [true],
                                },
                            },
                            description: 'Maximum requests per minute per IP address',
                        },
                    ],
                },
            ],
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    try {
                        const staticData = this.getWorkflowStaticData('node');
                        const subscriptionId = staticData.subscriptionId;
                        if (!subscriptionId) {
                            return false;
                        }
                        const credentials = await this.getCredentials('sapOdataApi').catch(() => null);
                        if (!credentials) {
                            return true;
                        }
                        try {
                            const { sapOdataApiRequest } = await Promise.resolve().then(() => __importStar(require('../SapOData/GenericFunctions')));
                            await sapOdataApiRequest.call(this, 'GET', `/sap/opu/odata/IWBEP/NOTIFICATION_SRV/Subscriptions('${subscriptionId}')`);
                            return true;
                        }
                        catch (error) {
                            delete staticData.subscriptionId;
                            return false;
                        }
                    }
                    catch (error) {
                        return false;
                    }
                },
                async create() {
                    var _a;
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const authentication = this.getNodeParameter('authentication');
                    try {
                        const credentials = await this.getCredentials('sapOdataApi').catch(() => null);
                        if (!credentials) {
                            LoggerAdapter_1.LoggerAdapter.info('No SAP OData credentials found - webhook will receive events but not auto-register', {
                                module: 'SapODataWebhook',
                                operation: 'create',
                            });
                            return true;
                        }
                        const eventFilter = this.getNodeParameter('eventFilter', {});
                        const subscriptionPayload = {
                            DeliveryAddress: webhookUrl,
                            PersistNotifications: true,
                        };
                        if (eventFilter.entitySet) {
                            subscriptionPayload.Collection = eventFilter.entitySet;
                        }
                        if (eventFilter.changeType) {
                            subscriptionPayload.ChangeType = eventFilter.changeType;
                        }
                        if (eventFilter.filter) {
                            subscriptionPayload.Filter = eventFilter.filter;
                        }
                        if (authentication === 'hmacSignature') {
                            subscriptionPayload.AuthType = 'HMAC';
                            subscriptionPayload.SignatureHeader = this.getNodeParameter('headerName', 'X-SAP-Signature');
                        }
                        const { sapOdataApiRequest } = await Promise.resolve().then(() => __importStar(require('../SapOData/GenericFunctions')));
                        const response = await sapOdataApiRequest.call(this, 'POST', '/sap/opu/odata/IWBEP/NOTIFICATION_SRV/Subscriptions', subscriptionPayload);
                        const staticData = this.getWorkflowStaticData('node');
                        staticData.subscriptionId = ((_a = response === null || response === void 0 ? void 0 : response.d) === null || _a === void 0 ? void 0 : _a.SubscriptionID) || (response === null || response === void 0 ? void 0 : response.SubscriptionID) || (response === null || response === void 0 ? void 0 : response.id);
                        LoggerAdapter_1.LoggerAdapter.info('SAP OData Webhook registered', {
                            module: 'SapODataWebhook',
                            operation: 'create',
                            webhookUrl,
                            subscriptionId: staticData.subscriptionId,
                        });
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        LoggerAdapter_1.LoggerAdapter.warn('Failed to auto-register webhook with SAP - manual configuration may be required', {
                            module: 'SapODataWebhook',
                            operation: 'create',
                            error: (0, SecurityUtils_1.sanitizeErrorMessage)(errorMessage),
                        });
                    }
                    return true;
                },
                async delete() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    try {
                        const staticData = this.getWorkflowStaticData('node');
                        const subscriptionId = staticData.subscriptionId;
                        if (subscriptionId) {
                            const credentials = await this.getCredentials('sapOdataApi').catch(() => null);
                            if (credentials) {
                                const { sapOdataApiRequest } = await Promise.resolve().then(() => __importStar(require('../SapOData/GenericFunctions')));
                                await sapOdataApiRequest.call(this, 'DELETE', `/sap/opu/odata/IWBEP/NOTIFICATION_SRV/Subscriptions('${subscriptionId}')`);
                                LoggerAdapter_1.LoggerAdapter.info('SAP OData Webhook unregistered', {
                                    module: 'SapODataWebhook',
                                    operation: 'delete',
                                    subscriptionId,
                                });
                            }
                            delete staticData.subscriptionId;
                        }
                        else {
                            LoggerAdapter_1.LoggerAdapter.info('SAP OData Webhook deleted locally', {
                                module: 'SapODataWebhook',
                                operation: 'delete',
                                webhookUrl,
                            });
                        }
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        LoggerAdapter_1.LoggerAdapter.warn('Failed to unregister webhook from SAP', {
                            module: 'SapODataWebhook',
                            operation: 'delete',
                            error: (0, SecurityUtils_1.sanitizeErrorMessage)(errorMessage),
                        });
                    }
                    return true;
                },
            },
        };
    }
    async webhook() {
        var _a, _b;
        const req = this.getRequestObject();
        const resp = this.getResponseObject();
        const authentication = this.getNodeParameter('authentication');
        const responseMode = this.getNodeParameter('responseMode', 'immediate');
        const responseCode = this.getNodeParameter('responseCode', 200);
        const options = this.getNodeParameter('options', {});
        const rawBody = req.rawBody || this.getBodyData();
        let bodyString;
        if (typeof rawBody === 'string') {
            bodyString = rawBody;
        }
        else if (Buffer.isBuffer(rawBody)) {
            bodyString = rawBody.toString('utf-8');
        }
        else {
            bodyString = JSON.stringify(rawBody);
        }
        if (bodyString.length > constants_1.MAX_WEBHOOK_BODY_SIZE) {
            LoggerAdapter_1.LoggerAdapter.warn('Webhook request body too large', {
                module: 'SapODataWebhook',
                operation: 'webhook',
                bodySize: bodyString.length,
                maxSize: constants_1.MAX_WEBHOOK_BODY_SIZE,
            });
            resp.status(413).json({
                error: 'Request body too large',
                maxSize: `${constants_1.MAX_WEBHOOK_BODY_SIZE / 1024 / 1024}MB`,
            });
            return { noWebhookResponse: true };
        }
        const enableRateLimiting = options.enableRateLimiting !== false;
        if (enableRateLimiting) {
            const clientIp = ((_b = (_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.split(',')[0]) === null || _b === void 0 ? void 0 : _b.trim())
                || req.socket.remoteAddress
                || 'unknown';
            const rateLimit = options.rateLimit || constants_2.DEFAULT_WEBHOOK_RATE_LIMIT;
            const rateLimitResult = (0, WebhookUtils_1.checkWebhookRateLimit)(clientIp, rateLimit, constants_2.WEBHOOK_RATE_LIMIT_WINDOW);
            if (!rateLimitResult.allowed) {
                LoggerAdapter_1.LoggerAdapter.warn('Webhook rate limit exceeded', {
                    module: 'SapODataWebhook',
                    operation: 'webhook',
                    clientIp,
                    rateLimit,
                    retryAfter: rateLimitResult.retryAfter,
                });
                resp.status(429)
                    .set('Retry-After', String(rateLimitResult.retryAfter))
                    .set('X-RateLimit-Limit', String(rateLimit))
                    .set('X-RateLimit-Remaining', '0')
                    .set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)))
                    .json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please slow down.',
                    retryAfter: rateLimitResult.retryAfter,
                });
                return { noWebhookResponse: true };
            }
            resp.set('X-RateLimit-Limit', String(rateLimit));
            resp.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
            resp.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)));
        }
        try {
            if (options.ipWhitelist) {
                const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
                const whitelist = options.ipWhitelist.split(',').map(ip => ip.trim());
                if (!(0, WebhookUtils_1.isIpAllowed)(clientIp, whitelist)) {
                    resp.status(403).json({ error: 'IP not whitelisted' });
                    return { noWebhookResponse: true };
                }
            }
            if (authentication !== 'none') {
                if (authentication === 'hmacSignature') {
                    try {
                        const credentials = await this.getCredentials('sapOdataWebhookApi');
                        const headerName = this.getNodeParameter('headerName', 'X-SAP-Signature');
                        const signature = req.headers[headerName.toLowerCase()];
                        if (!signature) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Missing signature header: ${headerName}`, { description: 'Unauthorized' });
                        }
                        const secret = credentials.secret;
                        const algorithm = credentials.algorithm || 'sha256';
                        const isValid = (0, WebhookUtils_1.verifyHmacSignature)(bodyString, signature, secret, algorithm);
                        if (!isValid) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invalid HMAC signature', { description: 'Unauthorized' });
                        }
                    }
                    catch (error) {
                        if (error instanceof n8n_workflow_1.NodeOperationError) {
                            resp.status(401).json({ error: (0, SecurityUtils_1.sanitizeErrorMessage)(error.message) });
                            return { noWebhookResponse: true };
                        }
                        throw error;
                    }
                }
                else if (authentication === 'headerAuth') {
                    const credentials = await this.getCredentials('sapOdataWebhookApi');
                    const headerName = this.getNodeParameter('headerName');
                    const expectedValue = credentials.secret;
                    const actualValue = req.headers[headerName.toLowerCase()];
                    if (actualValue !== expectedValue) {
                        resp.status(401).json({ error: 'Invalid authentication header' });
                        return { noWebhookResponse: true };
                    }
                }
                else if (authentication === 'queryAuth') {
                    const credentials = await this.getCredentials('sapOdataWebhookApi');
                    const paramName = this.getNodeParameter('queryParameterName');
                    const expectedValue = credentials.secret;
                    const actualValue = req.query[paramName];
                    if (actualValue !== expectedValue) {
                        resp.status(401).json({ error: 'Invalid authentication token' });
                        return { noWebhookResponse: true };
                    }
                }
            }
            let payload = req.body;
            if (!payload || Object.keys(payload).length === 0) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Webhook payload is empty');
            }
            if (options.validatePayload === true) {
                if (!(0, WebhookUtils_1.isValidSapODataPayload)(payload)) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invalid SAP OData event payload format');
                }
            }
            if (options.parseDates === true) {
                payload = (0, WebhookUtils_1.parseSapDates)(payload);
            }
            const event = (0, WebhookUtils_1.extractEventInfo)(payload);
            const eventFilter = this.getNodeParameter('eventFilter', 'all');
            if (eventFilter === 'entityType') {
                const entityTypeFilter = this.getNodeParameter('entityType', '');
                const allowedTypes = entityTypeFilter.split(',').map(t => t.trim().toLowerCase());
                if (event.entityType && typeof event.entityType === 'string' && !allowedTypes.includes(event.entityType.toLowerCase())) {
                    resp.status(responseCode).json(options.responseBody
                        ? JSON.parse(options.responseBody)
                        : { status: 'received', filtered: true });
                    return { noWebhookResponse: true };
                }
            }
            if (eventFilter === 'operation') {
                const operationFilter = this.getNodeParameter('operationType', []);
                if (event.operation && typeof event.operation === 'string' && !operationFilter.includes(event.operation.toLowerCase())) {
                    resp.status(responseCode).json(options.responseBody
                        ? JSON.parse(options.responseBody)
                        : { status: 'received', filtered: true });
                    return { noWebhookResponse: true };
                }
            }
            if (options.extractChangedFields === true && event.oldValue && event.newValue) {
                event.changedFields = (0, WebhookUtils_1.extractChangedFields)(event.oldValue, event.newValue);
            }
            const responseData = {
                headers: req.headers,
                params: req.params,
                query: req.query,
                body: payload,
                event,
            };
            if (responseMode === 'immediate') {
                resp.status(responseCode).json(options.responseBody
                    ? JSON.parse(options.responseBody)
                    : { status: 'received' });
            }
            return {
                workflowData: [this.helpers.returnJsonArray(responseData)],
            };
        }
        catch (error) {
            const errorMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(error instanceof Error ? error.message : String(error));
            resp.status(400).json({
                error: 'Webhook processing failed',
                message: errorMessage,
            });
            return { noWebhookResponse: true };
        }
    }
}
exports.SapODataWebhook = SapODataWebhook;
