/**
 * SAP Message Parser
 *
 * Parses and handles SAP-specific message formats from Gateway responses.
 * SAP Gateway returns detailed messages in two formats:
 * 1. sap-message HTTP header (URL-encoded JSON)
 * 2. Error response body (OData V2/V4 error structure)
 *
 * This utility extracts, parses, and formats these messages for user-friendly display.
 *
 * @module SapMessageParser
 */

import { IDataObject } from 'n8n-workflow';
import { Logger } from './Logger';

/**
 * SAP Message Severity Levels
 *
 * Defines the severity classification used by SAP Gateway.
 * Maps to SAP's ABAP message types (S, I, W, E, A/X).
 *
 * @enum {string}
 * @readonly
 *
 */
export enum SapMessageSeverity {
	/** Operation completed successfully (SAP type: S) */
	Success = 'success',
	/** Informational message (SAP type: I) */
	Information = 'info',
	/** Warning - operation continued (SAP type: W) */
	Warning = 'warning',
	/** Error - operation failed (SAP type: E) */
	Error = 'error',
	/** Abort - critical error, transaction aborted (SAP type: A/X) */
	Abort = 'abort',
}

/**
 * SAP Message Structure
 *
 * Represents a single message from SAP Gateway.
 * Contains the message code, text, severity, and optional additional information.
 *
 * @interface ISapMessage
 * @property {string} code - SAP message code (e.g., "/IWBEP/CM_MGW_RT/021")
 * @property {string} message - Human-readable message text
 * @property {SapMessageSeverity} severity - Message severity level
 * @property {string} [target] - Target field/property that caused the message
 * @property {string} [details] - Additional message details
 * @property {string} [longText] - Extended message text (URL to fetch)
 * @property {IDataObject} [technicalDetails] - Technical error details (innererror)
 *
 */
export interface ISapMessage {
	code: string;
	message: string;
	severity: SapMessageSeverity;
	target?: string;
	details?: string;
	longText?: string;
	technicalDetails?: IDataObject;
}

/**
 * SAP Gateway Message from sap-message header
 */
interface ISapGatewayMessage {
	code: string;
	message: string;
	severity?: string;
	target?: string;
	details?: ISapGatewayMessageDetail[];
	longtextUrl?: string;
}

/**
 * SAP Message Detail
 */
interface ISapGatewayMessageDetail {
	code: string;
	message: string;
	severity?: string;
	target?: string;
}

/**
 * SAP Message Parser
 *
 * Utility class for parsing and formatting SAP Gateway messages.
 * Provides methods to extract messages from HTTP headers and response bodies,
 * categorize them by severity, and format them for user-friendly display.
 *
 * @class SapMessageParser
 *
 */
export class SapMessageParser {
	/**
	 * Parse sap-message HTTP header
	 *
	 * SAP Gateway returns messages in URL-encoded JSON format in the sap-message header.
	 * This method decodes and parses the header to extract all messages including details.
	 *
	 * Header format:
	 * ```
	 * sap-message: %7B%22code%22%3A%22...%22%2C%22message%22%3A%22...%22%7D
	 * ```
	 *
	 * Decoded JSON structure:
	 * ```json
	 * {
	 *   "code": "/IWBEP/CM_MGW_RT/021",
	 *   "message": "Invalid entity key",
	 *   "severity": "error",
	 *   "target": "ProductID",
	 *   "details": [
	 *     { "code": "...", "message": "...", "severity": "error" }
	 *   ]
	 * }
	 * ```
	 *
	 * @static
	 * @param {string} headerValue - URL-encoded JSON string from sap-message header
	 * @returns {ISapMessage[]} Array of parsed messages (main message + details)
	 *
	 */
	static parseSapMessageHeader(headerValue: string): ISapMessage[] {
		try {
			// SAP-message header contains URL-encoded JSON
			const decodedValue = decodeURIComponent(headerValue);
			const messageData = JSON.parse(decodedValue) as ISapGatewayMessage;

			const messages: ISapMessage[] = [];

			// Parse main message
			if (messageData.message) {
				messages.push({
					code: messageData.code || '',
					message: messageData.message,
					severity: this.mapSeverity(messageData.severity),
					target: messageData.target,
				});
			}

			// Parse detail messages
			if (messageData.details && Array.isArray(messageData.details)) {
				messageData.details.forEach((detail) => {
					messages.push({
						code: detail.code || '',
						message: detail.message,
						severity: this.mapSeverity(detail.severity),
						target: detail.target,
					});
				});
			}

			Logger.debug('Parsed SAP messages from header', {
				module: 'SapMessageParser',
				messageCount: messages.length,
				mainMessage: messages[0]?.message,
			});

			return messages;
		} catch (error) {
			Logger.warn('Failed to parse sap-message header', {
				module: 'SapMessageParser',
				error: error instanceof Error ? error.message : String(error),
				headerValue: headerValue.substring(0, 100), // Log first 100 chars
			});
			return [];
		}
	}

	/**
	 * Parse SAP error response body
	 * SAP Gateway returns detailed error information in response body
	 */
	static parseSapErrorResponse(responseBody: unknown): ISapMessage[] {
		try {
			if (!responseBody || typeof responseBody !== 'object') {
				return [];
			}

			const messages: ISapMessage[] = [];
			const body = responseBody as IDataObject;

			// OData V2 error format: { error: { code, message, innererror } }
			if (body.error && typeof body.error === 'object') {
				const error = body.error as IDataObject;

				const errorMessage = typeof error.message === 'object' && error.message !== null && 'value' in error.message
					? (error.message as IDataObject).value
					: error.message;

				messages.push({
					code: String(error.code || ''),
					message: String(errorMessage || ''),
					severity: SapMessageSeverity.Error,
					technicalDetails: error.innererror as IDataObject | undefined,
				});

				// Extract additional messages from innererror
				if (error.innererror && typeof error.innererror === 'object') {
					const innerError = error.innererror as IDataObject;

					// SAP Gateway often includes detailed error messages in innererror
					if (innerError.errordetails && Array.isArray(innerError.errordetails)) {
						innerError.errordetails.forEach((detail: unknown) => {
							if (detail && typeof detail === 'object') {
								const detailObj = detail as IDataObject;
								messages.push({
									code: String(detailObj.code || ''),
									message: String(detailObj.message || ''),
									severity: this.mapSeverity(String(detailObj.severity || 'error')),
									target: String(detailObj.target || ''),
								});
							}
						});
					}
				}
			}

			// OData V4 error format: { error: { code, message, details: [] } }
			if (body.error && typeof body.error === 'object') {
				const error = body.error as IDataObject;

				if (error.details && Array.isArray(error.details)) {
					error.details.forEach((detail: unknown) => {
						if (detail && typeof detail === 'object') {
							const detailObj = detail as IDataObject;
							messages.push({
								code: String(detailObj.code || ''),
								message: String(detailObj.message || ''),
								severity: this.mapSeverity(String(detailObj.severity || 'error')),
								target: String(detailObj.target || ''),
							});
						}
					});
				}
			}

			Logger.debug('Parsed SAP error response', {
				module: 'SapMessageParser',
				messageCount: messages.length,
			});

			return messages;
		} catch (error) {
			Logger.warn('Failed to parse SAP error response', {
				module: 'SapMessageParser',
				error: error instanceof Error ? error.message : String(error),
			});
			return [];
		}
	}

	/**
	 * Map SAP severity code to severity enum
	 */
	private static mapSeverity(severity?: string): SapMessageSeverity {
		if (!severity) {
			return SapMessageSeverity.Information;
		}

		const severityLower = severity.toLowerCase();

		switch (severityLower) {
			case 'success':
			case 's':
				return SapMessageSeverity.Success;
			case 'info':
			case 'information':
			case 'i':
				return SapMessageSeverity.Information;
			case 'warning':
			case 'w':
				return SapMessageSeverity.Warning;
			case 'error':
			case 'e':
				return SapMessageSeverity.Error;
			case 'abort':
			case 'a':
			case 'x':
				return SapMessageSeverity.Abort;
			default:
				return SapMessageSeverity.Information;
		}
	}

	/**
	 * Extract SAP message code prefix (e.g., "/IWBEP/CM_MGW" from "/IWBEP/CM_MGW_RT/021")
	 */
	static extractMessageClass(code: string): string {
		if (!code) {
			return '';
		}

		// SAP message codes typically follow pattern: /NAMESPACE/MESSAGE_CLASS/NUMBER
		const match = code.match(/^(\/[^/]+\/[^/]+)/);
		return match ? match[1] : code;
	}

	/**
	 * Check if message is a business error (vs technical error)
	 */
	static isBusinessError(message: ISapMessage): boolean {
		// Business errors typically have specific message classes
		const businessErrorPatterns = [
			'/IWBEP/CX_MGW_BUSI_EXCEPTION',
			'/IWBEP/CM_MGW_APP',
			'/IWBEP/CM_MGW_BUSI',
		];

		const messageClass = this.extractMessageClass(message.code);
		return businessErrorPatterns.some((pattern) => messageClass.includes(pattern));
	}

	/**
	 * Check if message is a technical error
	 */
	static isTechnicalError(message: ISapMessage): boolean {
		// Technical errors typically have specific message classes
		const technicalErrorPatterns = [
			'/IWBEP/CX_MGW_TECH_EXCEPTION',
			'/IWBEP/CM_MGW_RT',
			'/IWFND/',
		];

		const messageClass = this.extractMessageClass(message.code);
		return technicalErrorPatterns.some((pattern) => messageClass.includes(pattern));
	}

	/**
	 * Format messages for user-friendly display
	 */
	static formatMessages(messages: ISapMessage[]): string {
		if (messages.length === 0) {
			return '';
		}

		const formattedMessages = messages.map((msg, index) => {
			const prefix = messages.length > 1 ? `[${index + 1}] ` : '';
			const severityIcon = this.getSeverityIcon(msg.severity);
			const codeText = msg.code ? ` (${msg.code})` : '';
			const targetText = msg.target ? ` - Target: ${msg.target}` : '';

			return `${prefix}${severityIcon} ${msg.message}${codeText}${targetText}`;
		});

		return formattedMessages.join('\n');
	}

	/**
	 * Get severity icon for display
	 */
	private static getSeverityIcon(severity: SapMessageSeverity): string {
		switch (severity) {
			case SapMessageSeverity.Success:
				return '✓';
			case SapMessageSeverity.Information:
				return 'ℹ';
			case SapMessageSeverity.Warning:
				return '⚠';
			case SapMessageSeverity.Error:
				return '✗';
			case SapMessageSeverity.Abort:
				return '⊗';
			default:
				return '•';
		}
	}

	/**
	 * Extract all messages from response headers and body
	 */
	static extractAllMessages(
		headers: IDataObject | undefined,
		body: unknown,
	): ISapMessage[] {
		const messages: ISapMessage[] = [];

		// Parse sap-message header
		if (headers && headers['sap-message']) {
			const headerMessages = this.parseSapMessageHeader(String(headers['sap-message']));
			messages.push(...headerMessages);
		}

		// Parse error response body
		if (body) {
			const bodyMessages = this.parseSapErrorResponse(body);
			messages.push(...bodyMessages);
		}

		return messages;
	}

	/**
	 * Get user-friendly error description based on SAP message code
	 */
	static getErrorDescription(message: ISapMessage): string {
		const code = message.code;

		// Common SAP Gateway error codes
		const errorDescriptions: Record<string, string> = {
			'/IWBEP/CM_MGW_RT/021': 'The entity key is invalid or malformed',
			'/IWBEP/CM_MGW_RT/022': 'The requested entity was not found',
			'/IWBEP/CM_MGW_RT/023': 'The entity set does not exist in the service',
			'/IWBEP/CM_MGW_RT/024': 'The property does not exist in the entity type',
			'/IWBEP/CM_MGW_RT/025': 'Invalid filter expression syntax',
			'/IWBEP/CM_MGW_RT/026': 'Invalid $orderby parameter',
			'/IWBEP/CM_MGW_RT/027': 'Invalid $expand parameter',
			'/IWBEP/CM_MGW_RT/028': 'Invalid $select parameter',
			'/IWBEP/CM_MGW_RT/029': 'Invalid function import parameters',
			'/IWBEP/CM_MGW_RT/030': 'Batch request processing failed',
			'/IWBEP/CM_MGW_RT/031': 'CSRF token validation failed',
			'/IWBEP/CM_MGW_RT/042': 'The content type is not supported',
			'/IWBEP/CM_MGW_RT/043': 'The HTTP method is not allowed for this resource',
			'/IWFND/CM_MGW/005': 'Authorization failed - check user permissions',
			'/IWFND/CM_MGW/006': 'Service not found or not activated',
			'/IWFND/CM_MGW/007': 'Backend system connection failed',
		};

		// Check for exact match
		if (errorDescriptions[code]) {
			return errorDescriptions[code];
		}

		// Check for pattern match
		for (const [pattern, description] of Object.entries(errorDescriptions)) {
			if (code.startsWith(pattern)) {
				return description;
			}
		}

		// Generic description based on message class
		if (this.isBusinessError(message)) {
			return 'Business logic error - check the operation and data';
		}

		if (this.isTechnicalError(message)) {
			return 'Technical error in SAP Gateway - check system configuration';
		}

		return 'SAP Gateway error - see message for details';
	}
}
