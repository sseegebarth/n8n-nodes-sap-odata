import * as crypto from 'crypto';
import { IDataObject } from 'n8n-workflow';

/**
 * WebhookUtils - Shared utilities for webhook processing
 *
 * This module contains reusable functions for webhook authentication,
 * validation, and payload processing across different webhook nodes.
 */

/**
 * Verify HMAC signature for webhook payload
 *
 * @param payload - Raw request body
 * @param signature - Signature from request header
 * @param secret - Shared secret key
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns true if signature is valid
 */
export function verifyHmacSignature(
	payload: string | Buffer,
	signature: string,
	secret: string,
	algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
	if (!signature || !secret) {
		return false;
	}

	// Calculate HMAC
	const hmac = crypto.createHmac(algorithm, secret);
	hmac.update(payload);
	const calculatedSignature = hmac.digest('hex');

	// Use constant-time comparison to prevent timing attacks
	return crypto.timingSafeEqual(
		Buffer.from(signature, 'hex'),
		Buffer.from(calculatedSignature, 'hex')
	);
}

/**
 * Generate HMAC signature for payload
 *
 * @param payload - Data to sign
 * @param secret - Shared secret key
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Hex-encoded signature
 */
export function generateHmacSignature(
	payload: string | Buffer,
	secret: string,
	algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
	const hmac = crypto.createHmac(algorithm, secret);
	hmac.update(payload);
	return hmac.digest('hex');
}

/**
 * Convert IPv4 address to 32-bit integer
 *
 * @param ip - IPv4 address string
 * @returns 32-bit integer representation
 */
function ipv4ToInt(ip: string): number {
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
		throw new Error('Invalid IPv4 address');
	}
	return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if IPv4 address is in CIDR range
 *
 * @param ip - IPv4 address to check
 * @param cidr - CIDR notation (e.g., '192.168.1.0/24')
 * @returns true if IP is in range
 */
function isIpv4InCidr(ip: string, cidr: string): boolean {
	const [network, maskBits] = cidr.split('/');
	const networkInt = ipv4ToInt(network);
	const ipInt = ipv4ToInt(ip);
	const mask = maskBits ? (-1 << (32 - parseInt(maskBits, 10))) >>> 0 : 0xFFFFFFFF;

	return (networkInt & mask) === (ipInt & mask);
}

/**
 * Parse IPv6 address into array of 16-bit segments
 *
 * @param ipv6 - IPv6 address string
 * @returns Array of 8 16-bit integers
 */
function parseIpv6(ipv6: string): number[] {
	// Handle IPv4-mapped IPv6 addresses
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

	// Expand :: notation
	const parts = ipv6.split(':');
	const segments: number[] = [];

	for (let i = 0; i < parts.length; i++) {
		if (parts[i] === '') {
			// Found ::, need to expand
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
		} else if (i === parts.length - 1) {
			// No :: found, just parse normally
			for (const part of parts) {
				segments.push(parseInt(part || '0', 16));
			}
		}
	}

	// Pad with zeros if needed
	while (segments.length < 8) {
		segments.push(0);
	}

	return segments.slice(0, 8);
}

/**
 * Check if IPv6 address is in CIDR range
 *
 * @param ip - IPv6 address to check
 * @param cidr - CIDR notation (e.g., '2001:db8::/32')
 * @returns true if IP is in range
 */
function isIpv6InCidr(ip: string, cidr: string): boolean {
	const [network, maskBits = '128'] = cidr.split('/');
	const networkSegments = parseIpv6(network);
	const ipSegments = parseIpv6(ip);
	const prefixLength = parseInt(maskBits, 10);

	// Compare bit by bit up to prefix length
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

/**
 * Normalize IPv6 address to full expanded form for comparison
 *
 * @param ipv6 - IPv6 address (compressed or expanded)
 * @returns Normalized IPv6 address as lowercase string
 */
function normalizeIpv6(ipv6: string): string {
	try {
		const segments = parseIpv6(ipv6);
		return segments.map(s => s.toString(16).padStart(4, '0')).join(':').toLowerCase();
	} catch {
		return ipv6.toLowerCase();
	}
}

/**
 * Check if IP address is allowed based on whitelist
 * Supports CIDR notation for both IPv4 and IPv6
 *
 * @param clientIp - Client IP address
 * @param whitelist - Array of allowed IPs or CIDR ranges
 * @returns true if IP is allowed
 */
export function isIpAllowed(clientIp: string, whitelist: string[]): boolean {
	// Handle wildcard
	if (whitelist.includes('*')) {
		return true;
	}

	// Remove IPv6 prefix if present (for IPv4-mapped IPv6 addresses)
	const ip = clientIp.replace(/^::ffff:/i, '');
	const isIpv6 = ip.includes(':');

	// Pre-normalize IPv6 for comparison
	const normalizedIp = isIpv6 ? normalizeIpv6(ip) : ip;

	for (const allowed of whitelist) {
		try {
			const allowedIsIpv6 = allowed.includes(':') && !allowed.includes('/');

			// Exact match (with IPv6 normalization)
			if (isIpv6 && allowedIsIpv6) {
				if (normalizedIp === normalizeIpv6(allowed)) {
					return true;
				}
			} else if (ip === allowed) {
				return true;
			}

			// CIDR notation check
			if (allowed.includes('/')) {
				const allowedCidrIsIpv6 = allowed.includes(':');

				// Skip if IP version doesn't match
				if (isIpv6 !== allowedCidrIsIpv6) {
					continue;
				}

				if (isIpv6) {
					if (isIpv6InCidr(ip, allowed)) {
						return true;
					}
				} else {
					if (isIpv4InCidr(ip, allowed)) {
						return true;
					}
				}
			}
		} catch {
			// Invalid IP or CIDR notation, skip silently
			continue;
		}
	}

	return false;
}

/**
 * Validate if payload is a valid SAP OData structure
 *
 * @param payload - Payload to validate
 * @returns true if valid OData payload
 */
export function isValidSapODataPayload(payload: any): boolean {
	if (!payload || typeof payload !== 'object') {
		return false;
	}

	// Check for OData V2 structure (wrapped in 'd' property)
	const hasODataV2Structure = 'd' in payload;

	// Check for OData V4 structure
	const hasODataV4Structure = 'value' in payload || '@odata.context' in payload;

	// Check for event metadata
	const hasEventMetadata = 'event' in payload ||
		'operation' in payload ||
		'entityType' in payload;

	// Accept if it has any known structure or is a non-empty object
	return hasODataV2Structure ||
		hasODataV4Structure ||
		hasEventMetadata ||
		Object.keys(payload).length > 0;
}

/**
 * Validate if payload is a valid SAP IDoc XML structure
 *
 * @param xmlData - XML string to validate
 * @returns true if valid IDoc XML
 */
export function isValidSapIdocXml(xmlData: string): boolean {
	if (!xmlData || typeof xmlData !== 'string') {
		return false;
	}

	// Basic XML structure check
	if (!xmlData.includes('<') || !xmlData.includes('>')) {
		return false;
	}

	// Check for IDoc-specific elements
	const hasIdocStructure =
		xmlData.includes('IDOC') ||
		xmlData.includes('EDI_DC40') ||
		xmlData.includes('CONTROL');

	return hasIdocStructure;
}

/**
 * Parse SAP date formats (/Date(timestamp)/) to ISO strings
 *
 * @param obj - Object containing SAP dates
 * @returns Object with parsed dates
 */
export function parseSapDates(obj: any): any {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(parseSapDates);
	}

	const result: any = {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'string') {
			// SAP date format: /Date(1234567890000)/
			const dateMatch = value.match(/^\/Date\((\d+)\)\/$/);
			if (dateMatch) {
				const timestamp = parseInt(dateMatch[1], 10);
				result[key] = new Date(timestamp).toISOString();
			} else {
				result[key] = value;
			}
		} else if (typeof value === 'object') {
			result[key] = parseSapDates(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Extract event information from SAP webhook payload
 *
 * @param payload - Webhook payload
 * @returns Extracted event information
 */
export function extractEventInfo(payload: any): IDataObject {
	const event: IDataObject = {};

	// Extract common SAP event fields
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

	// Extract timestamp
	if (payload.timestamp || payload.Timestamp) {
		event.timestamp = payload.timestamp || payload.Timestamp;
	}

	// Extract entity data
	if (payload.d) {
		// OData V2
		event.data = payload.d;
	} else if (payload.value) {
		// OData V4
		event.data = payload.value;
	} else if (payload.entity || payload.Entity) {
		event.data = payload.entity || payload.Entity;
	}

	return event;
}

/**
 * Compare two objects and extract changed fields
 *
 * @param oldValue - Previous state
 * @param newValue - Current state
 * @returns Object with changed fields showing old and new values
 */
export function extractChangedFields(oldValue: any, newValue: any): IDataObject {
	const changes: IDataObject = {};

	if (!oldValue || !newValue ||
		typeof oldValue !== 'object' ||
		typeof newValue !== 'object') {
		return changes;
	}

	// Check all fields in newValue
	for (const [key, newVal] of Object.entries(newValue)) {
		const oldVal = oldValue[key];

		// Deep comparison using JSON
		if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
			changes[key] = {
				old: oldVal,
				new: newVal,
			};
		}
	}

	// Check for deleted fields
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

/**
 * Validate Basic Authentication credentials
 *
 * @param authHeader - Authorization header value
 * @param expectedUsername - Expected username
 * @param expectedPassword - Expected password
 * @returns true if credentials match
 */
export function validateBasicAuth(
	authHeader: string | undefined,
	expectedUsername: string,
	expectedPassword: string
): boolean {
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return false;
	}

	try {
		const base64Credentials = authHeader.substring(6);
		const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
		const [username, password] = decodedCredentials.split(':');

		// Use constant-time comparison for passwords
		const usernameMatches = username === expectedUsername;
		const passwordMatches = crypto.timingSafeEqual(
			Buffer.from(password || ''),
			Buffer.from(expectedPassword)
		);

		return usernameMatches && passwordMatches;
	} catch (error) {
		return false;
	}
}

/**
 * Extract bearer token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Token or null if not found
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7);
}

/**
 * Safely parse JSON with error handling
 *
 * @param jsonString - JSON string to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed object or default value
 */
export function safeJsonParse<T = any>(jsonString: string, defaultValue: T): T {
	try {
		return JSON.parse(jsonString);
	} catch {
		return defaultValue;
	}
}

/**
 * Build standardized webhook response
 *
 * @param success - Whether the webhook was processed successfully
 * @param message - Response message
 * @param data - Optional response data
 * @returns Response object
 */
export function buildWebhookResponse(
	success: boolean,
	message: string,
	data?: IDataObject
): IDataObject {
	const response: IDataObject = {
		success,
		message,
		timestamp: new Date().toISOString(),
	};

	if (data) {
		response.data = data;
	}

	return response;
}

/**
 * Build error response for webhook
 *
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @returns Error response object
 */
export function buildWebhookErrorResponse(
	message: string,
	statusCode = 400
): IDataObject {
	return {
		success: false,
		error: message,
		statusCode,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Sanitize webhook payload to remove sensitive data
 *
 * @param payload - Payload to sanitize
 * @param sensitiveFields - Array of field names to remove
 * @returns Sanitized payload
 */
export function sanitizePayload(
	payload: any,
	sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey']
): any {
	if (!payload || typeof payload !== 'object') {
		return payload;
	}

	const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };

	for (const field of sensitiveFields) {
		if (field in sanitized) {
			sanitized[field] = '***REDACTED***';
		}
	}

	// Recursively sanitize nested objects
	for (const [key, value] of Object.entries(sanitized)) {
		if (typeof value === 'object' && value !== null) {
			sanitized[key] = sanitizePayload(value, sensitiveFields);
		}
	}

	return sanitized;
}

/**
 * Rate limiter configuration
 */
export interface IRateLimitConfig {
	maxRequests: number;    // Maximum requests allowed in window
	windowMs: number;       // Time window in milliseconds
}

/**
 * Rate limit check result
 */
export interface IRateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;      // Unix timestamp when limit resets
	retryAfter?: number;    // Seconds until retry allowed (if blocked)
}

/**
 * Webhook Rate Limiter using sliding window algorithm
 *
 * Tracks request counts per IP address to prevent DoS attacks.
 * Uses a sliding window approach for smooth rate limiting.
 *
 * Features:
 * - Per-IP rate limiting
 * - Configurable limits and windows
 * - Automatic cleanup of old entries
 * - Memory-efficient sliding window
 */
export class WebhookRateLimiter {
	private static instance: WebhookRateLimiter | undefined;
	private requests: Map<string, number[]>;
	private config: IRateLimitConfig;
	private cleanupTimer: NodeJS.Timeout | null = null;

	private constructor(config: IRateLimitConfig) {
		this.config = config;
		this.requests = new Map();
		this.startCleanupTimer();
	}

	/**
	 * Get singleton instance with optional config update
	 */
	static getInstance(config?: Partial<IRateLimitConfig>): WebhookRateLimiter {
		// Import defaults here to avoid circular dependency
		const DEFAULT_MAX_REQUESTS = 100;
		const DEFAULT_WINDOW_MS = 60000;

		const fullConfig: IRateLimitConfig = {
			maxRequests: config?.maxRequests ?? DEFAULT_MAX_REQUESTS,
			windowMs: config?.windowMs ?? DEFAULT_WINDOW_MS,
		};

		if (!WebhookRateLimiter.instance) {
			WebhookRateLimiter.instance = new WebhookRateLimiter(fullConfig);
		} else if (config) {
			// Update config if provided
			WebhookRateLimiter.instance.config = fullConfig;
		}

		return WebhookRateLimiter.instance;
	}

	/**
	 * Reset singleton instance (useful for testing)
	 */
	static resetInstance(): void {
		if (WebhookRateLimiter.instance) {
			WebhookRateLimiter.instance.destroy();
			WebhookRateLimiter.instance = undefined;
		}
	}

	/**
	 * Check if request from IP is allowed
	 *
	 * @param ip - Client IP address
	 * @returns Rate limit result with remaining count and reset time
	 */
	checkLimit(ip: string): IRateLimitResult {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		// Get or create request history for this IP
		let timestamps = this.requests.get(ip) || [];

		// Remove timestamps outside the current window
		timestamps = timestamps.filter(ts => ts > windowStart);

		// Calculate remaining requests
		const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
		const resetTime = now + this.config.windowMs;

		if (timestamps.length >= this.config.maxRequests) {
			// Rate limit exceeded
			const oldestTimestamp = timestamps[0];
			const retryAfter = Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);

			return {
				allowed: false,
				remaining: 0,
				resetTime,
				retryAfter: Math.max(1, retryAfter),
			};
		}

		// Add current request timestamp
		timestamps.push(now);
		this.requests.set(ip, timestamps);

		return {
			allowed: true,
			remaining: remaining - 1,
			resetTime,
		};
	}

	/**
	 * Get current status for an IP
	 */
	getStatus(ip: string): { requests: number; remaining: number; windowMs: number } {
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

	/**
	 * Clear rate limit for a specific IP (e.g., after successful auth)
	 */
	resetIp(ip: string): void {
		this.requests.delete(ip);
	}

	/**
	 * Start periodic cleanup of expired entries
	 */
	private startCleanupTimer(): void {
		// Cleanup every 5 minutes
		const CLEANUP_INTERVAL = 5 * 60 * 1000;

		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, CLEANUP_INTERVAL);

		// Don't prevent process exit
		if (this.cleanupTimer.unref) {
			this.cleanupTimer.unref();
		}
	}

	/**
	 * Remove expired entries to free memory
	 */
	private cleanup(): void {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		for (const [ip, timestamps] of this.requests.entries()) {
			const validTimestamps = timestamps.filter(ts => ts > windowStart);

			if (validTimestamps.length === 0) {
				this.requests.delete(ip);
			} else if (validTimestamps.length !== timestamps.length) {
				this.requests.set(ip, validTimestamps);
			}
		}
	}

	/**
	 * Destroy the rate limiter and cleanup resources
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.requests.clear();
	}

	/**
	 * Get total number of tracked IPs
	 */
	getTrackedIpCount(): number {
		return this.requests.size;
	}
}

/**
 * Check rate limit for webhook request
 *
 * Convenience function that uses the singleton rate limiter.
 *
 * @param clientIp - Client IP address
 * @param maxRequests - Maximum requests per window (default: 100)
 * @param windowMs - Time window in milliseconds (default: 60000)
 * @returns Rate limit result
 */
export function checkWebhookRateLimit(
	clientIp: string,
	maxRequests = 100,
	windowMs = 60000
): IRateLimitResult {
	// Normalize IP (remove IPv6 prefix for IPv4-mapped addresses)
	const ip = clientIp.replace(/^::ffff:/i, '');

	const rateLimiter = WebhookRateLimiter.getInstance({ maxRequests, windowMs });
	return rateLimiter.checkLimit(ip);
}