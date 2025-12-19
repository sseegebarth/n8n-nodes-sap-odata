/**
 * Logger - Backward Compatibility Wrapper
 *
 * Re-exports the new LoggerAdapter for backward compatibility.
 * All new code should import from LoggerAdapter.ts directly.
 *
 * @deprecated Use LoggerAdapter instead
 */

export {
	LoggerAdapter as Logger,
	LogLevel,
	ILogContext,
	ILoggerTransport,
	ConsoleTransport,
	N8nTransport,
} from './LoggerAdapter';
