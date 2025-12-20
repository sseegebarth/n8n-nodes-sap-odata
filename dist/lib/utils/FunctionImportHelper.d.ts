import { IDataObject } from 'n8n-workflow';
export declare enum FunctionParameterType {
    String = "Edm.String",
    Int32 = "Edm.Int32",
    Int64 = "Edm.Int64",
    Decimal = "Edm.Decimal",
    Boolean = "Edm.Boolean",
    DateTime = "Edm.DateTime",
    DateTimeOffset = "Edm.DateTimeOffset",
    Guid = "Edm.Guid",
    Binary = "Edm.Binary"
}
export interface IFunctionParameter {
    name: string;
    type: FunctionParameterType;
    value: unknown;
    nullable?: boolean;
}
export interface IFunctionImportConfig {
    name: string;
    httpMethod: 'GET' | 'POST';
    parameters: IFunctionParameter[];
    returnType?: 'entity' | 'collection' | 'primitive' | 'complex';
}
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
export declare class FunctionImportHelper {
    static buildFunctionImportUrl(functionName: string, parameters: IFunctionParameter[], httpMethod: 'GET' | 'POST'): {
        url: string;
        body?: IDataObject;
    };
    private static buildUrlParameters;
    private static buildBodyParameters;
    private static formatParameterValue;
    private static convertParameterValue;
    private static formatDateTime;
    private static formatDateTimeOffset;
    static parseFunctionImportFromMetadata(_functionImportXml: unknown): IFunctionImportMetadata[];
    static validateParameters(parameters: IFunctionParameter[]): {
        valid: boolean;
        errors: string[];
    };
    private static validateParameterType;
    static buildParametersFromObject(paramsObj: IDataObject, typeMap?: Record<string, FunctionParameterType>): IFunctionParameter[];
    private static inferParameterType;
    static extractReturnValue(response: unknown, _returnType?: 'entity' | 'collection' | 'primitive' | 'complex'): unknown;
}
