/**
 * RequestBuilder Tests
 */

import {
	buildRequestOptions,
	buildCsrfTokenRequest,
	parsePoolConfig,
	parseStatusCodes,
	IRequestConfig,
} from '../../nodes/Sap/core/RequestBuilder';
import { ISapOdataCredentials } from '../../nodes/Sap/types';

describe('RequestBuilder', () => {
	const mockNode = {
		name: 'SAP OData',
		type: 'n8n-nodes-sap-odata.sapOData',
		typeVersion: 1,
		position: [0, 0] as [number, number],
	};

	const mockCredentials: ISapOdataCredentials = {
		host: 'https://api.example.com',
		servicePath: '/sap/opu/odata/sap/API_TEST',
		authentication: 'basicAuth',
		username: 'testuser',
		password: 'testpass',
		allowUnauthorizedCerts: false,
	};

	describe('buildRequestOptions', () => {
		it('should build basic GET request options', () => {
			const config: IRequestConfig = {
				method: 'GET',
				resource: '/ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.method).toBe('GET');
			expect(result.url).toBe('https://api.example.com/sap/opu/odata/sap/API_TEST/ProductSet');
			expect(result.json).toBe(true);
			expect(result.skipSslCertificateValidation).toBe(false);
		});

		it('should handle $metadata requests with XML response', () => {
			const config: IRequestConfig = {
				method: 'GET',
				resource: '$metadata',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.headers?.Accept).toBe('application/xml');
			expect(result.json).toBe(false); // $metadata returns XML
		});

		it('should add CSRF token for POST requests', () => {
			const config: IRequestConfig = {
				method: 'POST',
				resource: 'ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				csrfToken: 'test-csrf-token-123',
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.headers?.['X-CSRF-Token']).toBe('test-csrf-token-123');
		});

		it('should not add CSRF token for GET requests', () => {
			const config: IRequestConfig = {
				method: 'GET',
				resource: 'ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				csrfToken: 'test-csrf-token-123',
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.headers?.['X-CSRF-Token']).toBeUndefined();
		});

		it('should handle SSL validation disabled', () => {
			const insecureCredentials: ISapOdataCredentials = {
				...mockCredentials,
				allowUnauthorizedCerts: true,
			};

			const config: IRequestConfig = {
				method: 'GET',
				resource: 'ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: insecureCredentials,
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.skipSslCertificateValidation).toBe(true);
		});

		it('should use custom URI if provided', () => {
			const config: IRequestConfig = {
				method: 'GET',
				resource: 'ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				uri: 'https://custom.example.com/path',
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.url).toBe('https://custom.example.com/path');
		});

		it('should merge additional options', () => {
			const config: IRequestConfig = {
				method: 'GET',
				resource: 'ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				options: { returnFullResponse: true },
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.returnFullResponse).toBe(true);
		});

		it('should include body and query string', () => {
			const config: IRequestConfig = {
				method: 'POST',
				resource: 'ProductSet',
				host: 'https://api.example.com',
				servicePath: '/sap/opu/odata/sap/API_TEST',
				credentials: mockCredentials,
				body: { Name: 'Test Product' },
				qs: { $top: 10 },
				node: mockNode as any,
			};

			const result = buildRequestOptions(config);

			expect(result.body).toEqual({ Name: 'Test Product' });
			expect(result.qs).toEqual({ $top: 10 });
		});

		it('should throw on invalid URL (SSRF protection)', () => {
			const config: IRequestConfig = {
				method: 'GET',
				resource: 'ProductSet',
				host: 'http://localhost:8080', // localhost URLs are blocked
				servicePath: '/api',
				credentials: { ...mockCredentials, host: 'http://localhost:8080' },
				node: mockNode as any,
			};

			expect(() => buildRequestOptions(config)).toThrow();
		});
	});

	describe('buildCsrfTokenRequest', () => {
		it('should build CSRF token fetch request', () => {
			const result = buildCsrfTokenRequest(
				'https://api.example.com',
				'/sap/opu/odata/sap/API_TEST',
				mockCredentials,
				mockNode as any,
			);

			expect(result.method).toBe('GET');
			expect(result.url).toBe('https://api.example.com/sap/opu/odata/sap/API_TEST');
			expect(result.headers?.['X-CSRF-Token']).toBe('Fetch');
			expect(result.returnFullResponse).toBe(true);
		});

		it('should handle SSL validation disabled for CSRF request', () => {
			const insecureCredentials: ISapOdataCredentials = {
				...mockCredentials,
				allowUnauthorizedCerts: true,
			};

			const result = buildCsrfTokenRequest(
				'https://api.example.com',
				'/sap/opu/odata/sap/API_TEST',
				insecureCredentials,
				mockNode as any,
			);

			expect(result.skipSslCertificateValidation).toBe(true);
		});
	});

	describe('parsePoolConfig', () => {
		it('should extract pool configuration from advanced options', () => {
			const advancedOptions = {
				keepAlive: true,
				maxSockets: 10,
				maxFreeSockets: 5,
				timeout: 30000,
				freeSocketTimeout: 15000,
			};

			const result = parsePoolConfig(advancedOptions);

			expect(result).toEqual({
				keepAlive: true,
				maxSockets: 10,
				maxFreeSockets: 5,
				timeout: 30000,
				freeSocketTimeout: 15000,
			});
		});

		it('should filter out undefined values', () => {
			const advancedOptions = {
				keepAlive: true,
				maxSockets: undefined,
				timeout: 30000,
			};

			const result = parsePoolConfig(advancedOptions);

			expect(result).toEqual({
				keepAlive: true,
				timeout: 30000,
			});
			expect(result.hasOwnProperty('maxSockets')).toBe(false);
		});

		it('should return empty object if no pool config', () => {
			const result = parsePoolConfig({});
			expect(result).toEqual({});
		});

		it('should handle keepAlive false explicitly', () => {
			const advancedOptions = {
				keepAlive: false,
			};

			const result = parsePoolConfig(advancedOptions);

			expect(result).toEqual({ keepAlive: false });
		});
	});

	describe('parseStatusCodes', () => {
		it('should parse comma-separated status codes', () => {
			const result = parseStatusCodes('429, 503, 504');
			expect(result).toEqual([429, 503, 504]);
		});

		it('should handle status codes without spaces', () => {
			const result = parseStatusCodes('429,503,504');
			expect(result).toEqual([429, 503, 504]);
		});

		it('should return default codes for empty string', () => {
			const result = parseStatusCodes('');
			expect(result).toEqual([429, 503, 504]);
		});

		it('should return default codes for null input', () => {
			const result = parseStatusCodes(null as any);
			expect(result).toEqual([429, 503, 504]);
		});

		it('should return default codes for undefined input', () => {
			const result = parseStatusCodes(undefined as any);
			expect(result).toEqual([429, 503, 504]);
		});

		it('should filter out invalid codes', () => {
			const result = parseStatusCodes('429, abc, 503, xyz');
			expect(result).toEqual([429, 503]);
		});

		it('should filter out codes outside valid range', () => {
			const result = parseStatusCodes('50, 429, 503, 999');
			expect(result).toEqual([429, 503]); // 50 < 100, 999 >= 600
		});

		it('should handle mixed valid and invalid codes', () => {
			const result = parseStatusCodes('200, 404, 500, invalid, 600, 99');
			expect(result).toEqual([200, 404, 500]);
		});
	});
});
