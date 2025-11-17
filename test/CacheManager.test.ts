import { CacheManager } from '../nodes/Shared/utils/CacheManager';
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';

describe('CacheManager', () => {
	let mockContext: Partial<IExecuteFunctions>;
	let staticData: IDataObject;

	beforeEach(() => {
		staticData = {};
		mockContext = {
			getWorkflowStaticData: jest.fn(() => staticData),
			getCredentials: jest.fn(async () => ({
				username: 'testuser',
				password: 'testpass',
				host: 'https://sap.example.com',
				sapClient: '100',
				sapLanguage: 'EN',
			})) as any,
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getCsrfToken', () => {
		it('should return null when no token is cached', async () => {
			const token = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(token).toBeNull();
		});

		it('should return cached token when not expired', async () => {
			const testToken = 'test-csrf-token-123';

			// Set token first
			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				testToken,
			);

			// Get token
			const token = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(token).toBe(testToken);
		});

		it('should return null when token is expired', async () => {
			// Manually set expired token
			const credentialId = 'testuser@https://sap.example.com:100:EN';
			const cacheKey = await getCacheKeyForTest(
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				credentialId,
			);

			staticData[`csrf_${cacheKey}`] = {
				token: 'expired-token',
				expires: Date.now() - 1000, // Expired 1 second ago
			};

			const token = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(token).toBeNull();
			// Expired entry should be deleted
			expect(staticData[`csrf_${cacheKey}`]).toBeUndefined();
		});

		it('should return null when WorkflowStaticData is not available', async () => {
			mockContext.getWorkflowStaticData = jest.fn(() => {
				throw new Error('Not available');
			});

			const token = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(token).toBeNull();
		});

		it('should handle different service paths separately', async () => {
			const token1 = 'token-service-1';
			const token2 = 'token-service-2';

			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE_1',
				token1,
			);

			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE_2',
				token2,
			);

			const retrievedToken1 = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE_1',
			);

			const retrievedToken2 = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE_2',
			);

			expect(retrievedToken1).toBe(token1);
			expect(retrievedToken2).toBe(token2);
		});
	});

	describe('setCsrfToken', () => {
		it('should store CSRF token in cache', async () => {
			const testToken = 'test-csrf-token-456';

			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				testToken,
			);

			// Check that token was stored
			const keys = Object.keys(staticData);
			const csrfKeys = keys.filter((k) => k.startsWith('csrf_'));
			expect(csrfKeys.length).toBe(1);

			const cached = staticData[csrfKeys[0]] as { token: string; expires: number };
			expect(cached.token).toBe(testToken);
			expect(cached.expires).toBeGreaterThan(Date.now());
		});

		it('should not throw when WorkflowStaticData is not available', async () => {
			mockContext.getWorkflowStaticData = jest.fn(() => {
				throw new Error('Not available');
			});

			await expect(
				CacheManager.setCsrfToken(
					mockContext as IExecuteFunctions,
					'https://sap.example.com',
					'/sap/opu/odata/sap/API_SERVICE',
					'token',
				),
			).resolves.not.toThrow();
		});

		it('should overwrite existing token', async () => {
			const firstToken = 'first-token';
			const secondToken = 'second-token';

			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				firstToken,
			);

			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				secondToken,
			);

			const token = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(token).toBe(secondToken);
		});
	});

	describe('getMetadata', () => {
		it('should return null when no metadata is cached', async () => {
			const metadata = await CacheManager.getMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(metadata).toBeNull();
		});

		it('should return cached metadata when not expired', async () => {
			const testEntitySets = ['ProductSet', 'SalesOrderSet'];
			const testFunctionImports = ['GetProductDetails'];

			// Set metadata first
			await CacheManager.setMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				testEntitySets,
				testFunctionImports,
			);

			// Get metadata
			const metadata = await CacheManager.getMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(metadata).not.toBeNull();
			expect(metadata?.entitySets).toEqual(testEntitySets);
			expect(metadata?.functionImports).toEqual(testFunctionImports);
		});

		it('should return null when metadata is expired', async () => {
			// Manually set expired metadata
			const credentialId = 'testuser@https://sap.example.com:100:EN';
			const cacheKey = await getCacheKeyForTest(
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				credentialId,
			);

			staticData[`metadata_${cacheKey}`] = {
				entitySets: ['ProductSet'],
				functionImports: [],
				expires: Date.now() - 1000, // Expired 1 second ago
			};

			const metadata = await CacheManager.getMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(metadata).toBeNull();
			// Expired entry should be deleted
			expect(staticData[`metadata_${cacheKey}`]).toBeUndefined();
		});
	});

	describe('setMetadata', () => {
		it('should store metadata in cache', async () => {
			const testEntitySets = ['ProductSet', 'SalesOrderSet'];
			const testFunctionImports = ['GetProductDetails'];

			await CacheManager.setMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				testEntitySets,
				testFunctionImports,
			);

			// Check that metadata was stored
			const keys = Object.keys(staticData);
			const metadataKeys = keys.filter((k) => k.startsWith('metadata_'));
			expect(metadataKeys.length).toBe(1);

			const cached = staticData[metadataKeys[0]] as {
				entitySets: string[];
				functionImports: string[];
				expires: number;
			};
			expect(cached.entitySets).toEqual(testEntitySets);
			expect(cached.functionImports).toEqual(testFunctionImports);
			expect(cached.expires).toBeGreaterThan(Date.now());
		});
	});

	describe('clearCache', () => {
		it('should clear cache entries for specific host and servicePath', async () => {
			// Set some cache entries
			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				'token1',
			);

			await CacheManager.setMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				['Test'],
				[],
			);

			// Clear cache
			await CacheManager.clearCache(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			// Verify cache is empty
			const token = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);
			const metadata = await CacheManager.getMetadata(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(token).toBeNull();
			expect(metadata).toBeNull();
		});
	});

	describe('cache isolation', () => {
		it('should isolate cache by credentials', async () => {
			const token1 = 'user1-token';
			const token2 = 'user2-token';

			// Set token for user1
			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				token1,
			);

			// Change credentials to user2
			mockContext.getCredentials = jest.fn(async () => ({
				username: 'testuser2',
				password: 'testpass2',
				host: 'https://sap.example.com',
				sapClient: '100',
				sapLanguage: 'EN',
			})) as any;

			// Set token for user2
			await CacheManager.setCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
				token2,
			);

			// Get token for user2
			const retrievedToken2 = await CacheManager.getCsrfToken(
				mockContext as IExecuteFunctions,
				'https://sap.example.com',
				'/sap/opu/odata/sap/API_SERVICE',
			);

			expect(retrievedToken2).toBe(token2);
		});
	});
});

// Helper function to generate cache key (mirrors internal logic)
function getCacheKeyForTest(host: string, servicePath: string, credentialId?: string): string {
	const normalizedHost = host.toLowerCase().replace(/\/$/, '');
	const normalizedPath = servicePath.replace(/^\//, '').replace(/\/$/, '');
	const keyComponents = [normalizedHost, normalizedPath, credentialId || 'anonymous'];
	const keyString = keyComponents.join('::');

	let hash = 0;
	for (let i = 0; i < keyString.length; i++) {
		const char = keyString.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}

	const safeKey = `cache_${Math.abs(hash).toString(36)}`;
	const suffix = keyString.length.toString(36);
	return `${safeKey}_${suffix}`;
}
