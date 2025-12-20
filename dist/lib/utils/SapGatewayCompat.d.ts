import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions, IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { ISapMessage } from './SapMessageParser';
export interface ISapGatewayRequestOptions {
    enableSession?: boolean;
    enableContextId?: boolean;
    enableMessageParsing?: boolean;
    preferRepresentation?: 'minimal' | 'representation';
    batchMode?: boolean;
}
export interface ISapGatewayResponse {
    body: unknown;
    statusCode: number;
    headers: IDataObject;
    messages?: ISapMessage[];
    contextId?: string;
    csrfToken?: string;
}
export declare class SapGatewayCompat {
    static enhanceRequestOptions(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, requestOptions: IHttpRequestOptions, host: string, servicePath: string, gatewayOptions?: ISapGatewayRequestOptions): Promise<IHttpRequestOptions>;
    static processResponse(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, response: unknown, host: string, servicePath: string, gatewayOptions?: ISapGatewayRequestOptions): Promise<ISapGatewayResponse>;
    static fetchCsrfToken(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string, requestBuilder: (host: string, servicePath: string) => IHttpRequestOptions): Promise<string>;
    static clearSession(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): void;
    static getSessionStatus(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): Promise<{
        hasSession: boolean;
        hasCsrfToken: boolean;
        hasContextId: boolean;
        cookieCount: number;
        expiresAt?: string;
    }>;
    static formatErrorMessage(messages: ISapMessage[] | undefined, fallbackMessage: string): string;
}
