import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions, IDataObject } from 'n8n-workflow';
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
export declare function executeRequest(this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions, config: IApiClientConfig): Promise<any>;
export declare function resetThrottleManager(): void;
