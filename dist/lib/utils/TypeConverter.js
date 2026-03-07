"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertSapDate = convertSapDate;
exports.convertSapTime = convertSapTime;
exports.convertValue = convertValue;
exports.removeMetadata = removeMetadata;
exports.unwrapNavigationProperties = unwrapNavigationProperties;
exports.convertDataTypes = convertDataTypes;
exports.convertToSapV2Format = convertToSapV2Format;
const MAX_RECURSION_DEPTH = 50;
function convertSapDate(sapDateString) {
    if (!sapDateString || typeof sapDateString !== 'string') {
        return null;
    }
    const match = sapDateString.match(/\/Date\((\d+)([+-]\d+)?\)\//);
    if (!match) {
        return null;
    }
    const timestamp = parseInt(match[1], 10);
    return new Date(timestamp).toISOString();
}
function convertSapTime(sapTimeString) {
    if (!sapTimeString || typeof sapTimeString !== 'string') {
        return null;
    }
    const match = sapTimeString.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
    if (!match) {
        return null;
    }
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseFloat(match[3] || '0');
    if (hours > 23 || minutes > 59 || seconds >= 60) {
        return null;
    }
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = Math.floor(seconds).toString().padStart(2, '0');
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
function isNumericString(value) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    const trimmed = value.trim();
    if (trimmed === '') {
        return false;
    }
    return /^-?\d+\.?\d*$/.test(trimmed);
}
function convertValue(value, depth = 0) {
    if (value === null || value === undefined) {
        return value;
    }
    if (depth >= MAX_RECURSION_DEPTH)
        return value;
    if (Array.isArray(value)) {
        return value.map(item => convertValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const converted = {};
        for (const [key, val] of Object.entries(value)) {
            if (key === '__metadata' || key === '__deferred') {
                converted[key] = val;
            }
            else {
                converted[key] = convertValue(val, depth + 1);
            }
        }
        return converted;
    }
    if (typeof value === 'string') {
        if (value.startsWith('/Date(') && value.endsWith(')/')) {
            const converted = convertSapDate(value);
            return converted !== null ? converted : value;
        }
        if (value.startsWith('PT') && /[HMS]/.test(value)) {
            const converted = convertSapTime(value);
            if (converted !== null) {
                return converted;
            }
        }
        if (isNumericString(value)) {
            if (value.startsWith('0') && value.length > 1 && !value.startsWith('0.') && !value.startsWith('0x')) {
                return value;
            }
            const num = parseFloat(value);
            if (!isNaN(num)) {
                return num;
            }
        }
        return value;
    }
    return value;
}
function removeMetadata(value, depth = 0) {
    if (value === null || value === undefined) {
        return value;
    }
    if (depth >= MAX_RECURSION_DEPTH)
        return value;
    if (Array.isArray(value)) {
        return value.map(item => removeMetadata(item, depth + 1));
    }
    if (typeof value === 'object') {
        const cleaned = {};
        for (const [key, val] of Object.entries(value)) {
            if (key !== '__metadata' && key !== '__deferred') {
                cleaned[key] = removeMetadata(val, depth + 1);
            }
        }
        return cleaned;
    }
    return value;
}
function unwrapNavigationProperties(value, depth = 0) {
    if (value === null || value === undefined)
        return value;
    if (depth >= MAX_RECURSION_DEPTH)
        return value;
    if (Array.isArray(value)) {
        return value.map(item => unwrapNavigationProperties(item, depth + 1));
    }
    if (typeof value === 'object') {
        const unwrapped = {};
        for (const [key, val] of Object.entries(value)) {
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const obj = val;
                if (Array.isArray(obj.results)) {
                    const otherKeys = Object.keys(obj).filter(k => k !== 'results' && k !== '__count' && k !== '__next' && k !== '__deferred');
                    if (otherKeys.length === 0) {
                        unwrapped[key] = unwrapNavigationProperties(obj.results, depth + 1);
                        continue;
                    }
                }
            }
            unwrapped[key] = unwrapNavigationProperties(val, depth + 1);
        }
        return unwrapped;
    }
    return value;
}
function convertDataTypes(data) {
    return convertValue(data);
}
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const TIME_REGEX = /^(\d{2}):(\d{2}):(\d{2})$/;
function convertToSapV2Format(value, depth = 0) {
    if (value === null || value === undefined)
        return value;
    if (depth >= MAX_RECURSION_DEPTH)
        return value;
    if (Array.isArray(value)) {
        return value.map(item => convertToSapV2Format(item, depth + 1));
    }
    if (typeof value === 'object') {
        const converted = {};
        for (const [key, val] of Object.entries(value)) {
            if (key === '__metadata' || key === '__deferred') {
                converted[key] = val;
            }
            else {
                converted[key] = convertToSapV2Format(val, depth + 1);
            }
        }
        return converted;
    }
    if (typeof value === 'string') {
        if (ISO_DATETIME_REGEX.test(value)) {
            const ts = Date.parse(value);
            if (!isNaN(ts)) {
                return `/Date(${ts})/`;
            }
        }
        const timeMatch = value.match(TIME_REGEX);
        if (timeMatch) {
            const h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            const s = parseInt(timeMatch[3], 10);
            if (h < 24 && m < 60 && s < 60) {
                return `PT${h}H${m}M${s}S`;
            }
        }
    }
    return value;
}
