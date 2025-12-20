import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { CrudStrategy } from './base/CrudStrategy';
import { IOperationStrategy } from './IOperationStrategy';
export declare class GetAllEntitiesStrategy extends CrudStrategy implements IOperationStrategy {
    execute(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
}
