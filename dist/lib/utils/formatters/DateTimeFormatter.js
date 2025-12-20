"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateTimeFormatter = void 0;
class DateTimeFormatter {
    canFormat(value) {
        return value instanceof Date || typeof value === 'string';
    }
    format(value, options = {}) {
        const { timezoneHandling = 'strip' } = options;
        const dateStr = typeof value === 'string' ? value : new Date(value).toISOString();
        let cleanDate;
        switch (timezoneHandling) {
            case 'preserve':
                cleanDate = dateStr;
                break;
            case 'utc':
                cleanDate = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
                break;
            case 'local':
            case 'strip':
            default:
                cleanDate = dateStr
                    .replace(/\.\d{3}Z$/, '')
                    .replace(/Z$/, '')
                    .replace(/[+-]\d{2}:\d{2}$/, '');
                break;
        }
        return `datetime'${cleanDate}'`;
    }
}
exports.DateTimeFormatter = DateTimeFormatter;
