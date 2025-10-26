import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { OperationStrategyFactory } from '../Shared/strategies';
import { sanitizeErrorMessage } from '../Shared/utils/SecurityUtils';
import { sapODataProperties } from './SapODataProperties';
import { sapODataLoadOptions } from './SapODataLoadOptions';

/**
 * SAP OData Node (Refactored)
 *
 * Main node class with properties and methods extracted to separate modules.
 * This improves maintainability and testability.
 */
export class SapOData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP OData',
		name: 'sapOData',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with SAP systems via OData services',
		defaults: {
			name: 'SAP OData',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'sapOdataApi',
				required: true,
			},
		],
		properties: sapODataProperties,
	};

	methods = {
		loadOptions: sapODataLoadOptions,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		// Check if cache should be cleared
		const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as any;
		if (advancedOptions.clearCache === true) {
			const { CacheManager } = await import('../Shared/utils/CacheManager');
			CacheManager.clearAllCache(this);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				// Get the appropriate strategy based on resource and operation
				const operation = resource === 'entity'
					? this.getNodeParameter('operation', i) as string
					: 'execute'; // For function imports

				const strategy = OperationStrategyFactory.getStrategy(resource, operation);

				// Execute the strategy
				const result = await strategy.execute(this, i);
				returnData.push(...result);

			} catch (error) {
				// Enhanced error handling with context
				const rawErrorMessage = error instanceof Error ? error.message : String(error);
				const errorMessage = sanitizeErrorMessage(rawErrorMessage);
				const operation = resource === 'entity'
					? this.getNodeParameter('operation', i, 'unknown') as string
					: 'execute';
				const contextMessage = `Item ${i}: ${resource}/${operation}`;

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							context: contextMessage,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				throw new Error(`${contextMessage} - ${errorMessage}`);
			}
		}

		return [returnData];
	}
}
