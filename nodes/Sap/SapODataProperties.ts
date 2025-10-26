/**
 * SAP OData Node - Property Definitions
 *
 * This file contains all UI property definitions for the SAP OData node.
 * Extracted from the main node file for better maintainability.
 */

import { INodeProperties } from 'n8n-workflow';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from '../Shared/constants';

export const sapODataProperties: INodeProperties[] = [
	// Service Path Mode
	{
		displayName: 'Service Path Mode',
		name: 'servicePathMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'From List',
				value: 'list',
				description: 'Select from discovered SAP services',
			},
			{
				name: 'Custom',
				value: 'custom',
				description: 'Enter service path manually',
			},
		],
		default: 'list',
		description: 'How to specify the OData service path',
	},

	// Service Category (filter for list mode)
	{
		displayName: 'Service Category',
		name: 'serviceCategory',
		type: 'options',
		options: [
			{
				name: 'All Services',
				value: 'all',
				description: 'Show all available services',
			},
			{
				name: 'SAP Standard APIs',
				value: 'standard',
				description: 'Official SAP-provided APIs (starts with API_)',
			},
			{
				name: 'Custom Services (Z*)',
				value: 'custom',
				description: 'Customer-specific implementations (starts with Z)',
			},
			{
				name: 'Other Services',
				value: 'other',
				description: 'Miscellaneous services',
			},
		],
		default: 'all',
		displayOptions: {
			show: {
				servicePathMode: ['list'],
			},
		},
		description: 'Filter services by category to narrow down the list',
	},

	// Service Path (from list)
	{
		displayName: 'Service',
		name: 'servicePathFromList',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getServicesByCategory',
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				servicePathMode: ['list'],
			},
		},
		description: 'Select an SAP OData service from the filtered list',
	},

	// Service Path (custom)
	{
		displayName: 'Custom Service Path',
		name: 'servicePath',
		type: 'string',
		default: '/sap/opu/odata/sap/',
		placeholder: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
		description: 'The OData service path (must end with /)',
		required: true,
		displayOptions: {
			show: {
				servicePathMode: ['custom'],
			},
		},
	},

	// Resource
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Entity',
				value: 'entity',
				description: 'Work with OData entities (CRUD operations)',
			},
			{
				name: 'Function Import',
				value: 'functionImport',
				description: 'Execute OData function imports',
			},
		],
		default: 'entity',
		description: 'The SAP OData resource type',
	},

	// Operation (for Entity resource)
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['entity'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new entity',
				action: 'Create an entity',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an entity',
				action: 'Delete an entity',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single entity',
				action: 'Get an entity',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get multiple entities',
				action: 'Get many entities',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an entity',
				action: 'Update an entity',
			},
		],
		default: 'getAll',
		description: 'The operation to perform',
	},

	// Entity Set Mode
	{
		displayName: 'Entity Set Mode',
		name: 'entitySetMode',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['entity'],
			},
		},
		options: [
			{
				name: 'From List',
				value: 'list',
				description: 'Select from discovered entity sets',
			},
			{
				name: 'Custom',
				value: 'custom',
				description: 'Enter entity set name manually',
			},
		],
		default: 'list',
		description: 'How to specify the entity set',
	},

	// Entity Set (from list)
	{
		displayName: 'Entity Set Name',
		name: 'entitySet',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getEntitySets',
		},
		required: true,
		displayOptions: {
			show: {
				resource: ['entity'],
				entitySetMode: ['list'],
			},
		},
		default: '',
		description: 'The entity set to query (from service metadata)',
	},

	// Entity Set (custom)
	{
		displayName: 'Custom Entity Set Name',
		name: 'customEntitySet',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['entity'],
				entitySetMode: ['custom'],
			},
		},
		default: '',
		placeholder: 'A_SalesOrder',
		description: 'The entity set name',
	},

	// Entity Key (for get, update, delete)
	{
		displayName: 'Entity Key',
		name: 'entityKey',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['entity'],
				operation: ['get', 'update', 'delete'],
			},
		},
		default: '',
		placeholder: "'0500000001'",
		description: 'The entity key (use SAP OData format, e.g., \'0500000001\' for strings or 123 for numbers)',
	},

	// Return All (for getAll)
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['entity'],
				operation: ['getAll'],
			},
		},
		default: false,
		description: 'Whether to return all results or use pagination',
	},

	// Limit (for getAll when returnAll is false)
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['entity'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: MAX_PAGE_SIZE,
		},
		default: DEFAULT_PAGE_SIZE,
		description: 'Maximum number of results to return',
	},

	// Data (for create, update)
	{
		displayName: 'Data',
		name: 'data',
		type: 'json',
		required: true,
		displayOptions: {
			show: {
				resource: ['entity'],
				operation: ['create', 'update'],
			},
		},
		default: '{}',
		description: 'Entity data as JSON',
		placeholder: '{"Name": "John Doe", "City": "Berlin"}',
	},

	// Options (Query Parameters for getAll/get)
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['entity'],
				operation: ['get', 'getAll'],
			},
		},
		options: [
			{
				displayName: '$select',
				name: '$select',
				type: 'string',
				default: '',
				description: 'Select specific properties (comma-separated)',
				placeholder: 'Name,City,PostalCode',
			},
			{
				displayName: '$expand',
				name: '$expand',
				type: 'string',
				default: '',
				description: 'Expand related entities',
				placeholder: 'ToSalesOrderItem',
			},
			{
				displayName: '$filter',
				name: '$filter',
				type: 'string',
				default: '',
				description: 'Filter results using OData query syntax',
				placeholder: 'City eq \'Berlin\'',
			},
			{
				displayName: '$orderby',
				name: '$orderby',
				type: 'string',
				default: '',
				description: 'Order results by specific properties',
				placeholder: 'Name asc, CreatedAt desc',
			},
			{
				displayName: '$skip',
				name: '$skip',
				type: 'number',
				default: 0,
				description: 'Number of results to skip',
			},
			{
				displayName: '$count',
				name: '$count',
				type: 'boolean',
				default: false,
				description: 'Include count of matching entities',
			},
			{
				displayName: '$search',
				name: '$search',
				type: 'string',
				default: '',
				description: 'Search for text across all properties',
				hint: 'OData V4 only - may not work with all SAP systems',
				placeholder: 'Berlin',
			},
			{
				displayName: '$apply',
				name: '$apply',
				type: 'string',
				default: '',
				description: 'Apply data aggregation',
				hint: 'OData V4 only - may not work with all SAP systems',
				placeholder: 'groupby((City),aggregate($count as Total))',
			},
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				type: 'number',
				default: DEFAULT_PAGE_SIZE,
				description: 'Number of items per page',
				typeOptions: {
					minValue: MIN_PAGE_SIZE,
					maxValue: MAX_PAGE_SIZE,
				},
			},
			{
				displayName: 'ETag',
				name: 'etag',
				type: 'string',
				default: '',
				description: 'ETag for optimistic locking (UPDATE/DELETE operations)',
				placeholder: 'W/"datetime\'2024-01-15T10:30:00\'"',
				hint: 'Prevents concurrent modification errors. Use "*" to bypass locking.',
				displayOptions: {
					show: {
						'/operation': ['update', 'delete'],
					},
				},
			},
		],
	},

	// Advanced Options (Connection Pooling)
	{
		displayName: 'Advanced Options',
		name: 'advancedOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			// Performance Options
			{
				displayName: 'Performance: Max Items to Fetch',
				name: 'maxItems',
				type: 'number',
				default: 0,
				description: 'Maximum number of items to fetch (0 = no limit)',
				hint: 'Safety limit to prevent out-of-memory errors with very large datasets. Recommended: 50000-100000 for large datasets.',
				typeOptions: {
					minValue: 0,
					maxValue: 1000000,
				},
			},
			{
				displayName: 'Performance: Continue on Pagination Errors',
				name: 'continueOnFail',
				type: 'boolean',
				default: false,
				description: 'Whether to continue fetching data when pagination errors occur',
				hint: 'When enabled, partial results will be returned even if later pages fail. Error information will be included in the output.',
			},

			// Data Type Conversion
			{
				displayName: 'Data: Convert SAP Data Types',
				name: 'convertDataTypes',
				type: 'boolean',
				default: true,
				description: 'Whether to convert SAP-specific data types to JavaScript native types',
				hint: 'Converts numeric strings (e.g., "175.50" → 175.50) and SAP dates (e.g., "/Date(...)/" → "2017-10-06T00:00:00.000Z") to native types. Recommended for easier data processing.',
			},

			// Connection Pool Options
			{
				displayName: 'Connection: Pool - Keep Alive',
				name: 'keepAlive',
				type: 'boolean',
				default: true,
				description: 'Whether to keep connections alive for reuse',
				hint: 'Recommended for better performance',
			},
			{
				displayName: 'Connection: Pool - Max Sockets',
				name: 'maxSockets',
				type: 'number',
				default: 10,
				description: 'Maximum concurrent connections per host',
				hint: 'Controls how many parallel requests can be made',
				typeOptions: {
					minValue: 1,
					maxValue: 50,
				},
			},
			{
				displayName: 'Connection: Pool - Max Free Sockets',
				name: 'maxFreeSockets',
				type: 'number',
				default: 5,
				description: 'Maximum idle connections to keep in pool',
				hint: 'Keeping idle connections reduces connection overhead',
				typeOptions: {
					minValue: 0,
					maxValue: 25,
				},
			},
			{
				displayName: 'Connection: Pool - Socket Timeout',
				name: 'timeout',
				type: 'number',
				default: 120000,
				description: 'Socket timeout in milliseconds',
				hint: 'Time to wait before closing an active connection',
				typeOptions: {
					minValue: 10000,
					maxValue: 300000,
				},
			},
			{
				displayName: 'Connection: Pool - Free Socket Timeout',
				name: 'freeSocketTimeout',
				type: 'number',
				default: 30000,
				description: 'Free socket timeout in milliseconds',
				hint: 'Time to wait before closing an idle connection',
				typeOptions: {
					minValue: 5000,
					maxValue: 120000,
				},
			},

			// Cache Options
			{
				displayName: 'Cache: Clear Before Execution',
				name: 'clearCache',
				type: 'boolean',
				default: false,
				description: 'Whether to clear cached CSRF tokens and metadata before execution',
				hint: 'Use this when SAP service metadata has changed (new fields, entity sets). Cache is automatically cleared on 404 errors.',
			},

			// Debug Options
			{
				displayName: 'Debug: Enable Logging',
				name: 'debugLogging',
				type: 'boolean',
				default: false,
				description: 'Whether to log detailed request/response information',
				hint: 'Logs URLs, headers (sanitized), status codes, timing, and connection pool stats - useful for troubleshooting',
			},

			// Resilience: Retry Configuration
			{
				displayName: 'Resilience: Enable Retry',
				name: 'retryEnabled',
				type: 'boolean',
				default: true,
				description: 'Automatically retry failed requests',
				hint: 'Retries on network errors and specific status codes (429, 503, 504)',
			},
			{
				displayName: 'Resilience: Max Retry Attempts',
				name: 'maxRetries',
				type: 'number',
				default: 3,
				displayOptions: {
					show: {
						retryEnabled: [true],
					},
				},
				typeOptions: {
					minValue: 1,
					maxValue: 10,
				},
				description: 'Maximum number of retry attempts',
				hint: 'Each retry uses exponential backoff (1s, 2s, 4s, ...)',
			},
			{
				displayName: 'Resilience: Initial Retry Delay (ms)',
				name: 'initialRetryDelay',
				type: 'number',
				default: 1000,
				displayOptions: {
					show: {
						retryEnabled: [true],
					},
				},
				typeOptions: {
					minValue: 100,
					maxValue: 10000,
				},
				description: 'Initial delay before first retry',
				hint: 'Subsequent retries increase this delay exponentially',
			},
			{
				displayName: 'Resilience: Max Retry Delay (ms)',
				name: 'maxRetryDelay',
				type: 'number',
				default: 10000,
				displayOptions: {
					show: {
						retryEnabled: [true],
					},
				},
				typeOptions: {
					minValue: 1000,
					maxValue: 60000,
				},
				description: 'Maximum delay between retries',
				hint: 'Caps exponential backoff to prevent excessive wait times',
			},
			{
				displayName: 'Resilience: Backoff Factor',
				name: 'backoffFactor',
				type: 'number',
				default: 2,
				displayOptions: {
					show: {
						retryEnabled: [true],
					},
				},
				typeOptions: {
					minValue: 1.1,
					maxValue: 5,
				},
				description: 'Exponential backoff multiplier',
				hint: 'Each retry delay = previous delay × backoff factor (2 = double each time)',
			},
		],
	},

	// Function Import Name Mode
	{
		displayName: 'Function Name Mode',
		name: 'functionNameMode',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['functionImport'],
			},
		},
		options: [
			{
				name: 'From List',
				value: 'list',
				description: 'Select from discovered function imports',
			},
			{
				name: 'Custom',
				value: 'custom',
				description: 'Enter function name manually',
			},
		],
		default: 'list',
		description: 'How to specify the function import name',
	},

	// Function Import Name (from list)
	{
		displayName: 'Function Name',
		name: 'functionName',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getFunctionImports',
		},
		required: true,
		displayOptions: {
			show: {
				resource: ['functionImport'],
				functionNameMode: ['list'],
			},
		},
		default: '',
		description: 'The function import to execute',
	},

	// Function Import Name (custom)
	{
		displayName: 'Custom Function Name',
		name: 'customFunctionName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['functionImport'],
				functionNameMode: ['custom'],
			},
		},
		default: '',
		placeholder: 'CalculatePrice',
		description: 'The function import name',
	},

	// Function HTTP Method
	{
		displayName: 'HTTP Method',
		name: 'functionHttpMethod',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['functionImport'],
			},
		},
		options: [
			{
				name: 'GET',
				value: 'GET',
				description: 'Query function (read-only)',
			},
			{
				name: 'POST',
				value: 'POST',
				description: 'Action function (modifies data)',
			},
		],
		default: 'POST',
		description: 'HTTP method for function import',
	},

	// Function URL Format
	{
		displayName: 'URL Format',
		name: 'functionUrlFormat',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['functionImport'],
				functionHttpMethod: ['GET'],
			},
		},
		options: [
			{
				name: 'Canonical',
				value: 'canonical',
				description: '/FunctionName(param1=value1,param2=value2)',
			},
			{
				name: 'Query String',
				value: 'querystring',
				description: '/FunctionName?param1=value1&param2=value2',
			},
		],
		default: 'canonical',
		description: 'URL format for function parameters (GET only)',
		hint: 'POST requests always use JSON body regardless of this setting',
	},

	// Function Parameters
	{
		displayName: 'Function Parameters',
		name: 'functionParameters',
		type: 'json',
		required: true,
		displayOptions: {
			show: {
				resource: ['functionImport'],
			},
		},
		default: '{}',
		description: 'Function parameters as JSON',
		placeholder: '{"SalesOrderID": "0500000001"}',
	},
];
