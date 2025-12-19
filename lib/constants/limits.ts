/**
 * Constants for various limits and thresholds used throughout the application
 * These replace magic numbers to improve maintainability and clarity
 */

// ============================================
// Network and Request Limits
// ============================================

/**
 * Maximum request timeout in milliseconds (10 minutes)
 */
export const MAX_REQUEST_TIMEOUT_MS = 600000;

/**
 * Default request timeout in milliseconds (2 minutes)
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120000;

/**
 * Connection test timeout in milliseconds (10 seconds)
 */
export const CONNECTION_TEST_TIMEOUT_MS = 10000;

/**
 * Default retry count for failed requests
 */
export const DEFAULT_RETRY_COUNT = 3;

/**
 * Initial retry delay in milliseconds
 */
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 1000;

/**
 * Maximum retry delay in milliseconds
 */
export const DEFAULT_RETRY_MAX_DELAY_MS = 10000;

/**
 * Default backoff factor for exponential retry
 */
export const DEFAULT_RETRY_BACKOFF_FACTOR = 2;

// ============================================
// Rate Limiting and Throttling
// ============================================

/**
 * Default maximum requests per second for throttling
 */
export const DEFAULT_MAX_REQUESTS_PER_SECOND = 10;

/**
 * Default burst size for throttling
 */
export const DEFAULT_THROTTLE_BURST_SIZE = 5;

// ============================================
// Data Size Limits
// ============================================

/**
 * Maximum JSON input size in bytes (10 MB)
 */
export const MAX_JSON_INPUT_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Maximum output characters before truncation (30,000)
 */
export const MAX_OUTPUT_CHARACTERS = 30000;

/**
 * Maximum entity set name length
 */
export const MAX_ENTITY_SET_NAME_LENGTH = 255;

/**
 * Maximum function name length
 */
export const MAX_FUNCTION_NAME_LENGTH = 255;

/**
 * Maximum error message length for sanitization
 */
export const MAX_ERROR_MESSAGE_LENGTH = 200;

// ============================================
// Recursion and Depth Limits
// ============================================

/**
 * Maximum JSON object nesting depth (DoS protection)
 */
export const MAX_JSON_DEPTH = 100;

/**
 * Maximum recursion depth for metadata parsing
 */
export const MAX_METADATA_RECURSION_DEPTH = 50;

/**
 * Maximum recursion depth for type conversion
 */
export const MAX_TYPE_CONVERSION_DEPTH = 100;

// ============================================
// Connection Pool Limits
// ============================================

/**
 * Default maximum sockets per host
 */
export const DEFAULT_MAX_SOCKETS_PER_HOST = 10;

/**
 * Default maximum free sockets per host
 */
export const DEFAULT_MAX_FREE_SOCKETS_PER_HOST = 5;

/**
 * Default socket timeout in milliseconds (2 minutes)
 */
export const DEFAULT_SOCKET_TIMEOUT_MS = 120000;

/**
 * Default keep-alive timeout in milliseconds (30 seconds)
 */
export const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 30000;

// ============================================
// Cache Limits
// ============================================

/**
 * Default metadata cache TTL in milliseconds (5 minutes)
 */
export const DEFAULT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Maximum cache entries per service
 */
export const MAX_CACHE_ENTRIES_PER_SERVICE = 100;

// ============================================
// SAP-specific Limits
// ============================================

/**
 * Maximum entity sets to preview in connection test
 */
export const MAX_ENTITY_SET_PREVIEW_COUNT = 5;

/**
 * Default SAP OData batch size for GetAll operations
 */
export const DEFAULT_SAP_BATCH_SIZE = 1000;

/**
 * Maximum SAP OData $top value
 */
export const MAX_SAP_TOP_VALUE = 5000;

// ============================================
// Security Limits
// ============================================

/**
 * Maximum password length for validation
 */
export const MAX_PASSWORD_LENGTH = 256;

/**
 * Minimum password length for validation
 */
export const MIN_PASSWORD_LENGTH = 1;

/**
 * Maximum URL length for validation (2083 is IE's limit)
 */
export const MAX_URL_LENGTH = 2083;

// ============================================
// Display and UI Limits
// ============================================

/**
 * Default number of lines to read from a file
 */
export const DEFAULT_FILE_READ_LINES = 2000;

/**
 * Maximum line length before truncation
 */
export const MAX_LINE_LENGTH = 2000;

/**
 * Default log buffer size
 */
export const DEFAULT_LOG_BUFFER_SIZE = 100;