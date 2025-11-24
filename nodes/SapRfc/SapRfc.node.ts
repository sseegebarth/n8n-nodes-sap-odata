import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { RfcStrategyFactory } from '../Shared/strategies/rfc/RfcStrategyFactory';

export class SapRfc implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP Connect RFC/BAPI',
		name: 'sapRfc',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["functionName"]}}',
		description: 'Call SAP RFC functions and BAPIs directly',
		defaults: {
			name: 'SAP Connect RFC/BAPI',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'sapRfcApi',
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
						name: 'Call Function',
						value: 'callFunction',
						description: 'Call an RFC function module or BAPI',
						action: 'Call RFC function or BAPI',
					},
					{
						name: 'Call Multiple Functions (Stateful)',
						value: 'callMultiple',
						description: 'Call multiple functions in the same session',
						action: 'Call multiple functions in same session',
					},
				],
				default: 'callFunction',
			},

			// ==============================================
			//         Function Call (Single)
			// ==============================================
			{
				displayName: 'Function Name',
				name: 'functionName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['callFunction'],
					},
				},
				description: 'RFC function module or BAPI name',
				placeholder: 'BAPI_USER_GET_DETAIL',
			},
			{
				displayName: 'Input Mode',
				name: 'inputMode',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['callFunction'],
					},
				},
				options: [
					{
						name: 'JSON',
						value: 'json',
						description: 'Provide parameters as JSON',
					},
					{
						name: 'Structured',
						value: 'structured',
						description: 'Build parameters using UI',
					},
				],
				default: 'json',
				description: 'How to provide function parameters',
			},

			// ==============================================
			//         JSON Input Mode
			// ==============================================
			{
				displayName: 'Parameters (JSON)',
				name: 'parametersJson',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						operation: ['callFunction'],
						inputMode: ['json'],
					},
				},
				description: 'Function parameters as JSON object',
				placeholder: JSON.stringify(
					{
						USERNAME: 'DEVELOPER',
					},
					null,
					2,
				),
			},

			// ==============================================
			//         Structured Input Mode
			// ==============================================
			{
				displayName: 'Import Parameters',
				name: 'importParameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						operation: ['callFunction'],
						inputMode: ['structured'],
					},
				},
				options: [
					{
						displayName: 'Parameter',
						name: 'parameter',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Parameter name',
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'String',
										value: 'string',
									},
									{
										name: 'Number',
										value: 'number',
									},
									{
										name: 'Boolean',
										value: 'boolean',
									},
									{
										name: 'Structure (JSON)',
										value: 'structure',
									},
								],
								default: 'string',
								description: 'Parameter type',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Parameter value (for structures, use JSON)',
							},
						],
					},
				],
			},
			{
				displayName: 'Table Parameters',
				name: 'tableParameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						operation: ['callFunction'],
						inputMode: ['structured'],
					},
				},
				options: [
					{
						displayName: 'Table',
						name: 'table',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Table parameter name',
							},
							{
								displayName: 'Rows (JSON Array)',
								name: 'rows',
								type: 'json',
								default: '[]',
								description: 'Table rows as JSON array',
								placeholder: '[{"FIELD1": "value1", "FIELD2": "value2"}]',
							},
						],
					},
				],
			},

			// ==============================================
			//         Multiple Functions (Stateful)
			// ==============================================
			{
				displayName: 'Functions',
				name: 'functions',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						operation: ['callMultiple'],
					},
				},
				options: [
					{
						displayName: 'Function',
						name: 'function',
						values: [
							{
								displayName: 'Function Name',
								name: 'functionName',
								type: 'string',
								default: '',
								description: 'RFC function module or BAPI name',
							},
							{
								displayName: 'Parameters (JSON)',
								name: 'parameters',
								type: 'json',
								default: '{}',
								description: 'Function parameters as JSON',
							},
							{
								displayName: 'Commit After',
								name: 'commit',
								type: 'boolean',
								default: false,
								description: 'Whether to call BAPI_TRANSACTION_COMMIT after this function',
							},
						],
					},
				],
			},

			// ==============================================
			//         Common Options
			// ==============================================
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Connection Pool',
						name: 'useConnectionPool',
						type: 'boolean',
						default: false,
						description: 'Whether to use connection pooling (faster for multiple calls)',
					},
					{
						displayName: 'Timeout (seconds)',
						name: 'timeout',
						type: 'number',
						default: 30,
						description: 'Function call timeout in seconds',
					},
					{
						displayName: 'Auto Commit',
						name: 'autoCommit',
						type: 'boolean',
						default: false,
						displayOptions: {
							show: {
								'/operation': ['callFunction'],
							},
						},
						description: 'Whether to automatically call BAPI_TRANSACTION_COMMIT after the function call',
					},
					{
						displayName: 'Return Import Parameters',
						name: 'returnImportParams',
						type: 'boolean',
						default: false,
						description: 'Whether to include import parameters in the output',
					},
					{
						displayName: 'Return Tables',
						name: 'returnTables',
						type: 'boolean',
						default: true,
						description: 'Whether to include table parameters in the output',
					},
					{
						displayName: 'Check RETURN Structure',
						name: 'checkReturn',
						type: 'boolean',
						default: true,
						description: 'Whether to check RETURN structure for errors (common in BAPIs)',
					},
					{
						displayName: 'Throw on BAPI Error',
						name: 'throwOnBapiError',
						type: 'boolean',
						default: true,
						displayOptions: {
							show: {
								checkReturn: [true],
							},
						},
						description: 'Whether to throw an error if BAPI returns error type (E or A)',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				// Get operation for current item (allows different operations per item)
				const operation = this.getNodeParameter('operation', i) as string;

				// Get the appropriate strategy from the factory
				const strategy = RfcStrategyFactory.getStrategy(operation);

				// Execute the strategy and collect results
				const results = await strategy.execute(this, i);
				returnData.push(...results);

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
