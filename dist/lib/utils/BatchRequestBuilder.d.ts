import { IDataObject } from 'n8n-workflow';
export declare enum BatchOperationType {
    CREATE = "POST",
    UPDATE = "PATCH",
    DELETE = "DELETE",
    GET = "GET"
}
export interface IBatchOperation {
    type: BatchOperationType;
    entitySet: string;
    entityKey?: string;
    data?: IDataObject;
    queryParams?: IDataObject;
    headers?: Record<string, string>;
}
export interface IBatchRequestConfig {
    operations: IBatchOperation[];
    servicePath: string;
    useChangeSet?: boolean;
}
export interface IBatchResponse {
    success: boolean;
    results: Array<{
        operation: IBatchOperation;
        success: boolean;
        statusCode: number;
        data?: unknown;
        error?: string;
    }>;
}
export declare class BatchRequestBuilder {
    private static readonly BATCH_BOUNDARY_PREFIX;
    private static readonly CHANGESET_BOUNDARY_PREFIX;
    static buildBatchRequest(config: IBatchRequestConfig): {
        body: string;
        contentType: string;
        boundary: string;
    };
    private static buildChangeSet;
    private static buildOperationPart;
    private static buildOperationContent;
    private static buildOperationUrl;
    static parseBatchResponse(responseText: string, boundary: string): IBatchResponse;
    private static parseResponsePart;
    static splitIntoBatches(operations: IBatchOperation[], batchSize?: number): IBatchOperation[][];
    static validateOperations(operations: IBatchOperation[]): {
        valid: boolean;
        errors: string[];
    };
}
