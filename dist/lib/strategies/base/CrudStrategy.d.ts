import { IExecuteFunctions, INode, IDataObject, INodeExecutionData } from 'n8n-workflow';
export declare abstract class CrudStrategy {
    protected getServicePath(context: IExecuteFunctions, itemIndex: number): string;
    protected getEntitySet(context: IExecuteFunctions, itemIndex: number): string;
    protected validateAndFormatKey(key: string, node: INode): string;
    protected getQueryOptions(context: IExecuteFunctions, itemIndex: number): IDataObject;
    protected extractResult(response: unknown): unknown;
    protected validateAndParseJson(dataString: string, fieldName: string, node: INode): IDataObject;
    protected formatSuccessResponse(data: unknown, itemIndex: number): INodeExecutionData[];
    protected handleOperationError(error: Error, operation: string, itemIndex: number, continueOnFail?: boolean): INodeExecutionData[];
    protected buildResourcePath(entitySet: string, entityKey?: string): string;
    protected logOperation(operation: string, details: IDataObject): void;
    protected applyTypeConversion(context: IExecuteFunctions, itemIndex: number, data: unknown): unknown;
}
