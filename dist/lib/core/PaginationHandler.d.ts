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
export declare function extractItemsFromResponse(responseData: Record<string, unknown>, propertyName?: string): IDataObject[];
export declare function extractNextLink(responseData: Record<string, unknown>): string | undefined;
export declare function fetchAllItems(requestFunction: (query?: IDataObject, uri?: string) => Promise<Record<string, unknown>>, config?: IPaginationConfig): Promise<IDataObject[] | IPaginationResult>;
export declare function streamAllItems(requestFunction: (query?: IDataObject, uri?: string) => Promise<Record<string, unknown>>, config?: IPaginationConfig): AsyncGenerator<IDataObject, void, undefined>;
