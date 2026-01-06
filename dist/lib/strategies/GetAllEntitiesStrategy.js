"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAllEntitiesStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const ODataVersionHelper_1 = require("../utils/ODataVersionHelper");
const CrudStrategy_1 = require("./base/CrudStrategy");
class GetAllEntitiesStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        var _a, _b, _c;
        try {
            const entitySet = this.getEntitySet(context, itemIndex);
            const returnAll = context.getNodeParameter('returnAll', itemIndex);
            const odataVersion = await ODataVersionHelper_1.ODataVersionHelper.getODataVersion(context);
            let query = this.getQueryOptions(context, itemIndex);
            const hasCountOption = query.$count === true;
            if (returnAll) {
                query = ODataVersionHelper_1.ODataVersionHelper.getVersionSpecificParams(odataVersion, {
                    ...query,
                    includeCount: true,
                });
            }
            else if (hasCountOption) {
                delete query.$count;
                query = ODataVersionHelper_1.ODataVersionHelper.getVersionSpecificParams(odataVersion, {
                    ...query,
                    count: true,
                });
            }
            const options = context.getNodeParameter('options', itemIndex, {});
            if (options.batchSize) {
                query.$top = options.batchSize;
            }
            const continueOnFail = false;
            const maxItems = 0;
            this.logOperation('GET_ALL', {
                entitySet,
                returnAll,
                itemIndex,
            });
            let responseData;
            let paginationErrors;
            let limitReached = false;
            let partialMessage;
            if (returnAll) {
                const result = await GenericFunctions_1.sapOdataApiRequestAllItems.call(context, 'results', 'GET', this.buildResourcePath(entitySet), {}, query, continueOnFail, maxItems);
                if (Array.isArray(result)) {
                    responseData = result;
                }
                else {
                    responseData = result.data;
                    paginationErrors = (_a = result.errors) === null || _a === void 0 ? void 0 : _a.map((err) => ({
                        page: err.page,
                        error: err.error,
                        timestamp: new Date(),
                    }));
                    limitReached = result.limitReached === true;
                    partialMessage = result.message;
                }
            }
            else {
                if (query.$top === undefined) {
                    const limit = context.getNodeParameter('limit', itemIndex);
                    query.$top = limit;
                }
                const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', this.buildResourcePath(entitySet), {}, query);
                responseData = ODataVersionHelper_1.ODataVersionHelper.extractData(response, odataVersion);
                this.logOperation('DATA_EXTRACTED', {
                    isArray: Array.isArray(responseData),
                    itemCount: Array.isArray(responseData) ? responseData.length : 1,
                    hasD: !!(response === null || response === void 0 ? void 0 : response.d),
                    hasDResults: !!((_b = response === null || response === void 0 ? void 0 : response.d) === null || _b === void 0 ? void 0 : _b.results),
                });
            }
            let dataArray;
            if (Array.isArray(responseData)) {
                dataArray = responseData;
            }
            else if (responseData && typeof responseData === 'object') {
                if (responseData.results && Array.isArray(responseData.results)) {
                    dataArray = responseData.results;
                    this.logOperation('FALLBACK_EXTRACTION', {
                        message: 'Extracted results from wrapper object',
                        itemCount: dataArray.length,
                    });
                }
                else if (((_c = responseData.d) === null || _c === void 0 ? void 0 : _c.results) && Array.isArray(responseData.d.results)) {
                    dataArray = responseData.d.results;
                    this.logOperation('FALLBACK_EXTRACTION', {
                        message: 'Extracted results from d.results wrapper',
                        itemCount: dataArray.length,
                    });
                }
                else {
                    dataArray = [responseData];
                }
            }
            else {
                dataArray = responseData ? [responseData] : [];
            }
            const executionData = dataArray.map((item) => {
                const converted = this.applyTypeConversion(context, itemIndex, item);
                const jsonData = (typeof converted === 'object' && converted !== null)
                    ? converted
                    : { value: converted };
                return {
                    json: jsonData,
                    pairedItem: { item: itemIndex },
                };
            });
            if ((paginationErrors && paginationErrors.length > 0) || limitReached) {
                const metadata = {
                    totalItemsFetched: dataArray.length,
                    partial: true,
                    message: partialMessage || `Fetched ${dataArray.length} items`,
                };
                if (paginationErrors && paginationErrors.length > 0) {
                    metadata.paginationErrors = paginationErrors;
                }
                if (limitReached) {
                    metadata.limitReached = true;
                }
                executionData.push({
                    json: metadata,
                    pairedItem: { item: itemIndex },
                });
            }
            return executionData;
        }
        catch (error) {
            const continueOnFail = context.continueOnFail();
            return this.handleOperationError(error, 'Get All Entities', itemIndex, continueOnFail);
        }
    }
}
exports.GetAllEntitiesStrategy = GetAllEntitiesStrategy;
