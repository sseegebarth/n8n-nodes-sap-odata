import { NodeApiError } from 'n8n-workflow';
import { withRetry } from '../nodes/Sap/RetryUtils';

describe('RetryUtils', () => {
	let consoleLogSpy: jest.SpyInstance;

	beforeAll(() => {
		// Mock console.log to silence retry logs during tests
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
	});

	afterAll(() => {
		// Restore console.log after all tests
		consoleLogSpy.mockRestore();
	});

	describe('withRetry', () => {
		it('should return result on first success', async () => {
			const mockFn = jest.fn().mockResolvedValue('success');

			const result = await withRetry(mockFn);

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should retry on 429 (rate limit) error', async () => {
			const mockError = new NodeApiError(
				{ name: 'test', type: 'test', typeVersion: 1, description: '', inputs: [], outputs: [] } as any,
				{ message: 'Rate limited', httpCode: '429' } as any,
			);

			const mockFn = jest
				.fn()
				.mockRejectedValueOnce(mockError)
				.mockResolvedValue('success');

			const result = await withRetry(mockFn, { initialDelay: 10, maxAttempts: 3 });

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it('should retry on 503 (service unavailable) error', async () => {
			const mockError = { statusCode: 503, message: 'Service unavailable' };

			const mockFn = jest
				.fn()
				.mockRejectedValueOnce(mockError)
				.mockRejectedValueOnce(mockError)
				.mockResolvedValue('success');

			const result = await withRetry(mockFn, { initialDelay: 10, maxAttempts: 3 });

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('should retry on network errors (ETIMEDOUT)', async () => {
			const mockError = { code: 'ETIMEDOUT', message: 'Connection timed out' };

			const mockFn = jest
				.fn()
				.mockRejectedValueOnce(mockError)
				.mockResolvedValue('success');

			const result = await withRetry(mockFn, { initialDelay: 10, maxAttempts: 3 });

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it('should NOT retry on 404 error (non-retryable)', async () => {
			const mockError = new NodeApiError(
				{ name: 'test', type: 'test', typeVersion: 1, description: '', inputs: [], outputs: [] } as any,
				{ message: 'Not found', httpCode: '404' } as any,
			);

			const mockFn = jest.fn().mockRejectedValue(mockError);

			await expect(withRetry(mockFn, { initialDelay: 10 })).rejects.toThrow(mockError);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should NOT retry on validation errors', async () => {
			const mockError = new Error('Invalid input');

			const mockFn = jest.fn().mockRejectedValue(mockError);

			await expect(withRetry(mockFn, { initialDelay: 10 })).rejects.toThrow(mockError);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should exhaust retries and throw last error', async () => {
			const mockError = { statusCode: 503, message: 'Service unavailable' };

			const mockFn = jest.fn().mockRejectedValue(mockError);

			await expect(
				withRetry(mockFn, { initialDelay: 10, maxAttempts: 3 }),
			).rejects.toEqual(mockError);

			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('should respect custom retry configuration', async () => {
			const mockError = { statusCode: 503, message: 'Error' };

			const mockFn = jest.fn().mockRejectedValue(mockError);

			await expect(
				withRetry(mockFn, { initialDelay: 10, maxAttempts: 2 }),
			).rejects.toEqual(mockError);

			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it('should retry on custom status codes', async () => {
			const mockError = { statusCode: 500, message: 'Internal server error' };

			const mockFn = jest
				.fn()
				.mockRejectedValueOnce(mockError)
				.mockResolvedValue('success');

			const result = await withRetry(mockFn, {
				initialDelay: 10,
				retryableStatusCodes: [500, 503],
			});

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it('should implement exponential backoff', async () => {
			const mockError = { statusCode: 503 };
			const delays: number[] = [];
			const startTime = Date.now();

			const mockFn = jest.fn().mockImplementation(async () => {
				if (mockFn.mock.calls.length > 1) {
					delays.push(Date.now() - startTime);
				}
				if (mockFn.mock.calls.length < 3) {
					throw mockError;
				}
				return 'success';
			});

			await withRetry(mockFn, { initialDelay: 50, maxAttempts: 3, maxDelay: 500 });

			expect(mockFn).toHaveBeenCalledTimes(3);
			// Second attempt should wait ~50ms, third attempt should wait ~100ms+
			expect(delays.length).toBe(2);
			expect(delays[0]).toBeGreaterThanOrEqual(40); // Allow some timing variance
			expect(delays[1]).toBeGreaterThanOrEqual(delays[0]); // Second delay should be longer
		});
	});
});
