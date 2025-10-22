import { IExecuteFunctions, INode, IDataObject } from 'n8n-workflow';
import { validateEntityKey, validateEntitySetName } from '../SecurityUtils';
import { IODataQueryOptions } from '../types';
import { buildODataQuery } from '../GenericFunctions';

/**
 * Base class for entity operation strategies
 * Provides common functionality used by multiple strategies
 */
export abstract class BaseEntityStrategy {
	/**
	 * Get entity set name from node parameters
	 * Supports both list mode and custom mode
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
	 */
	protected validateAndFormatKey(key: string, node: INode): string {
		const validated = validateEntityKey(key, node);
		// Add quotes around simple keys if not already formatted
		return validated.includes('=') ? validated : `'${validated}'`;
	}

	/**
	 * Get and build query options
	 */
	protected getQueryOptions(
		context: IExecuteFunctions,
		itemIndex: number,
	): IDataObject {
		const options = context.getNodeParameter('options', itemIndex, {}) as IODataQueryOptions;
		return buildODataQuery(options);
	}

	/**
	 * Extract result from OData response
	 * Handles both V2 (d.results) and V4 (value) formats
	 */
	protected extractResult(response: any): any {
		return response.d || response;
	}
}
