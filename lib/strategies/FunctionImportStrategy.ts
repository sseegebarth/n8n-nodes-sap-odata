import { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { sapOdataApiRequest, formatSapODataValue } from '../../nodes/SapOData/GenericFunctions';
import { validateFunctionName } from '../utils/SecurityUtils';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';

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

			const urlFormat = context.getNodeParameter('functionUrlFormat', itemIndex, 'canonical') as string;

			// Build URL and body based on HTTP method
			// POST/PATCH/PUT should use JSON body, GET should use URL parameters
			let url: string;
			let body: IDataObject = {};

			if (httpMethod === 'GET') {
				// GET: Parameters in URL (canonical or query string format)
				if (urlFormat === 'canonical') {
					// Canonical OData format: /FunctionName(param1='value1',param2='value2')
					const paramParts: string[] = [];
					for (const [key, value] of Object.entries(parameters)) {
						const formattedValue = formatSapODataValue(value);
						paramParts.push(`${key}=${formattedValue}`);
					}
					url = paramParts.length > 0
						? `/${functionName}(${paramParts.join(',')})`
						: `/${functionName}()`;
				} else {
					// Query string format: /FunctionName?param1='value1'&param2='value2'
					// URL encode keys and values to handle special characters
					const queryParts: string[] = [];
					for (const [key, value] of Object.entries(parameters)) {
						const formattedValue = formatSapODataValue(value);
						const encodedKey = encodeURIComponent(key);
						const encodedValue = encodeURIComponent(formattedValue);
						queryParts.push(`${encodedKey}=${encodedValue}`);
					}
					url = queryParts.length > 0
						? `/${functionName}?${queryParts.join('&')}`
						: `/${functionName}`;
				}
			} else {
				// POST/PATCH/PUT: Parameters in JSON body, clean URL
				// This prevents 414 URI Too Long errors and follows SAP Gateway best practices
				url = `/${functionName}`;
				body = parameters;
			}

			// Log operation for debugging
			this.logOperation('FUNCTION_IMPORT', {
				functionName,
				httpMethod,
				urlFormat: httpMethod === 'GET' ? urlFormat : 'json-body',
				parametersCount: Object.keys(parameters).length,
				itemIndex,
			});

			// Make API request with the specified HTTP method
			const response = await sapOdataApiRequest.call(
				context,
				httpMethod,
				url,
				body,
			);

			// Extract result and apply type conversion
			const result = this.extractResult(response);
			const convertedResult = this.applyTypeConversion(context, itemIndex, result);
			return this.formatSuccessResponse(convertedResult, itemIndex);
	}
}
