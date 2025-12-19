/**
 * NumberFormatter - Formats Number values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats Number values
 * SAP OData format: raw number (no quotes)
 * Handles: Int16, Int32, Int64, Single, Double, Byte
 */
export class NumberFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return typeof value === 'number';
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		return String(value);
	}
}
