/**
 * EnhancedFunctionImportStrategy - Advanced Function Import execution
 *
 * Supports:
 * - GET and POST function imports
 * - Complex parameter types
 * - Automatic type inference
 * - Return value extraction
 */

import { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';
import { executeRequest } from '../core/ApiClient';
import {
	FunctionImportHelper,
	IFunctionParameter,
} from '../utils/FunctionImportHelper';
import { Logger } from '../utils/Logger';
import {
	getServicePath,
	validateAndParseJson,
	applyTypeConversion,
	formatSuccessResponse,
	handleOperationError,
	extractResult,
	parseParameterType,
} from '../utils/StrategyHelpers';
import { CrudStrategy } from './base/CrudStrategy';

export class EnhancedFunctionImportStrategy extends CrudStrategy {
	async execute(
		this: IExecuteFunctions,
		itemIndex: number
	): Promise<INodeExecutionData[]> {
		try {
			const functionName = this.getNodeParameter('functionName', itemIndex) as string;
			const httpMethod = this.getNodeParameter('httpMethod', itemIndex, 'GET') as 'GET' | 'POST';
			const servicePath = getServicePath(this, itemIndex);
			const parameterMode = this.getNodeParameter('parameterMode', itemIndex, 'simple') as string;

			Logger.info('Enhanced Function Import started', {
				module: 'EnhancedFunctionImportStrategy',
				functionName,
				httpMethod,
				parameterMode,
			});

			// Build parameters
			let parameters: IFunctionParameter[] = [];

			if (parameterMode === 'simple') {
				// Simple mode: JSON object with auto-type inference
				const paramsStr = this.getNodeParameter('parameters', itemIndex, '{}') as string;
				const paramsObj = validateAndParseJson(
					paramsStr,
					'parameters',
					this.getNode()
				) as IDataObject;

				parameters = FunctionImportHelper.buildParametersFromObject(paramsObj);

				Logger.debug('Simple parameters built', {
					module: 'EnhancedFunctionImportStrategy',
					parameterCount: parameters.length,
				});
			} else {
				// Advanced mode: Explicit type definitions
				const paramsStr = this.getNodeParameter('typedParameters', itemIndex, '[]') as string;
				const typedParams = validateAndParseJson(
					paramsStr,
					'typedParameters',
					this.getNode()
				) as Array<{
					name: string;
					type: string;
					value: unknown;
					nullable?: boolean;
				}>;

				parameters = typedParams.map(param => ({
					name: param.name,
					type: parseParameterType(param.type, this.getNode()),
					value: param.value,
					nullable: param.nullable,
				}));

				Logger.debug('Advanced parameters built', {
					module: 'EnhancedFunctionImportStrategy',
					parameterCount: parameters.length,
					types: parameters.map(p => `${p.name}:${p.type}`),
				});
			}

			// Validate parameters
			const validation = FunctionImportHelper.validateParameters(parameters);
			if (!validation.valid) {
				throw new Error(
					`Parameter validation failed:\n${validation.errors.join('\n')}`
				);
			}

			// Build function import URL and body
			const { url, body } = FunctionImportHelper.buildFunctionImportUrl(
				functionName,
				parameters,
				httpMethod
			);

			Logger.debug('Function import request prepared', {
				module: 'EnhancedFunctionImportStrategy',
				url,
				method: httpMethod,
				hasBody: !!body,
			});

			// Execute function import
			const response = await executeRequest.call(this, {
				method: httpMethod,
				resource: url.startsWith('/') ? url.substring(1) : url,
				body: body || {},
				servicePath,
			});

			// Extract return value
			const returnType = this.getNodeParameter('returnType', itemIndex, 'auto') as string;
			const returnValue = returnType === 'auto'
				? extractResult(response as IDataObject)
				: FunctionImportHelper.extractReturnValue(
						response,
						returnType as 'entity' | 'collection' | 'primitive' | 'complex'
				  );

			// Apply type conversion
			const convertedResult = applyTypeConversion(returnValue as IDataObject | IDataObject[], this, itemIndex);

			Logger.info('Function import executed successfully', {
				module: 'EnhancedFunctionImportStrategy',
				functionName,
				resultType: Array.isArray(convertedResult) ? 'collection' : typeof convertedResult,
			});

			return formatSuccessResponse(convertedResult, 'Enhanced Function Import');

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
