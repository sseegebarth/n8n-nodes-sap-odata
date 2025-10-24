/**
 * TypeConverter - SAP OData Data Type Conversion
 * Converts SAP-specific data types to JavaScript native types
 */

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
export function convertValue(value: any): any {
	// Handle null/undefined
	if (value === null || value === undefined) {
		return value;
	}

	// Handle arrays - recursively convert each element
	if (Array.isArray(value)) {
		return value.map(item => convertValue(item));
	}

	// Handle objects - recursively convert each property
	if (typeof value === 'object') {
		const converted: any = {};
		for (const [key, val] of Object.entries(value)) {
			// Skip __metadata and __deferred properties but convert everything else
			if (key === '__metadata' || key === '__deferred') {
				converted[key] = val; // Keep as-is
			} else {
				converted[key] = convertValue(val); // Recursively convert
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

		// Check for numeric strings
		if (isNumericString(value)) {
			const num = parseFloat(value);
			// Only convert if parseFloat succeeded and result is not NaN
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
 *   IsActive: false,
 *   CustomerName: "Acme Corp"
 * };
 *
 * const converted = convertDataTypes(sapData);
 * // Result:
 * // {
 * //   TotalNetAmount: 175.50,  // Number
 * //   CreationDate: "2017-10-06T00:00:00.000Z",  // ISO Date string
 * //   IsActive: false,  // Boolean (unchanged)
 * //   CustomerName: "Acme Corp"  // String (unchanged)
 * // }
 */
export function convertDataTypes(data: any): any {
	return convertValue(data);
}
