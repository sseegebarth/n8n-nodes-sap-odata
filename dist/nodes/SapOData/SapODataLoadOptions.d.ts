import { ILoadOptionsFunctions, INodeListSearchResult, INodePropertyOptions } from 'n8n-workflow';
export declare const sapODataLoadOptions: {
    getServices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
    getDiscoveredServices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
    getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
    getFunctionImports(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
};
export declare const sapODataListSearch: {
    servicePathSearch(this: ILoadOptionsFunctions, filter?: string, _paginationToken?: unknown): Promise<INodeListSearchResult>;
    entitySetSearch(this: ILoadOptionsFunctions, filter?: string, _paginationToken?: unknown): Promise<INodeListSearchResult>;
};
