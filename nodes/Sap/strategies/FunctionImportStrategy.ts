import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { IOperationStrategy } from './IOperationStrategy';
import { validateJsonInput, validateFunctionName } from '../SecurityUtils';
import { sapOdataApiRequest } from '../GenericFunctions';

/**
 * Strategy for executing function imports
 */
export class FunctionImportStrategy implements IOperationStrategy {
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

		// Validate and parse JSON parameters
		const parameters = validateJsonInput(
			parametersString,
			'Parameters',
			context.getNode(),
		) as IDataObject;

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

		// Make API request with the specified HTTP method
		// GET: Parameters are passed in query string, no body
		// POST: Parameters are passed in query string (SAP OData convention)
		const response = await sapOdataApiRequest.call(
			context,
			httpMethod,
			`/${functionName}${queryString}`,
		);

		return [
			{
				json: response.d || response,
				pairedItem: { item: itemIndex },
			},
		];
	}
}
