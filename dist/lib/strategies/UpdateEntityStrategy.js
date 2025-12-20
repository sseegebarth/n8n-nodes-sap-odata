"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEntityStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const CrudStrategy_1 = require("./base/CrudStrategy");
class UpdateEntityStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        const entitySet = this.getEntitySet(context, itemIndex);
        const entityKeyParam = context.getNodeParameter('entityKey', itemIndex);
        const entityKey = typeof entityKeyParam === 'string'
            ? entityKeyParam
            : entityKeyParam.value;
        const dataString = context.getNodeParameter('data', itemIndex);
        const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());
        const data = this.validateAndParseJson(dataString, 'Data', context.getNode());
        const options = context.getNodeParameter('options', itemIndex, {});
        const etag = options.etag;
        this.logOperation('UPDATE', {
            entitySet,
            entityKey: formattedKey,
            hasETag: !!etag,
            itemIndex,
        });
        const requestOptions = {};
        if (etag) {
            requestOptions.headers = {
                'If-Match': etag,
            };
        }
        else {
            requestOptions.headers = {
                'If-Match': '*',
            };
        }
        const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'PATCH', this.buildResourcePath(entitySet, formattedKey), data, {}, undefined, requestOptions);
        const result = this.extractResult(response) || { success: true };
        const convertedResult = this.applyTypeConversion(context, itemIndex, result);
        return this.formatSuccessResponse(convertedResult, itemIndex);
    }
}
exports.UpdateEntityStrategy = UpdateEntityStrategy;
