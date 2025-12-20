import { IDataObject } from 'n8n-workflow';
export interface IPaginationResult {
    data: IDataObject[];
    partial?: boolean;
    limitReached?: boolean;
    errors?: Array<{
        page: number;
        error: string;
        itemsFetchedSoFar: number;
    }>;
    message?: string;
}
export interface IPaginationConfig {
    propertyName?: string;
    continueOnFail?: boolean;
    maxItems?: number;
}
export declare function extractItemsFromResponse(responseData: any, propertyName?: string): any[];
export declare function extractNextLink(responseData: any): string | undefined;
export declare function fetchAllItems(requestFunction: (query?: IDataObject, uri?: string) => Promise<any>, config?: IPaginationConfig): Promise<IDataObject[] | IPaginationResult>;
export declare function streamAllItems(requestFunction: (query?: IDataObject, uri?: string) => Promise<any>, config?: IPaginationConfig): AsyncGenerator<IDataObject, void, undefined>;
