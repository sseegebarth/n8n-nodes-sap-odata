import { IDataObject } from 'n8n-workflow';
import { IODataQueryOptions } from '../types';
export declare function escapeODataString(value: string): string;
export declare function buildODataFilter(filters: IDataObject): string;
export declare function normalizeODataOptions(options: any): IODataQueryOptions;
export declare function buildODataQuery(options: IODataQueryOptions): IDataObject;
export declare function buildEncodedQueryString(params: Record<string, any>, separator?: string): string;
export declare function parseMetadataForEntitySets(metadataXml: string): string[];
export declare function parseMetadataForFunctionImports(metadataXml: string): string[];
