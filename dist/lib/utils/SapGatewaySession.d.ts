import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
export interface ISapGatewaySession {
    csrfToken: string;
    cookies: string[];
    sapContextId?: string;
    sessionId?: string;
    lastActivity: number;
    expiresAt: number;
}
export interface ISessionConfig {
    sessionTimeout?: number;
    csrfTimeout?: number;
    persistCookies?: boolean;
    enableContextId?: boolean;
}
export declare class SapGatewaySessionManager {
    private static readonly DEFAULT_SESSION_TIMEOUT;
    private static readonly DEFAULT_CSRF_TIMEOUT;
    private static getSessionKey;
    static getSession(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): Promise<ISapGatewaySession | null>;
    static setSession(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string, session: Partial<ISapGatewaySession>, config?: ISessionConfig): Promise<void>;
    static getCsrfToken(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): Promise<string | null>;
    static updateCsrfToken(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string, token: string): Promise<void>;
    static getCookieHeader(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): Promise<string | null>;
    static updateCookies(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string, setCookieHeaders: string | string[]): Promise<void>;
    static updateContextId(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string, contextId: string): Promise<void>;
    static getContextId(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): Promise<string | null>;
    static clearSession(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions, host: string, servicePath: string): Promise<void>;
    static cleanupExpiredSessions(context: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions): void;
}
