"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeDetector = void 0;
const LoggerAdapter_1 = require("./LoggerAdapter");
class TypeDetector {
    static detectType(value, options = {}) {
        const { autoDetect = false, strictMode = false, warnOnAutoDetect = true } = options;
        if (value === null || value === undefined) {
            return undefined;
        }
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
        if (jsType === 'string' && autoDetect) {
            const detectedType = this.detectFromString(value, strictMode);
            if (detectedType && warnOnAutoDetect) {
                LoggerAdapter_1.LoggerAdapter.warn('Auto-detected type from string value', {
                    module: 'TypeDetector',
                    detectedType,
                    suggestion: 'Provide explicit typeHint for better reliability',
                });
            }
            return detectedType;
        }
        if (jsType === 'object' && value !== null && typeof value === 'object') {
            if ('value' in value) {
                return 'decimal';
            }
        }
        return autoDetect ? 'string' : undefined;
    }
    static detectFromString(value, strictMode) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            return 'guid';
        }
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/.test(value)) {
            return 'datetimeoffset';
        }
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)) {
            return 'datetime';
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return 'date';
        }
        if (/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(value)) {
            return 'timeofday';
        }
        if (strictMode) {
            if (/^\d{4}-\d{2}-\d{2}/.test(value) && value.length > 10) {
                throw new Error(`Ambiguous date/time pattern detected: "${value}". Provide explicit typeHint.`);
            }
        }
        return 'string';
    }
    static normalizeTypeHint(typeHint) {
        return typeHint.toLowerCase().replace('edm.', '');
    }
    static isDateTimeType(type) {
        return ['datetime', 'datetimeoffset', 'date', 'timeofday', 'time'].includes(type);
    }
    static isNumericType(type) {
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
exports.TypeDetector = TypeDetector;
