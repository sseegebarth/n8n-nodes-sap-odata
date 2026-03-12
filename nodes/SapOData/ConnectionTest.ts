/**
 * SAP OData Credential Test
 *
 * Custom credential test that handles SAP's specific behavior.
 * SAP systems often return 404 for root URLs, so we accept any HTTP response
 * as proof that the system is reachable.
 */

import {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	INodeCredentialTestResult,
} from 'n8n-workflow';

/**
 * Test SAP OData connection
 *
 * This test checks if the SAP system is reachable. It accepts any HTTP response
 * (including 404) as success, because SAP systems don't have a standard ping endpoint.
 */
export async function testSapODataConnection(
	this: ICredentialTestFunctions,
	credential: ICredentialsDecrypted,
): Promise<INodeCredentialTestResult> {
	const credentials = credential.data;

	if (!credentials) {
		return {
			status: 'Error',
			message: 'No credentials provided',
		};
	}

	const host = (credentials.host as string)?.replace(/\/$/, '');
	if (!host) {
		return {
			status: 'Error',
			message: 'Host URL is required',
		};
	}

	try {
		// Build request options
		const requestOptions: Record<string, unknown> = {
			method: 'GET',
			url: `${host}/`,
			skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true, // Accept any status code
			timeout: 10000,
		};

		// Add Basic Auth if configured
		if (credentials.authentication === 'basicAuth' && credentials.username && credentials.password) {
			requestOptions.auth = {
				username: credentials.username as string,
				password: credentials.password as string,
			};
		}

		// Add SAP headers
		const headers: Record<string, string> = {};
		if (credentials.sapClient) {
			headers['sap-client'] = credentials.sapClient as string;
		}
		if (credentials.sapLanguage) {
			headers['sap-language'] = credentials.sapLanguage as string;
		}
		if (Object.keys(headers).length > 0) {
			requestOptions.headers = headers;
		}

		const response = await (this.helpers as unknown as { httpRequest: (options: Record<string, unknown>) => Promise<unknown> }).httpRequest(requestOptions);

		// Check if we got any response (even 404 is fine - it means SAP is reachable)
		if (response !== undefined) {
			return {
				status: 'OK',
				message: 'Connection successful',
			};
		}

		return {
			status: 'Error',
			message: 'No response from SAP system',
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Check for specific error types
		if (errorMessage.includes('ECONNREFUSED')) {
			return {
				status: 'Error',
				message: `Connection refused. Is the SAP system running at ${host}?`,
			};
		}

		if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
			return {
				status: 'Error',
				message: `Host not found: ${host}. Please check the URL.`,
			};
		}

		if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
			return {
				status: 'Error',
				message: `Connection timed out. The SAP system at ${host} is not responding.`,
			};
		}

		if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
			return {
				status: 'Error',
				message: 'SSL certificate error. Enable "Ignore SSL Issues" if using self-signed certificates.',
			};
		}

		return {
			status: 'Error',
			message: `Connection failed: ${errorMessage}`,
		};
	}
}
