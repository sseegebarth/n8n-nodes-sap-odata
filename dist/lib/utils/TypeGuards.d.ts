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
export declare function isError(value: unknown): value is Error;
export declare function isHttpError(error: unknown): error is IHttpError;
export declare function getHttpStatusCode(error: unknown): number | undefined;
export declare function isNetworkError(error: unknown): boolean;
export declare function isTimeoutError(error: unknown): boolean;
export declare function isCertificateError(error: unknown): boolean;
export declare function extractSapError(error: unknown): ISapODataError | undefined;
export declare function getErrorMessage(error: unknown): string;
export declare function isRetryableError(error: unknown): boolean;
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function isSapGuid(value: unknown): boolean;
export declare function isSapDateString(value: unknown): boolean;
export declare function isSapTimeString(value: unknown): boolean;
