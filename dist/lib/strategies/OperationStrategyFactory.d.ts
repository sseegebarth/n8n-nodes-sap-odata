import { IOperationStrategy } from './IOperationStrategy';
export declare class OperationStrategyFactory {
    static getEntityStrategy(operation: string): IOperationStrategy;
    static getFunctionImportStrategy(): IOperationStrategy;
    static getStrategy(resource: string, operation?: string): IOperationStrategy;
}
