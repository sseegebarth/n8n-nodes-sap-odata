import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SapIdocApi implements ICredentialType {
	name = 'sapIdocApi';
	displayName = 'SAP IDoc API';
	documentationUrl = 'https://github.com/seeppp/n8n-nodes-sap-odata';
	properties: INodeProperties[] = [
		{
			displayName: 'SAP Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://your-sap-system.com',
			required: true,
			description: 'The SAP system hostname or IP address with protocol (http:// or https://)',
		},
		{
			displayName: 'SAP Client',
			name: 'client',
			type: 'string',
			default: '100',
			required: true,
			description: 'SAP client number (e.g., 100, 800)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'SAP username for authentication',
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
			description: 'SAP password for authentication',
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation fails',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 8000,
			description: 'SAP HTTP/HTTPS port (default: 8000 for HTTP, 44300 for HTTPS)',
		},
	];

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
			baseURL: '={{$credentials.host}}:{{$credentials.port}}',
			url: '/sap/bc/idoc_xml',
			method: 'GET',
			qs: {
				'sap-client': '={{$credentials.client}}',
			},
			skipSslCertificateValidation: '={{$credentials.allowUnauthorizedCerts}}',
		},
	};
}
