"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMetadataStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const CrudStrategy_1 = require("./base/CrudStrategy");
class GetMetadataStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        var _a;
        try {
            const metadataType = context.getNodeParameter('metadataType', itemIndex);
            this.logOperation('GET_METADATA', {
                metadataType,
                itemIndex,
            });
            const resource = metadataType === 'metadata' ? '/$metadata' : '/';
            const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', resource, {}, {});
            let result;
            if (metadataType === 'metadata') {
                result = {
                    _type: 'metadata',
                    _format: 'xml',
                    content: typeof response === 'string' ? response : JSON.stringify(response),
                };
            }
            else {
                if ((_a = response.d) === null || _a === void 0 ? void 0 : _a.EntitySets) {
                    result = {
                        _type: 'serviceDocument',
                        _version: 'v2',
                        entitySets: response.d.EntitySets,
                    };
                }
                else if (response.value) {
                    result = {
                        _type: 'serviceDocument',
                        _version: 'v4',
                        value: response.value,
                    };
                }
                else {
                    result = {
                        _type: 'serviceDocument',
                        _raw: true,
                        ...response,
                    };
                }
            }
            return [{
                    json: result,
                    pairedItem: { item: itemIndex },
                }];
        }
        catch (error) {
            const continueOnFail = context.continueOnFail();
            return this.handleOperationError(error, 'Get Metadata', itemIndex, continueOnFail);
        }
    }
}
exports.GetMetadataStrategy = GetMetadataStrategy;
