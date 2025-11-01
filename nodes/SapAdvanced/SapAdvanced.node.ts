import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { OperationStrategyFactory } from '../Shared/strategies';
import { IAdvancedOptions } from '../Shared/strategies/types';
import { sanitizeErrorMessage } from '../Shared/utils/SecurityUtils';

/**
 * SAP OData Advanced Node (v2.0)
 *
 * Enhanced SAP OData node with metadata-driven UI and intelligent features:
 * - Dynamic field discovery from $metadata
 * - Navigation property explorer
 * - Visual query builder
 * - Smart type inference
 * - Context-aware suggestions
 *
 * This node coexists with the stable v1.4.0 SapOData node.
 */
export class SapAdvanced implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP Connect OData Advanced',
		name: 'sapODataAdvanced',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Advanced SAP OData integration with metadata-driven UI and intelligent features',
		defaults: {
			name: 'SAP Connect OData Advanced',
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
			// Service Configuration
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

			// Service Path (from list)
			{
				displayName: 'Service',
				name: 'servicePathFromList',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getServices',
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						servicePathMode: ['list'],
					},
				},
				description: 'Select an SAP OData service',
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

			// Resource Type
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

			// Operation
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

			// Entity Set with Metadata Discovery
			{
				displayName: 'Entity Set',
				name: 'entitySet',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getEntitySetsAdvanced',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['entity'],
					},
				},
				default: '',
				description: 'The entity set to query (discovered from service $metadata)',
				hint: 'Entity sets are automatically discovered from the service metadata',
			},

			// 🆕 Field Selection with Metadata
			{
				displayName: 'Select Fields',
				name: 'selectFields',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getEntityFields',
					loadOptionsDependsOn: ['entitySet'],
				},
				default: [],
				displayOptions: {
					show: {
						resource: ['entity'],
						operation: ['get', 'getAll'],
					},
				},
				description: 'Select specific fields to retrieve (discovered from metadata)',
				hint: 'Leave empty to retrieve all fields. Fields are auto-discovered from entity metadata.',
			},

			// 🆕 Navigation Properties
			{
				displayName: 'Expand Navigation Properties',
				name: 'expandProperties',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getNavigationProperties',
					loadOptionsDependsOn: ['entitySet'],
				},
				default: [],
				displayOptions: {
					show: {
						resource: ['entity'],
						operation: ['get', 'getAll'],
					},
				},
				description: 'Expand related entities (navigation properties discovered from metadata)',
				hint: 'Select relationships to include in the response',
			},

			// Entity Key
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
				description: 'The entity key (use SAP OData format)',
			},

			// Return All
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
					maxValue: 5000,
				},
				default: 50,
				description: 'Maximum number of results to return',
			},

			// 🆕 Visual Filter Builder
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['entity'],
						operation: ['get', 'getAll'],
					},
				},
				description: 'Filter conditions (visual builder)',
				options: [
					{
						name: 'conditions',
						displayName: 'Filter Conditions',
						values: [
							{
								displayName: 'Field',
								name: 'field',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getEntityFields',
									loadOptionsDependsOn: ['entitySet'],
								},
								default: '',
								description: 'Field to filter on',
							},
							{
								displayName: 'Operator',
								name: 'operator',
								type: 'options',
								options: [
									{ name: 'Equals', value: 'eq' },
									{ name: 'Not Equals', value: 'ne' },
									{ name: 'Greater Than', value: 'gt' },
									{ name: 'Greater or Equal', value: 'ge' },
									{ name: 'Less Than', value: 'lt' },
									{ name: 'Less or Equal', value: 'le' },
									{ name: 'Contains', value: 'substringof' },
									{ name: 'Starts With', value: 'startswith' },
									{ name: 'Ends With', value: 'endswith' },
								],
								default: 'eq',
								description: 'Comparison operator',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value to compare against',
							},
						],
					},
				],
			},

			// Data (for create/update)
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
				hint: 'Use the field discovery to see available fields',
			},

			// Advanced Options
			{
				displayName: 'Advanced Options',
				name: 'advancedOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Custom $filter',
						name: 'customFilter',
						type: 'string',
						default: '',
						description: 'Custom OData filter expression (overrides visual filters)',
						placeholder: "City eq 'Berlin' and Status eq 'Active'",
					},
					{
						displayName: 'Order By',
						name: '$orderby',
						type: 'string',
						default: '',
						description: 'Order results by specific fields',
						placeholder: 'Name asc, CreatedAt desc',
					},
					{
						displayName: 'Skip',
						name: '$skip',
						type: 'number',
						default: 0,
						description: 'Number of results to skip',
					},
					{
						displayName: 'Include Count',
						name: '$count',
						type: 'boolean',
						default: false,
						description: 'Include count of matching entities in response',
					},
					{
						displayName: 'Search (OData V4)',
						name: '$search',
						type: 'string',
						default: '',
						description: 'Full-text search across all properties',
						hint: 'OData V4 only - may not work with all SAP systems',
					},
					{
						displayName: 'ETag',
						name: 'etag',
						type: 'string',
						default: '',
						description: 'ETag for optimistic locking (UPDATE/DELETE)',
						placeholder: 'W/"datetime\'2024-01-15T10:30:00\'"',
						hint: 'Use "*" to bypass locking',
					},
					{
						displayName: 'Convert SAP Data Types',
						name: 'convertDataTypes',
						type: 'boolean',
						default: true,
						description: 'Convert SAP-specific data types to JavaScript native types',
					},
					{
						displayName: 'Max Items to Fetch',
						name: 'maxItems',
						type: 'number',
						default: 0,
						description: 'Maximum number of items to fetch (0 = no limit)',
						typeOptions: {
							minValue: 0,
							maxValue: 1000000,
						},
					},
					{
						displayName: 'Clear Cache Before Execution',
						name: 'clearCache',
						type: 'boolean',
						default: false,
						description: 'Clear cached metadata and CSRF tokens',
					},
					{
						displayName: 'Include Metrics in Output',
						name: 'includeMetrics',
						type: 'boolean',
						default: false,
						description: 'Add execution metrics to the last output item',
						hint: 'Adds a _metrics object with performance data (execution time, success/error counts). Useful for monitoring.',
					},
				],
			},

			// Function Import Configuration
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
					},
				},
				default: '',
				description: 'The function import to execute',
			},

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
		],
	};

	methods = {
		loadOptions: {
			// Import load options from shared module
			async getServices(this: any) {
				const { sapODataLoadOptions } = await import('../Sap/SapODataLoadOptions');
				return sapODataLoadOptions.getServices.call(this);
			},

			async getEntitySetsAdvanced(this: any) {
				const { sapODataLoadOptions } = await import('../Sap/SapODataLoadOptions');
				return sapODataLoadOptions.getEntitySets.call(this);
			},

			async getFunctionImports(this: any) {
				const { sapODataLoadOptions } = await import('../Sap/SapODataLoadOptions');
				return sapODataLoadOptions.getFunctionImports.call(this);
			},

			// 🆕 Advanced metadata-based load options
			async getEntityFields(this: any) {
				const { getEntityFields } = await import('../Shared/core/FieldDiscovery');
				const entitySet = this.getCurrentNodeParameter('entitySet') as string;
				if (!entitySet) {
					return [];
				}
				return getEntityFields(this, entitySet);
			},

			async getNavigationProperties(this: any) {
				const { getNavigationProperties } = await import('../Shared/core/FieldDiscovery');
				const entitySet = this.getCurrentNodeParameter('entitySet') as string;
				if (!entitySet) {
					return [];
				}
				return getNavigationProperties(this, entitySet);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		// Start performance tracking
		const startTime = Date.now();
		let errorCount = 0;
		let successCount = 0;

		// Check if cache should be cleared
		const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IAdvancedOptions;
		if (advancedOptions.clearCache === true) {
			const { CacheManager } = await import('../Shared/utils/CacheManager');
			CacheManager.clearAllCache(this);
		}

		// Check if metrics should be included
		const includeMetrics = advancedOptions.includeMetrics === true;

		for (let i = 0; i < items.length; i++) {
			try {
				// Get the appropriate strategy based on resource and operation
				const operation = resource === 'entity'
					? this.getNodeParameter('operation', i) as string
					: 'execute';

				const strategy = OperationStrategyFactory.getStrategy(resource, operation);

				// 🆕 Enhanced with metadata-driven query building
				// (Will be fully implemented in next phases)
				const result = await strategy.execute(this, i);
				returnData.push(...result);
				successCount++;

			} catch (error) {
				errorCount++;
				// Enhanced error handling
				const rawErrorMessage = error instanceof Error ? error.message : String(error);
				const errorMessage = sanitizeErrorMessage(rawErrorMessage);
				const operation = resource === 'entity'
					? this.getNodeParameter('operation', i, 'unknown') as string
					: 'execute';
				const contextMessage = `Item ${i}: ${resource}/${operation}`;

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							context: contextMessage,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				throw new Error(`${contextMessage} - ${errorMessage}`);
			}
		}

		// Add metrics if requested
		if (includeMetrics && returnData.length > 0) {
			const executionTime = Date.now() - startTime;

			// Add metrics to the last item
			const lastItem = returnData[returnData.length - 1];
			lastItem.json._metrics = {
				executionTimeMs: executionTime,
				itemsProcessed: items.length,
				successfulItems: successCount,
				failedItems: errorCount,
				resource,
				timestamp: new Date().toISOString(),
			};
		}

		return [returnData];
	}
}
