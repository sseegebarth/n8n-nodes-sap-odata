import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export interface ILogContext {
    module?: string;
    operation?: string;
    itemIndex?: number;
    workflowId?: string;
    executionId?: string;
    [key: string]: any;
}
export interface ILoggerTransport {
    log(level: LogLevel, message: string, context?: ILogContext): void;
}
export declare class ConsoleTransport implements ILoggerTransport {
    private static readonly PREFIX;
    log(level: LogLevel, message: string, context?: ILogContext): void;
}
export declare class N8nTransport implements ILoggerTransport {
    private context;
    constructor(context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions);
    log(level: LogLevel, message: string, context?: ILogContext): void;
}
export declare class LoggerAdapter {
    private static debugEnabled;
    private static transport;
    static setTransport(transport: ILoggerTransport): void;
    static fromContext(context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions): LoggerAdapter;
    static setDebugMode(enabled: boolean): void;
    static debug(message: string, context?: ILogContext): void;
    static info(message: string, context?: ILogContext): void;
    static warn(message: string, context?: ILogContext): void;
    static error(message: string, error?: Error, context?: ILogContext): void;
    static logPoolStats(stats: any): void;
    static logRequest(method: string, url: string, duration?: number, statusCode?: number): void;
    static logSecurityWarning(message: string): void;
    static logPerformance(operation: string, duration: number, metadata?: any): void;
}
export { LoggerAdapter as Logger };
