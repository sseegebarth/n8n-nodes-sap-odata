/**
 * SAP IDoc Send Node
 *
 * Send IDocs to SAP via HTTP using the ZATW connector.
 * No native dependencies required - works with n8n Cloud and Self-Hosted.
 */

import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { ZATW_CREDENTIAL_TYPE } from '../Shared/constants';
import { ZatwApiClient } from '../Shared/core/ZatwApiClient';
import {
	ISapConnectorCredentials,
	IZatwIdocRequest,
	IZatwIdocControlRecord,
	IZatwIdocDataRecord,
} from '../Shared/types/zatw';
import { Logger } from '../Shared/utils/Logger';
import { sapIdocLoadOptions, sapIdocListSearch } from './SapIdocLoadOptions';

/**
 * Parse data records from JSON input
 */
function parseDataRecords(
	context: IExecuteFunctions,
	itemIndex: number,
): IZatwIdocDataRecord[] {
	const dataJson = context.getNodeParameter('dataRecords', itemIndex, '[]') as string;

	try {
		const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;

		if (!Array.isArray(data)) {
			throw new Error('Data records must be an array');
		}

		return data.map((record: IDataObject, index: number) => {
			if (!record.segmentName) {
				throw new Error(`Segment name required for record ${index + 1}`);
			}

			return {
				segmentName: record.segmentName as string,
				segmentNumber: (record.segmentNumber as number) || index + 1,
				parentSegment: record.parentSegment as number | undefined,
				hierarchyLevel: record.hierarchyLevel as number | undefined,
				data: (record.data as Record<string, string>) || {},
			};
		});
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid data records JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
			{ itemIndex },
		);
	}
}

export class SapIdocSend implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP IDoc Send',
		name: 'sapIdocSend',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["idocType"]?.value || $parameter["idocType"]}}',
		description: 'Send IDocs to SAP via HTTP (ZATW Connector)',
		defaults: {
			name: 'SAP IDoc Send',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: ZATW_CREDENTIAL_TYPE,
				required: true,
			},
		],
		properties: [
			// Operation
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Send IDoc',
						value: 'send',
						description: 'Send an IDoc to SAP',
						action: 'Send an IDoc to SAP',
					},
					{
						name: 'Check Status',
						value: 'status',
						description: 'Check the status of an IDoc',
						action: 'Check IDoc status',
					},
				],
				default: 'send',
			},

			// IDoc Type (Resource Locator)
			{
				displayName: 'IDoc Type',
				name: 'idocType',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						operation: ['send'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select an IDoc type...',
						typeOptions: {
							searchListMethod: 'searchIdocTypes',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'By Name',
						name: 'name',
						type: 'string',
						placeholder: 'e.g. ORDERS05',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[A-Z0-9_]+$',
									errorMessage: 'IDoc type must be uppercase alphanumeric',
								},
							},
						],
					},
				],
				description: 'The IDoc type to send',
			},

			// Message Type
			{
				displayName: 'Message Type',
				name: 'messageType',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['send'],
					},
				},
				placeholder: 'e.g. ORDERS',
				description: 'The message type for this IDoc',
			},

			// Partner Configuration
			{
				displayName: 'Partner Configuration',
				name: 'partnerConfig',
				type: 'collection',
				placeholder: 'Configure Partners',
				default: {},
				displayOptions: {
					show: {
						operation: ['send'],
					},
				},
				options: [
					{
						displayName: 'Sender Port',
						name: 'senderPort',
						type: 'string',
						default: 'SAPN8N',
						description: 'The sender port name',
					},
					{
						displayName: 'Sender Partner Type',
						name: 'senderPartnerType',
						type: 'options',
						options: [
							{ name: 'Logical System (LS)', value: 'LS' },
							{ name: 'Customer (KU)', value: 'KU' },
							{ name: 'Vendor (LI)', value: 'LI' },
							{ name: 'Bank (B)', value: 'B' },
						],
						default: 'LS',
						description: 'The type of sender partner',
					},
					{
						displayName: 'Sender Partner',
						name: 'senderPartner',
						type: 'string',
						default: '',
						description: 'The sender partner number',
					},
					{
						displayName: 'Receiver Port',
						name: 'receiverPort',
						type: 'string',
						default: 'SAPPORT',
						description: 'The receiver port name',
					},
					{
						displayName: 'Receiver Partner Type',
						name: 'receiverPartnerType',
						type: 'options',
						options: [
							{ name: 'Logical System (LS)', value: 'LS' },
							{ name: 'Customer (KU)', value: 'KU' },
							{ name: 'Vendor (LI)', value: 'LI' },
							{ name: 'Bank (B)', value: 'B' },
						],
						default: 'LS',
						description: 'The type of receiver partner',
					},
					{
						displayName: 'Receiver Partner',
						name: 'receiverPartner',
						type: 'string',
						default: '',
						description: 'The receiver partner number',
					},
				],
			},

			// Data Records
			{
				displayName: 'Data Records',
				name: 'dataRecords',
				type: 'json',
				default: '[]',
				required: true,
				displayOptions: {
					show: {
						operation: ['send'],
					},
				},
				description: 'Array of IDoc segment data records',
				hint: 'Each record needs: segmentName, data object. Optional: segmentNumber, parentSegment, hierarchyLevel.',
			},

			// IDoc Number (for status check)
			{
				displayName: 'IDoc Number',
				name: 'idocNumber',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['status'],
					},
				},
				placeholder: 'e.g. 0000000123456789',
				description: 'The IDoc number to check',
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
						displayName: 'Test Mode',
						name: 'testMode',
						type: 'boolean',
						default: false,
						description: 'Whether to send in test mode (IDoc not processed)',
					},
					{
						displayName: 'Validate Only',
						name: 'validateOnly',
						type: 'boolean',
						default: false,
						description: 'Whether to only validate without sending',
					},
					{
						displayName: 'Synchronous',
						name: 'synchronous',
						type: 'boolean',
						default: false,
						description: 'Whether to wait for IDoc processing to complete',
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

	methods = {
		loadOptions: sapIdocLoadOptions,
		listSearch: sapIdocListSearch,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials(ZATW_CREDENTIAL_TYPE) as ISapConnectorCredentials;

		const operation = this.getNodeParameter('operation', 0) as string;
		const options = this.getNodeParameter('options', 0, {}) as IDataObject;

		Logger.setDebugMode(options.debugLogging === true);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				if (operation === 'send') {
					// Get partner config with defaults
					const partnerConfig = this.getNodeParameter('partnerConfig', itemIndex, {}) as IDataObject;

					// Build control record
					const controlRecord: IZatwIdocControlRecord = {
						idoctyp: '',
						mestyp: this.getNodeParameter('messageType', itemIndex) as string,
						sndpor: (partnerConfig.senderPort as string) || 'SAPN8N',
						sndprt: (partnerConfig.senderPartnerType as string) || 'LS',
						sndprn: (partnerConfig.senderPartner as string) || '',
						rcvpor: (partnerConfig.receiverPort as string) || 'SAPPORT',
						rcvprt: (partnerConfig.receiverPartnerType as string) || 'LS',
						rcvprn: (partnerConfig.receiverPartner as string) || '',
					};

					// Get IDoc type from resource locator
					const idocTypeParam = this.getNodeParameter('idocType', itemIndex) as
						| string
						| { mode: string; value: string };
					controlRecord.idoctyp = typeof idocTypeParam === 'object'
						? idocTypeParam.value
						: idocTypeParam;

					// Parse data records
					const dataRecords = parseDataRecords(this, itemIndex);

					// Build request
					const request: IZatwIdocRequest = {
						controlRecord,
						dataRecords,
						options: {
							testMode: options.testMode === true,
							validateOnly: options.validateOnly === true,
							synchronous: options.synchronous === true,
						},
					};

					Logger.debug('Sending IDoc', {
						module: 'SapIdocSend',
						idocType: controlRecord.idoctyp,
						messageType: controlRecord.mestyp,
						segmentCount: dataRecords.length,
					});

					// Send IDoc
					const response = await ZatwApiClient.sendIdoc(this, credentials, request);

					returnData.push({
						json: {
							success: response.success,
							idocNumber: response.idocNumber,
							status: response.status,
							statusText: response.statusText,
							idocType: controlRecord.idoctyp,
							messageType: controlRecord.mestyp,
							messages: response.messages,
						},
					});
				} else if (operation === 'status') {
					const idocNumber = this.getNodeParameter('idocNumber', itemIndex) as string;

					Logger.debug('Checking IDoc status', {
						module: 'SapIdocSend',
						idocNumber,
					});

					const response = await ZatwApiClient.getIdocStatus(this, credentials, idocNumber);

					returnData.push({
						json: {
							success: response.success,
							idocNumber: response.idocNumber,
							currentStatus: response.currentStatus,
							currentStatusText: response.currentStatusText,
							statusHistory: response.statusHistory,
						},
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
