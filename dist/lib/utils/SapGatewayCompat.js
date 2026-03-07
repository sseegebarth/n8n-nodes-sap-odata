"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapGatewayCompat = void 0;
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
            }
        }
        if (enableContextId) {
            const contextId = await SapGatewaySession_1.SapGatewaySessionManager.getContextId(context, host, servicePath);
            if (contextId) {
                headers['SAP-ContextId'] = contextId;
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
        return enhancedOptions;
    }
    static getHeader(headers, name) {
        const lowerName = name.toLowerCase();
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === lowerName) {
                return value;
            }
        }
        return undefined;
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
        const setCookie = this.getHeader(headers, 'set-cookie');
        if (enableSession && setCookie) {
            await SapGatewaySession_1.SapGatewaySessionManager.updateCookies(context, host, servicePath, setCookie);
        }
        const contextIdHeader = this.getHeader(headers, 'sap-contextid');
        if (enableContextId && contextIdHeader) {
            const contextId = String(contextIdHeader);
            result.contextId = contextId;
            await SapGatewaySession_1.SapGatewaySessionManager.updateContextId(context, host, servicePath, contextId);
        }
        const csrfTokenHeader = this.getHeader(headers, 'x-csrf-token');
        if (csrfTokenHeader) {
            const csrfToken = String(csrfTokenHeader);
            if (csrfToken && csrfToken !== 'Required' && csrfToken !== 'Fetch') {
                result.csrfToken = csrfToken;
                await SapGatewaySession_1.SapGatewaySessionManager.updateCsrfToken(context, host, servicePath, csrfToken);
            }
        }
        if (enableMessageParsing) {
            const messages = SapMessageParser_1.SapMessageParser.extractAllMessages(headers, body);
            if (messages.length > 0) {
                result.messages = messages;
            }
        }
        return result;
    }
    static async fetchCsrfToken(context, host, servicePath, requestBuilder) {
        const cachedToken = await SapGatewaySession_1.SapGatewaySessionManager.getCsrfToken(context, host, servicePath);
        if (cachedToken) {
            return cachedToken;
        }
        try {
            const requestOptions = requestBuilder(host, servicePath);
            const enhancedOptions = await this.enhanceRequestOptions(context, requestOptions, host, servicePath, {
                enableSession: true,
                enableContextId: true,
                enableMessageParsing: false,
            });
            const credentials = await context.getCredentials('sapOdataApi');
            const auth = (credentials === null || credentials === void 0 ? void 0 : credentials.authentication) === 'basicAuth' && (credentials === null || credentials === void 0 ? void 0 : credentials.username) && (credentials === null || credentials === void 0 ? void 0 : credentials.password)
                ? { username: credentials.username, password: credentials.password }
                : undefined;
            const response = await context.helpers.request({
                ...enhancedOptions,
                auth,
                resolveWithFullResponse: true,
            });
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
            return '';
        }
        catch {
            return '';
        }
    }
    static async clearSession(context, host, servicePath) {
        await SapGatewaySession_1.SapGatewaySessionManager.clearSession(context, host, servicePath);
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
