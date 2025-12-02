/**
 * SAP IDoc Trigger Node
 *
 * Webhook trigger to receive IDocs from SAP via HTTP.
 * SAP sends IDocs to this webhook endpoint for processing in n8n workflows.
 */

import {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { Logger } from '../Shared/utils/Logger';

/**
 * Parse incoming IDoc data from various formats
 */
function parseIdocPayload(
	body: IDataObject,
	contentType: string,
): IDataObject {
	// Handle JSON format
	if (contentType.includes('application/json')) {
		return body;
	}

	// Handle XML format (simplified - ZATW sends JSON by default)
	if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
		// The body should already be parsed by n8n
		return body;
	}

	// Return as-is for other formats
	return body;
}

/**
 * Validate IDoc structure
 */
function validateIdocPayload(payload: IDataObject): { valid: boolean; error?: string } {
	// Check for ZATW format
	if (payload.controlRecord && payload.dataRecords) {
		if (!payload.controlRecord || typeof payload.controlRecord !== 'object') {
			return { valid: false, error: 'Missing or invalid control record' };
		}

		const control = payload.controlRecord as IDataObject;
		if (!control.idoctyp) {
			return { valid: false, error: 'Missing IDoc type in control record' };
		}

		return { valid: true };
	}

	// Check for raw SAP format
	if (payload.IDOC || payload.idoc) {
		return { valid: true };
	}

	// Check for EDI_DC40 format
	if (payload.EDI_DC40 || payload.edi_dc40) {
		return { valid: true };
	}

	return { valid: false, error: 'Unrecognized IDoc format' };
}

export class SapIdocTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP IDoc Trigger',
		name: 'sapIdocTrigger',
		icon: 'file:sap.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["idocTypeFilter"] || "All IDocs"}}',
		description: 'Receive IDocs from SAP via webhook (ZATW Connector)',
		defaults: {
			name: 'SAP IDoc Trigger',
		},
		inputs: [],
		outputs: ['main'],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'sap-idoc',
			},
		],
		credentials: [],
		properties: [
			// IDoc Type Filter
			{
				displayName: 'IDoc Type Filter',
				name: 'idocTypeFilter',
				type: 'string',
				default: '',
				placeholder: 'e.g. ORDERS05 (leave empty for all)',
				description: 'Only trigger for specific IDoc type (optional)',
			},

			// Message Type Filter
			{
				displayName: 'Message Type Filter',
				name: 'messageTypeFilter',
				type: 'string',
				default: '',
				placeholder: 'e.g. ORDERS (leave empty for all)',
				description: 'Only trigger for specific message type (optional)',
			},

			// Authentication
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
						value: 'header',
						description: 'Validate API key in header',
					},
					{
						name: 'Query Parameter',
						value: 'query',
						description: 'Validate API key in query parameter',
					},
				],
				default: 'header',
				description: 'How to authenticate incoming requests',
			},

			// API Key Header Name
			{
				displayName: 'Header Name',
				name: 'headerName',
				type: 'string',
				default: 'X-API-Key',
				displayOptions: {
					show: {
						authentication: ['header'],
					},
				},
				description: 'Name of the header containing the API key',
			},

			// API Key Query Parameter Name
			{
				displayName: 'Query Parameter Name',
				name: 'queryParamName',
				type: 'string',
				default: 'apiKey',
				displayOptions: {
					show: {
						authentication: ['query'],
					},
				},
				description: 'Name of the query parameter containing the API key',
			},

			// Expected API Key
			{
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				displayOptions: {
					show: {
						authentication: ['header', 'query'],
					},
				},
				description: 'The API key to validate against',
			},

			// Response Options
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Validate IDoc Structure',
						name: 'validateStructure',
						type: 'boolean',
						default: true,
						description: 'Whether to validate the incoming IDoc structure',
					},
					{
						displayName: 'Include Raw Body',
						name: 'includeRawBody',
						type: 'boolean',
						default: false,
						description: 'Whether to include the raw request body in output',
					},
					{
						displayName: 'Response Status Code',
						name: 'responseCode',
						type: 'number',
						default: 200,
						description: 'HTTP status code to return on success',
					},
					{
						displayName: 'Debug Logging',
						name: 'debugLogging',
						type: 'boolean',
						default: false,
						description: 'Whether to enable debug logging',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// Webhook is always active when node is active
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				// No setup required
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				// No cleanup required
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const body = this.getBodyData() as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		Logger.setDebugMode(options.debugLogging === true);

		// Get authentication settings
		const authentication = this.getNodeParameter('authentication', 'none') as string;

		// Validate authentication
		if (authentication === 'header') {
			const headerName = this.getNodeParameter('headerName', 'X-API-Key') as string;
			const expectedKey = this.getNodeParameter('apiKey', '') as string;
			const providedKey = req.headers[headerName.toLowerCase()] as string;

			if (expectedKey && providedKey !== expectedKey) {
				Logger.warn('IDoc webhook authentication failed', {
					module: 'SapIdocTrigger',
					reason: 'Invalid API key in header',
				});

				return {
					webhookResponse: {
						status: 401,
						body: { error: 'Unauthorized' },
					},
				};
			}
		} else if (authentication === 'query') {
			const queryParamName = this.getNodeParameter('queryParamName', 'apiKey') as string;
			const expectedKey = this.getNodeParameter('apiKey', '') as string;
			const providedKey = req.query[queryParamName] as string;

			if (expectedKey && providedKey !== expectedKey) {
				Logger.warn('IDoc webhook authentication failed', {
					module: 'SapIdocTrigger',
					reason: 'Invalid API key in query',
				});

				return {
					webhookResponse: {
						status: 401,
						body: { error: 'Unauthorized' },
					},
				};
			}
		}

		// Parse the IDoc payload
		const contentType = (req.headers['content-type'] as string) || 'application/json';
		const idocPayload = parseIdocPayload(body, contentType);

		// Validate IDoc structure if enabled
		if (options.validateStructure !== false) {
			const validation = validateIdocPayload(idocPayload);
			if (!validation.valid) {
				Logger.warn('Invalid IDoc payload received', {
					module: 'SapIdocTrigger',
					error: validation.error,
				});

				return {
					webhookResponse: {
						status: 400,
						body: { error: validation.error },
					},
				};
			}
		}

		// Extract IDoc type and message type for filtering
		let idocType = '';
		let messageType = '';

		if (idocPayload.controlRecord) {
			const control = idocPayload.controlRecord as IDataObject;
			idocType = (control.idoctyp as string) || (control.IDOCTYP as string) || '';
			messageType = (control.mestyp as string) || (control.MESTYP as string) || '';
		} else if (idocPayload.EDI_DC40 || idocPayload.edi_dc40) {
			const ediDc = (idocPayload.EDI_DC40 || idocPayload.edi_dc40) as IDataObject;
			idocType = (ediDc.IDOCTYP as string) || '';
			messageType = (ediDc.MESTYP as string) || '';
		}

		// Apply IDoc type filter
		const idocTypeFilter = this.getNodeParameter('idocTypeFilter', '') as string;
		if (idocTypeFilter && idocType && idocType !== idocTypeFilter) {
			Logger.debug('IDoc filtered out by type', {
				module: 'SapIdocTrigger',
				idocType,
				filter: idocTypeFilter,
			});

			return {
				webhookResponse: {
					status: 200,
					body: { filtered: true, reason: 'IDoc type mismatch' },
				},
			};
		}

		// Apply message type filter
		const messageTypeFilter = this.getNodeParameter('messageTypeFilter', '') as string;
		if (messageTypeFilter && messageType && messageType !== messageTypeFilter) {
			Logger.debug('IDoc filtered out by message type', {
				module: 'SapIdocTrigger',
				messageType,
				filter: messageTypeFilter,
			});

			return {
				webhookResponse: {
					status: 200,
					body: { filtered: true, reason: 'Message type mismatch' },
				},
			};
		}

		Logger.debug('IDoc received', {
			module: 'SapIdocTrigger',
			idocType,
			messageType,
		});

		// Build output
		const output: IDataObject = {
			idocType,
			messageType,
			receivedAt: new Date().toISOString(),
			...idocPayload,
		};

		// Include raw body if requested
		if (options.includeRawBody === true) {
			output.rawBody = body;
		}

		const responseCode = (options.responseCode as number) || 200;

		return {
			workflowData: [
				[
					{
						json: output,
					},
				],
			],
			webhookResponse: {
				status: responseCode,
				body: {
					success: true,
					message: 'IDoc received',
					idocType,
					messageType,
				},
			},
		};
	}
}
