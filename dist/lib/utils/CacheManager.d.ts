import { IExecuteFunctions, ILoadOptionsFunctions, IHookFunctions } from 'n8n-workflow';
import { IMetadataCacheEntry, IServiceCatalogEntry } from '../types';
type IContextType = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;
export declare class CacheManager {
    private static accessCounter;
    private static readonly CLEANUP_INTERVAL;
    private static cleanupInProgress;
    private static getCacheKey;
    private static getCredentialId;
    private static maybeRunCleanup;
    static getCsrfToken(context: IContextType, host: string, servicePath: string, itemIndex?: number): Promise<string | null>;
    static setCsrfToken(context: IContextType, host: string, servicePath: string, token: string, itemIndex?: number): Promise<void>;
    static getMetadata(context: IContextType, host: string, servicePath: string, itemIndex?: number): Promise<IMetadataCacheEntry | null>;
    static setMetadata(context: IContextType, host: string, servicePath: string, entitySets: string[], functionImports: string[], itemIndex?: number): Promise<void>;
    static clearCache(context: IContextType, host: string, servicePath: string, itemIndex?: number): Promise<void>;
    static invalidateCacheOn404(context: IContextType, host: string, servicePath: string, itemIndex?: number): Promise<void>;
    static getServiceCatalog(context: IContextType, host: string, itemIndex?: number): Promise<IServiceCatalogEntry[] | null>;
    static setServiceCatalog(context: IContextType, host: string, services: any[], itemIndex?: number): Promise<void>;
    static clearAllCache(context: IContextType): void;
    static cleanupExpiredCache(context: IContextType): void;
}
export {};
