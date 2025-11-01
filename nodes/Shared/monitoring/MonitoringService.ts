/**
 * MonitoringService - Centralized monitoring and logging service
 *
 * Provides:
 * - Structured logging with context
 * - Performance metrics collection
 * - Error tracking and aggregation
 * - Alert generation and delivery
 */

import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions, IWebhookFunctions } from 'n8n-workflow';
import {
	IIdocProcessingLog,
	IRfcExecutionLog,
	IODataRequestLog,
	IProcessingError,
	IProcessingWarning,
	IAlert,
	LogLevel,
	ProcessingStatus,
	IntegrationType,
	getIdocStatusDescription,
} from './MonitoringTypes';

type IContextType = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

/**
 * Performance timer for tracking execution time
 */
export class PerformanceTimer {
	private startTime: number;
	private checkpoints: Map<string, number> = new Map();

	constructor() {
		this.startTime = Date.now();
	}

	/**
	 * Mark a checkpoint
	 */
	checkpoint(name: string): void {
		this.checkpoints.set(name, Date.now());
	}

	/**
	 * Get elapsed time since start
	 */
	elapsed(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * Get time since checkpoint
	 */
	since(checkpoint: string): number {
		const checkpointTime = this.checkpoints.get(checkpoint);
		if (!checkpointTime) {
			return 0;
		}
		return Date.now() - checkpointTime;
	}

	/**
	 * Get time between two checkpoints
	 */
	between(start: string, end: string): number {
		const startTime = this.checkpoints.get(start);
		const endTime = this.checkpoints.get(end);
		if (!startTime || !endTime) {
			return 0;
		}
		return endTime - startTime;
	}

	/**
	 * Get all metrics
	 */
	getMetrics(): Record<string, number> {
		const metrics: Record<string, number> = {
			totalTimeMs: this.elapsed(),
		};

		this.checkpoints.forEach((time, name) => {
			metrics[`${name}Ms`] = time - this.startTime;
		});

		return metrics;
	}
}

/**
 * Monitoring service singleton
 */
export class MonitoringService {
	private static logs: Array<IIdocProcessingLog | IRfcExecutionLog | IODataRequestLog> = [];
	private static maxLogEntries = 1000; // Keep last 1000 entries in memory

	/**
	 * Log IDoc processing
	 */
	static logIdocProcessing(
		context: IContextType,
		log: IIdocProcessingLog,
	): void {
		// Enrich with execution context
		const enrichedLog: IIdocProcessingLog = {
			...log,
			executionId: this.getExecutionId(context),
			workflowId: this.getWorkflowId(context),
			nodeId: this.getNodeId(context),
			timestamp: log.timestamp || new Date().toISOString(),
		};

		// Add to in-memory log
		this.addLog(enrichedLog);

		// Log to n8n logger
		const logLevel = this.getLogLevel(enrichedLog.status);
		const message = this.formatIdocLogMessage(enrichedLog);

		this.logToN8n(context, logLevel, message, {
			idocNumber: enrichedLog.idocNumber,
			idocType: enrichedLog.idocType,
			status: enrichedLog.status,
			sapStatus: enrichedLog.sapStatus,
			metrics: enrichedLog.metrics,
		});

		// Check for alerts
		if (enrichedLog.errors && enrichedLog.errors.length > 0) {
			this.generateAlert(context, enrichedLog);
		}
	}

	/**
	 * Log RFC execution
	 */
	static logRfcExecution(
		context: IContextType,
		log: IRfcExecutionLog,
	): void {
		// Enrich with execution context
		const enrichedLog: IRfcExecutionLog = {
			...log,
			executionId: this.getExecutionId(context),
			workflowId: this.getWorkflowId(context),
			nodeId: this.getNodeId(context),
			timestamp: log.timestamp || new Date().toISOString(),
		};

		// Add to in-memory log
		this.addLog(enrichedLog);

		// Log to n8n logger
		const logLevel = this.getLogLevel(enrichedLog.status);
		const message = this.formatRfcLogMessage(enrichedLog);

		this.logToN8n(context, logLevel, message, {
			functionName: enrichedLog.functionName,
			status: enrichedLog.status,
			bapiReturn: enrichedLog.bapiReturn,
			metrics: enrichedLog.metrics,
		});

		// Check for alerts
		if (enrichedLog.errors && enrichedLog.errors.length > 0) {
			this.generateAlert(context, enrichedLog);
		}
	}

	/**
	 * Log OData request
	 */
	static logODataRequest(
		context: IContextType,
		log: IODataRequestLog,
	): void {
		// Enrich with execution context
		const enrichedLog: IODataRequestLog = {
			...log,
			executionId: this.getExecutionId(context),
			workflowId: this.getWorkflowId(context),
			nodeId: this.getNodeId(context),
			timestamp: log.timestamp || new Date().toISOString(),
		};

		// Add to in-memory log
		this.addLog(enrichedLog);

		// Log to n8n logger
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

	/**
	 * Create performance timer
	 */
	static createTimer(): PerformanceTimer {
		return new PerformanceTimer();
	}

	/**
	 * Get recent logs
	 */
	static getRecentLogs(limit = 100): Array<IIdocProcessingLog | IRfcExecutionLog | IODataRequestLog> {
		return this.logs.slice(-limit);
	}

	/**
	 * Get logs by status
	 */
	static getLogsByStatus(status: ProcessingStatus): Array<IIdocProcessingLog | IRfcExecutionLog | IODataRequestLog> {
		return this.logs.filter(log => log.status === status);
	}

	/**
	 * Clear logs
	 */
	static clearLogs(): void {
		this.logs = [];
	}

	/**
	 * Add log entry to memory
	 */
	private static addLog(log: IIdocProcessingLog | IRfcExecutionLog | IODataRequestLog): void {
		this.logs.push(log);

		// Trim if exceeds max
		if (this.logs.length > this.maxLogEntries) {
			this.logs = this.logs.slice(-this.maxLogEntries);
		}
	}

	/**
	 * Get log level based on status
	 */
	private static getLogLevel(status: ProcessingStatus): LogLevel {
		switch (status) {
			case ProcessingStatus.ERROR:
				return LogLevel.ERROR;
			case ProcessingStatus.WARNING:
				return LogLevel.WARN;
			case ProcessingStatus.COMPLETED:
				return LogLevel.INFO;
			default:
				return LogLevel.DEBUG;
		}
	}

	/**
	 * Format IDoc log message
	 */
	private static formatIdocLogMessage(log: IIdocProcessingLog): string {
		const direction = log.direction === 'inbound' ? '→' : '←';
		const statusText = log.sapStatus ? getIdocStatusDescription(log.sapStatus) : log.status;

		return `[IDoc ${direction}] ${log.messageType} | ${log.sender} → ${log.receiver} | ${statusText} | ${log.metrics.totalTimeMs}ms | ${log.metrics.segmentCount} segments`;
	}

	/**
	 * Format RFC log message
	 */
	private static formatRfcLogMessage(log: IRfcExecutionLog): string {
		const returnInfo = log.bapiReturn ? ` | RETURN: ${log.bapiReturn.type} - ${log.bapiReturn.message}` : '';
		return `[RFC] ${log.functionName} | ${log.status} | ${log.metrics.totalTimeMs}ms${returnInfo}`;
	}

	/**
	 * Format OData log message
	 */
	private static formatODataLogMessage(log: IODataRequestLog): string {
		const cacheInfo = log.cacheHit ? ' [CACHED]' : '';
		const entity = log.entitySet || log.functionName || 'unknown';
		return `[OData] ${log.operation.toUpperCase()} ${entity} | HTTP ${log.httpStatus} | ${log.metrics.totalTimeMs}ms | ${log.metrics.recordsReturned} records${cacheInfo}`;
	}

	/**
	 * Log to n8n logger
	 */
	private static logToN8n(
		context: IContextType,
		level: LogLevel,
		message: string,
		data?: Record<string, any>,
	): void {
		if ('logger' in context && context.logger) {
			context.logger[level](message, data);
		} else {
			// Fallback to console
			console.log(`[${level.toUpperCase()}] ${message}`, data);
		}
	}

	/**
	 * Generate alert from log entry
	 */
	private static generateAlert(
		context: IContextType,
		log: IIdocProcessingLog | IRfcExecutionLog,
	): void {
		const errors = log.errors || [];
		if (errors.length === 0) return;

		const primaryError = errors[0];

		let alert: IAlert;

		if ('idocType' in log) {
			// IDoc alert
			alert = {
				timestamp: new Date().toISOString(),
				severity: primaryError.severity === 'critical' ? 'critical' : 'error',
				title: `IDoc Processing Error: ${log.messageType}`,
				message: primaryError.message,
				integrationType: log.direction === 'inbound' ? IntegrationType.IDOC_RECEIVE : IntegrationType.IDOC_SEND,
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
		} else {
			// RFC alert
			alert = {
				timestamp: new Date().toISOString(),
				severity: primaryError.severity === 'critical' ? 'critical' : 'error',
				title: `RFC Execution Error: ${log.functionName}`,
				message: primaryError.message,
				integrationType: IntegrationType.RFC,
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

		// Log alert
		this.logToN8n(context, LogLevel.ERROR, `ALERT: ${alert.title}`, alert);
	}

	/**
	 * Get IDoc error recommendations
	 */
	private static getIdocErrorRecommendations(errorCode: string): string[] {
		const recommendations: Record<string, string[]> = {
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

	/**
	 * Get RFC error recommendations
	 */
	private static getRfcErrorRecommendations(errorCode: string): string[] {
		const recommendations: Record<string, string[]> = {
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

	/**
	 * Get execution ID from context
	 */
	private static getExecutionId(context: IContextType): string | undefined {
		try {
			return context.getExecutionId?.();
		} catch {
			return undefined;
		}
	}

	/**
	 * Get workflow ID from context
	 */
	private static getWorkflowId(context: IContextType): string | undefined {
		try {
			return context.getWorkflow?.().id;
		} catch {
			return undefined;
		}
	}

	/**
	 * Get node ID from context
	 */
	private static getNodeId(context: IContextType): string | undefined {
		try {
			return context.getNode?.().id;
		} catch {
			return undefined;
		}
	}
}

/**
 * Helper function to create processing error
 */
export function createProcessingError(
	code: string,
	message: string,
	type: IProcessingError['type'],
	severity: 'error' | 'critical' = 'error',
	context?: Record<string, any>,
): IProcessingError {
	return {
		code,
		message,
		type,
		severity,
		timestamp: new Date().toISOString(),
		context,
	};
}

/**
 * Helper function to create processing warning
 */
export function createProcessingWarning(
	code: string,
	message: string,
	type: IProcessingWarning['type'],
	context?: Record<string, any>,
): IProcessingWarning {
	return {
		code,
		message,
		type,
		timestamp: new Date().toISOString(),
		context,
	};
}
