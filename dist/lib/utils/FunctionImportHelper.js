"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionImportHelper = exports.FunctionParameterType = void 0;
var FunctionParameterType;
(function (FunctionParameterType) {
    FunctionParameterType["String"] = "Edm.String";
    FunctionParameterType["Int32"] = "Edm.Int32";
    FunctionParameterType["Int64"] = "Edm.Int64";
    FunctionParameterType["Decimal"] = "Edm.Decimal";
    FunctionParameterType["Boolean"] = "Edm.Boolean";
    FunctionParameterType["DateTime"] = "Edm.DateTime";
    FunctionParameterType["DateTimeOffset"] = "Edm.DateTimeOffset";
    FunctionParameterType["Guid"] = "Edm.Guid";
    FunctionParameterType["Binary"] = "Edm.Binary";
})(FunctionParameterType || (exports.FunctionParameterType = FunctionParameterType = {}));
class FunctionImportHelper {
    static buildFunctionImportUrl(functionName, parameters, httpMethod) {
        if (httpMethod === 'GET') {
            const paramString = this.buildUrlParameters(parameters);
            return {
                url: `/${functionName}${paramString ? `?${paramString}` : ''}`,
            };
        }
        else {
            const body = this.buildBodyParameters(parameters);
            return {
                url: `/${functionName}`,
                body,
            };
        }
    }
    static buildUrlParameters(parameters) {
        const params = [];
        parameters.forEach(param => {
            const formattedValue = this.formatParameterValue(param);
            params.push(`${param.name}=${encodeURIComponent(formattedValue)}`);
        });
        return params.join('&');
    }
    static buildBodyParameters(parameters) {
        const body = {};
        parameters.forEach(param => {
            body[param.name] = this.convertParameterValue(param);
        });
        return body;
    }
    static formatParameterValue(param) {
        const { type, value } = param;
        if (value === null || value === undefined) {
            return 'null';
        }
        switch (type) {
            case FunctionParameterType.String:
                return `'${String(value).replace(/'/g, "''")}'`;
            case FunctionParameterType.Guid:
                return `guid'${value}'`;
            case FunctionParameterType.DateTime:
                return `datetime'${this.formatDateTime(value)}'`;
            case FunctionParameterType.DateTimeOffset:
                return `datetimeoffset'${this.formatDateTimeOffset(value)}'`;
            case FunctionParameterType.Decimal:
                return `${value}M`;
            case FunctionParameterType.Int64:
                return `${value}L`;
            case FunctionParameterType.Binary:
                return `binary'${value}'`;
            case FunctionParameterType.Boolean:
                return String(value).toLowerCase();
            case FunctionParameterType.Int32:
            default:
                return String(value);
        }
    }
    static convertParameterValue(param) {
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
    static formatDateTime(value) {
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid date format: ${value}`);
            }
            return date.toISOString();
        }
        throw new Error(`Invalid DateTime value: ${value}`);
    }
    static formatDateTimeOffset(value) {
        return this.formatDateTime(value);
    }
    static parseFunctionImportFromMetadata(_functionImportXml) {
        const functionImports = [];
        return functionImports;
    }
    static validateParameters(parameters) {
        const errors = [];
        parameters.forEach((param, index) => {
            if (!param.name) {
                errors.push(`Parameter ${index}: Missing name`);
            }
            if (!param.type) {
                errors.push(`Parameter ${index}: Missing type`);
            }
            if (param.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
                errors.push(`Parameter ${index}: Invalid name '${param.name}'. ` +
                    `Must start with letter/underscore and contain only alphanumeric characters.`);
            }
            if (!param.nullable && (param.value === null || param.value === undefined)) {
                errors.push(`Parameter ${index} (${param.name}): Value is required (not nullable)`);
            }
            if (param.value !== null && param.value !== undefined) {
                const typeValidation = this.validateParameterType(param);
                if (!typeValidation.valid) {
                    errors.push(`Parameter ${index} (${param.name}): ${typeValidation.error}`);
                }
            }
        });
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    static validateParameterType(param) {
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
                }
                catch (error) {
                    return {
                        valid: false,
                        error: `Invalid date format. Use ISO 8601 (e.g., 2024-01-15T10:30:00Z)`
                    };
                }
                break;
        }
        return { valid: true };
    }
    static buildParametersFromObject(paramsObj, typeMap) {
        return Object.entries(paramsObj).map(([name, value]) => ({
            name,
            type: (typeMap === null || typeMap === void 0 ? void 0 : typeMap[name]) || this.inferParameterType(value),
            value,
        }));
    }
    static inferParameterType(value) {
        if (typeof value === 'string') {
            if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
                return FunctionParameterType.Guid;
            }
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
        return FunctionParameterType.String;
    }
    static extractReturnValue(response, _returnType) {
        if (!response || typeof response !== 'object') {
            return response;
        }
        const responseObj = response;
        if (responseObj.d) {
            const d = responseObj.d;
            if (d.results && Array.isArray(d.results)) {
                return d.results;
            }
            return d;
        }
        return response;
    }
}
exports.FunctionImportHelper = FunctionImportHelper;
