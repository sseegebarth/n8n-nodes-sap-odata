"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapGatewaySessionManager = void 0;
const crypto_1 = require("crypto");
const constants_1 = require("../constants");
const Logger_1 = require("./Logger");
class SapGatewaySessionManager {
    static async getSessionKey(context, host, servicePath) {
        let credentialHash = '';
        try {
            const credentials = await context.getCredentials('sapOdataApi');
            if (credentials) {
                const username = credentials.username || '';
                credentialHash = username
                    ? `-${(0, crypto_1.createHash)('sha256').update(username).digest('hex').substring(0, 16)}`
                    : '';
            }
        }
        catch {
        }
        const normalizedHost = host.toLowerCase().replace(/\/$/, '');
        const normalizedPath = servicePath.toLowerCase().replace(/^\/|\/$/g, '');
        return `sap_session_${normalizedHost}_${normalizedPath}${credentialHash}`;
    }
    static async getSession(context, host, servicePath) {
        try {
            if (!('getWorkflowStaticData' in context)) {
                return null;
            }
            const staticData = context.getWorkflowStaticData('global');
            const sessionKey = await this.getSessionKey(context, host, servicePath);
            const session = staticData[sessionKey];
            if (session && Date.now() < session.expiresAt) {
                Logger_1.Logger.debug('SAP Gateway session retrieved from cache', {
                    module: 'SapGatewaySessionManager',
                    hasToken: !!session.csrfToken,
                    hasCookies: session.cookies.length > 0,
                    hasContextId: !!session.sapContextId,
                });
                return session;
            }
            if (session) {
                Logger_1.Logger.debug('SAP Gateway session expired', {
                    module: 'SapGatewaySessionManager',
                    expiresAt: new Date(session.expiresAt).toISOString(),
                    now: new Date().toISOString(),
                });
                delete staticData[sessionKey];
            }
            return null;
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to retrieve SAP Gateway session', {
                module: 'SapGatewaySessionManager',
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    static async setSession(context, host, servicePath, session, config = {}) {
        try {
            if (!('getWorkflowStaticData' in context)) {
                return;
            }
            const staticData = context.getWorkflowStaticData('global');
            const sessionKey = await this.getSessionKey(context, host, servicePath);
            const existingSession = staticData[sessionKey];
            const sessionTimeout = config.sessionTimeout || this.DEFAULT_SESSION_TIMEOUT;
            const now = Date.now();
            const updatedSession = {
                csrfToken: session.csrfToken || (existingSession === null || existingSession === void 0 ? void 0 : existingSession.csrfToken) || '',
                cookies: session.cookies || (existingSession === null || existingSession === void 0 ? void 0 : existingSession.cookies) || [],
                sapContextId: session.sapContextId || (existingSession === null || existingSession === void 0 ? void 0 : existingSession.sapContextId),
                sessionId: session.sessionId || (existingSession === null || existingSession === void 0 ? void 0 : existingSession.sessionId),
                lastActivity: now,
                expiresAt: now + sessionTimeout,
            };
            staticData[sessionKey] = updatedSession;
            Logger_1.Logger.debug('SAP Gateway session updated', {
                module: 'SapGatewaySessionManager',
                hasToken: !!updatedSession.csrfToken,
                cookieCount: updatedSession.cookies.length,
                hasContextId: !!updatedSession.sapContextId,
                expiresAt: new Date(updatedSession.expiresAt).toISOString(),
            });
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to set SAP Gateway session', {
                module: 'SapGatewaySessionManager',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    static async getCsrfToken(context, host, servicePath) {
        const session = await this.getSession(context, host, servicePath);
        if (!session) {
            return null;
        }
        const csrfTimeout = this.DEFAULT_CSRF_TIMEOUT;
        const tokenAge = Date.now() - session.lastActivity;
        if (tokenAge > csrfTimeout) {
            Logger_1.Logger.debug('CSRF token expired based on activity', {
                module: 'SapGatewaySessionManager',
                tokenAge: `${Math.floor(tokenAge / 1000)}s`,
                maxAge: `${Math.floor(csrfTimeout / 1000)}s`,
            });
            return null;
        }
        return session.csrfToken || null;
    }
    static async updateCsrfToken(context, host, servicePath, token) {
        await this.setSession(context, host, servicePath, { csrfToken: token });
    }
    static async getCookieHeader(context, host, servicePath) {
        const session = await this.getSession(context, host, servicePath);
        if (!session || session.cookies.length === 0) {
            return null;
        }
        return session.cookies.join('; ');
    }
    static async updateCookies(context, host, servicePath, setCookieHeaders) {
        const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        const parsedCookies = cookies.map((cookie) => {
            const match = cookie.match(/^([^;]+)/);
            return match ? match[1].trim() : null;
        }).filter((c) => c !== null);
        if (parsedCookies.length > 0) {
            const existingSession = await this.getSession(context, host, servicePath);
            const existingCookies = (existingSession === null || existingSession === void 0 ? void 0 : existingSession.cookies) || [];
            const cookieMap = new Map();
            existingCookies.forEach((cookie) => {
                const [name] = cookie.split('=');
                if (name) {
                    cookieMap.set(name, cookie);
                }
            });
            parsedCookies.forEach((cookie) => {
                const [name] = cookie.split('=');
                if (name) {
                    cookieMap.set(name, cookie);
                }
            });
            await this.setSession(context, host, servicePath, {
                cookies: Array.from(cookieMap.values()),
            });
            Logger_1.Logger.debug('Session cookies updated', {
                module: 'SapGatewaySessionManager',
                cookieCount: cookieMap.size,
                newCookies: parsedCookies.length,
            });
        }
    }
    static async updateContextId(context, host, servicePath, contextId) {
        await this.setSession(context, host, servicePath, { sapContextId: contextId });
        Logger_1.Logger.debug('SAP-ContextId updated', {
            module: 'SapGatewaySessionManager',
            contextId,
        });
    }
    static async getContextId(context, host, servicePath) {
        const session = await this.getSession(context, host, servicePath);
        return (session === null || session === void 0 ? void 0 : session.sapContextId) || null;
    }
    static async clearSession(context, host, servicePath) {
        try {
            if (!('getWorkflowStaticData' in context)) {
                return;
            }
            const staticData = context.getWorkflowStaticData('global');
            const sessionKey = await this.getSessionKey(context, host, servicePath);
            delete staticData[sessionKey];
            Logger_1.Logger.debug('SAP Gateway session cleared', {
                module: 'SapGatewaySessionManager',
            });
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to clear SAP Gateway session', {
                module: 'SapGatewaySessionManager',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    static cleanupExpiredSessions(context) {
        try {
            if (!('getWorkflowStaticData' in context)) {
                return;
            }
            const staticData = context.getWorkflowStaticData('global');
            const now = Date.now();
            let cleanedCount = 0;
            Object.keys(staticData).forEach((key) => {
                if (key.startsWith('sap_session_')) {
                    const session = staticData[key];
                    if (session && session.expiresAt < now) {
                        delete staticData[key];
                        cleanedCount++;
                    }
                }
            });
            if (cleanedCount > 0) {
                Logger_1.Logger.debug('Expired SAP Gateway sessions cleaned up', {
                    module: 'SapGatewaySessionManager',
                    cleanedCount,
                });
            }
        }
        catch (error) {
            Logger_1.Logger.warn('Failed to cleanup expired sessions', {
                module: 'SapGatewaySessionManager',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
exports.SapGatewaySessionManager = SapGatewaySessionManager;
SapGatewaySessionManager.DEFAULT_SESSION_TIMEOUT = constants_1.SAP_GATEWAY_SESSION_TIMEOUT;
SapGatewaySessionManager.DEFAULT_CSRF_TIMEOUT = constants_1.SAP_GATEWAY_CSRF_TIMEOUT;
