/**
 * DeepInsertStrategy - Create entity with related entities in one request
 *
 * SAP OData Deep Insert allows creating an entity and its navigation
 * properties in a single POST request
 *
 * Example: Create SalesOrder with OrderItems in one call
 */

import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { executeRequest } from '../core/ApiClient';
import { Logger } from '../utils/Logger';
import {
	NavigationPropertyHelper,
	IDeepInsertConfig,
} from '../utils/NavigationPropertyHelper';
import {
	getEntitySet,
	getServicePath,
	validateAndParseJson,
	applyTypeConversion,
	formatSuccessResponse,
	handleOperationError,
	extractResult,
	validateNavigationProperties,
} from '../utils/StrategyHelpers';
import { CrudStrategy } from './base/CrudStrategy';

export class DeepInsertStrategy extends CrudStrategy {
	async execute(
		this: IExecuteFunctions,
		itemIndex: number
	): Promise<INodeExecutionData[]> {
		try {
			const entitySet = getEntitySet(this, itemIndex);
			const servicePath = getServicePath(this, itemIndex);

			// Get entity data
			const entityDataStr = this.getNodeParameter('entityData', itemIndex) as string;
			const entityData = validateAndParseJson(
				entityDataStr,
				'entityData',
				this.getNode()
			) as IDataObject;

			// Get navigation properties data
			const navPropertiesStr = this.getNodeParameter('navigationProperties', itemIndex, '{}') as string;
			const navProperties = validateAndParseJson(
				navPropertiesStr,
				'navigationProperties',
				this.getNode()
			) as Record<string, IDataObject | IDataObject[]>;

			Logger.info('Deep Insert started', {
				module: 'DeepInsertStrategy',
				entitySet,
				navigationPropertiesCount: Object.keys(navProperties).length,
			});

			// Validate navigation properties
			validateNavigationProperties(navProperties, this.getNode());

			// Build deep insert payload
			const deepInsertConfig: IDeepInsertConfig = {
				entity: entityData,
				navigationProperties: navProperties,
			};

			const payload = NavigationPropertyHelper.buildDeepInsertPayload(deepInsertConfig);

			Logger.debug('Deep insert payload prepared', {
				module: 'DeepInsertStrategy',
				payloadSize: JSON.stringify(payload).length,
				navigationProperties: Object.keys(navProperties),
			});

			// Execute deep insert
			const response = await executeRequest.call(this, {
				method: 'POST',
				resource: `/${entitySet}`,
				body: payload,
				servicePath,
			});

			// Extract and convert result
			const result = extractResult(response as IDataObject);
			const convertedResult = applyTypeConversion(result, this, itemIndex);

			Logger.info('Deep insert successful', {
				module: 'DeepInsertStrategy',
				entitySet,
			});

			return formatSuccessResponse(convertedResult, 'Deep Insert');

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
