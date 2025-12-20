import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
export declare class ODataVersionHelper {
    private static versionCache;
    static getODataVersion(context: IExecuteFunctions): Promise<'v2' | 'v4'>;
    private static detectVersion;
    private static isV4Response;
    private static isV2Response;
    static getVersionSpecificParams(version: 'v2' | 'v4', params: IDataObject): IDataObject;
    static extractData(response: any, version: 'v2' | 'v4'): any;
    static getTotalCount(response: any, version: 'v2' | 'v4'): number | undefined;
    static getNextLink(response: any, version: 'v2' | 'v4'): string | undefined;
    static parseError(error: any, version: 'v2' | 'v4'): string;
    static formatEntityKey(key: string, version: 'v2' | 'v4'): string;
    static clearCache(): void;
}
