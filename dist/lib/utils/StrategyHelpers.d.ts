import { IExecuteFunctions, IDataObject, INode } from 'n8n-workflow';
export declare function getEntitySet(context: IExecuteFunctions, itemIndex: number): string;
export declare function validateAndParseJson(input: string | IDataObject | IDataObject[], fieldName: string, node: INode): IDataObject | IDataObject[];
export declare function validateAndFormatKey(key: string | IDataObject, node: INode): string;
export declare function applyTypeConversion(data: IDataObject | IDataObject[], context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[];
export declare function buildResourcePath(entitySet: string, entityKey?: string): string;
export declare function extractResult(response: IDataObject): IDataObject | IDataObject[];
export declare function getQueryOptions(context: IExecuteFunctions, itemIndex: number): IDataObject;
