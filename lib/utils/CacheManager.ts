import { IDataObject, IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';
import { createHash } from 'crypto';
import { CSRF_TOKEN_CACHE_TTL, METADATA_CACHE_TTL, CACHE_CLEANUP_INTERVAL } from '../constants';
import { ICsrfTokenCacheEntry, IMetadataCacheEntry, IServiceCatalogEntry, IServiceCatalogCacheEntry } from '../types';

type IContextType = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

/**
 * Cache Manager for CSRF Tokens and Metadata
 * Uses WorkflowStaticData for persistence across executions
 */
export class CacheManager {
	private static accessCounter = 0;
	private static readonly CLEANUP_INTERVAL = CACHE_CLEANUP_INTERVAL;
	private static cleanupInProgress = false; // Prevent concurrent cleanup operations

	/**
	 * Get cache key for a specific host, service path, and credentials
	 * Includes credential identifier to prevent cache leaks between users
	 * Normalizes service paths to avoid cache misses from trailing slashes
	 * Uses secure hashing to prevent key collisions and information leakage
	 */
	private static getCacheKey(host: string, servicePath: string, credentialId?: string): string {
		// Normalize inputs for consistency
		const normalizedHost = host.toLowerCase().replace(/\/$/, ''); // Remove trailing slash
		const normalizedPath = servicePath.replace(/^\//, '').replace(/\/$/, ''); // Remove leading/trailing slashes

		// Create a unique key combining all parameters
		const keyComponents = [
			normalizedHost,
			normalizedPath,
			credentialId || 'anonymous'
		];

		// Create a deterministic hash of the components
		// This prevents information leakage in cache keys while maintaining uniqueness
		const keyString = keyComponents.join('::');

		// Use SHA-256 for secure, collision-resistant cache key generation
		// This prevents cache poisoning and provides better distribution than simple hashing
		const hash = createHash('sha256')
			.update(keyString)
			.digest('hex')
			.substring(0, 16); // First 16 hex chars = 64 bits (sufficient for cache keys)

		// Return a safe cache key with prefix
		return `cache_${hash}`;
	}

	/**
	 * Extract credential identifier from context
	 * Used to create user-specific cache keys for multi-tenant isolation
	 * Includes client and language to prevent cross-client cache contamination
	 *
	 * IMPORTANT: Computes fingerprint per call to support runtime credential expressions
	 * Do NOT cache the credential ID as it may change between items in multi-item executions
	 */
	private static async getCredentialId(context: IContextType, itemIndex?: number): Promise<string | undefined> {
		try {
			// Fetch credentials dynamically - DO NOT use cached value
			// This ensures per-item credential expressions work correctly
			const credentials = itemIndex !== undefined && 'getCredentials' in context
				? await (context as IExecuteFunctions).getCredentials('sapOdataApi', itemIndex)
				: await context.getCredentials('sapOdataApi');

			// Use username + host + client + language as unique identifier
			// This prevents cache sharing between different users/credentials/clients
			const username = credentials.username as string || '';
			const host = credentials.host as string || '';
			const client = credentials.sapClient as string || '';
			const lang = credentials.sapLanguage as string || 'EN';

			if (!username || !host) return undefined;

			// Include client and language in fingerprint to avoid multi-client cache bleed
			const credentialId = `${username}@${host}:${client}:${lang}`;

			return credentialId;
		} catch {
			// If credentials not available, return undefined
			return undefined;
		}
	}

	/**
	 * Trigger cleanup periodically based on access count
	 * Prevents concurrent cleanup operations to avoid race conditions
	 */
	private static maybeRunCleanup(context: IContextType): void {
		this.accessCounter++;
		if (this.accessCounter >= this.CLEANUP_INTERVAL && !this.cleanupInProgress) {
			this.accessCounter = 0;
			this.cleanupInProgress = true;
			try {
				this.cleanupExpiredCache(context);
			} finally {
				this.cleanupInProgress = false;
			}
		}
	}

	/**
	 * Get CSRF token from cache
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async getCsrfToken(
		context: IContextType,
		host: string,
		servicePath: string,
		itemIndex?: number,
	): Promise<string | null> {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const credentialId = await this.getCredentialId(context, itemIndex);
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
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async setCsrfToken(
		context: IContextType,
		host: string,
		servicePath: string,
		token: string,
		itemIndex?: number,
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context, itemIndex);
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
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async getMetadata(
		context: IContextType,
		host: string,
		servicePath: string,
		itemIndex?: number,
	): Promise<IMetadataCacheEntry | null> {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const credentialId = await this.getCredentialId(context, itemIndex);
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
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async setMetadata(
		context: IContextType,
		host: string,
		servicePath: string,
		entitySets: string[],
		functionImports: string[],
		itemIndex?: number,
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context, itemIndex);
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
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async clearCache(
		context: IContextType,
		host: string,
		servicePath: string,
		itemIndex?: number,
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context, itemIndex);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const baseKey = this.getCacheKey(host, servicePath, credentialId);

			delete staticData[`csrf_${baseKey}`];
			delete staticData[`metadata_${baseKey}`];
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Invalidate cache when 404 error occurs
	 * This ensures stale cache doesn't persist after service path changes
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async invalidateCacheOn404(
		context: IContextType,
		host: string,
		servicePath: string,
		itemIndex?: number,
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context, itemIndex);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const baseKey = this.getCacheKey(host, servicePath, credentialId);

			// Remove metadata cache on 404 (service/entity not found)
			// CSRF token cache is preserved as authentication is separate
			delete staticData[`metadata_${baseKey}`];
		} catch {
			// Silently fail if WorkflowStaticData not available
		}
	}

	/**
	 * Get service catalog from cache
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async getServiceCatalog(
		context: IContextType,
		host: string,
		itemIndex?: number,
	): Promise<IServiceCatalogEntry[] | null> {
		try {
			// Trigger periodic cleanup
			this.maybeRunCleanup(context);

			const credentialId = await this.getCredentialId(context, itemIndex);
			const staticData = context.getWorkflowStaticData('node') as IDataObject;
			const hostKey = host.replace(/[^a-zA-Z0-9]/g, '_');
			const cacheKey = credentialId ? `services_${credentialId}_${hostKey}` : `services_${hostKey}`;
			const cached = staticData[cacheKey] as IServiceCatalogCacheEntry | undefined;

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
	 * @param itemIndex - Optional item index for per-item credential expressions
	 */
	static async setServiceCatalog(
		context: IContextType,
		host: string,
		services: any[],
		itemIndex?: number,
	): Promise<void> {
		try {
			const credentialId = await this.getCredentialId(context, itemIndex);
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
