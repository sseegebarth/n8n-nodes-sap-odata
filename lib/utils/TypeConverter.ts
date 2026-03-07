/**
 * TypeConverter - SAP OData Data Type Conversion
 * Converts SAP-specific data types to JavaScript native types
 */

const MAX_RECURSION_DEPTH = 50;

/**
 * Convert SAP Date format to ISO Date string
 * SAP Format: /Date(1507248000000)/ or /Date(1508418010083+0000)/
 * Output: ISO 8601 string (2017-10-06T00:00:00.000Z)
 */
export function convertSapDate(sapDateString: string): string | null {
	if (!sapDateString || typeof sapDateString !== 'string') {
		return null;
	}

	// Match SAP date format: /Date(timestamp)/ or /Date(timestamp+offset)/
	const match = sapDateString.match(/\/Date\((\d+)([+-]\d+)?\)\//);
	if (!match) {
		return null;
	}

	const timestamp = parseInt(match[1], 10);
	return new Date(timestamp).toISOString();
}

/**
 * Convert SAP Time format to HH:MM:SS string
 * SAP Formats (ISO 8601 Duration):
 * - PT14H30M00S (14:30:00)
 * - PT2H15M30S (2:15:30)
 * - PT5M (00:05:00) - only minutes
 * - PT2H (02:00:00) - only hours
 * - PT30S (00:00:30) - only seconds
 * - PT2H30M (02:30:00) - hours and minutes
 * Output: "14:30:00" (24-hour format HH:MM:SS)
 */
export function convertSapTime(sapTimeString: string): string | null {
	if (!sapTimeString || typeof sapTimeString !== 'string') {
		return null;
	}

	// Match ISO 8601 Duration format: PT[n]H[n]M[n]S
	// All components (H, M, S) are optional, but at least one must be present
	const match = sapTimeString.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
	if (!match) {
		return null;
	}

	// Extract components (default to 0 if not present)
	const hours = parseInt(match[1] || '0', 10);
	const minutes = parseInt(match[2] || '0', 10);
	const seconds = parseFloat(match[3] || '0');

	// Validate ranges (SAP OData should not exceed 24 hours for Edm.Time)
	if (hours > 23 || minutes > 59 || seconds >= 60) {
		return null; // Invalid time
	}

	// Format as HH:MM:SS (round seconds to integer)
	const hoursStr = hours.toString().padStart(2, '0');
	const minutesStr = minutes.toString().padStart(2, '0');
	const secondsStr = Math.floor(seconds).toString().padStart(2, '0');

	return `${hoursStr}:${minutesStr}:${secondsStr}`;
}

/**
 * Check if a string represents a numeric value
 * Matches: "175.50", "1.00000", "0", "9170.00"
 * Does NOT match: "ABC", "2017-10-06", ""
 */
function isNumericString(value: string): boolean {
	// Must be non-empty string
	if (!value || typeof value !== 'string') {
		return false;
	}

	// Trim whitespace
	const trimmed = value.trim();
	if (trimmed === '') {
		return false;
	}

	// Check if it's a valid number (including decimals)
	// Allow: "123", "123.45", "-123.45", "0.001"
	// Disallow: "123abc", "12.34.56", "1e5" (scientific notation - SAP doesn't use this)
	return /^-?\d+\.?\d*$/.test(trimmed);
}

/**
 * Convert a single value based on its type
 * - SAP Dates (/Date(...)/) → ISO Date string
 * - Numeric strings ("175.50") → Number
 * - Booleans → unchanged
 * - Other strings → unchanged
 * - Objects/Arrays → recursively converted
 */
export function convertValue(value: any, depth = 0): any {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return value;
	}

	if (depth >= MAX_RECURSION_DEPTH) return value;

	// Handle arrays - recursively convert each element
	if (Array.isArray(value)) {
		return value.map(item => convertValue(item, depth + 1));
	}

	// Handle objects - recursively convert each property
	if (typeof value === 'object') {
		const converted: any = {};
		for (const [key, val] of Object.entries(value)) {
			// Skip __metadata and __deferred properties but convert everything else
			if (key === '__metadata' || key === '__deferred') {
				converted[key] = val; // Keep as-is
			} else {
				converted[key] = convertValue(val, depth + 1);
			}
		}
		return converted;
	}

	// Handle strings
	if (typeof value === 'string') {
		// Check for SAP Date format first
		if (value.startsWith('/Date(') && value.endsWith(')/')) {
			const converted = convertSapDate(value);
			return converted !== null ? converted : value;
		}

		// Check for SAP Time format (PT[n]H[n]M[n]S)
		// More robust check: starts with PT and contains at least H, M, or S
		if (value.startsWith('PT') && /[HMS]/.test(value)) {
			const converted = convertSapTime(value);
			// Only return converted if successful, otherwise keep original
			if (converted !== null) {
				return converted;
			}
		}

		// Check for numeric strings
		if (isNumericString(value)) {
			// Preserve strings with leading zeros (SAP material/document numbers)
			if (value.startsWith('0') && value.length > 1 && !value.startsWith('0.') && !value.startsWith('0x')) {
				return value;
			}
			const num = parseFloat(value);
			if (!isNaN(num)) {
				return num;
			}
		}

		// Return string unchanged
		return value;
	}

	// Return all other types unchanged (number, boolean, etc.)
	return value;
}

/**
 * Remove __metadata and __deferred fields from data
 * Recursively processes all objects and arrays
 */
export function removeMetadata(value: any, depth = 0): any {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return value;
	}

	if (depth >= MAX_RECURSION_DEPTH) return value;

	// Handle arrays - recursively remove metadata from each element
	if (Array.isArray(value)) {
		return value.map(item => removeMetadata(item, depth + 1));
	}

	// Handle objects - remove __metadata and __deferred, recursively process other properties
	if (typeof value === 'object') {
		const cleaned: any = {};
		for (const [key, val] of Object.entries(value)) {
			// Skip __metadata and __deferred properties
			if (key !== '__metadata' && key !== '__deferred') {
				cleaned[key] = removeMetadata(val, depth + 1);
			}
		}
		return cleaned;
	}

	// Return all other types unchanged
	return value;
}

/**
 * Unwrap OData V2 navigation property wrappers
 * SAP V2 wraps navigation collections as { results: [...], __count?: "n" }
 * This function replaces such wrappers with the plain array.
 */
export function unwrapNavigationProperties(value: any, depth = 0): any {
	if (value === null || value === undefined) return value;
	if (depth >= MAX_RECURSION_DEPTH) return value;

	if (Array.isArray(value)) {
		return value.map(item => unwrapNavigationProperties(item, depth + 1));
	}

	if (typeof value === 'object') {
		const unwrapped: any = {};
		for (const [key, val] of Object.entries(value)) {
			if (val && typeof val === 'object' && !Array.isArray(val)) {
				const obj = val as Record<string, unknown>;
				if (Array.isArray(obj.results)) {
					const otherKeys = Object.keys(obj).filter(
						k => k !== 'results' && k !== '__count' && k !== '__next' && k !== '__deferred',
					);
					if (otherKeys.length === 0) {
						unwrapped[key] = unwrapNavigationProperties(obj.results, depth + 1);
						continue;
					}
				}
			}
			unwrapped[key] = unwrapNavigationProperties(val, depth + 1);
		}
		return unwrapped;
	}

	return value;
}

/**
 * Convert all values in a data object
 * Recursively processes all properties and nested objects
 *
 * @param data - The data object to convert
 * @returns Converted data object with native JavaScript types
 *
 * @example
 * const sapData = {
 *   TotalNetAmount: "175.50",
 *   CreationDate: "/Date(1507248000000)/",
 *   StartTime: "PT14H30M00S",
 *   IsActive: false,
 *   CustomerName: "Acme Corp"
 * };
 *
 * const converted = convertDataTypes(sapData);
 * // Result:
 * // {
 * //   TotalNetAmount: 175.50,  // Number
 * //   CreationDate: "2017-10-06T00:00:00.000Z",  // ISO Date string
 * //   StartTime: "14:30:00",  // Time string (HH:MM:SS)
 * //   IsActive: false,  // Boolean (unchanged)
 * //   CustomerName: "Acme Corp"  // String (unchanged)
 * // }
 */
export function convertDataTypes(data: any): any {
	return convertValue(data);
}

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const TIME_REGEX = /^(\d{2}):(\d{2}):(\d{2})$/;

/**
 * Convert ISO dates and HH:MM:SS times to SAP V2 format for write operations.
 * - ISO datetime strings → /Date(timestamp)/
 * - HH:MM:SS time strings → PTnHnMnS duration
 * - All other values remain unchanged
 */
export function convertToSapV2Format(value: any, depth = 0): any {
	if (value === null || value === undefined) return value;
	if (depth >= MAX_RECURSION_DEPTH) return value;

	if (Array.isArray(value)) {
		return value.map(item => convertToSapV2Format(item, depth + 1));
	}

	if (typeof value === 'object') {
		const converted: any = {};
		for (const [key, val] of Object.entries(value)) {
			if (key === '__metadata' || key === '__deferred') {
				converted[key] = val;
			} else {
				converted[key] = convertToSapV2Format(val, depth + 1);
			}
		}
		return converted;
	}

	if (typeof value === 'string') {
		// ISO datetime → /Date(timestamp)/
		if (ISO_DATETIME_REGEX.test(value)) {
			const ts = Date.parse(value);
			if (!isNaN(ts)) {
				return `/Date(${ts})/`;
			}
		}

		// HH:MM:SS → PT duration
		const timeMatch = value.match(TIME_REGEX);
		if (timeMatch) {
			const h = parseInt(timeMatch[1], 10);
			const m = parseInt(timeMatch[2], 10);
			const s = parseInt(timeMatch[3], 10);
			if (h < 24 && m < 60 && s < 60) {
				return `PT${h}H${m}M${s}S`;
			}
		}
	}

	return value;
}
