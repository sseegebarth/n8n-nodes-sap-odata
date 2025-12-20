import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions, IWebhookFunctions } from 'n8n-workflow';
import { IIdocProcessingLog, IRfcExecutionLog, IODataRequestLog, IProcessingError, IProcessingWarning, ProcessingStatus } from './MonitoringTypes';
type IContextType = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;
export declare class PerformanceTimer {
    private startTime;
    private checkpoints;
    constructor();
    checkpoint(name: string): void;
    elapsed(): number;
    since(checkpoint: string): number;
    between(start: string, end: string): number;
    getMetrics(): Record<string, number>;
}
export declare class MonitoringService {
    private static logs;
    private static maxLogEntries;
    static logIdocProcessing(context: IContextType, log: IIdocProcessingLog): void;
    static logRfcExecution(context: IContextType, log: IRfcExecutionLog): void;
    static logODataRequest(context: IContextType, log: IODataRequestLog): void;
    static createTimer(): PerformanceTimer;
    static getRecentLogs(limit?: number): Array<IIdocProcessingLog | IRfcExecutionLog | IODataRequestLog>;
    static getLogsByStatus(status: ProcessingStatus): Array<IIdocProcessingLog | IRfcExecutionLog | IODataRequestLog>;
    static clearLogs(): void;
    private static addLog;
    private static getLogLevel;
    private static formatIdocLogMessage;
    private static formatRfcLogMessage;
    private static formatODataLogMessage;
    private static logToN8n;
    private static generateAlert;
    private static getIdocErrorRecommendations;
    private static getRfcErrorRecommendations;
    private static getExecutionId;
    private static getWorkflowId;
    private static getNodeId;
}
export declare function createProcessingError(code: string, message: string, type: IProcessingError['type'], severity?: 'error' | 'critical', context?: Record<string, any>): IProcessingError;
export declare function createProcessingWarning(code: string, message: string, type: IProcessingWarning['type'], context?: Record<string, any>): IProcessingWarning;
export {};
