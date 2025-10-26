import { IDataObject, IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';
import { CSRF_TOKEN_CACHE_TTL, METADATA_CACHE_TTL } from '../constants';
import { ICsrfTokenCacheEntry, IMetadataCacheEntry } from '../types';

type IContextType = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

/**
 * Cache Manager for CSRF Tokens and Metadata
 * Uses WorkflowStaticData for persistence across executions
 */
export class CacheManager {
	private static accessCounter = 0;
	private static readonly CLEANUP_INTERVAL = 10; // Run cleanup every 10 cache accesses

	/**
	 * Get cache key for a specific host and service path
	 */
	private static getCacheKey(host: string, servicePath: string): string {
		return `${host}${servicePath}`.replace(/[^a-zA-Z0-9]/g, '_');
	}

	/**
	 * Trigger cleanup periodically based on access count
	 */
	private static maybeRunCleanup(context: IContextType): void {
		this.accessCounter++;
		if (this.accessCounter >= this.CLEANUP_INTERVAL) {
			this.accessCounter = 0;
			this.cleanupExpiredCache(context);
		}
	}

	/**
	 * Get CSRF token from cache
	 */
	static getCsrfToken(
		context: IContextType,
		host: string,
		servicePath: string,
	): string | null {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `csrf_${this.getCacheKey(host, servicePath)}`;
			const cached = staticData[cacheKey] as ICsrfTokenCacheEntry | undefined;

			if (cached) {
				// Check if expired
				if (cached.expires > Date.now()) {
					return cached.token;
				}
				// Immediately remove expired entry
				delete staticData[cacheKey];
			}

			// Token expired or doesn't exist
			return null;
		} catch {
			// WorkflowStaticData not available in all contexts
			return null;
		}
	}

	/**
	 * Set CSRF token in cache
	 */
	static setCsrfToken(
		context: IContextType,
		host: string,
		servicePath: string,
		token: string,
	): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `csrf_${this.getCacheKey(host, servicePath)}`;

			staticData[cacheKey] = {
				token,
				expires: Date.now() + CSRF_TOKEN_CACHE_TTL,
			} as ICsrfTokenCacheEntry;
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Get metadata from cache
	 */
	static getMetadata(
		context: IContextType,
		host: string,
		servicePath: string,
	): IMetadataCacheEntry | null {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `metadata_${this.getCacheKey(host, servicePath)}`;
			const cached = staticData[cacheKey] as IMetadataCacheEntry | undefined;

			if (cached) {
				// Check if expired
				if (cached.expires > Date.now()) {
					return cached;
				}
				// Immediately remove expired entry
				delete staticData[cacheKey];
			}

			// Metadata expired or doesn't exist
			return null;
		} catch {
			// WorkflowStaticData not available in all contexts
			return null;
		}
	}

	/**
	 * Set metadata in cache
	 */
	static setMetadata(
		context: IContextType,
		host: string,
		servicePath: string,
		entitySets: string[],
		functionImports: string[],
	): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `metadata_${this.getCacheKey(host, servicePath)}`;

			staticData[cacheKey] = {
				entitySets,
				functionImports,
				expires: Date.now() + METADATA_CACHE_TTL,
			} as IMetadataCacheEntry;
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Clear all cache for a specific service
	 */
	static clearCache(
		context: IContextType,
		host: string,
		servicePath: string,
	): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const baseKey = this.getCacheKey(host, servicePath);

			delete staticData[`csrf_${baseKey}`];
			delete staticData[`metadata_${baseKey}`];
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Invalidate cache when 404 error occurs
	 * This ensures stale cache doesn't persist after service path changes
	 */
	static invalidateCacheOn404(
		context: IContextType,
		host: string,
		servicePath: string,
	): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const baseKey = this.getCacheKey(host, servicePath);

			// Remove metadata cache on 404 (service/entity not found)
			// CSRF token cache is preserved as authentication is separate
			delete staticData[`metadata_${baseKey}`];
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Get service catalog from cache
	 */
	static getServiceCatalog(
		context: IContextType,
		host: string,
	): any[] | null {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `services_${host.replace(/[^a-zA-Z0-9]/g, '_')}`;
			const cached = staticData[cacheKey] as any;

			if (cached) {
				// Check if expired
				if (cached.expires > Date.now()) {
					return cached.services;
				}
				// Immediately remove expired entry
				delete staticData[cacheKey];
			}

			// Service catalog expired or doesn't exist
			return null;
		} catch {
			// WorkflowStaticData not available in all contexts
			return null;
		}
	}

	/**
	 * Set service catalog in cache
	 */
	static setServiceCatalog(
		context: IContextType,
		host: string,
		services: any[],
	): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `services_${host.replace(/[^a-zA-Z0-9]/g, '_')}`;

			staticData[cacheKey] = {
				services,
				expires: Date.now() + METADATA_CACHE_TTL, // Use same TTL as metadata (5 min)
			};
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Clear all cache entries for this workflow
	 */
	static clearAllCache(context: IContextType): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const keys = Object.keys(staticData);

			// Remove all csrf_, metadata_, and services_ cache entries
			keys.forEach((key) => {
				if (key.startsWith('csrf_') || key.startsWith('metadata_') || key.startsWith('services_')) {
					delete staticData[key];
				}
			});
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Clear expired cache entries (cleanup)
	 */
	static cleanupExpiredCache(context: IContextType): void {
		try {
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const now = Date.now();

			// Find and remove expired entries
			Object.keys(staticData).forEach((key) => {
				if (key.startsWith('csrf_') || key.startsWith('metadata_') || key.startsWith('services_')) {
					const entry = staticData[key] as ICsrfTokenCacheEntry | IMetadataCacheEntry;
					if (entry && entry.expires < now) {
						delete staticData[key];
					}
				}
			});
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}
}
