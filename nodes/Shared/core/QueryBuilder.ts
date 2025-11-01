/**
 * QueryBuilder - OData Query Construction
 * Handles building and normalizing OData query parameters
 */

import { IDataObject } from 'n8n-workflow';
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
export function buildODataFilter(filters: IDataObject): string {
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
				throw new Error(
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
export function normalizeODataOptions(options: any): IODataQueryOptions {
	const normalized: any = {};

	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined && value !== null && value !== '') {
			// Add $ prefix if not present for standard OData parameters
			const normalizedKey = key.startsWith('$') ? key : `$${key}`;
			normalized[normalizedKey] = value;
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
// eslint-disable-next-line no-useless-escape
export function buildODataQuery(options: IODataQueryOptions): IDataObject {
	// Normalize options to ensure $ prefix
	const normalizedOptions = normalizeODataOptions(options);
	const query: IDataObject = {};

	if (normalizedOptions.$filter) {
		// Validate filter for security (prevent XSS/injection)
		// Note: We create a minimal node object for validation since we don't have access to this context
		const dummyNode = { name: 'SAP OData', type: 'n8n-nodes-sap-odata.sapOData', typeVersion: 1, position: [0, 0] };
		validateODataFilter(normalizedOptions.$filter as string, dummyNode as any);
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

	// eslint-disable-next-line no-useless-escape
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
 * Parse OData $metadata XML to extract FunctionImport names
 *
 * @param metadataXml - Raw XML string from $metadata endpoint
 * @returns Sorted array of FunctionImport names
 *
 * @example
 * parseMetadataForFunctionImports(xml)
 * // Returns: ['GetSalesOrder', 'UpdateInventory']
 */
export function parseMetadataForFunctionImports(metadataXml: string): string[] {
	const functionImports: string[] = [];

	// Matches: <FunctionImport Name="GetSalesOrder" ...>
	const functionImportRegex = /<FunctionImport\s+Name="([^"]+)"/g;
	let match;

	while ((match = functionImportRegex.exec(metadataXml)) !== null) {
		functionImports.push(match[1]);
	}

	return functionImports.sort();
}
