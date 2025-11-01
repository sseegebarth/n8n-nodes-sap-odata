/**
 * RfcFunctions - SAP RFC/BAPI connection and invocation functions
 *
 * Handles:
 * - RFC connection management
 * - Function invocation
 * - Parameter conversion
 * - Error handling
 *
 * IMPORTANT: This implementation uses node-rfc which requires SAP NW RFC SDK
 * If node-rfc is not installed, the node will provide helpful error messages
 */

import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

// Try to import node-rfc, but handle gracefully if not installed
let Client: any;
let rfcAvailable = false;

try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const nodeRfc = require('node-rfc');
	Client = nodeRfc.Client;
	rfcAvailable = true;
} catch (error) {
	// node-rfc not installed - will show error message to user
	rfcAvailable = false;
}

/**
 * Get RFC connection parameters from credentials
 */
export function getRfcConnectionParams(credentials: any): any {
	const params: any = {
		user: credentials.user,
		passwd: credentials.passwd,
		client: credentials.client,
		lang: credentials.lang || 'EN',
	};

	// Connection type specific parameters
	if (credentials.connectionType === 'direct') {
		params.ashost = credentials.ashost;
		params.sysnr = credentials.sysnr;
	} else if (credentials.connectionType === 'loadBalancing') {
		params.mshost = credentials.mshost;
		params.sysid = credentials.sysid;
		params.group = credentials.group || 'PUBLIC';
		if (credentials.msserv) {
			params.msserv = credentials.msserv;
		}
	}

	// SAProuter
	if (credentials.saprouter) {
		params.saprouter = credentials.saprouter;
	}

	// SNC (Secure Network Communication)
	if (credentials.useSnc) {
		params.snc_partnername = credentials.sncPartnerName;
		params.snc_qop = credentials.sncQop || '3';
		if (credentials.sncMyName) {
			params.snc_myname = credentials.sncMyName;
		}
	}

	// Timeout
	if (credentials.timeout) {
		params.timeout = credentials.timeout;
	}

	return params;
}

/**
 * Get RFC connection (client instance)
 */
export async function getRfcConnection(credentials: any): Promise<any> {
	if (!rfcAvailable) {
		throw new Error(
			'SAP RFC SDK not available. Please install node-rfc and SAP NW RFC SDK. ' +
			'See documentation: https://github.com/SAP/node-rfc#installation',
		);
	}

	const params = getRfcConnectionParams(credentials);
	return new Client(params);
}

/**
 * Close RFC connection
 */
export async function closeRfcConnection(client: any): Promise<void> {
	if (client && client.close) {
		try {
			await client.close();
		} catch (error) {
			// Ignore close errors
			console.warn('Error closing RFC connection:', error);
		}
	}
}

/**
 * Invoke RFC function
 */
export async function invokeRfc(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	if (!rfcAvailable) {
		return {
			error: 'SAP RFC SDK not available',
			message:
				'node-rfc module is not installed. To use RFC/BAPI functionality, you need to:\n\n' +
				'1. Install SAP NW RFC SDK from SAP Support Portal\n' +
				'2. Install node-rfc: npm install node-rfc\n' +
				'3. Restart n8n\n\n' +
				'See documentation: https://github.com/SAP/node-rfc#installation',
			installInstructions: {
				step1: 'Download SAP NW RFC SDK from https://support.sap.com/swdc',
				step2: 'Extract and install SDK to your system',
				step3: 'Add SDK library path to system PATH/LD_LIBRARY_PATH',
				step4: 'Run: npm install node-rfc',
				step5: 'Restart n8n',
			},
		};
	}

	const credentials = await this.getCredentials('sapRfcApi');
	const functionName = this.getNodeParameter('functionName', itemIndex) as string;
	const inputMode = this.getNodeParameter('inputMode', itemIndex) as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as any;

	// Build parameters
	let parameters: any = {};

	if (inputMode === 'json') {
		// JSON input
		const parametersJson = this.getNodeParameter('parametersJson', itemIndex) as string;
		parameters = typeof parametersJson === 'string' ? JSON.parse(parametersJson) : parametersJson;
	} else if (inputMode === 'structured') {
		// Structured input
		const importParameters = this.getNodeParameter('importParameters', itemIndex, {}) as any;
		const tableParameters = this.getNodeParameter('tableParameters', itemIndex, {}) as any;

		// Add import parameters
		const importParams = importParameters.parameter || [];
		for (const param of importParams) {
			let value = param.value;

			// Convert value based on type
			if (param.type === 'number') {
				value = Number(value);
			} else if (param.type === 'boolean') {
				value = value === 'true' || value === true || value === 'X';
			} else if (param.type === 'structure') {
				value = typeof value === 'string' ? JSON.parse(value) : value;
			}

			parameters[param.name] = value;
		}

		// Add table parameters
		const tableParams = tableParameters.table || [];
		for (const table of tableParams) {
			const rows = typeof table.rows === 'string' ? JSON.parse(table.rows) : table.rows;
			parameters[table.name] = rows;
		}
	}

	// Get RFC connection
	const client = await getRfcConnection(credentials);

	try {
		// Call function
		const result = await client.call(functionName, parameters);

		// Check for BAPI errors if requested
		if (options.checkReturn !== false && result.RETURN) {
			checkBapiReturn.call(this, result.RETURN, options.throwOnBapiError !== false);
		}

		// Auto commit if requested
		if (options.autoCommit) {
			await client.call('BAPI_TRANSACTION_COMMIT', { WAIT: 'X' });
		}

		// Build output
		const output: any = {
			success: true,
			functionName,
		};

		// Add export parameters (always include)
		if (result) {
			for (const [key, value] of Object.entries(result)) {
				// Skip tables if not requested
				if (Array.isArray(value) && options.returnTables === false) {
					continue;
				}
				output[key] = value;
			}
		}

		// Add import parameters if requested
		if (options.returnImportParams) {
			output.importParameters = parameters;
		}

		return output;
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`RFC call failed: ${error instanceof Error ? error.message : String(error)}`,
			{ itemIndex },
		);
	} finally {
		// Close connection (unless using connection pool)
		if (!options.useConnectionPool) {
			await closeRfcConnection(client);
		}
	}
}

/**
 * Execute multiple RFC calls in the same session (stateful)
 */
export async function executeStatefulCalls(this: IExecuteFunctions, itemIndex: number): Promise<any> {
	if (!rfcAvailable) {
		return {
			error: 'SAP RFC SDK not available',
			message: 'node-rfc module is not installed. See installation instructions in single function call mode.',
		};
	}

	const credentials = await this.getCredentials('sapRfcApi');
	const functions = this.getNodeParameter('functions', itemIndex, {}) as any;
	const options = this.getNodeParameter('options', itemIndex, {}) as any;

	// Get RFC connection
	const client = await getRfcConnection(credentials);

	const results: any[] = [];

	try {
		// Open stateful connection
		await client.open();

		// Execute each function
		const functionList = functions.function || [];
		for (let j = 0; j < functionList.length; j++) {
			const func = functionList[j];
			const functionName = func.functionName;
			const parameters =
				typeof func.parameters === 'string' ? JSON.parse(func.parameters) : func.parameters;

			// Call function
			const result = await client.call(functionName, parameters);

			// Check for BAPI errors if requested
			if (options.checkReturn !== false && result.RETURN) {
				checkBapiReturn.call(this, result.RETURN, options.throwOnBapiError !== false);
			}

			results.push({
				functionName,
				result,
			});

			// Commit if requested
			if (func.commit) {
				await client.call('BAPI_TRANSACTION_COMMIT', { WAIT: 'X' });
			}
		}

		return {
			success: true,
			functionCount: results.length,
			results,
		};
	} finally {
		// Close connection
		await closeRfcConnection(client);
	}
}

/**
 * Check BAPI RETURN structure for errors
 */
function checkBapiReturn(this: IExecuteFunctions, returnParam: any, throwOnError: boolean): void {
	// RETURN can be a structure or table
	const returns = Array.isArray(returnParam) ? returnParam : [returnParam];

	for (const ret of returns) {
		if (ret && ret.TYPE) {
			// Type: S=Success, W=Warning, E=Error, A=Abort
			if (ret.TYPE === 'E' || ret.TYPE === 'A') {
				const message = ret.MESSAGE || 'BAPI returned error';
				const details = {
					type: ret.TYPE,
					id: ret.ID,
					number: ret.NUMBER,
					message: ret.MESSAGE,
					messageV1: ret.MESSAGE_V1,
					messageV2: ret.MESSAGE_V2,
					messageV3: ret.MESSAGE_V3,
					messageV4: ret.MESSAGE_V4,
				};

				if (throwOnError) {
					throw new NodeOperationError(
						this.getNode(),
						`BAPI Error (${ret.TYPE}): ${message}`,
						{ description: JSON.stringify(details, null, 2) },
					);
				}
			}
		}
	}
}

/**
 * Get common BAPI function names for auto-completion
 */
export function getCommonBapis(): string[] {
	return [
		'BAPI_USER_GET_DETAIL',
		'BAPI_USER_CREATE',
		'BAPI_USER_CHANGE',
		'BAPI_USER_DELETE',
		'BAPI_CUSTOMER_GETDETAIL',
		'BAPI_CUSTOMER_GETLIST',
		'BAPI_CUSTOMER_CREATE',
		'BAPI_CUSTOMER_CHANGE',
		'BAPI_MATERIAL_GETDETAIL',
		'BAPI_MATERIAL_GETLIST',
		'BAPI_MATERIAL_CREATE',
		'BAPI_SALESORDER_GETLIST',
		'BAPI_SALESORDER_CREATEFROMDAT2',
		'BAPI_SALESORDER_CHANGE',
		'BAPI_PO_GETDETAIL',
		'BAPI_PO_CREATE',
		'BAPI_ACC_DOCUMENT_POST',
		'BAPI_GOODSMVT_CREATE',
		'BAPI_TRANSACTION_COMMIT',
		'BAPI_TRANSACTION_ROLLBACK',
		'RFC_READ_TABLE',
		'RFC_GET_TABLE_ENTRIES',
		'RFC_SYSTEM_INFO',
	];
}

/**
 * Format RFC result for better readability
 */
export function formatRfcResult(result: any): any {
	const formatted: any = {};

	for (const [key, value] of Object.entries(result)) {
		// Format tables
		if (Array.isArray(value)) {
			formatted[key] = {
				type: 'table',
				rowCount: value.length,
				rows: value,
			};
		}
		// Format structures
		else if (typeof value === 'object' && value !== null) {
			formatted[key] = {
				type: 'structure',
				fields: value,
			};
		}
		// Simple values
		else {
			formatted[key] = value;
		}
	}

	return formatted;
}
