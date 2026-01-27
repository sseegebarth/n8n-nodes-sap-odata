import { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class SapOdataApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: "file:../nodes/SapOData/sap.svg";
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
