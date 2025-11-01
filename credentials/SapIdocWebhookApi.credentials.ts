import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SapIdocWebhookApi implements ICredentialType {
	name = 'sapIdocWebhookApi';
	displayName = 'SAP IDoc Webhook API';
	documentationUrl = 'https://github.com/yourusername/n8n-nodes-sap-odata';
	properties: INodeProperties[] = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Username for basic authentication',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Password for basic authentication',
		},
	];
}
