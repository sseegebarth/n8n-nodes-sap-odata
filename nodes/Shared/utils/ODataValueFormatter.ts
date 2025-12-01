/**
 * ODataValueFormatter - Main formatter class using Strategy Pattern
 *
 * Coordinates type detection and value formatting using specialized formatters.
 * Replaces the monolithic formatSapODataValue function.
 */

import type { ODataValue, IFormatOptions, NormalizedEdmType, EdmType } from '../types/odata';
import {
	BooleanFormatter,
	DateFormatter,
	DateTimeFormatter,
	DateTimeOffsetFormatter,
	DecimalFormatter,
	GuidFormatter,
	NumberFormatter,
	StringFormatter,
	TimeFormatter,
} from './formatters';
import type { IValueFormatter } from './formatters';
import { TypeDetector } from './TypeDetector';

/**
 * Main OData value formatter
 */
export class ODataValueFormatter {
	private static formatters: Map<NormalizedEdmType, IValueFormatter> = new Map([
		['boolean', new BooleanFormatter()],
		['datetime', new DateTimeFormatter()],
		['datetimeoffset', new DateTimeOffsetFormatter()],
		['date', new DateFormatter()],
		['time', new TimeFormatter()],
		['timeofday', new TimeFormatter()],
		['guid', new GuidFormatter()],
		['decimal', new DecimalFormatter()],
		['number', new NumberFormatter()],
		['int16', new NumberFormatter()],
		['int32', new NumberFormatter()],
		['int64', new NumberFormatter()],
		['single', new NumberFormatter()],
		['double', new NumberFormatter()],
		['byte', new NumberFormatter()],
		['string', new StringFormatter()],
	]);

	/**
	 * Format a value for SAP OData
	 *
	 * @param value - Value to format
	 * @param typeHint - Optional EDM type hint (e.g., 'Edm.DateTime', 'datetime')
	 * @param options - Formatting options
	 * @returns OData-formatted string
	 */
	static format(
		value: ODataValue,
		typeHint?: EdmType | string,
		options: IFormatOptions = {},
	): string {
		// Handle null and undefined
		if (value === null || value === undefined) {
			return 'null';
		}

		// Determine type (from hint or auto-detection)
		let type: NormalizedEdmType | undefined;

		if (typeHint) {
			// Use provided type hint
			type = TypeDetector.normalizeTypeHint(typeHint);
		} else {
			// Auto-detect type
			type = TypeDetector.detectType(value, options);
		}

		// Fallback to string if no type determined
		if (!type) {
			type = 'string';
		}

		// Get appropriate formatter
		const formatter = this.formatters.get(type);

		if (!formatter) {
			throw new Error(`No formatter available for type: ${type}`);
		}

		// Format the value
		return formatter.format(value, options);
	}

	/**
	 * Register a custom formatter for a type
	 *
	 * @param type - Type to register formatter for
	 * @param formatter - Formatter instance
	 */
	static registerFormatter(type: NormalizedEdmType, formatter: IValueFormatter): void {
		this.formatters.set(type, formatter);
	}

	/**
	 * Get all registered formatters
	 */
	static getFormatters(): Map<NormalizedEdmType, IValueFormatter> {
		return new Map(this.formatters);
	}
}

/**
 * Convenience function for backwards compatibility
 * Delegates to ODataValueFormatter.format()
 *
 * @param value - Value to format
 * @param typeHint - Optional type hint
 * @param options - Format options
 * @returns Formatted OData string
 */
export function formatODataValue(
	value: ODataValue,
	typeHint?: EdmType | string,
	options?: IFormatOptions,
): string {
	return ODataValueFormatter.format(value, typeHint, options);
}
