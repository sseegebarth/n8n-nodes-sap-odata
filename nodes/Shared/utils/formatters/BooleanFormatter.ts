/**
 * BooleanFormatter - Formats Boolean values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats Boolean values
 * SAP OData format: true or false (lowercase)
 */
export class BooleanFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return typeof value === 'boolean';
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		return String(value).toLowerCase();
	}
}
