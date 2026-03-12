import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
export declare class ODataVersionHelper {
    private static versionCache;
    static getODataVersion(context: IExecuteFunctions): Promise<'v2' | 'v4'>;
    private static detectVersion;
    private static analyzeMetadataVersion;
    static getVersionSpecificParams(version: 'v2' | 'v4', params: IDataObject): IDataObject;
    static extractData(response: Record<string, unknown>, version: 'v2' | 'v4'): unknown;
    static getTotalCount(response: Record<string, unknown>, version: 'v2' | 'v4'): number | undefined;
    static parseError(error: Record<string, unknown>, version: 'v2' | 'v4'): string;
    static formatEntityKey(key: string, version: 'v2' | 'v4'): string;
    static clearCache(): void;
}
