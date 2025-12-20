"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeFormatter = void 0;
class TimeFormatter {
    canFormat(value) {
        return value instanceof Date || typeof value === 'string';
    }
    format(value, _options = {}) {
        let timeStr;
        if (typeof value === 'string') {
            if (value.includes('T')) {
                const timePart = value.split('T')[1];
                timeStr = timePart.replace(/\.\d+/, '').replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
            }
            else {
                timeStr = value;
            }
        }
        else {
            const d = new Date(value);
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const seconds = String(d.getSeconds()).padStart(2, '0');
            timeStr = `${hours}:${minutes}:${seconds}`;
        }
        return `time'${timeStr}'`;
    }
}
exports.TimeFormatter = TimeFormatter;
