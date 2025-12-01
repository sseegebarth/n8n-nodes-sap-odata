import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { MAX_WEBHOOK_BODY_SIZE } from '../Shared/constants';
import { LoggerAdapter } from '../Shared/utils/LoggerAdapter';
import {
	verifyHmacSignature,
	buildWebhookErrorResponse,
} from '../Shared/utils/WebhookUtils';
import { parseIdocXml, buildSuccessResponse, buildErrorResponse } from './IdocWebhookFunctions';

export class SapIdocWebhook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP Connect IDoc Webhook',
		name: 'sapIdocWebhook',
		icon: 'file:sap.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["idocType"] || "All IDocs"}}',
		description: 'Receive IDocs from SAP systems via webhook',
		defaults: {
			name: 'SAP Connect IDoc Webhook',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'sapIdocWebhookApi',
				required: false,
				displayOptions: {
					show: {
						authentication: ['hmacSignature', 'basicAuth'],
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
						description: 'No authentication (not recommended for production)',
					},
					{
						name: 'HMAC Signature',
						value: 'hmacSignature',
						description: 'Validate using HMAC signature (recommended)',
					},
					{
						name: 'Basic Auth (Legacy)',
						value: 'basicAuth',
						description: 'Username and password authentication (insecure, legacy support only)',
					},
				],
				default: 'hmacSignature',
				description: 'Method to authenticate incoming webhook requests',
			},
			{
				displayName: '⚠️ Security Warning',
				name: 'basicAuthWarning',
				type: 'notice',
				displayOptions: {
					show: {
						authentication: ['basicAuth'],
					},
				},
				default: '',
				// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id
				description: 'Basic Authentication is INSECURE and should only be used with HTTPS in controlled environments. Consider using HMAC signature authentication instead for production systems. Username and password are transmitted in Base64 encoding which can be easily decoded.',
			},
			{
				displayName: 'Signature Header Name',
				name: 'signatureHeaderName',
				type: 'string',
				displayOptions: {
					show: {
						authentication: ['hmacSignature'],
					},
				},
				default: 'X-SAP-Signature',
				placeholder: 'X-SAP-Signature',
				description: 'Name of the header that contains the HMAC signature',
				required: true,
			},
			{
				displayName: 'Filter by IDoc Type',
				name: 'filterIdocType',
				type: 'boolean',
				default: false,
				description: 'Whether to filter by specific IDoc type',
			},
			{
				displayName: 'IDoc Type',
				name: 'idocType',
				type: 'options',
				displayOptions: {
					show: {
						filterIdocType: [true],
					},
				},
				options: [
					{
						name: 'DEBMAS (Customer Master)',
						value: 'DEBMAS',
					},
					{
						name: 'MATMAS (Material Master)',
						value: 'MATMAS',
					},
					{
						name: 'ORDERS (Sales/Purchase Order)',
						value: 'ORDERS',
					},
					{
						name: 'INVOIC (Invoice)',
						value: 'INVOIC',
					},
					{
						name: 'DESADV (Delivery Schedule)',
						value: 'DESADV',
					},
					{
						name: 'CREMAS (Vendor Master)',
						value: 'CREMAS',
					},
					{
						name: 'PORDCR (Purchase Order)',
						value: 'PORDCR',
					},
					{
						name: 'Custom',
						value: 'custom',
					},
				],
				default: 'DEBMAS',
				description: 'Filter for specific IDoc type',
			},
			{
				displayName: 'Custom IDoc Type',
				name: 'customIdocType',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						filterIdocType: [true],
						idocType: ['custom'],
					},
				},
				description: 'Enter the custom IDoc type name to filter',
			},
			{
				displayName: 'Response Mode',
				name: 'responseMode',
				type: 'options',
				options: [
					{
						name: 'Success Only',
						value: 'success',
						description: 'Always return success (200 OK)',
					},
					{
						name: 'Auto-Detect',
						value: 'auto',
						description: 'Return success if workflow succeeds, error if it fails',
					},
					{
						name: 'Custom Response',
						value: 'custom',
						description: 'Use custom response from workflow',
					},
				],
				default: 'success',
				description: 'How to respond to SAP after receiving IDoc',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Parse to JSON',
						name: 'parseToJson',
						type: 'boolean',
						default: true,
						description:
							'Whether to parse IDoc XML to structured JSON. If false, raw XML is passed through.',
					},
					{
						displayName: 'Include Raw XML',
						name: 'includeRawXml',
						type: 'boolean',
						default: false,
						displayOptions: {
							show: {
								parseToJson: [true],
							},
						},
						description: 'Whether to include raw XML alongside parsed JSON',
					},
					{
						displayName: 'Validate IDoc Structure',
						name: 'validateStructure',
						type: 'boolean',
						default: true,
						description: 'Whether to validate IDoc XML structure before processing',
					},
					{
						displayName: 'Log Received IDocs',
						name: 'logReceived',
						type: 'boolean',
						default: true,
						description: 'Whether to log received IDocs to n8n logger',
					},
					{
						displayName: 'Extract Segments as Array',
						name: 'extractSegmentsAsArray',
						type: 'boolean',
						default: true,
						displayOptions: {
							show: {
								parseToJson: [true],
							},
						},
						description: 'Whether to extract all segments as a flat array (easier to process)',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// Webhook always exists when node is active
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				// No special creation needed
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				// No special deletion needed
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const options = this.getNodeParameter('options', {}) as any;
		const authentication = this.getNodeParameter('authentication', 0) as string;
		const filterIdocType = this.getNodeParameter('filterIdocType', 0) as boolean;
		const responseMode = this.getNodeParameter('responseMode', 0) as string;

		// Get raw request body BEFORE any processing for signature verification
		const req = this.getRequestObject();
		const rawBody = (req as any).rawBody || this.getBodyData();

		// Convert body to string if needed
		let bodyString: string;
		if (typeof rawBody === 'string') {
			bodyString = rawBody;
		} else if (Buffer.isBuffer(rawBody)) {
			bodyString = rawBody.toString('utf-8');
		} else {
			bodyString = JSON.stringify(rawBody);
		}

		// Validate request body size to prevent DoS attacks
		if (bodyString.length > MAX_WEBHOOK_BODY_SIZE) {
			LoggerAdapter.warn('IDoc Webhook request body too large', {
				module: 'SapIdocWebhook',
				operation: 'webhook',
				bodySize: bodyString.length,
				maxSize: MAX_WEBHOOK_BODY_SIZE,
			});
			return {
				workflowData: [[{
					json: buildWebhookErrorResponse(
						`Request body too large (max ${MAX_WEBHOOK_BODY_SIZE / 1024 / 1024}MB)`,
						413,
					),
				}]],
			};
		}

		// Validate authentication if required
		if (authentication === 'hmacSignature') {
			try {
				const credentials = await this.getCredentials('sapIdocWebhookApi');
				const signatureHeaderName = this.getNodeParameter('signatureHeaderName', 0) as string || 'X-SAP-Signature';
				const signature = req.headers[signatureHeaderName.toLowerCase()] as string;

				if (!signature) {
					throw new NodeOperationError(
						this.getNode(),
						`Missing signature header: ${signatureHeaderName}`,
						{ description: 'Unauthorized', itemIndex: 0 }
					);
				}

				// Verify HMAC signature
				const secret = credentials.secret as string;
				const algorithm = (credentials.algorithm as 'sha256' | 'sha512') || 'sha256';

				if (!secret) {
					throw new NodeOperationError(
						this.getNode(),
						'Missing HMAC secret in credentials',
						{ description: 'Configuration Error', itemIndex: 0 }
					);
				}

				const isValid = verifyHmacSignature(bodyString, signature, secret, algorithm);

				if (!isValid) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid HMAC signature',
						{ description: 'Unauthorized', itemIndex: 0 }
					);
				}
			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				return {
					webhookResponse: buildWebhookErrorResponse('Authentication failed', 401),
					workflowData: [],
				};
			}
		} else if (authentication === 'basicAuth') {
			try {
				// Check if connection is HTTPS (required for Basic Auth)
				const protocol = req.protocol || (req.secure ? 'https' : 'http');
				const forwardedProto = req.headers['x-forwarded-proto'] as string;
				const isHttps = protocol === 'https' || forwardedProto === 'https';

				if (!isHttps) {
					throw new NodeOperationError(
						this.getNode(),
						'Basic Authentication requires HTTPS connection for security',
						{ description: 'Insecure Connection', itemIndex: 0 }
					);
				}

				// Get Basic Auth credentials
				const credentials = await this.getCredentials('sapIdocWebhookApi');
				const expectedUsername = credentials.username as string;
				const expectedPassword = credentials.password as string;

				if (!expectedUsername || !expectedPassword) {
					throw new NodeOperationError(
						this.getNode(),
						'Missing username or password in credentials',
						{ description: 'Configuration Error', itemIndex: 0 }
					);
				}

				// Extract Basic Auth header
				const authHeader = req.headers.authorization || req.headers['authorization'];

				if (!authHeader || !authHeader.startsWith('Basic ')) {
					throw new NodeOperationError(
						this.getNode(),
						'Missing or invalid Authorization header',
						{ description: 'Unauthorized', itemIndex: 0 }
					);
				}

				// Decode Basic Auth credentials
				const base64Credentials = authHeader.slice('Basic '.length);
				const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
				const [username, password] = decodedCredentials.split(':');

				// Validate credentials
				if (username !== expectedUsername || password !== expectedPassword) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid username or password',
						{ description: 'Unauthorized', itemIndex: 0 }
					);
				}
			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				return {
					webhookResponse: buildWebhookErrorResponse('Authentication failed', 401),
					workflowData: [],
				};
			}
		}

		// Get request body
		const bodyData = this.getBodyData();

		let xmlData: string;

		// Extract XML from body
		if (typeof bodyData === 'string') {
			xmlData = bodyData;
		} else if (bodyData && typeof bodyData === 'object') {
			// Handle different content types
			if ('data' in bodyData) {
				xmlData = bodyData.data as string;
			} else {
				xmlData = JSON.stringify(bodyData);
			}
		} else {
			return {
				webhookResponse: buildErrorResponse('Invalid request body'),
				workflowData: [],
			};
		}

		// Validate XML if requested
		if (options.validateStructure !== false) {
			if (!xmlData.includes('<IDOC') || !xmlData.includes('<EDI_DC40')) {
				return {
					webhookResponse: buildErrorResponse('Invalid IDoc XML structure'),
					workflowData: [],
				};
			}
		}

		// Parse IDoc XML to JSON
		let parsedData: any;
		try {
			if (options.parseToJson !== false) {
				parsedData = await parseIdocXml(xmlData, {
					extractSegmentsAsArray: options.extractSegmentsAsArray !== false,
					includeRawXml: options.includeRawXml === true,
				});
			} else {
				parsedData = {
					rawXml: xmlData,
					receivedAt: new Date().toISOString(),
				};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				webhookResponse: buildErrorResponse(`Failed to parse IDoc: ${errorMessage}`),
				workflowData: [],
			};
		}

		// Filter by IDoc type if requested
		if (filterIdocType) {
			const expectedIdocType = this.getNodeParameter('idocType', 0) as string;
			const actualIdocType =
				expectedIdocType === 'custom'
					? (this.getNodeParameter('customIdocType', 0) as string)
					: expectedIdocType;

			const receivedIdocType = parsedData.controlRecord?.IDOCTYP || parsedData.controlRecord?.MESTYP;

			if (!receivedIdocType || !receivedIdocType.startsWith(actualIdocType)) {
				// IDoc type doesn't match filter - return success but don't trigger workflow
				if (options.logReceived) {
					this.logger.info(`IDoc type ${receivedIdocType} filtered out (expected ${actualIdocType})`);
				}
				return {
					webhookResponse: buildSuccessResponse(),
					workflowData: [],
				};
			}
		}

		// Log received IDoc if requested
		if (options.logReceived) {
			this.logger.info('IDoc received', {
				idocType: parsedData.controlRecord?.IDOCTYP,
				mesType: parsedData.controlRecord?.MESTYP,
				docNum: parsedData.controlRecord?.DOCNUM,
				sender: parsedData.controlRecord?.SNDPRN,
			});
		}

		// Prepare workflow data
		const workflowData = [
			[
				{
					json: parsedData,
				},
			],
		];

		// Build response based on response mode
		let webhookResponse: any;
		if (responseMode === 'success') {
			webhookResponse = buildSuccessResponse();
		} else if (responseMode === 'auto') {
			// Will be updated by workflow if it fails
			webhookResponse = buildSuccessResponse();
		} else {
			// Custom response mode - workflow will provide response
			webhookResponse = undefined;
		}

		return {
			webhookResponse,
			workflowData,
		};
	}
}
