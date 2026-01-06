import { NodeApiError, NodeOperationError, INode } from 'n8n-workflow';
import { ERROR_MESSAGES } from '../constants';
import { IErrorContext } from '../types';
import { sanitizeErrorMessage } from './SecurityUtils';

interface IHttpError {
	message?: string;
	response?: {
		status?: number;
		statusCode?: number;
		data?: {
			error?: ISapError;
		};
	};
	statusCode?: number;
	error?: ISapError;
}

interface ISapError {
	code?: string;
	message?: {
		value?: string;
	} | string;
	innererror?: {
		type?: string;
		[key: string]: unknown;
	};
}

/**
 * Extended NodeOperationError with HTTP status code for continueOnFail handling
 */
interface IExtendedError extends NodeOperationError {
	httpStatusCode?: number;
	sapErrorCode?: string;
}

/**
 * Create a NodeOperationError with httpStatusCode property attached
 * This allows extracting the status code in continueOnFail mode
 */
function createErrorWithStatusCode(
	node: INode,
	message: string,
	statusCode: number | undefined,
	options: { description?: string; itemIndex?: number },
	sapErrorCode?: string,
): never {
	const error = new NodeOperationError(node, message, options) as IExtendedError;
	if (statusCode) {
		error.httpStatusCode = statusCode;
	}
	if (sapErrorCode) {
		error.sapErrorCode = sapErrorCode;
	}
	throw error;
}

/**
 * Centralized error handling for SAP OData Node
 */
export class ODataErrorHandler {
	/**
	 * Handle API errors with context
	 */
	static handleApiError(error: unknown, node: INode, context: IErrorContext = {}): never {
		const httpError = error as IHttpError;

		// Sanitize error message
		const sanitizedMessage = sanitizeErrorMessage(httpError.message || 'Unknown error');

		// Extract status code
		const statusCode = httpError.response?.status || httpError.response?.statusCode || httpError.statusCode || context.statusCode;

		// Extract SAP-specific error details
		const sapError = httpError.response?.data?.error || httpError.error;
		const sapCode = sapError?.code;
		const sapMessage = typeof sapError?.message === 'string' ? sapError.message : sapError?.message?.value;
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
				createErrorWithStatusCode(
					node,
					`SAP Function Error: ${sapMessage || 'BAPI not available'}`,
					statusCode,
					{
						description: `${description}\n\nCheck SAP Gateway transaction /IWFND/MAINT_SERVICE for available functions and their status.\n\nCommon causes:\n- Function not activated in SAP Gateway\n- Missing authorization for function module\n- Incorrect function import name`,
						itemIndex: context.itemIndex,
					},
					sapCode,
				);
			}

			// Type mismatch errors
			if (sapCode.includes('TYPE_MISMATCH') || innererror?.type === 'Type Mismatch') {
				createErrorWithStatusCode(
					node,
					`Type Mismatch: ${sapMessage}`,
					statusCode,
					{
						description: `${description}\n\nThe data type provided does not match the expected type in SAP.\n\nCommon fixes:\n- Check field types in $metadata\n- Ensure numbers are not quoted as strings\n- Verify date/time format (e.g., datetime'2024-01-15T10:30:00')\n- Check GUID format (e.g., guid'xxx-xxx-xxx')`,
						itemIndex: context.itemIndex,
					},
					sapCode,
				);
			}

			// Mandatory parameter missing
			if (innererror?.type === 'Mandatory Parameter Missing' || sapCode.includes('MANDATORY')) {
				createErrorWithStatusCode(
					node,
					`Mandatory Parameter Missing: ${sapMessage}`,
					statusCode,
					{
						description: `${description}\n\nA required field is missing from your request.\n\nCheck:\n- Review $metadata for mandatory fields (Nullable="false")\n- Ensure all key fields are provided\n- Verify entity structure matches OData service definition`,
						itemIndex: context.itemIndex,
					},
					sapCode,
				);
			}

			// Generic SAP error with code
			createErrorWithStatusCode(
				node,
				`SAP Error (${sapCode}): ${sapMessage || sanitizedMessage}`,
				statusCode,
				{
					description: `${description}\n\nThis is a SAP-specific error. Check SAP Gateway error logs:\n- Transaction: /IWFND/ERROR_LOG\n- Transaction: /IWFND/GW_CLIENT (for testing)\n\nError details may provide more context in SAP system logs.`,
					itemIndex: context.itemIndex,
				},
				sapCode,
			);
		}

		// Handle connection/network errors
		const errorMessage = sanitizedMessage.toLowerCase();
		if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
			createErrorWithStatusCode(
				node,
				'Connection Refused - Cannot reach SAP system',
				statusCode,
				{
					description: `${description}\n\nThe SAP system refused the connection.\n\nHow to fix:\n1. Verify the Host URL in your credential settings\n2. Check if SAP system is running\n3. Verify firewall allows connection to SAP port (443, 8000, 8001)\n4. If using ZATW: Ensure /sap/bc/zatw/connector/ service is active in SICF\n\nTest connectivity:\n- Try accessing the SAP URL in a browser\n- Check with your network administrator`,
					itemIndex: context.itemIndex,
				},
			);
		}

		if (errorMessage.includes('etimedout') || errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
			createErrorWithStatusCode(
				node,
				'Connection Timeout - SAP system not responding',
				statusCode,
				{
					description: `${description}\n\nThe request timed out waiting for SAP response.\n\nHow to fix:\n1. Check SAP system availability\n2. Increase timeout in Advanced Options\n3. For large data requests, reduce batch size\n4. Check network latency to SAP system\n\nIf using ZATW Connector:\n- Verify /sap/bc/zatw/connector/ service is responding\n- Check SAP ICM service status (SMICM)`,
					itemIndex: context.itemIndex,
				},
			);
		}

		if (errorMessage.includes('enotfound') || errorMessage.includes('getaddrinfo')) {
			createErrorWithStatusCode(
				node,
				'Host Not Found - Invalid SAP hostname',
				statusCode,
				{
					description: `${description}\n\nCannot resolve the SAP hostname.\n\nHow to fix:\n1. Check the Host URL in your credential settings\n2. Verify the hostname is correct and accessible\n3. Check DNS configuration\n4. Try using IP address instead of hostname`,
					itemIndex: context.itemIndex,
				},
			);
		}

		// Handle specific HTTP status codes
		switch (statusCode) {
			case 400:
				createErrorWithStatusCode(
					node,
					'Bad Request: Invalid OData syntax',
					400,
					{
						description: `${description}\n\nCommon causes:\n- Invalid $filter syntax (check quotes and operators)\n- Type mismatch in filter values\n- Malformed entity key format\n- Invalid field names in $select or $expand\n\nExample correct syntax:\n- Filter: Status eq 'A' and Amount gt 100\n- Key: ProductID='123' or ProductID='123',CompanyCode='0001'`,
						itemIndex: context.itemIndex,
					},
				);

			case 401:
				createErrorWithStatusCode(
					node,
					ERROR_MESSAGES.AUTH_FAILED,
					401,
					{
						description: `${description}\n\nAuthentication failed.\n\nHow to fix:\n1. Go to n8n Settings → Credentials\n2. Open your SAP credential and verify:\n   - Username is correct (case-sensitive)\n   - Password is correct\n   - SAP Client (Mandant) number is correct\n\n3. Test in SAP:\n   - Try logging into SAP GUI with same credentials\n   - Check if user is locked (SU01)\n   - Verify user has authorization for this service`,
						itemIndex: context.itemIndex,
					},
				);

			case 403:
				createErrorWithStatusCode(
					node,
					'Access Forbidden - Missing SAP Authorizations',
					403,
					{
						description: `${description}\n\nYour SAP user does not have permission to access this resource.\n\nCommon causes:\n- Missing authorization objects (S_SERVICE, S_ICF)\n- Service is not activated for your user role\n- Custom Z-services require specific custom authorizations\n\nHow to fix:\n1. Check authorization trace in SAP (transaction: ST01)\n2. Request access from SAP Administrator\n3. Verify service is activated in /IWFND/MAINT_SERVICE\n4. Test in SAP Gateway Client (/IWFND/GW_CLIENT)\n\nNote: Connection Test may succeed while data access fails if you only have metadata permissions.`,
						itemIndex: context.itemIndex,
					},
				);

			case 404:
				// Parse Entity-Key from Resource-Path (e.g., "ProductSet('123')" → Key: '123')
				const entityKeyMatch = context.resource?.match(/\(([^)]+)\)/);
				const entityKey = entityKeyMatch ? entityKeyMatch[1] : null;
				const entitySetMatch = context.resource?.match(/^([^(]+)/);
				const entitySetName = entitySetMatch ? entitySetMatch[1] : context.resource;

				if (entityKey) {
					// Entity with specific key not found
					createErrorWithStatusCode(
						node,
						'Entity Not Found',
						404,
						{
							description: `${description}\n\nThe entity with key ${entityKey} does not exist in ${entitySetName}.\n\nPossible causes:\n- The entity was deleted\n- The key value is incorrect\n- Key format mismatch (check quotes for string keys)\n\nVerify the entity exists in SAP system.`,
							itemIndex: context.itemIndex,
						},
					);
				}

				// Entity Set or resource not found (no key in path)
				createErrorWithStatusCode(
					node,
					'Resource Not Found',
					404,
					{
						description: `${description}\n\nThe requested resource does not exist.\n\nFor Entity Sets:\n- Verify entity set name spelling\n- Check service is deployed and active\n- Try Custom mode with exact name from /IWFND/GW_CLIENT`,
						itemIndex: context.itemIndex,
					},
				);

			case 405:
				createErrorWithStatusCode(
					node,
					'HTTP Method Not Allowed',
					405,
					{
						description: `${description}\n\nThe HTTP method is not supported for this resource.\n\nFor Function Imports:\n- GET methods: Use for read-only functions\n- POST methods: Use for action functions that modify data\n- Check function definition in $metadata for allowed methods\n\nFor Entity Operations:\n- Use GET for retrieve, POST for create, PATCH for update, DELETE for delete`,
						itemIndex: context.itemIndex,
					},
				);

			case 429:
				createErrorWithStatusCode(
					node,
					ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
					429,
					{
						description: `${description}\n\nToo many requests. Please wait before retrying.\n\nConsider:\n- Increasing throttle delay in Advanced Options\n- Reducing batch size for GetAll operations\n- Implementing retry logic with exponential backoff`,
						itemIndex: context.itemIndex,
					},
				);

			case 500:
				createErrorWithStatusCode(
					node,
					'SAP Internal Server Error',
					500,
					{
						description: `${description}\n\nThe SAP server encountered an internal error.\n\nCheck:\n- SAP Gateway error logs (/IWFND/ERROR_LOG)\n- ABAP short dumps (transaction: ST22)\n- Gateway logs for detailed error messages\n\nThis often indicates a backend issue in SAP system.`,
						itemIndex: context.itemIndex,
					},
				);

			case 502:
				createErrorWithStatusCode(
					node,
					'Bad Gateway',
					502,
					{
						description: `${description}\n\nSAP Gateway could not reach the backend system.\n\nCheck:\n- Backend connection in SAP Gateway (transaction: /IWFND/GW_CLIENT)\n- RFC destinations are configured correctly\n- Backend system is running and accessible`,
						itemIndex: context.itemIndex,
					},
				);

			case 503:
			case 504:
				createErrorWithStatusCode(
					node,
					'Service Temporarily Unavailable',
					statusCode,
					{
						description: `${description}\n\nThe SAP service is temporarily unavailable or timed out.\n\nConsider:\n- Retrying the request after a delay\n- Checking SAP system availability\n- Increasing timeout in Advanced Options\n- For large datasets, use smaller batch sizes`,
						itemIndex: context.itemIndex,
					},
				);

			default:
				// Generic error - also attach status code if available
				const apiError = new NodeApiError(
					node,
					{
						message: sanitizedMessage,
						description,
						...(typeof error === 'object' && error !== null ? error : {}),
					},
					{
						itemIndex: context.itemIndex,
					},
				);
				if (statusCode) {
					(apiError as unknown as { httpStatusCode: number }).httpStatusCode = statusCode;
				}
				throw apiError;
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
