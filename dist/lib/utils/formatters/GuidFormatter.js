"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuidFormatter = void 0;
class GuidFormatter {
    canFormat(value) {
        return typeof value === 'string';
    }
    format(value, _options = {}) {
        const guidStr = String(value).toLowerCase();
        return `guid'${guidStr}'`;
    }
}
exports.GuidFormatter = GuidFormatter;
