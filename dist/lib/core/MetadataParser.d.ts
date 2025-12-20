export interface IEntityProperty {
    name: string;
    type: string;
    nullable?: boolean;
    maxLength?: string;
    precision?: string;
    scale?: string;
    isKey?: boolean;
}
export interface INavigationProperty {
    name: string;
    relationship: string;
    toRole: string;
    fromRole: string;
    targetEntityType?: string;
}
export interface IEntityType {
    name: string;
    properties: IEntityProperty[];
    navigationProperties: INavigationProperty[];
    keys: string[];
}
export interface IEntitySet {
    name: string;
    entityType: string;
}
export interface IParsedMetadata {
    entityTypes: Map<string, IEntityType>;
    entitySets: Map<string, IEntitySet>;
    associations: Map<string, any>;
}
export declare class MetadataParser {
    static parseMetadata(xml: string): Promise<IParsedMetadata>;
    private static extractAttribute;
    private static stripNamespace;
    private static extractTags;
    private static parseEntityTypes;
    private static parseEntitySets;
    private static parseAssociations;
    private static resolveNavigationTargets;
    static getDisplayType(edmType: string): string;
    static buildFieldDescription(property: IEntityProperty): string;
}
