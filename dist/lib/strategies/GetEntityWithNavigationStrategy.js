"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetEntityWithNavigationStrategy = void 0;
const ApiClient_1 = require("../core/ApiClient");
const Logger_1 = require("../utils/Logger");
const NavigationPropertyHelper_1 = require("../utils/NavigationPropertyHelper");
const StrategyHelpers_1 = require("../utils/StrategyHelpers");
const CrudStrategy_1 = require("./base/CrudStrategy");
class GetEntityWithNavigationStrategy extends CrudStrategy_1.CrudStrategy {
    async execute(itemIndex) {
        try {
            const entitySet = (0, StrategyHelpers_1.getEntitySet)(this, itemIndex);
            const entityKey = this.getNodeParameter('entityKey', itemIndex);
            const servicePath = (0, StrategyHelpers_1.getServicePath)(this, itemIndex);
            const useNavigation = this.getNodeParameter('useNavigation', itemIndex, false);
            Logger_1.Logger.debug('Get Entity with Navigation', {
                module: 'GetEntityWithNavigationStrategy',
                entitySet,
                entityKey,
                useNavigation,
            });
            const queryParams = {
                ...(0, StrategyHelpers_1.getQueryOptions)(this, itemIndex),
            };
            if (useNavigation) {
                const navigationMode = this.getNodeParameter('navigationMode', itemIndex, 'simple');
                if (navigationMode === 'simple') {
                    const expandPaths = this.getNodeParameter('expandPaths', itemIndex, '');
                    if (expandPaths) {
                        const paths = expandPaths.split(',').map(p => p.trim()).filter(p => p);
                        for (const path of paths) {
                            const validation = NavigationPropertyHelper_1.NavigationPropertyHelper.validateNavigationPath(path);
                            if (!validation.valid) {
                                throw new Error(validation.error);
                            }
                        }
                        queryParams.$expand = NavigationPropertyHelper_1.NavigationPropertyHelper.buildMultiLevelExpand(paths);
                        Logger_1.Logger.debug('Simple navigation expand', {
                            module: 'GetEntityWithNavigationStrategy',
                            paths,
                            expand: queryParams.$expand,
                        });
                    }
                }
                else if (navigationMode === 'advanced') {
                    const navConfigStr = this.getNodeParameter('navigationConfig', itemIndex, '[]');
                    const navConfigs = (0, StrategyHelpers_1.validateAndParseJson)(navConfigStr, 'navigationConfig', this.getNode());
                    if (Array.isArray(navConfigs) && navConfigs.length > 0) {
                        queryParams.$expand = NavigationPropertyHelper_1.NavigationPropertyHelper.buildExpandParameter(navConfigs);
                        Logger_1.Logger.debug('Advanced navigation expand', {
                            module: 'GetEntityWithNavigationStrategy',
                            configCount: navConfigs.length,
                            expand: queryParams.$expand,
                        });
                    }
                }
            }
            const formattedKey = (0, StrategyHelpers_1.validateAndFormatKey)(entityKey, this.getNode());
            const resource = (0, StrategyHelpers_1.buildResourcePath)(entitySet, formattedKey);
            const response = await ApiClient_1.executeRequest.call(this, {
                method: 'GET',
                resource,
                qs: queryParams,
                servicePath,
            });
            const result = (0, StrategyHelpers_1.extractResult)(response);
            const convertedResult = (0, StrategyHelpers_1.applyTypeConversion)(result, this, itemIndex);
            Logger_1.Logger.info('Entity with navigation retrieved', {
                module: 'GetEntityWithNavigationStrategy',
                entitySet,
                hasNavigationData: useNavigation,
            });
            return (0, StrategyHelpers_1.formatSuccessResponse)(convertedResult, 'Get Entity with Navigation');
        }
        catch (error) {
            return (0, StrategyHelpers_1.handleOperationError)(error, this, itemIndex, this.continueOnFail());
        }
    }
}
exports.GetEntityWithNavigationStrategy = GetEntityWithNavigationStrategy;
