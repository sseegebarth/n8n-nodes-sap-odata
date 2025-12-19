/**
 * GetEntityWithNavigationStrategy - Get entity with navigation properties
 *
 * Extends basic GET with:
 * - Deep $expand support
 * - Navigation property selection
 * - Nested filtering and sorting
 */

import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { executeRequest } from '../core/ApiClient';
import { Logger } from '../utils/Logger';
import {
	NavigationPropertyHelper,
	INavigationConfig,
} from '../utils/NavigationPropertyHelper';
import {
	getEntitySet,
	getServicePath,
	validateAndParseJson,
	validateAndFormatKey,
	buildResourcePath,
	getQueryOptions,
	extractResult,
	applyTypeConversion,
	formatSuccessResponse,
	handleOperationError,
} from '../utils/StrategyHelpers';
import { CrudStrategy } from './base/CrudStrategy';

export class GetEntityWithNavigationStrategy extends CrudStrategy {
	async execute(
		this: IExecuteFunctions,
		itemIndex: number
	): Promise<INodeExecutionData[]> {
		try {
			const entitySet = getEntitySet(this, itemIndex);
			const entityKey = this.getNodeParameter('entityKey', itemIndex) as string;
			const servicePath = getServicePath(this, itemIndex);

			// Navigation properties configuration
			const useNavigation = this.getNodeParameter('useNavigation', itemIndex, false) as boolean;

			Logger.debug('Get Entity with Navigation', {
				module: 'GetEntityWithNavigationStrategy',
				entitySet,
				entityKey,
				useNavigation,
			});

			// Build query parameters
			const queryParams: IDataObject = {
				...getQueryOptions(this, itemIndex),
			};

			// Add navigation if enabled
			if (useNavigation) {
				const navigationMode = this.getNodeParameter('navigationMode', itemIndex, 'simple') as string;

				if (navigationMode === 'simple') {
					// Simple expand with paths
					const expandPaths = this.getNodeParameter('expandPaths', itemIndex, '') as string;
					if (expandPaths) {
						const paths = expandPaths.split(',').map(p => p.trim()).filter(p => p);

						// Validate all paths
						for (const path of paths) {
							const validation = NavigationPropertyHelper.validateNavigationPath(path);
							if (!validation.valid) {
								throw new Error(validation.error);
							}
						}

						// Build multi-level expand
						queryParams.$expand = NavigationPropertyHelper.buildMultiLevelExpand(paths);

						Logger.debug('Simple navigation expand', {
							module: 'GetEntityWithNavigationStrategy',
							paths,
							expand: queryParams.$expand,
						});
					}
				} else if (navigationMode === 'advanced') {
					// Advanced expand with options
					const navConfigStr = this.getNodeParameter('navigationConfig', itemIndex, '[]') as string;
					const navConfigs = validateAndParseJson(
						navConfigStr,
						'navigationConfig',
						this.getNode()
					) as unknown as INavigationConfig[];

					if (Array.isArray(navConfigs) && navConfigs.length > 0) {
						queryParams.$expand = NavigationPropertyHelper.buildExpandParameter(navConfigs);

						Logger.debug('Advanced navigation expand', {
							module: 'GetEntityWithNavigationStrategy',
							configCount: navConfigs.length,
							expand: queryParams.$expand,
						});
					}
				}
			}

			// Execute request
			const formattedKey = validateAndFormatKey(entityKey, this.getNode());
			const resource = buildResourcePath(entitySet, formattedKey);

			const response = await executeRequest.call(this, {
				method: 'GET',
				resource,
				qs: queryParams,
				servicePath,
			});

			// Extract result
			const result = extractResult(response as IDataObject);

			// Apply type conversion
			const convertedResult = applyTypeConversion(result, this, itemIndex);

			Logger.info('Entity with navigation retrieved', {
				module: 'GetEntityWithNavigationStrategy',
				entitySet,
				hasNavigationData: useNavigation,
			});

			return formatSuccessResponse(convertedResult, 'Get Entity with Navigation');

		} catch (error) {
			return handleOperationError(
				error,
				this,
				itemIndex,
				this.continueOnFail()
			);
		}
	}
}
