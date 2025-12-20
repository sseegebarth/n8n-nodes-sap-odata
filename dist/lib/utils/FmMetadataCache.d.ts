import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { IZatwFmMetadata, IZatwFmSearchResult, IZatwIdocTypeMetadata } from '../types/zatw';
type CacheContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;
export declare class FmMetadataCache {
    static get(context: CacheContext, host: string, functionName: string): Promise<IZatwFmMetadata | null>;
    static set(context: CacheContext, host: string, functionName: string, metadata: IZatwFmMetadata, ttl?: number): Promise<void>;
    static invalidate(context: CacheContext, host: string, functionName?: string): Promise<void>;
    static getSearchResults(context: CacheContext, host: string, pattern: string): Promise<IZatwFmSearchResult[] | null>;
    static setSearchResults(context: CacheContext, host: string, pattern: string, results: IZatwFmSearchResult[], ttl?: number): Promise<void>;
    static getIdocType(context: CacheContext, host: string, idocType: string): Promise<IZatwIdocTypeMetadata | null>;
    static setIdocType(context: CacheContext, host: string, idocType: string, metadata: IZatwIdocTypeMetadata, ttl?: number): Promise<void>;
    static cleanup(context: CacheContext): Promise<void>;
    private static buildKey;
    private static normalizeHost;
    private static getCache;
    private static setCache;
}
export {};
