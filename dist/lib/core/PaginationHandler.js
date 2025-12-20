"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractItemsFromResponse = extractItemsFromResponse;
exports.extractNextLink = extractNextLink;
exports.fetchAllItems = fetchAllItems;
exports.streamAllItems = streamAllItems;
const constants_1 = require("../constants");
const Logger_1 = require("../utils/Logger");
const SecurityUtils_1 = require("../utils/SecurityUtils");
function extractItemsFromResponse(responseData, propertyName) {
    var _a;
    let items = [];
    if (propertyName && responseData[propertyName]) {
        items = Array.isArray(responseData[propertyName])
            ? responseData[propertyName]
            : [responseData[propertyName]];
    }
    else if ((_a = responseData.d) === null || _a === void 0 ? void 0 : _a.results) {
        items = responseData.d.results;
    }
    else if (responseData.value) {
        items = responseData.value;
    }
    else if (responseData.d) {
        items = [responseData.d];
    }
    else {
        items = Array.isArray(responseData) ? responseData : [responseData];
    }
    return items;
}
function extractNextLink(responseData) {
    var _a;
    if ((_a = responseData.d) === null || _a === void 0 ? void 0 : _a.__next) {
        return responseData.d.__next;
    }
    else if (responseData['@odata.nextLink']) {
        return responseData['@odata.nextLink'];
    }
    return undefined;
}
async function fetchAllItems(requestFunction, config = {}) {
    const { propertyName, continueOnFail = false, maxItems = 0, } = config;
    const returnData = [];
    const errors = [];
    let nextLink;
    let pageNumber = 1;
    let maxItemsReached = false;
    const initialQuery = { $top: constants_1.DEFAULT_PAGE_SIZE };
    do {
        try {
            const responseData = nextLink
                ? await requestFunction(undefined, nextLink)
                : await requestFunction(initialQuery);
            const items = extractItemsFromResponse(responseData, propertyName);
            if (maxItems > 0 && returnData.length + items.length > maxItems) {
                const itemsToAdd = maxItems - returnData.length;
                returnData.push(...items.slice(0, itemsToAdd));
                maxItemsReached = true;
                Logger_1.Logger.info('Max items limit reached', {
                    module: 'PaginationHandler',
                    maxItems,
                    pageNumber,
                    itemsFetched: returnData.length,
                });
                break;
            }
            returnData.push(...items);
            nextLink = extractNextLink(responseData);
            if (!nextLink && items.length === initialQuery.$top) {
                const currentSkip = typeof initialQuery.$skip === 'number' ? initialQuery.$skip : 0;
                initialQuery.$skip = currentSkip + items.length;
            }
            else if (!nextLink) {
                break;
            }
            pageNumber++;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const sanitizedMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(errorMessage);
            const paginationError = {
                page: pageNumber,
                error: sanitizedMessage,
                itemsFetchedSoFar: returnData.length,
            };
            if (continueOnFail) {
                Logger_1.Logger.warn('Pagination error - continuing with partial results', {
                    module: 'PaginationHandler',
                    pageNumber,
                    errorMessage: sanitizedMessage,
                    itemsFetchedSoFar: returnData.length,
                });
                errors.push(paginationError);
                break;
            }
            else {
                throw error;
            }
        }
    } while (nextLink !== undefined);
    if ((continueOnFail && errors.length > 0) || maxItemsReached) {
        const result = {
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
async function* streamAllItems(requestFunction, config = {}) {
    const { propertyName, maxItems = 0, } = config;
    let nextLink;
    let pageNumber = 1;
    let itemCount = 0;
    const initialQuery = { $top: constants_1.DEFAULT_PAGE_SIZE };
    do {
        const responseData = nextLink
            ? await requestFunction(undefined, nextLink)
            : await requestFunction(initialQuery);
        const items = extractItemsFromResponse(responseData, propertyName);
        for (const item of items) {
            if (maxItems > 0 && itemCount >= maxItems) {
                Logger_1.Logger.info('Max items limit reached (streaming)', {
                    module: 'PaginationHandler',
                    maxItems,
                    pageNumber,
                    itemCount,
                });
                return;
            }
            yield item;
            itemCount++;
        }
        nextLink = extractNextLink(responseData);
        if (!nextLink && items.length === initialQuery.$top) {
            const currentSkip = typeof initialQuery.$skip === 'number' ? initialQuery.$skip : 0;
            initialQuery.$skip = currentSkip + items.length;
        }
        else if (!nextLink) {
            break;
        }
        pageNumber++;
    } while (nextLink !== undefined);
}
