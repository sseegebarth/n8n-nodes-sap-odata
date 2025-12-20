import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';
export declare class DateTimeOffsetFormatter implements IValueFormatter {
    canFormat(value: ODataValue): boolean;
    format(value: ODataValue, _options?: IFormatOptions): string;
}
