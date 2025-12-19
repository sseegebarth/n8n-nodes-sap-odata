/**
 * GuidFormatter - Formats GUID values for SAP OData
 */

import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';

/**
 * Formats GUID values
 * SAP OData format: guid'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
 */
export class GuidFormatter implements IValueFormatter {
	canFormat(value: ODataValue): boolean {
		return typeof value === 'string';
	}

	format(value: ODataValue, _options: IFormatOptions = {}): string {
		const guidStr = String(value).toLowerCase();
		return `guid'${guidStr}'`;
	}
}
