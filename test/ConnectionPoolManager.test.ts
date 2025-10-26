import { ConnectionPoolManager } from '../nodes/Shared/utils/ConnectionPoolManager';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

describe('ConnectionPoolManager', () => {
	beforeEach(() => {
		// Reset singleton instance before each test
		ConnectionPoolManager.resetInstance();
	});

	afterEach(() => {
		// Clean up after each test
		ConnectionPoolManager.resetInstance();
	});

	describe('Singleton Pattern', () => {
		it('should return the same instance on multiple calls', () => {
			const instance1 = ConnectionPoolManager.getInstance();
			const instance2 = ConnectionPoolManager.getInstance();

			expect(instance1).toBe(instance2);
		});

		it('should create new instance after reset', () => {
			const instance1 = ConnectionPoolManager.getInstance();
			ConnectionPoolManager.resetInstance();
			const instance2 = ConnectionPoolManager.getInstance();

			expect(instance1).not.toBe(instance2);
		});
	});

	describe('Configuration', () => {
		it('should use default configuration when none provided', () => {
			const manager = ConnectionPoolManager.getInstance();
			const config = manager.getConfig();

			expect(config.keepAlive).toBe(true);
			expect(config.maxSockets).toBe(10);
			expect(config.maxFreeSockets).toBe(5);
			expect(config.timeout).toBe(120000);
			expect(config.freeSocketTimeout).toBe(30000);
			expect(config.scheduling).toBe('fifo');
		});

		it('should merge custom configuration with defaults', () => {
			const customConfig = {
				maxSockets: 20,
				timeout: 60000,
			};

			const manager = ConnectionPoolManager.getInstance(customConfig);
			const config = manager.getConfig();

			expect(config.maxSockets).toBe(20);
			expect(config.timeout).toBe(60000);
			expect(config.keepAlive).toBe(true); // Default value
			expect(config.maxFreeSockets).toBe(5); // Default value
		});

		it('should update configuration and recreate agents', () => {
			const manager = ConnectionPoolManager.getInstance({ maxSockets: 10 });
			const oldConfig = manager.getConfig();

			manager.updateConfig({ maxSockets: 25 });
			const newConfig = manager.getConfig();

			expect(oldConfig.maxSockets).toBe(10);
			expect(newConfig.maxSockets).toBe(25);
		});
	});

	describe('Agent Management', () => {
		it('should return HTTP agent for http: protocol', () => {
			const manager = ConnectionPoolManager.getInstance();
			const agent = manager.getAgent('http:');

			expect(agent).toBeInstanceOf(HttpAgent);
		});

		it('should return HTTPS agent for https: protocol', () => {
			const manager = ConnectionPoolManager.getInstance();
			const agent = manager.getAgent('https:');

			expect(agent).toBeInstanceOf(HttpsAgent);
		});

		it('should return HTTP agent for unknown protocols', () => {
			const manager = ConnectionPoolManager.getInstance();
			const agent = manager.getAgent('unknown:');

			expect(agent).toBeInstanceOf(HttpAgent);
		});

		it('should return the same agent instance on subsequent calls', () => {
			const manager = ConnectionPoolManager.getInstance();
			const agent1 = manager.getHttpAgent();
			const agent2 = manager.getHttpAgent();

			expect(agent1).toBe(agent2);
		});

		it('should throw error if HTTP agent not initialized', () => {
			const manager = ConnectionPoolManager.getInstance();
			manager.destroy();

			expect(() => manager.getHttpAgent()).toThrow('HTTP agent not initialized');
		});

		it('should throw error if HTTPS agent not initialized', () => {
			const manager = ConnectionPoolManager.getInstance();
			manager.destroy();

			expect(() => manager.getHttpsAgent()).toThrow('HTTPS agent not initialized');
		});
	});

	describe('Statistics', () => {
		it('should initialize statistics with zero values', () => {
			const manager = ConnectionPoolManager.getInstance();
			const stats = manager.getStats();

			expect(stats.activeSockets).toBe(0);
			expect(stats.freeSockets).toBe(0);
			expect(stats.pendingRequests).toBe(0);
			expect(stats.totalRequests).toBe(0);
			expect(stats.totalConnectionsCreated).toBe(0);
			expect(stats.totalConnectionsReused).toBe(0);
		});

		it('should increment total requests on getAgent call', () => {
			const manager = ConnectionPoolManager.getInstance();
			const initialStats = manager.getStats();

			manager.getAgent('https:');
			manager.getAgent('http:');

			const updatedStats = manager.getStats();

			expect(updatedStats.totalRequests).toBe(initialStats.totalRequests + 2);
		});

		it('should reset statistics', () => {
			const manager = ConnectionPoolManager.getInstance();

			// Make some requests
			manager.getAgent('https:');
			manager.getAgent('http:');

			const statsBeforeReset = manager.getStats();
			expect(statsBeforeReset.totalRequests).toBeGreaterThan(0);

			// Reset statistics
			manager.resetStats();

			const statsAfterReset = manager.getStats();
			expect(statsAfterReset.totalRequests).toBe(0);
			expect(statsAfterReset.activeSockets).toBe(0);
			expect(statsAfterReset.freeSockets).toBe(0);
			expect(statsAfterReset.pendingRequests).toBe(0);
		});
	});

	describe('Health Check', () => {
		it('should return healthy status by default', () => {
			const manager = ConnectionPoolManager.getInstance();
			const isHealthy = manager.isHealthy();

			expect(isHealthy).toBe(true);
		});

		it('should return unhealthy if too many pending requests', () => {
			const manager = ConnectionPoolManager.getInstance({ maxSockets: 5 });

			// Mock getStats to simulate many pending requests
			const originalGetStats = manager.getStats.bind(manager);
			manager.getStats = jest.fn(() => ({
				...originalGetStats(),
				pendingRequests: 15, // More than maxSockets * 2
			}));

			const isHealthy = manager.isHealthy();

			expect(isHealthy).toBe(false);
		});

		it('should return unhealthy if active sockets exceed max', () => {
			const manager = ConnectionPoolManager.getInstance({ maxSockets: 5 });

			// Mock getStats to simulate too many active sockets
			const originalGetStats = manager.getStats.bind(manager);
			manager.getStats = jest.fn(() => ({
				...originalGetStats(),
				activeSockets: 10, // More than maxSockets
			}));

			const isHealthy = manager.isHealthy();

			expect(isHealthy).toBe(false);
		});
	});

	describe('Cleanup', () => {
		it('should destroy agents on destroy call', () => {
			const manager = ConnectionPoolManager.getInstance();
			const httpAgent = manager.getHttpAgent();
			const httpsAgent = manager.getHttpsAgent();

			const httpDestroySpy = jest.spyOn(httpAgent, 'destroy');
			const httpsDestroySpy = jest.spyOn(httpsAgent, 'destroy');

			manager.destroy();

			expect(httpDestroySpy).toHaveBeenCalled();
			expect(httpsDestroySpy).toHaveBeenCalled();
		});

		it('should set agents to null after destroy', () => {
			const manager = ConnectionPoolManager.getInstance();
			manager.destroy();

			expect(() => manager.getHttpAgent()).toThrow('HTTP agent not initialized');
			expect(() => manager.getHttpsAgent()).toThrow('HTTPS agent not initialized');
		});
	});

	describe('Agent Configuration', () => {
		it('should configure agents with keepAlive', () => {
			const manager = ConnectionPoolManager.getInstance({ keepAlive: true });
			const agent = manager.getHttpAgent();

			expect((agent as any).keepAlive).toBe(true);
		});

		it('should configure agents with maxSockets', () => {
			const manager = ConnectionPoolManager.getInstance({ maxSockets: 15 });
			const agent = manager.getHttpAgent();

			expect((agent as any).maxSockets).toBe(15);
		});

		it('should configure agents with maxFreeSockets', () => {
			const manager = ConnectionPoolManager.getInstance({ maxFreeSockets: 8 });
			const agent = manager.getHttpAgent();

			expect((agent as any).maxFreeSockets).toBe(8);
		});

		it('should configure agents with timeout', () => {
			const manager = ConnectionPoolManager.getInstance({ timeout: 60000 });
			const config = manager.getConfig();

			// Node.js agents don't expose timeout as a readable property
			// Verify it's set in the configuration
			expect(config.timeout).toBe(60000);
		});

		it('should configure agents with freeSocketTimeout', () => {
			const manager = ConnectionPoolManager.getInstance({ freeSocketTimeout: 15000 });
			const config = manager.getConfig();

			// Node.js agents don't expose freeSocketTimeout as a readable property
			// Verify it's set in the configuration
			expect(config.freeSocketTimeout).toBe(15000);
		});

		it('should configure agents with scheduling', () => {
			const manager = ConnectionPoolManager.getInstance({ scheduling: 'lifo' });
			const agent = manager.getHttpAgent();

			expect((agent as any).scheduling).toBe('lifo');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty configuration object', () => {
			const manager = ConnectionPoolManager.getInstance({});
			const config = manager.getConfig();

			expect(config).toBeDefined();
			expect(config.keepAlive).toBe(true);
		});

		it('should handle partial configuration updates', () => {
			const manager = ConnectionPoolManager.getInstance({ maxSockets: 10 });
			manager.updateConfig({ timeout: 90000 });

			const config = manager.getConfig();

			expect(config.maxSockets).toBe(10);
			expect(config.timeout).toBe(90000);
		});

		it('should not crash when destroying already destroyed manager', () => {
			const manager = ConnectionPoolManager.getInstance();

			manager.destroy();
			expect(() => manager.destroy()).not.toThrow();
		});

		it('should handle rapid getInstance calls', () => {
			const instances = [];
			for (let i = 0; i < 100; i++) {
				instances.push(ConnectionPoolManager.getInstance());
			}

			// All should be the same instance
			const firstInstance = instances[0];
			expect(instances.every((instance) => instance === firstInstance)).toBe(true);
		});
	});
});
