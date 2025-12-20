export type EdmType = 'Edm.String' | 'Edm.Int16' | 'Edm.Int32' | 'Edm.Int64' | 'Edm.Decimal' | 'Edm.Double' | 'Edm.Single' | 'Edm.Boolean' | 'Edm.DateTime' | 'Edm.DateTimeOffset' | 'Edm.Date' | 'Edm.TimeOfDay' | 'Edm.Time' | 'Edm.Guid' | 'Edm.Binary' | 'Edm.Byte';
export type NormalizedEdmType = 'string' | 'int16' | 'int32' | 'int64' | 'decimal' | 'double' | 'single' | 'boolean' | 'datetime' | 'datetimeoffset' | 'date' | 'timeofday' | 'time' | 'guid' | 'binary' | 'byte' | 'number';
export interface IODataV2Response<T = unknown> {
    d?: {
        results?: T[];
        __next?: string;
        [key: string]: unknown;
    };
}
export interface IODataV4Response<T = unknown> {
    value?: T[];
    '@odata.nextLink'?: string;
    '@odata.context'?: string;
    [key: string]: unknown;
}
export type IODataResponse<T = unknown> = IODataV2Response<T> | IODataV4Response<T>;
export interface IDecimalValue {
    value: string | number;
    scale?: number;
}
export type ODataValue = string | number | boolean | Date | IDecimalValue | null | undefined;
export type TimezoneStrategy = 'preserve' | 'utc' | 'local' | 'strip';
export interface IDateTimeFormatOptions {
    timezoneHandling?: TimezoneStrategy;
    targetTimezone?: string;
}
export interface ITypeDetectionOptions {
    autoDetect?: boolean;
    strictMode?: boolean;
    warnOnAutoDetect?: boolean;
}
export interface IFormatOptions extends IDateTimeFormatOptions, ITypeDetectionOptions {
}
