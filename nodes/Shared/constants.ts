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
