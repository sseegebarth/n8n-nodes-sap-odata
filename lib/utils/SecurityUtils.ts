import { NodeOperationError, INode } from 'n8n-workflow';
import { MAX_JSON_SIZE, MAX_NESTING_DEPTH } from '../constants';

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
 *
 * Supports:
 * - Simple keys: '0500000001' or 123
 * - Quoted strings with spaces/special chars: 'Desktop Essentials', 'AR-FB-1000'
 * - GUIDs: guid'0a71e5d7-e655-1eea-a8ad-4250e12b7e5e' or 0a71e5d7-e655-1eea-a8ad-4250e12b7e5e
 * - Composite keys: Key1='value1',Key2='value2'
 * - SAP escaped quotes: Key1='value''s'
 * - Double-quoted strings: "value"
 */
export function validateEntityKey(key: string, node: INode): string {
	// Normalize unicode to prevent bypass attacks
	const normalizedKey = key.normalize('NFC');

	// Check for SQL/OData injection patterns (but NOT inside quoted strings)
	// Only check unquoted parts for injection patterns
	const unquotedParts = extractUnquotedParts(normalizedKey);

	const blacklist = [
		';', '--', '/*', '*/', // SQL comments
		'DROP ', 'DELETE ', 'INSERT ', 'UPDATE ', 'EXEC ', 'TRUNCATE ', // SQL commands (with space to avoid false positives)
		'$filter', '$expand', '$select', '$orderby', '$top', '$skip', // OData query injection
	];

	for (const unquotedPart of unquotedParts) {
		const upperPart = unquotedPart.toUpperCase();
		for (const pattern of blacklist) {
			if (upperPart.includes(pattern.toUpperCase())) {
				throw new NodeOperationError(
					node,
					`Invalid entity key: Contains forbidden pattern '${pattern.trim()}'`,
					{
						description: 'Entity keys cannot contain SQL commands or OData query parameters',
					},
				);
			}
		}

		// Check for query string manipulation characters in unquoted parts
		if (unquotedPart.includes('&') || unquotedPart.includes('?')) {
			throw new NodeOperationError(
				node,
				'Invalid entity key: Contains forbidden characters (& or ?)',
				{
					description: 'Entity keys cannot contain query string characters outside of quoted strings',
				},
			);
		}
	}

	// Validate format for composite keys
	if (normalizedKey.includes('=') && !normalizedKey.startsWith("'") && !normalizedKey.startsWith('"') && !normalizedKey.toLowerCase().startsWith('guid')) {
		validateCompositeKey(normalizedKey, node);
	} else {
		// Simple key validation patterns
		const validPatterns = [
			/^'[^']*(?:''[^']*)*'$/, // Single-quoted string (with escaped quotes)
			/^"[^"]*"$/, // Double-quoted string
			/^\d+$/, // Numeric
			/^\d+L$/, // Long numeric (SAP specific)
			/^guid'[a-fA-F0-9-]+'$/i, // GUID format
			/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/, // Raw GUID
			/^[a-zA-Z0-9_-]+$/, // Simple alphanumeric with dashes/underscores
		];

		const isValid = validPatterns.some(pattern => pattern.test(normalizedKey));

		if (!isValid) {
			throw new NodeOperationError(
				node,
				`Invalid simple key format: ${normalizedKey}`,
				{
					description: "Simple keys must be: quoted strings ('value'), numbers (123), GUIDs (guid'...'), or alphanumeric identifiers",
				},
			);
		}
	}

	return normalizedKey;
}

/**
 * Extract unquoted parts of a string for security validation
 * This ensures we only check injection patterns outside of quoted strings
 */
function extractUnquotedParts(input: string): string[] {
	const parts: string[] = [];
	let current = '';
	let inSingleQuote = false;
	let inDoubleQuote = false;

	for (let i = 0; i < input.length; i++) {
		const char = input[i];

		if (char === "'" && !inDoubleQuote) {
			if (inSingleQuote && i + 1 < input.length && input[i + 1] === "'") {
				// Escaped quote, skip
				i++;
				continue;
			}
			if (inSingleQuote) {
				inSingleQuote = false;
			} else {
				parts.push(current);
				current = '';
				inSingleQuote = true;
			}
		} else if (char === '"' && !inSingleQuote) {
			if (inDoubleQuote) {
				inDoubleQuote = false;
			} else {
				parts.push(current);
				current = '';
				inDoubleQuote = true;
			}
		} else if (!inSingleQuote && !inDoubleQuote) {
			current += char;
		}
	}

	if (current) {
		parts.push(current);
	}

	return parts.filter(p => p.length > 0);
}

/**
 * Validate composite key format with strict parsing
 * Format: Key1='value1',Key2='value2'
 * SAP escapes single quotes by doubling: Key1='value''s'
 */
function validateCompositeKey(key: string, node: INode): void {
	// Parse composite key properly handling escaped quotes
	const parts: string[] = [];
	let current = '';
	let inQuotes = false;
	let i = 0;

	while (i < key.length) {
		const char = key[i];

		if (char === "'" && !inQuotes) {
			inQuotes = true;
			current += char;
		} else if (char === "'" && inQuotes) {
			// Check for escaped quote ('')
			if (i + 1 < key.length && key[i + 1] === "'") {
				current += "''";
				i++; // Skip next quote
			} else {
				inQuotes = false;
				current += char;
			}
		} else if (char === ',' && !inQuotes) {
			parts.push(current.trim());
			current = '';
		} else {
			current += char;
		}
		i++;
	}

	// Don't forget last part
	if (current.trim()) {
		parts.push(current.trim());
	}

	// Validate each part
	for (const part of parts) {
		const eqIndex = part.indexOf('=');
		if (eqIndex === -1) {
			throw new NodeOperationError(
				node,
				`Invalid composite key part: ${part}`,
				{
					description: "Each key-value pair must contain '=' separator",
				},
			);
		}

		const keyName = part.substring(0, eqIndex).trim();
		const value = part.substring(eqIndex + 1).trim();

		// Validate key name (strict alphanumeric with underscore, hyphen, dot)
		if (!keyName.match(/^[a-zA-Z_][a-zA-Z0-9_\-.]*$/)) {
			throw new NodeOperationError(
				node,
				`Invalid key name in composite key: ${keyName}`,
				{
					description: 'Key names must start with a letter or underscore and contain only letters, numbers, underscores, hyphens, and dots',
				},
			);
		}

		// Validate value format
		// Must be: quoted string 'xxx' (with optional escaped quotes '') or number
		if (value.startsWith("'")) {
			// Quoted string - verify proper closure and escaping
			if (!value.endsWith("'")) {
				throw new NodeOperationError(
					node,
					`Unclosed quote in composite key value: ${value}`,
					{
						description: "String values must be enclosed in single quotes",
					},
				);
			}

			// Extract content between quotes and validate escaped quotes
			const content = value.slice(1, -1);
			// Count unescaped quotes (single quotes not followed by another quote)
			const unescapedQuotes = content.split("''").join('').indexOf("'");
			if (unescapedQuotes !== -1) {
				throw new NodeOperationError(
					node,
					`Unescaped quote in composite key value: ${value}`,
					{
						description: "Single quotes within values must be escaped by doubling: ''",
					},
				);
			}
		} else if (!value.match(/^-?\d+(\.\d+)?$/)) {
			// Not a quoted string and not a number
			throw new NodeOperationError(
				node,
				`Invalid composite key value format: ${value}`,
				{
					description: "Values must be quoted strings ('value') or numbers (123)",
				},
			);
		}
	}
}

/**
 * Validate OData filter expression
 * Prevents XSS and injection attacks through filter parameters
 */
export function validateODataFilter(filter: string, node: INode): string {
	// Normalize unicode to prevent bypass attacks
	const normalizedFilter = filter.normalize('NFC');

	// Decode URL-encoded characters for validation
	let decodedFilter: string;
	try {
		decodedFilter = decodeURIComponent(normalizedFilter);
	} catch {
		decodedFilter = normalizedFilter;
	}

	// Check for dangerous patterns (check both encoded and decoded)
	const dangerousPatterns = [
		/javascript\s*:/i,
		/<\s*script/i,
		/<\s*\/\s*script/i,
		/on\w+\s*=/i, // event handlers like onclick=
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
		/data\s*:/i, // data: URLs
		/vbscript\s*:/i,
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(normalizedFilter) || pattern.test(decodedFilter)) {
			throw new NodeOperationError(node, 'Invalid filter: Contains potentially dangerous content', {
				description: 'OData filters cannot contain script tags, JavaScript code, or event handlers',
			});
		}
	}

	// Check for SQL injection patterns in OData context
	const sqlPatterns = [
		/;\s*(DROP|DELETE|INSERT|UPDATE|TRUNCATE|ALTER|CREATE)\s/i,
		/--\s*$/m, // SQL comment at end of line
		/\/\*.*\*\//s, // SQL block comment
		/UNION\s+SELECT/i,
		/EXEC\s*\(/i,
		/xp_cmdshell/i,
	];

	for (const pattern of sqlPatterns) {
		if (pattern.test(decodedFilter)) {
			throw new NodeOperationError(node, 'Invalid filter: Contains SQL injection pattern', {
				description: 'OData filters cannot contain SQL commands',
			});
		}
	}

	// Validate balanced parentheses to prevent injection via unbalanced brackets
	let parenCount = 0;
	for (const char of decodedFilter) {
		if (char === '(') parenCount++;
		if (char === ')') parenCount--;
		if (parenCount < 0) {
			throw new NodeOperationError(node, 'Invalid filter: Unbalanced parentheses', {
				description: 'Filter contains more closing parentheses than opening ones',
			});
		}
	}
	if (parenCount !== 0) {
		throw new NodeOperationError(node, 'Invalid filter: Unbalanced parentheses', {
			description: 'Filter contains unclosed parentheses',
		});
	}

	return normalizedFilter;
}

/**
 * Sanitize error messages to remove sensitive information
 * Prevents leakage of system structure, credentials, and internal details
 */
export function sanitizeErrorMessage(message: string): string {
	// Remove common sensitive patterns
	let sanitized = message;

	// === Credential Masking ===

	// Mask passwords in URLs and parameters
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

	// Mask secret/key values
	sanitized = sanitized.replace(/secret=\S+/gi, 'secret=***');
	sanitized = sanitized.replace(/client_secret=\S+/gi, 'client_secret=***');

	// === System Structure Protection ===

	// Mask absolute file paths (Unix and Windows), but NOT URL paths
	// Replace /home/user/file.txt with [path] or C:\Users\admin\file.txt with [path]
	// Negative lookbehind to skip URL paths (after :// or after domain)
	sanitized = sanitized.replace(/(?<!:\/\/.*)(?<!:\/\/[^\s]*)(\/(?:home|usr|var|tmp|etc|opt|root|Users|mnt|dev)\/[\w.-/]+|[A-Z]:\\(?:[\w.-]+\\)+[\w.-]+)/gi, '[path]');

	// Mask internal IP addresses (private ranges)
	sanitized = sanitized.replace(/\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, '[internal-ip]');

	// Mask localhost references
	sanitized = sanitized.replace(/\blocalhost(?::\d+)?\b/gi, '[localhost]');
	sanitized = sanitized.replace(/\b127\.0\.0\.1(?::\d+)?\b/g, '[localhost]');

	// === SAP-Specific Masking ===

	// Mask SAP system IDs (3-character alphanumeric, often in context like "system DEV" or "SID=PRD")
	sanitized = sanitized.replace(/\b(?:SID|system)[=:\s]+[A-Z][A-Z0-9]{2}\b/gi, (match) => {
		return match.replace(/[A-Z][A-Z0-9]{2}$/, '[SID]');
	});

	// Mask SAP client numbers (typically 3 digits, often 000, 100, 800, etc.)
	sanitized = sanitized.replace(/\bclient[=:\s]+\d{3}\b/gi, 'client=[client]');

	// Mask SAP mandant (German term for client)
	sanitized = sanitized.replace(/\bmandant[=:\s]+\d{3}\b/gi, 'mandant=[client]');

	// Mask SAP user IDs (often in format SAP* or uppercase usernames)
	sanitized = sanitized.replace(/\buser[=:\s]+SAP\w*/gi, 'user=[user]');

	// === Stack Trace Reduction ===

	// Remove stack traces (lines starting with "at " followed by function/file info)
	sanitized = sanitized.replace(/\n\s*at\s+.+/g, '');

	// Remove "Error:" prefix duplications from nested errors
	sanitized = sanitized.replace(/Error:\s*Error:/g, 'Error:');

	// Truncate very long error messages that might contain dumps
	const maxLength = 500;
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
	}

	return sanitized;
}

/**
 * Validate JSON input to prevent injection
 */
export function validateJsonInput(jsonString: string, fieldName: string, node: INode): object {
	try {
		// Check for excessively large input
		if (jsonString.length > MAX_JSON_SIZE) {
			throw new Error(`JSON input exceeds maximum size of ${MAX_JSON_SIZE / 1024 / 1024}MB`);
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
			if (depth > MAX_NESTING_DEPTH) {
				throw new Error(`JSON object is too deeply nested (max ${MAX_NESTING_DEPTH} levels)`);
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
 * Check if private IP access is allowed via environment variable
 * Set ALLOW_PRIVATE_IPS=true to allow access to internal networks (e.g., for on-premise SAP systems)
 */
function isPrivateIpAccessAllowed(): boolean {
	const envValue = process.env.ALLOW_PRIVATE_IPS;
	return envValue === 'true' || envValue === '1';
}

/**
 * Validate URL to prevent SSRF attacks
 * Note: Set environment variable ALLOW_PRIVATE_IPS=true to allow access to private IP ranges
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

		// Skip private IP checks if explicitly allowed (for on-premise SAP systems)
		const allowPrivateIps = isPrivateIpAccessAllowed();

		// Prevent access to private IP ranges (SSRF protection)
		const hostname = parsedUrl.hostname.toLowerCase();

		// Convert hostname to IP if it's a numeric format to detect obfuscated IPs
		// This handles decimal (2130706433), octal (0177.0.0.1), hex (0x7f.0x0.0x0.0x1) formats
		const isNumericIp = /^[\d.x]+$/.test(hostname);
		let normalizedHostname = hostname;

		if (isNumericIp) {
			// Try to parse as IP address in various formats
			const parts = hostname.split('.');
			if (parts.length <= 4) {
				try {
					const ipParts = parts.map(part => {
						// Handle hex (0x prefix)
						if (part.startsWith('0x')) {
							return parseInt(part, 16);
						}
						// Handle octal (leading 0)
						if (part.startsWith('0') && part.length > 1) {
							return parseInt(part, 8);
						}
						// Handle decimal
						return parseInt(part, 10);
					});

					// Validate all parts are valid numbers
					if (ipParts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
						normalizedHostname = ipParts.join('.');
					}
				} catch {
					// If parsing fails, keep original hostname
				}
			}
		}

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

		// Block private IP ranges (unless explicitly allowed for on-premise systems)
		if (!allowPrivateIps) {
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
						description: 'Cannot connect to private network resources for security reasons. Set environment variable ALLOW_PRIVATE_IPS=true to allow access to internal networks.',
					},
				);
			}
		}

		// Block suspicious hostnames that might be DNS rebinding attempts
		// e.g., 127.0.0.1.attacker.com, localhost.attacker.com
		if (!allowPrivateIps) {
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
