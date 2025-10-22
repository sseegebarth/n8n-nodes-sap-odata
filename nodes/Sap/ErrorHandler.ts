import { NodeApiError, NodeOperationError, INode } from 'n8n-workflow';
import { sanitizeErrorMessage } from './SecurityUtils';
import { ERROR_MESSAGES } from './constants';
import { IErrorContext } from './types';

/**
 * Centralized error handling for SAP OData Node
 */
export class ODataErrorHandler {
	/**
	 * Handle API errors with context
	 */
	static handleApiError(error: any, node: INode, context: IErrorContext = {}): never {
		// Sanitize error message
		const sanitizedMessage = sanitizeErrorMessage(error.message || 'Unknown error');

		// Extract status code
		const statusCode = error.response?.status || error.statusCode || context.statusCode;

		// Build error description
		let description = '';
		if (context.operation) {
			description += `Operation: ${context.operation}\n`;
		}
		if (context.resource) {
			description += `Resource: ${context.resource}\n`;
		}
		if (statusCode) {
			description += `Status Code: ${statusCode}\n`;
		}

		// Handle specific HTTP status codes
		switch (statusCode) {
			case 401:
				throw new NodeOperationError(
					node,
					ERROR_MESSAGES.AUTH_FAILED,
					{
						description: 'Please verify your credentials and try again.',
						itemIndex: context.itemIndex,
					},
				);

			case 403:
				throw new NodeOperationError(
					node,
					'Access forbidden',
					{
						description: 'You do not have permission to access this resource.',
						itemIndex: context.itemIndex,
					},
				);

			case 404:
				throw new NodeOperationError(
					node,
					'Resource not found',
					{
						description: `The requested resource '${context.resource}' does not exist.`,
						itemIndex: context.itemIndex,
					},
				);

			case 429:
				throw new NodeOperationError(
					node,
					ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
					{
						description: 'Too many requests. Please wait before retrying.',
						itemIndex: context.itemIndex,
					},
				);

			case 500:
			case 502:
			case 503:
			case 504:
				throw new NodeOperationError(
					node,
					'Server error',
					{
						description: 'The SAP server encountered an error. Please try again later.',
						itemIndex: context.itemIndex,
					},
				);

			default:
				// Generic error
				throw new NodeApiError(
					node,
					{
						message: sanitizedMessage,
						description,
						...error,
					},
					{
						itemIndex: context.itemIndex,
					},
				);
		}
	}

	/**
	 * Handle validation errors
	 */
	static handleValidationError(
		message: string,
		node: INode,
		itemIndex?: number,
	): never {
		throw new NodeOperationError(
			node,
			message,
			{
				itemIndex,
			},
		);
	}

	/**
	 * Handle operation-specific errors
	 */
	static handleOperationError(
		operation: string,
		error: any,
		node: INode,
		itemIndex?: number,
	): never {
		const context: IErrorContext = {
			operation,
			itemIndex,
		};

		// Check if it's a known error type
		if (error instanceof NodeOperationError || error instanceof NodeApiError) {
			throw error;
		}

		// Otherwise, handle as API error
		this.handleApiError(error, node, context);
	}

	/**
	 * Wrap async operations with error handling
	 */
	static async wrapAsync<T>(
		operation: () => Promise<T>,
		node: INode,
		context: IErrorContext = {},
	): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			this.handleApiError(error, node, context);
		}
	}
}
