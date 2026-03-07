/**
 * QueryBuilder - OData Query Construction
 * Handles building and normalizing OData query parameters
 */

import { IDataObject, INode, NodeOperationError } from 'n8n-workflow';
import { IODataQueryOptions } from '../types';
import { validateODataFilter } from '../utils/SecurityUtils';

/**
 * Escape single quotes in OData filter values
 * OData spec: Single quotes must be escaped by doubling them
 */
export function escapeODataString(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Build OData filter string with proper escaping and type validation
 *
 * @param filters - Object with field-value pairs to filter
 * @returns OData filter string (e.g., "Name eq 'John' and Age eq 25")
 * @throws Error if filter contains unsupported types (objects/arrays)
 *
 * @example
 * buildODataFilter({ Name: 'John', Age: 25 })
 * // Returns: "Name eq 'John' and Age eq 25"
 *
 * buildODataFilter({ Name: "O'Brien" })
 * // Returns: "Name eq 'O''Brien'" (escaped quote)
 */
export function buildODataFilter(filters: IDataObject, node: INode): string {
	const filterParts: string[] = [];

	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== null && value !== '') {
			if (typeof value === 'string') {
				// Escape single quotes according to OData spec
				const escapedValue = escapeODataString(value);
				filterParts.push(`${key} eq '${escapedValue}'`);
			} else if (typeof value === 'number') {
				filterParts.push(`${key} eq ${value}`);
			} else if (typeof value === 'boolean') {
				filterParts.push(`${key} eq ${value}`);
			} else if (typeof value === 'object') {
				// Reject complex objects/arrays - they cannot be used in OData filters
				throw new NodeOperationError(
					node,
					`Invalid filter value type for key '${key}': Objects and arrays are not supported in OData filters. Use primitive values (string, number, boolean) only.`,
				);
			}
		}
	}

	return filterParts.join(' and ');
}

/**
 * Normalize OData query options to support both $ prefix and non-prefix keys
 * UI uses 'filter', 'select' etc. but OData spec requires '$filter', '$select'
 *
 * @param options - Query options with or without $ prefix
 * @returns Normalized options with $ prefix
 * @private
 */
const ODATA_PARAMS = new Set(['filter', 'select', 'expand', 'orderby', 'top', 'skip', 'count', 'search', 'apply', 'format', 'inlinecount', 'skiptoken']);

export function normalizeODataOptions(options: any): IODataQueryOptions {
	const normalized: any = {};

	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined && value !== null && value !== '') {
			if (key.startsWith('$')) {
				normalized[key] = value;
			} else if (ODATA_PARAMS.has(key.toLowerCase())) {
				normalized[`$${key}`] = value;
			}
		}
	}

	return normalized as IODataQueryOptions;
}

/**
 * Build OData query parameters with security validation
 * Supports both '$filter' and 'filter' style parameters for compatibility
 *
 * @param options - OData query options
 * @returns Query parameter object ready for HTTP request
 *
 * @example
 * buildODataQuery({
 *   $filter: "Name eq 'John'",
 *   $select: ['Name', 'Age'],
 *   $top: 10
 * })
 * // Returns: { $filter: "Name eq 'John'", $select: "Name,Age", $top: 10 }
 */
 
export function buildODataQuery(options: IODataQueryOptions, node?: INode): IDataObject {
	// Normalize options to ensure $ prefix
	const normalizedOptions = normalizeODataOptions(options);
	const query: IDataObject = {};

	if (normalizedOptions.$filter) {
		if (node) {
			validateODataFilter(normalizedOptions.$filter as string, node);
		}
		query.$filter = normalizedOptions.$filter;
	}

	if (normalizedOptions.$select) {
		query.$select = Array.isArray(normalizedOptions.$select)
			? normalizedOptions.$select.join(',')
			: normalizedOptions.$select;
	}

	if (normalizedOptions.$expand) {
		query.$expand = Array.isArray(normalizedOptions.$expand)
			? normalizedOptions.$expand.join(',')
			: normalizedOptions.$expand;
	}

	if (normalizedOptions.$orderby) {
		query.$orderby = normalizedOptions.$orderby;
	}

	if (normalizedOptions.$top) {
		query.$top = normalizedOptions.$top;
	}

	if (normalizedOptions.$skip) {
		query.$skip = normalizedOptions.$skip;
	}

	if (normalizedOptions.$count !== undefined) {
		query.$count = normalizedOptions.$count;
	}

	 
	if (normalizedOptions.$search) {
		query.$search = normalizedOptions.$search;
	}

	if (normalizedOptions.$apply) {
		query.$apply = normalizedOptions.$apply;
	}

	return query;
}

/**
 * Build URI-encoded query string from key-value pairs
 * Properly encodes both keys and values, skips empty/null/undefined values
 *
 * @param params - Object with parameter key-value pairs
 * @param separator - Separator between parameters ('&' for query string, ',' for OData path)
 * @returns URI-encoded parameter string
 *
 * @example
 * buildEncodedQueryString({ Name: "O'Brien", Age: 25 }, '&')
 * // Returns: "Name=O%27Brien&Age=25"
 *
 * buildEncodedQueryString({ ID: "'100'", Type: 'A' }, ',')
 * // Returns: "ID=%27100%27,Type=A"
 */
export function buildEncodedQueryString(
	params: Record<string, any>,
	separator = '&',
): string {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(params)) {
		// Skip empty, null, or undefined values
		if (value === undefined || value === null || value === '') {
			continue;
		}

		// URI encode both key and value
		const encodedKey = encodeURIComponent(key);
		const encodedValue = encodeURIComponent(String(value));
		parts.push(`${encodedKey}=${encodedValue}`);
	}

	return parts.join(separator);
}

/**
 * Parse OData $metadata XML to extract EntitySet names
 *
 * @param metadataXml - Raw XML string from $metadata endpoint
 * @returns Sorted array of EntitySet names
 *
 * @example
 * parseMetadataForEntitySets(xml)
 * // Returns: ['CustomerSet', 'ProductSet', 'SalesOrderSet']
 */
export function parseMetadataForEntitySets(metadataXml: string): string[] {
	const entitySets: string[] = [];

	// Simple regex-based XML parsing for EntitySet elements
	// Matches: <EntitySet Name="ProductSet" ...>
	const entitySetRegex = /<EntitySet\s+Name="([^"]+)"/g;
	let match;

	while ((match = entitySetRegex.exec(metadataXml)) !== null) {
		entitySets.push(match[1]);
	}

	return entitySets.sort();
}

/**
 * Parsed callable entry from OData $metadata
 * Covers V2 FunctionImports and V4 Actions/Functions
 */
export interface IODataCallable {
	name: string;
	type: 'FunctionImport' | 'Action' | 'Function';
}

/**
 * Parse OData $metadata XML to extract callable operations
 * Supports V2 FunctionImports and V4 Actions/Functions/ActionImports
 *
 * @param metadataXml - Raw XML string from $metadata endpoint
 * @returns Sorted array of callable entries with name and type
 */
export function parseMetadataForCallables(metadataXml: string): IODataCallable[] {
	const callables: IODataCallable[] = [];
	const seen = new Set<string>();

	// V2: <FunctionImport Name="GetSalesOrder" ...>
	const functionImportRegex = /<FunctionImport\s+[^>]*Name="([^"]+)"/g;
	let match;
	while ((match = functionImportRegex.exec(metadataXml)) !== null) {
		if (!seen.has(match[1])) {
			seen.add(match[1]);
			callables.push({ name: match[1], type: 'FunctionImport' });
		}
	}

	// V4: <Action Name="Release" ...> (not inside <FunctionImport> or <ActionImport>)
	const actionRegex = /<Action\s+[^>]*Name="([^"]+)"/g;
	while ((match = actionRegex.exec(metadataXml)) !== null) {
		if (!seen.has(match[1])) {
			seen.add(match[1]);
			callables.push({ name: match[1], type: 'Action' });
		}
	}

	// V4: <Function Name="GetPrice" ...>
	const functionRegex = /<Function\s+[^>]*Name="([^"]+)"/g;
	while ((match = functionRegex.exec(metadataXml)) !== null) {
		if (!seen.has(match[1])) {
			seen.add(match[1]);
			callables.push({ name: match[1], type: 'Function' });
		}
	}

	// V4: <ActionImport Name="DoSomething" ...>
	const actionImportRegex = /<ActionImport\s+[^>]*Name="([^"]+)"/g;
	while ((match = actionImportRegex.exec(metadataXml)) !== null) {
		if (!seen.has(match[1])) {
			seen.add(match[1]);
			callables.push({ name: match[1], type: 'Action' });
		}
	}

	return callables.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parse OData $metadata XML to extract FunctionImport names (legacy)
 * Returns flat string array for backward compatibility with cache
 */
export function parseMetadataForFunctionImports(metadataXml: string): string[] {
	return parseMetadataForCallables(metadataXml).map((c) => c.name);
}
