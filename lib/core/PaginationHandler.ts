/**
 * PaginationHandler - OData Pagination Support
 * Handles automatic pagination for large result sets with streaming support
 */

import { IDataObject } from 'n8n-workflow';
import { DEFAULT_PAGE_SIZE } from '../constants';
import { Logger } from '../utils/Logger';
import { sanitizeErrorMessage } from '../utils/SecurityUtils';

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
export function extractItemsFromResponse(responseData: any, propertyName?: string): any[] {
	let items: any[] = [];

	if (propertyName && responseData[propertyName]) {
		// Use specified property name
		items = Array.isArray(responseData[propertyName])
			? responseData[propertyName]
			: [responseData[propertyName]];
	} else if (responseData.d?.results) {
		// OData V2 format
		items = responseData.d.results;
	} else if (responseData.value) {
		// OData V4 format
		items = responseData.value;
	} else if (responseData.d) {
		// Single item in OData V2 format
		items = [responseData.d];
	} else {
		// Raw response
		items = Array.isArray(responseData) ? responseData : [responseData];
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
export function extractNextLink(responseData: any): string | undefined {
	if (responseData.d?.__next) {
		return responseData.d.__next;
	} else if (responseData['@odata.nextLink']) {
		return responseData['@odata.nextLink'];
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
	requestFunction: (query?: IDataObject, uri?: string) => Promise<any>,
	config: IPaginationConfig = {},
): Promise<IDataObject[] | IPaginationResult> {
	const {
		propertyName,
		continueOnFail = false,
		maxItems = 0,
	} = config;

	const returnData: IDataObject[] = [];
	const errors: any[] = [];

	let nextLink: string | undefined;
	let pageNumber = 1;
	let maxItemsReached = false;
	let hasMoreData = true;  // Flag to control pagination loop

	// Initial query with default page size
	const initialQuery: IDataObject = { $top: DEFAULT_PAGE_SIZE };

	while (hasMoreData) {
		try {
			// Use nextLink if available, otherwise use initialQuery
			const responseData = nextLink
				? await requestFunction(undefined, nextLink)
				: await requestFunction(initialQuery);

			// Extract items from response
			const items = extractItemsFromResponse(responseData, propertyName);

			// Check if adding all items would exceed maxItems limit
			if (maxItems > 0 && returnData.length + items.length > maxItems) {
				// Only add items up to the limit
				const itemsToAdd = maxItems - returnData.length;
				returnData.push(...items.slice(0, itemsToAdd));
				maxItemsReached = true;
				Logger.info('Max items limit reached', {
					module: 'PaginationHandler',
					maxItems,
					pageNumber,
					itemsFetched: returnData.length,
				});
				break;
			}

			returnData.push(...items);

			// Get next page link
			nextLink = extractNextLink(responseData);

			if (nextLink) {
				// Server provided next link - continue with that
				pageNumber++;
			} else if (items.length === DEFAULT_PAGE_SIZE) {
				// No next link but we got a full page - try manual skip increment
				// (fallback for servers that don't provide next links)
				const currentSkip = typeof initialQuery.$skip === 'number' ? initialQuery.$skip : 0;
				initialQuery.$skip = currentSkip + items.length;
				pageNumber++;
				Logger.debug('No next link but full page - using skip pagination', {
					module: 'PaginationHandler',
					pageNumber,
					skip: initialQuery.$skip,
					itemsFetched: returnData.length,
				});
			} else {
				// No next link and partial page = end of data
				hasMoreData = false;
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
				// Log error and collect it (log original, but store sanitized in output)
				Logger.warn('Pagination error - continuing with partial results', {
					module: 'PaginationHandler',
					pageNumber,
					errorMessage: sanitizedMessage,
					itemsFetchedSoFar: returnData.length,
				});
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
	requestFunction: (query?: IDataObject, uri?: string) => Promise<any>,
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

	// Initial query with default page size
	const initialQuery: IDataObject = { $top: DEFAULT_PAGE_SIZE };

	while (hasMoreData) {
		// Use nextLink if available, otherwise use initialQuery
		const responseData = nextLink
			? await requestFunction(undefined, nextLink)
			: await requestFunction(initialQuery);

		// Extract items from response
		const items = extractItemsFromResponse(responseData, propertyName);

		// Yield items one by one
		for (const item of items) {
			if (maxItems > 0 && itemCount >= maxItems) {
				Logger.info('Max items limit reached (streaming)', {
					module: 'PaginationHandler',
					maxItems,
					pageNumber,
					itemCount,
				});
				return; // Stop streaming
			}
			yield item;
			itemCount++;
		}

		// Get next page link
		nextLink = extractNextLink(responseData);

		if (nextLink) {
			// Server provided next link - continue with that
			pageNumber++;
		} else if (items.length === DEFAULT_PAGE_SIZE) {
			// No next link but we got a full page - try manual skip increment
			const currentSkip = typeof initialQuery.$skip === 'number' ? initialQuery.$skip : 0;
			initialQuery.$skip = currentSkip + items.length;
			pageNumber++;
		} else {
			// No next link and partial page = end of data
			hasMoreData = false;
		}
	}
}
