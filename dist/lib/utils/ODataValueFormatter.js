"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatODataValue = formatODataValue;
const n8n_workflow_1 = require("n8n-workflow");
function normalizeTypeHint(typeHint) {
    return typeHint.toLowerCase().replace('edm.', '');
}
function detectType(value, options = {}) {
    const { autoDetect = false } = options;
    if (value === null || value === undefined)
        return undefined;
    if (typeof value === 'boolean')
        return 'boolean';
    if (typeof value === 'number')
        return 'number';
    if (value instanceof Date)
        return 'datetime';
    if (typeof value === 'string' && autoDetect) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
            return 'guid';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/.test(value))
            return 'datetimeoffset';
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value))
            return 'datetime';
        if (/^\d{4}-\d{2}-\d{2}$/.test(value))
            return 'date';
        if (/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(value))
            return 'timeofday';
        return 'string';
    }
    if (typeof value === 'object' && value !== null && 'value' in value)
        return 'decimal';
    return autoDetect ? 'string' : undefined;
}
function formatString(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}
function formatNumber(value) {
    return String(value);
}
function formatBoolean(value) {
    return String(value).toLowerCase();
}
function formatGuid(value) {
    return `guid'${String(value).toLowerCase()}'`;
}
function formatDate(value) {
    if (typeof value === 'string')
        return value;
    const d = new Date(value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function formatDateTime(value, options = {}) {
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
function formatDateTimeOffset(value) {
    const offsetStr = typeof value === 'string' ? value : new Date(value).toISOString();
    return `datetimeoffset'${offsetStr}'`;
}
function formatTime(value) {
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
function formatDecimal(value) {
    if (typeof value === 'object' && value !== null && 'value' in value) {
        const decimalObj = value;
        const decimalValue = String(decimalObj.value);
        const scale = decimalObj.scale;
        if (scale !== undefined && typeof scale === 'number') {
            const num = parseFloat(decimalValue);
            if (isNaN(num))
                return `${decimalValue}M`;
            const parts = decimalValue.split('.');
            const intPart = parts[0];
            const decPart = (parts[1] || '').padEnd(scale, '0').substring(0, scale);
            return scale > 0 ? `${intPart}.${decPart}M` : `${intPart}M`;
        }
        return `${decimalValue}M`;
    }
    return `${String(value)}M`;
}
const FORMAT_MAP = {
    boolean: formatBoolean,
    datetime: formatDateTime,
    datetimeoffset: formatDateTimeOffset,
    date: formatDate,
    time: formatTime,
    timeofday: formatTime,
    guid: formatGuid,
    decimal: formatDecimal,
    number: formatNumber,
    int16: formatNumber,
    int32: formatNumber,
    int64: formatNumber,
    single: formatNumber,
    double: formatNumber,
    byte: formatNumber,
    string: formatString,
};
function formatODataValue(value, typeHint, options = {}, node) {
    var _a;
    if (value === null || value === undefined)
        return 'null';
    const type = typeHint
        ? normalizeTypeHint(typeHint)
        : ((_a = detectType(value, options)) !== null && _a !== void 0 ? _a : 'string');
    const formatter = FORMAT_MAP[type];
    if (!formatter) {
        throw new n8n_workflow_1.NodeOperationError(node !== null && node !== void 0 ? node : { name: 'ODataValueFormatter', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0], parameters: {} }, `No formatter available for type: ${type}`);
    }
    return formatter(value, options);
}
