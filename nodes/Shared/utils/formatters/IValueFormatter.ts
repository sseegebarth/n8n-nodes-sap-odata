/**
 * IValueFormatter - Base interface for OData value formatters
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';

/**
 * Interface that all value formatters must implement
 */
export interface IValueFormatter {
	/**
	 * Format a value for OData
	 *
	 * @param value - Value to format
	 * @param options - Format options
	 * @returns OData-formatted string
	 */
	format(value: ODataValue, options?: IFormatOptions): string;

	/**
	 * Check if this formatter can handle the given value
	 *
	 * @param value - Value to check
	 * @returns True if formatter can handle this value
	 */
	canFormat(value: ODataValue): boolean;
}
