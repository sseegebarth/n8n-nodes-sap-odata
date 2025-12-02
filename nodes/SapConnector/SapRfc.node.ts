/**
 * SAP RFC Node
 *
 * Call SAP RFC/BAPI functions via HTTP using the ZATW connector.
 * No native dependencies required - works with n8n Cloud and Self-Hosted.
 */

import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { ZATW_CREDENTIAL_TYPE } from '../Shared/constants';
import { ZatwApiClient } from '../Shared/core/ZatwApiClient';
import {
	ISapConnectorCredentials,
	IZatwRfcRequest,
	IZatwRfcBatchRequest,
	IZatwBapiReturn,
} from '../Shared/types/zatw';
import { Logger } from '../Shared/utils/Logger';
import { sapRfcLoadOptions, sapRfcListSearch } from './SapRfcLoadOptions';
import { sapRfcProperties } from './SapRfcProperties';

/**
 * Check BAPI RETURN structure for errors
 */
function checkBapiReturn(
	context: IExecuteFunctions,
	returnParams: IZatwBapiReturn[],
	throwOnError: boolean,
	itemIndex: number,
): void {
	for (const ret of returnParams) {
		// Type: S=Success, W=Warning, I=Info, E=Error, A=Abort
		if (ret.type === 'E' || ret.type === 'A') {
			const message = ret.message || 'BAPI returned an error';
			const details = {
				type: ret.type,
				id: ret.id,
				number: ret.number,
				message: ret.message,
				messageV1: ret.messageV1,
				messageV2: ret.messageV2,
				messageV3: ret.messageV3,
				messageV4: ret.messageV4,
			};

			if (throwOnError) {
				throw new NodeOperationError(
					context.getNode(),
					`BAPI Error (${ret.type}): ${message}`,
					{
						itemIndex,
						description: JSON.stringify(details, null, 2),
					},
				);
			}

			Logger.warn('BAPI returned error', {
				module: 'SapRfc',
				...details,
			});
		}
	}
}

/**
 * Execute a single RFC/BAPI function
 */
async function executeSingleFunction(
	context: IExecuteFunctions,
	credentials: ISapConnectorCredentials,
	itemIndex: number,
	options: IDataObject,
): Promise<IDataObject> {
	// Get function name from resource locator
	const functionNameParam = context.getNodeParameter('functionName', itemIndex) as
		| string
		| { mode: string; value: string };

	const functionName = typeof functionNameParam === 'object'
		? functionNameParam.value
		: functionNameParam;

	if (!functionName) {
		throw new NodeOperationError(
			context.getNode(),
			'Function name is required',
			{ itemIndex },
		);
	}

	// Build parameters based on input mode
	const inputMode = context.getNodeParameter('inputMode', itemIndex) as string;
	let parameters: IDataObject = {};

	if (inputMode === 'json') {
		// JSON mode - parse parameters directly
		const parametersJson = context.getNodeParameter('parametersJson', itemIndex) as string;
		try {
			parameters = typeof parametersJson === 'string'
				? JSON.parse(parametersJson)
				: parametersJson;
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				'Invalid JSON in parameters',
				{
					itemIndex,
					description: 'Please provide valid JSON for the function parameters.',
				},
			);
		}
	} else {
		// Dynamic mode - build from structured input
		const importParams = context.getNodeParameter('importParameters', itemIndex, {}) as {
			parameter?: Array<{ name: string; value: string }>;
		};

		const tableParams = context.getNodeParameter('tableParameters', itemIndex, {}) as {
			table?: Array<{ name: string; rows: string }>;
		};

		// Add import parameters
		if (importParams.parameter) {
			for (const param of importParams.parameter) {
				if (param.name && param.value !== undefined) {
					// Try to parse JSON for structures
					try {
						parameters[param.name] = JSON.parse(param.value);
					} catch {
						parameters[param.name] = param.value;
					}
				}
			}
		}

		// Add table parameters
		if (tableParams.table) {
			for (const table of tableParams.table) {
				if (table.name && table.rows) {
					try {
						parameters[table.name] = typeof table.rows === 'string'
							? JSON.parse(table.rows)
							: table.rows;
					} catch {
						throw new NodeOperationError(
							context.getNode(),
							`Invalid JSON in table parameter "${table.name}"`,
							{ itemIndex },
						);
					}
				}
			}
		}
	}

	// Build RFC request
	const request: IZatwRfcRequest = {
		functionName,
		parameters,
		options: {
			commit: options.autoCommit === true,
			checkReturn: options.checkReturn !== false,
		},
	};

	Logger.debug('Executing RFC', {
		module: 'SapRfc',
		functionName,
		parameterCount: Object.keys(parameters).length,
	});

	// Execute RFC
	const response = await ZatwApiClient.callFunction(context, credentials, request);

	// Check BAPI RETURN if enabled
	if (options.checkReturn !== false && response.return && response.return.length > 0) {
		checkBapiReturn(context, response.return, options.throwOnBapiError !== false, itemIndex);
	}

	// Build output
	const output: IDataObject = {
		success: response.success,
		functionName: response.functionName,
	};

	// Add export parameters
	if (options.includeExportParams !== false && response.exportParameters) {
		output.exportParameters = response.exportParameters;
	}

	// Add tables
	if (options.includeTables !== false && response.tables) {
		output.tables = response.tables;
	}

	// Add changing parameters
	if (response.changingParameters) {
		output.changingParameters = response.changingParameters;
	}

	// Add RETURN
	if (response.return) {
		output.return = response.return;
	}

	// Add input parameters if requested
	if (options.includeInputParams === true) {
		output.inputParameters = parameters;
	}

	// Add execution time
	if (response.executionTime !== undefined) {
		output.executionTime = response.executionTime;
	}

	return output;
}

/**
 * Execute multiple RFC/BAPI functions in sequence
 */
async function executeMultipleFunctions(
	context: IExecuteFunctions,
	credentials: ISapConnectorCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const functionsParam = context.getNodeParameter('functions', itemIndex, {}) as {
		function?: Array<{
			functionName: string;
			parameters: string;
			commitAfter?: boolean;
		}>;
	};

	if (!functionsParam.function || functionsParam.function.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'At least one function is required',
			{ itemIndex },
		);
	}

	// Get batch options
	const batchOptions = context.getNodeParameter('batchOptions', itemIndex, {}) as IDataObject;

	// Build batch request
	const request: IZatwRfcBatchRequest = {
		functions: functionsParam.function.map((f) => {
			let params: IDataObject = {};
			try {
				params = typeof f.parameters === 'string'
					? JSON.parse(f.parameters)
					: f.parameters || {};
			} catch {
				throw new NodeOperationError(
					context.getNode(),
					`Invalid JSON in parameters for function "${f.functionName}"`,
					{ itemIndex },
				);
			}

			return {
				functionName: f.functionName,
				parameters: params,
				commitAfter: f.commitAfter,
			};
		}),
		options: {
			stopOnError: batchOptions.stopOnError !== false,
			commitAll: batchOptions.commitAll === true,
			rollbackAll: batchOptions.rollbackAll === true,
		},
	};

	Logger.debug('Executing batch RFC', {
		module: 'SapRfc',
		functionCount: request.functions.length,
	});

	// Execute batch
	const response = await ZatwApiClient.callMultipleFunctions(context, credentials, request);

	return {
		success: response.success,
		functionCount: response.results.length,
		results: response.results,
		totalExecutionTime: response.totalExecutionTime,
	};
}

export class SapRfc implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP RFC',
		name: 'sapRfc',
		icon: 'file:sap.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] === "callFunction" ? $parameter["functionName"]?.value || $parameter["functionName"] : "Multiple Functions"}}',
		description: 'Call SAP RFC/BAPI functions via HTTP (ZATW Connector)',
		defaults: {
			name: 'SAP RFC',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'sapConnectorApi',
				required: true,
			},
		],
		properties: sapRfcProperties,
	};

	methods = {
		loadOptions: sapRfcLoadOptions,
		listSearch: sapRfcListSearch,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials(ZATW_CREDENTIAL_TYPE) as ISapConnectorCredentials;

		const operation = this.getNodeParameter('operation', 0) as string;

		// Enable debug logging if requested
		const options = this.getNodeParameter('options', 0, {}) as IDataObject;
		Logger.setDebugMode(options.debugLogging === true);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				if (operation === 'callFunction') {
					const result = await executeSingleFunction(this, credentials, itemIndex, options);
					returnData.push({ json: result });
				} else if (operation === 'callMultiple') {
					const result = await executeMultipleFunctions(this, credentials, itemIndex);
					returnData.push({ json: result });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
