"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = exports.PerformanceTimer = void 0;
exports.createProcessingError = createProcessingError;
exports.createProcessingWarning = createProcessingWarning;
const MonitoringTypes_1 = require("./MonitoringTypes");
class PerformanceTimer {
    constructor() {
        this.checkpoints = new Map();
        this.startTime = Date.now();
    }
    checkpoint(name) {
        this.checkpoints.set(name, Date.now());
    }
    elapsed() {
        return Date.now() - this.startTime;
    }
    since(checkpoint) {
        const checkpointTime = this.checkpoints.get(checkpoint);
        if (!checkpointTime) {
            return 0;
        }
        return Date.now() - checkpointTime;
    }
    between(start, end) {
        const startTime = this.checkpoints.get(start);
        const endTime = this.checkpoints.get(end);
        if (!startTime || !endTime) {
            return 0;
        }
        return endTime - startTime;
    }
    getMetrics() {
        const metrics = {
            totalTimeMs: this.elapsed(),
        };
        this.checkpoints.forEach((time, name) => {
            metrics[`${name}Ms`] = time - this.startTime;
        });
        return metrics;
    }
}
exports.PerformanceTimer = PerformanceTimer;
class MonitoringService {
    static logIdocProcessing(context, log) {
        const enrichedLog = {
            ...log,
            executionId: this.getExecutionId(context),
            workflowId: this.getWorkflowId(context),
            nodeId: this.getNodeId(context),
            timestamp: log.timestamp || new Date().toISOString(),
        };
        this.addLog(enrichedLog);
        const logLevel = this.getLogLevel(enrichedLog.status);
        const message = this.formatIdocLogMessage(enrichedLog);
        this.logToN8n(context, logLevel, message, {
            idocNumber: enrichedLog.idocNumber,
            idocType: enrichedLog.idocType,
            status: enrichedLog.status,
            sapStatus: enrichedLog.sapStatus,
            metrics: enrichedLog.metrics,
        });
        if (enrichedLog.errors && enrichedLog.errors.length > 0) {
            this.generateAlert(context, enrichedLog);
        }
    }
    static logRfcExecution(context, log) {
        const enrichedLog = {
            ...log,
            executionId: this.getExecutionId(context),
            workflowId: this.getWorkflowId(context),
            nodeId: this.getNodeId(context),
            timestamp: log.timestamp || new Date().toISOString(),
        };
        this.addLog(enrichedLog);
        const logLevel = this.getLogLevel(enrichedLog.status);
        const message = this.formatRfcLogMessage(enrichedLog);
        this.logToN8n(context, logLevel, message, {
            functionName: enrichedLog.functionName,
            status: enrichedLog.status,
            bapiReturn: enrichedLog.bapiReturn,
            metrics: enrichedLog.metrics,
        });
        if (enrichedLog.errors && enrichedLog.errors.length > 0) {
            this.generateAlert(context, enrichedLog);
        }
    }
    static logODataRequest(context, log) {
        const enrichedLog = {
            ...log,
            executionId: this.getExecutionId(context),
            workflowId: this.getWorkflowId(context),
            nodeId: this.getNodeId(context),
            timestamp: log.timestamp || new Date().toISOString(),
        };
        this.addLog(enrichedLog);
        const logLevel = this.getLogLevel(enrichedLog.status);
        const message = this.formatODataLogMessage(enrichedLog);
        this.logToN8n(context, logLevel, message, {
            operation: enrichedLog.operation,
            entitySet: enrichedLog.entitySet,
            status: enrichedLog.status,
            httpStatus: enrichedLog.httpStatus,
            metrics: enrichedLog.metrics,
            cacheHit: enrichedLog.cacheHit,
        });
    }
    static createTimer() {
        return new PerformanceTimer();
    }
    static getRecentLogs(limit = 100) {
        return this.logs.slice(-limit);
    }
    static getLogsByStatus(status) {
        return this.logs.filter(log => log.status === status);
    }
    static clearLogs() {
        this.logs = [];
    }
    static addLog(log) {
        this.logs.push(log);
        if (this.logs.length > this.maxLogEntries) {
            this.logs = this.logs.slice(-this.maxLogEntries);
        }
    }
    static getLogLevel(status) {
        switch (status) {
            case MonitoringTypes_1.ProcessingStatus.ERROR:
                return MonitoringTypes_1.LogLevel.ERROR;
            case MonitoringTypes_1.ProcessingStatus.WARNING:
                return MonitoringTypes_1.LogLevel.WARN;
            case MonitoringTypes_1.ProcessingStatus.COMPLETED:
                return MonitoringTypes_1.LogLevel.INFO;
            default:
                return MonitoringTypes_1.LogLevel.DEBUG;
        }
    }
    static formatIdocLogMessage(log) {
        const direction = log.direction === 'inbound' ? '→' : '←';
        const statusText = log.sapStatus ? (0, MonitoringTypes_1.getIdocStatusDescription)(log.sapStatus) : log.status;
        return `[IDoc ${direction}] ${log.messageType} | ${log.sender} → ${log.receiver} | ${statusText} | ${log.metrics.totalTimeMs}ms | ${log.metrics.segmentCount} segments`;
    }
    static formatRfcLogMessage(log) {
        const returnInfo = log.bapiReturn ? ` | RETURN: ${log.bapiReturn.type} - ${log.bapiReturn.message}` : '';
        return `[RFC] ${log.functionName} | ${log.status} | ${log.metrics.totalTimeMs}ms${returnInfo}`;
    }
    static formatODataLogMessage(log) {
        const cacheInfo = log.cacheHit ? ' [CACHED]' : '';
        const entity = log.entitySet || log.functionName || 'unknown';
        return `[OData] ${log.operation.toUpperCase()} ${entity} | HTTP ${log.httpStatus} | ${log.metrics.totalTimeMs}ms | ${log.metrics.recordsReturned} records${cacheInfo}`;
    }
    static logToN8n(context, level, message, data) {
        if ('logger' in context && context.logger) {
            context.logger[level](message, data);
        }
        else {
            console.log(`[${level.toUpperCase()}] ${message}`, data);
        }
    }
    static generateAlert(context, log) {
        const errors = log.errors || [];
        if (errors.length === 0)
            return;
        const primaryError = errors[0];
        let alert;
        if ('idocType' in log) {
            alert = {
                timestamp: new Date().toISOString(),
                severity: primaryError.severity === 'critical' ? 'critical' : 'error',
                title: `IDoc Processing Error: ${log.messageType}`,
                message: primaryError.message,
                integrationType: log.direction === 'inbound' ? MonitoringTypes_1.IntegrationType.IDOC_RECEIVE : MonitoringTypes_1.IntegrationType.IDOC_SEND,
                executionId: log.executionId,
                workflowId: log.workflowId,
                nodeId: log.nodeId,
                details: {
                    errorCode: primaryError.code,
                    errorMessage: primaryError.message,
                    sapStatus: log.sapStatus,
                    metrics: log.metrics,
                },
                recommendations: this.getIdocErrorRecommendations(primaryError.code),
            };
        }
        else {
            alert = {
                timestamp: new Date().toISOString(),
                severity: primaryError.severity === 'critical' ? 'critical' : 'error',
                title: `RFC Execution Error: ${log.functionName}`,
                message: primaryError.message,
                integrationType: MonitoringTypes_1.IntegrationType.RFC,
                executionId: log.executionId,
                workflowId: log.workflowId,
                nodeId: log.nodeId,
                details: {
                    errorCode: primaryError.code,
                    errorMessage: primaryError.message,
                    metrics: log.metrics,
                },
                recommendations: this.getRfcErrorRecommendations(primaryError.code),
            };
        }
        this.logToN8n(context, MonitoringTypes_1.LogLevel.ERROR, `ALERT: ${alert.title}`, alert);
    }
    static getIdocErrorRecommendations(errorCode) {
        const recommendations = {
            'PARSE_ERROR': [
                'Verify IDoc XML structure is valid',
                'Check for required segments (EDI_DC40, IDOC)',
                'Ensure UTF-8 encoding',
            ],
            'VALIDATION_ERROR': [
                'Check field values match expected types',
                'Verify required fields are present',
                'Review SAP IDoc documentation for structure',
            ],
            'SAP_ERROR': [
                'Check SAP system logs (WE02, WE05)',
                'Verify partner profile configuration',
                'Review IDoc port settings',
            ],
        };
        return recommendations[errorCode] || ['Review error message and SAP documentation'];
    }
    static getRfcErrorRecommendations(errorCode) {
        const recommendations = {
            'CONNECTION_ERROR': [
                'Verify SAP system is reachable',
                'Check RFC credentials',
                'Review firewall and network settings',
            ],
            'BAPI_ERROR': [
                'Review BAPI RETURN structure for details',
                'Check input parameter values',
                'Verify user authorizations',
            ],
            'RFC_SDK_ERROR': [
                'Ensure SAP NW RFC SDK is installed',
                'Verify node-rfc module is available',
                'Check system library paths',
            ],
        };
        return recommendations[errorCode] || ['Review error message and SAP documentation'];
    }
    static getExecutionId(context) {
        var _a;
        try {
            return (_a = context.getExecutionId) === null || _a === void 0 ? void 0 : _a.call(context);
        }
        catch {
            return undefined;
        }
    }
    static getWorkflowId(context) {
        var _a;
        try {
            return (_a = context.getWorkflow) === null || _a === void 0 ? void 0 : _a.call(context).id;
        }
        catch {
            return undefined;
        }
    }
    static getNodeId(context) {
        var _a;
        try {
            return (_a = context.getNode) === null || _a === void 0 ? void 0 : _a.call(context).id;
        }
        catch {
            return undefined;
        }
    }
}
exports.MonitoringService = MonitoringService;
MonitoringService.logs = [];
MonitoringService.maxLogEntries = 1000;
function createProcessingError(code, message, type, severity = 'error', context) {
    return {
        code,
        message,
        type,
        severity,
        timestamp: new Date().toISOString(),
        context,
    };
}
function createProcessingWarning(code, message, type, context) {
    return {
        code,
        message,
        type,
        timestamp: new Date().toISOString(),
        context,
    };
}
