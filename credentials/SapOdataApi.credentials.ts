import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SapOdataApi implements ICredentialType {
	name = 'sapOdataApi';
	displayName = 'ATW SAP OData API';
	documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://your-sap-system.com:8443',
			description: 'The SAP system URL including protocol and port (e.g., https://sap-server.com:8443)',
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
					description: 'Username and password (On-Premise SAP systems)',
				},
				{
					name: 'OAuth 2.0 Client Credentials',
					value: 'oauth2ClientCredentials',
					description: 'OAuth 2.0 Client Credentials flow (SAP Cloud, SAP BTP)',
				},
			],
			default: 'none',
			description: 'Authentication method to use',
		},

		// ============================================
		// Basic Auth Fields
		// ============================================
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

		// ============================================
		// OAuth 2.0 Client Credentials Fields
		// ============================================
		{
			displayName: 'Token URL',
			name: 'oauthTokenUrl',
			type: 'string',
			default: '',
			placeholder: 'https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token',
			description: 'The OAuth 2.0 token endpoint URL. For SAP BTP: https://{subdomain}.authentication.{region}.hana.ondemand.com/oauth/token',
			displayOptions: {
				show: {
					authentication: ['oauth2ClientCredentials'],
				},
			},
			required: true,
			hint: 'Find this in your SAP BTP service key under "url" + "/oauth/token"',
		},
		{
			displayName: 'Client ID',
			name: 'oauthClientId',
			type: 'string',
			default: '',
			placeholder: 'sb-xxxx-xxxx-xxxx',
			description: 'The OAuth 2.0 Client ID from your service key',
			displayOptions: {
				show: {
					authentication: ['oauth2ClientCredentials'],
				},
			},
			required: true,
			hint: 'Find this in your SAP BTP service key under "clientid"',
		},
		{
			displayName: 'Client Secret',
			name: 'oauthClientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The OAuth 2.0 Client Secret from your service key',
			displayOptions: {
				show: {
					authentication: ['oauth2ClientCredentials'],
				},
			},
			required: true,
			hint: 'Find this in your SAP BTP service key under "clientsecret"',
		},
		{
			displayName: 'Scope',
			name: 'oauthScope',
			type: 'string',
			default: '',
			placeholder: 'API_BUSINESS_PARTNER_0001',
			description: 'OAuth 2.0 scope(s) - space-separated if multiple. Leave empty if not required.',
			displayOptions: {
				show: {
					authentication: ['oauth2ClientCredentials'],
				},
			},
			hint: 'Some SAP APIs require specific scopes. Check the API documentation.',
		},

		// ============================================
		// Common Fields
		// ============================================
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
			hint: 'Common SAP client numbers: 100 (DEV), 200 (QA), 300 (PROD). Not required for SAP Cloud.',
			displayOptions: {
				hide: {
					authentication: ['oauth2ClientCredentials'],
				},
			},
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
		{
			displayName: 'OData Version',
			name: 'version',
			type: 'options',
			options: [
				{
					name: 'Auto-Detect',
					value: 'auto',
					description: 'Automatically detect OData version from service metadata',
				},
				{
					name: 'OData V2',
					value: 'v2',
					description: 'Use OData V2 protocol (most common in SAP)',
				},
				{
					name: 'OData V4',
					value: 'v4',
					description: 'Use OData V4 protocol (newer SAP services)',
				},
			],
			default: 'auto',
			description: 'The OData protocol version. Auto-detect will determine the version from the service response.',
		},
	];

	// Conditional authentication based on authentication type
	// Note: OAuth 2.0 is handled manually in the node (not via n8n's built-in auth)
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
	 * Test connection - delegated to node for consistent URL validation
	 * The node's credentialTest method includes SSRF protection checks
	 */
	testedBy = 'sapODataCredentialTest';
}
