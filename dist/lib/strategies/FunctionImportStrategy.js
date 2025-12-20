"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionImportStrategy = void 0;
const GenericFunctions_1 = require("../../nodes/SapOData/GenericFunctions");
const SecurityUtils_1 = require("../utils/SecurityUtils");
const CrudStrategy_1 = require("./base/CrudStrategy");
class FunctionImportStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(context, itemIndex) {
        const mode = context.getNodeParameter('functionNameMode', itemIndex, 'list');
        let functionName = mode === 'custom'
            ? context.getNodeParameter('customFunctionName', itemIndex)
            : context.getNodeParameter('functionName', itemIndex);
        functionName = (0, SecurityUtils_1.validateFunctionName)(functionName, context.getNode());
        const parametersString = context.getNodeParameter('functionParameters', itemIndex);
        const httpMethod = context.getNodeParameter('functionHttpMethod', itemIndex, 'POST');
        const parameters = this.validateAndParseJson(parametersString, 'Parameters', context.getNode());
        const urlFormat = context.getNodeParameter('functionUrlFormat', itemIndex, 'canonical');
        let url;
        let body = {};
        if (httpMethod === 'GET') {
            if (urlFormat === 'canonical') {
                const paramParts = [];
                for (const [key, value] of Object.entries(parameters)) {
                    const formattedValue = (0, GenericFunctions_1.formatSapODataValue)(value);
                    paramParts.push(`${key}=${formattedValue}`);
                }
                url = paramParts.length > 0
                    ? `/${functionName}(${paramParts.join(',')})`
                    : `/${functionName}()`;
            }
            else {
                const queryParts = [];
                for (const [key, value] of Object.entries(parameters)) {
                    const formattedValue = (0, GenericFunctions_1.formatSapODataValue)(value);
                    const encodedKey = encodeURIComponent(key);
                    const encodedValue = encodeURIComponent(formattedValue);
                    queryParts.push(`${encodedKey}=${encodedValue}`);
                }
                url = queryParts.length > 0
                    ? `/${functionName}?${queryParts.join('&')}`
                    : `/${functionName}`;
            }
        }
        else {
            url = `/${functionName}`;
            body = parameters;
        }
        this.logOperation('FUNCTION_IMPORT', {
            functionName,
            httpMethod,
            urlFormat: httpMethod === 'GET' ? urlFormat : 'json-body',
            parametersCount: Object.keys(parameters).length,
            itemIndex,
        });
        const response = await GenericFunctions_1.sapOdataApiRequest.call(context, httpMethod, url, body);
        const result = this.extractResult(response);
        const convertedResult = this.applyTypeConversion(context, itemIndex, result);
        return this.formatSuccessResponse(convertedResult, itemIndex);
    }
}
exports.FunctionImportStrategy = FunctionImportStrategy;
