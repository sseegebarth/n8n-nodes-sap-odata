import * as crypto from 'crypto';
import { IDataObject, INode, NodeOperationError } from 'n8n-workflow';
import { convertSapDate } from './TypeConverter';

export function verifyHmacSignature(
	payload: string | Buffer,
	signature: string,
	secret: string,
	algorithm: 'sha256' | 'sha512' = 'sha256',
): boolean {
	if (!signature || !secret) return false;
	if (!/^[a-fA-F0-9]+$/.test(signature)) return false;

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
	} catch {
		return false;
	}
}

function ipv4ToInt(ip: string, node?: INode): number {
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
		throw new NodeOperationError(
			node ?? ({ name: 'WebhookUtils', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0], parameters: {} } as INode),
			'Invalid IPv4 address',
		);
	}
	return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpv4InCidr(ip: string, cidr: string, node?: INode): boolean {
	const [network, maskBits] = cidr.split('/');
	const networkInt = ipv4ToInt(network, node);
	const ipInt = ipv4ToInt(ip, node);
	const mask = maskBits ? (-1 << (32 - parseInt(maskBits, 10))) >>> 0 : 0xffffffff;
	return (networkInt & mask) === (ipInt & mask);
}

export function isIpAllowed(clientIp: string, whitelist: string[], node?: INode): boolean {
	if (whitelist.includes('*')) return true;

	const ip = clientIp.replace(/^::ffff:/i, '');
	const isIpv6 = ip.includes(':');

	for (const allowed of whitelist) {
		try {
			if (ip === allowed) return true;

			if (allowed.includes('/') && !isIpv6 && !allowed.includes(':')) {
				if (isIpv4InCidr(ip, allowed, node)) return true;
			}
		} catch {
			continue;
		}
	}
	return false;
}

export function isValidSapODataPayload(payload: any): boolean {
	if (!payload || typeof payload !== 'object') return false;

	return (
		'd' in payload ||
		'value' in payload ||
		'@odata.context' in payload ||
		'event' in payload ||
		'operation' in payload ||
		'entityType' in payload ||
		Object.keys(payload).length > 0
	);
}

export function parseSapDates(obj: any): any {
	if (typeof obj !== 'object' || obj === null) return obj;
	if (Array.isArray(obj)) return obj.map(parseSapDates);

	const result: any = {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'string') {
			const converted = convertSapDate(value);
			result[key] = converted ?? value;
		} else if (typeof value === 'object') {
			result[key] = parseSapDates(value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

export function extractEventInfo(payload: any): IDataObject {
	const event: IDataObject = {};

	if (payload.event) event.type = payload.event;
	if (payload.operation) event.operation = payload.operation;
	if (payload.entityType || payload.EntityType) event.entityType = payload.entityType || payload.EntityType;
	if (payload.entityKey || payload.EntityKey) event.entityKey = payload.entityKey || payload.EntityKey;
	if (payload.timestamp || payload.Timestamp) event.timestamp = payload.timestamp || payload.Timestamp;

	if (payload.d) {
		event.data = payload.d;
	} else if (payload.value) {
		event.data = payload.value;
	} else if (payload.entity || payload.Entity) {
		event.data = payload.entity || payload.Entity;
	}

	return event;
}

export function extractChangedFields(oldValue: any, newValue: any): IDataObject {
	const changes: IDataObject = {};

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

export interface IRateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;
	retryAfter?: number;
}

const rateLimitRequests = new Map<string, number[]>();

export function checkWebhookRateLimit(
	clientIp: string,
	maxRequests = 100,
	windowMs = 60000,
): IRateLimitResult {
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
