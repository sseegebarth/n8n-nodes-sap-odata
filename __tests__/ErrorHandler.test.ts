import { NodeOperationError } from 'n8n-workflow';
import {
	buildSecureUrl,
	validateEntityKey,
	sanitizeErrorMessage,
} from '../lib/utils/SecurityUtils';

const mockNode = {
	id: 'test-node-id',
	name: 'SAP OData',
	type: 'n8n-nodes-sap-odata.sapOData',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
} as any;

describe('SecurityUtils', () => {
	describe('buildSecureUrl', () => {
		it('should build URL from host, service path and resource', () => {
			const url = buildSecureUrl('https://sap.example.com', '/sap/opu/odata/sap/API/', 'ProductSet', mockNode);
			expect(url).toBe('https://sap.example.com/sap/opu/odata/sap/API/ProductSet');
		});

		it('should handle trailing slashes and double slashes', () => {
			const url = buildSecureUrl('https://sap.example.com/', '/sap/opu/', '/Products', mockNode);
			const path = new URL(url).pathname;
			expect(path).not.toContain('//');
		});

		it('should reject non-http protocols', () => {
			expect(() => buildSecureUrl('ftp://sap.example.com', '/sap/', 'Products', mockNode))
				.toThrow(NodeOperationError);
		});

		it('should strip path traversal sequences', () => {
			const url = buildSecureUrl('https://sap.example.com', '../etc/passwd', 'Products', mockNode);
			expect(url).not.toContain('..');
		});

		it('should throw NodeOperationError for invalid URLs', () => {
			expect(() => buildSecureUrl('not-a-url', '/sap/', 'Products', mockNode))
				.toThrow(NodeOperationError);
		});
	});

	describe('validateEntityKey', () => {
		it('should accept simple string keys', () => {
			expect(() => validateEntityKey("'0500000001'", mockNode)).not.toThrow();
		});

		it('should accept numeric keys', () => {
			expect(() => validateEntityKey('123', mockNode)).not.toThrow();
		});

		it('should accept composite keys', () => {
			expect(() => validateEntityKey("OrderID='100',ItemID='10'", mockNode)).not.toThrow();
		});

		it('should accept GUID keys', () => {
			expect(() => validateEntityKey('guid\'12345678-1234-1234-1234-123456789abc\'', mockNode)).not.toThrow();
		});
	});

	describe('sanitizeErrorMessage', () => {
		it('should remove sensitive patterns from error messages', () => {
			const result = sanitizeErrorMessage('Error connecting to https://user:password@sap.com/api');
			expect(result).not.toContain('password');
		});

		it('should handle empty strings', () => {
			expect(sanitizeErrorMessage('')).toBe('');
		});

		it('should handle messages without sensitive data', () => {
			const msg = 'Entity not found';
			expect(sanitizeErrorMessage(msg)).toBe(msg);
		});
	});
});
