/**
 * DateTimeFormatter - Formats DateTime values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats DateTime values
 * SAP OData V2 format: datetime'2024-01-15T10:30:00'
 */
export class DateTimeFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return value instanceof Date || typeof value === 'string';
	}

	format(value: ODataValue, options: IFormatOptions = {}): string {
		const { timezoneHandling = 'strip' } = options;

		// Convert to ISO string
		const dateStr = typeof value === 'string' ? value : new Date(value as Date).toISOString();

		// Handle timezone based on strategy
		let cleanDate: string;

		switch (timezoneHandling) {
			case 'preserve':
				// Keep as-is (includes timezone if present)
				cleanDate = dateStr;
				break;

			case 'utc':
				// Ensure UTC format with Z
				cleanDate = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
				break;

			case 'local':
			case 'strip':
			default:
				// Remove timezone info (SAP expects local time)
				cleanDate = dateStr
					.replace(/\.\d{3}Z$/, '') // Remove milliseconds + Z
					.replace(/Z$/, '') // Remove Z
					.replace(/[+-]\d{2}:\d{2}$/, ''); // Remove offset
				break;
		}

		return `datetime'${cleanDate}'`;
	}
}
