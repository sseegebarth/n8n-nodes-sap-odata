"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateFormatter = void 0;
class DateFormatter {
    canFormat(value) {
        return value instanceof Date || typeof value === 'string';
    }
    format(value, _options = {}) {
        let dateOnlyStr;
        if (typeof value === 'string') {
            dateOnlyStr = value;
        }
        else {
            const d = new Date(value);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateOnlyStr = `${year}-${month}-${day}`;
        }
        return dateOnlyStr;
    }
}
exports.DateFormatter = DateFormatter;
