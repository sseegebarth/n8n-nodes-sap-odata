import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { CrudStrategy } from './base/CrudStrategy';
import { validateFunctionName } from '../SecurityUtils';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for executing function imports
 * Uses enhanced CrudStrategy base class for common validation and error handling
 */
export class FunctionImportStrategy extends CrudStrategy implements IOperationStrategy {
	async execute(
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<INodeExecutionData[]> {
		
			// Get function name (supports both list and custom mode)
			const mode = context.getNodeParameter('functionNameMode', itemIndex, 'list') as string;
			let functionName = mode === 'custom'
				? context.getNodeParameter('customFunctionName', itemIndex) as string
				: context.getNodeParameter('functionName', itemIndex) as string;

			// Validate function name for security
			functionName = validateFunctionName(functionName, context.getNode());

			const parametersString = context.getNodeParameter('functionParameters', itemIndex) as string;
			const httpMethod = context.getNodeParameter('functionHttpMethod', itemIndex, 'POST') as string;

			// Validate and parse JSON parameters using base class method
			const parameters = this.validateAndParseJson(
				parametersString,
				'Parameters',
				context.getNode(),
			);

			// Build query string for function parameters
			const queryParts: string[] = [];
			for (const [key, value] of Object.entries(parameters)) {
				if (typeof value === 'string') {
					queryParts.push(`${key}='${value}'`);
				} else {
					queryParts.push(`${key}=${value}`);
				}
			}

			const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

			// Log operation for debugging
			this.logOperation('FUNCTION_IMPORT', {
				functionName,
				httpMethod,
				parametersCount: Object.keys(parameters).length,
				itemIndex,
			});

			// Make API request with the specified HTTP method
			// GET: Parameters are passed in query string, no body
			// POST: Parameters are passed in query string (SAP OData convention)
			const response = await sapOdataApiRequest.call(
				context,
				httpMethod,
				`/${functionName}${queryString}`,
			);

			// Extract and format result
			const result = this.extractResult(response);
			return this.formatSuccessResponse(result, itemIndex);
	}
}
