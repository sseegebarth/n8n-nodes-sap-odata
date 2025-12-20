"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecimalFormatter = void 0;
class DecimalFormatter {
    canFormat(value) {
        return (typeof value === 'number' ||
            typeof value === 'string' ||
            (typeof value === 'object' && value !== null && 'value' in value));
    }
    format(value, _options = {}) {
        if (typeof value === 'object' && value !== null && 'value' in value) {
            const decimalObj = value;
            const decimalValue = String(decimalObj.value);
            const scale = decimalObj.scale;
            if (scale !== undefined && typeof scale === 'number') {
                const num = parseFloat(decimalValue);
                if (isNaN(num)) {
                    return `${decimalValue}M`;
                }
                const parts = decimalValue.split('.');
                const intPart = parts[0];
                const decPart = (parts[1] || '').padEnd(scale, '0').substring(0, scale);
                return scale > 0 ? `${intPart}.${decPart}M` : `${intPart}M`;
            }
            return `${decimalValue}M`;
        }
        return `${String(value)}M`;
    }
}
exports.DecimalFormatter = DecimalFormatter;
