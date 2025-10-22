/**
 * CrudStrategy - Enhanced Base Class for CRUD Operations
 * Provides common validation, error handling, and response formatting
 */

import { IExecuteFunctions, INode, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { validateEntityKey, validateEntitySetName, validateJsonInput, sanitizeErrorMessage } from '../../SecurityUtils';
import { IODataQueryOptions } from '../../types';
import { buildODataQuery } from '../../core/QueryBuilder';
import { Logger } from '../../Logger';

/**
 * Base class for CRUD operation strategies
 * Extends BaseEntityStrategy with additional error handling and validation
 */
export abstract class CrudStrategy {
	/**
	 * Get entity set name from node parameters with validation
	 * Supports both list mode and custom mode
	 *
	 * @param context - Execution context
	 * @param itemIndex - Current item index
	 * @returns Validated entity set name
	 * @throws NodeOperationError if entity set is invalid
	 */
	protected getEntitySet(context: IExecuteFunctions, itemIndex: number): string {
		const mode = context.getNodeParameter('entitySetMode', itemIndex, 'list') as string;
		let entitySet: string;

		if (mode === 'custom') {
			entitySet = context.getNodeParameter('customEntitySet', itemIndex) as string;
		} else {
			entitySet = context.getNodeParameter('entitySet', itemIndex) as string;
		}

		// Validate entity set name for security
		return validateEntitySetName(entitySet, context.getNode());
	}

	/**
	 * Validate and format entity key
	 * Handles both simple keys ('123') and composite keys (Key1='val1',Key2='val2')
	 *
	 * @param key - Raw entity key
	 * @param node - Node instance for error context
	 * @returns Formatted and validated key
	 * @throws NodeOperationError if key is invalid
	 */
	protected validateAndFormatKey(key: string, node: INode): string {
		const validated = validateEntityKey(key, node);
		// Add quotes around simple keys if not already formatted
		return validated.includes('=') ? validated : `'${validated}'`;
	}

	/**
	 * Get and build query options from node parameters
	 *
	 * @param context - Execution context
	 * @param itemIndex - Current item index
	 * @returns Built OData query parameters
	 */
	protected getQueryOptions(context: IExecuteFunctions, itemIndex: number): IDataObject {
		const options = context.getNodeParameter('options', itemIndex, {}) as IODataQueryOptions;
		return buildODataQuery(options);
	}

	/**
	 * Extract result from OData response
	 * Handles both V2 (d.results / d) and V4 (value) formats
	 * Specifically enhanced for Function Import responses in V4 format
	 *
	 * @param response - Raw OData response
	 * @returns Extracted data
	 *
	 * OData V2 Response Formats:
	 * - Single entity: { d: { ID: '123', Name: 'Test' } }
	 * - Collection: { d: { results: [...] } }
	 * - Function Import: { d: { results: [...] } } or { d: <single result> }
	 *
	 * OData V4 Response Formats:
	 * - Single entity: { ID: '123', Name: 'Test' }
	 * - Collection: { value: [...], @odata.count: 10 }
	 * - Function Import: { value: [...] } or direct result
	 */
	protected extractResult(response: any): any {
		// Handle array responses (direct array return from some function imports)
		if (Array.isArray(response)) {
			return response;
		}

		// OData V4: Check for 'value' property (collection response)
		// This is common for function imports that return collections in V4
		if (response.value !== undefined) {
			// If value is an array, return it directly
			if (Array.isArray(response.value)) {
				return response.value;
			}
			// If value is a single item, return as-is
			return response.value;
		}

		// OData V2: Check for 'd.results' (collection response)
		if (response.d?.results) {
			return response.d.results;
		}

		// OData V2: Check for 'd' property (single entity response)
		if (response.d) {
			return response.d;
		}

		// Fallback: Return response as-is (handles direct value responses)
		return response;
	}

	/**
	 * Validate and parse JSON input with detailed error messages
	 *
	 * @param dataString - JSON string to parse
	 * @param fieldName - Name of the field (for error messages)
	 * @param node - Node instance for error context
	 * @returns Parsed JSON object
	 * @throws NodeOperationError if JSON is invalid
	 */
	protected validateAndParseJson(dataString: string, fieldName: string, node: INode): IDataObject {
		return validateJsonInput(dataString, fieldName, node) as IDataObject;
	}

	/**
	 * Format successful response as node execution data
	 *
	 * @param data - Response data to format
	 * @param itemIndex - Current item index for pairing
	 * @returns Formatted node execution data
	 */
	protected formatSuccessResponse(data: any, itemIndex: number): INodeExecutionData[] {
		return [
			{
				json: data,
				pairedItem: { item: itemIndex },
			},
		];
	}

	/**
	 * Format error response with detailed information
	 *
	 * @param error - Error object
	 * @param operation - Operation being performed (for context)
	 * @param itemIndex - Current item index
	 * @param continueOnFail - Whether to continue on failure
	 * @returns Error formatted as execution data or throws
	 * @throws NodeOperationError if continueOnFail is false
	 */
	protected handleOperationError(
		error: Error,
		operation: string,
		itemIndex: number,
		continueOnFail: boolean = false,
	): INodeExecutionData[] {
		const errorMessage = error.message || 'Unknown error occurred';
		const sanitizedMessage = sanitizeErrorMessage(errorMessage);

		Logger.error(`${operation} failed`, error, {
			module: 'CrudStrategy',
			operation,
			itemIndex,
		});

		if (continueOnFail) {
			return [
				{
					json: {
						error: true,
						message: sanitizedMessage,
						operation,
					},
					pairedItem: { item: itemIndex },
				},
			];
		}

		throw error;
	}

	/**
	 * Build entity resource path
	 *
	 * @param entitySet - Entity set name
	 * @param entityKey - Optional entity key for single entity operations
	 * @returns Formatted resource path
	 *
	 * @example
	 * buildResourcePath('ProductSet') // '/ProductSet'
	 * buildResourcePath('ProductSet', "'123'") // '/ProductSet('123')'
	 */
	protected buildResourcePath(entitySet: string, entityKey?: string): string {
		if (entityKey) {
			return `/${entitySet}(${entityKey})`;
		}
		return `/${entitySet}`;
	}

	/**
	 * Log operation details for debugging
	 *
	 * @param operation - Operation name
	 * @param details - Additional details to log
	 */
	protected logOperation(operation: string, details: IDataObject): void {
		Logger.debug(`CRUD Operation: ${operation}`, {
			module: 'CrudStrategy',
			operation,
			...details,
		});
	}
}
