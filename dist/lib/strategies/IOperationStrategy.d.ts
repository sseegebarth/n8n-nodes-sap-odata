import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
export interface IOperationStrategy {
    execute(context: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]>;
}
