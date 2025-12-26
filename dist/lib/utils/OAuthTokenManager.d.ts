import { ICredentialTestFunctions, IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
export interface IOAuthToken {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    expiresAt: number;
    scope?: string;
}
export interface IOAuthCredentials {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
    allowUnauthorizedCerts?: boolean;
}
export declare function getOAuthToken(context: ICredentialTestFunctions | IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions, credentials: IOAuthCredentials): Promise<IOAuthToken>;
export declare function getOAuthAuthorizationHeader(context: ICredentialTestFunctions | IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions, credentials: IOAuthCredentials): Promise<string>;
export declare function clearTokenCache(credentials?: IOAuthCredentials): void;
export declare function isOAuthCredentials(credentials: any): boolean;
