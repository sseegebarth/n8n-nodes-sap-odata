import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { IEntityType, IParsedMetadata } from './MetadataParser';
export declare function fetchMetadata(context: ILoadOptionsFunctions, host: string, servicePath: string): Promise<IParsedMetadata>;
export declare function getEntityTypeForSet(metadata: IParsedMetadata, entitySetName: string): IEntityType | undefined;
export declare function getEntityFields(context: ILoadOptionsFunctions, entitySetName: string): Promise<INodePropertyOptions[]>;
export declare function getNavigationProperties(context: ILoadOptionsFunctions, entitySetName: string): Promise<INodePropertyOptions[]>;
