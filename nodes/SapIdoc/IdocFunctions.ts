/**
 * IdocFunctions - Core IDoc processing functions
 *
 * Handles:
 * - IDoc XML generation from JSON
 * - IDoc transmission to SAP
 * - XML validation and formatting
 *
 * IMPORTANT: Uses native XML building (no external dependencies)
 * to maintain compatibility with n8n community node requirements.
 */

import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { LoggerAdapter } from '../Shared/utils/LoggerAdapter';

export interface IIdocControlRecord {
	DOCNUM?: string;
	MESTYP?: string;
	IDOCTYP?: string;
	SNDPOR?: string;
	SNDPRT?: string;
	SNDPRN?: string;
	RCVPOR?: string;
	RCVPRT?: string;
	RCVPRN?: string;
	DIRECT?: string;
	[key: string]: any;
}

export interface IIdocDataRecord {
	segmentType: string;
	parentId?: string;
	fields: Record<string, any>;
}

export interface IIdocData {
	idocType: string;
	controlRecord: IIdocControlRecord;
	dataRecords: IIdocDataRecord[];
}

/**
 * Build IDoc XML from structured data using native string building
 */
export function buildIdocXml(idocData: IIdocData): string {
	const { idocType, controlRecord, dataRecords } = idocData;

	// Default control record values
	const defaultControlRecord: IIdocControlRecord = {
		TABNAM: 'EDI_DC40',
		MANDT: '',
		DOCNUM: controlRecord.DOCNUM || '',
		DOCREL: '',
		STATUS: '',
		DIRECT: controlRecord.DIRECT || '1', // 1 = Inbound
		OUTMOD: '',
		IDOCTYP: controlRecord.IDOCTYP || idocType,
		MESTYP: controlRecord.MESTYP || idocType,
		SNDPOR: controlRecord.SNDPOR || 'SAPSND',
		SNDPRT: controlRecord.SNDPRT || 'LS',
		SNDPRN: controlRecord.SNDPRN || '',
		SNDSAD: '',
		SNDLAD: '',
		RCVPOR: controlRecord.RCVPOR || 'SAPRCV',
		RCVPRT: controlRecord.RCVPRT || 'LS',
		RCVPRN: controlRecord.RCVPRN || '',
		RCVSAD: '',
		RCVLAD: '',
		CREDAT: '',
		CRETIM: '',
		SERIAL: '',
		...controlRecord,
	};

	// Build XML header
	let xml = '<?xml version="1.0" encoding="UTF-8"?>';

	// Root element with IDoc type
	xml += `<${idocType}>`;

	// IDOC container
	xml += '<IDOC BEGIN="1">';

	// Control record (EDI_DC40)
	xml += '<EDI_DC40 SEGMENT="1">';
	for (const [key, value] of Object.entries(defaultControlRecord)) {
		xml += `<${key}>${escapeXmlValue(String(value || ''))}</${key}>`;
	}
	xml += '</EDI_DC40>';

	// Data records (segments)
	for (const record of dataRecords) {
		xml += `<${record.segmentType} SEGMENT="1">`;
		for (const [key, value] of Object.entries(record.fields)) {
			xml += `<${key}>${escapeXmlValue(String(value || ''))}</${key}>`;
		}
		xml += `</${record.segmentType}>`;
	}

	// Close IDOC and root
	xml += '</IDOC>';
	xml += `</${idocType}>`;

	return xml;
}

/**
 * Escape XML special characters in element values
 */
function escapeXmlValue(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Prepare IDoc data from node parameters
 */
export function prepareIdocData(this: IExecuteFunctions, itemIndex: number): IIdocData {
	const inputMode = this.getNodeParameter('inputMode', itemIndex) as string;
	const idocType = this.getNodeParameter('idocType', itemIndex) as string;
	const actualIdocType =
		idocType === 'custom'
			? (this.getNodeParameter('customIdocType', itemIndex) as string)
			: idocType;
	const options = this.getNodeParameter('options', itemIndex, {}) as any;

	let idocData: IIdocData;

	if (inputMode === 'json') {
		// Parse JSON input
		const jsonData = this.getNodeParameter('idocDataJson', itemIndex) as string;
		const parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
		idocData = {
			idocType: actualIdocType,
			controlRecord: parsedData.controlRecord || {},
			dataRecords: parsedData.dataRecords || [],
		};
	} else if (inputMode === 'manual') {
		// Build from UI form
		const controlRecord = this.getNodeParameter('controlRecord', itemIndex, {}) as any;
		const dataSegments = this.getNodeParameter('dataSegments', itemIndex, {}) as any;

		idocData = {
			idocType: actualIdocType,
			controlRecord: controlRecord.fields || {},
			dataRecords: (dataSegments.segment || []).map((seg: any) => ({
				segmentType: seg.segmentType,
				parentId: seg.parentId,
				fields: typeof seg.fields === 'string' ? JSON.parse(seg.fields) : seg.fields,
			})),
		};
	} else {
		throw new NodeOperationError(
			this.getNode(),
			`Unsupported input mode: ${inputMode}`,
			{ itemIndex },
		);
	}

	// Generate DOCNUM if requested
	if (options.generateDocnum !== false) {
		idocData.controlRecord.DOCNUM = generateDocnum();
	} else if (options.docnum) {
		idocData.controlRecord.DOCNUM = options.docnum;
	}

	// Set direction
	if (options.direction) {
		idocData.controlRecord.DIRECT = options.direction;
	}

	return idocData;
}

/**
 * Generate unique DOCNUM
 */
function generateDocnum(): string {
	// Generate 16-digit unique number using timestamp + random
	const timestamp = Date.now().toString().slice(-10);
	const random = Math.floor(Math.random() * 1000000)
		.toString()
		.padStart(6, '0');
	return timestamp + random;
}

/**
 * Send IDoc to SAP system
 */
export async function sendIdoc(this: IExecuteFunctions, itemIndex: number) {
	const credentials = await this.getCredentials('sapIdocApi');
	const options = this.getNodeParameter('options', itemIndex, {}) as any;
	const inputMode = this.getNodeParameter('inputMode', itemIndex) as string;

	let xml: string;

	if (inputMode === 'xml') {
		// Use provided XML directly
		xml = this.getNodeParameter('idocXml', itemIndex) as string;

		// Remove whitespace if requested
		if (options.removeWhitespace !== false) {
			xml = xml.replace(/>\s+</g, '><');
		}
	} else {
		// Build XML from JSON or manual input
		const idocData = prepareIdocData.call(this, itemIndex);
		xml = buildIdocXml(idocData);
	}

	// Validate XML if requested
	if (options.validateXml !== false) {
		validateIdocXml(xml);
	}

	// Build URL
	const host = credentials.host as string;
	const port = credentials.port as number;
	const client = credentials.client as string;

	let baseUrl = host;
	if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
		baseUrl = `https://${baseUrl}`;
	}

	// Add port if not already in host
	if (!host.includes(':') && port) {
		baseUrl = `${baseUrl}:${port}`;
	}

	const url = `${baseUrl}/sap/bc/idoc_xml?sap-client=${client}`;

	// Prepare request options
	const requestOptions: any = {
		method: 'POST',
		url,
		body: xml,
		headers: {
			'Content-Type': 'application/xml',
			Accept: 'text/html',
		},
		auth: {
			username: credentials.username as string,
			password: credentials.password as string,
		},
		rejectUnauthorized: !credentials.allowUnauthorizedCerts,
	};

	// Send IDoc
	try {
		const response = await this.helpers.request(requestOptions);

		// Check for success response
		const success = response.includes('IDoc-XML-inbound ok') || response.includes('<h1>IDoc-XML-inbound ok</h1>');

		if (!success) {
			throw new Error(`SAP returned unexpected response: ${response.substring(0, 200)}`);
		}

		return {
			success: true,
			message: 'IDoc sent successfully',
			response: response.trim(),
			url,
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to send IDoc: ${error instanceof Error ? error.message : String(error)}`,
			{ itemIndex },
		);
	}
}

/**
 * Validate IDoc XML structure
 */
function validateIdocXml(xml: string): void {
	// Check for required elements
	if (!xml.includes('<IDOC')) {
		throw new Error('Invalid IDoc XML: Missing <IDOC> element');
	}

	if (!xml.includes('<EDI_DC40')) {
		throw new Error('Invalid IDoc XML: Missing <EDI_DC40> control record');
	}

	if (!xml.includes('SEGMENT="1"') && !xml.includes("SEGMENT='1'")) {
		throw new Error('Invalid IDoc XML: Segments must have SEGMENT="1" attribute');
	}

	// Check for whitespace (common error)
	if (/>\s+</.test(xml)) {
		LoggerAdapter.warn('IDoc XML contains whitespace between tags - this may cause errors in SAP', {
			module: 'IdocFunctions',
			operation: 'validateIdocXml',
		});
	}

	// Check encoding
	if (xml.includes('encoding=') && !xml.includes('UTF-8') && !xml.includes('utf-8')) {
		LoggerAdapter.warn('IDoc XML should use UTF-8 encoding', {
			module: 'IdocFunctions',
			operation: 'validateIdocXml',
		});
	}
}

/**
 * Get IDoc template for a specific type
 */
export function getIdocTemplate(idocType: string): IIdocData {
	const templates: Record<string, IIdocData> = {
		DEBMAS: {
			idocType: 'DEBMAS06',
			controlRecord: {
				MESTYP: 'DEBMAS',
				IDOCTYP: 'DEBMAS06',
				SNDPOR: 'SAPSND',
				SNDPRT: 'LS',
				SNDPRN: 'N8N',
				RCVPOR: 'SAPRCV',
				RCVPRT: 'LS',
				RCVPRN: 'SAP',
			},
			dataRecords: [
				{
					segmentType: 'E1KNA1M',
					fields: {
						MSGFN: 'D', // D = Create
						KUNNR: '', // Customer number
						NAME1: '', // Name
						LAND1: '', // Country
						SPRAS: 'EN', // Language
						ORT01: '', // City
						PSTLZ: '', // Postal code
						STRAS: '', // Street
					},
				},
			],
		},
		MATMAS: {
			idocType: 'MATMAS05',
			controlRecord: {
				MESTYP: 'MATMAS',
				IDOCTYP: 'MATMAS05',
				SNDPOR: 'SAPSND',
				SNDPRT: 'LS',
				SNDPRN: 'N8N',
				RCVPOR: 'SAPRCV',
				RCVPRT: 'LS',
				RCVPRN: 'SAP',
			},
			dataRecords: [
				{
					segmentType: 'E1MARAM',
					fields: {
						MSGFN: 'D', // D = Create
						MATNR: '', // Material number
						MTART: '', // Material type
						MBRSH: '', // Industry sector
						MEINS: '', // Base unit of measure
					},
				},
				{
					segmentType: 'E1MAKTM',
					fields: {
						MSGFN: 'D',
						SPRAS: 'EN', // Language
						MAKTX: '', // Material description
					},
				},
			],
		},
		ORDERS: {
			idocType: 'ORDERS05',
			controlRecord: {
				MESTYP: 'ORDERS',
				IDOCTYP: 'ORDERS05',
				SNDPOR: 'SAPSND',
				SNDPRT: 'LS',
				SNDPRN: 'N8N',
				RCVPOR: 'SAPRCV',
				RCVPRT: 'LS',
				RCVPRN: 'SAP',
			},
			dataRecords: [
				{
					segmentType: 'E1EDK01',
					fields: {
						BELNR: '', // Document number
						CURCY: 'USD', // Currency
						WKURS: '1.0', // Exchange rate
					},
				},
			],
		},
	};

	return (
		templates[idocType] || {
			idocType: 'CUSTOM',
			controlRecord: {
				MESTYP: idocType,
				IDOCTYP: idocType,
				SNDPOR: 'SAPSND',
				SNDPRT: 'LS',
				SNDPRN: 'N8N',
				RCVPOR: 'SAPRCV',
				RCVPRT: 'LS',
				RCVPRN: 'SAP',
			},
			dataRecords: [],
		}
	);
}
