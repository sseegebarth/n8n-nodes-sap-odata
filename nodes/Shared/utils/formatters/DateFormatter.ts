/**
 * DateFormatter - Formats Date-only values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats Date-only values
 * SAP OData V4 format: 2024-01-15 (no time component)
 */
export class DateFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return value instanceof Date || typeof value === 'string';
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		let dateOnlyStr: string;

		if (typeof value === 'string') {
			// Use as-is if already a date string
			dateOnlyStr = value;
		} else {
			// Extract date components from Date object
			const d = new Date(value as Date);
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			dateOnlyStr = `${year}-${month}-${day}`;
		}

		return dateOnlyStr;
	}
}
