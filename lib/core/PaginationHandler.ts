/**
 * PaginationHandler - OData Pagination Support
 * Handles automatic pagination for large result sets with streaming support
 */

import { IDataObject } from 'n8n-workflow';
import { sanitizeErrorMessage } from '../utils/SecurityUtils';

const MAX_PAGES = 1000;

/**
 * Result from paginated request
 */
export interface IPaginationResult {
	data: IDataObject[];
	partial?: boolean;
	limitReached?: boolean;
	errors?: Array<{
		page: number;
		error: string;
		itemsFetchedSoFar: number;
	}>;
	message?: string;
}

/**
 * Configuration for pagination
 */
export interface IPaginationConfig {
	propertyName?: string;
	continueOnFail?: boolean;
	maxItems?: number;
}

/**
 * Extract items from OData response
 * Supports both OData V2 (d.results) and V4 (value) formats
 *
 * @param responseData - Raw response from OData API
 * @param propertyName - Optional property name containing the data
 * @returns Array of items from the response
 */
export function extractItemsFromResponse(responseData: Record<string, unknown>, propertyName?: string): IDataObject[] {
	let items: IDataObject[] = [];

	if (propertyName && responseData[propertyName]) {
		// Use specified property name
		items = Array.isArray(responseData[propertyName])
			? responseData[propertyName] as IDataObject[]
			: [responseData[propertyName] as IDataObject];
	} else if ((responseData.d as Record<string, unknown>)?.results) {
		// OData V2 format
		items = (responseData.d as Record<string, unknown>).results as IDataObject[];
	} else if (responseData.value) {
		// OData V4 format
		items = responseData.value as IDataObject[];
	} else if (responseData.d) {
		// Single item in OData V2 format
		items = [responseData.d as IDataObject];
	} else {
		// Raw response
		items = Array.isArray(responseData) ? responseData : [responseData as IDataObject];
	}

	return items;
}

/**
 * Extract next page link from OData response
 * Supports both OData V2 (__next) and V4 (@odata.nextLink)
 *
 * @param responseData - Raw response from OData API
 * @returns Next page URL or undefined if no more pages
 */
export function extractNextLink(responseData: Record<string, unknown>): string | undefined {
	if ((responseData.d as Record<string, unknown>)?.__next) {
		return (responseData.d as Record<string, unknown>).__next as string;
	} else if (responseData['@odata.nextLink']) {
		return responseData['@odata.nextLink'] as string;
	}
	return undefined;
}

/**
 * Fetch all items with automatic pagination
 * Handles both OData V2 and V4 pagination formats
 *
 * @param requestFunction - Async function that makes the API request
 * @param config - Pagination configuration
 * @returns All items or pagination result with metadata
 *
 * @example
 * const result = await fetchAllItems(
 *   async (query) => sapOdataApiRequest.call(this, 'GET', 'ProductSet', {}, query),
 *   { maxItems: 100, continueOnFail: true }
 * );
 */
export async function fetchAllItems(
	requestFunction: (query?: IDataObject, uri?: string) => Promise<Record<string, unknown>>,
	config: IPaginationConfig = {},
): Promise<IDataObject[] | IPaginationResult> {
	const {
		propertyName,
		continueOnFail = false,
		maxItems = 0,
	} = config;

	const returnData: IDataObject[] = [];
	const errors: Array<{ page: number; error: string; itemsFetchedSoFar: number }> = [];

	let nextLink: string | undefined;
	let pageNumber = 1;
	let maxItemsReached = false;
	let hasMoreData = true;  // Flag to control pagination loop

	while (hasMoreData) {
		try {
			// Use nextLink if available, otherwise use caller's query as-is
			const responseData = nextLink
				? await requestFunction(undefined, nextLink)
				: await requestFunction();

			// Extract items from response
			const items = extractItemsFromResponse(responseData, propertyName);

			// Check if adding all items would exceed maxItems limit
			if (maxItems > 0 && returnData.length + items.length > maxItems) {
				// Only add items up to the limit
				const itemsToAdd = maxItems - returnData.length;
				returnData.push(...items.slice(0, itemsToAdd));
				maxItemsReached = true;
				break;
			}

			returnData.push(...items);

			// Get next page link
			nextLink = extractNextLink(responseData);

			if (nextLink) {
				pageNumber++;
			} else {
				hasMoreData = false;
			}

			if (pageNumber >= MAX_PAGES) {
				break;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const sanitizedMessage = sanitizeErrorMessage(errorMessage);
			const paginationError = {
				page: pageNumber,
				error: sanitizedMessage,
				itemsFetchedSoFar: returnData.length,
			};

			if (continueOnFail) {
				// Collect error and continue with partial results
				errors.push(paginationError);
				// Stop pagination on error
				hasMoreData = false;
			} else {
				// Re-throw error if not continuing on fail
				throw error;
			}
		}
	}

	// Return data with metadata if special conditions occurred
	if ((continueOnFail && errors.length > 0) || maxItemsReached) {
		const result: IPaginationResult = {
			data: returnData,
			partial: false,
			message: '',
		};

		if (continueOnFail && errors.length > 0) {
			result.errors = errors;
			result.partial = true;
			result.message = `Fetched ${returnData.length} items before encountering ${errors.length} error(s)`;
		}

		if (maxItemsReached) {
			result.partial = true;
			result.limitReached = true;
			result.message = result.message
				? `${result.message}. Max items limit (${maxItems}) reached.`
				: `Fetched ${returnData.length} items. Max items limit (${maxItems}) reached - more data may be available.`;
		}

		return result;
	}

	return returnData;
}

/**
 * Async generator for streaming paginated results
 * Yields items as they are fetched, reducing memory usage for large datasets
 *
 * @param requestFunction - Async function that makes the API request
 * @param config - Pagination configuration
 * @yields Individual items from each page
 *
 * @example
 * for await (const item of streamAllItems(requestFn, { maxItems: 1000 })) {
 *   // Process item immediately without loading all into memory
 *   await processItem(item);
 * }
 */
export async function* streamAllItems(
	requestFunction: (query?: IDataObject, uri?: string) => Promise<Record<string, unknown>>,
	config: IPaginationConfig = {},
): AsyncGenerator<IDataObject, void, undefined> {
	const {
		propertyName,
		maxItems = 0,
	} = config;

	let nextLink: string | undefined;
	let pageNumber = 1;
	let itemCount = 0;
	let hasMoreData = true;  // Flag to control pagination loop

	while (hasMoreData) {
		// Use nextLink if available, otherwise use caller's query as-is
		const responseData = nextLink
			? await requestFunction(undefined, nextLink)
			: await requestFunction();

		// Extract items from response
		const items = extractItemsFromResponse(responseData, propertyName);

		// Yield items one by one
		for (const item of items) {
			if (maxItems > 0 && itemCount >= maxItems) {
				return; // Stop streaming - max items limit reached
			}
			yield item;
			itemCount++;
		}

		// Get next page link
		nextLink = extractNextLink(responseData);

		if (nextLink) {
			pageNumber++;
		} else {
			hasMoreData = false;
		}

		if (pageNumber >= MAX_PAGES) {
			return;
		}
	}
}
