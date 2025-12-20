import { INodeProperties } from 'n8n-workflow';
export declare function createTextField(name: string, displayName: string, description: string, options?: {
    required?: boolean;
    placeholder?: string;
    default?: string;
    displayOptions?: any;
    typeOptions?: any;
}): INodeProperties;
export declare function createNumberField(name: string, displayName: string, description: string, options?: {
    default?: number;
    min?: number;
    max?: number;
    required?: boolean;
    displayOptions?: any;
}): INodeProperties;
export declare function createBooleanField(name: string, displayName: string, description: string, defaultValue?: boolean, displayOptions?: any): INodeProperties;
export declare function createOptionsField(name: string, displayName: string, description: string, options: Array<{
    name: string;
    value: string;
    description?: string;
}>, defaultValue?: string, displayOptions?: any): INodeProperties;
export declare function createMultiOptionsField(name: string, displayName: string, description: string, options: Array<{
    name: string;
    value: string;
    description?: string;
}>, defaultValues?: string[], displayOptions?: any): INodeProperties;
export declare function createCollectionField(name: string, displayName: string, description: string, properties: INodeProperties[], options?: {
    default?: any;
    displayOptions?: any;
    placeholder?: string;
}): INodeProperties;
export declare function createFixedCollectionField(name: string, displayName: string, description: string, items: Array<{
    name: string;
    displayName: string;
    values: INodeProperties[];
}>, displayOptions?: any): INodeProperties;
export declare function createJsonField(name: string, displayName: string, description: string, options?: {
    default?: string;
    required?: boolean;
    displayOptions?: any;
    alwaysOpenEditWindow?: boolean;
}): INodeProperties;
export declare function createResourceLocatorField(name: string, displayName: string, description: string, modes: Array<'id' | 'url' | 'name'>, displayOptions?: any): INodeProperties;
export declare function createDisplayOptions(show?: Record<string, any>, hide?: Record<string, any>): any;
export declare function createSapFieldDescription(fieldName: string, sapType: string, nullable: boolean, maxLength?: number): string;
export declare function createPaginationOptions(): INodeProperties[];
export declare function createRetryOptions(): INodeProperties[];
