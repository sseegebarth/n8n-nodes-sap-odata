"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteEntityStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const CrudStrategy_1 = require("./base/CrudStrategy");
class DeleteEntityStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        const entitySet = this.getEntitySet(context, itemIndex);
        const entityKeyParam = context.getNodeParameter('entityKey', itemIndex);
        const entityKey = typeof entityKeyParam === 'string'
            ? entityKeyParam
            : entityKeyParam.value;
        const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());
        const options = context.getNodeParameter('options', itemIndex, {});
        const etag = options.etag;
        this.logOperation('DELETE', {
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
        await GenericFunctions_1.sapOdataApiRequest.call(context, 'DELETE', this.buildResourcePath(entitySet, formattedKey), {}, {}, undefined, requestOptions);
        return this.formatSuccessResponse({ success: true }, itemIndex);
    }
}
exports.DeleteEntityStrategy = DeleteEntityStrategy;
