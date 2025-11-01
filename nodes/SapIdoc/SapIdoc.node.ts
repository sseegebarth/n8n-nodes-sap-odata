import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { sendIdoc, buildIdocXml, prepareIdocData } from './IdocFunctions';

export class SapIdoc implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP Connect IDoc',
		name: 'sapIdoc',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Send and receive SAP IDocs (Intermediate Documents)',
		defaults: {
			name: 'SAP Connect IDoc',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'sapIdocApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Send IDoc',
						value: 'send',
						description: 'Send an IDoc to SAP system',
						action: 'Send an IDoc to SAP',
					},
					{
						name: 'Build IDoc XML',
						value: 'build',
						description: 'Build IDoc XML from JSON data (without sending)',
						action: 'Build IDoc XML from JSON',
					},
				],
				default: 'send',
			},

			// ==============================================
			//         IDoc Type Configuration
			// ==============================================
			{
				displayName: 'IDoc Type',
				name: 'idocType',
				type: 'options',
				options: [
					{
						name: 'DEBMAS (Customer Master)',
						value: 'DEBMAS',
						description: 'Customer master data',
					},
					{
						name: 'MATMAS (Material Master)',
						value: 'MATMAS',
						description: 'Material master data',
					},
					{
						name: 'ORDERS (Sales/Purchase Order)',
						value: 'ORDERS',
						description: 'Sales or purchase order',
					},
					{
						name: 'INVOIC (Invoice)',
						value: 'INVOIC',
						description: 'Invoice document',
					},
					{
						name: 'DESADV (Delivery Schedule)',
						value: 'DESADV',
						description: 'Delivery schedule',
					},
					{
						name: 'CREMAS (Vendor Master)',
						value: 'CREMAS',
						description: 'Vendor master data',
					},
					{
						name: 'PORDCR (Purchase Order)',
						value: 'PORDCR',
						description: 'Purchase order creation',
					},
					{
						name: 'Custom',
						value: 'custom',
						description: 'Custom IDoc type',
					},
				],
				default: 'DEBMAS',
				description: 'The type of IDoc to send',
			},
			{
				displayName: 'Custom IDoc Type',
				name: 'customIdocType',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						idocType: ['custom'],
					},
				},
				description: 'Enter the custom IDoc type name (e.g., ZMYIDOC01)',
			},

			// ==============================================
			//         Input Mode
			// ==============================================
			{
				displayName: 'Input Mode',
				name: 'inputMode',
				type: 'options',
				options: [
					{
						name: 'JSON Data',
						value: 'json',
						description: 'Provide IDoc data as JSON',
					},
					{
						name: 'XML String',
						value: 'xml',
						description: 'Provide complete IDoc XML string',
					},
					{
						name: 'Manual Builder',
						value: 'manual',
						description: 'Build IDoc using UI form',
					},
				],
				default: 'json',
				description: 'How to provide the IDoc data',
			},

			// ==============================================
			//         JSON Input Mode
			// ==============================================
			{
				displayName: 'IDoc Data (JSON)',
				name: 'idocDataJson',
				type: 'json',
				default: '{\n  "controlRecord": {},\n  "dataRecords": []\n}',
				displayOptions: {
					show: {
						inputMode: ['json'],
					},
				},
				description: 'IDoc data in JSON format. See documentation for structure.',
				placeholder: JSON.stringify(
					{
						controlRecord: {
							MESTYP: 'DEBMAS',
							IDOCTYP: 'DEBMAS06',
							SNDPOR: 'SAPSND',
							SNDPRT: 'LS',
							SNDPRN: 'SENDER',
							RCVPOR: 'SAPRCV',
							RCVPRT: 'LS',
							RCVPRN: 'RECEIVER',
						},
						dataRecords: [
							{
								segmentType: 'E1KNA1M',
								fields: {
									KUNNR: '0000100001',
									NAME1: 'Test Customer',
									LAND1: 'US',
								},
							},
						],
					},
					null,
					2,
				),
			},

			// ==============================================
			//         XML Input Mode
			// ==============================================
			{
				displayName: 'IDoc XML',
				name: 'idocXml',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				default: '',
				displayOptions: {
					show: {
						inputMode: ['xml'],
					},
				},
				description: 'Complete IDoc XML string to send',
			},

			// ==============================================
			//         Manual Builder Mode
			// ==============================================
			{
				displayName: 'Control Record Fields',
				name: 'controlRecord',
				type: 'fixedCollection',
				default: {},
				displayOptions: {
					show: {
						inputMode: ['manual'],
					},
				},
				options: [
					{
						displayName: 'Fields',
						name: 'fields',
						values: [
							{
								displayName: 'Message Type (MESTYP)',
								name: 'MESTYP',
								type: 'string',
								default: '',
								description: 'Message type (e.g., DEBMAS)',
							},
							{
								displayName: 'Basic Type (IDOCTYP)',
								name: 'IDOCTYP',
								type: 'string',
								default: '',
								description: 'Basic IDoc type (e.g., DEBMAS06)',
							},
							{
								displayName: 'Sender Port (SNDPOR)',
								name: 'SNDPOR',
								type: 'string',
								default: 'SAPSND',
								description: 'Sender port ID',
							},
							{
								displayName: 'Sender Partner Type (SNDPRT)',
								name: 'SNDPRT',
								type: 'string',
								default: 'LS',
								description: 'Sender partner type (LS = Logical System)',
							},
							{
								displayName: 'Sender Partner Number (SNDPRN)',
								name: 'SNDPRN',
								type: 'string',
								default: '',
								description: 'Sender partner number',
							},
							{
								displayName: 'Receiver Port (RCVPOR)',
								name: 'RCVPOR',
								type: 'string',
								default: 'SAPRCV',
								description: 'Receiver port ID',
							},
							{
								displayName: 'Receiver Partner Type (RCVPRT)',
								name: 'RCVPRT',
								type: 'string',
								default: 'LS',
								description: 'Receiver partner type',
							},
							{
								displayName: 'Receiver Partner Number (RCVPRN)',
								name: 'RCVPRN',
								type: 'string',
								default: '',
								description: 'Receiver partner number',
							},
						],
					},
				],
			},
			{
				displayName: 'Data Segments',
				name: 'dataSegments',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						inputMode: ['manual'],
					},
				},
				options: [
					{
						displayName: 'Segment',
						name: 'segment',
						values: [
							{
								displayName: 'Segment Type',
								name: 'segmentType',
								type: 'string',
								default: '',
								placeholder: 'E1KNA1M',
								description: 'SAP segment type (e.g., E1KNA1M)',
							},
							{
								displayName: 'Parent Segment ID',
								name: 'parentId',
								type: 'string',
								default: '',
								description: 'Parent segment ID for hierarchical structure (optional)',
							},
							{
								displayName: 'Fields (JSON)',
								name: 'fields',
								type: 'json',
								default: '{}',
								description: 'Segment field data as JSON object',
								placeholder: '{\n  "KUNNR": "0000100001",\n  "NAME1": "Customer Name"\n}',
							},
						],
					},
				],
			},

			// ==============================================
			//         Advanced Options
			// ==============================================
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Generate DOCNUM',
						name: 'generateDocnum',
						type: 'boolean',
						default: true,
						description:
							'Whether to automatically generate a unique DOCNUM. If false, you must provide it in the control record.',
					},
					{
						displayName: 'DOCNUM',
						name: 'docnum',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								generateDocnum: [false],
							},
						},
						description: 'Manual IDoc document number (must be unique)',
					},
					{
						displayName: 'Direction',
						name: 'direction',
						type: 'options',
						options: [
							{
								name: 'Inbound (to SAP)',
								value: '1',
							},
							{
								name: 'Outbound (from SAP)',
								value: '2',
							},
						],
						default: '1',
						description: 'IDoc direction',
					},
					{
						displayName: 'Remove Whitespace',
						name: 'removeWhitespace',
						type: 'boolean',
						default: true,
						description:
							'Whether to remove whitespace from XML (required by SAP). Disable only for debugging.',
					},
					{
						displayName: 'Validate XML',
						name: 'validateXml',
						type: 'boolean',
						default: true,
						description: 'Whether to validate XML structure before sending',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'send') {
					// Send IDoc to SAP
					const result = await sendIdoc.call(this, i);
					returnData.push({
						json: result,
						pairedItem: { item: i },
					});
				} else if (operation === 'build') {
					// Build IDoc XML without sending
					const idocData = prepareIdocData.call(this, i);
					const xml = buildIdocXml(idocData);
					returnData.push({
						json: {
							success: true,
							xml,
							idocType: idocData.idocType,
							docnum: idocData.controlRecord.DOCNUM,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
