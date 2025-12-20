"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BooleanFormatter = void 0;
class BooleanFormatter {
    canFormat(value) {
        return typeof value === 'boolean';
    }
    format(value, _options = {}) {
        return String(value).toLowerCase();
    }
}
exports.BooleanFormatter = BooleanFormatter;
