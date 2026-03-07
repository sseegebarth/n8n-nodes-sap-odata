import { INode } from 'n8n-workflow';
export type EdmType = 'Edm.String' | 'Edm.Int16' | 'Edm.Int32' | 'Edm.Int64' | 'Edm.Decimal' | 'Edm.Double' | 'Edm.Single' | 'Edm.Boolean' | 'Edm.DateTime' | 'Edm.DateTimeOffset' | 'Edm.Date' | 'Edm.TimeOfDay' | 'Edm.Time' | 'Edm.Guid' | 'Edm.Binary' | 'Edm.Byte';
export type NormalizedEdmType = 'string' | 'int16' | 'int32' | 'int64' | 'decimal' | 'double' | 'single' | 'boolean' | 'datetime' | 'datetimeoffset' | 'date' | 'timeofday' | 'time' | 'guid' | 'binary' | 'byte' | 'number';
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
export declare function formatODataValue(value: ODataValue, typeHint?: EdmType | string, options?: IFormatOptions, node?: INode): string;
