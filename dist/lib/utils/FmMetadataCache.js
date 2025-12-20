"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FmMetadataCache = void 0;
const constants_1 = require("../constants");
const Logger_1 = require("./Logger");
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
                Logger_1.Logger.debug('FM metadata cache expired', {
                    module: 'FmMetadataCache',
                    functionName,
                });
                delete cache[key];
                this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
                return null;
            }
            Logger_1.Logger.debug('FM metadata cache hit', {
                module: 'FmMetadataCache',
                functionName,
            });
            return entry.metadata;
        }
        catch (error) {
            Logger_1.Logger.warn('Error reading FM metadata cache', {
                module: 'FmMetadataCache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            Logger_1.Logger.debug('FM metadata cached', {
                module: 'FmMetadataCache',
                functionName,
                ttl: `${ttl}ms`,
            });
        }
        catch (error) {
            Logger_1.Logger.warn('Error writing FM metadata cache', {
                module: 'FmMetadataCache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            Logger_1.Logger.debug('FM metadata cache invalidated', {
                module: 'FmMetadataCache',
                host,
                functionName: functionName || 'all',
            });
        }
        catch (error) {
            Logger_1.Logger.warn('Error invalidating FM metadata cache', {
                module: 'FmMetadataCache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            Logger_1.Logger.debug('FM search cache hit', {
                module: 'FmMetadataCache',
                pattern,
            });
            return entry.results;
        }
        catch (error) {
            Logger_1.Logger.warn('Error reading FM search cache', {
                module: 'FmMetadataCache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
            Logger_1.Logger.debug('FM search results cached', {
                module: 'FmMetadataCache',
                pattern,
                resultCount: results.length,
            });
        }
        catch (error) {
            Logger_1.Logger.warn('Error writing FM search cache', {
                module: 'FmMetadataCache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
        catch (error) {
            Logger_1.Logger.warn('Error writing IDoc metadata cache', {
                module: 'FmMetadataCache',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
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
                Logger_1.Logger.debug('FM metadata cache cleaned', {
                    module: 'FmMetadataCache',
                    entriesRemoved: cleaned,
                });
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
