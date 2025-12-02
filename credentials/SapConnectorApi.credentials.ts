import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * SAP Connector API Credentials
 *
 * HTTP-based credentials for connecting to SAP via ZATW (Z ABAP Toolbox Wrapper).
 * This enables RFC/BAPI and IDoc operations without native dependencies.
 */
export class SapConnectorApi implements ICredentialType {
	name = 'sapConnectorApi';
	displayName = 'SAP Connector API';
	documentationUrl = 'https://github.com/segebarth/n8n-nodes-sap-connector';
	properties: INodeProperties[] = [
		{
			displayName: 'SAP Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://sap-system.example.com:8443',
			description: 'The SAP system URL including protocol and port (e.g., https://sap-server.com:8443)',
			required: true,
		},
		{
			displayName: 'Client',
			name: 'client',
			type: 'string',
			default: '100',
			placeholder: '100',
			description: 'SAP Client number (Mandant)',
			required: true,
			hint: 'Common SAP client numbers: 100 (DEV), 200 (QA), 300 (PROD)',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			placeholder: 'SAP_USER',
			description: 'SAP system username',
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
			description: 'SAP system password',
			required: true,
		},
		{
			displayName: 'Language',
			name: 'language',
			type: 'string',
			default: 'EN',
			placeholder: 'EN',
			description: 'SAP logon language code',
			hint: 'Common language codes: EN (English), DE (German), FR (French), ES (Spanish)',
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation is not possible',
			hint: '⚠️ SECURITY WARNING: Only use in development environments! Production systems should always use valid SSL certificates. Disabling SSL validation exposes your connection to man-in-the-middle attacks.',
		},
	];

	/**
	 * Basic Authentication for SAP
	 */
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};

	/**
	 * Test connection by checking ZATW health endpoint
	 * This verifies:
	 * 1. Network connectivity to SAP system
	 * 2. Valid credentials
	 * 3. ZATW service is installed and activated
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.host}}',
			url: '/sap/bc/zatw/health',
			method: 'GET',
			skipSslCertificateValidation: '={{$credentials.allowUnauthorizedCerts}}',
			headers: {
				'sap-client': '={{$credentials.client}}',
				'sap-language': '={{$credentials.language || "EN"}}',
				'Accept': 'application/json',
			},
		},
	};
}
