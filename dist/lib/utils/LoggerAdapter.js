"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LoggerAdapter = exports.N8nTransport = exports.ConsoleTransport = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class ConsoleTransport {
    log(level, message, context) {
        const timestamp = new Date().toISOString();
        const prefix = `${ConsoleTransport.PREFIX} [${level.toUpperCase()}] [${timestamp}]`;
        if (context && Object.keys(context).length > 0) {
            console.log(`${prefix} ${message}`, context);
        }
        else {
            console.log(`${prefix} ${message}`);
        }
    }
}
exports.ConsoleTransport = ConsoleTransport;
ConsoleTransport.PREFIX = '[SAP OData]';
class N8nTransport {
    constructor(context) {
        this.context = context;
    }
    log(level, message, context) {
        const logger = this.context.logger;
        const enrichedContext = {
            ...context,
            node: this.context.getNode().name,
            nodeType: this.context.getNode().type,
        };
        if ('getExecutionId' in this.context) {
            try {
                enrichedContext.executionId = this.context.getExecutionId();
            }
            catch (error) {
            }
        }
        if ('getWorkflow' in this.context) {
            try {
                enrichedContext.workflowId = this.context.getWorkflow().id;
            }
            catch (error) {
            }
        }
        const formattedMessage = context
            ? `${message} ${JSON.stringify(enrichedContext)}`
            : message;
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
exports.N8nTransport = N8nTransport;
class LoggerAdapter {
    static setTransport(transport) {
        this.transport = transport;
    }
    static fromContext(context) {
        const adapter = new LoggerAdapter();
        LoggerAdapter.setTransport(new N8nTransport(context));
        return adapter;
    }
    static setDebugMode(enabled) {
        this.debugEnabled = enabled;
    }
    static debug(message, context) {
        if (this.debugEnabled) {
            this.transport.log(LogLevel.DEBUG, message, context);
        }
    }
    static info(message, context) {
        this.transport.log(LogLevel.INFO, message, context);
    }
    static warn(message, context) {
        this.transport.log(LogLevel.WARN, message, context);
    }
    static error(message, error, context) {
        const errorContext = {
            ...context,
            errorMessage: error === null || error === void 0 ? void 0 : error.message,
            errorStack: error === null || error === void 0 ? void 0 : error.stack,
            errorName: error === null || error === void 0 ? void 0 : error.name,
        };
        this.transport.log(LogLevel.ERROR, message, errorContext);
    }
    static logPoolStats(stats) {
        if (this.debugEnabled) {
            this.debug('Connection Pool Stats', {
                module: 'ConnectionPool',
                ...stats,
            });
        }
    }
    static logRequest(method, url, duration, statusCode) {
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
    static logSecurityWarning(message) {
        this.warn(`⚠️  SECURITY WARNING: ${message}`, {
            module: 'Security',
        });
    }
    static logPerformance(operation, duration, metadata) {
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
exports.LoggerAdapter = LoggerAdapter;
exports.Logger = LoggerAdapter;
LoggerAdapter.debugEnabled = false;
LoggerAdapter.transport = new ConsoleTransport();
