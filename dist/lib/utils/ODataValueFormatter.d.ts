import type { ODataValue, IFormatOptions, NormalizedEdmType, EdmType } from '../types/odata';
import type { IValueFormatter } from './formatters';
export declare class ODataValueFormatter {
    private static formatters;
    static format(value: ODataValue, typeHint?: EdmType | string, options?: IFormatOptions): string;
    static registerFormatter(type: NormalizedEdmType, formatter: IValueFormatter): void;
    static getFormatters(): Map<NormalizedEdmType, IValueFormatter>;
}
export declare function formatODataValue(value: ODataValue, typeHint?: EdmType | string, options?: IFormatOptions): string;
