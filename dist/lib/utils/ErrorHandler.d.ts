import { INode } from 'n8n-workflow';
import { IErrorContext } from '../types';
export declare class ODataErrorHandler {
    static handleApiError(error: unknown, node: INode, context?: IErrorContext): never;
    static handleValidationError(message: string, node: INode, itemIndex?: number): never;
    static handleOperationError(operation: string, error: any, node: INode, itemIndex?: number): never;
    static wrapAsync<T>(operation: () => Promise<T>, node: INode, context?: IErrorContext): Promise<T>;
}
