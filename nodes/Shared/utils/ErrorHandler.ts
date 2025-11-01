import { NodeApiError, NodeOperationError, INode } from 'n8n-workflow';
import { ERROR_MESSAGES } from '../constants';
import { IErrorContext } from '../types';
import { sanitizeErrorMessage } from './SecurityUtils';

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

		// Extract SAP-specific error details
		const sapError = error.response?.data?.error || error.error;
		const sapCode = sapError?.code;
		const sapMessage = sapError?.message?.value || sapError?.message;
		const innererror = sapError?.innererror;

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
		if (sapCode) {
			description += `SAP Error Code: ${sapCode}\n`;
		}
		if (innererror?.type) {
			description += `Error Type: ${innererror.type}\n`;
		}

		// Handle SAP-specific error codes first
		if (sapCode) {
			// BAPI errors
			if (sapCode.includes('BAPI_ERROR') || sapCode.includes('/IWBEP/')) {
				throw new NodeOperationError(
					node,
					`SAP Function Error: ${sapMessage || 'BAPI not available'}`,
					{
						description: `${description}\n\nCheck SAP Gateway transaction /IWFND/MAINT_SERVICE for available functions and their status.\n\nCommon causes:\n- Function not activated in SAP Gateway\n- Missing authorization for function module\n- Incorrect function import name`,
						itemIndex: context.itemIndex,
					},
				);
			}

			// Type mismatch errors
			if (sapCode.includes('TYPE_MISMATCH') || innererror?.type === 'Type Mismatch') {
				throw new NodeOperationError(
					node,
					`Type Mismatch: ${sapMessage}`,
					{
						description: `${description}\n\nThe data type provided does not match the expected type in SAP.\n\nCommon fixes:\n- Check field types in $metadata\n- Ensure numbers are not quoted as strings\n- Verify date/time format (e.g., datetime'2024-01-15T10:30:00')\n- Check GUID format (e.g., guid'xxx-xxx-xxx')`,
						itemIndex: context.itemIndex,
					},
				);
			}

			// Mandatory parameter missing
			if (innererror?.type === 'Mandatory Parameter Missing' || sapCode.includes('MANDATORY')) {
				throw new NodeOperationError(
					node,
					`Mandatory Parameter Missing: ${sapMessage}`,
					{
						description: `${description}\n\nA required field is missing from your request.\n\nCheck:\n- Review $metadata for mandatory fields (Nullable="false")\n- Ensure all key fields are provided\n- Verify entity structure matches OData service definition`,
						itemIndex: context.itemIndex,
					},
				);
			}

			// Generic SAP error with code
			throw new NodeOperationError(
				node,
				`SAP Error (${sapCode}): ${sapMessage || sanitizedMessage}`,
				{
					description: `${description}\n\nThis is a SAP-specific error. Check SAP Gateway error logs:\n- Transaction: /IWFND/ERROR_LOG\n- Transaction: /IWFND/GW_CLIENT (for testing)\n\nError details may provide more context in SAP system logs.`,
					itemIndex: context.itemIndex,
				},
			);
		}

		// Handle specific HTTP status codes
		switch (statusCode) {
			case 400:
				throw new NodeOperationError(
					node,
					'Bad Request: Invalid OData syntax',
					{
						description: `${description}\n\nCommon causes:\n- Invalid $filter syntax (check quotes and operators)\n- Type mismatch in filter values\n- Malformed entity key format\n- Invalid field names in $select or $expand\n\nExample correct syntax:\n- Filter: Status eq 'A' and Amount gt 100\n- Key: ProductID='123' or ProductID='123',CompanyCode='0001'`,
						itemIndex: context.itemIndex,
					},
				);

			case 401:
				throw new NodeOperationError(
					node,
					ERROR_MESSAGES.AUTH_FAILED,
					{
						description: `${description}\n\nAuthentication failed. Check:\n- Username and password are correct\n- User account is not locked in SAP\n- SAP Client (Mandant) is correct\n- User has proper authorization for this service\n\nTest credentials in SAP Logon to verify access.`,
						itemIndex: context.itemIndex,
					},
				);

			case 403:
				throw new NodeOperationError(
					node,
					'Access Forbidden - Missing SAP Authorizations',
					{
						description: `${description}\n\nYour SAP user does not have permission to access this resource.\n\nCommon causes:\n- Missing authorization objects (S_SERVICE, S_ICF)\n- Service is not activated for your user role\n- Custom Z-services require specific custom authorizations\n\nHow to fix:\n1. Check authorization trace in SAP (transaction: ST01)\n2. Request access from SAP Administrator\n3. Verify service is activated in /IWFND/MAINT_SERVICE\n4. Test in SAP Gateway Client (/IWFND/GW_CLIENT)\n\nNote: Connection Test may succeed while data access fails if you only have metadata permissions.`,
						itemIndex: context.itemIndex,
					},
				);

			case 404:
				throw new NodeOperationError(
					node,
					'Resource Not Found',
					{
						description: `${description}\n\nThe requested resource does not exist.\n\nFor Entity Sets:\n- Verify entity set name spelling\n- Check service is deployed and active\n- Try Custom mode with exact name from /IWFND/GW_CLIENT\n\nFor Entity Keys:\n- Verify key format (e.g., ProductID='123')\n- Check if entity exists in SAP system`,
						itemIndex: context.itemIndex,
					},
				);

			case 405:
				throw new NodeOperationError(
					node,
					'HTTP Method Not Allowed',
					{
						description: `${description}\n\nThe HTTP method is not supported for this resource.\n\nFor Function Imports:\n- GET methods: Use for read-only functions\n- POST methods: Use for action functions that modify data\n- Check function definition in $metadata for allowed methods\n\nFor Entity Operations:\n- Use GET for retrieve, POST for create, PATCH for update, DELETE for delete`,
						itemIndex: context.itemIndex,
					},
				);

			case 429:
				throw new NodeOperationError(
					node,
					ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
					{
						description: `${description}\n\nToo many requests. Please wait before retrying.\n\nConsider:\n- Increasing throttle delay in Advanced Options\n- Reducing batch size for GetAll operations\n- Implementing retry logic with exponential backoff`,
						itemIndex: context.itemIndex,
					},
				);

			case 500:
				throw new NodeOperationError(
					node,
					'SAP Internal Server Error',
					{
						description: `${description}\n\nThe SAP server encountered an internal error.\n\nCheck:\n- SAP Gateway error logs (/IWFND/ERROR_LOG)\n- ABAP short dumps (transaction: ST22)\n- Gateway logs for detailed error messages\n\nThis often indicates a backend issue in SAP system.`,
						itemIndex: context.itemIndex,
					},
				);

			case 502:
				throw new NodeOperationError(
					node,
					'Bad Gateway',
					{
						description: `${description}\n\nSAP Gateway could not reach the backend system.\n\nCheck:\n- Backend connection in SAP Gateway (transaction: /IWFND/GW_CLIENT)\n- RFC destinations are configured correctly\n- Backend system is running and accessible`,
						itemIndex: context.itemIndex,
					},
				);

			case 503:
			case 504:
				throw new NodeOperationError(
					node,
					'Service Temporarily Unavailable',
					{
						description: `${description}\n\nThe SAP service is temporarily unavailable or timed out.\n\nConsider:\n- Retrying the request after a delay\n- Checking SAP system availability\n- Increasing timeout in Advanced Options\n- For large datasets, use smaller batch sizes`,
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
