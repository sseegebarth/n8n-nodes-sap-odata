import { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
export interface IODataEntity extends IDataObject {
    __metadata?: {
        uri: string;
        type: string;
        etag?: string;
    };
}
export interface IODataV2Response<T = IODataEntity> {
    d?: {
        results?: T[];
        __next?: string;
        __count?: number;
        [key: string]: unknown;
    } | T;
}
export interface IODataV4Response<T = IODataEntity> {
    value?: T[];
    '@odata.nextLink'?: string;
    '@odata.count'?: number;
    '@odata.context'?: string;
}
export type IODataResponse<T = IODataEntity> = IODataV2Response<T> | IODataV4Response<T>;
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
export interface IEntityOperationParams {
    entitySet: string;
    entityKey?: string;
    data?: IDataObject;
    options?: IODataQueryOptions;
}
export interface IFunctionImportParams {
    functionName: string;
    parameters: IDataObject;
}
export interface IPaginationState {
    nextLink?: string;
    hasMore: boolean;
    totalCount?: number;
    currentSkip: number;
}
export interface IRequestOptions {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    resource: string;
    body?: IDataObject;
    qs?: IDataObject;
    headers?: IDataObject;
    timeout?: number;
}
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
export interface ICsrfTokenCacheEntry {
    token: string;
    expires: number;
}
export interface IMetadataCacheEntry {
    entitySets: string[];
    functionImports: string[];
    expires: number;
    parsedMetadata?: unknown;
}
export interface IRateLimitEntry {
    requests: number[];
    resetTime: number;
}
export interface IErrorContext {
    operation?: string;
    resource?: string;
    itemIndex?: number;
    statusCode?: number;
}
export interface IServiceCatalogEntry {
    id: string;
    title: string;
    technicalName: string;
    servicePath: string;
    version: string;
    description?: string;
}
export interface IServiceCatalogCacheEntry {
    services: IServiceCatalogEntry[];
    expires: number;
}
export interface IWebhookEventInfo {
    type?: string;
    operation?: string;
    entityType?: string;
    entityKey?: string;
    timestamp?: string;
    data?: IDataObject;
}
export interface IConnectionPoolConfig {
    maxSockets: number;
    maxFreeSockets: number;
    timeout: number;
    keepAliveTimeout: number;
}
export interface IConnectionPoolStats {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    totalConnectionsCreated: number;
    totalConnectionsReused: number;
}
export interface IApiClientConfig {
    method: string;
    resource: string;
    body?: IDataObject;
    qs?: IDataObject;
    uri?: string;
    option?: IDataObject;
    csrfToken?: string;
    servicePath?: string;
}
export interface IOperationStrategy {
    execute(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
}
