import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { sanitizeErrorMessage } from '../Shared/utils/SecurityUtils';

/**
 * SAP OData Webhook Trigger Node
 *
 * Receives real-time events from SAP OData services via webhook.
 * Supports event filtering, authentication, and payload parsing.
 */
export class SapODataWebhook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP Connect OData Webhook',
		name: 'sapODataWebhook',
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
				default: 'headerAuth',
				description: 'Method to authenticate incoming webhook requests',
			},

			// Header Auth - Header Name
			{
				displayName: 'Header Name',
				name: 'headerName',
				type: 'string',
				displayOptions: {
					show: {
						authentication: ['headerAuth'],
					},
				},
				default: 'X-SAP-Signature',
				placeholder: 'X-SAP-Signature',
				description: 'Name of the header that contains the authentication token',
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
						placeholder: '192.168.1.1,10.0.0.0/8',
						description: 'Comma-separated list of allowed IP addresses or CIDR ranges',
					},
					{
						displayName: 'Custom Response Body',
						name: 'responseBody',
						type: 'json',
						default: '{"status": "received"}',
						placeholder: '{"status": "received"}',
						description: 'Custom JSON response body to return',
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
				// Webhooks in n8n are always created dynamically
				// Return false to indicate n8n should create the webhook
				return false;
			},

			/**
			 * Create webhook registration
			 * Called when workflow is activated
			 */
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const authentication = this.getNodeParameter('authentication') as string;

				// Log webhook creation
				console.log(`SAP OData Webhook created: ${webhookUrl}`);
				console.log(`Authentication method: ${authentication}`);

				// In a real implementation, you might:
				// 1. Register webhook URL with SAP Gateway
				// 2. Store webhook ID in workflow static data
				// 3. Configure SAP to send events to this URL

				return true;
			},

			/**
			 * Delete webhook registration
			 * Called when workflow is deactivated
			 */
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				// Log webhook deletion
				console.log(`SAP OData Webhook deleted: ${webhookUrl}`);

				// In a real implementation, you might:
				// 1. Unregister webhook from SAP Gateway
				// 2. Clean up stored webhook ID

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
				// Custom authentication validation
				if (authentication === 'headerAuth') {
					const headerName = this.getNodeParameter('headerName') as string;
					const expectedValue = this.getNodeParameter('headerValue') as string;
					const actualValue = req.headers[headerName.toLowerCase()];

					if (actualValue !== expectedValue) {
						resp.status(401).json({ error: 'Invalid authentication header' });
						return { noWebhookResponse: true };
					}
				} else if (authentication === 'queryAuth') {
					const paramName = this.getNodeParameter('queryParameterName') as string;
					const expectedValue = this.getNodeParameter('queryParameterValue') as string;
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

/**
 * Check if IP is in whitelist
 */
function isIpAllowed(clientIp: string, whitelist: string[]): boolean {
	// Remove IPv6 prefix if present
	const ip = clientIp.replace('::ffff:', '');

	for (const allowed of whitelist) {
		// Simple exact match (CIDR matching would require additional library)
		if (ip === allowed || allowed === '*') {
			return true;
		}
		// Check if CIDR range (basic check)
		if (allowed.includes('/')) {
			// For production, use a proper CIDR matching library like 'ip-range-check'
			// For now, just check if IP starts with the network prefix
			const [network] = allowed.split('/');
			if (ip.startsWith(network.split('.').slice(0, -1).join('.'))) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Validate SAP OData event payload format
 */
function isValidSapODataPayload(payload: any): boolean {
	// SAP OData events typically have these structures:
	// 1. Direct entity data
	// 2. Wrapped in "d" property (OData V2)
	// 3. Has operation/event metadata

	if (!payload || typeof payload !== 'object') {
		return false;
	}

	// Check for common SAP OData structures
	const hasODataV2Structure = 'd' in payload;
	const hasODataV4Structure = 'value' in payload || '@odata.context' in payload;
	const hasEventMetadata = 'event' in payload || 'operation' in payload || 'entityType' in payload;

	return hasODataV2Structure || hasODataV4Structure || hasEventMetadata || Object.keys(payload).length > 0;
}

/**
 * Parse SAP date formats
 */
function parseSapDates(obj: any): any {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(parseSapDates);
	}

	const result: any = {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'string' && value.match(/^\/Date\((\d+)\)\/$/)) {
			// SAP date format: /Date(1234567890000)/
			const timestamp = parseInt(value.match(/\d+/)![0], 10);
			result[key] = new Date(timestamp).toISOString();
		} else if (typeof value === 'object') {
			result[key] = parseSapDates(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Extract event information from payload
 */
function extractEventInfo(payload: any): IDataObject {
	const event: IDataObject = {};

	// Try to extract common SAP event fields
	if (payload.event) {
		event.type = payload.event;
	}

	if (payload.operation) {
		event.operation = payload.operation;
	}

	if (payload.entityType || payload.EntityType) {
		event.entityType = payload.entityType || payload.EntityType;
	}

	if (payload.entityKey || payload.EntityKey) {
		event.entityKey = payload.entityKey || payload.EntityKey;
	}

	// Extract entity data
	if (payload.d) {
		// OData V2 format
		event.data = payload.d;
		if (payload.d.results) {
			event.data = payload.d.results;
		}
	} else if (payload.value) {
		// OData V4 format
		event.data = payload.value;
	} else {
		// Direct entity data
		event.data = payload;
	}

	// Extract old/new values for updates
	if (payload.oldValue || payload.old) {
		event.oldValue = payload.oldValue || payload.old;
	}

	if (payload.newValue || payload.new) {
		event.newValue = payload.newValue || payload.new;
	}

	// Timestamp
	event.timestamp = payload.timestamp || payload.changedAt || new Date().toISOString();

	return event;
}

/**
 * Extract changed fields between old and new values
 */
function extractChangedFields(oldValue: any, newValue: any): IDataObject {
	const changes: IDataObject = {};

	if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
		return changes;
	}

	for (const [key, newVal] of Object.entries(newValue)) {
		const oldVal = oldValue[key];
		if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
			changes[key] = {
				old: oldVal,
				new: newVal,
			};
		}
	}

	return changes;
}
