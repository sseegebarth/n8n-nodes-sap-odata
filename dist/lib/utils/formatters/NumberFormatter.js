"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumberFormatter = void 0;
class NumberFormatter {
    canFormat(value) {
        return typeof value === 'number';
    }
    format(value, _options = {}) {
        return String(value);
    }
}
exports.NumberFormatter = NumberFormatter;
