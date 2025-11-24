/**
 * OData Type Definitions
 *
 * Strongly-typed interfaces for OData values and responses
 */

/**
 * All supported EDM (Entity Data Model) types in OData
 */
export type EdmType =
	| 'Edm.String'
	| 'Edm.Int16'
	| 'Edm.Int32'
	| 'Edm.Int64'
	| 'Edm.Decimal'
	| 'Edm.Double'
	| 'Edm.Single'
	| 'Edm.Boolean'
	| 'Edm.DateTime'
	| 'Edm.DateTimeOffset'
	| 'Edm.Date'
	| 'Edm.TimeOfDay'
	| 'Edm.Time'
	| 'Edm.Guid'
	| 'Edm.Binary'
	| 'Edm.Byte';

/**
 * Normalized type names (without Edm. prefix)
 */
export type NormalizedEdmType =
	| 'string'
	| 'int16'
	| 'int32'
	| 'int64'
	| 'decimal'
	| 'double'
	| 'single'
	| 'boolean'
	| 'datetime'
	| 'datetimeoffset'
	| 'date'
	| 'timeofday'
	| 'time'
	| 'guid'
	| 'binary'
	| 'byte'
	| 'number'; // Generic number type

/**
 * OData response structure (V2 format)
 */
export interface IODataV2Response<T = unknown> {
	d?: {
		results?: T[];
		__next?: string;
		[key: string]: unknown;
	};
}

/**
 * OData response structure (V4 format)
 */
export interface IODataV4Response<T = unknown> {
	value?: T[];
	'@odata.nextLink'?: string;
	'@odata.context'?: string;
	[key: string]: unknown;
}

/**
 * Unified OData response type
 */
export type IODataResponse<T = unknown> = IODataV2Response<T> | IODataV4Response<T>;

/**
 * Decimal value with precision
 */
export interface IDecimalValue {
	value: string | number;
	scale?: number;
}

/**
 * Supported value types for formatting
 */
export type ODataValue = string | number | boolean | Date | IDecimalValue | null | undefined;

/**
 * Timezone handling strategies
 */
export type TimezoneStrategy = 'preserve' | 'utc' | 'local' | 'strip';

/**
 * Options for date/time formatting
 */
export interface IDateTimeFormatOptions {
	/**
	 * How to handle timezones
	 * - 'preserve': Keep original timezone
	 * - 'utc': Convert to UTC
	 * - 'local': Strip timezone (treat as local)
	 * - 'strip': Remove timezone info
	 */
	timezoneHandling?: TimezoneStrategy;

	/**
	 * Target timezone for conversion (e.g., 'Europe/Berlin')
	 * Only used when timezoneHandling is set
	 */
	targetTimezone?: string;
}

/**
 * Options for type detection
 */
export interface ITypeDetectionOptions {
	/**
	 * Enable automatic type detection from value
	 * @default false - Requires explicit typeHint
	 */
	autoDetect?: boolean;

	/**
	 * Throw error if type is ambiguous
	 * @default false
	 */
	strictMode?: boolean;

	/**
	 * Log warnings when auto-detection is used
	 * @default true
	 */
	warnOnAutoDetect?: boolean;
}

/**
 * Complete options for value formatting
 */
export interface IFormatOptions extends IDateTimeFormatOptions, ITypeDetectionOptions {}
