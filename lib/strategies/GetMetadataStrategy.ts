import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { sapOdataApiRequest } from '../../nodes/SapOData/GenericFunctions';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';

/**
 * Strategy for getting service metadata
 * Supports fetching service document (/) and metadata ($metadata)
 */
export class GetMetadataStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		try {
			const metadataType = context.getNodeParameter('metadataType', itemIndex) as string;

			// Log operation for debugging
			this.logOperation('GET_METADATA', {
				metadataType,
				itemIndex,
			});

			// Determine the resource path based on metadata type
			const resource = metadataType === 'metadata' ? '/$metadata' : '/';

			// Make the request
			const response: any = await sapOdataApiRequest.call(
				context,
				'GET',
				resource,
				{},
				{},
			);

			// Format the response
			let result: IDataObject;

			if (metadataType === 'metadata') {
				// $metadata returns XML - wrap it in a result object
				result = {
					_type: 'metadata',
					_format: 'xml',
					content: typeof response === 'string' ? response : JSON.stringify(response),
				};
			} else {
				// Service document - extract entity sets and function imports
				if (response.d?.EntitySets) {
					// OData V2 format
					result = {
						_type: 'serviceDocument',
						_version: 'v2',
						entitySets: response.d.EntitySets,
					};
				} else if (response.value) {
					// OData V4 format
					result = {
						_type: 'serviceDocument',
						_version: 'v4',
						value: response.value,
					};
				} else {
					// Unknown format - return raw response
					result = {
						_type: 'serviceDocument',
						_raw: true,
						...response,
					};
				}
			}

			return [{
				json: result,
				pairedItem: { item: itemIndex },
			}];

		} catch (error) {
			// Handle errors with base class error handler
			const continueOnFail = context.continueOnFail();
			return this.handleOperationError(
				error as Error,
				'Get Metadata',
				itemIndex,
				continueOnFail,
			);
		}
	}
}
