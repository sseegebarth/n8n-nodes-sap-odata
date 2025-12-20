"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedFunctionImportStrategy = void 0;
const ApiClient_1 = require("../core/ApiClient");
const FunctionImportHelper_1 = require("../utils/FunctionImportHelper");
const Logger_1 = require("../utils/Logger");
const StrategyHelpers_1 = require("../utils/StrategyHelpers");
const CrudStrategy_1 = require("./base/CrudStrategy");
class EnhancedFunctionImportStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(itemIndex) {
        try {
            const functionName = this.getNodeParameter('functionName', itemIndex);
            const httpMethod = this.getNodeParameter('httpMethod', itemIndex, 'GET');
            const servicePath = (0, StrategyHelpers_1.getServicePath)(this, itemIndex);
            const parameterMode = this.getNodeParameter('parameterMode', itemIndex, 'simple');
            Logger_1.Logger.info('Enhanced Function Import started', {
                module: 'EnhancedFunctionImportStrategy',
                functionName,
                httpMethod,
                parameterMode,
            });
            let parameters = [];
            if (parameterMode === 'simple') {
                const paramsStr = this.getNodeParameter('parameters', itemIndex, '{}');
                const paramsObj = (0, StrategyHelpers_1.validateAndParseJson)(paramsStr, 'parameters', this.getNode());
                parameters = FunctionImportHelper_1.FunctionImportHelper.buildParametersFromObject(paramsObj);
                Logger_1.Logger.debug('Simple parameters built', {
                    module: 'EnhancedFunctionImportStrategy',
                    parameterCount: parameters.length,
                });
            }
            else {
                const paramsStr = this.getNodeParameter('typedParameters', itemIndex, '[]');
                const typedParams = (0, StrategyHelpers_1.validateAndParseJson)(paramsStr, 'typedParameters', this.getNode());
                parameters = typedParams.map(param => ({
                    name: param.name,
                    type: (0, StrategyHelpers_1.parseParameterType)(param.type, this.getNode()),
                    value: param.value,
                    nullable: param.nullable,
                }));
                Logger_1.Logger.debug('Advanced parameters built', {
                    module: 'EnhancedFunctionImportStrategy',
                    parameterCount: parameters.length,
                    types: parameters.map(p => `${p.name}:${p.type}`),
                });
            }
            const validation = FunctionImportHelper_1.FunctionImportHelper.validateParameters(parameters);
            if (!validation.valid) {
                throw new Error(`Parameter validation failed:\n${validation.errors.join('\n')}`);
            }
            const { url, body } = FunctionImportHelper_1.FunctionImportHelper.buildFunctionImportUrl(functionName, parameters, httpMethod);
            Logger_1.Logger.debug('Function import request prepared', {
                module: 'EnhancedFunctionImportStrategy',
                url,
                method: httpMethod,
                hasBody: !!body,
            });
            const response = await ApiClient_1.executeRequest.call(this, {
                method: httpMethod,
                resource: url.startsWith('/') ? url.substring(1) : url,
                body: body || {},
                servicePath,
            });
            const returnType = this.getNodeParameter('returnType', itemIndex, 'auto');
            const returnValue = returnType === 'auto'
                ? (0, StrategyHelpers_1.extractResult)(response)
                : FunctionImportHelper_1.FunctionImportHelper.extractReturnValue(response, returnType);
            const convertedResult = (0, StrategyHelpers_1.applyTypeConversion)(returnValue, this, itemIndex);
            Logger_1.Logger.info('Function import executed successfully', {
                module: 'EnhancedFunctionImportStrategy',
                functionName,
                resultType: Array.isArray(convertedResult) ? 'collection' : typeof convertedResult,
            });
            return (0, StrategyHelpers_1.formatSuccessResponse)(convertedResult, 'Enhanced Function Import');
        }
        catch (error) {
            return (0, StrategyHelpers_1.handleOperationError)(error, this, itemIndex, this.continueOnFail());
        }
    }
}
exports.EnhancedFunctionImportStrategy = EnhancedFunctionImportStrategy;
