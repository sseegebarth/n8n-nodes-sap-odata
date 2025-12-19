/**
 * Type Guards for OData Responses
 * Runtime type checking for OData V2 and V4 formats
 */

import {
	IODataV2Response,
	IODataV4Response,
	IODataResponse,
	IODataEntity,
} from '../types';

/**
 * Type guard to check if response is OData V2 format
 */
export function isODataV2Response<T = IODataEntity>(
	response: unknown
): response is IODataV2Response<T> {
	return (
		typeof response === 'object' &&
		response !== null &&
		'd' in response
	);
}

/**
 * Type guard to check if response is OData V4 format
 */
export function isODataV4Response<T = IODataEntity>(
	response: unknown
): response is IODataV4Response<T> {
	return (
		typeof response === 'object' &&
		response !== null &&
		('value' in response || '@odata.nextLink' in response || '@odata.context' in response)
	);
}

/**
 * Type guard to check if value is a valid OData response
 */
export function isODataResponse<T = IODataEntity>(
	value: unknown
): value is IODataResponse<T> {
	return isODataV2Response<T>(value) || isODataV4Response<T>(value);
}

/**
 * Type guard for error checking
 */
export function isError(error: unknown): error is Error {
	return error instanceof Error ||
			(typeof error === 'object' &&
			error !== null &&
			'message' in error);
}
