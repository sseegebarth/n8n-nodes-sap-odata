/**
 * StringFormatter - Formats String values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats String values
 * SAP OData format: 'value' with escaped single quotes
 */
export class StringFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return value !== null && value !== undefined;
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		// Escape single quotes by doubling them (OData standard)
		const escapedValue = String(value).replace(/'/g, "''");
		return `'${escapedValue}'`;
	}
}
