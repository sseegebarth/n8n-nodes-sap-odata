import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * SAP OData Webhook API Credentials
 *
 * Optional credentials for webhook authentication
 */
export class SapOdataWebhookApi implements ICredentialType {
	name = 'sapOdataWebhookApi';
	displayName = 'SAP OData Webhook API';
	documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
	properties: INodeProperties[] = [
		{
			displayName: 'Authentication Token',
			name: 'authToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'your-secret-webhook-token',
			description: 'Secret token used to authenticate incoming webhook requests from SAP',
			required: true,
		},
		{
			displayName: 'Token Header Name',
			name: 'headerName',
			type: 'string',
			default: 'X-SAP-Signature',
			placeholder: 'X-SAP-Signature',
			description: 'Name of the HTTP header that will contain the authentication token',
		},
	];
}
