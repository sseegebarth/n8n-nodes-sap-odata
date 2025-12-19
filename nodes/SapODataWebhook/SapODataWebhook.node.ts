import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { MAX_WEBHOOK_BODY_SIZE } from '../../lib/constants';
import { LoggerAdapter } from '../../lib/utils/LoggerAdapter';
import { sanitizeErrorMessage } from '../../lib/utils/SecurityUtils';
import {
	verifyHmacSignature,
	isIpAllowed,
	isValidSapODataPayload,
	parseSapDates,
	extractEventInfo,
	extractChangedFields,
	checkWebhookRateLimit,
} from '../../lib/utils/WebhookUtils';
import { DEFAULT_WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_LIMIT_WINDOW } from '../../lib/constants';

/**
 * SAP OData Webhook Trigger Node
 *
 * Receives real-time events from SAP OData services via webhook.
 * Supports event filtering, authentication, and payload parsing.
 */
export class SapODataWebhook implements INodeType {
	description: INodeTypeDescription = {
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
			// Authentication Method
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

			// Signature/Token Header Name
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

			// Header Auth - Expected Value
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

			// Query Auth - Parameter Name
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

			// Query Auth - Expected Value
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

			// Response Mode
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

			// Response Code
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

			// Event Type Filter
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

			// Entity Type Filter
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

			// Operation Filter
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

			// Options
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

	// Webhook methods
	webhookMethods = {
		default: {
			/**
			 * Check if webhook should be created
			 * Called when workflow is activated
			 */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				try {
					const staticData = this.getWorkflowStaticData('node');
					const subscriptionId = staticData.subscriptionId as string;

					if (!subscriptionId) {
						// No subscription ID stored - webhook needs to be created
						return false;
					}

					// Check if subscription still exists in SAP
					const credentials = await this.getCredentials('sapOdataApi').catch(() => null);
					if (!credentials) {
						// Can't check SAP - assume webhook exists locally
						return true;
					}

					try {
						const { sapOdataApiRequest } = await import('../SapOData/GenericFunctions');
						await sapOdataApiRequest.call(
							this,
							'GET',
							`/sap/opu/odata/IWBEP/NOTIFICATION_SRV/Subscriptions('${subscriptionId}')`
						);
						// Subscription exists in SAP
						return true;
					} catch (error) {
						// Subscription doesn't exist in SAP anymore
						delete staticData.subscriptionId;
						return false;
					}
				} catch (error) {
					// Error checking - assume webhook needs recreation
					return false;
				}
			},

			/**
			 * Create webhook registration
			 * Called when workflow is activated
			 */
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const authentication = this.getNodeParameter('authentication') as string;

				try {
					// Only register with SAP if we have OData credentials
					const credentials = await this.getCredentials('sapOdataApi').catch(() => null);
					if (!credentials) {
						LoggerAdapter.info('No SAP OData credentials found - webhook will receive events but not auto-register', {
							module: 'SapODataWebhook',
							operation: 'create',
						});
						return true;
					}

					// Build subscription payload based on node parameters
					const eventFilter = this.getNodeParameter('eventFilter', {}) as IDataObject;
					const subscriptionPayload: IDataObject = {
						DeliveryAddress: webhookUrl,
						PersistNotifications: true,
					};

					// Add filter criteria if specified
					if (eventFilter.entitySet) {
						subscriptionPayload.Collection = eventFilter.entitySet;
					}
					if (eventFilter.changeType) {
						subscriptionPayload.ChangeType = eventFilter.changeType;
					}
					if (eventFilter.filter) {
						subscriptionPayload.Filter = eventFilter.filter;
					}

					// Add authentication info to payload
					if (authentication === 'hmacSignature') {
						subscriptionPayload.AuthType = 'HMAC';
						subscriptionPayload.SignatureHeader = this.getNodeParameter('headerName', 'X-SAP-Signature');
						// Note: Secret should be configured on SAP side, not sent in request
					}

					// Register webhook with SAP Gateway Event Hub
					const { sapOdataApiRequest } = await import('../SapOData/GenericFunctions');
					const response = await sapOdataApiRequest.call(
						this,
						'POST',
						'/sap/opu/odata/IWBEP/NOTIFICATION_SRV/Subscriptions',
						subscriptionPayload
					) as any;

					// Store subscription ID for later use
					const staticData = this.getWorkflowStaticData('node');
					staticData.subscriptionId = response?.d?.SubscriptionID || response?.SubscriptionID || response?.id;

					LoggerAdapter.info('SAP OData Webhook registered', {
						module: 'SapODataWebhook',
						operation: 'create',
						webhookUrl,
						subscriptionId: staticData.subscriptionId,
					});

				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					LoggerAdapter.warn('Failed to auto-register webhook with SAP - manual configuration may be required', {
						module: 'SapODataWebhook',
						operation: 'create',
						error: sanitizeErrorMessage(errorMessage),
					});
					// Don't fail - allow manual webhook configuration
				}

				return true;
			},

			/**
			 * Delete webhook registration
			 * Called when workflow is deactivated
			 */
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				try {
					const staticData = this.getWorkflowStaticData('node');
					const subscriptionId = staticData.subscriptionId as string;

					if (subscriptionId) {
						// Try to unregister from SAP
						const credentials = await this.getCredentials('sapOdataApi').catch(() => null);
						if (credentials) {
							const { sapOdataApiRequest } = await import('../SapOData/GenericFunctions');
							await sapOdataApiRequest.call(
								this,
								'DELETE',
								`/sap/opu/odata/IWBEP/NOTIFICATION_SRV/Subscriptions('${subscriptionId}')`
							);
							LoggerAdapter.info('SAP OData Webhook unregistered', {
								module: 'SapODataWebhook',
								operation: 'delete',
								subscriptionId,
							});
						}
						delete staticData.subscriptionId;
					} else {
						LoggerAdapter.info('SAP OData Webhook deleted locally', {
							module: 'SapODataWebhook',
							operation: 'delete',
							webhookUrl,
						});
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					LoggerAdapter.warn('Failed to unregister webhook from SAP', {
						module: 'SapODataWebhook',
						operation: 'delete',
						error: sanitizeErrorMessage(errorMessage),
					});
					// Don't fail - allow workflow deactivation even if unregistration fails
				}

				return true;
			},
		},
	};

	/**
	 * Webhook execution - called when webhook receives a request
	 */
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const resp = this.getResponseObject();
		const authentication = this.getNodeParameter('authentication') as string;
		const responseMode = this.getNodeParameter('responseMode', 'immediate') as string;
		const responseCode = this.getNodeParameter('responseCode', 200) as number;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		// Get raw request body for HMAC verification
		const rawBody = (req as any).rawBody || this.getBodyData();
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
			LoggerAdapter.warn('Webhook request body too large', {
				module: 'SapODataWebhook',
				operation: 'webhook',
				bodySize: bodyString.length,
				maxSize: MAX_WEBHOOK_BODY_SIZE,
			});
			resp.status(413).json({
				error: 'Request body too large',
				maxSize: `${MAX_WEBHOOK_BODY_SIZE / 1024 / 1024}MB`,
			});
			return { noWebhookResponse: true };
		}

		// ========================================
		// 0. Rate Limiting Check
		// ========================================
		const enableRateLimiting = options.enableRateLimiting !== false; // Default enabled
		if (enableRateLimiting) {
			const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
				|| req.socket.remoteAddress
				|| 'unknown';
			const rateLimit = (options.rateLimit as number) || DEFAULT_WEBHOOK_RATE_LIMIT;

			const rateLimitResult = checkWebhookRateLimit(clientIp, rateLimit, WEBHOOK_RATE_LIMIT_WINDOW);

			if (!rateLimitResult.allowed) {
				LoggerAdapter.warn('Webhook rate limit exceeded', {
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

			// Add rate limit headers to successful responses
			resp.set('X-RateLimit-Limit', String(rateLimit));
			resp.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
			resp.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetTime / 1000)));
		}

		try {
			// ========================================
			// 1. IP Whitelist Validation
			// ========================================
			if (options.ipWhitelist) {
				const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
				const whitelist = (options.ipWhitelist as string).split(',').map(ip => ip.trim());

				if (!isIpAllowed(clientIp as string, whitelist)) {
					resp.status(403).json({ error: 'IP not whitelisted' });
					return { noWebhookResponse: true };
				}
			}

			// ========================================
			// 2. Authentication Validation
			// ========================================
			if (authentication !== 'none') {
				// HMAC Signature Authentication
				if (authentication === 'hmacSignature') {
					try {
						const credentials = await this.getCredentials('sapOdataWebhookApi');
						const headerName = this.getNodeParameter('headerName', 'X-SAP-Signature') as string;
						const signature = req.headers[headerName.toLowerCase()] as string;

						if (!signature) {
							throw new NodeOperationError(
								this.getNode(),
								`Missing signature header: ${headerName}`,
								{ description: 'Unauthorized' }
							);
						}

						const secret = credentials.secret as string;
						const algorithm = (credentials.algorithm as 'sha256' | 'sha512') || 'sha256';

						const isValid = verifyHmacSignature(bodyString, signature, secret, algorithm);

						if (!isValid) {
							throw new NodeOperationError(
								this.getNode(),
								'Invalid HMAC signature',
								{ description: 'Unauthorized' }
							);
						}
					} catch (error) {
						if (error instanceof NodeOperationError) {
							resp.status(401).json({ error: sanitizeErrorMessage(error.message) });
							return { noWebhookResponse: true };
						}
						throw error;
					}
				}
				// Header Token Authentication
				else if (authentication === 'headerAuth') {
					const credentials = await this.getCredentials('sapOdataWebhookApi');
					const headerName = this.getNodeParameter('headerName') as string;
					const expectedValue = credentials.secret as string; // Use secret field for token
					const actualValue = req.headers[headerName.toLowerCase()];

					if (actualValue !== expectedValue) {
						resp.status(401).json({ error: 'Invalid authentication header' });
						return { noWebhookResponse: true };
					}
				}
				// Query Parameter Authentication
				else if (authentication === 'queryAuth') {
					const credentials = await this.getCredentials('sapOdataWebhookApi');
					const paramName = this.getNodeParameter('queryParameterName') as string;
					const expectedValue = credentials.secret as string; // Use secret field for token
					const actualValue = req.query[paramName];

					if (actualValue !== expectedValue) {
						resp.status(401).json({ error: 'Invalid authentication token' });
						return { noWebhookResponse: true };
					}
				}
			}

			// ========================================
			// 3. Parse Request Body
			// ========================================
			let payload = req.body;

			// Ensure payload exists
			if (!payload || Object.keys(payload).length === 0) {
				throw new NodeOperationError(this.getNode(), 'Webhook payload is empty');
			}

			// ========================================
			// 4. Validate SAP Payload Format (Optional)
			// ========================================
			if (options.validatePayload === true) {
				if (!isValidSapODataPayload(payload)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid SAP OData event payload format',
					);
				}
			}

			// ========================================
			// 5. Parse SAP-specific Formats
			// ========================================
			if (options.parseDates === true) {
				payload = parseSapDates(payload);
			}

			// ========================================
			// 6. Extract Event Information
			// ========================================
			const event = extractEventInfo(payload);

			// ========================================
			// 7. Event Filtering
			// ========================================
			const eventFilter = this.getNodeParameter('eventFilter', 'all') as string;

			if (eventFilter === 'entityType') {
				const entityTypeFilter = this.getNodeParameter('entityType', '') as string;
				const allowedTypes = entityTypeFilter.split(',').map(t => t.trim().toLowerCase());

				if (event.entityType && typeof event.entityType === 'string' && !allowedTypes.includes(event.entityType.toLowerCase())) {
					// Event doesn't match filter - return success but don't trigger workflow
					resp.status(responseCode).json(
						options.responseBody
							? JSON.parse(options.responseBody as string)
							: { status: 'received', filtered: true },
					);
					return { noWebhookResponse: true };
				}
			}

			if (eventFilter === 'operation') {
				const operationFilter = this.getNodeParameter('operationType', []) as string[];

				if (event.operation && typeof event.operation === 'string' && !operationFilter.includes(event.operation.toLowerCase())) {
					// Event doesn't match filter - return success but don't trigger workflow
					resp.status(responseCode).json(
						options.responseBody
							? JSON.parse(options.responseBody as string)
							: { status: 'received', filtered: true },
					);
					return { noWebhookResponse: true };
				}
			}

			// ========================================
			// 8. Extract Changed Fields (Optional)
			// ========================================
			if (options.extractChangedFields === true && event.oldValue && event.newValue) {
				event.changedFields = extractChangedFields(event.oldValue, event.newValue);
			}

			// ========================================
			// 9. Build Response Data
			// ========================================
			const responseData: IDataObject = {
				headers: req.headers,
				params: req.params,
				query: req.query,
				body: payload,
				event,
			};

			// ========================================
			// 10. Return Webhook Response
			// ========================================
			if (responseMode === 'immediate') {
				// Respond immediately
				resp.status(responseCode).json(
					options.responseBody
						? JSON.parse(options.responseBody as string)
						: { status: 'received' },
				);
			}

			return {
				workflowData: [this.helpers.returnJsonArray(responseData)],
			};
		} catch (error) {
			// Error handling
			const errorMessage = sanitizeErrorMessage(
				error instanceof Error ? error.message : String(error),
			);

			resp.status(400).json({
				error: 'Webhook processing failed',
				message: errorMessage,
			});

			return { noWebhookResponse: true };
		}
	}
}

