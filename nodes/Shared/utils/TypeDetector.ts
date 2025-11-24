/**
 * TypeDetector - Detects OData type from value
 *
 * Separates type detection logic from formatting logic
 * for better maintainability and testability.
 */

import type { NormalizedEdmType, ODataValue, ITypeDetectionOptions } from '../types/odata';
import { LoggerAdapter } from './LoggerAdapter';

/**
 * Detect EDM type from JavaScript value
 */
export class TypeDetector {
	/**
	 * Detect type from value
	 *
	 * @param value - Value to detect type from
	 * @param options - Detection options
	 * @returns Detected type or undefined
	 */
	static detectType(
		value: ODataValue,
		options: ITypeDetectionOptions = {},
	): NormalizedEdmType | undefined {
		const { autoDetect = false, strictMode = false, warnOnAutoDetect = true } = options;

		// Null/undefined has no type
		if (value === null || value === undefined) {
			return undefined;
		}

		// Type detection based on JavaScript type
		const jsType = typeof value;

		if (jsType === 'boolean') {
			return 'boolean';
		}

		if (jsType === 'number') {
			return 'number';
		}

		if (value instanceof Date) {
			return 'datetime';
		}

		// String-based type detection (only if autoDetect enabled)
		if (jsType === 'string' && autoDetect) {
			const detectedType = this.detectFromString(value as string, strictMode);

			if (detectedType && warnOnAutoDetect) {
				LoggerAdapter.warn('Auto-detected type from string value', {
					module: 'TypeDetector',
					detectedType,
					suggestion: 'Provide explicit typeHint for better reliability',
				});
			}

			return detectedType;
		}

		// Object type (e.g., IDecimalValue)
		if (jsType === 'object' && value !== null && typeof value === 'object') {
			if ('value' in value) {
				return 'decimal';
			}
		}

		// Default to string if auto-detect enabled, undefined otherwise
		return autoDetect ? 'string' : undefined;
	}

	/**
	 * Detect type from string value using pattern matching
	 *
	 * @param value - String value
	 * @param strictMode - Throw error on ambiguous patterns
	 * @returns Detected type
	 */
	private static detectFromString(
		value: string,
		strictMode: boolean,
	): NormalizedEdmType | undefined {
		// GUID pattern (most specific, check first)
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
			return 'guid';
		}

		// ISO DateTime with timezone offset (e.g., 2024-01-15T10:30:00+01:00)
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/.test(value)) {
			return 'datetimeoffset';
		}

		// ISO DateTime with Z (e.g., 2024-01-15T10:30:00Z or with milliseconds)
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
			return 'datetime';
		}

		// Date only (e.g., 2024-01-15)
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return 'date';
		}

		// Time only (e.g., 10:30:00 or 10:30:00.123)
		if (/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(value)) {
			return 'timeofday';
		}

		// Ambiguous pattern check (strict mode)
		if (strictMode) {
			// Check for patterns that could be interpreted multiple ways
			// Example: "2024-01-15" could be a string or a date
			if (/^\d{4}-\d{2}-\d{2}/.test(value) && value.length > 10) {
				throw new Error(
					`Ambiguous date/time pattern detected: "${value}". Provide explicit typeHint.`,
				);
			}
		}

		// Default to string
		return 'string';
	}

	/**
	 * Normalize type hint (remove 'Edm.' prefix, lowercase)
	 *
	 * @param typeHint - Type hint (e.g., 'Edm.DateTime', 'datetime', 'DateTime')
	 * @returns Normalized type
	 */
	static normalizeTypeHint(typeHint: string): NormalizedEdmType {
		return typeHint.toLowerCase().replace('edm.', '') as NormalizedEdmType;
	}

	/**
	 * Check if a type is a date/time type
	 */
	static isDateTimeType(type: NormalizedEdmType): boolean {
		return ['datetime', 'datetimeoffset', 'date', 'timeofday', 'time'].includes(type);
	}

	/**
	 * Check if a type is a numeric type
	 */
	static isNumericType(type: NormalizedEdmType): boolean {
		return [
			'number',
			'int16',
			'int32',
			'int64',
			'decimal',
			'double',
			'single',
			'byte',
		].includes(type);
	}
}
