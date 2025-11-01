/**
 * MonitoringTypes - Structured monitoring and logging types
 *
 * Provides comprehensive monitoring capabilities for SAP integrations:
 * - IDoc processing tracking
 * - RFC/BAPI execution metrics
 * - OData request monitoring
 * - Error tracking and alerting
 */

/**
 * Log levels aligned with n8n logger
 */
export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
}

/**
 * Integration types
 */
export enum IntegrationType {
	ODATA = 'odata',
	IDOC_SEND = 'idoc-send',
	IDOC_RECEIVE = 'idoc-receive',
	RFC = 'rfc',
	BAPI = 'bapi',
}

/**
 * Processing status
 */
export enum ProcessingStatus {
	RECEIVED = 'received',
	PARSING = 'parsing',
	PARSED = 'parsed',
	VALIDATING = 'validating',
	PROCESSING = 'processing',
	COMPLETED = 'completed',
	ERROR = 'error',
	WARNING = 'warning',
}

/**
 * SAP IDoc status codes (standardized)
 * Based on SAP IDoc processing status table
 */
export enum IdocStatus {
	// Inbound Processing
	CREATED = '01',					// IDoc created
	PASSED_TO_APP = '02',			// Passed to application
	DATA_ERROR = '03',				// Data error
	SYSTEM_ERROR = '04',			// System error

	// Application Processing
	APP_DOC_CREATED = '51',			// Application document created
	APP_DOC_POSTED = '53',			// Application document posted
	ERROR_IN_APP = '56',			// Error in application

	// Outbound Processing
	READY_TO_DISPATCH = '30',		// IDoc ready for dispatch
	DISPATCHED = '03',				// IDoc dispatched
	ERROR_DISPATCHING = '12',		// Error dispatching

	// ALE/EDI
	READY_TO_TRANSFER = '64',		// Ready to transfer to EDI
	SENT_TO_EDI = '02',				// Sent to EDI subsystem

	// Custom/Extended
	ARCHIVED = '99',				// Successfully archived
}

/**
 * IDoc processing log entry
 */
export interface IIdocProcessingLog {
	// Identity
	timestamp: string;
	executionId?: string;
	workflowId?: string;
	nodeId?: string;

	// IDoc Information
	idocNumber?: string;
	idocType: string;
	messageType: string;
	direction: 'inbound' | 'outbound';

	// Sender/Receiver
	sender: string;
	receiver: string;

	// Processing Status
	status: ProcessingStatus;
	sapStatus?: IdocStatus;
	sapStatusText?: string;

	// Metrics
	metrics: {
		parseTimeMs?: number;
		validationTimeMs?: number;
		processingTimeMs?: number;
		totalTimeMs: number;
		segmentCount: number;
		payloadSizeBytes: number;
	};

	// Error Information
	errors?: IProcessingError[];
	warnings?: IProcessingWarning[];
}

/**
 * RFC/BAPI execution log entry
 */
export interface IRfcExecutionLog {
	// Identity
	timestamp: string;
	executionId?: string;
	workflowId?: string;
	nodeId?: string;

	// Function Information
	functionName: string;
	functionType: 'RFC' | 'BAPI';

	// Connection Information
	connectionType: 'direct' | 'loadBalancing';
	sapSystem: string;
	client: string;

	// Processing Status
	status: ProcessingStatus;

	// Metrics
	metrics: {
		connectionTimeMs?: number;
		executionTimeMs: number;
		totalTimeMs: number;
		parameterCount: number;
		tableRowsReturned: number;
	};

	// BAPI Return Information
	bapiReturn?: {
		type: 'S' | 'W' | 'E' | 'A';
		id: string;
		number: string;
		message: string;
	};

	// Error Information
	errors?: IProcessingError[];
	warnings?: IProcessingWarning[];
}

/**
 * OData request log entry
 */
export interface IODataRequestLog {
	// Identity
	timestamp: string;
	executionId?: string;
	workflowId?: string;
	nodeId?: string;

	// Request Information
	operation: 'get' | 'getAll' | 'create' | 'update' | 'delete' | 'function';
	entitySet?: string;
	functionName?: string;

	// Service Information
	serviceUrl: string;
	odataVersion: 'v2' | 'v4';

	// Processing Status
	status: ProcessingStatus;
	httpStatus?: number;

	// Metrics
	metrics: {
		requestTimeMs: number;
		responseTimeMs: number;
		totalTimeMs: number;
		recordsReturned: number;
		payloadSizeBytes: number;
	};

	// Caching
	cacheHit?: boolean;

	// Error Information
	errors?: IProcessingError[];
	warnings?: IProcessingWarning[];
}

/**
 * Processing error details
 */
export interface IProcessingError {
	code: string;
	message: string;
	type: 'validation' | 'network' | 'sap' | 'parsing' | 'business' | 'system';
	severity: 'error' | 'critical';
	timestamp: string;
	context?: Record<string, unknown>;
	stackTrace?: string;
}

/**
 * Processing warning details
 */
export interface IProcessingWarning {
	code: string;
	message: string;
	type: 'validation' | 'performance' | 'deprecation' | 'data';
	timestamp: string;
	context?: Record<string, unknown>;
}

/**
 * Aggregated metrics for reporting
 */
export interface IAggregatedMetrics {
	period: {
		start: string;
		end: string;
	};

	// Counts
	totalExecutions: number;
	successfulExecutions: number;
	failedExecutions: number;
	warningExecutions: number;

	// By Integration Type
	byIntegrationType: {
		[key in IntegrationType]?: {
			count: number;
			successRate: number;
			avgExecutionTimeMs: number;
		};
	};

	// Performance
	performance: {
		avgExecutionTimeMs: number;
		minExecutionTimeMs: number;
		maxExecutionTimeMs: number;
		p95ExecutionTimeMs: number;
		p99ExecutionTimeMs: number;
	};

	// Errors
	topErrors: Array<{
		code: string;
		message: string;
		count: number;
		lastOccurrence: string;
	}>;

	// Volume
	totalRecordsProcessed: number;
	totalPayloadSizeBytes: number;
}

/**
 * Alert configuration
 */
export interface IAlertConfig {
	enabled: boolean;
	channels: Array<{
		type: 'email' | 'webhook' | 'slack' | 'teams';
		config: Record<string, unknown>;
	}>;

	// Alert triggers
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

/**
 * Alert payload
 */
export interface IAlert {
	timestamp: string;
	severity: 'info' | 'warning' | 'error' | 'critical';
	title: string;
	message: string;
	integrationType: IntegrationType;

	// Context
	executionId?: string;
	workflowId?: string;
	nodeId?: string;

	// Details
	details: {
		errorCode?: string;
		errorMessage?: string;
		metrics?: Record<string, unknown>;
		sapStatus?: string;
	};

	// Recommendations
	recommendations?: string[];
}

/**
 * SAP IDoc status code descriptions
 */
export const IDOC_STATUS_DESCRIPTIONS: Record<string, string> = {
	'01': 'IDoc created',
	'02': 'Error passing data to port',
	'03': 'Data passed to port OK',
	'04': 'Error within control information',
	'05': 'Error during translation',
	'06': 'Translation OK',
	'07': 'Error during syntax check',
	'08': 'Syntax check OK',
	'09': 'Error during interchange handling',
	'10': 'Interchange handling OK',
	'11': 'Error during dispatch',
	'12': 'Dispatch OK',
	'29': 'Processing despite error',
	'30': 'IDoc ready for dispatch (ALE service)',
	'31': 'Error - no further processing',
	'32': 'IDoc was edited',
	'33': 'Original of an IDoc which was edited',
	'34': 'Error in ALE service',
	'35': 'IDoc reloaded from archive',
	'37': 'IDoc added incorrectly',
	'38': 'IDoc archived',
	'39': 'IDoc is component of a package (EDI)',
	'40': 'Application document created',
	'41': 'Application document not created',
	'42': 'Application document partially posted',
	'43': 'IDoc ready to be transferred to application',
	'50': 'IDoc added',
	'51': 'Application document created',
	'52': 'Application document not fully posted',
	'53': 'Application document posted',
	'56': 'IDoc with errors added',
	'60': 'Error during syntax check of EDI_DC',
	'61': 'Error during syntax check of data',
	'62': 'IDoc passed to application',
	'63': 'Error passing IDoc to application',
	'64': 'IDoc ready to be passed to application',
	'65': 'Error in ALE service',
	'66': 'IDoc is waiting for predecessor IDoc',
	'69': 'IDoc was edited',
	'70': 'Original of an IDoc which was edited',
	'71': 'IDoc reloaded from archive',
	'74': 'IDoc archived',
	'75': 'IDoc was converted to the new format',
};

/**
 * Get human-readable status description
 */
export function getIdocStatusDescription(status: string): string {
	return IDOC_STATUS_DESCRIPTIONS[status] || `Unknown status: ${status}`;
}

/**
 * Determine if status indicates success
 */
export function isSuccessStatus(status: string): boolean {
	const successStatuses = ['03', '08', '10', '12', '30', '51', '53', '64'];
	return successStatuses.includes(status);
}

/**
 * Determine if status indicates error
 */
export function isErrorStatus(status: string): boolean {
	const errorStatuses = ['02', '04', '05', '07', '09', '11', '31', '34', '41', '56', '60', '61', '63', '65'];
	return errorStatuses.includes(status);
}
