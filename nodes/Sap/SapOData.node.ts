import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
} from 'n8n-workflow';

import {
	parseMetadataForEntitySets,
	parseMetadataForFunctionImports,
	sapOdataApiRequest,
} from './GenericFunctions';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from './constants';
import { OperationStrategyFactory } from './strategies';

export class SapOData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP OData',
		name: 'sapOData',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with SAP systems via OData services',
		defaults: {
			name: 'SAP OData',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'sapOdataApi',
				required: true,
			},
		],
		properties: [
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
					},
					{
						name: 'Function Import',
						value: 'functionImport',
					},
				],
				default: 'entity',
				description: 'The resource to operate on',
			},

			// Operations for Entity
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all entities',
						action: 'Get all entities',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update an entity',
						action: 'Update an entity',
					},
				],
				default: 'getAll',
			},

			// Entity Set Mode
			{
				displayName: 'Entity Set Mode',
				name: 'entitySetMode',
				type: 'options',
				options: [
					{
						name: 'From List',
						value: 'list',
						description: 'Select from available entity sets (loaded from $metadata)',
					},
					{
						name: 'Custom',
						value: 'custom',
						description: 'Enter entity set name manually (use if $metadata fails or entity not listed)',
					},
				],
				default: 'list',
				displayOptions: {
					show: {
						resource: ['entity'],
					},
				},
				description: 'How to specify the entity set',
				hint: 'Use "Custom" mode if the entity set list is empty or if you work with restrictive SAP systems',
			},

			// Entity Set Name (from list)
			{
				displayName: 'Entity Set Name',
				name: 'entitySet',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getEntitySets',
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['entity'],
						entitySetMode: ['list'],
					},
				},
				description: 'The name of the entity set to operate on',
			},

			// Custom Entity Set Name
			{
				displayName: 'Custom Entity Set Name',
				name: 'customEntitySet',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['entity'],
						entitySetMode: ['custom'],
					},
				},
				placeholder: 'ProductSet, A_SalesOrder, ZMY_CUSTOM_ENTITY',
				description: 'Enter the exact entity set name as defined in your SAP OData service',
				hint: 'Tip: Find entity set names in SAP Gateway Client (/IWFND/GW_CLIENT) or SAP transaction /IWFND/MAINT_SERVICE',
			},

			// Entity Key for Get/Update/Delete
			{
				displayName: 'Entity Key',
				name: 'entityKey',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['entity'],
						operation: ['get', 'update', 'delete'],
					},
				},
				placeholder: "'0500000001'",
				description: 'The key to identify the entity (e.g., \'0500000001\' or SalesOrderID=\'0500000001\')',
			},

			// Return All for GetAll
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
				description: 'Whether to return all results or only up to a given limit',
			},

			// Limit
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
					maxValue: 1000,
				},
				default: 50,
				description: 'Max number of results to return',
			},

			// Additional Fields for Create/Update
			{
				displayName: 'Data',
				name: 'data',
				type: 'json',
				default: '{}',
				required: true,
				displayOptions: {
					show: {
						resource: ['entity'],
						operation: ['create', 'update'],
					},
				},
				description: 'The data to send as JSON',
				placeholder: '{"Name": "Example", "Price": 100}',
			},

			// Options
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
						name: 'select',
						type: 'string',
						default: '',
						placeholder: 'Name,Price,Description',
						description: 'Comma-separated list of properties to select',
					},
					{
						displayName: '$expand',
						name: 'expand',
						type: 'string',
						default: '',
						placeholder: 'ToItems,ToPartner',
						description: 'Comma-separated list of navigation properties to expand',
					},
					{
						displayName: '$filter',
						name: 'filter',
						type: 'string',
						default: '',
						placeholder: "Status eq 'A' and Price gt 100",
						description: 'OData filter expression',
					},
					{
						displayName: '$orderby',
						name: 'orderby',
						type: 'string',
						default: '',
						placeholder: 'CreatedAt desc',
						description: 'OData orderby expression',
					},
					{
						displayName: '$skip',
						name: 'skip',
						type: 'number',
						default: 0,
						description: 'Number of entities to skip',
					},
					{
						displayName: '$count',
						name: 'count',
						type: 'boolean',
						default: false,
						description: 'Whether to include count of entities',
					},
					{
						displayName: '$search',
						name: 'search',
						type: 'string',
						default: '',
						placeholder: 'blue OR green',
						description: 'OData search expression (free-text search across all searchable fields)',
						hint: 'OData V4 feature - may not be supported by all services',
					},
					{
						displayName: '$apply',
						name: 'apply',
						type: 'string',
						default: '',
						placeholder: 'groupby((Category), aggregate(Price with sum as Total))',
						description: 'OData data aggregation expression (groupby, aggregate, filter)',
						hint: 'OData V4 feature - requires service support for aggregation',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: DEFAULT_PAGE_SIZE,
						description: 'Number of items to fetch per request when using "Return All" (for pagination)',
						hint: 'Lower values reduce memory usage, higher values reduce API calls',
						typeOptions: {
							minValue: MIN_PAGE_SIZE,
							maxValue: MAX_PAGE_SIZE,
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
						hint: 'Caps the exponential backoff to prevent excessive waits',
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
							minValue: 1.5,
							maxValue: 4,
							numberPrecision: 1,
						},
						description: 'Multiplication factor for exponential backoff',
						hint: 'Factor of 2 means: 1s → 2s → 4s → 8s',
					},
					{
						displayName: 'Resilience: Retryable Status Codes',
						name: 'retryStatusCodes',
						type: 'string',
						default: '429,503,504',
						displayOptions: {
							show: {
								retryEnabled: [true],
							},
						},
						description: 'Comma-separated HTTP status codes to retry',
						placeholder: '429,503,504,502',
						hint: 'Common: 429 (Rate Limit), 503 (Service Unavailable), 504 (Gateway Timeout)',
					},
					{
						displayName: 'Resilience: Retry on Network Errors',
						name: 'retryNetworkErrors',
						type: 'boolean',
						default: true,
						displayOptions: {
							show: {
								retryEnabled: [true],
							},
						},
						description: 'Retry on ECONNRESET, ETIMEDOUT, etc.',
						hint: 'Helps with transient network issues',
					},

					// Resilience: Throttling Configuration
					{
						displayName: 'Resilience: Enable Throttling',
						name: 'throttleEnabled',
						type: 'boolean',
						default: false,
						description: 'Limit requests per second',
						hint: 'Prevents overwhelming SAP Gateway with too many concurrent requests',
					},
					{
						displayName: 'Resilience: Max Requests Per Second',
						name: 'maxRequestsPerSecond',
						type: 'number',
						default: 10,
						displayOptions: {
							show: {
								throttleEnabled: [true],
							},
						},
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
						description: 'Maximum requests per second',
						hint: 'SAP Gateway default limit is often 10-20 req/s',
					},
					{
						displayName: 'Resilience: Throttle Strategy',
						name: 'throttleStrategy',
						type: 'options',
						default: 'delay',
						displayOptions: {
							show: {
								throttleEnabled: [true],
							},
						},
						options: [
							{
								name: 'Delay',
								value: 'delay',
								description: 'Delay requests to stay under limit',
							},
							{
								name: 'Drop',
								value: 'drop',
								description: 'Drop requests exceeding limit',
							},
							{
								name: 'Queue',
								value: 'queue',
								description: 'Queue requests and process when slot available',
							},
						],
						description: 'How to handle requests exceeding the limit',
					},
					{
						displayName: 'Resilience: Throttle Burst Size',
						name: 'throttleBurstSize',
						type: 'number',
						default: 5,
						displayOptions: {
							show: {
								throttleEnabled: [true],
							},
						},
						typeOptions: {
							minValue: 1,
							maxValue: 50,
						},
						description: 'Allow burst of requests before throttling',
						hint: 'Allows short bursts while maintaining average rate',
					},

					// Resilience: Logging
					{
						displayName: 'Resilience: Log Retry Attempts',
						name: 'logRetries',
						type: 'boolean',
						default: true,
						displayOptions: {
							show: {
								retryEnabled: [true],
							},
						},
						description: 'Log retry attempts to n8n console',
						hint: 'Helps debug retry behavior in n8n logs',
					},
					{
						displayName: 'Resilience: Log Throttle Events',
						name: 'logThrottling',
						type: 'boolean',
						default: true,
						displayOptions: {
							show: {
								throttleEnabled: [true],
							},
						},
						description: 'Log when requests are throttled',
					},
				],
			},

			// Function Import Mode
			{
				displayName: 'Function Name Mode',
				name: 'functionNameMode',
				type: 'options',
				options: [
					{
						name: 'From List',
						value: 'list',
						description: 'Select from available function imports (loaded from $metadata)',
					},
					{
						name: 'Custom',
						value: 'custom',
						description: 'Enter function import name manually (use if $metadata fails or function not listed)',
					},
				],
				default: 'list',
				displayOptions: {
					show: {
						resource: ['functionImport'],
					},
				},
				description: 'How to specify the function import',
				hint: 'Use "Custom" mode if the function import list is empty or if you work with restrictive SAP systems',
			},

			// Function Import (from list)
			{
				displayName: 'Function Name',
				name: 'functionName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getFunctionImports',
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['functionImport'],
						functionNameMode: ['list'],
					},
				},
				description: 'The name of the function import to execute',
			},

			// Custom Function Import
			{
				displayName: 'Custom Function Name',
				name: 'customFunctionName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['functionImport'],
						functionNameMode: ['custom'],
					},
				},
				placeholder: 'GetSalesOrder, CALCULATE_PRICE, Z_MY_FUNCTION',
				description: 'Enter the exact function import name as defined in your SAP OData service',
				hint: 'Tip: Find function import names in SAP Gateway Client (/IWFND/GW_CLIENT) or in the service implementation',
			},

			{
				displayName: 'HTTP Method',
				name: 'functionHttpMethod',
				type: 'options',
				options: [
					{
						name: 'GET',
						value: 'GET',
						description: 'Use GET method (for read-only function imports)',
					},
					{
						name: 'POST',
						value: 'POST',
						description: 'Use POST method (for function imports with side effects)',
					},
				],
				default: 'POST',
				displayOptions: {
					show: {
						resource: ['functionImport'],
					},
				},
				description: 'HTTP method to use for the function import',
			},

			{
				displayName: 'Parameters',
				name: 'functionParameters',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						resource: ['functionImport'],
					},
				},
				description: 'Function parameters as JSON',
				placeholder: '{"SalesOrderID": "0500000001"}',
			},
		],
	};

	methods = {
		loadOptions: {
			// Get Entity Sets from $metadata (with caching)
			async getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('sapOdataApi');
					const { CacheManager } = await import('./CacheManager');

					// Try to get from cache first
					const cached = CacheManager.getMetadata(
						this,
						credentials.host as string,
						credentials.servicePath as string,
					);

					if (cached && cached.entitySets) {
						return cached.entitySets.map((entitySet) => ({
							name: entitySet,
							value: entitySet,
						}));
					}

					// Fetch from API if not cached
					const metadataXml = await sapOdataApiRequest.call(this, 'GET', '/$metadata');
					const entitySets = parseMetadataForEntitySets(
						typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
					);
					const functionImports = parseMetadataForFunctionImports(
						typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
					);

					// Cache the metadata
					CacheManager.setMetadata(
						this,
						credentials.host as string,
						credentials.servicePath as string,
						entitySets,
						functionImports,
					);

					return entitySets.map((entitySet) => ({
						name: entitySet,
						value: entitySet,
					}));
				} catch (error) {
					// If metadata fetch fails, return helpful message
					// User can switch to "Custom" mode to manually enter entity set name
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					return [
						{
							name: `⚠️ Could not load entity sets - ${errorMessage.substring(0, 60)}`,
							value: '',
							description: 'Switch to "Custom" mode in "Entity Set Mode" to enter the name manually',
						},
					];
				}
			},

			// Get Function Imports from $metadata (with caching)
			async getFunctionImports(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('sapOdataApi');
					const { CacheManager } = await import('./CacheManager');

					// Try to get from cache first
					const cached = CacheManager.getMetadata(
						this,
						credentials.host as string,
						credentials.servicePath as string,
					);

					if (cached && cached.functionImports) {
						return cached.functionImports.map((functionImport) => ({
							name: functionImport,
							value: functionImport,
						}));
					}

					// Fetch from API if not cached
					const metadataXml = await sapOdataApiRequest.call(this, 'GET', '/$metadata');
					const entitySets = parseMetadataForEntitySets(
						typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
					);
					const functionImports = parseMetadataForFunctionImports(
						typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
					);

					// Cache the metadata
					CacheManager.setMetadata(
						this,
						credentials.host as string,
						credentials.servicePath as string,
						entitySets,
						functionImports,
					);

					return functionImports.map((functionImport) => ({
						name: functionImport,
						value: functionImport,
					}));
				} catch (error) {
					// If metadata fetch fails, return helpful message
					// User can switch to "Custom" mode to manually enter function import name
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					return [
						{
							name: `⚠️ Could not load function imports - ${errorMessage.substring(0, 60)}`,
							value: '',
							description: 'Switch to "Custom" mode in "Function Name Mode" to enter the name manually',
						},
					];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		// Check if cache should be cleared
		const options = this.getNodeParameter('options', 0, {}) as any;
		if (options.clearCache === true) {
			const { CacheManager } = await import('./CacheManager');
			CacheManager.clearAllCache(this);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				// Get the appropriate strategy based on resource and operation
				const operation = resource === 'entity'
					? (this.getNodeParameter('operation', i) as string)
					: undefined;

				const strategy = OperationStrategyFactory.getStrategy(resource, operation);

				// Execute the strategy
				const results = await strategy.execute(this, i);

				// Add all results to returnData
				returnData.push(...results);
			} catch (error) {
				// Handle errors based on continueOnFail setting
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
