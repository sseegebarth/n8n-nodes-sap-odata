"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringFormatter = void 0;
class StringFormatter {
    canFormat(value) {
        return value !== null && value !== undefined;
    }
    format(value, _options = {}) {
        const escapedValue = String(value).replace(/'/g, "''");
        return `'${escapedValue}'`;
    }
}
exports.StringFormatter = StringFormatter;
