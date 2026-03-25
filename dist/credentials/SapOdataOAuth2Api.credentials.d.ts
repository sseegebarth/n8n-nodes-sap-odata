import { ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class SapOdataOAuth2Api implements ICredentialType {
    name: string;
    extends: string[];
    displayName: string;
    documentationUrl: string;
    icon: "file:sap.svg";
    properties: INodeProperties[];
}
