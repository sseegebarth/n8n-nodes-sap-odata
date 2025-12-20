import { IExecuteFunctions, IDataObject, INode, INodeExecutionData } from 'n8n-workflow';
export declare function getEntitySet(context: IExecuteFunctions, itemIndex: number): string;
export declare function getServicePath(context: IExecuteFunctions, itemIndex: number): string;
export declare function validateAndParseJson(input: string, fieldName: string, node: INode): IDataObject | IDataObject[];
export declare function validateAndFormatKey(key: string | IDataObject, node: INode): string;
export declare function applyTypeConversion(data: IDataObject | IDataObject[], context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[];
export declare function formatSuccessResponse(data: IDataObject | IDataObject[], operation: string): INodeExecutionData[];
export declare function handleOperationError(error: unknown, context: IExecuteFunctions, itemIndex: number, continueOnFail: boolean): INodeExecutionData[];
export declare function buildResourcePath(entitySet: string, entityKey?: string, navigationProperty?: string): string;
export declare function extractResult(response: IDataObject): IDataObject | IDataObject[];
export declare function getQueryOptions(context: IExecuteFunctions, itemIndex: number): IDataObject;
export declare function validateNavigationProperties(navProperties: Record<string, IDataObject | IDataObject[]>, node: INode): void;
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
export declare function parseParameterType(typeStr: string, node: INode): FunctionParameterType;
