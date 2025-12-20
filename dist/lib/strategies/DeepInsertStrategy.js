"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepInsertStrategy = void 0;
const ApiClient_1 = require("../core/ApiClient");
const Logger_1 = require("../utils/Logger");
const NavigationPropertyHelper_1 = require("../utils/NavigationPropertyHelper");
const StrategyHelpers_1 = require("../utils/StrategyHelpers");
const CrudStrategy_1 = require("./base/CrudStrategy");
class DeepInsertStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(itemIndex) {
        try {
            const entitySet = (0, StrategyHelpers_1.getEntitySet)(this, itemIndex);
            const servicePath = (0, StrategyHelpers_1.getServicePath)(this, itemIndex);
            const entityDataStr = this.getNodeParameter('entityData', itemIndex);
            const entityData = (0, StrategyHelpers_1.validateAndParseJson)(entityDataStr, 'entityData', this.getNode());
            const navPropertiesStr = this.getNodeParameter('navigationProperties', itemIndex, '{}');
            const navProperties = (0, StrategyHelpers_1.validateAndParseJson)(navPropertiesStr, 'navigationProperties', this.getNode());
            Logger_1.Logger.info('Deep Insert started', {
                module: 'DeepInsertStrategy',
                entitySet,
                navigationPropertiesCount: Object.keys(navProperties).length,
            });
            (0, StrategyHelpers_1.validateNavigationProperties)(navProperties, this.getNode());
            const deepInsertConfig = {
                entity: entityData,
                navigationProperties: navProperties,
            };
            const payload = NavigationPropertyHelper_1.NavigationPropertyHelper.buildDeepInsertPayload(deepInsertConfig);
            Logger_1.Logger.debug('Deep insert payload prepared', {
                module: 'DeepInsertStrategy',
                payloadSize: JSON.stringify(payload).length,
                navigationProperties: Object.keys(navProperties),
            });
            const response = await ApiClient_1.executeRequest.call(this, {
                method: 'POST',
                resource: `/${entitySet}`,
                body: payload,
                servicePath,
            });
            const result = (0, StrategyHelpers_1.extractResult)(response);
            const convertedResult = (0, StrategyHelpers_1.applyTypeConversion)(result, this, itemIndex);
            Logger_1.Logger.info('Deep insert successful', {
                module: 'DeepInsertStrategy',
                entitySet,
            });
            return (0, StrategyHelpers_1.formatSuccessResponse)(convertedResult, 'Deep Insert');
        }
        catch (error) {
            return (0, StrategyHelpers_1.handleOperationError)(error, this, itemIndex, this.continueOnFail());
        }
    }
}
exports.DeepInsertStrategy = DeepInsertStrategy;
