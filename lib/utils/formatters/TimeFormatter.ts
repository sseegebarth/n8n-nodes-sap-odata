/**
 * TimeFormatter - Formats Time-only values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats Time-only values
 * SAP OData format: time'10:30:00' or time'10:30:00.123'
 */
export class TimeFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return value instanceof Date || typeof value === 'string';
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		let timeStr: string;

		if (typeof value === 'string') {
			// If it's a full ISO datetime, extract time part
			if (value.includes('T')) {
				const timePart = value.split('T')[1];
				// Remove timezone (Z or +/-offset) and milliseconds
				timeStr = timePart.replace(/\.\d+/, '').replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
			} else {
				timeStr = value;
			}
		} else {
			// Extract time from Date object
			const d = new Date(value as Date);
			const hours = String(d.getHours()).padStart(2, '0');
			const minutes = String(d.getMinutes()).padStart(2, '0');
			const seconds = String(d.getSeconds()).padStart(2, '0');
			timeStr = `${hours}:${minutes}:${seconds}`;
		}

		return `time'${timeStr}'`;
	}
}
