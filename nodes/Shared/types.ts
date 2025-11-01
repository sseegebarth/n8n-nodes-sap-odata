/**
 * Type definitions for SAP OData Node
 */

import { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

/**
 * OData Entity with metadata
 */
export interface IODataEntity extends IDataObject {
	__metadata?: {
		uri: string;
		type: string;
		etag?: string;
	};
}

/**
 * OData V2 Response Structure
 */
export interface IODataV2Response<T = IODataEntity> {
	d?: {
		results?: T[];
		__next?: string;
		__count?: number;
		[key: string]: unknown;
	} | T;
}

/**
 * OData V4 Response Structure
 */
export interface IODataV4Response<T = IODataEntity> {
	value?: T[];
	'@odata.nextLink'?: string;
	'@odata.count'?: number;
	'@odata.context'?: string;
}

/**
 * Unified OData Response
 */
export type IODataResponse<T = IODataEntity> = IODataV2Response<T> | IODataV4Response<T>;

/**
 * OData Query Options
 */
export interface IODataQueryOptions {
	$filter?: string;
	$select?: string | string[];
	$expand?: string | string[];
	$orderby?: string;
	$top?: number;
	$skip?: number;
	$count?: boolean;
	$search?: string;
	$apply?: string;
	batchSize?: number;
}

/**
 * Entity Operation Parameters
 */
export interface IEntityOperationParams {
	entitySet: string;
	entityKey?: string;
	data?: IDataObject;
	options?: IODataQueryOptions;
}

/**
 * Function Import Parameters
 */
export interface IFunctionImportParams {
	functionName: string;
	parameters: IDataObject;
}

/**
 * Pagination State
 */
export interface IPaginationState {
	nextLink?: string;
	hasMore: boolean;
	totalCount?: number;
	currentSkip: number;
}

/**
 * Request Options
 */
export interface IRequestOptions {
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	resource: string;
	body?: IDataObject;
	qs?: IDataObject;
	headers?: IDataObject;
	timeout?: number;
}

/**
 * Credential Data
 */
export interface ISapOdataCredentials {
	host: string;
	authentication: 'none' | 'basicAuth';
	username?: string;
	password?: string;
	allowUnauthorizedCerts?: boolean;
	sapClient?: string;
	sapLanguage?: string;
	customHeaders?: string | IDataObject;
}

/**
 * CSRF Token Cache Entry
 */
export interface ICsrfTokenCacheEntry {
	token: string;
	expires: number;
}

/**
 * Metadata Cache Entry
 */
export interface IMetadataCacheEntry {
	entitySets: string[];
	functionImports: string[];
	expires: number;
	parsedMetadata?: unknown; // Optional: Full parsed metadata for advanced features
}

/**
 * Rate Limit Entry
 */
export interface IRateLimitEntry {
	requests: number[];
	resetTime: number;
}

/**
 * Error Context
 */
export interface IErrorContext {
	operation?: string;
	resource?: string;
	itemIndex?: number;
	statusCode?: number;
}

/**
 * Operation Strategy Interface
 * All strategy implementations must implement this interface
 */
export interface IOperationStrategy {
	/**
	 * Execute the operation
	 * @param context - n8n execution context
	 * @param itemIndex - index of the current item being processed
	 * @returns Array of execution data with json property containing response
	 * @throws NodeOperationError on validation or execution errors
	 */
	execute(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
}
