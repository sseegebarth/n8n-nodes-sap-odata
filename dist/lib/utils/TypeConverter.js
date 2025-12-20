"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertSapDate = convertSapDate;
exports.convertSapTime = convertSapTime;
exports.convertValue = convertValue;
exports.removeMetadata = removeMetadata;
exports.convertDataTypes = convertDataTypes;
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
function convertValue(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => convertValue(item));
    }
    if (typeof value === 'object') {
        const converted = {};
        for (const [key, val] of Object.entries(value)) {
            if (key === '__metadata' || key === '__deferred') {
                converted[key] = val;
            }
            else {
                converted[key] = convertValue(val);
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
            const num = parseFloat(value);
            if (!isNaN(num)) {
                return num;
            }
        }
        return value;
    }
    return value;
}
function removeMetadata(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => removeMetadata(item));
    }
    if (typeof value === 'object') {
        const cleaned = {};
        for (const [key, val] of Object.entries(value)) {
            if (key !== '__metadata' && key !== '__deferred') {
                cleaned[key] = removeMetadata(val);
            }
        }
        return cleaned;
    }
    return value;
}
function convertDataTypes(data) {
    return convertValue(data);
}
