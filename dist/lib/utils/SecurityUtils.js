"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSecureUrl = buildSecureUrl;
exports.validateEntityKey = validateEntityKey;
exports.validateODataFilter = validateODataFilter;
exports.sanitizeErrorMessage = sanitizeErrorMessage;
exports.validateJsonInput = validateJsonInput;
exports.validateUrl = validateUrl;
exports.sanitizeHeaderValue = sanitizeHeaderValue;
exports.validateEntitySetName = validateEntitySetName;
exports.validateFunctionName = validateFunctionName;
const n8n_workflow_1 = require("n8n-workflow");
const constants_1 = require("../constants");
function buildSecureUrl(host, servicePath, resource) {
    try {
        const baseUrl = new URL(host);
        if (!['http:', 'https:'].includes(baseUrl.protocol)) {
            throw new Error(`Invalid protocol: ${baseUrl.protocol}. Only HTTP and HTTPS are allowed.`);
        }
        const sanitizedServicePath = servicePath.replace(/\.\.[/\\]/g, '').replace(/^\/+/, '/');
        const sanitizedResource = resource.replace(/\.\.[/\\]/g, '');
        const fullPath = `${sanitizedServicePath}${sanitizedResource}`;
        return new URL(fullPath, baseUrl).toString();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid URL components: ${errorMessage}`);
    }
}
function validateEntityKey(key, node) {
    const normalizedKey = key.normalize('NFC');
    const blacklist = [
        ';', '--', '/*', '*/',
        'DROP', 'DELETE', 'INSERT', 'UPDATE', 'EXEC', 'TRUNCATE',
        '$filter', '$expand', '$select', '$orderby', '$top', '$skip',
        '&', '?',
    ];
    const upperKey = normalizedKey.toUpperCase();
    for (const pattern of blacklist) {
        const isWord = /^[A-Z$]+$/.test(pattern);
        if (isWord) {
            const regex = new RegExp(`\\b${pattern.replace('$', '\\$')}\\b`, 'i');
            if (regex.test(upperKey)) {
                throw new n8n_workflow_1.NodeOperationError(node, `Invalid entity key: Contains forbidden pattern '${pattern}'`, {
                    description: 'Entity keys cannot contain SQL commands or OData query parameters',
                });
            }
        }
        else if (upperKey.includes(pattern.toUpperCase())) {
            throw new n8n_workflow_1.NodeOperationError(node, `Invalid entity key: Contains forbidden pattern '${pattern}'`, {
                description: 'Entity keys cannot contain SQL commands or comment markers',
            });
        }
    }
    if (normalizedKey.includes('=')) {
        validateCompositeKey(normalizedKey, node);
    }
    else {
        if (!normalizedKey.match(/^('[^']*(?:''[^']*)*'|\d+)$/)) {
            if (!normalizedKey.match(/^[a-zA-Z0-9_\-.]+$/)) {
                throw new n8n_workflow_1.NodeOperationError(node, `Invalid simple key format: ${normalizedKey}`, {
                    description: "Simple keys must be quoted strings ('value'), numbers (123), or alphanumeric identifiers",
                });
            }
        }
    }
    return normalizedKey;
}
function validateCompositeKey(key, node) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    while (i < key.length) {
        const char = key[i];
        if (char === "'" && !inQuotes) {
            inQuotes = true;
            current += char;
        }
        else if (char === "'" && inQuotes) {
            if (i + 1 < key.length && key[i + 1] === "'") {
                current += "''";
                i++;
            }
            else {
                inQuotes = false;
                current += char;
            }
        }
        else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
        i++;
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    for (const part of parts) {
        const eqIndex = part.indexOf('=');
        if (eqIndex === -1) {
            throw new n8n_workflow_1.NodeOperationError(node, `Invalid composite key part: ${part}`, {
                description: "Each key-value pair must contain '=' separator",
            });
        }
        const keyName = part.substring(0, eqIndex).trim();
        const value = part.substring(eqIndex + 1).trim();
        if (!keyName.match(/^[a-zA-Z_][a-zA-Z0-9_\-.]*$/)) {
            throw new n8n_workflow_1.NodeOperationError(node, `Invalid key name in composite key: ${keyName}`, {
                description: 'Key names must start with a letter or underscore and contain only letters, numbers, underscores, hyphens, and dots',
            });
        }
        if (value.startsWith("'")) {
            if (!value.endsWith("'")) {
                throw new n8n_workflow_1.NodeOperationError(node, `Unclosed quote in composite key value: ${value}`, {
                    description: "String values must be enclosed in single quotes",
                });
            }
            const content = value.slice(1, -1);
            const unescapedQuotes = content.split("''").join('').indexOf("'");
            if (unescapedQuotes !== -1) {
                throw new n8n_workflow_1.NodeOperationError(node, `Unescaped quote in composite key value: ${value}`, {
                    description: "Single quotes within values must be escaped by doubling: ''",
                });
            }
        }
        else if (!value.match(/^-?\d+(\.\d+)?$/)) {
            throw new n8n_workflow_1.NodeOperationError(node, `Invalid composite key value format: ${value}`, {
                description: "Values must be quoted strings ('value') or numbers (123)",
            });
        }
    }
}
function validateODataFilter(filter, node) {
    const normalizedFilter = filter.normalize('NFC');
    let decodedFilter;
    try {
        decodedFilter = decodeURIComponent(normalizedFilter);
    }
    catch {
        decodedFilter = normalizedFilter;
    }
    const dangerousPatterns = [
        /javascript\s*:/i,
        /<\s*script/i,
        /<\s*\/\s*script/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
        /expression\s*\(/i,
        /Function\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        /new\s+Function/i,
        /document\s*\./i,
        /window\s*\./i,
        /innerHTML/i,
        /outerHTML/i,
        /<\s*img[^>]+onerror/i,
        /<\s*svg[^>]+onload/i,
        /data\s*:/i,
        /vbscript\s*:/i,
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(normalizedFilter) || pattern.test(decodedFilter)) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Invalid filter: Contains potentially dangerous content', {
                description: 'OData filters cannot contain script tags, JavaScript code, or event handlers',
            });
        }
    }
    const sqlPatterns = [
        /;\s*(DROP|DELETE|INSERT|UPDATE|TRUNCATE|ALTER|CREATE)\s/i,
        /--\s*$/m,
        /\/\*.*\*\//s,
        /UNION\s+SELECT/i,
        /EXEC\s*\(/i,
        /xp_cmdshell/i,
    ];
    for (const pattern of sqlPatterns) {
        if (pattern.test(decodedFilter)) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Invalid filter: Contains SQL injection pattern', {
                description: 'OData filters cannot contain SQL commands',
            });
        }
    }
    let parenCount = 0;
    for (const char of decodedFilter) {
        if (char === '(')
            parenCount++;
        if (char === ')')
            parenCount--;
        if (parenCount < 0) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Invalid filter: Unbalanced parentheses', {
                description: 'Filter contains more closing parentheses than opening ones',
            });
        }
    }
    if (parenCount !== 0) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Invalid filter: Unbalanced parentheses', {
            description: 'Filter contains unclosed parentheses',
        });
    }
    return normalizedFilter;
}
function sanitizeErrorMessage(message) {
    let sanitized = message;
    sanitized = sanitized.replace(/password=\S+/gi, 'password=***');
    sanitized = sanitized.replace(/pwd=\S+/gi, 'pwd=***');
    sanitized = sanitized.replace(/authorization:\s*bearer\s+\S+/gi, 'Authorization: Bearer ***');
    sanitized = sanitized.replace(/token=\S+/gi, 'token=***');
    sanitized = sanitized.replace(/api[_-]?key=\S+/gi, 'api_key=***');
    sanitized = sanitized.replace(/apikey=\S+/gi, 'apikey=***');
    sanitized = sanitized.replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@');
    sanitized = sanitized.replace(/secret=\S+/gi, 'secret=***');
    sanitized = sanitized.replace(/client_secret=\S+/gi, 'client_secret=***');
    sanitized = sanitized.replace(/(?<!:\/\/.*)(?<!:\/\/[^\s]*)(\/(?:home|usr|var|tmp|etc|opt|root|Users|mnt|dev)\/[\w.-/]+|[A-Z]:\\(?:[\w.-]+\\)+[\w.-]+)/gi, '[path]');
    sanitized = sanitized.replace(/\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, '[internal-ip]');
    sanitized = sanitized.replace(/\blocalhost(?::\d+)?\b/gi, '[localhost]');
    sanitized = sanitized.replace(/\b127\.0\.0\.1(?::\d+)?\b/g, '[localhost]');
    sanitized = sanitized.replace(/\b(?:SID|system)[=:\s]+[A-Z][A-Z0-9]{2}\b/gi, (match) => {
        return match.replace(/[A-Z][A-Z0-9]{2}$/, '[SID]');
    });
    sanitized = sanitized.replace(/\bclient[=:\s]+\d{3}\b/gi, 'client=[client]');
    sanitized = sanitized.replace(/\bmandant[=:\s]+\d{3}\b/gi, 'mandant=[client]');
    sanitized = sanitized.replace(/\buser[=:\s]+SAP\w*/gi, 'user=[user]');
    sanitized = sanitized.replace(/\n\s*at\s+.+/g, '');
    sanitized = sanitized.replace(/Error:\s*Error:/g, 'Error:');
    const maxLength = 500;
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
    }
    return sanitized;
}
function validateJsonInput(jsonString, fieldName, node) {
    try {
        if (jsonString.length > constants_1.MAX_JSON_SIZE) {
            throw new Error(`JSON input exceeds maximum size of ${constants_1.MAX_JSON_SIZE / 1024 / 1024}MB`);
        }
        const parsed = JSON.parse(jsonString);
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Must be a valid JSON object');
        }
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        const checkKeys = (obj, depth = 0) => {
            if (depth > constants_1.MAX_NESTING_DEPTH) {
                throw new Error(`JSON object is too deeply nested (max ${constants_1.MAX_NESTING_DEPTH} levels)`);
            }
            for (const key in obj) {
                if (dangerousKeys.includes(key.toLowerCase())) {
                    throw new Error(`Forbidden property name: ${key}`);
                }
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    checkKeys(obj[key], depth + 1);
                }
            }
        };
        checkKeys(parsed);
        return parsed;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new n8n_workflow_1.NodeOperationError(node, `Invalid JSON in '${fieldName}' field: ${errorMessage}`, {
            description: 'Please provide a valid JSON object',
        });
    }
}
function validateUrl(url, node) {
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new n8n_workflow_1.NodeOperationError(node, `Invalid protocol: ${parsedUrl.protocol}`, {
                description: 'Only HTTP and HTTPS protocols are allowed',
            });
        }
        const hostname = parsedUrl.hostname.toLowerCase();
        const isNumericIp = /^[\d.x]+$/.test(hostname);
        let normalizedHostname = hostname;
        if (isNumericIp) {
            const parts = hostname.split('.');
            if (parts.length <= 4) {
                try {
                    const ipParts = parts.map(part => {
                        if (part.startsWith('0x')) {
                            return parseInt(part, 16);
                        }
                        if (part.startsWith('0') && part.length > 1) {
                            return parseInt(part, 8);
                        }
                        return parseInt(part, 10);
                    });
                    if (ipParts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
                        normalizedHostname = ipParts.join('.');
                    }
                }
                catch {
                }
            }
        }
        const localhostPatterns = ['localhost', '127.', '0.0.0.0', '::1', '0:0:0:0:0:0:0:1', '[::1]'];
        if (localhostPatterns.some((pattern) => hostname.includes(pattern)) ||
            localhostPatterns.some((pattern) => normalizedHostname.includes(pattern))) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Access to localhost is not allowed', {
                description: 'Cannot connect to local resources for security reasons',
            });
        }
        const privateIpPatterns = [
            /^10\./,
            /^172\.(1[6-9]|2\d|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,
            /^fc00:/i,
            /^fd00:/i,
            /^fe80:/i,
            /^\[?::ffff:127\./i,
            /^\[?::ffff:10\./i,
            /^\[?::ffff:192\.168\./i,
            /^\[?::ffff:172\.(1[6-9]|2\d|3[01])\./i,
        ];
        if (privateIpPatterns.some((pattern) => pattern.test(hostname)) ||
            privateIpPatterns.some((pattern) => pattern.test(normalizedHostname))) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Access to private IP addresses is not allowed', {
                description: 'Cannot connect to private network resources for security reasons',
            });
        }
        const suspiciousPatterns = [
            /^127\.\d+\.\d+\.\d+\./,
            /^10\.\d+\.\d+\.\d+\./,
            /^192\.168\.\d+\.\d+\./,
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+\./,
            /^localhost\./,
        ];
        if (suspiciousPatterns.some((pattern) => pattern.test(hostname))) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Suspicious hostname detected - potential DNS rebinding attack', {
                description: 'The hostname appears to embed a private IP address',
            });
        }
        const metadataHosts = [
            '169.254.169.254',
            'metadata.google.internal',
            'metadata.azure.com',
        ];
        if (metadataHosts.some((host) => hostname.includes(host))) {
            throw new n8n_workflow_1.NodeOperationError(node, 'Access to cloud metadata endpoints is not allowed', {
                description: 'Cannot connect to cloud provider metadata services',
            });
        }
    }
    catch (error) {
        if (error instanceof n8n_workflow_1.NodeOperationError) {
            throw error;
        }
        throw new n8n_workflow_1.NodeOperationError(node, `Invalid URL: ${error instanceof Error ? error.message : String(error)}`, {
            description: 'Please provide a valid HTTP or HTTPS URL',
        });
    }
}
function sanitizeHeaderValue(value) {
    return value.replace(/[\r\n]/g, '');
}
function validateEntitySetName(name, node) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new n8n_workflow_1.NodeOperationError(node, `Invalid entity set name: ${name}`, {
            description: 'Entity set names can only contain letters, numbers, and underscores',
        });
    }
    if (name.length > 255) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Entity set name is too long (max 255 characters)');
    }
    return name;
}
function validateFunctionName(name, node) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        throw new n8n_workflow_1.NodeOperationError(node, `Invalid function name: ${name}`, {
            description: 'Function names can only contain letters, numbers, and underscores',
        });
    }
    if (name.length > 255) {
        throw new n8n_workflow_1.NodeOperationError(node, 'Function name is too long (max 255 characters)');
    }
    return name;
}
