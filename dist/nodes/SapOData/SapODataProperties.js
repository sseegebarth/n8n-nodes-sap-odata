"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sapODataProperties = void 0;
const constants_1 = require("../../lib/constants");
exports.sapODataProperties = [
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
                name: 'Get Metadata',
                value: 'getMetadata',
                description: 'Get service document or metadata',
                action: 'Get service metadata',
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
    {
        displayName: 'Metadata Type',
        name: 'metadataType',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
            show: {
                resource: ['entity'],
                operation: ['getMetadata'],
            },
        },
        options: [
            {
                name: 'Service Document',
                value: 'serviceDocument',
                description: 'Get the service document listing all entity sets and function imports',
            },
            {
                name: '$metadata',
                value: 'metadata',
                description: 'Get the full service metadata (XML schema)',
            },
        ],
        default: 'serviceDocument',
        description: 'The type of metadata to retrieve',
    },
    {
        displayName: 'Service',
        name: 'servicePath',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        modes: [
            {
                displayName: 'From List',
                name: 'list',
                type: 'list',
                typeOptions: {
                    searchListMethod: 'servicePathSearch',
                    searchable: true,
                },
            },
            {
                displayName: 'By Path',
                name: 'path',
                type: 'string',
                placeholder: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: '^/.*/$',
                            errorMessage: 'Service path must start and end with /',
                        },
                    },
                ],
            },
        ],
        description: 'The SAP OData service to connect to. Select from list or enter the path manually (e.g. /sap/opu/odata/sap/API_BUSINESS_PARTNER/)',
    },
    {
        displayName: 'Entity Set',
        name: 'entitySet',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        displayOptions: {
            show: {
                resource: ['entity'],
            },
            hide: {
                operation: ['getMetadata'],
            },
        },
        modes: [
            {
                displayName: 'From List',
                name: 'list',
                type: 'list',
                typeOptions: {
                    searchListMethod: 'entitySetSearch',
                    searchable: true,
                },
            },
            {
                displayName: 'By Name',
                name: 'name',
                type: 'string',
                placeholder: 'e.g. A_SalesOrder',
            },
            {
                displayName: 'By URL',
                name: 'url',
                type: 'string',
                placeholder: 'https://sap-system.com/sap/opu/odata/sap/SERVICE/EntitySet',
                extractValue: {
                    type: 'regex',
                    regex: '/([^/]+)/?$',
                },
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: 'https?://.+/sap/opu/odata/.+/.+',
                            errorMessage: 'Please provide a valid SAP OData URL',
                        },
                    },
                ],
            },
        ],
        description: 'The entity set to query. Select from list or enter the name directly (e.g. A_SalesOrder, ProductSet)',
        hint: 'When changing the Service, you may need to re-select the Entity Set from the updated list.',
    },
    {
        displayName: 'Entity',
        name: 'entityKey',
        type: 'resourceLocator',
        default: { mode: 'id', value: '' },
        required: true,
        displayOptions: {
            show: {
                resource: ['entity'],
                operation: ['get', 'update', 'delete'],
            },
        },
        modes: [
            {
                displayName: 'By ID',
                name: 'id',
                type: 'string',
                placeholder: "'0500000001'",
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: "^('.+'|\".+\"|\\d+|guid'[^']+'|[a-zA-Z0-9_-]+|\\w+=.+)$",
                            errorMessage: 'Invalid entity key format. Use: \'ABC\' for strings, 123 for numbers, guid\'...\' for GUIDs, or Key1=\'A\',Key2=123 for composite keys',
                        },
                    },
                ],
            },
            {
                displayName: 'By URL',
                name: 'url',
                type: 'string',
                placeholder: 'https://sap-system.com/sap/opu/odata/sap/SERVICE/EntitySet(\'KEY\')',
                extractValue: {
                    type: 'regex',
                    regex: "\\(([^)]+)\\)\\s*$",
                },
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: 'https?://.+/.*\\(.+\\)',
                            errorMessage: 'Please provide a valid OData entity URL',
                        },
                    },
                ],
            },
        ],
        description: 'The entity to operate on. String keys: \'ABC\' | Numeric keys: 123 | Composite: ProductID=123,Year=2024',
    },
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
        description: 'Whether to return all results or use pagination. Enable for small datasets (recommended for less than 1000 items).',
    },
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
            maxValue: constants_1.MAX_PAGE_SIZE,
        },
        default: constants_1.DEFAULT_PAGE_SIZE,
        description: 'Maximum number of results to return',
    },
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
        description: 'Entity data as JSON object. Field names must match the OData entity properties. Check $metadata for available fields and required properties.',
        placeholder: '{"CustomerName": "ACME Corp", "City": "Berlin", "Country": "DE"}',
    },
    {
        displayName: 'Query Parameters',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        description: 'OData query options to filter, sort, expand, and shape the response data. Use $filter to search, $select to limit fields, $expand for related entities.',
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
                description: 'Select specific properties to return (comma-separated). Reduces response size and improves performance.',
                placeholder: 'CustomerID,CustomerName,City,PostalCode',
            },
            {
                displayName: '$expand',
                name: '$expand',
                type: 'string',
                default: '',
                description: 'Expand navigation properties to include related entities. Multiple expansions: ToItems,ToPartner | Nested: ToItems($select=Material)',
                placeholder: 'ToSalesOrderItem,ToPartner',
            },
            {
                displayName: '$filter',
                name: '$filter',
                type: 'string',
                default: '',
                description: 'Filter results using OData query syntax. Examples: City eq \'Berlin\' | Price gt 100 | startswith(Name,\'A\') | CreatedAt ge datetime\'2024-01-01T00:00:00\'',
                placeholder: 'City eq \'Berlin\' and Status eq \'Active\'',
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
                displayName: '$top',
                name: '$top',
                type: 'number',
                default: 0,
                description: 'Maximum number of results to return (0 = use default limit)',
                typeOptions: {
                    minValue: 0,
                    maxValue: constants_1.MAX_PAGE_SIZE,
                },
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
                description: 'Search for text across all properties (OData V4 only - may not work with all SAP systems)',
                placeholder: 'Berlin',
            },
            {
                displayName: '$apply',
                name: '$apply',
                type: 'string',
                default: '',
                description: 'Apply data aggregation (OData V4 only - may not work with all SAP systems)',
                placeholder: 'groupby((City),aggregate($count as Total))',
            },
            {
                displayName: 'Batch Size',
                name: 'batchSize',
                type: 'number',
                default: constants_1.DEFAULT_PAGE_SIZE,
                description: 'Number of items per page',
                typeOptions: {
                    minValue: constants_1.MIN_PAGE_SIZE,
                    maxValue: constants_1.MAX_PAGE_SIZE,
                },
            },
            {
                displayName: 'ETag',
                name: 'etag',
                type: 'string',
                default: '',
                description: 'ETag for optimistic locking. Prevents concurrent modification errors. Use "*" to bypass locking.',
                placeholder: 'W/"datetime\'2024-01-15T10:30:00\'"',
                displayOptions: {
                    show: {
                        '/operation': ['update', 'delete'],
                    },
                },
            },
        ],
    },
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
        description: 'URL format for function parameters (GET only). POST requests always use JSON body.',
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
        description: 'Function import parameters as JSON object. Parameter names and types must match the function definition in $metadata. String values need quotes.',
        placeholder: '{"SalesOrderID": "0500000001", "Action": "RELEASE"}',
    },
    {
        displayName: 'Options',
        name: 'advancedOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        description: 'Configure connection pooling, data conversion, caching, and debug logging for SAP OData requests.',
        options: [
            {
                displayName: 'Data: Convert SAP Data Types',
                name: 'convertDataTypes',
                type: 'boolean',
                default: true,
                description: 'Whether to convert SAP-specific data types to JavaScript native types. Converts numeric strings, SAP dates (/Date(.../), and SAP times (PT14H30M00S).',
            },
            {
                displayName: 'Data: Remove Metadata',
                name: 'removeMetadata',
                type: 'boolean',
                default: true,
                description: 'Whether to remove __metadata field from results. Removes the __metadata object (id, uri, type) from SAP OData responses for cleaner output.',
            },
            {
                displayName: 'Connection: Pool - Keep Alive',
                name: 'keepAlive',
                type: 'boolean',
                default: true,
                description: 'Whether to keep connections alive for reuse. Recommended for better performance.',
            },
            {
                displayName: 'Connection: Pool - Max Sockets',
                name: 'maxSockets',
                type: 'number',
                default: 10,
                description: 'Maximum concurrent connections per host. Controls how many parallel requests can be made.',
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
                description: 'Maximum idle connections to keep in pool. Keeping idle connections reduces connection overhead.',
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
                description: 'Socket timeout in milliseconds. Time to wait before closing an active connection.',
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
                description: 'Free socket timeout in milliseconds. Time to wait before closing an idle connection.',
                typeOptions: {
                    minValue: 5000,
                    maxValue: 120000,
                },
            },
            {
                displayName: 'Cache: Clear Before Execution',
                name: 'clearCache',
                type: 'boolean',
                default: false,
                description: 'Whether to clear cached CSRF tokens and metadata before execution. Use when SAP service metadata has changed. Cache is automatically cleared on 404 errors.',
            },
            {
                displayName: 'Output: Include Metrics',
                name: 'includeMetrics',
                type: 'boolean',
                default: false,
                description: 'Whether to include execution metrics in the output. Adds a _metrics object to the last item with performance data.',
            },
            {
                displayName: 'Debug: Enable Logging',
                name: 'debugLogging',
                type: 'boolean',
                default: false,
                description: 'Whether to log detailed request/response information. Logs URLs, headers (sanitized), status codes, timing, and connection pool stats.',
            },
        ],
    },
];
