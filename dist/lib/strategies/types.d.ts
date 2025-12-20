import { IDataObject } from 'n8n-workflow';
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
export interface IAdvancedOptions {
    convertDataTypes?: boolean;
    keepAlive?: boolean;
    maxSockets?: number;
    maxFreeSockets?: number;
    timeout?: number;
    freeSocketTimeout?: number;
    clearCache?: boolean;
    includeMetrics?: boolean;
    debugLogging?: boolean;
}
export interface ISapODataResponse {
    d?: {
        results?: IDataObject[];
        [key: string]: unknown;
    };
    __count?: number;
    __next?: string;
    [key: string]: unknown;
}
export interface IPaginationMetadata {
    hasMore: boolean;
    nextLink?: string;
    totalCount?: number;
    currentPage: number;
    itemsInPage: number;
}
export interface IPaginationError {
    page: number;
    error: string;
    timestamp: Date;
}
export interface IRequestOptions extends IDataObject {
    headers?: {
        'If-Match'?: string;
        [key: string]: string | undefined;
    };
}
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
