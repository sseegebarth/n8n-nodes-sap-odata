import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SapIdocWebhookApi implements ICredentialType {
	name = 'sapIdocWebhookApi';
	displayName = 'SAP IDoc Webhook API';
	documentationUrl = 'https://github.com/seeppp/n8n-nodes-sap-odata';
	properties: INodeProperties[] = [
		{
			displayName: 'Authentication Type',
			name: 'authType',
			type: 'options',
			options: [
				{
					name: 'HMAC Signature',
					value: 'hmac',
					description: 'Secure signature-based authentication (recommended)',
				},
				{
					name: 'Basic Authentication',
					value: 'basicAuth',
					description: 'Legacy username/password authentication (insecure)',
				},
			],
			default: 'hmac',
			description: 'Method to authenticate webhook requests',
		},
		// HMAC fields
		{
			displayName: 'Shared Secret',
			name: 'secret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			displayOptions: {
				show: {
					authType: ['hmac'],
				},
			},
			default: '',
			description: 'Shared secret for HMAC signature validation. This must match the secret configured in the SAP system.',
			placeholder: 'e.g., your-shared-secret-key',
			hint: 'Use a strong, randomly generated secret (at least 32 characters)',
			required: true,
		},
		{
			displayName: 'Signature Algorithm',
			name: 'algorithm',
			type: 'options',
			displayOptions: {
				show: {
					authType: ['hmac'],
				},
			},
			options: [
				{
					name: 'SHA-256',
					value: 'sha256',
					description: 'HMAC-SHA256 (recommended)',
				},
				{
					name: 'SHA-512',
					value: 'sha512',
					description: 'HMAC-SHA512 (more secure but slower)',
				},
			],
			default: 'sha256',
			description: 'Hash algorithm for HMAC signature',
		},
		// Basic Auth fields
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			displayOptions: {
				show: {
					authType: ['basicAuth'],
				},
			},
			default: '',
			description: 'Username for basic authentication',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			displayOptions: {
				show: {
					authType: ['basicAuth'],
				},
			},
			default: '',
			description: 'Password for basic authentication',
			required: true,
		},
	];
}
