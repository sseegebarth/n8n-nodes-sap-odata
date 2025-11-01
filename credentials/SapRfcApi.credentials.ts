import {
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SapRfcApi implements ICredentialType {
	name = 'sapRfcApi';
	displayName = 'SAP RFC/BAPI API';
	documentationUrl = 'https://github.com/yourusername/n8n-nodes-sap-odata';
	properties: INodeProperties[] = [
		{
			displayName: 'Connection Type',
			name: 'connectionType',
			type: 'options',
			options: [
				{
					name: 'Direct Application Server',
					value: 'direct',
					description: 'Connect directly to SAP application server',
				},
				{
					name: 'Load Balancing',
					value: 'loadBalancing',
					description: 'Connect via message server (load balancing)',
				},
			],
			default: 'direct',
		},

		// ==============================================
		//         Direct Connection Parameters
		// ==============================================
		{
			displayName: 'Application Server Host',
			name: 'ashost',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['direct'],
				},
			},
			description: 'SAP application server hostname or IP address',
			placeholder: '192.168.1.100',
		},
		{
			displayName: 'System Number',
			name: 'sysnr',
			type: 'string',
			default: '00',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['direct'],
				},
			},
			description: 'SAP system number (2 digits, e.g., 00, 01)',
			placeholder: '00',
		},

		// ==============================================
		//         Load Balancing Parameters
		// ==============================================
		{
			displayName: 'Message Server Host',
			name: 'mshost',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['loadBalancing'],
				},
			},
			description: 'Message server hostname',
		},
		{
			displayName: 'Message Server Service',
			name: 'msserv',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					connectionType: ['loadBalancing'],
				},
			},
			description: 'Message server service (optional)',
		},
		{
			displayName: 'System ID',
			name: 'sysid',
			type: 'string',
			default: '',
			required: true,
			displayOptions: {
				show: {
					connectionType: ['loadBalancing'],
				},
			},
			description: 'SAP system ID (3 characters)',
			placeholder: 'DEV',
		},
		{
			displayName: 'Logon Group',
			name: 'group',
			type: 'string',
			default: 'PUBLIC',
			displayOptions: {
				show: {
					connectionType: ['loadBalancing'],
				},
			},
			description: 'Logon group',
		},

		// ==============================================
		//         Common Parameters
		// ==============================================
		{
			displayName: 'SAP Client',
			name: 'client',
			type: 'string',
			default: '100',
			required: true,
			description: 'SAP client number (Mandant)',
		},
		{
			displayName: 'Username',
			name: 'user',
			type: 'string',
			default: '',
			required: true,
			description: 'SAP username',
		},
		{
			displayName: 'Password',
			name: 'passwd',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'SAP password',
		},
		{
			displayName: 'Language',
			name: 'lang',
			type: 'string',
			default: 'EN',
			description: 'SAP logon language (e.g., EN, DE, FR)',
		},

		// ==============================================
		//         Advanced Options
		// ==============================================
		{
			displayName: 'SAProuter String',
			name: 'saprouter',
			type: 'string',
			default: '',
			placeholder: '/H/111.22.33.44/S/3299/H/',
			description: 'SAProuter connection string (if connecting through SAProuter)',
		},
		{
			displayName: 'Use SNC (Secure Network Communication)',
			name: 'useSnc',
			type: 'boolean',
			default: false,
			description: 'Whether to use SNC for secure communication',
		},
		{
			displayName: 'SNC Partner Name',
			name: 'sncPartnerName',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					useSnc: [true],
				},
			},
			description: 'SNC partner name',
		},
		{
			displayName: 'SNC QoP (Quality of Protection)',
			name: 'sncQop',
			type: 'options',
			options: [
				{
					name: '1 - Authentication Only',
					value: '1',
				},
				{
					name: '2 - Integrity Protection',
					value: '2',
				},
				{
					name: '3 - Privacy Protection',
					value: '3',
				},
				{
					name: '8 - Default',
					value: '8',
				},
				{
					name: '9 - Maximum',
					value: '9',
				},
			],
			default: '3',
			displayOptions: {
				show: {
					useSnc: [true],
				},
			},
			description: 'Security level for SNC',
		},
		{
			displayName: 'SNC My Name',
			name: 'sncMyName',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					useSnc: [true],
				},
			},
			description: 'SNC name of your own system',
		},
		{
			displayName: 'Connection Timeout (seconds)',
			name: 'timeout',
			type: 'number',
			default: 30,
			description: 'Connection timeout in seconds',
		},
	];

	// Note: node-rfc test requires actual RFC SDK installation
	// We'll provide a simple validation instead
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			url: '',
		},
	};
}
