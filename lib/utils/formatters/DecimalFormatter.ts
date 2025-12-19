/**
 * DecimalFormatter - Formats Decimal values for SAP OData
 */

import type { ODataValue, IFormatOptions, IDecimalValue } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats Decimal values
 * SAP OData format: 12.34M or 12.34m
 * Preserves precision for currency amounts
 */
export class DecimalFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return (
			typeof value === 'number' ||
			typeof value === 'string' ||
			(typeof value === 'object' && value !== null && 'value' in value)
		);
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		// Handle object format with scale: { value: 12.34, scale: 2 }
		if (typeof value === 'object' && value !== null && 'value' in value) {
			const decimalObj = value as IDecimalValue;
			const decimalValue = String(decimalObj.value);
			const scale = decimalObj.scale;

			// If scale provided, ensure decimal places using string manipulation
			if (scale !== undefined && typeof scale === 'number') {
				// Validate it's a valid number
				const num = parseFloat(decimalValue);
				if (isNaN(num)) {
					return `${decimalValue}M`; // Return as-is if can't parse
				}

				// Use string manipulation to preserve precision
				const parts = decimalValue.split('.');
				const intPart = parts[0];
				const decPart = (parts[1] || '').padEnd(scale, '0').substring(0, scale);

				return scale > 0 ? `${intPart}.${decPart}M` : `${intPart}M`;
			}

			return `${decimalValue}M`;
		}

		// Simple value - preserve original string representation
		return `${String(value)}M`;
	}
}
