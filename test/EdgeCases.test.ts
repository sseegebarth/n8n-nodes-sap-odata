/**
 * Edge Case Tests
 * Tests for edge cases and boundary conditions across the SAP OData node
 */

import { extractItemsFromResponse, extractNextLink } from '../nodes/Sap/core/PaginationHandler';
import { buildODataFilter } from '../nodes/Sap/core/QueryBuilder';
import { validateEntityKey } from '../nodes/Sap/SecurityUtils';
import { INode } from 'n8n-workflow';

const mockNode: INode = {
	id: 'test-node-id',
	name: 'SAP OData',
	type: 'n8n-nodes-sap-odata.sapOData',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

describe('Edge Case Tests', () => {
	describe('Empty Response Handling', () => {
		it('should handle empty results array in V2 format', () => {
			const response = { d: { results: [] } };
			const items = extractItemsFromResponse(response, 'd.results');
			expect(items).toEqual([]);
		});

		it('should handle empty value array in V4 format', () => {
			const response = { value: [] };
			const items = extractItemsFromResponse(response, 'value');
			expect(items).toEqual([]);
		});

		it('should handle response with only count in V4', () => {
			const response = { '@odata.count': 0, value: [] };
			const items = extractItemsFromResponse(response, 'value');
			expect(items).toEqual([]);
		});

		it('should handle null results', () => {
			const response = { d: { results: null } };
			const items = extractItemsFromResponse(response, 'd.results');
			// Null is wrapped in array
			expect(Array.isArray(items)).toBe(true);
		});

		it('should handle empty object response', () => {
			const response = {};
			const items = extractItemsFromResponse(response, 'd.results');
			// Empty object is wrapped in array
			expect(Array.isArray(items)).toBe(true);
		});
	});

	describe('Null and Undefined Field Handling', () => {
		it('should handle entities with null fields', () => {
			const response = {
				d: {
					results: [
						{ ID: '1', Name: null, Description: null },
						{ ID: '2', Name: 'Test', Description: undefined },
					],
				},
			};
			const items = extractItemsFromResponse(response, 'd.results');
			expect(items).toHaveLength(2);
			expect(items[0].Name).toBeNull();
			expect(items[0].Description).toBeNull();
			expect(items[1].Name).toBe('Test');
		});

		it('should handle mixed null/undefined in filter values', () => {
			const filters = {
				Name: 'Test',
				Description: null,
				Status: undefined,
				Active: '',
			};
			const filter = buildODataFilter(filters);
			// Should only include non-null/undefined/empty values
			expect(filter).toBe("Name eq 'Test'");
		});
	});

	describe('Very Long String Handling', () => {
		it('should escape very long strings with quotes', () => {
			const longString = "O'Brien ".repeat(100); // 800+ chars with quotes
			const filter = buildODataFilter({ Name: longString.trim() });
			expect(filter).toContain("Name eq 'O''Brien");
			expect(filter).toContain("''Brien"); // Verify quotes are doubled
		});

		it('should handle strings with multiple consecutive quotes', () => {
			const multiQuotes = "Test'''String";
			const filter = buildODataFilter({ Name: multiQuotes });
			expect(filter).toBe("Name eq 'Test''''''String'");
		});

		it('should validate entity key with long composite key', () => {
			const longKey = "Key1='aaaaaaaaaa',Key2='bbbbbbbbbb',Key3='cccccccccc'";
			// Should not throw for long but valid keys
			expect(() => validateEntityKey(longKey, mockNode)).not.toThrow();
		});
	});

	describe('Special Character Handling', () => {
		it('should handle Unicode characters in entity values', () => {
			const response = {
				d: {
					results: [
						{ ID: '1', Name: '中文测试', Description: 'Тест кириллица' },
						{ ID: '2', Name: 'عربي', Description: '日本語テスト' },
					],
				},
			};
			const items = extractItemsFromResponse(response, 'd.results');
			expect(items).toHaveLength(2);
			expect(items[0].Name).toBe('中文测试');
			expect(items[1].Name).toBe('عربي');
		});

		it('should handle newlines and tabs in filter values', () => {
			const value = 'Line1\nLine2\tTabbed';
			const filter = buildODataFilter({ Description: value });
			expect(filter).toContain('Line1\nLine2\tTabbed');
		});

		it('should handle backslashes in filter values', () => {
			const value = 'C:\\Path\\To\\File';
			const filter = buildODataFilter({ Path: value });
			expect(filter).toBe("Path eq 'C:\\Path\\To\\File'");
		});
	});

	describe('Numeric Edge Cases', () => {
		it('should handle zero values', () => {
			const filter = buildODataFilter({ Count: 0, Price: 0.0 });
			expect(filter).toBe('Count eq 0 and Price eq 0');
		});

		it('should handle negative numbers', () => {
			const filter = buildODataFilter({ Temperature: -273.15, Balance: -1000 });
			expect(filter).toBe('Temperature eq -273.15 and Balance eq -1000');
		});

		it('should handle very large numbers', () => {
			const filter = buildODataFilter({ BigNumber: Number.MAX_SAFE_INTEGER });
			expect(filter).toContain(`BigNumber eq ${Number.MAX_SAFE_INTEGER}`);
		});

		it('should handle floating point precision', () => {
			const filter = buildODataFilter({ Price: 19.99, Tax: 1.575 });
			expect(filter).toBe('Price eq 19.99 and Tax eq 1.575');
		});
	});

	describe('Boolean Edge Cases', () => {
		it('should handle boolean true/false', () => {
			const filter = buildODataFilter({ Active: true, Deleted: false });
			expect(filter).toBe('Active eq true and Deleted eq false');
		});

		it('should handle boolean with other types', () => {
			const filter = buildODataFilter({
				Name: 'Test',
				Active: true,
				Count: 5,
			});
			expect(filter).toBe("Name eq 'Test' and Active eq true and Count eq 5");
		});
	});

	describe('Pagination Edge Cases', () => {
		it('should handle nextLink with special characters', () => {
			const response = {
				d: {
					results: [{ ID: '1' }],
					__next: "/ProductSet?$filter=Name eq 'O''Brien'&$skip=100",
				},
			};
			const nextLink = extractNextLink(response);
			expect(nextLink).toBe("/ProductSet?$filter=Name eq 'O''Brien'&$skip=100");
		});

		it('should handle V4 @odata.nextLink with encoded characters', () => {
			const response = {
				value: [{ ID: '1' }],
				'@odata.nextLink': '/ProductSet?$filter=Name%20eq%20%27Test%27',
			};
			const nextLink = extractNextLink(response);
			expect(nextLink).toBe('/ProductSet?$filter=Name%20eq%20%27Test%27');
		});

		it('should handle missing nextLink gracefully', () => {
			const response = { d: { results: [{ ID: '1' }] } };
			const nextLink = extractNextLink(response);
			expect(nextLink).toBeUndefined();
		});

		it('should handle single item without array wrapper', () => {
			const response = { d: { ID: '1', Name: 'Single' } };
			const items = extractItemsFromResponse(response, 'd');
			// Single item should be wrapped in array
			expect(Array.isArray(items)).toBe(true);
			expect(items).toHaveLength(1);
			expect(items[0].ID).toBe('1');
		});
	});

	describe('Malformed Data Handling', () => {
		it('should handle response without expected structure', () => {
			const response = { unexpected: 'structure' };
			const items = extractItemsFromResponse(response, 'd.results');
			// Falls back to wrapping the whole response
			expect(Array.isArray(items)).toBe(true);
		});

		it('should handle deeply nested response', () => {
			const response = {
				d: {
					outer: {
						inner: {
							results: [{ ID: '1' }],
						},
					},
				},
			};
			// Should not find results in wrong location, returns d property
			const items = extractItemsFromResponse(response, 'd.results');
			expect(Array.isArray(items)).toBe(true);
		});

		it('should handle array containing non-objects', () => {
			const response = {
				d: {
					results: ['string1', 'string2', 123, null],
				},
			};
			const items = extractItemsFromResponse(response, 'd.results');
			// Should return the array as-is even with mixed types
			expect(items).toHaveLength(4);
		});
	});

	describe('Entity Key Edge Cases', () => {
		it('should handle composite key with special characters in values', () => {
			const key = "ProductID='ABC-123',CompanyCode='US-01'";
			const validated = validateEntityKey(key, mockNode);
			expect(validated).toBe(key);
		});

		it('should reject SQL injection patterns in keys', () => {
			const maliciousKey = "123' OR '1'='1";
			expect(() => validateEntityKey(maliciousKey, mockNode)).toThrow();
		});

		it('should reject comment markers in keys', () => {
			const maliciousKey = "123'; --";
			expect(() => validateEntityKey(maliciousKey, mockNode)).toThrow(
				'Contains forbidden pattern',
			);
		});

		it('should handle GUID-style keys', () => {
			const guidKey = "12345678-1234-1234-1234-123456789abc";
			const validated = validateEntityKey(guidKey, mockNode);
			expect(validated).toBe(guidKey);
		});
	});

	describe('Filter Combination Edge Cases', () => {
		it('should handle filter with all empty values', () => {
			const filter = buildODataFilter({
				Field1: null,
				Field2: undefined,
				Field3: '',
			});
			expect(filter).toBe('');
		});

		it('should handle single field filter', () => {
			const filter = buildODataFilter({ Status: 'Active' });
			expect(filter).toBe("Status eq 'Active'");
		});

		it('should handle many fields (50+)', () => {
			const filters: any = {};
			for (let i = 0; i < 50; i++) {
				filters[`Field${i}`] = `Value${i}`;
			}
			const filter = buildODataFilter(filters);
			expect(filter).toContain(' and ');
			expect(filter.split(' and ')).toHaveLength(50);
		});
	});
});
