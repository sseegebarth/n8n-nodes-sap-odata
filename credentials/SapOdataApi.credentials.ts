import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SapOdataApi implements ICredentialType {
	name = 'sapOdataApi';
	displayName = 'SAP OData API';
	documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://your-sap-system.com',
			description: 'The SAP system URL (including protocol)',
			required: true,
		},
		{
			displayName: 'Service Path',
			name: 'servicePath',
			type: 'string',
			default: '/sap/opu/odata/sap/',
			placeholder: '/sap/opu/odata/sap/',
			description: 'The OData service path',
			required: true,
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'options',
			options: [
				{
					name: 'None',
					value: 'none',
					description: 'No authentication (for public OData services)',
				},
				{
					name: 'Basic Auth',
					value: 'basicAuth',
				},
			],
			default: 'none',
			description: 'Authentication method to use',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					authentication: ['basicAuth'],
				},
			},
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			displayOptions: {
				show: {
					authentication: ['basicAuth'],
				},
			},
			required: true,
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation is not possible',
			hint: '⚠️ SECURITY WARNING: Only use in development environments! Production systems should always use valid SSL certificates. Disabling SSL validation exposes your connection to man-in-the-middle attacks.',
		},
		{
			displayName: 'SAP Client',
			name: 'sapClient',
			type: 'string',
			default: '',
			placeholder: '100',
			description: 'SAP Client number (Mandant). Will be sent as sap-client header.',
			hint: 'Common SAP client numbers: 100 (DEV), 200 (QA), 300 (PROD)',
		},
		{
			displayName: 'SAP Language',
			name: 'sapLanguage',
			type: 'string',
			default: '',
			placeholder: 'EN',
			description: 'SAP language code. Will be sent as sap-language header.',
			hint: 'Common language codes: EN (English), DE (German), FR (French), ES (Spanish)',
		},
		{
			displayName: 'Custom Headers',
			name: 'customHeaders',
			type: 'json',
			default: '{}',
			description: 'Additional HTTP headers to send with every request (as JSON object)',
			placeholder: '{"X-Custom-Header": "value"}',
		},
	];

	// Conditional authentication based on authentication type
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.host}}{{$credentials.servicePath}}',
			url: '',
			method: 'GET',
		},
	};
}
