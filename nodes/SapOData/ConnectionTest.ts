import {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	INodeCredentialTestResult,
} from 'n8n-workflow';
import { CONNECTION_TEST_TIMEOUT } from '../../lib/constants';
import { parseMetadataForEntitySets } from './GenericFunctions';

/**
 * Connection Test Result
 */
export interface IConnectionTestResult {
	status: 'OK' | 'Error';
	message: string;
	details?: {
		catalogServiceAvailable: boolean;
		metadataAccessible: boolean;
		entitySetCount?: number;
		entitySets?: string[];
		responseTime: number;
		sapClient?: string;
		sapLanguage?: string;
	};
}

/**
 * Test SAP OData connection with comprehensive checks
 *
 * This function performs multiple checks:
 * 1. Catalog Service availability (service discovery)
 * 2. Metadata endpoint accessibility
 * 3. Entity set parsing
 * 4. Overall response time measurement
 *
 * @param this - n8n credential test context
 * @param credential - Decrypted credential data
 * @returns Detailed test result with status and diagnostics
 */
export async function testSapODataConnection(
	this: ICredentialTestFunctions,
	credential: ICredentialDataDecryptedObject,
): Promise<INodeCredentialTestResult> {
	const startTime = Date.now();
	const host = credential.host as string;
	const authentication = credential.authentication as string;
	const allowUnauthorizedCerts = credential.allowUnauthorizedCerts as boolean;
	const sapClient = credential.sapClient as string;
	const sapLanguage = credential.sapLanguage as string;

	// Build auth config
	const auth = authentication === 'basicAuth'
		? {
				username: credential.username as string,
				password: credential.password as string,
		}
		: undefined;

	try {
		// ========================================
		// Test 1: Catalog Service Availability
		// ========================================
		let catalogServiceAvailable = false;
		let catalogResponseTime = 0;

		try {
			const catalogStartTime = Date.now();
			await this.helpers.request({
				method: 'GET',
				url: `${host}/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/`,
				auth,
				skipSslCertificateValidation: allowUnauthorizedCerts,
				timeout: CONNECTION_TEST_TIMEOUT,
				headers: buildSapHeaders(sapClient, sapLanguage),
			});
			catalogResponseTime = Date.now() - catalogStartTime;
			catalogServiceAvailable = true;
		} catch (error) {
			// Catalog service may not be available, continue with metadata test
			catalogServiceAvailable = false;
		}

		// ========================================
		// Test 2: Metadata Endpoint Test
		// ========================================
		// Try common metadata endpoints
		let metadataXml: string | null = null;
		let metadataAccessible = false;

		const testPaths = [
			'/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata', // Common API
			'/sap/opu/odata/iwbep/GWSAMPLE_BASIC/$metadata',      // Sample service
		];

		for (const path of testPaths) {
			try {
				const metadataResponse = await this.helpers.request({
					method: 'GET',
					url: `${host}${path}`,
					auth,
					skipSslCertificateValidation: allowUnauthorizedCerts,
					timeout: CONNECTION_TEST_TIMEOUT,
					headers: buildSapHeaders(sapClient, sapLanguage),
				});
				metadataXml = typeof metadataResponse === 'string'
					? metadataResponse
					: JSON.stringify(metadataResponse);
				metadataAccessible = true;
				break; // Success, exit loop
			} catch (error) {
				// Try next path
				continue;
			}
		}

		// ========================================
		// Test 3: Parse Entity Sets
		// ========================================
		let entitySets: string[] = [];
		if (metadataXml && metadataAccessible) {
			try {
				entitySets = parseMetadataForEntitySets(metadataXml);
			} catch (error) {
				// Parsing failed, but connection works
				entitySets = [];
			}
		}

		const totalResponseTime = Date.now() - startTime;

		// ========================================
		// Build Success Result
		// ========================================
		if (catalogServiceAvailable || metadataAccessible) {
			const entitySetPreview = entitySets.slice(0, 5);
			const moreCount = entitySets.length - 5;

			let message = 'Connection successful!\n\n';

			if (catalogServiceAvailable) {
				message += `Catalog Service: Available (${catalogResponseTime}ms)\n`;
			}

			if (metadataAccessible) {
				message += `Metadata Access: OK\n`;
				message += `Entity Sets Found: ${entitySets.length}\n`;

				if (entitySetPreview.length > 0) {
					message += `\nSample Entity Sets:\n`;
					entitySetPreview.forEach((es, idx) => {
						message += `   ${idx + 1}. ${es}\n`;
					});

					if (moreCount > 0) {
						message += `   ... and ${moreCount} more\n`;
					}
				}
			}

			message += `\nResponse Time: ${totalResponseTime}ms`;

			if (sapClient) {
				message += `\nSAP Client: ${sapClient}`;
			}

			return {
				status: 'OK',
				message,
			};
		}

		// If we reach here, both tests failed
		return {
			status: 'Error',
			message: '❌ Connection failed\n\n' +
				'Unable to access SAP OData services.\n' +
				'Please check:\n' +
				'• Host URL is correct\n' +
				'• Authentication credentials\n' +
				'• Network connectivity / VPN\n' +
				'• SAP Gateway is running',
		};

	} catch (error) {
		// ========================================
		// Detailed Error Handling
		// ========================================
		const totalResponseTime = Date.now() - startTime;

		// Import type guards for robust error checking
		const { getHttpStatusCode, isNetworkError, isTimeoutError, isCertificateError, getErrorMessage } =
			await import('../../lib/utils/TypeGuards');

		const statusCode = getHttpStatusCode(error);
		const errorMessage = getErrorMessage(error);

		// Authentication Error
		if (statusCode === 401) {
			return {
				status: 'Error',
				message: 'Authentication failed\n\n' +
					'Invalid username or password.\n' +
					'Please check your credentials.\n\n' +
					`Response Time: ${totalResponseTime}ms`,
			};
		}

		// Forbidden
		if (statusCode === 403) {
			return {
				status: 'Error',
				message: 'Access forbidden\n\n' +
					'User does not have permission to access OData services.\n' +
					'Please check SAP authorizations.\n\n' +
					`Response Time: ${totalResponseTime}ms`,
			};
		}

		// Timeout
		if (isTimeoutError(error)) {
			return {
				status: 'Error',
				message: 'Connection timeout\n\n' +
					'SAP system not reachable.\n' +
					'Please check:\n' +
					'• Is VPN connected?\n' +
					'• Is the SAP system running?\n' +
					'• Firewall settings\n\n' +
					`Timeout after: ${totalResponseTime}ms`,
			};
		}

		// Network/DNS Error
		if (isNetworkError(error) && !isCertificateError(error)) {
			return {
				status: 'Error',
				message: 'Host not found\n\n' +
					'Cannot resolve hostname or connection refused.\n' +
					'Please check:\n' +
					'• Host URL spelling\n' +
					'• DNS resolution\n' +
					'• Network connectivity\n\n' +
					`Host: ${host}`,
			};
		}

		// SSL Certificate Error
		if (isCertificateError(error)) {
			return {
				status: 'Error',
				message: 'SSL Certificate error\n\n' +
					'Cannot verify SSL certificate.\n\n' +
					'Options:\n' +
					'• Enable "Ignore SSL Issues" (not recommended for production)\n' +
					'• Install proper SSL certificate on SAP system\n' +
					'• Use corporate CA certificate',
			};
		}

		// Generic Error
		return {
			status: 'Error',
			message: 'Connection test failed\n\n' +
				`Error: ${sanitizeErrorMessage(errorMessage)}\n\n` +
				`Response Time: ${totalResponseTime}ms`,
		};
	}
}

/**
 * Build SAP-specific HTTP headers
 */
function buildSapHeaders(sapClient?: string, sapLanguage?: string): Record<string, string> {
	const headers: Record<string, string> = {};

	if (sapClient) {
		headers['sap-client'] = sapClient;
	}

	if (sapLanguage) {
		headers['sap-language'] = sapLanguage;
	}

	return headers;
}

/**
 * Sanitize error message to prevent sensitive data exposure
 */
function sanitizeErrorMessage(message: string): string {
	// Remove potential sensitive data from error messages
	return message
		.replace(/password[=:]\s*['"]?[^'"\s]+['"]?/gi, 'password=***')
		.replace(/token[=:]\s*['"]?[^'"\s]+['"]?/gi, 'token=***')
		.substring(0, 200); // Limit length
}
