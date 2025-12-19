/**
 * FunctionImportHelper - Advanced Function Import support
 *
 * SAP OData Function Imports (Actions/Functions):
 * - GET Functions (query operations)
 * - POST Actions (data modification)
 * - Complex parameter types
 * - Return type handling
 */

import { IDataObject } from 'n8n-workflow';

/**
 * Function Import Parameter Types
 */
export enum FunctionParameterType {
	String = 'Edm.String',
	Int32 = 'Edm.Int32',
	Int64 = 'Edm.Int64',
	Decimal = 'Edm.Decimal',
	Boolean = 'Edm.Boolean',
	DateTime = 'Edm.DateTime',
	DateTimeOffset = 'Edm.DateTimeOffset',
	Guid = 'Edm.Guid',
	Binary = 'Edm.Binary',
}

/**
 * Function Import Parameter
 */
export interface IFunctionParameter {
	name: string;
	type: FunctionParameterType;
	value: unknown;
	nullable?: boolean;
}

/**
 * Function Import Configuration
 */
export interface IFunctionImportConfig {
	name: string;
	httpMethod: 'GET' | 'POST';
	parameters: IFunctionParameter[];
	returnType?: 'entity' | 'collection' | 'primitive' | 'complex';
}

/**
 * Function Import Discovery (from $metadata)
 */
export interface IFunctionImportMetadata {
	name: string;
	httpMethod: string;
	parameters: Array<{
		name: string;
		type: string;
		mode: 'In' | 'Out' | 'InOut';
		nullable: boolean;
	}>;
	returnType?: {
		type: string;
		multiplicity: '0..1' | '1' | '*';
	};
}

export class FunctionImportHelper {
	/**
	 * Build Function Import URL with parameters
	 */
	static buildFunctionImportUrl(
		functionName: string,
		parameters: IFunctionParameter[],
		httpMethod: 'GET' | 'POST'
	): {
		url: string;
		body?: IDataObject;
	} {
		if (httpMethod === 'GET') {
			// GET: Parameters in URL
			const paramString = this.buildUrlParameters(parameters);
			return {
				url: `/${functionName}${paramString ? `?${paramString}` : ''}`,
			};
		} else {
			// POST: Parameters in body
			const body = this.buildBodyParameters(parameters);
			return {
				url: `/${functionName}`,
				body,
			};
		}
	}

	/**
	 * Build URL query parameters for GET functions
	 */
	private static buildUrlParameters(parameters: IFunctionParameter[]): string {
		const params: string[] = [];

		parameters.forEach(param => {
			const formattedValue = this.formatParameterValue(param);
			params.push(`${param.name}=${encodeURIComponent(formattedValue)}`);
		});

		return params.join('&');
	}

	/**
	 * Build request body for POST actions
	 */
	private static buildBodyParameters(parameters: IFunctionParameter[]): IDataObject {
		const body: IDataObject = {};

		parameters.forEach(param => {
			body[param.name] = this.convertParameterValue(param) as string | number | boolean | null;
		});

		return body;
	}

	/**
	 * Format parameter value for URL (OData syntax)
	 */
	private static formatParameterValue(param: IFunctionParameter): string {
		const { type, value } = param;

		if (value === null || value === undefined) {
			return 'null';
		}

		switch (type) {
			case FunctionParameterType.String:
				return `'${String(value).replace(/'/g, "''")}'`; // Escape single quotes

			case FunctionParameterType.Guid:
				return `guid'${value}'`;

			case FunctionParameterType.DateTime:
				// OData V2: datetime'2024-01-15T10:30:00'
				return `datetime'${this.formatDateTime(value)}'`;

			case FunctionParameterType.DateTimeOffset:
				return `datetimeoffset'${this.formatDateTimeOffset(value)}'`;

			case FunctionParameterType.Decimal:
				return `${value}M`; // Decimal suffix

			case FunctionParameterType.Int64:
				return `${value}L`; // Long suffix

			case FunctionParameterType.Binary:
				return `binary'${value}'`;

			case FunctionParameterType.Boolean:
				return String(value).toLowerCase();

			case FunctionParameterType.Int32:
			default:
				return String(value);
		}
	}

	/**
	 * Convert parameter value for POST body
	 */
	private static convertParameterValue(param: IFunctionParameter): unknown {
		const { type, value } = param;

		if (value === null || value === undefined) {
			return null;
		}

		switch (type) {
			case FunctionParameterType.String:
			case FunctionParameterType.Guid:
				return String(value);

			case FunctionParameterType.Int32:
			case FunctionParameterType.Int64:
				return parseInt(String(value), 10);

			case FunctionParameterType.Decimal:
				return parseFloat(String(value));

			case FunctionParameterType.Boolean:
				return Boolean(value);

			case FunctionParameterType.DateTime:
			case FunctionParameterType.DateTimeOffset:
				return this.formatDateTime(value);

			default:
				return value;
		}
	}

	/**
	 * Format DateTime value
	 */
	private static formatDateTime(value: unknown): string {
		if (value instanceof Date) {
			return value.toISOString();
		}
		if (typeof value === 'string') {
			// Validate and return ISO string
			const date = new Date(value);
			if (isNaN(date.getTime())) {
				throw new Error(`Invalid date format: ${value}`);
			}
			return date.toISOString();
		}
		throw new Error(`Invalid DateTime value: ${value}`);
	}

	/**
	 * Format DateTimeOffset value
	 */
	private static formatDateTimeOffset(value: unknown): string {
		// Same as DateTime for OData V2
		return this.formatDateTime(value);
	}

	/**
	 * Parse Function Import metadata from $metadata XML
	 */
	static parseFunctionImportFromMetadata(
		_functionImportXml: unknown
	): IFunctionImportMetadata[] {
		// This would parse the actual XML structure from $metadata
		// Simplified implementation - in production, use xml2js
		const functionImports: IFunctionImportMetadata[] = [];

		// Parse logic would go here
		// Example structure:
		// <FunctionImport Name="GetSalesOrders" ReturnType="Collection(SalesOrder)" m:HttpMethod="GET">
		//   <Parameter Name="CustomerID" Type="Edm.String" Mode="In" />
		// </FunctionImport>

		return functionImports;
	}

	/**
	 * Validate function parameters
	 */
	static validateParameters(parameters: IFunctionParameter[]): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		parameters.forEach((param, index) => {
			// Check required fields
			if (!param.name) {
				errors.push(`Parameter ${index}: Missing name`);
			}
			if (!param.type) {
				errors.push(`Parameter ${index}: Missing type`);
			}

			// Validate name format
			if (param.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
				errors.push(
					`Parameter ${index}: Invalid name '${param.name}'. ` +
					`Must start with letter/underscore and contain only alphanumeric characters.`
				);
			}

			// Validate value against type
			if (!param.nullable && (param.value === null || param.value === undefined)) {
				errors.push(`Parameter ${index} (${param.name}): Value is required (not nullable)`);
			}

			// Type-specific validation
			if (param.value !== null && param.value !== undefined) {
				const typeValidation = this.validateParameterType(param);
				if (!typeValidation.valid) {
					errors.push(
						`Parameter ${index} (${param.name}): ${typeValidation.error}`
					);
				}
			}
		});

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Validate parameter value matches type
	 */
	private static validateParameterType(param: IFunctionParameter): {
		valid: boolean;
		error?: string;
	} {
		const { type, value } = param;

		switch (type) {
			case FunctionParameterType.Int32:
			case FunctionParameterType.Int64:
				const num = Number(value);
				if (isNaN(num) || !Number.isInteger(num)) {
					return { valid: false, error: `Value must be an integer` };
				}
				break;

			case FunctionParameterType.Decimal:
				if (isNaN(Number(value))) {
					return { valid: false, error: `Value must be a number` };
				}
				break;

			case FunctionParameterType.Boolean:
				if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
					return { valid: false, error: `Value must be boolean` };
				}
				break;

			case FunctionParameterType.Guid:
				const guidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
				if (!guidPattern.test(String(value))) {
					return { valid: false, error: `Value must be a valid GUID` };
				}
				break;

			case FunctionParameterType.DateTime:
			case FunctionParameterType.DateTimeOffset:
				try {
					this.formatDateTime(value);
				} catch (error) {
					return {
						valid: false,
						error: `Invalid date format. Use ISO 8601 (e.g., 2024-01-15T10:30:00Z)`
					};
				}
				break;
		}

		return { valid: true };
	}

	/**
	 * Build parameter definitions from simple object
	 */
	static buildParametersFromObject(
		paramsObj: IDataObject,
		typeMap?: Record<string, FunctionParameterType>
	): IFunctionParameter[] {
		return Object.entries(paramsObj).map(([name, value]) => ({
			name,
			type: typeMap?.[name] || this.inferParameterType(value),
			value,
		}));
	}

	/**
	 * Infer parameter type from value
	 */
	private static inferParameterType(value: unknown): FunctionParameterType {
		if (typeof value === 'string') {
			// Try to detect GUID
			if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
				return FunctionParameterType.Guid;
			}
			// Try to detect DateTime
			if (!isNaN(Date.parse(value))) {
				return FunctionParameterType.DateTime;
			}
			return FunctionParameterType.String;
		}

		if (typeof value === 'number') {
			return Number.isInteger(value)
				? FunctionParameterType.Int32
				: FunctionParameterType.Decimal;
		}

		if (typeof value === 'boolean') {
			return FunctionParameterType.Boolean;
		}

		return FunctionParameterType.String; // Default
	}

	/**
	 * Extract return value from function import response
	 */
	static extractReturnValue(
		response: unknown,
		_returnType?: 'entity' | 'collection' | 'primitive' | 'complex'
	): unknown {
		if (!response || typeof response !== 'object') {
			return response;
		}

		const responseObj = response as IDataObject;

		// Handle OData V2 wrapper
		if (responseObj.d) {
			const d = responseObj.d as IDataObject;

			// Collection
			if (d.results && Array.isArray(d.results)) {
				return d.results;
			}

			// Single value
			return d;
		}

		// OData V4 or unwrapped response
		return response;
	}
}
