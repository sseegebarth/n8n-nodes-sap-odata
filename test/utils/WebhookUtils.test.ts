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
			// Pre-calculated hex-encoded signature for this payload and secret
			const signature = 'e1c9146e7667b89c2eb7686de3645effe45b3418b4dd831388f6332f33f897a8';

			const result = verifyHmacSignature(payload, signature, secret, 'sha256');
			expect(result).toBe(true);
		});

		it('should verify valid HMAC-SHA512 signature', () => {
			const payload = 'test payload';
			const secret = 'secret123';
			// Pre-calculated hex-encoded SHA-512 signature
			const signature = 'dcb7606e4c6ed82b004f0d91afdd9cf8d8f7ee28b4fb6663e37ac75ca544aaf2c1273efcdc72b55a5038c8db30b2f7bd1f0265a5a674375b03dde29e36e6cbdf';

			const result = verifyHmacSignature(payload, signature, secret, 'sha512');
			expect(result).toBe(true);
		});

		it('should reject invalid signature', () => {
			const payload = 'test payload';
			const secret = 'secret123';
			const invalidSignature = '0000000000000000000000000000000000000000000000000000000000000000';

			const result = verifyHmacSignature(payload, invalidSignature, secret);
			expect(result).toBe(false);
		});

		it('should reject signature with wrong secret', () => {
			const payload = 'test payload';
			const wrongSecret = 'wrong_secret';
			// Signature generated with secret123, not wrong_secret
			const signature = 'e1c9146e7667b89c2eb7686de3645effe45b3418b4dd831388f6332f33f897a8';

			const result = verifyHmacSignature(payload, signature, wrongSecret);
			expect(result).toBe(false);
		});

		it('should handle Buffer payload', () => {
			const payload = Buffer.from('test payload');
			const secret = 'secret123';
			// Same hex signature since Buffer.from('test payload') produces same bytes
			const signature = 'e1c9146e7667b89c2eb7686de3645effe45b3418b4dd831388f6332f33f897a8';

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
		it('should validate correct OData V2 payload with metadata', () => {
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

		it('should accept payload with any data (non-empty object)', () => {
			const payload = {
				CustomerID: '001',
				Name: 'Test Customer',
			};

			// Implementation accepts any non-empty object
			expect(isValidSapODataPayload(payload)).toBe(true);
		});

		it('should accept OData V2 payload without __metadata', () => {
			const payload = {
				d: {
					CustomerID: '001',
					Name: 'Test Customer',
				},
			};

			// Implementation checks for 'd' property presence, not __metadata
			expect(isValidSapODataPayload(payload)).toBe(true);
		});

		it('should handle OData V4 payload format', () => {
			const payload = {
				'@odata.context': '$metadata#Customers/$entity',
				CustomerID: '001',
				Name: 'Test Customer',
			};

			expect(isValidSapODataPayload(payload)).toBe(true);
		});

		it('should reject null payload', () => {
			expect(isValidSapODataPayload(null)).toBe(false);
		});

		it('should reject non-object payload', () => {
			expect(isValidSapODataPayload('string')).toBe(false);
			expect(isValidSapODataPayload(123)).toBe(false);
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
				entityType: 'SAP.Customer',
				entityKey: '001',
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
			expect(result.entityKey).toBe('001');
			expect(result.data).toBeDefined();
		});

		it('should extract event info from OData V4 payload', () => {
			const payload = {
				entityType: 'Customers',
				entityKey: '001',
				value: {
					CustomerID: '001',
					Name: 'Test Customer',
				},
			};

			const result = extractEventInfo(payload);
			expect(result.entityType).toBe('Customers');
			expect(result.entityKey).toBe('001');
			expect(result.data).toBeDefined();
		});

		it('should extract operation from payload', () => {
			const payload = {
				operation: 'delete',
				entityType: 'Customer',
				entityKey: '001',
			};

			const result = extractEventInfo(payload);
			expect(result.operation).toBe('delete');
		});

		it('should handle payload without identifiable structure', () => {
			const payload = { someData: 'value' };

			const result = extractEventInfo(payload);
			// Function only extracts explicitly present fields
			expect(result.entityType).toBeUndefined();
			expect(result.entityKey).toBeUndefined();
			expect(result.operation).toBeUndefined();
		});

		it('should extract timestamp from payload', () => {
			const payload = {
				timestamp: '2024-10-26T12:00:00Z',
				entityType: 'Order',
			};

			const result = extractEventInfo(payload);
			expect(result.timestamp).toBe('2024-10-26T12:00:00Z');
		});

		it('should extract event type from payload', () => {
			const payload = {
				event: 'created',
				entityType: 'Order',
			};

			const result = extractEventInfo(payload);
			expect(result.type).toBe('created');
		});
	});
});