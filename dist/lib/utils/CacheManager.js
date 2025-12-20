"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const crypto_1 = require("crypto");
const constants_1 = require("../constants");
class CacheManager {
    static getCacheKey(host, servicePath, credentialId) {
        const normalizedHost = host.toLowerCase().replace(/\/$/, '');
        const normalizedPath = servicePath.replace(/^\//, '').replace(/\/$/, '');
        const keyComponents = [
            normalizedHost,
            normalizedPath,
            credentialId || 'anonymous'
        ];
        const keyString = keyComponents.join('::');
        const hash = (0, crypto_1.createHash)('sha256')
            .update(keyString)
            .digest('hex')
            .substring(0, 16);
        return `cache_${hash}`;
    }
    static async getCredentialId(context, itemIndex) {
        try {
            const credentials = itemIndex !== undefined && 'getCredentials' in context
                ? await context.getCredentials('sapOdataApi', itemIndex)
                : await context.getCredentials('sapOdataApi');
            const username = credentials.username || '';
            const host = credentials.host || '';
            const client = credentials.sapClient || '';
            const lang = credentials.sapLanguage || 'EN';
            if (!username || !host)
                return undefined;
            const credentialId = `${username}@${host}:${client}:${lang}`;
            return credentialId;
        }
        catch {
            return undefined;
        }
    }
    static maybeRunCleanup(context) {
        this.accessCounter++;
        if (this.accessCounter >= this.CLEANUP_INTERVAL && !this.cleanupInProgress) {
            this.accessCounter = 0;
            this.cleanupInProgress = true;
            try {
                this.cleanupExpiredCache(context);
            }
            finally {
                this.cleanupInProgress = false;
            }
        }
    }
    static async getCsrfToken(context, host, servicePath, itemIndex) {
        try {
            this.maybeRunCleanup(context);
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const cacheKey = `csrf_${this.getCacheKey(host, servicePath, credentialId)}`;
            const cached = staticData[cacheKey];
            if (cached) {
                if (cached.expires > Date.now()) {
                    return cached.token;
                }
                delete staticData[cacheKey];
            }
            return null;
        }
        catch {
            return null;
        }
    }
    static async setCsrfToken(context, host, servicePath, token, itemIndex) {
        try {
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const cacheKey = `csrf_${this.getCacheKey(host, servicePath, credentialId)}`;
            staticData[cacheKey] = {
                token,
                expires: Date.now() + constants_1.CSRF_TOKEN_CACHE_TTL,
            };
        }
        catch {
        }
    }
    static async getMetadata(context, host, servicePath, itemIndex) {
        try {
            this.maybeRunCleanup(context);
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const cacheKey = `metadata_${this.getCacheKey(host, servicePath, credentialId)}`;
            const cached = staticData[cacheKey];
            if (cached) {
                if (cached.expires > Date.now()) {
                    return cached;
                }
                delete staticData[cacheKey];
            }
            return null;
        }
        catch {
            return null;
        }
    }
    static async setMetadata(context, host, servicePath, entitySets, functionImports, itemIndex) {
        try {
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const cacheKey = `metadata_${this.getCacheKey(host, servicePath, credentialId)}`;
            staticData[cacheKey] = {
                entitySets,
                functionImports,
                expires: Date.now() + constants_1.METADATA_CACHE_TTL,
            };
        }
        catch {
        }
    }
    static async clearCache(context, host, servicePath, itemIndex) {
        try {
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const baseKey = this.getCacheKey(host, servicePath, credentialId);
            delete staticData[`csrf_${baseKey}`];
            delete staticData[`metadata_${baseKey}`];
        }
        catch {
        }
    }
    static async invalidateCacheOn404(context, host, servicePath, itemIndex) {
        try {
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const baseKey = this.getCacheKey(host, servicePath, credentialId);
            delete staticData[`metadata_${baseKey}`];
        }
        catch {
        }
    }
    static async getServiceCatalog(context, host, itemIndex) {
        try {
            this.maybeRunCleanup(context);
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const hostKey = host.replace(/[^a-zA-Z0-9]/g, '_');
            const cacheKey = credentialId ? `services_${credentialId}_${hostKey}` : `services_${hostKey}`;
            const cached = staticData[cacheKey];
            if (cached) {
                if (cached.expires > Date.now()) {
                    return cached.services;
                }
                delete staticData[cacheKey];
            }
            return null;
        }
        catch {
            return null;
        }
    }
    static async setServiceCatalog(context, host, services, itemIndex) {
        try {
            const credentialId = await this.getCredentialId(context, itemIndex);
            const staticData = context.getWorkflowStaticData('node');
            const hostKey = host.replace(/[^a-zA-Z0-9]/g, '_');
            const cacheKey = credentialId ? `services_${credentialId}_${hostKey}` : `services_${hostKey}`;
            staticData[cacheKey] = {
                services,
                expires: Date.now() + constants_1.METADATA_CACHE_TTL,
            };
        }
        catch {
        }
    }
    static clearAllCache(context) {
        try {
            const staticData = context.getWorkflowStaticData('node');
            const keys = Object.keys(staticData);
            keys.forEach((key) => {
                if (key.startsWith('csrf_') || key.startsWith('metadata_') || key.startsWith('services_')) {
                    delete staticData[key];
                }
            });
        }
        catch {
        }
    }
    static cleanupExpiredCache(context) {
        try {
            const staticData = context.getWorkflowStaticData('node');
            const now = Date.now();
            Object.keys(staticData).forEach((key) => {
                if (key.startsWith('csrf_') || key.startsWith('metadata_') || key.startsWith('services_')) {
                    const entry = staticData[key];
                    if (entry && entry.expires < now) {
                        delete staticData[key];
                    }
                }
            });
        }
        catch {
        }
    }
}
exports.CacheManager = CacheManager;
CacheManager.accessCounter = 0;
CacheManager.CLEANUP_INTERVAL = constants_1.CACHE_CLEANUP_INTERVAL;
CacheManager.cleanupInProgress = false;
