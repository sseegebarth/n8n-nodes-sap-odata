export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export declare enum IntegrationType {
    ODATA = "odata",
    IDOC_SEND = "idoc-send",
    IDOC_RECEIVE = "idoc-receive",
    RFC = "rfc",
    BAPI = "bapi"
}
export declare enum ProcessingStatus {
    RECEIVED = "received",
    PARSING = "parsing",
    PARSED = "parsed",
    VALIDATING = "validating",
    PROCESSING = "processing",
    COMPLETED = "completed",
    ERROR = "error",
    WARNING = "warning"
}
export declare enum IdocStatus {
    CREATED = "01",
    PASSED_TO_APP = "02",
    DATA_ERROR = "03",
    SYSTEM_ERROR = "04",
    APP_DOC_CREATED = "51",
    APP_DOC_POSTED = "53",
    ERROR_IN_APP = "56",
    READY_TO_DISPATCH = "30",
    DISPATCHED = "03",
    ERROR_DISPATCHING = "12",
    READY_TO_TRANSFER = "64",
    SENT_TO_EDI = "02",
    ARCHIVED = "99"
}
export interface IIdocProcessingLog {
    timestamp: string;
    executionId?: string;
    workflowId?: string;
    nodeId?: string;
    idocNumber?: string;
    idocType: string;
    messageType: string;
    direction: 'inbound' | 'outbound';
    sender: string;
    receiver: string;
    status: ProcessingStatus;
    sapStatus?: IdocStatus;
    sapStatusText?: string;
    metrics: {
        parseTimeMs?: number;
        validationTimeMs?: number;
        processingTimeMs?: number;
        totalTimeMs: number;
        segmentCount: number;
        payloadSizeBytes: number;
    };
    errors?: IProcessingError[];
    warnings?: IProcessingWarning[];
}
export interface IRfcExecutionLog {
    timestamp: string;
    executionId?: string;
    workflowId?: string;
    nodeId?: string;
    functionName: string;
    functionType: 'RFC' | 'BAPI';
    connectionType: 'direct' | 'loadBalancing';
    sapSystem: string;
    client: string;
    status: ProcessingStatus;
    metrics: {
        connectionTimeMs?: number;
        executionTimeMs: number;
        totalTimeMs: number;
        parameterCount: number;
        tableRowsReturned: number;
    };
    bapiReturn?: {
        type: 'S' | 'W' | 'E' | 'A';
        id: string;
        number: string;
        message: string;
    };
    errors?: IProcessingError[];
    warnings?: IProcessingWarning[];
}
export interface IODataRequestLog {
    timestamp: string;
    executionId?: string;
    workflowId?: string;
    nodeId?: string;
    operation: 'get' | 'getAll' | 'create' | 'update' | 'delete' | 'function';
    entitySet?: string;
    functionName?: string;
    serviceUrl: string;
    odataVersion: 'v2' | 'v4';
    status: ProcessingStatus;
    httpStatus?: number;
    metrics: {
        requestTimeMs: number;
        responseTimeMs: number;
        totalTimeMs: number;
        recordsReturned: number;
        payloadSizeBytes: number;
    };
    cacheHit?: boolean;
    errors?: IProcessingError[];
    warnings?: IProcessingWarning[];
}
export interface IProcessingError {
    code: string;
    message: string;
    type: 'validation' | 'network' | 'sap' | 'parsing' | 'business' | 'system';
    severity: 'error' | 'critical';
    timestamp: string;
    context?: Record<string, unknown>;
    stackTrace?: string;
}
export interface IProcessingWarning {
    code: string;
    message: string;
    type: 'validation' | 'performance' | 'deprecation' | 'data';
    timestamp: string;
    context?: Record<string, unknown>;
}
export interface IAggregatedMetrics {
    period: {
        start: string;
        end: string;
    };
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    warningExecutions: number;
    byIntegrationType: {
        [key in IntegrationType]?: {
            count: number;
            successRate: number;
            avgExecutionTimeMs: number;
        };
    };
    performance: {
        avgExecutionTimeMs: number;
        minExecutionTimeMs: number;
        maxExecutionTimeMs: number;
        p95ExecutionTimeMs: number;
        p99ExecutionTimeMs: number;
    };
    topErrors: Array<{
        code: string;
        message: string;
        count: number;
        lastOccurrence: string;
    }>;
    totalRecordsProcessed: number;
    totalPayloadSizeBytes: number;
}
export interface IAlertConfig {
    enabled: boolean;
    channels: Array<{
        type: 'email' | 'webhook' | 'slack' | 'teams';
        config: Record<string, unknown>;
    }>;
    triggers: {
        onError?: boolean;
        onWarning?: boolean;
        onSlowExecution?: {
            enabled: boolean;
            thresholdMs: number;
        };
        onHighErrorRate?: {
            enabled: boolean;
            thresholdPercent: number;
            windowMinutes: number;
        };
    };
}
export interface IAlert {
    timestamp: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    integrationType: IntegrationType;
    executionId?: string;
    workflowId?: string;
    nodeId?: string;
    details: {
        errorCode?: string;
        errorMessage?: string;
        metrics?: Record<string, unknown>;
        sapStatus?: string;
    };
    recommendations?: string[];
}
export declare const IDOC_STATUS_DESCRIPTIONS: Record<string, string>;
export declare function getIdocStatusDescription(status: string): string;
export declare function isSuccessStatus(status: string): boolean;
export declare function isErrorStatus(status: string): boolean;
