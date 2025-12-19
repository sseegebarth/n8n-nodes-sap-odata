/**
 * StrategyHelpers - Helper functions for OData Strategy execution
 *
 * Provides reusable helper methods for strategy classes that execute
 * OData operations. These helpers extract parameters, validate input,
 * format responses, and handle errors in a consistent way.
 *
 * @module StrategyHelpers
 */

import {
	IExecuteFunctions,
	IDataObject,
	INode,
	NodeApiError,
	NodeOperationError,
	INodeExecutionData,
} from 'n8n-workflow';
import { buildODataQuery } from '../core/QueryBuilder';
import { IODataQueryOptions } from '../types';
import { Logger } from './Logger';
import { sanitizeErrorMessage } from './SecurityUtils';
import { convertDataTypes } from './TypeConverter';

/**
 * Entity Set Resource Locator value structure
 */
interface IResourceLocatorValue {
	mode: string;
	value: string;
	__rl?: boolean;
}

/**
 * Get entity set name from node parameters with validation
 * Supports resourceLocator type (list, name, url modes)
 *
 * @param context - Execution context
 * @param itemIndex - Current item index
 * @returns Validated entity set name
 * @throws NodeOperationError if entity set is invalid
 */
export function getEntitySet(context: IExecuteFunctions, itemIndex: number): string {
	// Get the resourceLocator value
	const entitySetParam = context.getNodeParameter('entitySet', itemIndex) as string | IResourceLocatorValue;

	let entitySet: string;

	// Handle resourceLocator format: { mode: 'list'|'name'|'url', value: 'EntitySetName' }
	if (typeof entitySetParam === 'object' && entitySetParam !== null) {
		entitySet = entitySetParam.value || '';
	} else {
		// Direct string value (for backwards compatibility)
		entitySet = entitySetParam as string;
	}

	// Validate entity set name for security
	const { validateEntitySetName } = require('./SecurityUtils');
	return validateEntitySetName(entitySet, context.getNode());
}

/**
 * Get service path from node parameters
 * Supports both list mode and custom mode
 *
 * @param context - Execution context
 * @param itemIndex - Current item index
 * @returns Service path
 */
export function getServicePath(context: IExecuteFunctions, itemIndex: number): string {
	const mode = context.getNodeParameter('servicePathMode', itemIndex, 'discover') as string;

	if (mode === 'discover') {
		// Get from auto-discovered services
		return context.getNodeParameter('discoveredService', itemIndex, '/sap/opu/odata/sap/') as string;
	} else {
		// Get custom path
		return context.getNodeParameter('servicePath', itemIndex, '/sap/opu/odata/sap/') as string;
	}
}

/**
 * Validate and parse JSON input
 */
export function validateAndParseJson(
	input: string,
	fieldName: string,
	node: INode,
): IDataObject | IDataObject[] {
	if (!input || input.trim() === '') {
		throw new NodeOperationError(
			node,
			`${fieldName} cannot be empty`
		);
	}

	// Use SecurityUtils for comprehensive validation including prototype pollution checks
	const { validateJsonInput } = require('./SecurityUtils');
	return validateJsonInput(input, fieldName, node) as IDataObject | IDataObject[];
}

/**
 * Validate and format entity key
 * Handles both simple keys ('123') and composite keys (Key1='val1',Key2='val2')
 * Includes special handling for GUIDs and numeric keys
 *
 * @param key - Raw entity key (string or object for composite keys)
 * @param node - Node instance for error context
 * @returns Formatted and validated key
 * @throws NodeOperationError if key is invalid
 */
export function validateAndFormatKey(
	key: string | IDataObject,
	node: INode,
): string {
	if (!key) {
		throw new NodeOperationError(node, 'Entity key is required');
	}

	// If it's an object, build composite key
	if (typeof key !== 'string') {
	// HACK: GUIDs must be checked before numeric - learned this the hard way!
		const keyParts = Object.entries(key).map(([k, v]) => {
			if (typeof v === 'string') {
				return `${k}='${v}'`;
			}
			return `${k}=${v}`;
		});

		if (keyParts.length === 0) {
			throw new NodeOperationError(node, 'Entity key object cannot be empty');
		}

		return keyParts.join(',');
	}

	// String key - validate and format
	const { validateEntityKey } = require('./SecurityUtils');
	const validated = validateEntityKey(key, node);

	// Add quotes around simple keys if not already formatted, except for numeric and GUID keys
	if (validated.includes('=')) {
		return validated; // Composite key, already formatted
	}

	// FIXME: GUID check MUST come before numeric - learned this the hard way!
	// SAP loves to use GUIDs starting with digits (005056A0-60A0-1EEF-...)
	if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validated)) {
		return `guid'${validated}'`;
	}

	// Numeric keys don't need quotes
	if (/^\d+(\.\d+)?$/.test(validated)) {
		return validated;
	}

	// String key, add quotes
	return `'${validated}'`;
}

/**
 * Convert SAP types to JS native types (dates, numbers etc) and strip OData junk
 */
export function applyTypeConversion(
	data: IDataObject | IDataObject[],
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject | IDataObject[] {
	try {
		const opts = context.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;

		let result: unknown = data;

		// Most users want type conversion - enabled by default
		if (opts.convertDataTypes !== false) {
			result = convertDataTypes(result);
		}

		// Also strip __metadata and other OData noise
		if (opts.removeMetadata !== false) {
			const { removeMetadata } = require('./TypeConverter');
			result = removeMetadata(result);
		}

		return result as IDataObject | IDataObject[];
	} catch {
		// If advanced options not available, return data unchanged
		return data;
	}
}

/**
 * Format success response
 */
export function formatSuccessResponse(
	data: IDataObject | IDataObject[],
	operation: string,
): INodeExecutionData[] {
	const items = Array.isArray(data) ? data : [data];

	return items.map(item => ({
		json: {
			...item,
			__operation: operation,
			__success: true,
		},
		pairedItem: { item: 0 },
	}));
}

/**
 * Handle operation error
 */
export function handleOperationError(
	error: unknown,
	context: IExecuteFunctions,
	itemIndex: number,
	continueOnFail: boolean,
): INodeExecutionData[] {
	const node = context.getNode();

	const errorMessage = sanitizeErrorMessage(
		error instanceof Error ? error.message : String(error)
	);

	// TODO: Should we preserve HTTP status codes and SAP messages here?
	// Currently stripping too much error context

	Logger.error('Operation failed', undefined, {
		module: 'StrategyHelpers',
		error: errorMessage,
		itemIndex,
	});

	if (continueOnFail) {
		return [{
			json: {
				error: errorMessage,
				__success: false,
			},
			pairedItem: { item: itemIndex },
		}];
	}

	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		throw error;
	}

	throw new NodeOperationError(
		node,
		`Operation failed: ${errorMessage}`,
		{ itemIndex }
	);
}

/**
 * Build OData resource path
 */
export function buildResourcePath(
	entitySet: string,
	entityKey?: string,
	navigationProperty?: string,
): string {
	let path = `/${entitySet}`;

	if (entityKey) {
		path += `(${entityKey})`;
	}

	if (navigationProperty) {
		path += `/${navigationProperty}`;
	}

	return path;
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
export function extractResult(response: IDataObject): IDataObject | IDataObject[] {
	// Handle array responses (direct array return from some function imports)
	if (Array.isArray(response)) {
		return response;
	}

	if (typeof response !== 'object' || response === null) {
		return response as IDataObject;
	}

	const responseObj = response as Record<string, unknown>;

	// OData V4: Check for 'value' property (collection response)
	// This is common for function imports that return collections in V4
	if (responseObj.value !== undefined) {
		// If value is an array, return it directly
		if (Array.isArray(responseObj.value)) {
			return responseObj.value as IDataObject[];
		}
		// If value is a single item, return as-is
		return responseObj.value as IDataObject;
	}

	// OData V2: Check for 'd.results' (collection response)
	if (responseObj.d && typeof responseObj.d === 'object') {
		const dObj = responseObj.d as Record<string, unknown>;
		if (dObj.results) {
			return dObj.results as IDataObject[];
		}
		// OData V2: Single entity response
		return responseObj.d as IDataObject;
	}

	// Fallback: Return response as-is (handles direct value responses)
	return response;
}

/**
 * Build OData query params ($select, $filter, $expand etc)
 */
export function getQueryOptions(
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject {
	const options = context.getNodeParameter('options', itemIndex, {}) as IODataQueryOptions;

	// Old approach - kept for reference if QueryBuilder breaks
	// const qs: IDataObject = {};
	// if (options.select) qs.$select = options.select;
	// if (options.filter) qs.$filter = options.filter;
	// return qs;

	return buildODataQuery(options);
}

/**
 * Validate navigation properties structure
 */
export function validateNavigationProperties(
	navProperties: Record<string, IDataObject | IDataObject[]>,
	node: INode,
): void {
	Object.entries(navProperties).forEach(([navProp, value]) => {
		// Validate navigation property name
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(navProp)) {
			throw new NodeOperationError(
				node,
				`Invalid navigation property name: ${navProp}. ` +
				`Must start with letter/underscore and contain only alphanumeric characters.`
			);
		}

		// Validate value is object or array of objects
		if (Array.isArray(value)) {
			if (value.some(item => typeof item !== 'object' || item === null)) {
				throw new NodeOperationError(
					node,
					`Navigation property '${navProp}' array must contain only objects`
				);
			}
		} else if (typeof value !== 'object' || value === null) {
			throw new NodeOperationError(
				node,
				`Navigation property '${navProp}' must be an object or array of objects`
			);
		}
	});
}

/**
 * Function parameter types supported by SAP OData
 */
export enum FunctionParameterType {
	String = 'Edm.String',
	Int32 = 'Edm.Int32',
	Int64 = 'Edm.Int64',
	Decimal = 'Edm.Decimal',
	Boolean = 'Edm.Boolean',
	DateTime = 'Edm.DateTime',
	DateTimeOffset = 'Edm.DateTimeOffset',
	Guid = 'Edm.Guid',
	Binary = 'Edm.Binary',
}

/**
 * Parse parameter type string to enum
 */
export function parseParameterType(typeStr: string, node: INode): FunctionParameterType {
	const typeMap: Record<string, FunctionParameterType> = {
		'String': FunctionParameterType.String,
		'Edm.String': FunctionParameterType.String,
		'Int32': FunctionParameterType.Int32,
		'Edm.Int32': FunctionParameterType.Int32,
		'Int64': FunctionParameterType.Int64,
		'Edm.Int64': FunctionParameterType.Int64,
		'Decimal': FunctionParameterType.Decimal,
		'Edm.Decimal': FunctionParameterType.Decimal,
		'Boolean': FunctionParameterType.Boolean,
		'Edm.Boolean': FunctionParameterType.Boolean,
		'DateTime': FunctionParameterType.DateTime,
		'Edm.DateTime': FunctionParameterType.DateTime,
		'DateTimeOffset': FunctionParameterType.DateTimeOffset,
		'Edm.DateTimeOffset': FunctionParameterType.DateTimeOffset,
		'Guid': FunctionParameterType.Guid,
		'Edm.Guid': FunctionParameterType.Guid,
		'Binary': FunctionParameterType.Binary,
		'Edm.Binary': FunctionParameterType.Binary,
	};

	const type = typeMap[typeStr];
	if (!type) {
		throw new NodeOperationError(
			node,
			`Unknown parameter type: ${typeStr}. ` +
			`Supported types: ${Object.keys(typeMap).join(', ')}`
		);
	}

	return type;
}
