import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { testSapODataConnection } from './ConnectionTest';
export declare class SapOData implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getServices(this: import("n8n-workflow").ILoadOptionsFunctions): Promise<import("n8n-workflow").INodePropertyOptions[]>;
            getDiscoveredServices(this: import("n8n-workflow").ILoadOptionsFunctions): Promise<import("n8n-workflow").INodePropertyOptions[]>;
            getEntitySets(this: import("n8n-workflow").ILoadOptionsFunctions): Promise<import("n8n-workflow").INodePropertyOptions[]>;
            getFunctionImports(this: import("n8n-workflow").ILoadOptionsFunctions): Promise<import("n8n-workflow").INodePropertyOptions[]>;
        };
        listSearch: {
            servicePathSearch(this: import("n8n-workflow").ILoadOptionsFunctions, filter?: string, _paginationToken?: unknown): Promise<import("n8n-workflow").INodeListSearchResult>;
            entitySetSearch(this: import("n8n-workflow").ILoadOptionsFunctions, filter?: string, _paginationToken?: unknown): Promise<import("n8n-workflow").INodeListSearchResult>;
            functionImportSearch(this: import("n8n-workflow").ILoadOptionsFunctions, filter?: string, _paginationToken?: unknown): Promise<import("n8n-workflow").INodeListSearchResult>;
        };
        credentialTest: {
            sapODataCredentialTest: typeof testSapODataConnection;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
