import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sapOdataApiRequest } from '../../nodes/SapOData/GenericFunctions';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';
import { IOperationOptions, IRequestOptions } from './types';

/**
 * Strategy for updating an existing entity
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class UpdateEntityStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {

			const entitySet = this.getEntitySet(context, itemIndex);

			// Extract entity key from Resource Locator
			const entityKeyParam = context.getNodeParameter('entityKey', itemIndex) as string | { mode: string; value: string };
			const entityKey = typeof entityKeyParam === 'string'
				? entityKeyParam
				: entityKeyParam.value;

			const dataString = context.getNodeParameter('data', itemIndex) as string;

			// Validate and format the entity key
			const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

			// Validate and parse JSON input using base class method
			const data = this.validateAndParseJson(dataString, 'Data', context.getNode());

			// Get options for ETag handling
			const options = context.getNodeParameter('options', itemIndex, {}) as IOperationOptions;
			const etag = options.etag;

			// Log operation for debugging
			this.logOperation('UPDATE', {
				entitySet,
				entityKey: formattedKey,
				hasETag: !!etag,
				itemIndex,
			});

			// Build request options with If-Match header for optimistic locking
			const requestOptions: IRequestOptions = {};
			if (etag) {
				// Use provided ETag for optimistic locking
				requestOptions.headers = {
					'If-Match': etag,
				};
			} else {
				// Default to '*' to bypass optimistic locking (always update)
				// This prevents 412 Precondition Failed errors when ETag is not available
				requestOptions.headers = {
					'If-Match': '*',
				};
			}

			// Make API request (PATCH for partial update)
			const response = await sapOdataApiRequest.call(
				context,
				'PATCH',
				this.buildResourcePath(entitySet, formattedKey),
				data,
				{},
				undefined,
				requestOptions,
			);

			// Extract result and apply type conversion
			// PATCH may return empty response, provide default success object
			const result = this.extractResult(response) || { success: true };
			const convertedResult = this.applyTypeConversion(context, itemIndex, result);
			return this.formatSuccessResponse(convertedResult, itemIndex);
	}
}
