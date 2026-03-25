import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	NodeConnectionTypes,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';
import { sanitizeErrorMessage, validateFunctionName } from '../../lib/utils/SecurityUtils';
import { ODataVersionHelper } from '../../lib/utils/ODataVersionHelper';
import { convertToSapV2Format } from '../../lib/utils/TypeConverter';
import {
	getEntitySet,
	validateAndFormatKey,
	getQueryOptions,
	extractResult,
	validateAndParseJson,
	buildResourcePath,
	applyTypeConversion,
} from '../../lib/utils/StrategyHelpers';
import { sapOdataApiRequest, sapOdataApiRequestAllItems, formatSapODataValue } from './GenericFunctions';
import { ODataValue } from '../../lib/utils/ODataValueFormatter';
import { testSapODataConnection } from './ConnectionTest';
import { sapODataLoadOptions, sapODataListSearch } from './SapODataLoadOptions';
import { sapODataProperties } from './SapODataProperties';
import { version } from '../../package.json';

function getEntityKeyValue(context: IExecuteFunctions, itemIndex: number): string {
	const param = context.getNodeParameter('entityKey', itemIndex) as string | { mode: string; value: string };
	return typeof param === 'string' ? param : param.value;
}

function toJsonResult(data: unknown, itemIndex: number): INodeExecutionData[] {
	const jsonData: IDataObject = (typeof data === 'object' && data !== null)
		? data as IDataObject
		: { value: data as string | number | boolean };
	return [{ json: jsonData, pairedItem: { item: itemIndex } }];
}

async function executeGet(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const entitySet = getEntitySet(context, itemIndex);
	const odataVersion = await ODataVersionHelper.getODataVersion(context);
	const entityKey = getEntityKeyValue(context, itemIndex);
	let formattedKey = validateAndFormatKey(entityKey, context.getNode());
	formattedKey = ODataVersionHelper.formatEntityKey(formattedKey, odataVersion);
	const query = getQueryOptions(context, itemIndex);

	const response = await sapOdataApiRequest.call(context, 'GET', buildResourcePath(entitySet, formattedKey), {}, query) as Record<string, unknown>;
	const result = ODataVersionHelper.extractData(response, odataVersion);
	const converted = applyTypeConversion(result as IDataObject, context, itemIndex);
	return toJsonResult(converted, itemIndex);
}

async function executeGetAll(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const entitySet = getEntitySet(context, itemIndex);
	const returnAll = context.getNodeParameter('returnAll', itemIndex) as boolean;
	const odataVersion = await ODataVersionHelper.getODataVersion(context);
	let query = getQueryOptions(context, itemIndex);

	const hasCountOption = query.$count === true;
	if (hasCountOption) {
		delete query.$count;
		query = ODataVersionHelper.getVersionSpecificParams(odataVersion, { ...query, count: true });
	}

	const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;
	if (options.batchSize) {
		query.$top = options.batchSize;
	}

	let dataArray: IDataObject[];

	if (returnAll) {
		const result = await sapOdataApiRequestAllItems.call(context, 'results', 'GET', buildResourcePath(entitySet), {}, query, false, 0);

		if (Array.isArray(result)) {
			dataArray = result;
		} else {
			dataArray = Array.isArray(result.data) ? result.data : [result.data];
		}
	} else {
		if (query.$top === undefined) {
			query.$top = context.getNodeParameter('limit', itemIndex) as number;
		}

		const response = await sapOdataApiRequest.call(context, 'GET', buildResourcePath(entitySet), {}, query) as Record<string, unknown>;
		const responseData = ODataVersionHelper.extractData(response, odataVersion);

		if (Array.isArray(responseData)) {
			dataArray = responseData;
		} else if (responseData && typeof responseData === 'object') {
			const rd = responseData as Record<string, unknown>;
			if (rd.results && Array.isArray(rd.results)) {
				dataArray = rd.results;
			} else if (rd.d && typeof rd.d === 'object' && (rd.d as Record<string, unknown>).results && Array.isArray((rd.d as Record<string, unknown>).results)) {
				dataArray = (rd.d as Record<string, unknown>).results as IDataObject[];
			} else {
				dataArray = [responseData as IDataObject];
			}
		} else {
			dataArray = responseData ? [responseData as IDataObject] : [];
		}
	}

	return dataArray.map((item) => {
		const converted = applyTypeConversion(item, context, itemIndex);
		const jsonData: IDataObject = (typeof converted === 'object' && converted !== null)
			? converted as IDataObject
			: { value: converted as string | number | boolean };
		return { json: jsonData, pairedItem: { item: itemIndex } };
	});
}

async function executeCreate(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const entitySet = getEntitySet(context, itemIndex);
	const dataString = context.getNodeParameter('data', itemIndex) as string;
	let data = validateAndParseJson(dataString, 'Data', context.getNode()) as IDataObject;

	const odataVersion = await ODataVersionHelper.getODataVersion(context);
	if (odataVersion === 'v2') {
		data = convertToSapV2Format(data) as IDataObject;
	}

	const response = await sapOdataApiRequest.call(context, 'POST', buildResourcePath(entitySet), data);
	const result = extractResult(response as IDataObject);
	const converted = applyTypeConversion(result as IDataObject, context, itemIndex);
	return toJsonResult(converted, itemIndex);
}

async function executeUpdate(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const entitySet = getEntitySet(context, itemIndex);
	const entityKey = getEntityKeyValue(context, itemIndex);
	const dataString = context.getNodeParameter('data', itemIndex) as string;
	const formattedKey = validateAndFormatKey(entityKey, context.getNode());
	let data = validateAndParseJson(dataString, 'Data', context.getNode()) as IDataObject;
	const etag = context.getNodeParameter('etag', itemIndex, '') as string;

	const odataVersion = await ODataVersionHelper.getODataVersion(context);
	if (odataVersion === 'v2') {
		data = convertToSapV2Format(data) as IDataObject;
	}

	const requestOptions: IDataObject = { headers: { 'If-Match': etag || '*' } };

	const response = await sapOdataApiRequest.call(
		context, 'PATCH', buildResourcePath(entitySet, formattedKey), data, {}, undefined, requestOptions,
	);
	const result = extractResult(response as IDataObject) || { success: true };
	const converted = applyTypeConversion(result as IDataObject, context, itemIndex);
	return toJsonResult(converted, itemIndex);
}

async function executeDelete(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const entitySet = getEntitySet(context, itemIndex);
	const entityKey = getEntityKeyValue(context, itemIndex);
	const formattedKey = validateAndFormatKey(entityKey, context.getNode());
	const etag = context.getNodeParameter('etag', itemIndex, '') as string;

	const requestOptions: IDataObject = { headers: { 'If-Match': etag || '*' } };

	await sapOdataApiRequest.call(
		context, 'DELETE', buildResourcePath(entitySet, formattedKey), {}, {}, undefined, requestOptions,
	);
	return [{ json: { success: true }, pairedItem: { item: itemIndex } }];
}

async function executeGetMetadata(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const metadataType = context.getNodeParameter('metadataType', itemIndex) as string;
	const resource = metadataType === 'metadata' ? '/$metadata' : '/';

	const response = await sapOdataApiRequest.call(context, 'GET', resource, {}, {}) as string | Record<string, unknown>;

	let result: IDataObject;
	if (metadataType === 'metadata') {
		result = {
			_type: 'metadata',
			_format: 'xml',
			content: typeof response === 'string' ? response : JSON.stringify(response),
		};
	} else if (typeof response === 'object' && (response as Record<string, unknown>).d) {
		const d = (response as Record<string, unknown>).d as Record<string, unknown>;
		if (d?.EntitySets) {
			result = { _type: 'serviceDocument', _version: 'v2', entitySets: d.EntitySets as IDataObject[] };
		} else {
			result = { _type: 'serviceDocument', _raw: true, ...response };
		}
	} else if (typeof response === 'object' && (response as Record<string, unknown>).value) {
		result = { _type: 'serviceDocument', _version: 'v4', value: (response as Record<string, unknown>).value as IDataObject[] };
	} else if (typeof response === 'object') {
		result = { _type: 'serviceDocument', _raw: true, ...response };
	} else {
		result = { _type: 'serviceDocument', _raw: true, content: response };
	}

	return [{ json: result, pairedItem: { item: itemIndex } }];
}

async function executeFunctionImport(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const functionNameParam = context.getNodeParameter('functionName', itemIndex) as
		| string
		| { mode: string; value: string };
	const rawValue = typeof functionNameParam === 'object'
		? functionNameParam.value
		: functionNameParam;

	// Extract type prefix if present (e.g. "Action::Release" -> type=Action, name=Release)
	let callableType = '';
	let functionName: string;
	if (rawValue.includes('::')) {
		const parts = rawValue.split('::');
		callableType = parts[0];
		functionName = parts.slice(1).join('::');
	} else {
		functionName = rawValue;
	}

	functionName = validateFunctionName(functionName, context.getNode());
	const parametersString = context.getNodeParameter('functionParameters', itemIndex) as string;
	const parameters = validateAndParseJson(parametersString, 'Parameters', context.getNode()) as IDataObject;

	// Determine HTTP method: Actions/POST types use POST, Functions use GET
	// User can still override via the HTTP Method field
	const userHttpMethod = context.getNodeParameter('functionHttpMethod', itemIndex, '') as string;
	let httpMethod: string;
	if (userHttpMethod) {
		httpMethod = userHttpMethod;
	} else if (callableType === 'Action') {
		httpMethod = 'POST';
	} else if (callableType === 'Function') {
		httpMethod = 'GET';
	} else {
		httpMethod = 'POST';
	}

	const urlFormat = context.getNodeParameter('functionUrlFormat', itemIndex, 'canonical') as string;

	let url: string;
	let body: IDataObject = {};

	// V2 FunctionImports: parameters always in URL (even for POST)
	// V4 Actions: parameters in request body (POST)
	// V4 Functions: parameters in URL (GET)
	const useUrlParams = callableType !== 'Action';

	if (useUrlParams) {
		const paramParts: string[] = [];
		for (const [key, value] of Object.entries(parameters)) {
			paramParts.push(`${key}=${formatSapODataValue(value as ODataValue, undefined, context.getNode())}`);
		}

		if (httpMethod === 'POST') {
			// V2 FunctionImport POST: parameters as query string
			url = paramParts.length > 0 ? `/${functionName}?${paramParts.join('&')}` : `/${functionName}`;
		} else if (urlFormat === 'canonical') {
			// GET canonical: /FunctionName(param1=value1)
			url = paramParts.length > 0 ? `/${functionName}(${paramParts.join(',')})` : `/${functionName}()`;
		} else {
			// GET query string: /FunctionName?param1=value1
			url = paramParts.length > 0 ? `/${functionName}?${paramParts.join('&')}` : `/${functionName}`;
		}
	} else {
		// V4 Action: parameters in body
		url = `/${functionName}`;
		body = parameters;
	}

	const response = await sapOdataApiRequest.call(context, httpMethod, url, body);
	const result = extractResult(response as IDataObject);
	const converted = applyTypeConversion(result as IDataObject, context, itemIndex);
	return toJsonResult(converted, itemIndex);
}

export class SapOData implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'avanai SAP Connect OData',
		name: 'sapOData',
		icon: { light: 'file:sap.svg', dark: 'file:sap.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: `Connect to SAP systems via OData (v${version})`,
		defaults: {
			name: 'SAP Connect OData',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'sapOdataApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['basicAuth', 'none'],
					},
				},
			},
			{
				name: 'sapOdataOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: ['oauth2'],
					},
				},
			},
		],
		properties: sapODataProperties,
		usableAsTool: true,
	};

	methods = {
		loadOptions: sapODataLoadOptions,
		listSearch: sapODataListSearch,
		credentialTest: {
			sapODataCredentialTest: testSapODataConnection,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		const startTime = Date.now();
		let errorCount = 0;
		let successCount = 0;

		const advancedOptions = this.getNodeParameter('advancedOptions', 0, {}) as IDataObject;
		if (advancedOptions.clearCache === true) {
			const { CacheManager } = await import('../../lib/utils/CacheManager');
			CacheManager.clearAllCache(this);
		}
		const includeMetrics = advancedOptions.includeMetrics === true;

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = resource === 'entity'
					? this.getNodeParameter('operation', i) as string
					: 'functionImport';

				let result: INodeExecutionData[];
				switch (operation) {
					case 'get':
						result = await executeGet(this, i);
						break;
					case 'getAll':
						result = await executeGetAll(this, i);
						break;
					case 'create':
						result = await executeCreate(this, i);
						break;
					case 'update':
						result = await executeUpdate(this, i);
						break;
					case 'delete':
						result = await executeDelete(this, i);
						break;
					case 'getMetadata':
						result = await executeGetMetadata(this, i);
						break;
					case 'functionImport':
						result = await executeFunctionImport(this, i);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push(...result);
				successCount++;
			} catch (error) {
				errorCount++;
				const rawErrorMessage = error instanceof Error ? error.message : String(error);
				const errorMessage = sanitizeErrorMessage(rawErrorMessage);
				const operation = resource === 'entity'
					? this.getNodeParameter('operation', i, 'unknown') as string
					: 'functionImport';
				const contextMessage = `Item ${i}: ${resource}/${operation}`;

				if (this.continueOnFail()) {
					const httpStatusCode = (error as Record<string, unknown>)?.httpStatusCode || null;
					const sapErrorCode = (error as Record<string, unknown>)?.sapErrorCode || null;

					returnData.push({
						json: {
							error: errorMessage,
							statusCode: httpStatusCode,
							sapErrorCode,
							context: contextMessage,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeApiError(this.getNode(), {
					message: `${contextMessage} - ${errorMessage}`,
					description: errorMessage,
					...(typeof error === 'object' && error !== null ? error : {}),
				}, {
					itemIndex: i,
				});
			}
		}

		if (includeMetrics) {
			const executionTime = Date.now() - startTime;
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
