"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateEntityStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const CrudStrategy_1 = require("./base/CrudStrategy");
class CreateEntityStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        const entitySet = this.getEntitySet(context, itemIndex);
        const dataString = context.getNodeParameter('data', itemIndex);
        const data = this.validateAndParseJson(dataString, 'Data', context.getNode());
        this.logOperation('CREATE', {
            entitySet,
            itemIndex,
        });
        const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'POST', this.buildResourcePath(entitySet), data);
        const result = this.extractResult(response);
        const convertedResult = this.applyTypeConversion(context, itemIndex, result);
        return this.formatSuccessResponse(convertedResult, itemIndex);
    }
}
exports.CreateEntityStrategy = CreateEntityStrategy;
