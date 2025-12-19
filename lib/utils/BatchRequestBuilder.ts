/**
 * BatchRequestBuilder - SAP OData $batch endpoint support
 *
 * Ermöglicht das Senden mehrerer Operationen in einem HTTP Request
 * SAP OData V2 $batch Format (Multipart/Mixed)
 *
 * Benefits:
 * - Reduziert Netzwerk-Overhead
 * - Transaktionale Verarbeitung möglich
 * - Bessere Performance bei Bulk-Operationen
 */

import { IDataObject } from 'n8n-workflow';
import { randomUUID } from 'crypto';
import { Logger } from './Logger';

/**
 * Batch Operation Types
 */
export enum BatchOperationType {
	CREATE = 'POST',
	UPDATE = 'PATCH',
	DELETE = 'DELETE',
	GET = 'GET',
}

/**
 * Single Batch Operation
 */
export interface IBatchOperation {
	type: BatchOperationType;
	entitySet: string;
	entityKey?: string;
	data?: IDataObject;
	queryParams?: IDataObject;
	headers?: Record<string, string>;
}

/**
 * Batch Request Configuration
 */
export interface IBatchRequestConfig {
	operations: IBatchOperation[];
	servicePath: string;
	useChangeSet?: boolean; // Transaktional (Alles oder Nichts)
}

/**
 * Batch Response Parser
 */
export interface IBatchResponse {
	success: boolean;
	results: Array<{
		operation: IBatchOperation;
		success: boolean;
		statusCode: number;
		data?: unknown;
		error?: string;
	}>;
}

/**
 * Build SAP OData $batch request
 */
export class BatchRequestBuilder {
	private static readonly BATCH_BOUNDARY_PREFIX = 'batch_';
	private static readonly CHANGESET_BOUNDARY_PREFIX = 'changeset_';

	/**
	 * Build multipart/mixed batch request body
	 */
	static buildBatchRequest(config: IBatchRequestConfig): {
		body: string;
		contentType: string;
		boundary: string;
	} {
		const batchBoundary = `${this.BATCH_BOUNDARY_PREFIX}${randomUUID()}`;
		const parts: string[] = [];

		if (config.useChangeSet) {
			// Alle Operationen in einem ChangeSet (transaktional)
			const changeSetPart = this.buildChangeSet(config.operations);
			parts.push(changeSetPart);
		} else {
			// Einzelne Operationen (unabhängig)
			config.operations.forEach((operation) => {
				const part = this.buildOperationPart(operation, config.servicePath);
				parts.push(part);
			});
		}

		// Combine all parts
		const body = parts.map(part => `--${batchBoundary}\n${part}`).join('\n') +
			`\n--${batchBoundary}--`;

		return {
			body,
			contentType: `multipart/mixed; boundary=${batchBoundary}`,
			boundary: batchBoundary,
		};
	}

	/**
	 * Build a ChangeSet (transactional operations)
	 */
	private static buildChangeSet(operations: IBatchOperation[]): string {
		const changeSetBoundary = `${this.CHANGESET_BOUNDARY_PREFIX}${randomUUID()}`;
		const parts: string[] = [];

		// Header
		parts.push('Content-Type: multipart/mixed; boundary=' + changeSetBoundary);
		parts.push('');

		// Operations
		operations.forEach((operation) => {
			const operationContent = this.buildOperationContent(operation, '');
			parts.push(`--${changeSetBoundary}`);
			parts.push('Content-Type: application/http');
			parts.push('Content-Transfer-Encoding: binary');
			parts.push('');
			parts.push(operationContent);
		});

		parts.push(`--${changeSetBoundary}--`);

		return parts.join('\n');
	}

	/**
	 * Build single operation part
	 */
	private static buildOperationPart(
		operation: IBatchOperation,
		servicePath: string
	): string {
		const parts: string[] = [];

		parts.push('Content-Type: application/http');
		parts.push('Content-Transfer-Encoding: binary');
		parts.push('');
		parts.push(this.buildOperationContent(operation, servicePath));

		return parts.join('\n');
	}

	/**
	 * Build HTTP request content for single operation
	 */
	private static buildOperationContent(
		operation: IBatchOperation,
		servicePath: string
	): string {
		const lines: string[] = [];

		// Request Line
		const url = this.buildOperationUrl(operation, servicePath);
		lines.push(`${operation.type} ${url} HTTP/1.1`);

		// Headers
		const headers = {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			...operation.headers,
		};

		Object.entries(headers).forEach(([key, value]) => {
			lines.push(`${key}: ${value}`);
		});

		// Body (für POST/PATCH)
		if (operation.data && (operation.type === 'POST' || operation.type === 'PATCH')) {
			lines.push('');
			lines.push(JSON.stringify(operation.data));
		}

		return lines.join('\n');
	}

	/**
	 * Build URL for operation
	 */
	private static buildOperationUrl(
		operation: IBatchOperation,
		servicePath: string
	): string {
		let url = `${servicePath}/${operation.entitySet}`;

		// Add entity key for single-entity operations
		if (operation.entityKey && (operation.type === 'PATCH' || operation.type === 'DELETE' || operation.type === 'GET')) {
			url += `(${operation.entityKey})`;
		}

		// Add query parameters
		if (operation.queryParams && Object.keys(operation.queryParams).length > 0) {
			const params = new URLSearchParams(
				Object.entries(operation.queryParams).map(([k, v]) => [k, String(v)] as [string, string])
			);
			url += `?${params.toString()}`;
		}

		return url;
	}

	/**
	 * Parse batch response
	 */
	static parseBatchResponse(
		responseText: string,
		boundary: string
	): IBatchResponse {
		const results: IBatchResponse['results'] = [];

		// Split by boundary
		const parts = responseText.split(`--${boundary}`);

		parts.forEach((part) => {
			if (!part.trim() || part.trim() === '--') {
				return;
			}

			try {
				const result = this.parseResponsePart(part);
				if (result) {
					results.push(result);
				}
			} catch (error) {
				Logger.error('Failed to parse batch response part', error instanceof Error ? error : undefined, { module: 'BatchRequestBuilder' });
			}
		});

		const allSuccess = results.every(r => r.success);

		return {
			success: allSuccess,
			results,
		};
	}

	/**
	 * Parse single response part
	 */
	private static parseResponsePart(part: string): IBatchResponse['results'][0] | null {
		const lines = part.split('\n');

		// Find HTTP status line
		const statusLine = lines.find(line => line.startsWith('HTTP/'));
		if (!statusLine) {
			return null;
		}

		// Extract status code
		const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+)/);
		if (!statusMatch) {
			return null;
		}

		const statusCode = parseInt(statusMatch[1], 10);
		const success = statusCode >= 200 && statusCode < 300;

		// Find JSON body
		const emptyLineIndex = lines.findIndex(line => line.trim() === '');
		const bodyLines = lines.slice(emptyLineIndex + 1);
		const bodyText = bodyLines.join('\n').trim();

		let data: unknown = undefined;
		let error: string | undefined = undefined;

		if (bodyText) {
			try {
				const parsed = JSON.parse(bodyText);
				if (success) {
					data = parsed;
				} else {
					error = parsed.error?.message?.value || parsed.error?.message || 'Unknown error';
				}
			} catch {
				if (!success) {
					error = bodyText;
				}
			}
		}

		return {
			operation: {} as IBatchOperation, // Will be enriched by caller
			success,
			statusCode,
			data,
			error,
		};
	}

	/**
	 * Split operations into batches of specific size
	 */
	static splitIntoBatches(
		operations: IBatchOperation[],
		batchSize = 100
	): IBatchOperation[][] {
		const batches: IBatchOperation[][] = [];

		for (let i = 0; i < operations.length; i += batchSize) {
			batches.push(operations.slice(i, i + batchSize));
		}

		return batches;
	}

	/**
	 * Validate batch operations
	 */
	static validateOperations(operations: IBatchOperation[]): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		operations.forEach((op, index) => {
			// Check required fields
			if (!op.type) {
				errors.push(`Operation ${index}: Missing type`);
			}
			if (!op.entitySet) {
				errors.push(`Operation ${index}: Missing entitySet`);
			}

			// Check data for CREATE/UPDATE
			if ((op.type === 'POST' || op.type === 'PATCH') && !op.data) {
				errors.push(`Operation ${index}: Missing data for ${op.type}`);
			}

			// Check entity key for UPDATE/DELETE
			if ((op.type === 'PATCH' || op.type === 'DELETE') && !op.entityKey) {
				errors.push(`Operation ${index}: Missing entityKey for ${op.type}`);
			}

			// Validate entity set name
			if (op.entitySet && !/^[a-zA-Z0-9_]+$/.test(op.entitySet)) {
				errors.push(`Operation ${index}: Invalid entitySet name`);
			}
		});

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}