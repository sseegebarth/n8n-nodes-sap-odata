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
exports.verifyHmacSignature = verifyHmacSignature;
exports.isIpAllowed = isIpAllowed;
exports.isValidSapODataPayload = isValidSapODataPayload;
exports.parseSapDates = parseSapDates;
exports.extractEventInfo = extractEventInfo;
exports.extractChangedFields = extractChangedFields;
exports.checkWebhookRateLimit = checkWebhookRateLimit;
const crypto = __importStar(require("crypto"));
const n8n_workflow_1 = require("n8n-workflow");
const TypeConverter_1 = require("./TypeConverter");
function verifyHmacSignature(payload, signature, secret, algorithm = 'sha256') {
    if (!signature || !secret)
        return false;
    if (!/^[a-fA-F0-9]+$/.test(signature))
        return false;
    try {
        const hmac = crypto.createHmac(algorithm, secret);
        hmac.update(payload);
        const calculatedSignature = hmac.digest('hex');
        const sigBuffer = Buffer.from(signature, 'hex');
        const calcBuffer = Buffer.from(calculatedSignature, 'hex');
        if (sigBuffer.length !== calcBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(sigBuffer, calcBuffer);
    }
    catch {
        return false;
    }
}
function ipv4ToInt(ip, node) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        throw new n8n_workflow_1.NodeOperationError(node !== null && node !== void 0 ? node : { name: 'WebhookUtils', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0], parameters: {} }, 'Invalid IPv4 address');
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
function isIpv4InCidr(ip, cidr, node) {
    const [network, maskBits] = cidr.split('/');
    const networkInt = ipv4ToInt(network, node);
    const ipInt = ipv4ToInt(ip, node);
    const mask = maskBits ? (-1 << (32 - parseInt(maskBits, 10))) >>> 0 : 0xffffffff;
    return (networkInt & mask) === (ipInt & mask);
}
function isIpAllowed(clientIp, whitelist, node) {
    if (whitelist.includes('*'))
        return true;
    const ip = clientIp.replace(/^::ffff:/i, '');
    const isIpv6 = ip.includes(':');
    for (const allowed of whitelist) {
        try {
            if (ip === allowed)
                return true;
            if (allowed.includes('/') && !isIpv6 && !allowed.includes(':')) {
                if (isIpv4InCidr(ip, allowed, node))
                    return true;
            }
        }
        catch {
            continue;
        }
    }
    return false;
}
function isValidSapODataPayload(payload) {
    if (!payload || typeof payload !== 'object')
        return false;
    return ('d' in payload ||
        'value' in payload ||
        '@odata.context' in payload ||
        'event' in payload ||
        'operation' in payload ||
        'entityType' in payload ||
        Object.keys(payload).length > 0);
}
function parseSapDates(obj) {
    if (typeof obj !== 'object' || obj === null)
        return obj;
    if (Array.isArray(obj))
        return obj.map(parseSapDates);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            const converted = (0, TypeConverter_1.convertSapDate)(value);
            result[key] = converted !== null && converted !== void 0 ? converted : value;
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
    if (payload.event)
        event.type = payload.event;
    if (payload.operation)
        event.operation = payload.operation;
    if (payload.entityType || payload.EntityType)
        event.entityType = payload.entityType || payload.EntityType;
    if (payload.entityKey || payload.EntityKey)
        event.entityKey = payload.entityKey || payload.EntityKey;
    if (payload.timestamp || payload.Timestamp)
        event.timestamp = payload.timestamp || payload.Timestamp;
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
    if (!oldValue || !newValue || typeof oldValue !== 'object' || typeof newValue !== 'object') {
        return changes;
    }
    for (const [key, newVal] of Object.entries(newValue)) {
        const oldVal = oldValue[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes[key] = { old: oldVal, new: newVal };
        }
    }
    for (const key of Object.keys(oldValue)) {
        if (!(key in newValue)) {
            changes[key] = { old: oldValue[key], new: undefined };
        }
    }
    return changes;
}
const rateLimitRequests = new Map();
function checkWebhookRateLimit(clientIp, maxRequests = 100, windowMs = 60000) {
    const ip = clientIp.replace(/^::ffff:/i, '');
    const now = Date.now();
    const windowStart = now - windowMs;
    let timestamps = rateLimitRequests.get(ip) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);
    const remaining = Math.max(0, maxRequests - timestamps.length);
    const resetTime = now + windowMs;
    if (timestamps.length >= maxRequests) {
        const oldestTimestamp = timestamps[0];
        const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
        rateLimitRequests.set(ip, timestamps);
        return { allowed: false, remaining: 0, resetTime, retryAfter: Math.max(1, retryAfter) };
    }
    timestamps.push(now);
    rateLimitRequests.set(ip, timestamps);
    return { allowed: true, remaining: remaining - 1, resetTime };
}
