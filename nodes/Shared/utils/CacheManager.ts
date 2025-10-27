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
	 * Get cache key for a specific host, service path, and credentials
	 * Includes credential identifier to prevent cache leaks between users
	 */
	private static getCacheKey(host: string, servicePath: string, credentialId?: string): string {
		const baseKey = `${host}${servicePath}`;
		// Include credential ID in key for multi-tenant isolation
		// If credentialId not provided, use host-only for backward compatibility
		const fullKey = credentialId ? `${credentialId}_${baseKey}` : baseKey;
		return fullKey.replace(/[^a-zA-Z0-9_]/g, '_');
	}

	/**
	 * Extract credential identifier from context
	 * Used to create user-specific cache keys for multi-tenant isolation
	 */
	private static async getCredentialId(context: IContextType): Promise<string | undefined> {
		try {
			const credentials = await context.getCredentials('sapOdataApi');
			// Use username + host as unique identifier
			// This prevents cache sharing between different users/credentials
			const username = credentials.username as string || '';
			const host = credentials.host as string || '';
			return username && host ? `${username}@${host}` : undefined;
		} catch {
			// If credentials not available, return undefined
			return undefined;
		}
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
	static async getCsrfToken(
		context: IContextType,
		host: string,
		servicePath: string,
	): Promise<string | null> {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const credentialId = await this.getCredentialId(context);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `csrf_${this.getCacheKey(host, servicePath, credentialId)}`;
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
	static async setCsrfToken(
		context: IContextType,
		host: string,
		servicePath: string,
		token: string,
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `csrf_${this.getCacheKey(host, servicePath, credentialId)}`;

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
	static async getMetadata(
		context: IContextType,
		host: string,
		servicePath: string,
	): Promise<IMetadataCacheEntry | null> {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const credentialId = await this.getCredentialId(context);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `metadata_${this.getCacheKey(host, servicePath, credentialId)}`;
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
	static async setMetadata(
		context: IContextType,
		host: string,
		servicePath: string,
		entitySets: string[],
		functionImports: string[],
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const cacheKey = `metadata_${this.getCacheKey(host, servicePath, credentialId)}`;

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
	static async getServiceCatalog(
		context: IContextType,
		host: string,
	): Promise<any[] | null> {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const credentialId = await this.getCredentialId(context);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const hostKey = host.replace(/[^a-zA-Z0-9]/g, '_');
			const cacheKey = credentialId ? `services_${credentialId}_${hostKey}` : `services_${hostKey}`;
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
	static async setServiceCatalog(
		context: IContextType,
		host: string,
		services: any[],
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const hostKey = host.replace(/[^a-zA-Z0-9]/g, '_');
			const cacheKey = credentialId ? `services_${credentialId}_${hostKey}` : `services_${hostKey}`;

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
