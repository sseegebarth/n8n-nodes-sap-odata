"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapMessageParser = exports.SapMessageSeverity = void 0;
const Logger_1 = require("./Logger");
var SapMessageSeverity;
(function (SapMessageSeverity) {
    SapMessageSeverity["Success"] = "success";
    SapMessageSeverity["Information"] = "info";
    SapMessageSeverity["Warning"] = "warning";
    SapMessageSeverity["Error"] = "error";
    SapMessageSeverity["Abort"] = "abort";
})(SapMessageSeverity || (exports.SapMessageSeverity = SapMessageSeverity = {}));
class SapMessageParser {
    static parseSapMessageHeader(headerValue) {
        var _a;
        try {
            const decodedValue = decodeURIComponent(headerValue);
            const messageData = JSON.parse(decodedValue);
            const messages = [];
            if (messageData.message) {
                messages.push({
                    code: messageData.code || '',
                    message: messageData.message,
                    severity: this.mapSeverity(messageData.severity),
                    target: messageData.target,
                });
            }
            if (messageData.details && Array.isArray(messageData.details)) {
                messageData.details.forEach((detail) => {
                    messages.push({
                        code: detail.code || '',
                        message: detail.message,
                        severity: this.mapSeverity(detail.severity),
                        target: detail.target,
                    });
                });
            }
            Logger_1.Logger.debug('Parsed SAP messages from header', {
                module: 'SapMessageParser',
                messageCount: messages.length,
                mainMessage: (_a = messages[0]) === null || _a === void 0 ? void 0 : _a.message,
            });
            return messages;
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to parse sap-message header', {
                module: 'SapMessageParser',
                error: error instanceof Error ? error.message : String(error),
                headerValue: headerValue.substring(0, 100),
            });
            return [];
        }
    }
    static parseSapErrorResponse(responseBody) {
        try {
            if (!responseBody || typeof responseBody !== 'object') {
                return [];
            }
            const messages = [];
            const body = responseBody;
            if (body.error && typeof body.error === 'object') {
                const error = body.error;
                const errorMessage = typeof error.message === 'object' && error.message !== null && 'value' in error.message
                    ? error.message.value
                    : error.message;
                messages.push({
                    code: String(error.code || ''),
                    message: String(errorMessage || ''),
                    severity: SapMessageSeverity.Error,
                    technicalDetails: error.innererror,
                });
                if (error.innererror && typeof error.innererror === 'object') {
                    const innerError = error.innererror;
                    if (innerError.errordetails && Array.isArray(innerError.errordetails)) {
                        innerError.errordetails.forEach((detail) => {
                            if (detail && typeof detail === 'object') {
                                const detailObj = detail;
                                messages.push({
                                    code: String(detailObj.code || ''),
                                    message: String(detailObj.message || ''),
                                    severity: this.mapSeverity(String(detailObj.severity || 'error')),
                                    target: String(detailObj.target || ''),
                                });
                            }
                        });
                    }
                }
            }
            if (body.error && typeof body.error === 'object') {
                const error = body.error;
                if (error.details && Array.isArray(error.details)) {
                    error.details.forEach((detail) => {
                        if (detail && typeof detail === 'object') {
                            const detailObj = detail;
                            messages.push({
                                code: String(detailObj.code || ''),
                                message: String(detailObj.message || ''),
                                severity: this.mapSeverity(String(detailObj.severity || 'error')),
                                target: String(detailObj.target || ''),
                            });
                        }
                    });
                }
            }
            Logger_1.Logger.debug('Parsed SAP error response', {
                module: 'SapMessageParser',
                messageCount: messages.length,
            });
            return messages;
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to parse SAP error response', {
                module: 'SapMessageParser',
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    static mapSeverity(severity) {
        if (!severity) {
            return SapMessageSeverity.Information;
        }
        const severityLower = severity.toLowerCase();
        switch (severityLower) {
            case 'success':
            case 's':
                return SapMessageSeverity.Success;
            case 'info':
            case 'information':
            case 'i':
                return SapMessageSeverity.Information;
            case 'warning':
            case 'w':
                return SapMessageSeverity.Warning;
            case 'error':
            case 'e':
                return SapMessageSeverity.Error;
            case 'abort':
            case 'a':
            case 'x':
                return SapMessageSeverity.Abort;
            default:
                return SapMessageSeverity.Information;
        }
    }
    static extractMessageClass(code) {
        if (!code) {
            return '';
        }
        const match = code.match(/^(\/[^/]+\/[^/]+)/);
        return match ? match[1] : code;
    }
    static isBusinessError(message) {
        const businessErrorPatterns = [
            '/IWBEP/CX_MGW_BUSI_EXCEPTION',
            '/IWBEP/CM_MGW_APP',
            '/IWBEP/CM_MGW_BUSI',
        ];
        const messageClass = this.extractMessageClass(message.code);
        return businessErrorPatterns.some((pattern) => messageClass.includes(pattern));
    }
    static isTechnicalError(message) {
        const technicalErrorPatterns = [
            '/IWBEP/CX_MGW_TECH_EXCEPTION',
            '/IWBEP/CM_MGW_RT',
            '/IWFND/',
        ];
        const messageClass = this.extractMessageClass(message.code);
        return technicalErrorPatterns.some((pattern) => messageClass.includes(pattern));
    }
    static formatMessages(messages) {
        if (messages.length === 0) {
            return '';
        }
        const formattedMessages = messages.map((msg, index) => {
            const prefix = messages.length > 1 ? `[${index + 1}] ` : '';
            const severityIcon = this.getSeverityIcon(msg.severity);
            const codeText = msg.code ? ` (${msg.code})` : '';
            const targetText = msg.target ? ` - Target: ${msg.target}` : '';
            return `${prefix}${severityIcon} ${msg.message}${codeText}${targetText}`;
        });
        return formattedMessages.join('\n');
    }
    static getSeverityIcon(severity) {
        switch (severity) {
            case SapMessageSeverity.Success:
                return '✓';
            case SapMessageSeverity.Information:
                return 'ℹ';
            case SapMessageSeverity.Warning:
                return '⚠';
            case SapMessageSeverity.Error:
                return '✗';
            case SapMessageSeverity.Abort:
                return '⊗';
            default:
                return '•';
        }
    }
    static extractAllMessages(headers, body) {
        const messages = [];
        if (headers && headers['sap-message']) {
            const headerMessages = this.parseSapMessageHeader(String(headers['sap-message']));
            messages.push(...headerMessages);
        }
        if (body) {
            const bodyMessages = this.parseSapErrorResponse(body);
            messages.push(...bodyMessages);
        }
        return messages;
    }
    static getErrorDescription(message) {
        const code = message.code;
        const errorDescriptions = {
            '/IWBEP/CM_MGW_RT/021': 'The entity key is invalid or malformed',
            '/IWBEP/CM_MGW_RT/022': 'The requested entity was not found',
            '/IWBEP/CM_MGW_RT/023': 'The entity set does not exist in the service',
            '/IWBEP/CM_MGW_RT/024': 'The property does not exist in the entity type',
            '/IWBEP/CM_MGW_RT/025': 'Invalid filter expression syntax',
            '/IWBEP/CM_MGW_RT/026': 'Invalid $orderby parameter',
            '/IWBEP/CM_MGW_RT/027': 'Invalid $expand parameter',
            '/IWBEP/CM_MGW_RT/028': 'Invalid $select parameter',
            '/IWBEP/CM_MGW_RT/029': 'Invalid function import parameters',
            '/IWBEP/CM_MGW_RT/030': 'Batch request processing failed',
            '/IWBEP/CM_MGW_RT/031': 'CSRF token validation failed',
            '/IWBEP/CM_MGW_RT/042': 'The content type is not supported',
            '/IWBEP/CM_MGW_RT/043': 'The HTTP method is not allowed for this resource',
            '/IWFND/CM_MGW/005': 'Authorization failed - check user permissions',
            '/IWFND/CM_MGW/006': 'Service not found or not activated',
            '/IWFND/CM_MGW/007': 'Backend system connection failed',
        };
        if (errorDescriptions[code]) {
            return errorDescriptions[code];
        }
        for (const [pattern, description] of Object.entries(errorDescriptions)) {
            if (code.startsWith(pattern)) {
                return description;
            }
        }
        if (this.isBusinessError(message)) {
            return 'Business logic error - check the operation and data';
        }
        if (this.isTechnicalError(message)) {
            return 'Technical error in SAP Gateway - check system configuration';
        }
        return 'SAP Gateway error - see message for details';
    }
}
exports.SapMessageParser = SapMessageParser;
