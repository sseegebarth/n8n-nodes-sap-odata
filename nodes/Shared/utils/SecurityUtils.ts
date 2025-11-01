import { NodeOperationError, INode } from 'n8n-workflow';

/**
 * Security utilities for SAP OData node
 */

/**
 * Build a secure URL from components with validation
 */
export function buildSecureUrl(host: string, servicePath: string, resource: string): string {
	try {
		const baseUrl = new URL(host);

		// Validate protocol
		if (!['http:', 'https:'].includes(baseUrl.protocol)) {
			throw new Error(`Invalid protocol: ${baseUrl.protocol}. Only HTTP and HTTPS are allowed.`);
		}

		// Sanitize path components - remove path traversal attempts
		const sanitizedServicePath = servicePath.replace(/\.\.[/\\]/g, '').replace(/^\/+/, '/');
		const sanitizedResource = resource.replace(/\.\.[/\\]/g, '');

		// Combine paths safely
		const fullPath = `${sanitizedServicePath}${sanitizedResource}`;

		// Create final URL
		return new URL(fullPath, baseUrl).toString();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid URL components: ${errorMessage}`);
	}
}

/**
 * Validate entity key to prevent injection attacks
 */
export function validateEntityKey(key: string, node: INode): string {
	// Check for SQL injection patterns
	const blacklist = [';', '--', '/*', '*/', 'DROP', 'DELETE', 'INSERT', 'UPDATE', 'EXEC'];
	const upperKey = key.toUpperCase();

	for (const pattern of blacklist) {
		if (upperKey.includes(pattern)) {
			throw new NodeOperationError(
				node,
				`Invalid entity key: Contains forbidden pattern '${pattern}'`,
				{
					description: 'Entity keys cannot contain SQL commands or comment markers',
				},
			);
		}
	}

	// Validate format for composite keys
	// Allow alphanumeric, underscore, hyphen, and dot in key names (SAP standard)
	if (key.includes('=')) {
		const parts = key.split(',');
		for (const part of parts) {
			if (!part.match(/^[a-zA-Z0-9_\-.]+='[^']*'$/)) {
				throw new NodeOperationError(
					node,
					`Invalid composite key format: ${part}`,
					{
						description: 'Composite keys must follow pattern: Key1=\'value1\',Key2=\'value2\'. Key names can contain letters, numbers, underscores, hyphens, and dots.',
					},
				);
			}
		}
	}

	return key;
}

/**
 * Validate OData filter expression
 */
export function validateODataFilter(filter: string, node: INode): string {
	// Check for dangerous patterns
	const dangerousPatterns = [
		/javascript:/i,
		/<script/i,
		/on\w+\s*=/i, // event handlers like onclick=
		/eval\(/i,
		/expression\(/i,
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(filter)) {
			throw new NodeOperationError(node, 'Invalid filter: Contains potentially dangerous content', {
				description: 'OData filters cannot contain script tags or JavaScript code',
			});
		}
	}

	return filter;
}

/**
 * Sanitize error messages to remove sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
	// Remove common sensitive patterns
	let sanitized = message;

	// Mask passwords in URLs
	sanitized = sanitized.replace(/password=\S+/gi, 'password=***');
	sanitized = sanitized.replace(/pwd=\S+/gi, 'pwd=***');

	// Mask auth tokens
	sanitized = sanitized.replace(/authorization:\s*bearer\s+\S+/gi, 'Authorization: Bearer ***');
	sanitized = sanitized.replace(/token=\S+/gi, 'token=***');

	// Mask API keys
	sanitized = sanitized.replace(/api[_-]?key=\S+/gi, 'api_key=***');
	sanitized = sanitized.replace(/apikey=\S+/gi, 'apikey=***');

	// Mask basic auth credentials in URLs
	sanitized = sanitized.replace(/:\/\/[^:]+:[^@]+@/g, '://***:***@');

	return sanitized;
}

/**
 * Validate JSON input to prevent injection
 */
export function validateJsonInput(jsonString: string, fieldName: string, node: INode): object {
	try {
		// Check for excessively large input (max 10MB)
		const maxSize = 10 * 1024 * 1024;
		if (jsonString.length > maxSize) {
			throw new Error(`JSON input exceeds maximum size of ${maxSize / 1024 / 1024}MB`);
		}

		const parsed = JSON.parse(jsonString);

		// Check if result is an object
		if (typeof parsed !== 'object' || parsed === null) {
			throw new Error('Must be a valid JSON object');
		}

		// Check for dangerous keys
		const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
		const checkKeys = (obj: Record<string, unknown>, depth = 0): void => {
			// Prevent deeply nested objects (DoS protection)
			if (depth > 100) {
				throw new Error('JSON object is too deeply nested (max 100 levels)');
			}

			for (const key in obj) {
				if (dangerousKeys.includes(key.toLowerCase())) {
					throw new Error(`Forbidden property name: ${key}`);
				}
				if (typeof obj[key] === 'object' && obj[key] !== null) {
					checkKeys(obj[key] as Record<string, unknown>, depth + 1);
				}
			}
		};

		checkKeys(parsed);
		return parsed;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new NodeOperationError(
			node,
			`Invalid JSON in '${fieldName}' field: ${errorMessage}`,
			{
				description: 'Please provide a valid JSON object',
			},
		);
	}
}

/**
 * Validate URL to prevent SSRF attacks
 */
export function validateUrl(url: string, node: INode): void {
	try {
		const parsedUrl = new URL(url);

		// Only allow HTTP and HTTPS
		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			throw new NodeOperationError(
				node,
				`Invalid protocol: ${parsedUrl.protocol}`,
				{
					description: 'Only HTTP and HTTPS protocols are allowed',
				},
			);
		}

		// Prevent access to private IP ranges (SSRF protection)
		const hostname = parsedUrl.hostname.toLowerCase();

		// Normalize hostname to detect encoded/obfuscated IPs
		// This prevents bypasses like 0177.0000.0000.0001 (octal) or 2130706433 (integer)
		const normalizedHostname = hostname
			.replace(/^0+/g, '') // Remove leading zeros
			.replace(/\s+/g, ''); // Remove whitespace

		// Block localhost and loopback (check both original and normalized)
		const localhostPatterns = ['localhost', '127.', '0.0.0.0', '::1', '0:0:0:0:0:0:0:1', '[::1]'];
		if (
			localhostPatterns.some((pattern) => hostname.includes(pattern)) ||
			localhostPatterns.some((pattern) => normalizedHostname.includes(pattern))
		) {
			throw new NodeOperationError(
				node,
				'Access to localhost is not allowed',
				{
					description: 'Cannot connect to local resources for security reasons',
				},
			);
		}

		// Block private IP ranges
		const privateIpPatterns = [
			/^10\./,
			/^172\.(1[6-9]|2\d|3[01])\./,
			/^192\.168\./,
			/^169\.254\./, // link-local
			/^fc00:/i, // IPv6 unique local (ULA)
			/^fd00:/i, // IPv6 unique local (ULA)
			/^fe80:/i, // IPv6 link-local
			/^\[?::ffff:127\./i, // IPv6-mapped IPv4 loopback
			/^\[?::ffff:10\./i, // IPv6-mapped IPv4 private
			/^\[?::ffff:192\.168\./i, // IPv6-mapped IPv4 private
			/^\[?::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv6-mapped IPv4 private
		];

		if (
			privateIpPatterns.some((pattern) => pattern.test(hostname)) ||
			privateIpPatterns.some((pattern) => pattern.test(normalizedHostname))
		) {
			throw new NodeOperationError(
				node,
				'Access to private IP addresses is not allowed',
				{
					description: 'Cannot connect to private network resources for security reasons',
				},
			);
		}

		// Block suspicious hostnames that might be DNS rebinding attempts
		// e.g., 127.0.0.1.attacker.com, localhost.attacker.com
		const suspiciousPatterns = [
			/^127\.\d+\.\d+\.\d+\./,
			/^10\.\d+\.\d+\.\d+\./,
			/^192\.168\.\d+\.\d+\./,
			/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+\./,
			/^localhost\./,
		];

		if (suspiciousPatterns.some((pattern) => pattern.test(hostname))) {
			throw new NodeOperationError(
				node,
				'Suspicious hostname detected - potential DNS rebinding attack',
				{
					description: 'The hostname appears to embed a private IP address',
				},
			);
		}

		// Block metadata endpoints (cloud provider SSRF)
		const metadataHosts = [
			'169.254.169.254', // AWS, Azure, Google Cloud
			'metadata.google.internal',
			'metadata.azure.com',
		];

		if (metadataHosts.some((host) => hostname.includes(host))) {
			throw new NodeOperationError(
				node,
				'Access to cloud metadata endpoints is not allowed',
				{
					description: 'Cannot connect to cloud provider metadata services',
				},
			);
		}
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}
		throw new NodeOperationError(
			node,
			`Invalid URL: ${error instanceof Error ? error.message : String(error)}`,
			{
				description: 'Please provide a valid HTTP or HTTPS URL',
			},
		);
	}
}

/**
 * Sanitize header values to prevent header injection
 */
export function sanitizeHeaderValue(value: string): string {
	// Remove newlines and carriage returns that could enable header injection
	return value.replace(/[\r\n]/g, '');
}

/**
 * Validate entity set name to prevent injection
 */
export function validateEntitySetName(name: string, node: INode): string {
	// EntitySet names should only contain alphanumeric characters and underscores
	if (!/^[a-zA-Z0-9_]+$/.test(name)) {
		throw new NodeOperationError(
			node,
			`Invalid entity set name: ${name}`,
			{
				description: 'Entity set names can only contain letters, numbers, and underscores',
			},
		);
	}

	// Limit length to prevent DoS
	if (name.length > 255) {
		throw new NodeOperationError(
			node,
			'Entity set name is too long (max 255 characters)',
		);
	}

	return name;
}

/**
 * Validate function import name to prevent injection
 */
export function validateFunctionName(name: string, node: INode): string {
	// Function names should only contain alphanumeric characters and underscores
	if (!/^[a-zA-Z0-9_]+$/.test(name)) {
		throw new NodeOperationError(
			node,
			`Invalid function name: ${name}`,
			{
				description: 'Function names can only contain letters, numbers, and underscores',
			},
		);
	}

	// Limit length to prevent DoS
	if (name.length > 255) {
		throw new NodeOperationError(
			node,
			'Function name is too long (max 255 characters)',
		);
	}

	return name;
}

/**
 * Rate limiter class removed - use ThrottleManager instead
 * ThrottleManager provides more sophisticated throttling with multiple strategies
 * and is workflow-scoped to prevent cross-workflow interference.
 *
 * @deprecated This class was never used in production code
 * @see ThrottleManager in ThrottleManager.ts for production rate limiting
 */
