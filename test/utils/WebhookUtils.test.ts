import { describe, it, expect } from '@jest/globals';
import {
	verifyHmacSignature,
	isIpAllowed,
	isValidSapODataPayload,
	parseSapDates,
	extractEventInfo,
} from '../../nodes/Shared/utils/WebhookUtils';

describe('WebhookUtils', () => {
	describe('verifyHmacSignature', () => {
		it('should verify valid HMAC-SHA256 signature', () => {
			const payload = 'test payload';
			const secret = 'secret123';
			// Pre-calculated signature for this payload and secret
			const signature = 'kHR0HBYub+jmHfLTq8L8CjHYTuJ7UQKvgLXyjfqp0qg=';

			const result = verifyHmacSignature(payload, signature, secret, 'sha256');
			expect(result).toBe(true);
		});

		it('should verify valid HMAC-SHA512 signature', () => {
			const payload = 'test payload';
			const secret = 'secret123';
			// Pre-calculated SHA-512 signature
			const signature = 'Mw5lzKvkdvSNVR4LKn5C2gYJr9XLr+6Y7e4aWREAhH2BjXlvJJqz0L5LpvEOV9kEU1AEBRvp9oXJRFQBgxC0dA==';

			const result = verifyHmacSignature(payload, signature, secret, 'sha512');
			expect(result).toBe(true);
		});

		it('should reject invalid signature', () => {
			const payload = 'test payload';
			const secret = 'secret123';
			const invalidSignature = 'invalid_signature';

			const result = verifyHmacSignature(payload, invalidSignature, secret);
			expect(result).toBe(false);
		});

		it('should reject signature with wrong secret', () => {
			const payload = 'test payload';
			const wrongSecret = 'wrong_secret';
			const signature = 'kHR0HBYub+jmHfLTq8L8CjHYTuJ7UQKvgLXyjfqp0qg=';

			const result = verifyHmacSignature(payload, signature, wrongSecret);
			expect(result).toBe(false);
		});

		it('should handle Buffer payload', () => {
			const payload = Buffer.from('test payload');
			const secret = 'secret123';
			const signature = 'kHR0HBYub+jmHfLTq8L8CjHYTuJ7UQKvgLXyjfqp0qg=';

			const result = verifyHmacSignature(payload, signature, secret);
			expect(result).toBe(true);
		});
	});

	describe('isIpAllowed', () => {
		describe('IPv4 Tests', () => {
			it('should allow exact IP match', () => {
				const whitelist = ['192.168.1.100'];
				expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
				expect(isIpAllowed('192.168.1.101', whitelist)).toBe(false);
			});

			it('should allow IP in /24 CIDR range', () => {
				const whitelist = ['192.168.1.0/24'];
				expect(isIpAllowed('192.168.1.1', whitelist)).toBe(true);
				expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
				expect(isIpAllowed('192.168.1.255', whitelist)).toBe(true);
				expect(isIpAllowed('192.168.2.1', whitelist)).toBe(false);
			});

			it('should allow IP in /16 CIDR range', () => {
				const whitelist = ['10.0.0.0/16'];
				expect(isIpAllowed('10.0.1.1', whitelist)).toBe(true);
				expect(isIpAllowed('10.0.255.255', whitelist)).toBe(true);
				expect(isIpAllowed('10.1.0.0', whitelist)).toBe(false);
			});

			it('should allow IP in /8 CIDR range', () => {
				const whitelist = ['10.0.0.0/8'];
				expect(isIpAllowed('10.1.2.3', whitelist)).toBe(true);
				expect(isIpAllowed('10.255.255.255', whitelist)).toBe(true);
				expect(isIpAllowed('11.0.0.0', whitelist)).toBe(false);
			});

			it('should handle multiple CIDR ranges', () => {
				const whitelist = ['192.168.1.0/24', '10.0.0.0/16', '172.16.0.5'];
				expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
				expect(isIpAllowed('10.0.50.1', whitelist)).toBe(true);
				expect(isIpAllowed('172.16.0.5', whitelist)).toBe(true);
				expect(isIpAllowed('172.16.0.6', whitelist)).toBe(false);
			});

			it('should handle /32 CIDR (single IP)', () => {
				const whitelist = ['192.168.1.100/32'];
				expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
				expect(isIpAllowed('192.168.1.99', whitelist)).toBe(false);
				expect(isIpAllowed('192.168.1.101', whitelist)).toBe(false);
			});
		});

		describe('IPv6 Tests', () => {
			it('should allow exact IPv6 match', () => {
				const whitelist = ['2001:db8::1'];
				expect(isIpAllowed('2001:db8::1', whitelist)).toBe(true);
				expect(isIpAllowed('2001:db8::2', whitelist)).toBe(false);
			});

			it('should allow IPv6 in /64 CIDR range', () => {
				const whitelist = ['2001:db8::/64'];
				expect(isIpAllowed('2001:db8::1', whitelist)).toBe(true);
				expect(isIpAllowed('2001:db8::ffff', whitelist)).toBe(true);
				expect(isIpAllowed('2001:db8:1::1', whitelist)).toBe(false);
			});

			it('should allow IPv6 in /32 CIDR range', () => {
				const whitelist = ['2001:db8::/32'];
				expect(isIpAllowed('2001:db8:1::1', whitelist)).toBe(true);
				expect(isIpAllowed('2001:db8:ffff::1', whitelist)).toBe(true);
				expect(isIpAllowed('2001:db9::1', whitelist)).toBe(false);
			});

			it('should handle compressed IPv6 notation', () => {
				const whitelist = ['::1'];
				expect(isIpAllowed('::1', whitelist)).toBe(true);
				expect(isIpAllowed('0:0:0:0:0:0:0:1', whitelist)).toBe(true);
				expect(isIpAllowed('::2', whitelist)).toBe(false);
			});

			it('should handle mixed IPv4 and IPv6 whitelist', () => {
				const whitelist = ['192.168.1.0/24', '2001:db8::/64'];
				expect(isIpAllowed('192.168.1.100', whitelist)).toBe(true);
				expect(isIpAllowed('2001:db8::1', whitelist)).toBe(true);
				expect(isIpAllowed('10.0.0.1', whitelist)).toBe(false);
				expect(isIpAllowed('2001:db9::1', whitelist)).toBe(false);
			});
		});

		describe('Edge Cases', () => {
			it('should reject invalid IP addresses', () => {
				const whitelist = ['192.168.1.0/24'];
				expect(isIpAllowed('not.an.ip', whitelist)).toBe(false);
				expect(isIpAllowed('999.999.999.999', whitelist)).toBe(false);
				expect(isIpAllowed('', whitelist)).toBe(false);
			});

			it('should handle empty whitelist', () => {
				const whitelist: string[] = [];
				expect(isIpAllowed('192.168.1.1', whitelist)).toBe(false);
			});

			it('should handle localhost addresses', () => {
				const whitelist = ['127.0.0.0/8', '::1'];
				expect(isIpAllowed('127.0.0.1', whitelist)).toBe(true);
				expect(isIpAllowed('127.0.0.2', whitelist)).toBe(true);
				expect(isIpAllowed('::1', whitelist)).toBe(true);
			});
		});
	});

	describe('isValidSapODataPayload', () => {
		it('should validate correct OData payload', () => {
			const payload = {
				d: {
					__metadata: {
						type: 'SAP.Customer',
						uri: 'http://sap.com/service/Customer(\'001\')',
					},
					CustomerID: '001',
					Name: 'Test Customer',
				},
			};

			expect(isValidSapODataPayload(payload)).toBe(true);
		});

		it('should reject payload without d property', () => {
			const payload = {
				CustomerID: '001',
				Name: 'Test Customer',
			};

			expect(isValidSapODataPayload(payload)).toBe(false);
		});

		it('should reject payload without __metadata', () => {
			const payload = {
				d: {
					CustomerID: '001',
					Name: 'Test Customer',
				},
			};

			expect(isValidSapODataPayload(payload)).toBe(false);
		});

		it('should handle OData V4 payload format', () => {
			const payload = {
				'@odata.context': '$metadata#Customers/$entity',
				CustomerID: '001',
				Name: 'Test Customer',
			};

			expect(isValidSapODataPayload(payload)).toBe(true);
		});
	});

	describe('parseSapDates', () => {
		it('should parse SAP timestamp format', () => {
			const data = {
				CreatedAt: '/Date(1609459200000)/',
				UpdatedAt: '/Date(1609545600000)/',
				Name: 'Test',
			};

			const result = parseSapDates(data);
			expect(result.CreatedAt).toBe('2021-01-01T00:00:00.000Z');
			expect(result.UpdatedAt).toBe('2021-01-02T00:00:00.000Z');
			expect(result.Name).toBe('Test');
		});

		it('should handle nested objects', () => {
			const data = {
				Order: {
					CreatedAt: '/Date(1609459200000)/',
					Items: [
						{
							DeliveryDate: '/Date(1609545600000)/',
							Product: 'ABC',
						},
					],
				},
			};

			const result = parseSapDates(data);
			expect(result.Order.CreatedAt).toBe('2021-01-01T00:00:00.000Z');
			expect(result.Order.Items[0].DeliveryDate).toBe('2021-01-02T00:00:00.000Z');
		});

		it('should leave non-SAP date strings unchanged', () => {
			const data = {
				CreatedAt: '2021-01-01',
				Description: 'Date format /Date(123)/ in text',
			};

			const result = parseSapDates(data);
			expect(result.CreatedAt).toBe('2021-01-01');
			expect(result.Description).toBe('Date format /Date(123)/ in text');
		});
	});

	describe('extractEventInfo', () => {
		it('should extract event info from OData V2 payload', () => {
			const payload = {
				d: {
					__metadata: {
						type: 'SAP.Customer',
						uri: 'http://sap.com/service/Customer(\'001\')',
					},
					CustomerID: '001',
					Name: 'Test Customer',
				},
			};

			const result = extractEventInfo(payload);
			expect(result.entityType).toBe('SAP.Customer');
			expect(result.entityId).toBe('001');
			expect(result.operation).toBe('unknown');
		});

		it('should extract event info from OData V4 payload', () => {
			const payload = {
				'@odata.context': '$metadata#Customers/$entity',
				'@odata.id': 'Customers(\'001\')',
				CustomerID: '001',
				Name: 'Test Customer',
			};

			const result = extractEventInfo(payload);
			expect(result.entityType).toBe('Customers');
			expect(result.entityId).toBe('001');
			expect(result.operation).toBe('unknown');
		});

		it('should detect operation from headers', () => {
			const payload = { d: { CustomerID: '001' } };
			const headers = { 'x-http-method': 'DELETE' };

			const result = extractEventInfo(payload, headers);
			expect(result.operation).toBe('delete');
		});

		it('should handle payload without identifiable structure', () => {
			const payload = { someData: 'value' };

			const result = extractEventInfo(payload);
			expect(result.entityType).toBe('unknown');
			expect(result.entityId).toBe('unknown');
			expect(result.operation).toBe('unknown');
		});
	});
});