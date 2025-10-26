/**
 * Logger wrapper for structured logging
 * Uses console in development, can be extended for production logging
 */

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
	[key: string]: any;
}

export class Logger {
	private static readonly PREFIX = '[SAP OData]';
	private static debugEnabled = false;

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
			this.log(LogLevel.DEBUG, message, context);
		}
	}

	/**
	 * Log info message
	 */
	static info(message: string, context?: ILogContext): void {
		this.log(LogLevel.INFO, message, context);
	}

	/**
	 * Log warning message
	 */
	static warn(message: string, context?: ILogContext): void {
		this.log(LogLevel.WARN, message, context);
	}

	/**
	 * Log error message
	 */
	static error(message: string, error?: Error, context?: ILogContext): void {
		const errorContext = {
			...context,
			errorMessage: error?.message,
			errorStack: error?.stack,
		};
		this.log(LogLevel.ERROR, message, errorContext);
	}

	/**
	 * Core logging function
	 */
	private static log(level: LogLevel, message: string, context?: ILogContext): void {
		const timestamp = new Date().toISOString();
		const prefix = `${this.PREFIX} [${level.toUpperCase()}] [${timestamp}]`;

		if (context && Object.keys(context).length > 0) {
			console.log(`${prefix} ${message}`, context);
		} else {
			console.log(`${prefix} ${message}`);
		}
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
	static logRequest(method: string, url: string, duration?: number): void {
		if (this.debugEnabled) {
			const sanitizedUrl = url.replace(/\/\/(.*?)@/, '//*****@');
			this.debug(`${method} ${sanitizedUrl}`, {
				module: 'ApiClient',
				method,
				duration: duration ? `${duration}ms` : undefined,
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
}
