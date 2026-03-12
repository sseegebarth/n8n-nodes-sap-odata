import { IDataObject, INode } from 'n8n-workflow';
import { IODataQueryOptions } from '../types';
export declare function escapeODataString(value: string): string;
export declare function buildODataFilter(filters: IDataObject, node: INode): string;
export declare function normalizeODataOptions(options: IODataQueryOptions | Record<string, unknown>): IODataQueryOptions;
export declare function buildODataQuery(options: IODataQueryOptions, node?: INode): IDataObject;
export declare function buildEncodedQueryString(params: Record<string, unknown>, separator?: string): string;
export declare function parseMetadataForEntitySets(metadataXml: string): string[];
export interface IODataCallable {
    name: string;
    type: 'FunctionImport' | 'Action' | 'Function';
}
export declare function parseMetadataForCallables(metadataXml: string): IODataCallable[];
export declare function parseMetadataForFunctionImports(metadataXml: string): string[];
