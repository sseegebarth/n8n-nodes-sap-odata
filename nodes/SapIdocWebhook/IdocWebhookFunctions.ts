/**
 * IdocWebhookFunctions - IDoc webhook processing functions
 *
 * Handles:
 * - Parsing IDoc XML to JSON
 * - Building SAP-compliant responses
 * - IDoc validation
 *
 * IMPORTANT: Uses native XML parsing (no external dependencies)
 * to maintain compatibility with n8n community node requirements.
 */

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
 * Parse IDoc XML to structured JSON using native string parsing
 */
export async function parseIdocXml(
	xml: string,
	options: IParseOptions = {},
): Promise<IParsedIdoc> {
	try {
		// Extract root IDoc type (e.g., DEBMAS06, ORDERS05)
		const rootMatch = xml.match(/<([A-Z0-9_]+)>/);
		if (!rootMatch) {
			throw new Error('No IDoc root element found');
		}
		const idocType = rootMatch[1];

		// Extract IDOC element content
		const idocMatch = xml.match(/<IDOC[^>]*>([\s\S]*?)<\/IDOC>/i);
		if (!idocMatch) {
			throw new Error('No IDOC element found in XML');
		}
		const idocContent = idocMatch[1];

		// Extract control record (EDI_DC40)
		const controlRecordMatch = idocContent.match(/<EDI_DC40[^>]*>([\s\S]*?)<\/EDI_DC40>/i);
		if (!controlRecordMatch) {
			throw new Error('No EDI_DC40 control record found');
		}

		const controlRecord = parseXmlFields(controlRecordMatch[1]);

		// Extract all data segments (anything that's not EDI_DC40)
		const dataRecords: IIdocSegment[] = [];

		// Match all segment tags (uppercase names, excluding EDI_DC40)
		const segmentPattern = /<([A-Z0-9_]+)(?:\s+SEGMENT="(\d+)")?[^>]*>([\s\S]*?)<\/\1>/gi;
		let segmentMatch;

		while ((segmentMatch = segmentPattern.exec(idocContent)) !== null) {
			const segmentType = segmentMatch[1];

			// Skip control record
			if (segmentType === 'EDI_DC40') {
				continue;
			}

			const segmentNumber = segmentMatch[2] ? parseInt(segmentMatch[2], 10) : undefined;
			const segmentContent = segmentMatch[3];

			// Parse segment fields
			const fields = parseXmlFields(segmentContent);

			dataRecords.push({
				segmentType,
				segmentNumber,
				fields,
			});
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
 * Parse XML fields from element content
 */
function parseXmlFields(xmlContent: string): Record<string, any> {
	const fields: Record<string, any> = {};

	// Match simple field elements: <FIELDNAME>value</FIELDNAME>
	const fieldPattern = /<([A-Z0-9_]+)>([^<]*)<\/\1>/gi;
	let fieldMatch;

	while ((fieldMatch = fieldPattern.exec(xmlContent)) !== null) {
		const fieldName = fieldMatch[1];
		const fieldValue = fieldMatch[2].trim();

		// Decode XML entities
		fields[fieldName] = decodeXmlEntities(fieldValue);
	}

	return fields;
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
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
