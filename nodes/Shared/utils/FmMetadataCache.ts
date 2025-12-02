/**
 * FM Metadata Cache
 *
 * Caches function module metadata to avoid repeated API calls.
 * Uses n8n's workflow static data for persistence within workflow execution.
 */

import {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import {
	ZATW_FM_CACHE_TTL,
	ZATW_FM_SEARCH_CACHE_TTL,
	ZATW_IDOC_CACHE_TTL,
} from '../constants';
import {
	IZatwFmMetadata,
	IZatwFmSearchResult,
	IZatwFmCacheEntry,
	IZatwFmSearchCacheEntry,
	IZatwIdocTypeMetadata,
} from '../types/zatw';
import { Logger } from './Logger';

type CacheContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

/**
 * Cache keys for different data types
 */
const CACHE_KEYS = {
	FM_METADATA: '_zatwFmMetadata',
	FM_SEARCH: '_zatwFmSearch',
	IDOC_METADATA: '_zatwIdocMetadata',
} as const;

/**
 * FM Metadata Cache Manager
 */
export class FmMetadataCache {
	// ============================================
	// Function Module Metadata
	// ============================================

	/**
	 * Get cached FM metadata
	 */
	static async get(
		context: CacheContext,
		host: string,
		functionName: string,
	): Promise<IZatwFmMetadata | null> {
		try {
			const cache = this.getCache<Record<string, IZatwFmCacheEntry>>(
				context,
				CACHE_KEYS.FM_METADATA,
			);

			if (!cache) {
				return null;
			}

			const key = this.buildKey(host, functionName);
			const entry = cache[key];

			if (!entry) {
				return null;
			}

			// Check if expired
			if (Date.now() > entry.expires) {
				Logger.debug('FM metadata cache expired', {
					module: 'FmMetadataCache',
					functionName,
				});
				delete cache[key];
				this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
				return null;
			}

			Logger.debug('FM metadata cache hit', {
				module: 'FmMetadataCache',
				functionName,
			});

			return entry.metadata;
		} catch (error) {
			Logger.warn('Error reading FM metadata cache', {
				module: 'FmMetadataCache',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return null;
		}
	}

	/**
	 * Set FM metadata in cache
	 */
	static async set(
		context: CacheContext,
		host: string,
		functionName: string,
		metadata: IZatwFmMetadata,
		ttl: number = ZATW_FM_CACHE_TTL,
	): Promise<void> {
		try {
			let cache = this.getCache<Record<string, IZatwFmCacheEntry>>(
				context,
				CACHE_KEYS.FM_METADATA,
			);

			if (!cache) {
				cache = {};
			}

			const key = this.buildKey(host, functionName);
			cache[key] = {
				metadata,
				expires: Date.now() + ttl,
			};

			this.setCache(context, CACHE_KEYS.FM_METADATA, cache);

			Logger.debug('FM metadata cached', {
				module: 'FmMetadataCache',
				functionName,
				ttl: `${ttl}ms`,
			});
		} catch (error) {
			Logger.warn('Error writing FM metadata cache', {
				module: 'FmMetadataCache',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	/**
	 * Invalidate FM metadata cache
	 */
	static async invalidate(
		context: CacheContext,
		host: string,
		functionName?: string,
	): Promise<void> {
		try {
			if (functionName) {
				// Invalidate specific entry
				const cache = this.getCache<Record<string, IZatwFmCacheEntry>>(
					context,
					CACHE_KEYS.FM_METADATA,
				);

				if (cache) {
					const key = this.buildKey(host, functionName);
					delete cache[key];
					this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
				}
			} else {
				// Invalidate all entries for host
				const cache = this.getCache<Record<string, IZatwFmCacheEntry>>(
					context,
					CACHE_KEYS.FM_METADATA,
				);

				if (cache) {
					const hostPrefix = this.normalizeHost(host);
					const keysToDelete = Object.keys(cache).filter((k) =>
						k.startsWith(hostPrefix),
					);
					for (const key of keysToDelete) {
						delete cache[key];
					}
					this.setCache(context, CACHE_KEYS.FM_METADATA, cache);
				}
			}

			Logger.debug('FM metadata cache invalidated', {
				module: 'FmMetadataCache',
				host,
				functionName: functionName || 'all',
			});
		} catch (error) {
			Logger.warn('Error invalidating FM metadata cache', {
				module: 'FmMetadataCache',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	// ============================================
	// Function Module Search Results
	// ============================================

	/**
	 * Get cached FM search results
	 */
	static async getSearchResults(
		context: CacheContext,
		host: string,
		pattern: string,
	): Promise<IZatwFmSearchResult[] | null> {
		try {
			const cache = this.getCache<Record<string, IZatwFmSearchCacheEntry>>(
				context,
				CACHE_KEYS.FM_SEARCH,
			);

			if (!cache) {
				return null;
			}

			const key = this.buildKey(host, `search:${pattern}`);
			const entry = cache[key];

			if (!entry) {
				return null;
			}

			// Check if expired
			if (Date.now() > entry.expires) {
				delete cache[key];
				this.setCache(context, CACHE_KEYS.FM_SEARCH, cache);
				return null;
			}

			Logger.debug('FM search cache hit', {
				module: 'FmMetadataCache',
				pattern,
			});

			return entry.results;
		} catch (error) {
			Logger.warn('Error reading FM search cache', {
				module: 'FmMetadataCache',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
			return null;
		}
	}

	/**
	 * Set FM search results in cache
	 */
	static async setSearchResults(
		context: CacheContext,
		host: string,
		pattern: string,
		results: IZatwFmSearchResult[],
		ttl: number = ZATW_FM_SEARCH_CACHE_TTL,
	): Promise<void> {
		try {
			let cache = this.getCache<Record<string, IZatwFmSearchCacheEntry>>(
				context,
				CACHE_KEYS.FM_SEARCH,
			);

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

			Logger.debug('FM search results cached', {
				module: 'FmMetadataCache',
				pattern,
				resultCount: results.length,
			});
		} catch (error) {
			Logger.warn('Error writing FM search cache', {
				module: 'FmMetadataCache',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	// ============================================
	// IDoc Type Metadata
	// ============================================

	/**
	 * Get cached IDoc type metadata
	 */
	static async getIdocType(
		context: CacheContext,
		host: string,
		idocType: string,
	): Promise<IZatwIdocTypeMetadata | null> {
		try {
			const cache = this.getCache<Record<string, { metadata: IZatwIdocTypeMetadata; expires: number }>>(
				context,
				CACHE_KEYS.IDOC_METADATA,
			);

			if (!cache) {
				return null;
			}

			const key = this.buildKey(host, idocType);
			const entry = cache[key];

			if (!entry) {
				return null;
			}

			// Check if expired
			if (Date.now() > entry.expires) {
				delete cache[key];
				this.setCache(context, CACHE_KEYS.IDOC_METADATA, cache);
				return null;
			}

			return entry.metadata;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Set IDoc type metadata in cache
	 */
	static async setIdocType(
		context: CacheContext,
		host: string,
		idocType: string,
		metadata: IZatwIdocTypeMetadata,
		ttl: number = ZATW_IDOC_CACHE_TTL,
	): Promise<void> {
		try {
			let cache = this.getCache<Record<string, { metadata: IZatwIdocTypeMetadata; expires: number }>>(
				context,
				CACHE_KEYS.IDOC_METADATA,
			);

			if (!cache) {
				cache = {};
			}

			const key = this.buildKey(host, idocType);
			cache[key] = {
				metadata,
				expires: Date.now() + ttl,
			};

			this.setCache(context, CACHE_KEYS.IDOC_METADATA, cache);
		} catch (error) {
			Logger.warn('Error writing IDoc metadata cache', {
				module: 'FmMetadataCache',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	// ============================================
	// Cache Cleanup
	// ============================================

	/**
	 * Clean up expired entries from all caches
	 */
	static async cleanup(context: CacheContext): Promise<void> {
		const now = Date.now();

		// Clean FM metadata cache
		const fmCache = this.getCache<Record<string, IZatwFmCacheEntry>>(
			context,
			CACHE_KEYS.FM_METADATA,
		);
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
				Logger.debug('FM metadata cache cleaned', {
					module: 'FmMetadataCache',
					entriesRemoved: cleaned,
				});
			}
		}

		// Clean FM search cache
		const searchCache = this.getCache<Record<string, IZatwFmSearchCacheEntry>>(
			context,
			CACHE_KEYS.FM_SEARCH,
		);
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

		// Clean IDoc cache
		const idocCache = this.getCache<Record<string, { metadata: IZatwIdocTypeMetadata; expires: number }>>(
			context,
			CACHE_KEYS.IDOC_METADATA,
		);
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

	// ============================================
	// Private Helpers
	// ============================================

	/**
	 * Build cache key from host and identifier
	 */
	private static buildKey(host: string, identifier: string): string {
		return `${this.normalizeHost(host)}:${identifier}`;
	}

	/**
	 * Normalize host URL for cache key
	 */
	private static normalizeHost(host: string): string {
		return host.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
	}

	/**
	 * Get cache from workflow static data
	 */
	private static getCache<T>(context: CacheContext, key: string): T | null {
		try {
			if ('getWorkflowStaticData' in context) {
				const staticData = context.getWorkflowStaticData('global');
				return (staticData[key] as T) || null;
			}
		} catch {
			// Static data not available in this context
		}
		return null;
	}

	/**
	 * Set cache in workflow static data
	 */
	private static setCache<T>(context: CacheContext, key: string, value: T): void {
		try {
			if ('getWorkflowStaticData' in context) {
				const staticData = context.getWorkflowStaticData('global');
				// Cast to IDataObject to store in static data
				staticData[key] = value as unknown as IDataObject;
			}
		} catch {
			// Static data not available in this context
		}
	}
}
