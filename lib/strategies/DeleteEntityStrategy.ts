import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sapOdataApiRequest } from '../../nodes/SapOData/GenericFunctions';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';
import { IOperationOptions, IRequestOptions } from './types';

/**
 * Strategy for deleting an entity
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class DeleteEntityStrategy extends CrudStrategy implements IOperationStrategy {
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

			// Validate and format the entity key
			const formattedKey = this.validateAndFormatKey(entityKey, context.getNode());

			// Get options for ETag handling
			const options = context.getNodeParameter('options', itemIndex, {}) as IOperationOptions;
			const etag = options.etag;

			// Log operation for debugging
			this.logOperation('DELETE', {
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
				// Default to '*' to bypass optimistic locking (always delete)
				// This prevents 412 Precondition Failed errors when ETag is not available
				requestOptions.headers = {
					'If-Match': '*',
				};
			}

			// Make API request
			await sapOdataApiRequest.call(
				context,
				'DELETE',
				this.buildResourcePath(entitySet, formattedKey),
				{},
				{},
				undefined,
				requestOptions,
			);

			// DELETE typically returns empty response, return success
			return this.formatSuccessResponse({ success: true }, itemIndex);
	}
}
