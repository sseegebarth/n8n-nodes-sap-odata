import { IDataObject, IHttpRequestOptions, INode } from 'n8n-workflow';
import { ISapOdataCredentials } from '../types';
export interface IRequestConfig {
    method: string;
    resource: string;
    host: string;
    servicePath: string;
    body?: IDataObject;
    qs?: IDataObject;
    uri?: string;
    options?: IDataObject;
    credentials: ISapOdataCredentials;
    csrfToken?: string;
    poolConfig?: IDataObject;
    node: INode;
}
export declare function buildRequestOptions(config: IRequestConfig): IHttpRequestOptions;
export declare function buildCsrfTokenRequest(host: string, servicePath: string, credentials: ISapOdataCredentials, node: INode): IHttpRequestOptions;
export declare function parsePoolConfig(advancedOptions: IDataObject): IDataObject;
export declare function parseStatusCodes(codes: string): number[];
export declare function buildODataQueryString(qs: IDataObject): string;
