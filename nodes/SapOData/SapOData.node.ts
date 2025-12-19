import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { OperationStrategyFactory } from '../../lib/strategies';
import { IAdvancedOptions } from '../../lib/strategies/types';
import { sanitizeErrorMessage } from '../../lib/utils/SecurityUtils';
import { sapODataLoadOptions, sapODataListSearch } from './SapODataLoadOptions';
import { sapODataProperties } from './SapODataProperties';

/**
 * SAP OData Node (Refactored)
 *
 * Main node class with properties and methods extracted to separate modules.
 * This improves maintainability and testability.
 */
export class SapOData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ATW SAP Connect OData',
		name: 'sapOData',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Connect to SAP systems via OData',
		defaults: {
			name: 'SAP Connect OData',
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
		listSearch: sapODataListSearch,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		// Start performance tracking
		const startTime = Date.now();
		let errorCount = 0;
		let successCount = 0;

		// Check if cache should be cleared
		const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IAdvancedOptions;
		if (advancedOptions.clearCache === true) {
			const { CacheManager } = await import('../../lib/utils/CacheManager');
			CacheManager.clearAllCache(this);
		}

		// Check if metrics should be included
		const includeMetrics = advancedOptions.includeMetrics === true;

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
				successCount++;

			} catch (error) {
				errorCount++;
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

				throw new NodeOperationError(this.getNode(), `${contextMessage} - ${errorMessage}`, {
					itemIndex: i,
					description: errorMessage,
				});
			}
		}

		// Add metrics as a dedicated item if requested
		if (includeMetrics) {
			const executionTime = Date.now() - startTime;

			// Create a dedicated metrics item (not mutating business data)
			returnData.push({
				json: {
					_metrics: {
						executionTimeMs: executionTime,
						itemsProcessed: items.length,
						successfulItems: successCount,
						failedItems: errorCount,
						resource,
						timestamp: new Date().toISOString(),
					},
				},
				pairedItem: items.map((_, index) => ({ item: index })),
			});
		}

		return [returnData];
	}
}
