"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookRateLimiter = void 0;
exports.verifyHmacSignature = verifyHmacSignature;
exports.generateHmacSignature = generateHmacSignature;
exports.isIpAllowed = isIpAllowed;
exports.isValidSapODataPayload = isValidSapODataPayload;
exports.isValidSapIdocXml = isValidSapIdocXml;
exports.parseSapDates = parseSapDates;
exports.extractEventInfo = extractEventInfo;
exports.extractChangedFields = extractChangedFields;
exports.validateBasicAuth = validateBasicAuth;
exports.extractBearerToken = extractBearerToken;
exports.safeJsonParse = safeJsonParse;
exports.buildWebhookResponse = buildWebhookResponse;
exports.buildWebhookErrorResponse = buildWebhookErrorResponse;
exports.sanitizePayload = sanitizePayload;
exports.checkWebhookRateLimit = checkWebhookRateLimit;
const crypto = __importStar(require("crypto"));
function verifyHmacSignature(payload, signature, secret, algorithm = 'sha256') {
    if (!signature || !secret) {
        return false;
    }
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    const calculatedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(calculatedSignature, 'hex'));
}
function generateHmacSignature(payload, secret, algorithm = 'sha256') {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest('hex');
}
function ipv4ToInt(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error('Invalid IPv4 address');
    }
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}
function isIpv4InCidr(ip, cidr) {
    const [network, maskBits] = cidr.split('/');
    const networkInt = ipv4ToInt(network);
    const ipInt = ipv4ToInt(ip);
    const mask = maskBits ? (-1 << (32 - parseInt(maskBits, 10))) >>> 0 : 0xFFFFFFFF;
    return (networkInt & mask) === (ipInt & mask);
}
function parseIpv6(ipv6) {
    if (ipv6.includes('.')) {
        const lastColon = ipv6.lastIndexOf(':');
        const ipv4Part = ipv6.substring(lastColon + 1);
        const ipv6Part = ipv6.substring(0, lastColon);
        const ipv4Int = ipv4ToInt(ipv4Part);
        const ipv6Segments = parseIpv6(ipv6Part + ':' +
            ((ipv4Int >>> 16).toString(16)) + ':' +
            ((ipv4Int & 0xFFFF).toString(16)));
        return ipv6Segments;
    }
    const parts = ipv6.split(':');
    const segments = [];
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '') {
            const before = parts.slice(0, i).filter(p => p !== '');
            const after = parts.slice(i + 1).filter(p => p !== '');
            const missing = 8 - before.length - after.length;
            for (const part of before) {
                segments.push(parseInt(part, 16));
            }
            for (let j = 0; j < missing; j++) {
                segments.push(0);
            }
            for (const part of after) {
                segments.push(parseInt(part, 16));
            }
            break;
        }
        else if (i === parts.length - 1) {
            for (const part of parts) {
                segments.push(parseInt(part || '0', 16));
            }
        }
    }
    while (segments.length < 8) {
        segments.push(0);
    }
    return segments.slice(0, 8);
}
function isIpv6InCidr(ip, cidr) {
    const [network, maskBits = '128'] = cidr.split('/');
    const networkSegments = parseIpv6(network);
    const ipSegments = parseIpv6(ip);
    const prefixLength = parseInt(maskBits, 10);
    for (let bit = 0; bit < prefixLength; bit++) {
        const segmentIndex = Math.floor(bit / 16);
        const bitIndex = 15 - (bit % 16);
        const networkBit = (networkSegments[segmentIndex] >> bitIndex) & 1;
        const ipBit = (ipSegments[segmentIndex] >> bitIndex) & 1;
        if (networkBit !== ipBit) {
            return false;
        }
    }
    return true;
}
function normalizeIpv6(ipv6) {
    try {
        const segments = parseIpv6(ipv6);
        return segments.map(s => s.toString(16).padStart(4, '0')).join(':').toLowerCase();
    }
    catch {
        return ipv6.toLowerCase();
    }
}
function isIpAllowed(clientIp, whitelist) {
    if (whitelist.includes('*')) {
        return true;
    }
    const ip = clientIp.replace(/^::ffff:/i, '');
    const isIpv6 = ip.includes(':');
    const normalizedIp = isIpv6 ? normalizeIpv6(ip) : ip;
    for (const allowed of whitelist) {
        try {
            const allowedIsIpv6 = allowed.includes(':') && !allowed.includes('/');
            if (isIpv6 && allowedIsIpv6) {
                if (normalizedIp === normalizeIpv6(allowed)) {
                    return true;
                }
            }
            else if (ip === allowed) {
                return true;
            }
            if (allowed.includes('/')) {
                const allowedCidrIsIpv6 = allowed.includes(':');
                if (isIpv6 !== allowedCidrIsIpv6) {
                    continue;
                }
                if (isIpv6) {
                    if (isIpv6InCidr(ip, allowed)) {
                        return true;
                    }
                }
                else {
                    if (isIpv4InCidr(ip, allowed)) {
                        return true;
                    }
                }
            }
        }
        catch {
            continue;
        }
    }
    return false;
}
function isValidSapODataPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    const hasODataV2Structure = 'd' in payload;
    const hasODataV4Structure = 'value' in payload || '@odata.context' in payload;
    const hasEventMetadata = 'event' in payload ||
        'operation' in payload ||
        'entityType' in payload;
    return hasODataV2Structure ||
        hasODataV4Structure ||
        hasEventMetadata ||
        Object.keys(payload).length > 0;
}
function isValidSapIdocXml(xmlData) {
    if (!xmlData || typeof xmlData !== 'string') {
        return false;
    }
    if (!xmlData.includes('<') || !xmlData.includes('>')) {
        return false;
    }
    const hasIdocStructure = xmlData.includes('IDOC') ||
        xmlData.includes('EDI_DC40') ||
        xmlData.includes('CONTROL');
    return hasIdocStructure;
}
function parseSapDates(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(parseSapDates);
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            const dateMatch = value.match(/^\/Date\((\d+)\)\/$/);
            if (dateMatch) {
                const timestamp = parseInt(dateMatch[1], 10);
                result[key] = new Date(timestamp).toISOString();
            }
            else {
                result[key] = value;
            }
        }
        else if (typeof value === 'object') {
            result[key] = parseSapDates(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function extractEventInfo(payload) {
    const event = {};
    if (payload.event) {
        event.type = payload.event;
    }
    if (payload.operation) {
        event.operation = payload.operation;
    }
    if (payload.entityType || payload.EntityType) {
        event.entityType = payload.entityType || payload.EntityType;
    }
    if (payload.entityKey || payload.EntityKey) {
        event.entityKey = payload.entityKey || payload.EntityKey;
    }
    if (payload.timestamp || payload.Timestamp) {
        event.timestamp = payload.timestamp || payload.Timestamp;
    }
    if (payload.d) {
        event.data = payload.d;
    }
    else if (payload.value) {
        event.data = payload.value;
    }
    else if (payload.entity || payload.Entity) {
        event.data = payload.entity || payload.Entity;
    }
    return event;
}
function extractChangedFields(oldValue, newValue) {
    const changes = {};
    if (!oldValue || !newValue ||
        typeof oldValue !== 'object' ||
        typeof newValue !== 'object') {
        return changes;
    }
    for (const [key, newVal] of Object.entries(newValue)) {
        const oldVal = oldValue[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes[key] = {
                old: oldVal,
                new: newVal,
            };
        }
    }
    for (const key of Object.keys(oldValue)) {
        if (!(key in newValue)) {
            changes[key] = {
                old: oldValue[key],
                new: undefined,
            };
        }
    }
    return changes;
}
function validateBasicAuth(authHeader, expectedUsername, expectedPassword) {
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return false;
    }
    try {
        const base64Credentials = authHeader.substring(6);
        const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = decodedCredentials.split(':');
        const usernameMatches = username === expectedUsername;
        const passwordMatches = crypto.timingSafeEqual(Buffer.from(password || ''), Buffer.from(expectedPassword));
        return usernameMatches && passwordMatches;
    }
    catch (error) {
        return false;
    }
}
function extractBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}
function safeJsonParse(jsonString, defaultValue) {
    try {
        return JSON.parse(jsonString);
    }
    catch {
        return defaultValue;
    }
}
function buildWebhookResponse(success, message, data) {
    const response = {
        success,
        message,
        timestamp: new Date().toISOString(),
    };
    if (data) {
        response.data = data;
    }
    return response;
}
function buildWebhookErrorResponse(message, statusCode = 400) {
    return {
        success: false,
        error: message,
        statusCode,
        timestamp: new Date().toISOString(),
    };
}
function sanitizePayload(payload, sensitiveFields = ['password', 'token', 'secret', 'apiKey']) {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }
    const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };
    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '***REDACTED***';
        }
    }
    for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizePayload(value, sensitiveFields);
        }
    }
    return sanitized;
}
class WebhookRateLimiter {
    constructor(config) {
        this.cleanupTimer = null;
        this.config = config;
        this.requests = new Map();
        this.startCleanupTimer();
    }
    static getInstance(config) {
        var _a, _b;
        const DEFAULT_MAX_REQUESTS = 100;
        const DEFAULT_WINDOW_MS = 60000;
        const fullConfig = {
            maxRequests: (_a = config === null || config === void 0 ? void 0 : config.maxRequests) !== null && _a !== void 0 ? _a : DEFAULT_MAX_REQUESTS,
            windowMs: (_b = config === null || config === void 0 ? void 0 : config.windowMs) !== null && _b !== void 0 ? _b : DEFAULT_WINDOW_MS,
        };
        if (!WebhookRateLimiter.instance) {
            WebhookRateLimiter.instance = new WebhookRateLimiter(fullConfig);
        }
        else if (config) {
            WebhookRateLimiter.instance.config = fullConfig;
        }
        return WebhookRateLimiter.instance;
    }
    static resetInstance() {
        if (WebhookRateLimiter.instance) {
            WebhookRateLimiter.instance.destroy();
            WebhookRateLimiter.instance = undefined;
        }
    }
    checkLimit(ip) {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        let timestamps = this.requests.get(ip) || [];
        timestamps = timestamps.filter(ts => ts > windowStart);
        const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
        const resetTime = now + this.config.windowMs;
        if (timestamps.length >= this.config.maxRequests) {
            const oldestTimestamp = timestamps[0];
            const retryAfter = Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);
            return {
                allowed: false,
                remaining: 0,
                resetTime,
                retryAfter: Math.max(1, retryAfter),
            };
        }
        timestamps.push(now);
        this.requests.set(ip, timestamps);
        return {
            allowed: true,
            remaining: remaining - 1,
            resetTime,
        };
    }
    getStatus(ip) {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const timestamps = this.requests.get(ip) || [];
        const validTimestamps = timestamps.filter(ts => ts > windowStart);
        return {
            requests: validTimestamps.length,
            remaining: Math.max(0, this.config.maxRequests - validTimestamps.length),
            windowMs: this.config.windowMs,
        };
    }
    resetIp(ip) {
        this.requests.delete(ip);
    }
    startCleanupTimer() {
        const CLEANUP_INTERVAL = 5 * 60 * 1000;
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, CLEANUP_INTERVAL);
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }
    cleanup() {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        for (const [ip, timestamps] of this.requests.entries()) {
            const validTimestamps = timestamps.filter(ts => ts > windowStart);
            if (validTimestamps.length === 0) {
                this.requests.delete(ip);
            }
            else if (validTimestamps.length !== timestamps.length) {
                this.requests.set(ip, validTimestamps);
            }
        }
    }
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.requests.clear();
    }
    getTrackedIpCount() {
        return this.requests.size;
    }
}
exports.WebhookRateLimiter = WebhookRateLimiter;
function checkWebhookRateLimit(clientIp, maxRequests = 100, windowMs = 60000) {
    const ip = clientIp.replace(/^::ffff:/i, '');
    const rateLimiter = WebhookRateLimiter.getInstance({ maxRequests, windowMs });
    return rateLimiter.checkLimit(ip);
}
