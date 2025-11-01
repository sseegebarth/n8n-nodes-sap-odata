/**
 * IdocWebhookFunctions - IDoc webhook processing functions
 *
 * Handles:
 * - Parsing IDoc XML to JSON
 * - Building SAP-compliant responses
 * - IDoc validation
 */

import { parseStringPromise } from 'xml2js';

export interface IParsedIdoc {
	idocType?: string;
	controlRecord: Record<string, any>;
	dataRecords: IIdocSegment[];
	rawXml?: string;
	receivedAt: string;
	metadata: {
		segmentCount: number;
		messageType?: string;
		documentNumber?: string;
		sender?: string;
		receiver?: string;
	};
}

export interface IIdocSegment {
	segmentType: string;
	segmentNumber?: number;
	parentSegment?: string;
	fields: Record<string, any>;
}

export interface IParseOptions {
	extractSegmentsAsArray?: boolean;
	includeRawXml?: boolean;
}

/**
 * Parse IDoc XML to structured JSON
 */
export async function parseIdocXml(
	xml: string,
	options: IParseOptions = {},
): Promise<IParsedIdoc> {
	try {
		// Parse XML to JavaScript object
		const parsed = await parseStringPromise(xml, {
			explicitArray: false,
			mergeAttrs: true,
			tagNameProcessors: [stripNamespaces],
			attrNameProcessors: [stripNamespaces],
			trim: true,
		});

		// Extract root IDoc type
		const rootKeys = Object.keys(parsed);
		const idocType = rootKeys[0]; // First element is the IDoc type (e.g., DEBMAS06)

		if (!idocType) {
			throw new Error('No IDoc root element found');
		}

		const idocRoot = parsed[idocType];
		const idocElement = idocRoot.IDOC;

		if (!idocElement) {
			throw new Error('No IDOC element found in XML');
		}

		// Extract control record (EDI_DC40)
		const ediDc40 = idocElement.EDI_DC40;
		if (!ediDc40) {
			throw new Error('No EDI_DC40 control record found');
		}

		const controlRecord = flattenObject(ediDc40);

		// Extract data segments
		const dataRecords: IIdocSegment[] = [];
		const segmentKeys = Object.keys(idocElement).filter((key) => key !== 'EDI_DC40' && key !== 'BEGIN');

		if (options.extractSegmentsAsArray !== false) {
			// Extract all segments as flat array
			for (const segmentType of segmentKeys) {
				const segments = ensureArray(idocElement[segmentType]);
				for (const segment of segments) {
					dataRecords.push({
						segmentType,
						fields: flattenObject(segment),
					});
				}
			}
		} else {
			// Keep hierarchical structure
			for (const segmentType of segmentKeys) {
				const segments = idocElement[segmentType];
				dataRecords.push({
					segmentType,
					fields: flattenObject(segments),
				});
			}
		}

		// Build metadata
		const metadata = {
			segmentCount: dataRecords.length,
			messageType: controlRecord.MESTYP,
			documentNumber: controlRecord.DOCNUM,
			sender: controlRecord.SNDPRN,
			receiver: controlRecord.RCVPRN,
		};

		// Build result
		const result: IParsedIdoc = {
			idocType,
			controlRecord,
			dataRecords,
			receivedAt: new Date().toISOString(),
			metadata,
		};

		// Include raw XML if requested
		if (options.includeRawXml) {
			result.rawXml = xml;
		}

		return result;
	} catch (error) {
		throw new Error(`Failed to parse IDoc XML: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Build success response for SAP
 */
export function buildSuccessResponse(): any {
	return {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=UTF-8',
		},
		body: `<?xml version="1.0" encoding="UTF-8"?>
<html>
  <head>
    <title>IDoc-XML-inbound ok</title>
  </head>
  <body>
    <h1>IDoc-XML-inbound ok</h1>
  </body>
</html>`,
	};
}

/**
 * Build error response for SAP
 */
export function buildErrorResponse(errorMessage: string): any {
	return {
		status: 400,
		headers: {
			'Content-Type': 'text/html; charset=UTF-8',
		},
		body: `<?xml version="1.0" encoding="UTF-8"?>
<html>
  <head>
    <title>IDoc-XML-inbound error</title>
  </head>
  <body>
    <h1>IDoc-XML-inbound error</h1>
    <p>${escapeXml(errorMessage)}</p>
  </body>
</html>`,
	};
}

/**
 * Strip XML namespaces from tag and attribute names
 */
function stripNamespaces(name: string): string {
	return name.replace(/^.*:/, '');
}

/**
 * Ensure value is array
 */
function ensureArray(value: any): any[] {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

/**
 * Flatten XML object to simple key-value pairs
 */
function flattenObject(obj: any): Record<string, any> {
	if (!obj || typeof obj !== 'object') {
		return {};
	}

	const result: Record<string, any> = {};

	for (const [key, value] of Object.entries(obj)) {
		// Skip XML attributes and metadata
		if (key === '$' || key === '_' || key === 'SEGMENT' || key === 'BEGIN') {
			continue;
		}

		// If value is object with just text content, extract the text
		if (value && typeof value === 'object' && '_' in value) {
			result[key] = (value as any)._;
		} else if (typeof value === 'object' && !Array.isArray(value)) {
			// Nested object - recursively flatten
			const nested = flattenObject(value);
			if (Object.keys(nested).length > 0) {
				result[key] = nested;
			}
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Validate IDoc XML structure
 */
export function validateIdocXml(xml: string): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check for required elements
	if (!xml.includes('<IDOC')) {
		errors.push('Missing <IDOC> element');
	}

	if (!xml.includes('<EDI_DC40')) {
		errors.push('Missing <EDI_DC40> control record');
	}

	// Check for proper encoding
	if (!xml.includes('encoding') || (!xml.includes('UTF-8') && !xml.includes('utf-8'))) {
		errors.push('XML should use UTF-8 encoding');
	}

	// Check for SEGMENT attribute
	if (!xml.includes('SEGMENT="1"') && !xml.includes("SEGMENT='1'")) {
		errors.push('Segments should have SEGMENT="1" attribute');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Extract IDoc metadata without full parsing (fast)
 */
export function extractIdocMetadata(xml: string): {
	idocType?: string;
	messageType?: string;
	documentNumber?: string;
	sender?: string;
	receiver?: string;
} {
	const metadata: any = {};

	// Extract IDoc type from root element
	const idocTypeMatch = xml.match(/<([A-Z0-9]+)>/);
	if (idocTypeMatch) {
		metadata.idocType = idocTypeMatch[1];
	}

	// Extract MESTYP
	const mestypMatch = xml.match(/<MESTYP>([^<]+)<\/MESTYP>/);
	if (mestypMatch) {
		metadata.messageType = mestypMatch[1];
	}

	// Extract DOCNUM
	const docnumMatch = xml.match(/<DOCNUM>([^<]+)<\/DOCNUM>/);
	if (docnumMatch) {
		metadata.documentNumber = docnumMatch[1];
	}

	// Extract SNDPRN (sender)
	const sndprnMatch = xml.match(/<SNDPRN>([^<]+)<\/SNDPRN>/);
	if (sndprnMatch) {
		metadata.sender = sndprnMatch[1];
	}

	// Extract RCVPRN (receiver)
	const rcvprnMatch = xml.match(/<RCVPRN>([^<]+)<\/RCVPRN>/);
	if (rcvprnMatch) {
		metadata.receiver = rcvprnMatch[1];
	}

	return metadata;
}
