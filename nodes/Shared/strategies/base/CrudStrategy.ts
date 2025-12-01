/**
 * CrudStrategy - Enhanced Base Class for CRUD Operations
 * Provides common validation, error handling, and response formatting
 *
 * NOTE: This class now delegates to StrategyHelpers for most functionality.
 * Direct usage of StrategyHelpers is recommended for new code.
 * This class is maintained for backward compatibility.
 */

import { IExecuteFunctions, INode, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { Logger } from '../../utils/Logger';
import { sanitizeErrorMessage } from '../../utils/SecurityUtils';
import * as StrategyHelpers from '../../utils/StrategyHelpers';

/**
 * Base class for CRUD operation strategies
 * Extends BaseEntityStrategy with additional error handling and validation
 */
export abstract class CrudStrategy {
	/**
	 * Get service path from node parameters
	 * Supports both list mode and custom mode
	 *
	 * @param context - Execution context
	 * @param itemIndex - Current item index
	 * @returns Service path
	 * @deprecated Use StrategyHelpers.getServicePath() directly
	 */
	protected getServicePath(context: IExecuteFunctions, itemIndex: number): string {
		return StrategyHelpers.getServicePath(context, itemIndex);
	}

	/**
	 * Get entity set name from node parameters with validation
	 * Supports both list mode and custom mode
	 *
	 * @param context - Execution context
	 * @param itemIndex - Current item index
	 * @returns Validated entity set name
	 * @throws NodeOperationError if entity set is invalid
	 * @deprecated Use StrategyHelpers.getEntitySet() directly
	 */
	protected getEntitySet(context: IExecuteFunctions, itemIndex: number): string {
		return StrategyHelpers.getEntitySet(context, itemIndex);
	}

	/**
	 * Validate and format entity key
	 * Handles both simple keys ('123') and composite keys (Key1='val1',Key2='val2')
	 *
	 * @param key - Raw entity key
	 * @param node - Node instance for error context
	 * @returns Formatted and validated key
	 * @throws NodeOperationError if key is invalid
	 * @deprecated Use StrategyHelpers.validateAndFormatKey() directly
	 */
	protected validateAndFormatKey(key: string, node: INode): string {
		return StrategyHelpers.validateAndFormatKey(key, node);
	}

	/**
	 * Get and build query options from node parameters
	 *
	 * @param context - Execution context
	 * @param itemIndex - Current item index
	 * @returns Built OData query parameters
	 * @deprecated Use StrategyHelpers.getQueryOptions() directly
	 */
	protected getQueryOptions(context: IExecuteFunctions, itemIndex: number): IDataObject {
		return StrategyHelpers.getQueryOptions(context, itemIndex);
	}

	/**
	 * Extract result from OData response
	 * Handles both V2 (d.results / d) and V4 (value) formats
	 *
	 * @param response - Raw OData response
	 * @returns Extracted data
	 * @deprecated Use StrategyHelpers.extractResult() directly
	 */
	protected extractResult(response: unknown): unknown {
		return StrategyHelpers.extractResult(response as IDataObject);
	}

	/**
	 * Validate and parse JSON input with detailed error messages
	 *
	 * @param dataString - JSON string to parse
	 * @param fieldName - Name of the field (for error messages)
	 * @param node - Node instance for error context
	 * @returns Parsed JSON object
	 * @throws NodeOperationError if JSON is invalid
	 * @deprecated Use StrategyHelpers.validateAndParseJson() directly
	 */
	protected validateAndParseJson(dataString: string, fieldName: string, node: INode): IDataObject {
		return StrategyHelpers.validateAndParseJson(dataString, fieldName, node) as IDataObject;
	}

	/**
	 * Format successful response as node execution data
	 *
	 * @param data - Response data to format
	 * @param itemIndex - Current item index for pairing (backward compatibility)
	 * @returns Formatted node execution data
	 * @deprecated Signature differs from StrategyHelpers. Consider using StrategyHelpers.formatSuccessResponse() with operation string
	 */
	protected formatSuccessResponse(data: unknown, itemIndex: number): INodeExecutionData[] {
		// Keep backward compatible implementation for strategies using itemIndex
		const jsonData: IDataObject = (typeof data === 'object' && data !== null)
			? data as IDataObject
			: { value: data as string | number | boolean };
		return [
			{
				json: jsonData,
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
	 * @deprecated Signature differs from StrategyHelpers. Keep for backward compatibility.
	 */
	protected handleOperationError(
		error: Error,
		operation: string,
		itemIndex: number,
		continueOnFail = false,
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
	 * @deprecated Use StrategyHelpers.buildResourcePath() directly (supports navigationProperty parameter)
	 */
	protected buildResourcePath(entitySet: string, entityKey?: string): string {
		return StrategyHelpers.buildResourcePath(entitySet, entityKey);
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

	/**
	 * Apply data type conversion if enabled
	 * Converts SAP-specific types (dates, numeric strings) to JavaScript native types
	 *
	 * @param context - Execution context
	 * @param itemIndex - Current item index
	 * @param data - Data to convert
	 * @returns Converted data (or original if conversion disabled)
	 * @deprecated Use StrategyHelpers.applyTypeConversion() directly (note parameter order: data, context, itemIndex)
	 */
	protected applyTypeConversion(
		context: IExecuteFunctions,
		itemIndex: number,
		data: unknown,
	): unknown {
		// Delegate to StrategyHelpers with correct parameter order
		return StrategyHelpers.applyTypeConversion(
			data as IDataObject | IDataObject[],
			context,
			itemIndex
		);
	}
}
