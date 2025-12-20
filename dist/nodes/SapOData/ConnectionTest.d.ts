import { ICredentialDataDecryptedObject, ICredentialTestFunctions, INodeCredentialTestResult } from 'n8n-workflow';
export interface IConnectionTestResult {
    status: 'OK' | 'Error';
    message: string;
    details?: {
        catalogServiceAvailable: boolean;
        metadataAccessible: boolean;
        entitySetCount?: number;
        entitySets?: string[];
        responseTime: number;
        sapClient?: string;
        sapLanguage?: string;
    };
}
export declare function testSapODataConnection(this: ICredentialTestFunctions, credential: ICredentialDataDecryptedObject): Promise<INodeCredentialTestResult>;
