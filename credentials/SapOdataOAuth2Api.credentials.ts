import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * SAP OData OAuth2 API Credentials
 *
 * Extends n8n's built-in OAuth2 credential type for SAP Cloud systems.
 * This uses n8n's native OAuth helpers for token management.
 */
export class SapOdataOAuth2Api implements ICredentialType {
	name = 'sapOdataOAuth2Api';
	extends = ['oAuth2Api'];
	displayName = 'Avanai SAP OData OAuth2 API';
	documentationUrl = 'https://help.sap.com/viewer/product/SAP_GATEWAY/';
	icon = 'file:../nodes/SapOData/sap.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://your-sap-system.com:8443',
			description: 'The SAP system URL including protocol and port',
			required: true,
		},
		{
			displayName: 'SAP Client',
			name: 'sapClient',
			type: 'string',
			default: '',
			placeholder: '100',
			description: 'SAP Client number (Mandant). Not required for SAP Cloud.',
		},
		{
			displayName: 'SAP Language',
			name: 'sapLanguage',
			type: 'string',
			default: '',
			placeholder: 'EN',
			description: 'SAP language code (e.g., EN, DE, FR)',
		},
		// eslint-disable-next-line @n8n/community-nodes/credential-password-field -- this is a boolean, not a password
		{
			displayName: 'Ignore SSL Issues',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation fails. Only use in development environments.',
		},
	];
}
