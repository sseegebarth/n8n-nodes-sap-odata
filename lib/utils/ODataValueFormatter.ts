import { INode, NodeOperationError } from 'n8n-workflow';

export type EdmType =
	| 'Edm.String' | 'Edm.Int16' | 'Edm.Int32' | 'Edm.Int64'
	| 'Edm.Decimal' | 'Edm.Double' | 'Edm.Single' | 'Edm.Boolean'
	| 'Edm.DateTime' | 'Edm.DateTimeOffset' | 'Edm.Date'
	| 'Edm.TimeOfDay' | 'Edm.Time' | 'Edm.Guid' | 'Edm.Binary' | 'Edm.Byte';

export type NormalizedEdmType =
	| 'string' | 'int16' | 'int32' | 'int64' | 'decimal' | 'double' | 'single'
	| 'boolean' | 'datetime' | 'datetimeoffset' | 'date' | 'timeofday' | 'time'
	| 'guid' | 'binary' | 'byte' | 'number';

export type ODataValue = string | number | boolean | Date | IDecimalValue | null | undefined;

export type TimezoneStrategy = 'preserve' | 'utc' | 'local' | 'strip';

export interface IDecimalValue {
	value: string | number;
	scale?: number;
}

export interface IFormatOptions {
	timezoneHandling?: TimezoneStrategy;
	targetTimezone?: string;
	autoDetect?: boolean;
	strictMode?: boolean;
	warnOnAutoDetect?: boolean;
}

function normalizeTypeHint(typeHint: string): NormalizedEdmType {
	return typeHint.toLowerCase().replace('edm.', '') as NormalizedEdmType;
}

function detectType(value: ODataValue, options: IFormatOptions = {}): NormalizedEdmType | undefined {
	const { autoDetect = false } = options;

	if (value === null || value === undefined) return undefined;

	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'number') return 'number';
	if (value instanceof Date) return 'datetime';

	if (typeof value === 'string' && autoDetect) {
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'guid';
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/.test(value)) return 'datetimeoffset';
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) return 'datetime';
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
		if (/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(value)) return 'timeofday';
		return 'string';
	}

	if (typeof value === 'object' && value !== null && 'value' in value) return 'decimal';

	return autoDetect ? 'string' : undefined;
}

function formatString(value: ODataValue): string {
	return `'${String(value).replace(/'/g, "''")}'`;
}

function formatNumber(value: ODataValue): string {
	return String(value);
}

function formatBoolean(value: ODataValue): string {
	return String(value).toLowerCase();
}

function formatGuid(value: ODataValue): string {
	return `guid'${String(value).toLowerCase()}'`;
}

function formatDate(value: ODataValue): string {
	if (typeof value === 'string') return value;
	const d = new Date(value as Date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatDateTime(value: ODataValue, options: IFormatOptions = {}): string {
	const { timezoneHandling = 'strip' } = options;
	const dateStr = typeof value === 'string' ? value : new Date(value as Date).toISOString();

	let cleanDate: string;
	switch (timezoneHandling) {
		case 'preserve':
			cleanDate = dateStr;
			break;
		case 'utc':
			cleanDate = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
			break;
		case 'local':
		case 'strip':
		default:
			cleanDate = dateStr
				.replace(/\.\d{3}Z$/, '')
				.replace(/Z$/, '')
				.replace(/[+-]\d{2}:\d{2}$/, '');
			break;
	}
	return `datetime'${cleanDate}'`;
}

function formatDateTimeOffset(value: ODataValue): string {
	const offsetStr = typeof value === 'string' ? value : new Date(value as Date).toISOString();
	return `datetimeoffset'${offsetStr}'`;
}

function formatTime(value: ODataValue): string {
	let timeStr: string;
	if (typeof value === 'string') {
		if (value.includes('T')) {
			const timePart = value.split('T')[1];
			timeStr = timePart.replace(/\.\d+/, '').replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
		} else {
			timeStr = value;
		}
	} else {
		const d = new Date(value as Date);
		const hours = String(d.getHours()).padStart(2, '0');
		const minutes = String(d.getMinutes()).padStart(2, '0');
		const seconds = String(d.getSeconds()).padStart(2, '0');
		timeStr = `${hours}:${minutes}:${seconds}`;
	}
	return `time'${timeStr}'`;
}

function formatDecimal(value: ODataValue): string {
	if (typeof value === 'object' && value !== null && 'value' in value) {
		const decimalObj = value as IDecimalValue;
		const decimalValue = String(decimalObj.value);
		const scale = decimalObj.scale;

		if (scale !== undefined && typeof scale === 'number') {
			const num = parseFloat(decimalValue);
			if (isNaN(num)) return `${decimalValue}M`;

			const parts = decimalValue.split('.');
			const intPart = parts[0];
			const decPart = (parts[1] || '').padEnd(scale, '0').substring(0, scale);
			return scale > 0 ? `${intPart}.${decPart}M` : `${intPart}M`;
		}
		return `${decimalValue}M`;
	}
	return `${String(value)}M`;
}

const FORMAT_MAP: Record<string, (value: ODataValue, options?: IFormatOptions) => string> = {
	boolean: formatBoolean,
	datetime: formatDateTime,
	datetimeoffset: formatDateTimeOffset,
	date: formatDate,
	time: formatTime,
	timeofday: formatTime,
	guid: formatGuid,
	decimal: formatDecimal,
	number: formatNumber,
	int16: formatNumber,
	int32: formatNumber,
	int64: formatNumber,
	single: formatNumber,
	double: formatNumber,
	byte: formatNumber,
	string: formatString,
};

export function formatODataValue(
	value: ODataValue,
	typeHint?: EdmType | string,
	options: IFormatOptions = {},
	node?: INode,
): string {
	if (value === null || value === undefined) return 'null';

	const type: NormalizedEdmType = typeHint
		? normalizeTypeHint(typeHint)
		: (detectType(value, options) ?? 'string');

	const formatter = FORMAT_MAP[type];
	if (!formatter) {
		throw new NodeOperationError(
			node ?? ({ name: 'ODataValueFormatter', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0], parameters: {} } as INode),
			`No formatter available for type: ${type}`,
		);
	}

	return formatter(value, options);
}
