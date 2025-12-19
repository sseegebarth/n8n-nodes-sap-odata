/**
 * DateTimeOffsetFormatter - Formats DateTimeOffset values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats DateTimeOffset values
 * SAP OData format: datetimeoffset'2024-01-15T10:30:00+01:00' or datetimeoffset'2024-01-15T10:30:00Z'
 */
export class DateTimeOffsetFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return value instanceof Date || typeof value === 'string';
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		// Keep timezone info for DateTimeOffset
		const offsetStr = typeof value === 'string' ? value : new Date(value as Date).toISOString();
		return `datetimeoffset'${offsetStr}'`;
	}
}
