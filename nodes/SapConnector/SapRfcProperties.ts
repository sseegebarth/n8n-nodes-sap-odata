/**
 * SAP RFC Node - Property Definitions
 *
 * UI property definitions for the SAP RFC/BAPI node using ZATW HTTP connector.
 */

import { INodeProperties } from 'n8n-workflow';

export const sapRfcProperties: INodeProperties[] = [
	// ============================================
	// Operation
	// ============================================
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Call Function',
				value: 'callFunction',
				description: 'Call a single RFC/BAPI function',
				action: 'Call an RFC/BAPI function',
			},
			{
				name: 'Call Multiple (Stateful)',
				value: 'callMultiple',
				description: 'Call multiple functions in sequence with shared context',
				action: 'Call multiple functions in sequence',
			},
		],
		default: 'callFunction',
		description: 'The operation to perform',
	},

	// ============================================
	// Function Selection (Resource Locator)
	// ============================================
	{
		displayName: 'Function',
		name: 'functionName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: {
				operation: ['callFunction'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchFunctions',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'BAPI_USER_GET_DETAIL',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[A-Za-z][A-Za-z0-9_]*$',
							errorMessage: 'Function name must start with a letter and contain only letters, numbers, and underscores',
						},
					},
				],
			},
		],
		description: 'Select or enter the RFC/BAPI function name',
	},

	// ============================================
	// Input Mode
	// ============================================
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
				name: 'Dynamic (Auto-Discover)',
				value: 'dynamic',
				description: 'Build parameter form based on function signature',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Provide all parameters as a JSON object',
			},
		],
		default: 'dynamic',
		description: 'How to provide function parameters',
	},

	// ============================================
	// Dynamic Parameters - Import
	// ============================================
	{
		displayName: 'Import Parameters',
		name: 'importParameters',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				operation: ['callFunction'],
				inputMode: ['dynamic'],
			},
		},
		default: {},
		placeholder: 'Add Parameter',
		description: 'Input parameters for the function (IMPORTING)',
		options: [
			{
				name: 'parameter',
				displayName: 'Parameter',
				values: [
					{
						displayName: 'Parameter',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getImportParameters',
							loadOptionsDependsOn: ['functionName'],
						},
						default: '',
						description: 'Select an import parameter',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value for the parameter (use JSON for structures)',
					},
				],
			},
		],
	},

	// ============================================
	// Dynamic Parameters - Tables
	// ============================================
	{
		displayName: 'Table Parameters',
		name: 'tableParameters',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				operation: ['callFunction'],
				inputMode: ['dynamic'],
			},
		},
		default: {},
		placeholder: 'Add Table',
		description: 'Table parameters for the function (TABLES)',
		options: [
			{
				name: 'table',
				displayName: 'Table',
				values: [
					{
						displayName: 'Table',
						name: 'name',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getTableParameters',
							loadOptionsDependsOn: ['functionName'],
						},
						default: '',
						description: 'Select a table parameter',
					},
					{
						displayName: 'Rows (JSON Array)',
						name: 'rows',
						type: 'json',
						default: '[]',
						description: 'Table rows as JSON array',
						placeholder: '[{"FIELD1": "value1"}, {"FIELD1": "value2"}]',
					},
				],
			},
		],
	},

	// ============================================
	// JSON Mode Parameters
	// ============================================
	{
		displayName: 'Parameters (JSON)',
		name: 'parametersJson',
		type: 'json',
		displayOptions: {
			show: {
				operation: ['callFunction'],
				inputMode: ['json'],
			},
		},
		default: '{}',
		required: true,
		description: 'Function parameters as JSON object',
		placeholder: '{\n  "USERNAME": "TESTUSER",\n  "RETURN": []\n}',
	},

	// ============================================
	// Multiple Functions (Stateful)
	// ============================================
	{
		displayName: 'Functions',
		name: 'functions',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				operation: ['callMultiple'],
			},
		},
		default: {},
		placeholder: 'Add Function',
		description: 'Functions to execute in sequence',
		options: [
			{
				name: 'function',
				displayName: 'Function',
				values: [
					{
						displayName: 'Function Name',
						name: 'functionName',
						type: 'string',
						default: '',
						required: true,
						description: 'RFC/BAPI function name',
						placeholder: 'BAPI_USER_GET_DETAIL',
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
						name: 'commitAfter',
						type: 'boolean',
						default: false,
						description: 'Whether to call BAPI_TRANSACTION_COMMIT after this function',
					},
				],
			},
		],
	},

	// ============================================
	// Batch Options
	// ============================================
	{
		displayName: 'Batch Options',
		name: 'batchOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['callMultiple'],
			},
		},
		options: [
			{
				displayName: 'Stop on Error',
				name: 'stopOnError',
				type: 'boolean',
				default: true,
				description: 'Whether to stop execution if a function fails',
			},
			{
				displayName: 'Commit All',
				name: 'commitAll',
				type: 'boolean',
				default: false,
				description: 'Whether to commit transaction after all functions succeed',
			},
			{
				displayName: 'Rollback All',
				name: 'rollbackAll',
				type: 'boolean',
				default: false,
				description: 'Whether to rollback transaction if any function fails',
			},
		],
	},

	// ============================================
	// Options
	// ============================================
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		description: 'Additional options for RFC execution',
		options: [
			{
				displayName: 'Auto Commit',
				name: 'autoCommit',
				type: 'boolean',
				default: false,
				description: 'Whether to call BAPI_TRANSACTION_COMMIT after successful execution',
			},
			{
				displayName: 'Check RETURN',
				name: 'checkReturn',
				type: 'boolean',
				default: true,
				description: 'Whether to check BAPI RETURN structure for errors',
			},
			{
				displayName: 'Throw on BAPI Error',
				name: 'throwOnBapiError',
				type: 'boolean',
				default: true,
				description: 'Whether to throw an error if BAPI returns type E (Error) or A (Abort)',
				displayOptions: {
					show: {
						checkReturn: [true],
					},
				},
			},
			{
				displayName: 'Include Export Parameters',
				name: 'includeExportParams',
				type: 'boolean',
				default: true,
				description: 'Whether to include EXPORTING parameters in the output',
			},
			{
				displayName: 'Include Tables',
				name: 'includeTables',
				type: 'boolean',
				default: true,
				description: 'Whether to include TABLE parameters in the output',
			},
			{
				displayName: 'Include Input Parameters',
				name: 'includeInputParams',
				type: 'boolean',
				default: false,
				description: 'Whether to include the input parameters in the output',
			},
			{
				displayName: 'Include Metadata',
				name: 'includeMetadata',
				type: 'boolean',
				default: false,
				description: 'Whether to include function metadata in the output',
			},
			{
				displayName: 'Debug Logging',
				name: 'debugLogging',
				type: 'boolean',
				default: false,
				description: 'Whether to log detailed request/response information',
			},
		],
	},
];
