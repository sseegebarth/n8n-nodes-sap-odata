import type { ODataValue, IFormatOptions } from '../../types/odata';
export interface IValueFormatter {
    format(value: ODataValue, options?: IFormatOptions): string;
    canFormat(value: ODataValue): boolean;
}
