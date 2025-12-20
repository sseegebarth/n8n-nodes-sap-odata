"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeString = sanitizeString;
exports.sanitizeObjectKeys = sanitizeObjectKeys;
exports.sanitizeUrlParams = sanitizeUrlParams;
exports.sanitizeFilePath = sanitizeFilePath;
exports.sanitizeFilterExpression = sanitizeFilterExpression;
exports.sanitizeNumeric = sanitizeNumeric;
exports.sanitizeArray = sanitizeArray;
exports.validateEmail = validateEmail;
exports.sanitizeDate = sanitizeDate;
exports.deepSanitize = deepSanitize;
const n8n_workflow_1 = require("n8n-workflow");
function sanitizeString(input, maxLength = 1000, allowedPattern) {
    if (input.length > maxLength) {
        throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
    }
    let sanitized = input.replace(/\x00/g, '');
    sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (allowedPattern && !allowedPattern.test(sanitized)) {
        throw new Error('Input contains invalid characters');
    }
    return sanitized;
}
function sanitizeObjectKeys(obj) {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (dangerousKeys.includes(key.toLowerCase())) {
            continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeObjectKeys(value);
        }
        else if (Array.isArray(value)) {
            sanitized[key] = value.map(item => item && typeof item === 'object' && !Array.isArray(item)
                ? sanitizeObjectKeys(item)
                : item);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
function sanitizeUrlParams(params) {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
        const strValue = String(value);
        const cleaned = strValue
            .replace(/[<>'"]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '');
        sanitized[key] = cleaned;
    }
    return sanitized;
}
function sanitizeFilePath(path, node) {
    if (path.includes('../') || path.includes('..\\')) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Invalid file path: Path traversal detected', {
            description: 'File paths cannot contain "../" or "..\\"'
        });
    }
    const cleaned = path.replace(/\x00/g, '');
    if (/^[A-Z]:\\/i.test(cleaned) || cleaned.startsWith('/')) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Invalid file path: Absolute paths not allowed', {
            description: 'Please use relative paths only'
        });
    }
    if (cleaned.length > 255) {
        throw new n8n_workflow_1.NodeOperationError(node, 'File path too long (max 255 characters)');
    }
    return cleaned;
}
function sanitizeFilterExpression(filter, node) {
    const sqlPatterns = [
        /;\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE)/i,
        /--\s*$/,
        /\/\*.*\*\//,
        /\bUNION\b.*\bSELECT\b/i,
        /\bOR\b.*=.*\bOR\b/i,
        /'\s*OR\s*'[^']*'\s*=\s*'/i
    ];
    for (const pattern of sqlPatterns) {
        if (pattern.test(filter)) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Invalid filter: Potential SQL injection detected', {
                description: 'Filter expression contains forbidden SQL patterns'
            });
        }
    }
    if (filter.length > 5000) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Filter expression too long (max 5000 characters)');
    }
    return filter;
}
function sanitizeNumeric(value, min, max, allowDecimals = true) {
    const num = Number(value);
    if (isNaN(num)) {
        throw new Error('Invalid numeric value');
    }
    if (!isFinite(num)) {
        throw new Error('Value must be finite');
    }
    if (!allowDecimals && !Number.isInteger(num)) {
        throw new Error('Value must be an integer');
    }
    if (min !== undefined && num < min) {
        throw new Error(`Value must be at least ${min}`);
    }
    if (max !== undefined && num > max) {
        throw new Error(`Value must be at most ${max}`);
    }
    return num;
}
function sanitizeArray(arr, maxLength = 10000, itemSanitizer) {
    if (!Array.isArray(arr)) {
        throw new Error('Input must be an array');
    }
    if (arr.length > maxLength) {
        throw new Error(`Array exceeds maximum length of ${maxLength}`);
    }
    if (itemSanitizer) {
        return arr.map(itemSanitizer);
    }
    return arr;
}
function validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        throw new Error('Invalid email address format');
    }
    if (email.length > 254) {
        throw new Error('Email address too long');
    }
    if (/[<>'"`;]/.test(email)) {
        throw new Error('Email contains invalid characters');
    }
    return email.toLowerCase();
}
function sanitizeDate(dateStr) {
    const cleaned = dateStr.replace(/[^\d\-T:.Z+]/g, '');
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
        throw new Error('Date out of valid range (1900-2100)');
    }
    return date;
}
function deepSanitize(obj, maxDepth = 10, currentDepth = 0) {
    if (currentDepth > maxDepth) {
        throw new Error('Object nesting exceeds maximum depth');
    }
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }
    if (typeof obj === 'number') {
        return sanitizeNumeric(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitize(item, maxDepth, currentDepth + 1));
    }
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) {
                continue;
            }
            sanitized[sanitizeString(key, 255)] = deepSanitize(value, maxDepth, currentDepth + 1);
        }
        return sanitized;
    }
    return obj;
}
