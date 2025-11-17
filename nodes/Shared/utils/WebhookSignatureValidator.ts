/**
 * Webhook Signature Validator
 *
 * Provides HMAC-based signature validation for incoming webhooks to prevent:
 * - Webhook spoofing (fake requests)
 * - Unauthorized webhook calls
 * - Man-in-the-middle attacks
 *
 * Supports multiple signature algorithms and header formats compatible with:
 * - SAP Event Mesh
 * - Generic webhook providers
 * - Custom webhook implementations
 *
 * @module WebhookSignatureValidator
 */

import * as crypto from 'crypto';
import { Logger } from './Logger';

/**
 * Signature algorithm types
 *
 * @enum {string}
 * @readonly
 */
export enum SignatureAlgorithm {
	/** HMAC with SHA-256 (recommended) */
	HMAC_SHA256 = 'sha256',
	/** HMAC with SHA-512 (high security) */
	HMAC_SHA512 = 'sha512',
	/** HMAC with SHA-1 (legacy, not recommended) */
	HMAC_SHA1 = 'sha1',
}

/**
 * Signature format types
 *
 * Different webhook providers use different signature formats.
 *
 * @enum {string}
 * @readonly
 */
export enum SignatureFormat {
	/** hex-encoded (e.g., "a1b2c3...") */
	Hex = 'hex',
	/** base64-encoded (e.g., "YWJjMTIz...") */
	Base64 = 'base64',
	/** Prefixed hex (e.g., "sha256=a1b2c3...") - GitHub style */
	PrefixedHex = 'prefixed_hex',
	/** Prefixed base64 (e.g., "sha256=YWJjMTIz...") */
	PrefixedBase64 = 'prefixed_base64',
}

/**
 * Validation options
 *
 * @interface IValidationOptions
 * @property {SignatureAlgorithm} algorithm - HMAC algorithm to use
 * @property {SignatureFormat} format - Signature format
 * @property {string} headerName - HTTP header name containing signature
 * @property {number} [toleranceMs] - Time tolerance for timestamp validation (ms)
 * @property {boolean} [validateTimestamp] - Whether to validate timestamp
 * @property {string} [timestampHeaderName] - HTTP header name for timestamp
 */
export interface IValidationOptions {
	algorithm: SignatureAlgorithm;
	format: SignatureFormat;
	headerName: string;
	toleranceMs?: number;
	validateTimestamp?: boolean;
	timestampHeaderName?: string;
}

/**
 * Validation result
 *
 * @interface IValidationResult
 * @property {boolean} isValid - Whether signature is valid
 * @property {string} [error] - Error message if validation failed
 * @property {boolean} [timestampValid] - Whether timestamp is valid (if checked)
 * @property {number} [timestampAge] - Age of timestamp in milliseconds (if checked)
 */
export interface IValidationResult {
	isValid: boolean;
	error?: string;
	timestampValid?: boolean;
	timestampAge?: number;
}

/**
 * Webhook Signature Validator
 *
 * Validates webhook signatures using HMAC to ensure authenticity.
 *
 * @class WebhookSignatureValidator
 *
 *
 */
export class WebhookSignatureValidator {
	private secret: string;

	/**
	 * Creates an instance of WebhookSignatureValidator
	 *
	 * @param {string} secret - Shared secret key for HMAC
	 *
	 */
	constructor(secret: string) {
		if (!secret || secret.length === 0) {
			throw new Error('Webhook secret cannot be empty');
		}

		if (secret.length < 32) {
			Logger.warn('Webhook secret is shorter than 32 characters - consider using a longer secret', {
				module: 'WebhookSignatureValidator',
				length: secret.length,
			});
		}

		this.secret = secret;
	}

	/**
	 * Validate webhook signature
	 *
	 * Computes HMAC signature of the payload and compares with received signature.
	 * Optionally validates timestamp to prevent replay attacks.
	 *
	 * @param {string | Buffer} payload - Request payload (raw body)
	 * @param {string} receivedSignature - Signature from webhook header
	 * @param {IValidationOptions} options - Validation options
	 * @param {Record<string, string>} [headers] - Request headers (for timestamp validation)
	 * @returns {IValidationResult} Validation result
	 *
	 */
	validate(
		payload: string | Buffer,
		receivedSignature: string,
		options: IValidationOptions,
		headers?: Record<string, string>,
	): IValidationResult {
		const { algorithm, format, validateTimestamp = false, timestampHeaderName, toleranceMs = 300000 } = options;

		Logger.debug('Validating webhook signature', {
			module: 'WebhookSignatureValidator',
			algorithm,
			format,
			validateTimestamp,
		});

		// Validate timestamp if requested
		if (validateTimestamp) {
			if (!headers || !timestampHeaderName) {
				return {
					isValid: false,
					error: 'Timestamp validation requested but headers or timestampHeaderName not provided',
				};
			}

			const timestamp = headers[timestampHeaderName.toLowerCase()];
			if (!timestamp) {
				return {
					isValid: false,
					error: `Timestamp header '${timestampHeaderName}' not found`,
				};
			}

			const timestampValidation = this.validateTimestamp(timestamp, toleranceMs);
			if (!timestampValidation.isValid) {
				return {
					isValid: false,
					error: timestampValidation.error,
					timestampValid: false,
					timestampAge: timestampValidation.age,
				};
			}
		}

		// Generate expected signature
		const expectedSignature = this.generateSignature(payload, algorithm, format);

		// Compare signatures (constant-time comparison to prevent timing attacks)
		const isValid = this.constantTimeCompare(receivedSignature, expectedSignature);

		if (!isValid) {
			Logger.warn('Webhook signature validation failed', {
				module: 'WebhookSignatureValidator',
				algorithm,
				format,
			});

			return {
				isValid: false,
				error: 'Signature mismatch',
			};
		}

		Logger.info('Webhook signature validated successfully', {
			module: 'WebhookSignatureValidator',
			algorithm,
		});

		return {
			isValid: true,
			timestampValid: validateTimestamp ? true : undefined,
		};
	}

	/**
	 * Generate signature for payload
	 *
	 * Creates HMAC signature that can be compared with received signature
	 * or sent with outgoing webhooks.
	 *
	 * @param {string | Buffer} payload - Data to sign
	 * @param {SignatureAlgorithm} algorithm - HMAC algorithm
	 * @param {SignatureFormat} format - Output format
	 * @returns {string} Generated signature
	 *
	 */
	generateSignature(
		payload: string | Buffer,
		algorithm: SignatureAlgorithm,
		format: SignatureFormat,
	): string {
		// Ensure payload is Buffer
		const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');

		// Create HMAC
		const hmac = crypto.createHmac(algorithm, this.secret);
		hmac.update(payloadBuffer);

		// Generate signature based on format
		switch (format) {
			case SignatureFormat.Hex:
				return hmac.digest('hex');

			case SignatureFormat.Base64:
				return hmac.digest('base64');

			case SignatureFormat.PrefixedHex:
				return `${algorithm}=${hmac.digest('hex')}`;

			case SignatureFormat.PrefixedBase64:
				return `${algorithm}=${hmac.digest('base64')}`;

			default:
				throw new Error(`Unsupported signature format: ${format}`);
		}
	}

	/**
	 * Validate timestamp from webhook
	 *
	 * Checks if timestamp is within acceptable tolerance to prevent replay attacks.
	 *
	 * @param {string} timestamp - Timestamp from webhook header (ISO string or Unix timestamp)
	 * @param {number} toleranceMs - Maximum age in milliseconds
	 * @returns {{ isValid: boolean; error?: string; age?: number }} Validation result
	 *
	 */
	validateTimestamp(
		timestamp: string,
		toleranceMs: number,
	): { isValid: boolean; error?: string; age?: number } {
		let timestampMs: number;

		// Parse timestamp (support both ISO string and Unix timestamp)
		if (timestamp.includes('T') || timestamp.includes('-')) {
			// ISO 8601 format
			const date = new Date(timestamp);
			if (isNaN(date.getTime())) {
				return {
					isValid: false,
					error: 'Invalid timestamp format',
				};
			}
			timestampMs = date.getTime();
		} else {
			// Unix timestamp (seconds or milliseconds)
			const ts = parseInt(timestamp, 10);
			if (isNaN(ts)) {
				return {
					isValid: false,
					error: 'Invalid timestamp format',
				};
			}

			// Detect if timestamp is in seconds or milliseconds
			timestampMs = ts < 10000000000 ? ts * 1000 : ts;
		}

		// Calculate age
		const now = Date.now();
		const age = now - timestampMs;

		// Check if too old
		if (age > toleranceMs) {
			Logger.warn('Webhook timestamp too old', {
				module: 'WebhookSignatureValidator',
				age: `${Math.floor(age / 1000)}s`,
				tolerance: `${Math.floor(toleranceMs / 1000)}s`,
			});

			return {
				isValid: false,
				error: `Timestamp too old: ${Math.floor(age / 1000)}s (max ${Math.floor(toleranceMs / 1000)}s)`,
				age,
			};
		}

		// Check if too far in the future (allow 60 seconds clock skew)
		if (age < -60000) {
			Logger.warn('Webhook timestamp in the future', {
				module: 'WebhookSignatureValidator',
				age: `${Math.floor(age / 1000)}s`,
			});

			return {
				isValid: false,
				error: 'Timestamp is in the future',
				age,
			};
		}

		return {
			isValid: true,
			age,
		};
	}

	/**
	 * Constant-time string comparison
	 *
	 * Prevents timing attacks by comparing strings in constant time.
	 *
	 * @private
	 * @param {string} a - First string
	 * @param {string} b - Second string
	 * @returns {boolean} True if strings match
	 */
	private constantTimeCompare(a: string, b: string): boolean {
		// Use crypto.timingSafeEqual if available (Node.js 6.6.0+)
		if (crypto.timingSafeEqual) {
			try {
				const bufferA = Buffer.from(a, 'utf8');
				const bufferB = Buffer.from(b, 'utf8');

				// Buffers must be same length for timingSafeEqual
				if (bufferA.length !== bufferB.length) {
					return false;
				}

				return crypto.timingSafeEqual(bufferA, bufferB);
			} catch (error) {
				// Fallback to manual comparison
				Logger.warn('crypto.timingSafeEqual failed, using fallback', {
					module: 'WebhookSignatureValidator',
				});
			}
		}

		// Fallback: Manual constant-time comparison
		if (a.length !== b.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}

		return result === 0;
	}

	/**
	 * Verify webhook with multiple signature algorithms
	 *
	 * Tries multiple algorithms to find a match (useful for migration scenarios).
	 *
	 * @param {string | Buffer} payload - Request payload
	 * @param {string} receivedSignature - Signature from webhook
	 * @param {SignatureAlgorithm[]} algorithms - Algorithms to try
	 * @param {SignatureFormat} format - Signature format
	 * @returns {{ isValid: boolean; algorithm?: SignatureAlgorithm; error?: string }} Result
	 *
	 */
	verifyWithMultipleAlgorithms(
		payload: string | Buffer,
		receivedSignature: string,
		algorithms: SignatureAlgorithm[],
		format: SignatureFormat,
	): { isValid: boolean; algorithm?: SignatureAlgorithm; error?: string } {
		for (const algorithm of algorithms) {
			const expectedSignature = this.generateSignature(payload, algorithm, format);

			if (this.constantTimeCompare(receivedSignature, expectedSignature)) {
				Logger.info('Webhook verified with algorithm', {
					module: 'WebhookSignatureValidator',
					algorithm,
				});

				return {
					isValid: true,
					algorithm,
				};
			}
		}

		return {
			isValid: false,
			error: 'No matching signature found with any algorithm',
		};
	}

	/**
	 * Extract signature from prefixed format
	 *
	 * Parses signatures like "sha256=abc123..." to extract algorithm and signature.
	 *
	 * @param {string} prefixedSignature - Signature with algorithm prefix
	 * @returns {{ algorithm: string; signature: string } | null} Parsed components or null
	 *
	 */
	static parsePrefixedSignature(
		prefixedSignature: string,
	): { algorithm: string; signature: string } | null {
		const match = prefixedSignature.match(/^([a-z0-9]+)=(.+)$/);
		if (!match) {
			return null;
		}

		return {
			algorithm: match[1],
			signature: match[2],
		};
	}

	/**
	 * Generate webhook timestamp
	 *
	 * Creates timestamp in standard format for webhook headers.
	 *
	 * @param {Date} [date] - Date to use (default: now)
	 * @returns {string} ISO 8601 timestamp
	 *
	 */
	static generateTimestamp(date?: Date): string {
		return (date || new Date()).toISOString();
	}

	/**
	 * Generate Unix timestamp
	 *
	 * Creates Unix timestamp (seconds since epoch) for webhook headers.
	 *
	 * @param {Date} [date] - Date to use (default: now)
	 * @returns {number} Unix timestamp in seconds
	 *
	 */
	static generateUnixTimestamp(date?: Date): number {
		return Math.floor(((date || new Date()).getTime()) / 1000);
	}
}
