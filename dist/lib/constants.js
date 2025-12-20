"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_IDOC_TYPES = exports.COMMON_BAPIS = exports.ZATW_HEADERS = exports.ZATW_ERROR_MESSAGES = exports.ZATW_CREDENTIAL_TYPE = exports.ZATW_IDOC_CACHE_TTL = exports.ZATW_FM_SEARCH_CACHE_TTL = exports.ZATW_FM_CACHE_TTL = exports.ZATW_HEALTH_TIMEOUT = exports.ZATW_TIMEOUT = exports.ZATW_ENDPOINTS = exports.ZATW_BASE_PATH = exports.WEBHOOK_RATE_LIMIT_CLEANUP_INTERVAL = exports.WEBHOOK_RATE_LIMIT_WINDOW = exports.DEFAULT_WEBHOOK_RATE_LIMIT = exports.DEFAULT_KEEP_ALIVE_TIMEOUT = exports.DEFAULT_POOL_TIMEOUT = exports.DEFAULT_POOL_SIZE = exports.CACHE_CLEANUP_INTERVAL = exports.CONNECTION_TEST_TIMEOUT = exports.MAX_WEBHOOK_BODY_SIZE = exports.MAX_NESTING_DEPTH = exports.MAX_JSON_SIZE = exports.RETRY_STATUS_CODES = exports.MAX_RETRY_DELAY = exports.INITIAL_RETRY_DELAY = exports.MAX_RETRY_ATTEMPTS = exports.AUTH_METHODS = exports.CREDENTIAL_TYPE = exports.ERROR_MESSAGES = exports.ODATA_V4_NEXT_LINK = exports.ODATA_V4_RESULT_PATH = exports.ODATA_V2_NEXT_LINK = exports.ODATA_V2_RESULT_PATH = exports.HEADERS = exports.SAP_GATEWAY_CSRF_TIMEOUT = exports.SAP_GATEWAY_SESSION_TIMEOUT = exports.CSRF_TOKEN_CACHE_TTL = exports.METADATA_CACHE_TTL = exports.RATE_LIMIT_WINDOW = exports.DEFAULT_RATE_LIMIT = exports.CSRF_TOKEN_TIMEOUT = exports.DEFAULT_TIMEOUT = exports.MIN_PAGE_SIZE = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = void 0;
exports.DEFAULT_PAGE_SIZE = 100;
exports.MAX_PAGE_SIZE = 1000;
exports.MIN_PAGE_SIZE = 1;
exports.DEFAULT_TIMEOUT = 120000;
exports.CSRF_TOKEN_TIMEOUT = 30000;
exports.DEFAULT_RATE_LIMIT = 100;
exports.RATE_LIMIT_WINDOW = 60000;
exports.METADATA_CACHE_TTL = 300000;
exports.CSRF_TOKEN_CACHE_TTL = 600000;
exports.SAP_GATEWAY_SESSION_TIMEOUT = 30 * 60 * 1000;
exports.SAP_GATEWAY_CSRF_TIMEOUT = 10 * 60 * 1000;
exports.HEADERS = {
    ACCEPT: 'application/json',
    CONTENT_TYPE: 'application/json',
    CSRF_FETCH: 'X-CSRF-Token',
};
exports.ODATA_V2_RESULT_PATH = 'd.results';
exports.ODATA_V2_NEXT_LINK = 'd.__next';
exports.ODATA_V4_RESULT_PATH = 'value';
exports.ODATA_V4_NEXT_LINK = '@odata.nextLink';
exports.ERROR_MESSAGES = {
    NO_CREDENTIALS: 'No credentials configured. Please add SAP OData credentials.',
    INVALID_URL: 'Invalid URL configuration. Please check host and service path.',
    INVALID_ENTITY_KEY: 'Invalid entity key format.',
    INVALID_JSON: 'Invalid JSON format in request data.',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
    AUTH_FAILED: 'Authentication failed. Please check your credentials.',
    METADATA_FETCH_FAILED: 'Failed to fetch service metadata.',
    CSRF_TOKEN_FAILED: 'Failed to fetch CSRF token for write operation.',
};
exports.CREDENTIAL_TYPE = 'sapOdataApi';
exports.AUTH_METHODS = {
    NONE: 'none',
    BASIC_AUTH: 'basicAuth',
};
exports.MAX_RETRY_ATTEMPTS = 3;
exports.INITIAL_RETRY_DELAY = 1000;
exports.MAX_RETRY_DELAY = 10000;
exports.RETRY_STATUS_CODES = [429, 503, 504];
exports.MAX_JSON_SIZE = 10 * 1024 * 1024;
exports.MAX_NESTING_DEPTH = 100;
exports.MAX_WEBHOOK_BODY_SIZE = 5 * 1024 * 1024;
exports.CONNECTION_TEST_TIMEOUT = 10000;
exports.CACHE_CLEANUP_INTERVAL = 10;
exports.DEFAULT_POOL_SIZE = 10;
exports.DEFAULT_POOL_TIMEOUT = 120000;
exports.DEFAULT_KEEP_ALIVE_TIMEOUT = 30000;
exports.DEFAULT_WEBHOOK_RATE_LIMIT = 100;
exports.WEBHOOK_RATE_LIMIT_WINDOW = 60000;
exports.WEBHOOK_RATE_LIMIT_CLEANUP_INTERVAL = 300000;
exports.ZATW_BASE_PATH = '/sap/bc/zatw/connector';
exports.ZATW_ENDPOINTS = {
    HEALTH: '/health',
    META: '/meta',
    RFC: '/rfc',
    IDOC: '/idoc',
    IDOC_TYPES: '/idoc/types',
    IDOC_MESSAGES: '/idoc/messages',
    IDOC_TYPE: '/idoc/type',
    IDOC_SEGMENT: '/idoc/segment',
};
exports.ZATW_TIMEOUT = 120000;
exports.ZATW_HEALTH_TIMEOUT = 10000;
exports.ZATW_FM_CACHE_TTL = 600000;
exports.ZATW_FM_SEARCH_CACHE_TTL = 300000;
exports.ZATW_IDOC_CACHE_TTL = 600000;
exports.ZATW_CREDENTIAL_TYPE = 'sapConnectorApi';
exports.ZATW_ERROR_MESSAGES = {
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
};
exports.ZATW_HEADERS = {
    CONTENT_TYPE: 'Content-Type',
    ACCEPT: 'Accept',
    SAP_CLIENT: 'sap-client',
    SAP_LANGUAGE: 'sap-language',
    CSRF_TOKEN: 'X-CSRF-Token',
};
exports.COMMON_BAPIS = [
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
];
exports.COMMON_IDOC_TYPES = [
    'DEBMAS07',
    'CREMAS05',
    'MATMAS05',
    'ORDERS05',
    'ORDRSP',
    'DESADV',
    'INVOIC02',
    'HRMD_A07',
    'WMMBID02',
    'INFIMG',
];
