/**
 * Constants for SAP OData Node
 */

// Pagination
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;
export const MIN_PAGE_SIZE = 1;

// Timeouts (in milliseconds)
export const DEFAULT_TIMEOUT = 120000; // 2 minutes
export const CSRF_TOKEN_TIMEOUT = 30000; // 30 seconds

// Rate Limiting
export const DEFAULT_RATE_LIMIT = 100; // requests per minute
export const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

// Cache
export const METADATA_CACHE_TTL = 300000; // 5 minutes
export const CSRF_TOKEN_CACHE_TTL = 600000; // 10 minutes

// SAP Gateway Session
export const SAP_GATEWAY_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
export const SAP_GATEWAY_CSRF_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// HTTP Headers
export const HEADERS = {
	ACCEPT: 'application/json',
	CONTENT_TYPE: 'application/json',
	CSRF_FETCH: 'X-CSRF-Token',
} as const;

// OData Versions
export const ODATA_V2_RESULT_PATH = 'd.results';
export const ODATA_V2_NEXT_LINK = 'd.__next';
export const ODATA_V4_RESULT_PATH = 'value';
export const ODATA_V4_NEXT_LINK = '@odata.nextLink';

// Error Messages
export const ERROR_MESSAGES = {
	NO_CREDENTIALS: 'No credentials configured. Please add SAP OData credentials.',
	INVALID_URL: 'Invalid URL configuration. Please check host and service path.',
	INVALID_ENTITY_KEY: 'Invalid entity key format.',
	INVALID_JSON: 'Invalid JSON format in request data.',
	RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
	AUTH_FAILED: 'Authentication failed. Please check your credentials.',
	METADATA_FETCH_FAILED: 'Failed to fetch service metadata.',
	CSRF_TOKEN_FAILED: 'Failed to fetch CSRF token for write operation.',
} as const;

// Credential Types
export const CREDENTIAL_TYPE = 'sapOdataApi';

// Authentication Methods
export const AUTH_METHODS = {
	NONE: 'none',
	BASIC_AUTH: 'basicAuth',
} as const;

// Retry Configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY = 1000; // 1 second
export const MAX_RETRY_DELAY = 10000; // 10 seconds
export const RETRY_STATUS_CODES = [429, 503, 504]; // Rate limit, Service unavailable, Gateway timeout

// Security Limits
export const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB max JSON input size
export const MAX_NESTING_DEPTH = 100; // Maximum JSON nesting depth
export const MAX_WEBHOOK_BODY_SIZE = 5 * 1024 * 1024; // 5MB max webhook body size

// Connection Test
export const CONNECTION_TEST_TIMEOUT = 10000; // 10 seconds

// Cache Cleanup
export const CACHE_CLEANUP_INTERVAL = 10; // Run cleanup every N operations

// Connection Pool
export const DEFAULT_POOL_SIZE = 10;
export const DEFAULT_POOL_TIMEOUT = 120000; // 2 minutes request timeout
export const DEFAULT_KEEP_ALIVE_TIMEOUT = 30000; // 30 seconds idle timeout

// Webhook Rate Limiting
export const DEFAULT_WEBHOOK_RATE_LIMIT = 100; // requests per minute per IP
export const WEBHOOK_RATE_LIMIT_WINDOW = 60000; // 1 minute sliding window
export const WEBHOOK_RATE_LIMIT_CLEANUP_INTERVAL = 300000; // 5 minutes cleanup interval

// ============================================
// ZATW Connector Constants (HTTP-based SAP integration)
// ============================================

// ZATW Base Path
export const ZATW_BASE_PATH = '/sap/bc/zatw/connector';

// ZATW API Endpoints
export const ZATW_ENDPOINTS = {
	HEALTH: '/health',
	META: '/meta',                // + /{functionName} or ?action=search_fm&pattern=...
	RFC: '/rfc',                  // POST with fm_name and parameters
	IDOC: '/idoc',                // POST to send, GET /{docnum} for details
	IDOC_TYPES: '/idoc/types',    // GET ?pattern=...
	IDOC_MESSAGES: '/idoc/messages', // GET ?pattern=...
	IDOC_TYPE: '/idoc/type',      // GET /{idoctype}
	IDOC_SEGMENT: '/idoc/segment', // GET /{segmenttype}
} as const;

// ZATW Timeouts
export const ZATW_TIMEOUT = 120000; // 2 minutes default timeout
export const ZATW_HEALTH_TIMEOUT = 10000; // 10 seconds for health check

// ZATW Cache TTLs
export const ZATW_FM_CACHE_TTL = 600000; // 10 minutes for FM metadata
export const ZATW_FM_SEARCH_CACHE_TTL = 300000; // 5 minutes for FM search results
export const ZATW_IDOC_CACHE_TTL = 600000; // 10 minutes for IDoc type metadata

// ZATW Credential Type
export const ZATW_CREDENTIAL_TYPE = 'sapConnectorApi';

// ZATW Error Messages
export const ZATW_ERROR_MESSAGES = {
	NO_CREDENTIALS: 'No SAP Connector credentials configured. Please add SAP Connector API credentials.',
	CONNECTION_FAILED: 'Failed to connect to SAP system. Please check the host URL and network connectivity.',
	AUTH_FAILED: 'Authentication failed. Please check your username and password.',
	ZATW_NOT_INSTALLED: 'ZATW service not found on SAP system. Please ensure the ZATW ABAP package is installed and ICF service is activated.',
	FM_NOT_FOUND: 'Function module not found or not RFC-enabled.',
	FM_METADATA_FAILED: 'Failed to retrieve function module metadata.',
	RFC_EXECUTION_FAILED: 'RFC execution failed.',
	IDOC_SEND_FAILED: 'Failed to send IDoc.',
	IDOC_TYPE_NOT_FOUND: 'IDoc type not found.',
	INVALID_PARAMETERS: 'Invalid function parameters.',
} as const;

// ZATW HTTP Headers
export const ZATW_HEADERS = {
	CONTENT_TYPE: 'Content-Type',
	ACCEPT: 'Accept',
	SAP_CLIENT: 'sap-client',
	SAP_LANGUAGE: 'sap-language',
	CSRF_TOKEN: 'X-CSRF-Token',
} as const;

// Common BAPIs for quick selection
export const COMMON_BAPIS = [
	'BAPI_USER_GET_DETAIL',
	'BAPI_USER_CREATE1',
	'BAPI_USER_CHANGE',
	'BAPI_USER_DELETE',
	'BAPI_USER_GETLIST',
	'BAPI_CUSTOMER_GETDETAIL',
	'BAPI_CUSTOMER_GETLIST',
	'BAPI_MATERIAL_GETDETAIL',
	'BAPI_MATERIAL_GETLIST',
	'BAPI_SALESORDER_GETLIST',
	'BAPI_SALESORDER_CREATEFROMDAT2',
	'BAPI_SALESORDER_CHANGE',
	'BAPI_PO_GETDETAIL',
	'BAPI_PO_CREATE1',
	'BAPI_PO_CHANGE',
	'BAPI_ACC_DOCUMENT_POST',
	'BAPI_GOODSMVT_CREATE',
	'BAPI_TRANSACTION_COMMIT',
	'BAPI_TRANSACTION_ROLLBACK',
	'RFC_READ_TABLE',
	'RFC_SYSTEM_INFO',
] as const;

// Common IDoc Types
export const COMMON_IDOC_TYPES = [
	'DEBMAS07', // Customer Master
	'CREMAS05', // Vendor Master
	'MATMAS05', // Material Master
	'ORDERS05', // Sales Order
	'ORDRSP', // Order Response
	'DESADV', // Delivery Advice
	'INVOIC02', // Invoice
	'HRMD_A07', // HR Master Data
	'WMMBID02', // Goods Movement
	'INFIMG', // Info Record
] as const;
