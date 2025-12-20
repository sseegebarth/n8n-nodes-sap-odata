import type { ODataValue, IFormatOptions } from '../../types/odata';
import type { IValueFormatter } from './IValueFormatter';
export declare class DateTimeFormatter implements IValueFormatter {
    canFormat(value: ODataValue): boolean;
    format(value: ODataValue, options?: IFormatOptions): string;
}
