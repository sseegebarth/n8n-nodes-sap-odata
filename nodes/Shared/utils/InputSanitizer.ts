/**
 * InputSanitizer - Comprehensive input validation and sanitization
 * Provides security-focused input cleaning for various data types
 */

import { INode, NodeOperationError } from 'n8n-workflow';

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(
	input: string,
	maxLength = 1000,
	allowedPattern?: RegExp
): string {
	// Check length
	if (input.length > maxLength) {
		throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
	}

	// Remove null bytes
	let sanitized = input.replace(/\x00/g, '');

	// Remove control characters except tab, newline, carriage return
	sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

	// Apply custom pattern if provided
	if (allowedPattern && !allowedPattern.test(sanitized)) {
		throw new Error('Input contains invalid characters');
	}

	return sanitized;
}

/**
 * Sanitize object keys to prevent prototype pollution
 */
export function sanitizeObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
	const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
	const sanitized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		// Skip dangerous keys
		if (dangerousKeys.includes(key.toLowerCase())) {
			continue;
		}

		// Recursively sanitize nested objects
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			sanitized[key] = sanitizeObjectKeys(value as Record<string, unknown>);
		} else if (Array.isArray(value)) {
			sanitized[key] = value.map(item =>
				item && typeof item === 'object' && !Array.isArray(item)
					? sanitizeObjectKeys(item as Record<string, unknown>)
					: item
			);
		} else {
			sanitized[key] = value;
		}
	}

	return sanitized;
}

/**
 * Validate and sanitize URL parameters
 */
export function sanitizeUrlParams(params: Record<string, unknown>): Record<string, string> {
	const sanitized: Record<string, string> = {};

	for (const [key, value] of Object.entries(params)) {
		// Convert value to string
		const strValue = String(value);

		// Prevent URL encoding attacks
		const cleaned = strValue
			.replace(/[<>'"]/g, '') // Remove potential XSS characters
			.replace(/javascript:/gi, '') // Remove javascript protocol
			.replace(/data:/gi, ''); // Remove data protocol

		sanitized[key] = cleaned;
	}

	return sanitized;
}

/**
 * Validate and sanitize file paths
 */
export function sanitizeFilePath(path: string, node: INode): string {
	// Prevent path traversal
	if (path.includes('../') || path.includes('..\\')) {
		throw new NodeOperationError(
			node,
			'Invalid file path: Path traversal detected',
			{
				description: 'File paths cannot contain "../" or "..\\"'
			}
		);
	}

	// Remove null bytes
	const cleaned = path.replace(/\x00/g, '');

	// Check for absolute paths (security risk)
	if (/^[A-Z]:\\/i.test(cleaned) || cleaned.startsWith('/')) {
		throw new NodeOperationError(
			node,
			'Invalid file path: Absolute paths not allowed',
			{
				description: 'Please use relative paths only'
			}
		);
	}

	// Limit path length
	if (cleaned.length > 255) {
		throw new NodeOperationError(
			node,
			'File path too long (max 255 characters)'
		);
	}

	return cleaned;
}

/**
 * Sanitize SQL-like filter expressions
 */
export function sanitizeFilterExpression(filter: string, node: INode): string {
	// Check for SQL injection patterns
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
			throw new NodeOperationError(
				node,
				'Invalid filter: Potential SQL injection detected',
				{
					description: 'Filter expression contains forbidden SQL patterns'
				}
			);
		}
	}

	// Limit filter length
	if (filter.length > 5000) {
		throw new NodeOperationError(
			node,
			'Filter expression too long (max 5000 characters)'
		);
	}

	return filter;
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumeric(
	value: unknown,
	min?: number,
	max?: number,
	allowDecimals = true
): number {
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

/**
 * Sanitize array input
 */
export function sanitizeArray<T>(
	arr: unknown[],
	maxLength = 10000,
	itemSanitizer?: (item: unknown) => T
): T[] {
	if (!Array.isArray(arr)) {
		throw new Error('Input must be an array');
	}

	if (arr.length > maxLength) {
		throw new Error(`Array exceeds maximum length of ${maxLength}`);
	}

	if (itemSanitizer) {
		return arr.map(itemSanitizer);
	}

	return arr as T[];
}

/**
 * Validate email address
 */
export function validateEmail(email: string): string {
	// Basic email validation
	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailPattern.test(email)) {
		throw new Error('Invalid email address format');
	}

	// Additional security checks
	if (email.length > 254) { // RFC 5321
		throw new Error('Email address too long');
	}

	// Prevent special characters that could cause issues
	if (/[<>'"`;]/.test(email)) {
		throw new Error('Email contains invalid characters');
	}

	return email.toLowerCase();
}

/**
 * Sanitize and validate date input
 */
export function sanitizeDate(dateStr: string): Date {
	// Remove any non-standard characters
	const cleaned = dateStr.replace(/[^\d\-T:.Z+]/g, '');

	const date = new Date(cleaned);

	if (isNaN(date.getTime())) {
		throw new Error('Invalid date format');
	}

	// Check for reasonable date range (1900-2100)
	const year = date.getFullYear();
	if (year < 1900 || year > 2100) {
		throw new Error('Date out of valid range (1900-2100)');
	}

	return date;
}

/**
 * Create a sanitized copy of an object with all strings cleaned
 */
export function deepSanitize(
	obj: unknown,
	maxDepth = 10,
	currentDepth = 0
): unknown {
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
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			// Skip dangerous keys
			if (['__proto__', 'constructor', 'prototype'].includes(key)) {
				continue;
			}
			sanitized[sanitizeString(key, 255)] = deepSanitize(value, maxDepth, currentDepth + 1);
		}
		return sanitized;
	}

	return obj;
}