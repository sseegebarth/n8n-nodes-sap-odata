"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FmMetadataCache = void 0;
const constants_1 = require("../constants");
const CACHE_KEYS = {
    FM_METADATA: '_zatwFmMetadata',
    FM_SEARCH: '_zatwFmSearch',
    IDOC_METADATA: '_zatwIdocMetadata',
};
class FmMetadataCache {
    static async get(context, host, functionName) {
        try {
            const cache = this.getCache(context, CACHE_KEYS.FM_METADATA);
            if (!cache) {
                return null;
            }
            const key = this.buildKey(host, functionName);
            const entry = cache[key];
            if (!entry) {
                return null;
            }
            if (Date.now() > entry.expires) {
                delete cache[key];
                this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
                return null;
            }
            return entry.metadata;
        }
        catch {
            return null;
        }
    }
    static async set(context, host, functionName, metadata, ttl = constants_1.ZATW_FM_CACHE_TTL) {
        try {
            let cache = this.getCache(context, CACHE_KEYS.FM_METADATA);
            if (!cache) {
                cache = {};
            }
            const key = this.buildKey(host, functionName);
            cache[key] = {
                metadata,
                expires: Date.now() + ttl,
            };
            this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
        }
        catch {
        }
    }
    static async invalidate(context, host, functionName) {
        try {
            if (functionName) {
                const cache = this.getCache(context, CACHE_KEYS.FM_METADATA);
                if (cache) {
                    const key = this.buildKey(host, functionName);
                    delete cache[key];
                    this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
                }
            }
            else {
                const cache = this.getCache(context, CACHE_KEYS.FM_METADATA);
                if (cache) {
                    const hostPrefix = this.normalizeHost(host);
                    const keysToDelete = Object.keys(cache).filter((k) => k.startsWith(hostPrefix));
                    for (const key of keysToDelete) {
                        delete cache[key];
                    }
                    this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
                }
            }
        }
        catch {
        }
    }
    static async getSearchResults(context, host, pattern) {
        try {
            const cache = this.getCache(context, CACHE_KEYS.FM_SEARCH);
            if (!cache) {
                return null;
            }
            const key = this.buildKey(host, `search:${pattern}`);
            const entry = cache[key];
            if (!entry) {
                return null;
            }
            if (Date.now() > entry.expires) {
                delete cache[key];
                this.setCache(context, CACHE_KEYS.FM_SEARCH, cache);
                return null;
            }
            return entry.results;
        }
        catch {
            return null;
        }
    }
    static async setSearchResults(context, host, pattern, results, ttl = constants_1.ZATW_FM_SEARCH_CACHE_TTL) {
        try {
            let cache = this.getCache(context, CACHE_KEYS.FM_SEARCH);
            if (!cache) {
                cache = {};
            }
            const key = this.buildKey(host, `search:${pattern}`);
            cache[key] = {
                results,
                pattern,
                expires: Date.now() + ttl,
            };
            this.setCache(context, CACHE_KEYS.FM_SEARCH, cache);
        }
        catch {
        }
    }
    static async getIdocType(context, host, idocType) {
        try {
            const cache = this.getCache(context, CACHE_KEYS.IDOC_METADATA);
            if (!cache) {
                return null;
            }
            const key = this.buildKey(host, idocType);
            const entry = cache[key];
            if (!entry) {
                return null;
            }
            if (Date.now() > entry.expires) {
                delete cache[key];
                this.setCache(context, CACHE_KEYS.IDOC_METADATA, cache);
                return null;
            }
            return entry.metadata;
        }
        catch (error) {
            return null;
        }
    }
    static async setIdocType(context, host, idocType, metadata, ttl = constants_1.ZATW_IDOC_CACHE_TTL) {
        try {
            let cache = this.getCache(context, CACHE_KEYS.IDOC_METADATA);
            if (!cache) {
                cache = {};
            }
            const key = this.buildKey(host, idocType);
            cache[key] = {
                metadata,
                expires: Date.now() + ttl,
            };
            this.setCache(context, CACHE_KEYS.IDOC_METADATA, cache);
        }
        catch {
        }
    }
    static async cleanup(context) {
        const now = Date.now();
        const fmCache = this.getCache(context, CACHE_KEYS.FM_METADATA);
        if (fmCache) {
            let cleaned = 0;
            for (const key of Object.keys(fmCache)) {
                if (fmCache[key].expires < now) {
                    delete fmCache[key];
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                this.setCache(context, CACHE_KEYS.FM_METADATA, fmCache);
            }
        }
        const searchCache = this.getCache(context, CACHE_KEYS.FM_SEARCH);
        if (searchCache) {
            let cleaned = 0;
            for (const key of Object.keys(searchCache)) {
                if (searchCache[key].expires < now) {
                    delete searchCache[key];
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                this.setCache(context, CACHE_KEYS.FM_SEARCH, searchCache);
            }
        }
        const idocCache = this.getCache(context, CACHE_KEYS.IDOC_METADATA);
        if (idocCache) {
            let cleaned = 0;
            for (const key of Object.keys(idocCache)) {
                if (idocCache[key].expires < now) {
                    delete idocCache[key];
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                this.setCache(context, CACHE_KEYS.IDOC_METADATA, idocCache);
            }
        }
    }
    static buildKey(host, identifier) {
        return `${this.normalizeHost(host)}:${identifier}`;
    }
    static normalizeHost(host) {
        return host.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    }
    static getCache(context, key) {
        try {
            if ('getWorkflowStaticData' in context) {
                const staticData = context.getWorkflowStaticData('global');
                return staticData[key] || null;
            }
        }
        catch {
        }
        return null;
    }
    static setCache(context, key, value) {
        try {
            if ('getWorkflowStaticData' in context) {
                const staticData = context.getWorkflowStaticData('global');
                staticData[key] = value;
            }
        }
        catch {
        }
    }
}
exports.FmMetadataCache = FmMetadataCache;
