import { IDataObject } from 'n8n-workflow';
export interface INavigationConfig {
    path: string;
    select?: string[];
    filter?: string;
    expand?: INavigationConfig[];
    orderBy?: string;
    top?: number;
}
export interface IDeepInsertConfig {
    entity: IDataObject;
    navigationProperties: Record<string, IDataObject | IDataObject[]>;
}
export interface IAssociationLink {
    sourceEntitySet: string;
    sourceKey: string;
    navigationProperty: string;
    targetEntitySet: string;
    targetKey: string;
}
export declare class NavigationPropertyHelper {
    static buildExpandParameter(configs: INavigationConfig[]): string;
    private static buildSingleExpand;
    static parseNavigationPath(path: string): string[];
    static validateNavigationPath(path: string): {
        valid: boolean;
        error?: string;
    };
    static buildDeepInsertPayload(config: IDeepInsertConfig): IDataObject;
    private static cleanNavigationEntity;
    static buildNavigationUrl(baseEntitySet: string, entityKey: string, navigationPath: string): string;
    static buildAssociationLinkUrl(link: IAssociationLink): string;
    static buildAssociationTarget(targetEntitySet: string, targetKey: string): {
        uri: string;
    };
    static extractNavigationResults(response: unknown, navigationPath: string): unknown;
    static buildMultiLevelExpand(paths: string[]): string;
    static parseExpandParameter(expandParam: string): INavigationConfig[];
}
