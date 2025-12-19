/**
 * Logger Adapter for n8n Integration
 *
 * Provides abstraction layer for logging that can use:
 * - n8n's built-in logging facilities (production)
 * - Console logging (development/fallback)
 * - Custom logging transports (optional)
 */

import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';

export enum LogLevel {
	DEBUG = 'debug',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
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

/**
 * Console transport for development and fallback
 */
export class ConsoleTransport implements ILoggerTransport {
	private static readonly PREFIX = '[SAP OData]';

	log(level: LogLevel, message: string, context?: ILogContext): void {
		const timestamp = new Date().toISOString();
		const prefix = `${ConsoleTransport.PREFIX} [${level.toUpperCase()}] [${timestamp}]`;

		if (context && Object.keys(context).length > 0) {
			console.log(`${prefix} ${message}`, context);
		} else {
			console.log(`${prefix} ${message}`);
		}
	}
}

/**
 * n8n Logger transport - integrates with n8n's logging system
 */
export class N8nTransport implements ILoggerTransport {
	constructor(
		private context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	) {}

	log(level: LogLevel, message: string, context?: ILogContext): void {
		const logger = this.context.logger;

		// Enrich context with n8n workflow information
		const enrichedContext = {
			...context,
			node: this.context.getNode().name,
			nodeType: this.context.getNode().type,
		};

		// Add workflow and execution IDs if available
		if ('getExecutionId' in this.context) {
			try {
				enrichedContext.executionId = this.context.getExecutionId();
			} catch (error) {
				// getExecutionId might not be available in all contexts
			}
		}

		if ('getWorkflow' in this.context) {
			try {
				enrichedContext.workflowId = this.context.getWorkflow().id;
			} catch (error) {
				// getWorkflow might not be available in all contexts
			}
		}

		// Format message with context
		const formattedMessage = context
			? `${message} ${JSON.stringify(enrichedContext)}`
			: message;

		// Use n8n's logger with appropriate level
		switch (level) {
			case LogLevel.DEBUG:
				logger.debug(formattedMessage);
				break;
			case LogLevel.INFO:
				logger.info(formattedMessage);
				break;
			case LogLevel.WARN:
				logger.warn(formattedMessage);
				break;
			case LogLevel.ERROR:
				logger.error(formattedMessage);
				break;
		}
	}
}

/**
 * Logger Adapter with pluggable transports
 */
export class LoggerAdapter {
	private static debugEnabled = false;
	private static transport: ILoggerTransport = new ConsoleTransport();

	/**
	 * Set the logging transport
	 */
	static setTransport(transport: ILoggerTransport): void {
		this.transport = transport;
	}

	/**
	 * Create n8n-integrated logger from context
	 */
	static fromContext(
		context: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	): LoggerAdapter {
		const adapter = new LoggerAdapter();
		LoggerAdapter.setTransport(new N8nTransport(context));
		return adapter;
	}

	/**
	 * Enable or disable debug logging
	 */
	static setDebugMode(enabled: boolean): void {
		this.debugEnabled = enabled;
	}

	/**
	 * Log debug message (only if debug mode enabled)
	 */
	static debug(message: string, context?: ILogContext): void {
		if (this.debugEnabled) {
			this.transport.log(LogLevel.DEBUG, message, context);
		}
	}

	/**
	 * Log info message
	 */
	static info(message: string, context?: ILogContext): void {
		this.transport.log(LogLevel.INFO, message, context);
	}

	/**
	 * Log warning message
	 */
	static warn(message: string, context?: ILogContext): void {
		this.transport.log(LogLevel.WARN, message, context);
	}

	/**
	 * Log error message
	 */
	static error(message: string, error?: Error, context?: ILogContext): void {
		const errorContext = {
			...context,
			errorMessage: error?.message,
			errorStack: error?.stack,
			errorName: error?.name,
		};
		this.transport.log(LogLevel.ERROR, message, errorContext);
	}

	/**
	 * Log connection pool statistics
	 */
	static logPoolStats(stats: any): void {
		if (this.debugEnabled) {
			this.debug('Connection Pool Stats', {
				module: 'ConnectionPool',
				...stats,
			});
		}
	}

	/**
	 * Log request details
	 */
	static logRequest(method: string, url: string, duration?: number, statusCode?: number): void {
		if (this.debugEnabled) {
			const sanitizedUrl = url.replace(/\/\/(.*?)@/, '//*****@');
			this.debug(`${method} ${sanitizedUrl}`, {
				module: 'ApiClient',
				method,
				duration: duration ? `${duration}ms` : undefined,
				statusCode,
			});
		}
	}

	/**
	 * Log security warning
	 */
	static logSecurityWarning(message: string): void {
		this.warn(`⚠️  SECURITY WARNING: ${message}`, {
			module: 'Security',
		});
	}

	/**
	 * Log performance metrics
	 */
	static logPerformance(operation: string, duration: number, metadata?: any): void {
		if (this.debugEnabled) {
			this.debug(`Performance: ${operation}`, {
				module: 'Performance',
				operation,
				duration: `${duration}ms`,
				...metadata,
			});
		}
	}
}

// Re-export Logger as alias for backward compatibility
export { LoggerAdapter as Logger };
