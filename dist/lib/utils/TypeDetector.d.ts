import type { NormalizedEdmType, ODataValue, ITypeDetectionOptions } from '../types/odata';
export declare class TypeDetector {
    static detectType(value: ODataValue, options?: ITypeDetectionOptions): NormalizedEdmType | undefined;
    private static detectFromString;
    static normalizeTypeHint(typeHint: string): NormalizedEdmType;
    static isDateTimeType(type: NormalizedEdmType): boolean;
    static isNumericType(type: NormalizedEdmType): boolean;
}
