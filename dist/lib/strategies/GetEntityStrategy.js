"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetEntityStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const ODataVersionHelper_1 = require("../utils/ODataVersionHelper");
const CrudStrategy_1 = require("./base/CrudStrategy");
class GetEntityStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        const entitySet = this.getEntitySet(context, itemIndex);
        const odataVersion = await ODataVersionHelper_1.ODataVersionHelper.getODataVersion(context);
        const entityKeyParam = context.getNodeParameter('entityKey', itemIndex);
        const entityKey = typeof entityKeyParam === 'string'
            ? entityKeyParam
            : entityKeyParam.value;
        let formattedKey = this.validateAndFormatKey(entityKey, context.getNode());
        formattedKey = ODataVersionHelper_1.ODataVersionHelper.formatEntityKey(formattedKey, odataVersion);
        const query = this.getQueryOptions(context, itemIndex);
        this.logOperation('GET', {
            entitySet,
            entityKey: formattedKey,
            itemIndex,
        });
        const response = await GenericFunctions_1.sapOdataApiRequest.call(context, 'GET', this.buildResourcePath(entitySet, formattedKey), {}, query);
        const result = ODataVersionHelper_1.ODataVersionHelper.extractData(response, odataVersion);
        const convertedResult = this.applyTypeConversion(context, itemIndex, result);
        return this.formatSuccessResponse(convertedResult, itemIndex);
    }
}
exports.GetEntityStrategy = GetEntityStrategy;
