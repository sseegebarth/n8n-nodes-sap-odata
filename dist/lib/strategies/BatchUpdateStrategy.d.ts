import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { CrudStrategy } from './base/CrudStrategy';
export declare class BatchUpdateStrategy extends CrudStrategy {
    execute(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
}
