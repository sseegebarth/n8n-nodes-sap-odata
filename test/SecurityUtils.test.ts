import { NodeOperationError } from 'n8n-workflow';
import {
	buildSecureUrl,
	validateEntityKey,
	validateODataFilter,
	validateJsonInput,
	sanitizeErrorMessage,
	validateUrl,
	sanitizeHeaderValue,
	validateEntitySetName,
	validateFunctionName,
} from '../nodes/Sap/SecurityUtils';

describe('SecurityUtils', () => {
	const mockNode = {
		id: 'test-node-id',
		name: 'Test Node',
		type: 'n8n-nodes-sap-odata.sapOData',
		typeVersion: 1,
		position: [250, 300] as [number, number],
		parameters: {},
	};

	describe('buildSecureUrl', () => {
		it('should build a valid HTTPS URL', () => {
			const url = buildSecureUrl('https://example.com', '/sap/opu/odata/sap', 'ProductSet');
			expect(url).toContain('https://example.com');
			expect(url).toContain('ProductSet');
		});

		it('should build a valid HTTP URL', () => {
			const url = buildSecureUrl('http://example.com', '/service', 'EntitySet');
			expect(url).toContain('http://example.com');
			expect(url).toContain('EntitySet');
		});

		it('should handle trailing slashes', () => {
			const url = buildSecureUrl('https://example.com/', '/service/', 'EntitySet');
			expect(url).toContain('https://example.com');
			expect(url).toContain('EntitySet');
		});

		it('should reject invalid protocols', () => {
			expect(() => buildSecureUrl('ftp://example.com', '/service/', '/EntitySet')).toThrow(
				'Invalid protocol',
			);
		});

		it('should sanitize path traversal attempts', () => {
			const url = buildSecureUrl('https://example.com', '/service/../admin/', '/EntitySet');
			expect(url).not.toContain('..');
		});

		it('should handle empty resource', () => {
			const url = buildSecureUrl('https://example.com', '/service/', '');
			expect(url).toBe('https://example.com/service/');
		});
	});

	describe('validateEntityKey', () => {
		it('should accept valid simple keys', () => {
			expect(validateEntityKey('0500000001', mockNode)).toBe('0500000001');
			expect(validateEntityKey('ABC123', mockNode)).toBe('ABC123');
		});

		it('should accept valid composite keys', () => {
			const key = "Key1='value1',Key2='value2'";
			expect(validateEntityKey(key, mockNode)).toBe(key);
		});

		it('should reject SQL injection patterns - semicolon', () => {
			expect(() => validateEntityKey("'; DROP TABLE Users; --", mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should reject SQL injection patterns - comment markers', () => {
			expect(() => validateEntityKey('value--comment', mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntityKey('value/*comment*/', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject SQL injection patterns - commands', () => {
			expect(() => validateEntityKey('DELETE FROM Users', mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntityKey('INSERT INTO Users', mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntityKey('UPDATE Users SET', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject invalid composite key format', () => {
			expect(() => validateEntityKey("Key1=value1", mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntityKey("Key1='value1',Key2=value2", mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should accept properly formatted composite keys', () => {
			const validKeys = [
				"ID='123'",
				"Key1='val1',Key2='val2'",
				"OrderID='SO001',ItemID='10'",
			];
			validKeys.forEach((key) => {
				expect(() => validateEntityKey(key, mockNode)).not.toThrow();
			});
		});
	});

	describe('validateODataFilter', () => {
		it('should accept valid OData filters', () => {
			const validFilters = [
				"Status eq 'Active'",
				'Price gt 100',
				"Name eq 'Test' and Price lt 500",
				'substringof(Name, "Bike")',
			];
			validFilters.forEach((filter) => {
				expect(validateODataFilter(filter, mockNode)).toBe(filter);
			});
		});

		it('should reject JavaScript injection', () => {
			expect(() => validateODataFilter('javascript:alert(1)', mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should reject script tags', () => {
			expect(() => validateODataFilter('<script>alert(1)</script>', mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should reject event handlers', () => {
			expect(() => validateODataFilter('onclick=alert(1)', mockNode)).toThrow(
				NodeOperationError,
			);
			expect(() => validateODataFilter('onload = malicious()', mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should reject eval expressions', () => {
			expect(() => validateODataFilter('eval(malicious)', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject CSS expressions', () => {
			expect(() => validateODataFilter('expression(alert(1))', mockNode)).toThrow(
				NodeOperationError,
			);
		});
	});

	describe('validateJsonInput', () => {
		it('should parse valid JSON objects', () => {
			const json = '{"name": "Test", "value": 123}';
			const result = validateJsonInput(json, 'TestField', mockNode);
			expect(result).toEqual({ name: 'Test', value: 123 });
		});

		it('should accept nested objects', () => {
			const json = '{"outer": {"inner": "value"}}';
			const result = validateJsonInput(json, 'TestField', mockNode);
			expect(result).toEqual({ outer: { inner: 'value' } });
		});

		it('should reject invalid JSON', () => {
			expect(() => validateJsonInput('{invalid}', 'TestField', mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should reject non-object JSON (string)', () => {
			expect(() => validateJsonInput('"just a string"', 'TestField', mockNode)).toThrow(
				NodeOperationError,
			);
		});

		it('should accept arrays as valid JSON objects', () => {
			// Arrays are typeof 'object' in JavaScript, so they pass validation
			const result = validateJsonInput('[1, 2, 3]', 'TestField', mockNode);
			expect(Array.isArray(result)).toBe(true);
			expect(result).toEqual([1, 2, 3]);
		});

		it('should reject null', () => {
			expect(() => validateJsonInput('null', 'TestField', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject __proto__ pollution', () => {
			const json = '{"__proto__": {"isAdmin": true}}';
			expect(() => validateJsonInput(json, 'TestField', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject constructor pollution', () => {
			const json = '{"constructor": {"prototype": {"isAdmin": true}}}';
			expect(() => validateJsonInput(json, 'TestField', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject prototype pollution', () => {
			const json = '{"prototype": {"isAdmin": true}}';
			expect(() => validateJsonInput(json, 'TestField', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject nested dangerous keys', () => {
			const json = '{"safe": {"__proto__": {"dangerous": true}}}';
			expect(() => validateJsonInput(json, 'TestField', mockNode)).toThrow(NodeOperationError);
		});
	});

	describe('sanitizeErrorMessage', () => {
		it('should mask passwords in URLs', () => {
			const message = 'Error connecting to https://user:secret@example.com';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('secret');
			expect(sanitized).toContain('***');
		});

		it('should mask password parameters', () => {
			const message = 'Failed with password=MySecretPass123';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('MySecretPass123');
			expect(sanitized).toContain('password=***');
		});

		it('should mask pwd parameters', () => {
			const message = 'Connection failed: pwd=secret123';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('secret123');
			expect(sanitized).toContain('pwd=***');
		});

		it('should mask Bearer tokens', () => {
			const message = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
			expect(sanitized).toContain('Bearer ***');
		});

		it('should mask token parameters', () => {
			const message = 'Request failed: token=abc123def456';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('abc123def456');
			expect(sanitized).toContain('token=***');
		});

		it('should mask API keys', () => {
			const messages = [
				'Failed: api_key=sk_test_123456',
				'Error: api-key=sk_live_abcdef',
				'Denied: apikey=mykey123',
			];
			messages.forEach((message) => {
				const sanitized = sanitizeErrorMessage(message);
				expect(sanitized).toContain('***');
				expect(sanitized).not.toMatch(/sk_test|sk_live|mykey123/);
			});
		});

		it('should reject excessively large JSON', () => {
			const largeJson = '{"data": "' + 'x'.repeat(11 * 1024 * 1024) + '"}';
			expect(() => validateJsonInput(largeJson, 'TestField', mockNode)).toThrow(NodeOperationError);
			expect(() => validateJsonInput(largeJson, 'TestField', mockNode)).toThrow(/exceeds maximum size/);
		});

		it('should reject deeply nested JSON', () => {
			let deepJson = '{"a":';
			for (let i = 0; i < 101; i++) {
				deepJson += '{"b":';
			}
			deepJson += '1';
			for (let i = 0; i < 102; i++) {
				deepJson += '}';
			}
			expect(() => validateJsonInput(deepJson, 'TestField', mockNode)).toThrow(NodeOperationError);
			expect(() => validateJsonInput(deepJson, 'TestField', mockNode)).toThrow(/too deeply nested/);
		});
	});

	describe('validateUrl', () => {
		it('should accept valid HTTPS URLs', () => {
			expect(() => validateUrl('https://example.com/api', mockNode)).not.toThrow();
			expect(() => validateUrl('https://sap.example.com:8000/odata', mockNode)).not.toThrow();
		});

		it('should accept valid HTTP URLs', () => {
			expect(() => validateUrl('http://example.com', mockNode)).not.toThrow();
		});

		it('should reject invalid protocols', () => {
			expect(() => validateUrl('ftp://example.com', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('file:///etc/passwd', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('javascript:alert(1)', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject localhost access', () => {
			expect(() => validateUrl('http://localhost:8080', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://127.0.0.1', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://127.1', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://[::1]', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject private IP addresses', () => {
			expect(() => validateUrl('http://10.0.0.1', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://192.168.1.1', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://172.16.0.1', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://169.254.169.254', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject cloud metadata endpoints', () => {
			expect(() => validateUrl('http://169.254.169.254/latest/meta-data', mockNode)).toThrow(NodeOperationError);
			expect(() => validateUrl('http://metadata.google.internal', mockNode)).toThrow(NodeOperationError);
		});
	});

	describe('sanitizeHeaderValue', () => {
		it('should remove carriage returns', () => {
			const value = 'test\rvalue';
			expect(sanitizeHeaderValue(value)).toBe('testvalue');
		});

		it('should remove newlines', () => {
			const value = 'test\nvalue';
			expect(sanitizeHeaderValue(value)).toBe('testvalue');
		});

		it('should remove both CR and LF', () => {
			const value = 'test\r\nvalue\nother';
			expect(sanitizeHeaderValue(value)).toBe('testvalueother');
		});

		it('should preserve valid header values', () => {
			const value = 'Bearer token123';
			expect(sanitizeHeaderValue(value)).toBe('Bearer token123');
		});
	});

	describe('validateEntitySetName', () => {
		it('should accept valid entity set names', () => {
			expect(validateEntitySetName('ProductSet', mockNode)).toBe('ProductSet');
			expect(validateEntitySetName('Customer_Data', mockNode)).toBe('Customer_Data');
			expect(validateEntitySetName('ZAPI_SALES_ORDER', mockNode)).toBe('ZAPI_SALES_ORDER');
		});

		it('should reject names with special characters', () => {
			expect(() => validateEntitySetName('Product-Set', mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntitySetName('Product Set', mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntitySetName('Product/Set', mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntitySetName('Product;Set', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject overly long names', () => {
			const longName = 'A'.repeat(256);
			expect(() => validateEntitySetName(longName, mockNode)).toThrow(NodeOperationError);
			expect(() => validateEntitySetName(longName, mockNode)).toThrow(/too long/);
		});
	});

	describe('validateFunctionName', () => {
		it('should accept valid function names', () => {
			expect(validateFunctionName('GetSalesOrder', mockNode)).toBe('GetSalesOrder');
			expect(validateFunctionName('Calculate_Price', mockNode)).toBe('Calculate_Price');
			expect(validateFunctionName('ZFUNCTION_IMPORT', mockNode)).toBe('ZFUNCTION_IMPORT');
		});

		it('should reject names with special characters', () => {
			expect(() => validateFunctionName('Get-SalesOrder', mockNode)).toThrow(NodeOperationError);
			expect(() => validateFunctionName('Get SalesOrder', mockNode)).toThrow(NodeOperationError);
			expect(() => validateFunctionName('Get/SalesOrder', mockNode)).toThrow(NodeOperationError);
		});

		it('should reject overly long names', () => {
			const longName = 'A'.repeat(256);
			expect(() => validateFunctionName(longName, mockNode)).toThrow(NodeOperationError);
		});
	});

	// RateLimiter tests removed - class has been deprecated
	// Use ThrottleManager instead for production rate limiting
	// See ThrottleManager.test.ts for throttling tests

	describe('sanitizeErrorMessage', () => {
		it('should mask credentials in basic auth URLs', () => {
			const message = 'Failed to connect to https://admin:password@server.com/api';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('admin:password');
			expect(sanitized).toContain('://***:***@');
		});

		it('should handle multiple sensitive patterns', () => {
			const message =
				'Error: password=secret123 token=abc456 at https://user:pass@example.com';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('secret123');
			expect(sanitized).not.toContain('abc456');
			expect(sanitized).not.toContain('user:pass');
		});

		it('should preserve non-sensitive content', () => {
			const message = 'Connection timeout after 30 seconds to https://example.com/api';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe(message);
		});
	});
});
