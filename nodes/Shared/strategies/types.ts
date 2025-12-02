/**
 * Type definitions for SAP OData Strategy Layer
 *
 * Provides strong typing for strategy operations, replacing 'any' types.
 */

import { IDataObject } from 'n8n-workflow';

/**
 * Node parameter options for operations
 */
export interface IOperationOptions {
	$select?: string;
	$expand?: string;
	$filter?: string;
	$orderby?: string;
	$skip?: number;
	$count?: boolean;
	$search?: string;
	$apply?: string;
	batchSize?: number;
	etag?: string;
}

/**
 * Advanced options for connection pooling, caching, and data conversion
 */
export interface IAdvancedOptions {
	// Data conversion
	convertDataTypes?: boolean;

	// Connection pool
	keepAlive?: boolean;
	maxSockets?: number;
	maxFreeSockets?: number;
	timeout?: number;
	freeSocketTimeout?: number;

	// Cache
	clearCache?: boolean;

	// Monitoring
	includeMetrics?: boolean;

	// Debug
	debugLogging?: boolean;
}

/**
 * SAP OData API response structure
 */
export interface ISapODataResponse {
	d?: {
		results?: IDataObject[];
		[key: string]: unknown;
	};
	__count?: number;
	__next?: string;
	[key: string]: unknown;
}

/**
 * Pagination metadata
 */
export interface IPaginationMetadata {
	hasMore: boolean;
	nextLink?: string;
	totalCount?: number;
	currentPage: number;
	itemsInPage: number;
}

/**
 * Pagination error information
 */
export interface IPaginationError {
	page: number;
	error: string;
	timestamp: Date;
}

/**
 * Request options for HTTP requests
 */
export interface IRequestOptions extends IDataObject {
	headers?: {
		'If-Match'?: string;
		[key: string]: string | undefined;
	};
}

/**
 * Query options for OData requests
 */
export interface IODataQueryOptions {
	$select?: string;
	$expand?: string;
	$filter?: string;
	$orderby?: string;
	$skip?: number;
	$top?: number;
	$count?: boolean;
	$search?: string;
	$apply?: string;
	[key: string]: string | number | boolean | undefined;
}

/**
 * Result wrapper for operations with metadata
 */
export interface IOperationResult {
	data: IDataObject | IDataObject[];
	metadata?: {
		operation: string;
		entitySet?: string;
		itemIndex: number;
		pagination?: IPaginationMetadata;
		errors?: IPaginationError[];
		[key: string]: unknown;
	};
}
