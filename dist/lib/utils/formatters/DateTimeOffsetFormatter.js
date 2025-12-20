"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateTimeOffsetFormatter = void 0;
class DateTimeOffsetFormatter {
    canFormat(value) {
        return value instanceof Date || typeof value === 'string';
    }
    format(value, _options = {}) {
        const offsetStr = typeof value === 'string' ? value : new Date(value).toISOString();
        return `datetimeoffset'${offsetStr}'`;
    }
}
exports.DateTimeOffsetFormatter = DateTimeOffsetFormatter;
