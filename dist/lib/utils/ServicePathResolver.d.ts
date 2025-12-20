import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
type IContextType = IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions;
export declare function resolveServicePath(context: IContextType, customServicePath?: string, itemIndex?: number): string;
export {};
