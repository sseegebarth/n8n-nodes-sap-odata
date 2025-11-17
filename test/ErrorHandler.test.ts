import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { ODataErrorHandler } from '../nodes/Shared/utils/ErrorHandler';
import { ERROR_MESSAGES } from '../nodes/Shared/constants';

describe('ODataErrorHandler', () => {
	const mockNode = {
		id: 'test-node-id',
		name: 'Test Node',
		type: 'n8n-nodes-sap-odata.sapOData',
		typeVersion: 1,
		position: [250, 300] as [number, number],
		parameters: {},
	};

	describe('handleApiError', () => {
		it('should handle 401 Unauthorized errors', () => {
			const error = {
				message: 'Unauthorized',
				response: { status: 401 },
			};

			expect(() =>
				ODataErrorHandler.handleApiError(error, mockNode, {
					operation: 'GET',
					resource: '/ProductSet',
				}),
			).toThrow(NodeOperationError);

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e.message).toBe(ERROR_MESSAGES.AUTH_FAILED);
				expect(e.description).toContain('Username and password are correct');
			}
		});

		it('should handle 403 Forbidden errors', () => {
			const error = {
				message: 'Forbidden',
				response: { status: 403 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode, {
					resource: '/SalesOrderSet',
				});
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Access Forbidden - Missing SAP Authorizations');
				expect(e.description).toContain('does not have permission');
			}
		});

		it('should handle 404 Not Found errors', () => {
			const error = {
				message: 'Not Found',
				response: { status: 404 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode, {
					resource: '/NonExistentSet',
				});
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Resource Not Found');
				expect(e.description).toContain('NonExistentSet');
			}
		});

		it('should handle 429 Rate Limit errors', () => {
			const error = {
				message: 'Too Many Requests',
				response: { status: 429 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
				expect(e.description).toContain('wait before retrying');
			}
		});

		it('should handle 500 Internal Server Error', () => {
			const error = {
				message: 'Internal Server Error',
				response: { status: 500 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('SAP Internal Server Error');
				expect(e.description).toContain('encountered an internal error');
			}
		});

		it('should handle 502 Bad Gateway errors', () => {
			const error = {
				message: 'Bad Gateway',
				response: { status: 502 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Bad Gateway');
			}
		});

		it('should handle 503 Service Unavailable errors', () => {
			const error = {
				message: 'Service Unavailable',
				response: { status: 503 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Service Temporarily Unavailable');
			}
		});

		it('should handle 504 Gateway Timeout errors', () => {
			const error = {
				message: 'Gateway Timeout',
				response: { status: 504 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Service Temporarily Unavailable');
			}
		});

		it('should handle unknown status codes as generic errors', () => {
			const error = {
				message: 'Unknown Error',
				response: { status: 418 }, // I'm a teapot
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeApiError);
			}
		});

		it('should sanitize error messages', () => {
			const error = {
				message: 'Error with password=secret123 in URL',
				response: { status: 500 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				// Error message should be sanitized
				expect(e.message).not.toContain('secret123');
			}
		});

		it('should include context in error description', () => {
			const error = {
				message: 'Error',
				response: { status: 400 },
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode, {
					operation: 'POST',
					resource: '/ProductSet',
					itemIndex: 5,
				});
			} catch (e: any) {
				expect(e.context?.itemIndex).toBe(5);
			}
		});

		it('should handle errors without response object', () => {
			const error = {
				message: 'Network error',
				statusCode: 401,
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe(ERROR_MESSAGES.AUTH_FAILED);
			}
		});

		it('should handle errors with context statusCode', () => {
			const error = {
				message: 'Error',
			};

			try {
				ODataErrorHandler.handleApiError(error, mockNode, {
					statusCode: 404,
					resource: '/TestSet',
				});
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Resource Not Found');
			}
		});
	});

	describe('handleValidationError', () => {
		it('should throw NodeOperationError with message', () => {
			expect(() =>
				ODataErrorHandler.handleValidationError('Invalid input', mockNode),
			).toThrow(NodeOperationError);
		});

		it('should include item index if provided', () => {
			try {
				ODataErrorHandler.handleValidationError('Invalid input', mockNode, 3);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Invalid input');
				expect(e.context?.itemIndex).toBe(3);
			}
		});

		it('should work without item index', () => {
			try {
				ODataErrorHandler.handleValidationError('Invalid input', mockNode);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe('Invalid input');
			}
		});
	});

	describe('handleOperationError', () => {
		it('should handle operation errors with context', () => {
			const error = new Error('Operation failed');

			try {
				ODataErrorHandler.handleOperationError('CREATE', error, mockNode, 2);
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeApiError);
			}
		});

		it('should preserve NodeOperationError instances', () => {
			const originalError = new NodeOperationError(mockNode, 'Original error');

			try {
				ODataErrorHandler.handleOperationError('UPDATE', originalError, mockNode);
			} catch (e: any) {
				expect(e).toBe(originalError);
			}
		});

		it('should preserve NodeApiError instances', () => {
			const originalError = new NodeApiError(mockNode, { message: 'API error' });

			try {
				ODataErrorHandler.handleOperationError('DELETE', originalError, mockNode);
			} catch (e: any) {
				expect(e).toBe(originalError);
			}
		});
	});

	describe('wrapAsync', () => {
		it('should execute successful operations', async () => {
			const operation = async () => {
				return { success: true };
			};

			const result = await ODataErrorHandler.wrapAsync(operation, mockNode);
			expect(result).toEqual({ success: true });
		});

		it('should handle errors in async operations', async () => {
			const operation = async () => {
				throw new Error('Async error');
			};

			await expect(ODataErrorHandler.wrapAsync(operation, mockNode)).rejects.toThrow();
		});

		it('should include context in wrapped errors', async () => {
			const operation = async () => {
				const error: any = new Error('Error');
				error.response = { status: 401 };
				throw error;
			};

			try {
				await ODataErrorHandler.wrapAsync(operation, mockNode, {
					operation: 'GET',
					resource: '/ProductSet',
					itemIndex: 1,
				});
			} catch (e: any) {
				expect(e).toBeInstanceOf(NodeOperationError);
				expect(e.message).toBe(ERROR_MESSAGES.AUTH_FAILED);
			}
		});

		it('should handle API errors with status codes', async () => {
			const operation = async () => {
				const error: any = new Error('Rate limited');
				error.response = { status: 429 };
				throw error;
			};

			try {
				await ODataErrorHandler.wrapAsync(operation, mockNode);
			} catch (e: any) {
				expect(e.message).toBe(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
			}
		});
	});
});
