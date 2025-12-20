import { INodeTypeDescription } from 'n8n-workflow';
export interface INodeVersionedType {
    currentVersion: number;
    nodeVersions: Record<number, INodeTypeDescription>;
    migrate: (nodeData: any, fromVersion: number) => any;
}
export interface IVersionMigration {
    from: number;
    to: number;
    migrate: (nodeData: any) => any;
}
export interface INodeVersionConfig {
    version: number;
    description: INodeTypeDescription;
    migrations?: IVersionMigration[];
}
export declare class NodeVersionManager {
    private versions;
    private latestVersion;
    registerVersion(config: INodeVersionConfig): void;
    getVersionDescription(version: number): INodeTypeDescription | undefined;
    getLatestVersion(): number;
    migrateNodeData(nodeData: any, fromVersion: number, toVersion?: number): any;
    private findMigration;
    needsMigration(nodeVersion: number): boolean;
    getMigrationPath(fromVersion: number): number[];
}
export declare const sapODataMigrations: IVersionMigration[];
export declare function createVersionedNode(_baseDescription: INodeTypeDescription, versionConfigs: INodeVersionConfig[]): INodeVersionedType;
export declare class VersionCompatibility {
    static isFeatureAvailable(feature: string, nodeVersion: number, featureVersionMap: Map<string, number>): boolean;
    static getDeprecationWarnings(nodeVersion: number): string[];
    static getBreakingChanges(fromVersion: number, toVersion: number): string[];
}
