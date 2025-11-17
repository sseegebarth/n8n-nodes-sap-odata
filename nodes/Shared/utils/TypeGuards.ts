/**
 * Type Guards - Runtime type checking utilities
 * Provides robust type checking for error handling and data validation
 */

/**
 * HTTP Error type with comprehensive error structure
 */
export interface IHttpError {
	message?: string;
	statusCode?: number;
	status?: number;
	code?: string;
	response?: {
		status?: number;
		statusCode?: number;
		data?: unknown;
		message?: string;
	};
	request?: {
		url?: string;
		method?: string;
	};
	stack?: string;
}

/**
 * SAP OData Error structure
 */
export interface ISapODataError {
	code?: string;
	message?: {
		value?: string;
		lang?: string;
	} | string;
	innererror?: {
		type?: string;
		message?: string;
		transactionid?: string;
		timestamp?: string;
		[key: string]: unknown;
	};
	severity?: string;
}

/**
 * Check if value is an Error object
 */
export function isError(value: unknown): value is Error {
	return value instanceof Error ||
		(typeof value === 'object' &&
			value !== null &&
			'message' in value &&
			typeof (value as any).message === 'string');
}

/**
 * Check if error is an HTTP error with status code
 */
export function isHttpError(error: unknown): error is IHttpError {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const err = error as any;

	// Check for status code in various locations
	const hasStatusCode = (
		typeof err.statusCode === 'number' ||
		typeof err.status === 'number' ||
		(err.response && (
			typeof err.response.statusCode === 'number' ||
			typeof err.response.status === 'number'
		))
	);

	return hasStatusCode;
}

/**
 * Get HTTP status code from error object
 */
export function getHttpStatusCode(error: unknown): number | undefined {
	if (!isHttpError(error)) {
		return undefined;
	}

	const httpError = error as IHttpError;

	// Try various locations where status code might be stored
	return httpError.statusCode ||
		httpError.status ||
		httpError.response?.statusCode ||
		httpError.response?.status;
}

/**
 * Check if error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const err = error as any;
	const networkErrorCodes = [
		'ECONNREFUSED',
		'ENOTFOUND',
		'ETIMEDOUT',
		'ESOCKETTIMEDOUT',
		'ECONNRESET',
		'EHOSTUNREACH',
		'ENETUNREACH',
		'ECONNABORTED',
		'EPIPE',
		'DEPTH_ZERO_SELF_SIGNED_CERT',
		'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
		'CERT_HAS_EXPIRED',
		'CERT_NOT_YET_VALID'
	];

	return typeof err.code === 'string' && networkErrorCodes.includes(err.code);
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const err = error as any;
	const timeoutCodes = ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'TIMEOUT', 'ECONNABORTED'];

	return (typeof err.code === 'string' && timeoutCodes.includes(err.code)) ||
		(typeof err.message === 'string' && /timeout/i.test(err.message));
}

/**
 * Check if error is an SSL/TLS certificate error
 */
export function isCertificateError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const err = error as any;
	const certErrorCodes = [
		'DEPTH_ZERO_SELF_SIGNED_CERT',
		'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
		'CERT_HAS_EXPIRED',
		'CERT_NOT_YET_VALID',
		'SELF_SIGNED_CERT_IN_CHAIN',
		'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
		'UNABLE_TO_GET_LOCAL_ISSUER_CERT'
	];

	return (typeof err.code === 'string' && certErrorCodes.includes(err.code)) ||
		(typeof err.message === 'string' && /certificate/i.test(err.message));
}

/**
 * Extract SAP OData error from response
 */
export function extractSapError(error: unknown): ISapODataError | undefined {
	if (!isHttpError(error)) {
		return undefined;
	}

	const httpError = error as IHttpError;

	// Try to extract from response.data.error (OData standard)
	if (httpError.response?.data &&
		typeof httpError.response.data === 'object' &&
		'error' in httpError.response.data) {
		return (httpError.response.data as any).error as ISapODataError;
	}

	// Try to extract from direct error property
	if ('error' in httpError && typeof httpError.error === 'object') {
		return httpError.error as ISapODataError;
	}

	return undefined;
}

/**
 * Get error message from various error types
 */
export function getErrorMessage(error: unknown): string {
	// String error
	if (typeof error === 'string') {
		return error;
	}

	// Error object
	if (isError(error)) {
		return error.message;
	}

	// SAP OData error
	const sapError = extractSapError(error);
	if (sapError) {
		if (typeof sapError.message === 'string') {
			return sapError.message;
		}
		if (typeof sapError.message === 'object' && sapError.message?.value) {
			return sapError.message.value;
		}
	}

	// HTTP error with message
	if (isHttpError(error)) {
		const httpError = error as IHttpError;
		if (httpError.message) {
			return httpError.message;
		}
		if (httpError.response?.message) {
			return httpError.response.message;
		}
	}

	// Unknown error type
	return 'Unknown error occurred';
}

/**
 * Check if error is retryable based on status code and error type
 */
export function isRetryableError(error: unknown): boolean {
	// Network errors are generally retryable
	if (isNetworkError(error)) {
		// Certificate errors are not retryable
		if (isCertificateError(error)) {
			return false;
		}
		return true;
	}

	// Check HTTP status codes
	const statusCode = getHttpStatusCode(error);
	if (statusCode) {
		// Retryable status codes
		const retryableStatusCodes = [
			408, // Request Timeout
			429, // Too Many Requests
			500, // Internal Server Error
			502, // Bad Gateway
			503, // Service Unavailable
			504, // Gateway Timeout
		];
		return retryableStatusCodes.includes(statusCode);
	}

	return false;
}

/**
 * Type guard for checking if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' &&
		value !== null &&
		value.constructor === Object &&
		Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Type guard for checking if value is a valid SAP GUID
 */
export function isSapGuid(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false;
	}

	// SAP GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	// Example: 005056A0-60A0-1EEF-B0BE-CAA57B95A65D
	return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}

/**
 * Type guard for checking if value is a valid SAP date string
 */
export function isSapDateString(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false;
	}

	// SAP Date format: /Date(timestamp)/ or /Date(timestamp+offset)/
	return /^\/Date\(\d+([+-]\d+)?\)\/$/.test(value);
}

/**
 * Type guard for checking if value is a valid SAP time string
 */
export function isSapTimeString(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false;
	}

	// SAP Time format (ISO 8601 Duration): PT[n]H[n]M[n]S
	return /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(value);
}