"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapGatewayCompat = void 0;
const Logger_1 = require("./Logger");
const SapGatewaySession_1 = require("./SapGatewaySession");
const SapMessageParser_1 = require("./SapMessageParser");
class SapGatewayCompat {
    static async enhanceRequestOptions(context, requestOptions, host, servicePath, gatewayOptions = {}) {
        const { enableSession = true, enableContextId = true, enableMessageParsing = true, preferRepresentation = 'representation', batchMode = false, } = gatewayOptions;
        const enhancedOptions = { ...requestOptions };
        const headers = { ...(requestOptions.headers || {}) };
        if (enableSession) {
            const cookieHeader = await SapGatewaySession_1.SapGatewaySessionManager.getCookieHeader(context, host, servicePath);
            if (cookieHeader) {
                headers['Cookie'] = cookieHeader;
                Logger_1.Logger.debug('Added session cookies to request', {
                    module: 'SapGatewayCompat',
                    cookieCount: cookieHeader.split(';').length,
                });
            }
        }
        if (enableContextId) {
            const contextId = await SapGatewaySession_1.SapGatewaySessionManager.getContextId(context, host, servicePath);
            if (contextId) {
                headers['SAP-ContextId'] = contextId;
                Logger_1.Logger.debug('Added SAP-ContextId to request', {
                    module: 'SapGatewayCompat',
                    contextId,
                });
            }
        }
        if (!batchMode) {
            if (preferRepresentation === 'minimal') {
                headers['Prefer'] = 'return=minimal';
            }
            else {
                headers['Prefer'] = 'return=representation';
            }
        }
        if (enableMessageParsing) {
            headers['sap-message-scope'] = 'BusinessObject';
        }
        if (!headers['DataServiceVersion']) {
            headers['DataServiceVersion'] = '2.0';
        }
        if (!headers['MaxDataServiceVersion']) {
            headers['MaxDataServiceVersion'] = '2.0';
        }
        enhancedOptions.headers = headers;
        enhancedOptions.returnFullResponse = true;
        Logger_1.Logger.debug('Request options enhanced with SAP Gateway compatibility', {
            module: 'SapGatewayCompat',
            enableSession,
            enableContextId,
            enableMessageParsing,
            preferRepresentation,
        });
        return enhancedOptions;
    }
    static async processResponse(context, response, host, servicePath, gatewayOptions = {}) {
        const { enableSession = true, enableContextId = true, enableMessageParsing = true } = gatewayOptions;
        let body;
        let statusCode = 200;
        let headers = {};
        if (response && typeof response === 'object' && 'body' in response) {
            const fullResponse = response;
            body = fullResponse.body;
            statusCode = fullResponse.statusCode;
            headers = fullResponse.headers || {};
        }
        else {
            body = response;
        }
        const result = {
            body,
            statusCode,
            headers,
        };
        if (enableSession && headers['set-cookie']) {
            await SapGatewaySession_1.SapGatewaySessionManager.updateCookies(context, host, servicePath, headers['set-cookie']);
        }
        if (enableContextId && headers['sap-contextid']) {
            const contextId = String(headers['sap-contextid']);
            result.contextId = contextId;
            await SapGatewaySession_1.SapGatewaySessionManager.updateContextId(context, host, servicePath, contextId);
        }
        if (headers['x-csrf-token']) {
            const csrfToken = String(headers['x-csrf-token']);
            if (csrfToken && csrfToken !== 'Required' && csrfToken !== 'Fetch') {
                result.csrfToken = csrfToken;
                await SapGatewaySession_1.SapGatewaySessionManager.updateCsrfToken(context, host, servicePath, csrfToken);
                Logger_1.Logger.debug('CSRF token extracted from response', {
                    module: 'SapGatewayCompat',
                });
            }
        }
        if (enableMessageParsing) {
            const messages = SapMessageParser_1.SapMessageParser.extractAllMessages(headers, body);
            if (messages.length > 0) {
                result.messages = messages;
                Logger_1.Logger.debug('SAP messages extracted from response', {
                    module: 'SapGatewayCompat',
                    messageCount: messages.length,
                    errorCount: messages.filter((m) => m.severity === 'error').length,
                    warningCount: messages.filter((m) => m.severity === 'warning').length,
                });
            }
        }
        return result;
    }
    static async fetchCsrfToken(context, host, servicePath, requestBuilder) {
        const cachedToken = await SapGatewaySession_1.SapGatewaySessionManager.getCsrfToken(context, host, servicePath);
        if (cachedToken) {
            Logger_1.Logger.debug('Using cached CSRF token from session', {
                module: 'SapGatewayCompat',
            });
            return cachedToken;
        }
        Logger_1.Logger.debug('Fetching new CSRF token', {
            module: 'SapGatewayCompat',
        });
        try {
            const requestOptions = requestBuilder(host, servicePath);
            const enhancedOptions = await this.enhanceRequestOptions(context, requestOptions, host, servicePath, {
                enableSession: true,
                enableContextId: true,
                enableMessageParsing: false,
            });
            const response = await context.helpers.httpRequestWithAuthentication.call(context, 'sapOdataApi', enhancedOptions);
            const processedResponse = await this.processResponse(context, response, host, servicePath, {
                enableSession: true,
                enableContextId: true,
                enableMessageParsing: false,
            });
            if (processedResponse.csrfToken) {
                return processedResponse.csrfToken;
            }
            if (processedResponse.headers['x-csrf-token']) {
                const token = String(processedResponse.headers['x-csrf-token']);
                if (token && token !== 'Required' && token !== 'Fetch') {
                    await SapGatewaySession_1.SapGatewaySessionManager.updateCsrfToken(context, host, servicePath, token);
                    return token;
                }
            }
            Logger_1.Logger.warn('CSRF token not found in response', {
                module: 'SapGatewayCompat',
            });
            return '';
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to fetch CSRF token', {
                module: 'SapGatewayCompat',
                error: error instanceof Error ? error.message : String(error),
            });
            return '';
        }
    }
    static clearSession(context, host, servicePath) {
        SapGatewaySession_1.SapGatewaySessionManager.clearSession(context, host, servicePath);
        Logger_1.Logger.info('SAP Gateway session cleared', {
            module: 'SapGatewayCompat',
            host,
            servicePath,
        });
    }
    static async getSessionStatus(context, host, servicePath) {
        const session = await SapGatewaySession_1.SapGatewaySessionManager.getSession(context, host, servicePath);
        if (!session) {
            return {
                hasSession: false,
                hasCsrfToken: false,
                hasContextId: false,
                cookieCount: 0,
            };
        }
        return {
            hasSession: true,
            hasCsrfToken: !!session.csrfToken,
            hasContextId: !!session.sapContextId,
            cookieCount: session.cookies.length,
            expiresAt: new Date(session.expiresAt).toISOString(),
        };
    }
    static formatErrorMessage(messages, fallbackMessage) {
        if (!messages || messages.length === 0) {
            return fallbackMessage;
        }
        const errorMessages = messages.filter((m) => m.severity === 'error' || m.severity === 'abort');
        if (errorMessages.length > 0) {
            const formatted = SapMessageParser_1.SapMessageParser.formatMessages(errorMessages);
            const primaryMessage = errorMessages[0];
            const description = SapMessageParser_1.SapMessageParser.getErrorDescription(primaryMessage);
            return `${formatted}\n\nDescription: ${description}`;
        }
        return SapMessageParser_1.SapMessageParser.formatMessages(messages);
    }
}
exports.SapGatewayCompat = SapGatewayCompat;
