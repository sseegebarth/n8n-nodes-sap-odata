/**
 * QueryBuilder Tests
 */

import {
	buildODataQuery,
	buildODataFilter,
	escapeODataString,
	normalizeODataOptions,
	parseMetadataForEntitySets,
	parseMetadataForFunctionImports,
} from '../../nodes/Shared/core/QueryBuilder';

describe('QueryBuilder', () => {
	describe('escapeODataString', () => {
		it('should escape single quotes', () => {
			expect(escapeODataString("O'Brien")).toBe("O''Brien");
		});

		it('should handle multiple single quotes', () => {
			expect(escapeODataString("It's Bob's")).toBe("It''s Bob''s");
		});

		it('should return unchanged if no quotes', () => {
			expect(escapeODataString('Hello World')).toBe('Hello World');
		});

		it('should handle empty string', () => {
			expect(escapeODataString('')).toBe('');
		});
	});

	describe('buildODataFilter', () => {
		it('should build filter for string value', () => {
			const result = buildODataFilter({ Name: 'John' });
			expect(result).toBe("Name eq 'John'");
		});

		it('should build filter for number value', () => {
			const result = buildODataFilter({ Age: 25 });
			expect(result).toBe('Age eq 25');
		});

		it('should build filter for boolean value', () => {
			const result = buildODataFilter({ IsActive: true });
			expect(result).toBe('IsActive eq true');
		});

		it('should build filter with multiple fields', () => {
			const result = buildODataFilter({ Name: 'John', Age: 25, IsActive: true });
			expect(result).toContain("Name eq 'John'");
			expect(result).toContain('Age eq 25');
			expect(result).toContain('IsActive eq true');
			expect(result).toContain(' and ');
		});

		it('should escape single quotes in string values', () => {
			const result = buildODataFilter({ Name: "O'Brien" });
			expect(result).toBe("Name eq 'O''Brien'");
		});

		it('should skip undefined values', () => {
			const result = buildODataFilter({ Name: 'John', Age: undefined });
			expect(result).toBe("Name eq 'John'");
		});

		it('should skip null values', () => {
			const result = buildODataFilter({ Name: 'John', Age: null });
			expect(result).toBe("Name eq 'John'");
		});

		it('should skip empty string values', () => {
			const result = buildODataFilter({ Name: 'John', Title: '' });
			expect(result).toBe("Name eq 'John'");
		});

		it('should throw error for object values', () => {
			expect(() => {
				buildODataFilter({ Data: { nested: 'value' } });
			}).toThrow(/Invalid filter value type/);
		});

		it('should throw error for array values', () => {
			expect(() => {
				buildODataFilter({ Items: ['a', 'b'] });
			}).toThrow(/Invalid filter value type/);
		});

		it('should return empty string for empty filter', () => {
			const result = buildODataFilter({});
			expect(result).toBe('');
		});
	});

	describe('normalizeODataOptions', () => {
		it('should add $ prefix to standard parameters', () => {
			const result = normalizeODataOptions({ filter: "Name eq 'John'", top: 10 });
			expect(result).toEqual({ $filter: "Name eq 'John'", $top: 10 });
		});

		it('should keep $ prefix if already present', () => {
			const result = normalizeODataOptions({ $filter: "Name eq 'John'", $top: 10 });
			expect(result).toEqual({ $filter: "Name eq 'John'", $top: 10 });
		});

		it('should handle mixed prefix styles', () => {
			const result = normalizeODataOptions({ filter: "Name eq 'John'", $top: 10 });
			expect(result).toEqual({ $filter: "Name eq 'John'", $top: 10 });
		});

		it('should skip undefined values', () => {
			const result = normalizeODataOptions({ filter: "Name eq 'John'", top: undefined });
			expect(result).toEqual({ $filter: "Name eq 'John'" });
		});

		it('should skip null values', () => {
			const result = normalizeODataOptions({ filter: "Name eq 'John'", top: null });
			expect(result).toEqual({ $filter: "Name eq 'John'" });
		});

		it('should skip empty string values', () => {
			const result = normalizeODataOptions({ filter: "Name eq 'John'", top: '' });
			expect(result).toEqual({ $filter: "Name eq 'John'" });
		});
	});

	describe('buildODataQuery', () => {
		it('should build query with $filter', () => {
			const result = buildODataQuery({ $filter: "Name eq 'John'" });
			expect(result).toEqual({ $filter: "Name eq 'John'" });
		});

		it('should normalize filter parameter without $ prefix', () => {
			const result = buildODataQuery({ filter: "Name eq 'John'" } as any);
			expect(result).toEqual({ $filter: "Name eq 'John'" });
		});

		it('should build query with $select as array', () => {
			const result = buildODataQuery({ $select: ['Name', 'Age'] });
			expect(result).toEqual({ $select: 'Name,Age' });
		});

		it('should build query with $select as string', () => {
			const result = buildODataQuery({ $select: 'Name,Age' });
			expect(result).toEqual({ $select: 'Name,Age' });
		});

		it('should build query with $expand', () => {
			const result = buildODataQuery({ $expand: ['Orders', 'Address'] });
			expect(result).toEqual({ $expand: 'Orders,Address' });
		});

		it('should build query with $orderby', () => {
			const result = buildODataQuery({ $orderby: 'Name asc' });
			expect(result).toEqual({ $orderby: 'Name asc' });
		});

		it('should build query with $top', () => {
			const result = buildODataQuery({ $top: 10 });
			expect(result).toEqual({ $top: 10 });
		});

		it('should build query with $skip', () => {
			const result = buildODataQuery({ $skip: 20 });
			expect(result).toEqual({ $skip: 20 });
		});

		it('should build query with $count', () => {
			const result = buildODataQuery({ $count: true });
			expect(result).toEqual({ $count: true });
		});

		it('should build query with $search', () => {
			const result = buildODataQuery({ $search: 'blue OR green' });
			expect(result).toEqual({ $search: 'blue OR green' });
		});

		it('should build query with $apply', () => {
			const result = buildODataQuery({ $apply: 'groupby((Country))' });
			expect(result).toEqual({ $apply: 'groupby((Country))' });
		});

		it('should build query with all parameters', () => {
			const result = buildODataQuery({
				$filter: "Name eq 'John'",
				$select: ['Name', 'Age'],
				$expand: ['Orders'],
				$orderby: 'Name asc',
				$top: 10,
				$skip: 5,
				$count: true,
				$search: 'blue',
				$apply: 'groupby((Country))',
			});

			expect(result).toEqual({
				$filter: "Name eq 'John'",
				$select: 'Name,Age',
				$expand: 'Orders',
				$orderby: 'Name asc',
				$top: 10,
				$skip: 5,
				$count: true,
				$search: 'blue',
				$apply: 'groupby((Country))',
			});
		});
	});

	describe('parseMetadataForEntitySets', () => {
		it('should extract EntitySet names from XML', () => {
			const xml = `
				<EntitySet Name="ProductSet" EntityType="ZAPI_PRODUCT.Product"/>
				<EntitySet Name="CustomerSet" EntityType="ZAPI_PRODUCT.Customer"/>
				<EntitySet Name="OrderSet" EntityType="ZAPI_PRODUCT.Order"/>
			`;
			const result = parseMetadataForEntitySets(xml);
			expect(result).toEqual(['CustomerSet', 'OrderSet', 'ProductSet']); // Sorted
		});

		it('should handle empty XML', () => {
			const result = parseMetadataForEntitySets('');
			expect(result).toEqual([]);
		});

		it('should handle XML with no EntitySets', () => {
			const xml = '<EntityType Name="Product"/>';
			const result = parseMetadataForEntitySets(xml);
			expect(result).toEqual([]);
		});

		it('should handle EntitySet with additional attributes', () => {
			const xml = '<EntitySet Name="ProductSet" EntityType="ZAPI.Product" sap:creatable="false"/>';
			const result = parseMetadataForEntitySets(xml);
			expect(result).toEqual(['ProductSet']);
		});
	});

	describe('parseMetadataForFunctionImports', () => {
		it('should extract FunctionImport names from XML', () => {
			const xml = `
				<FunctionImport Name="GetSalesOrder" ReturnType="ZAPI.SalesOrder"/>
				<FunctionImport Name="UpdateInventory" ReturnType="Edm.String"/>
				<FunctionImport Name="CalculatePrice" ReturnType="Edm.Decimal"/>
			`;
			const result = parseMetadataForFunctionImports(xml);
			expect(result).toEqual(['CalculatePrice', 'GetSalesOrder', 'UpdateInventory']); // Sorted
		});

		it('should handle empty XML', () => {
			const result = parseMetadataForFunctionImports('');
			expect(result).toEqual([]);
		});

		it('should handle XML with no FunctionImports', () => {
			const xml = '<EntityType Name="Product"/>';
			const result = parseMetadataForFunctionImports(xml);
			expect(result).toEqual([]);
		});

		it('should handle FunctionImport with additional attributes', () => {
			const xml = '<FunctionImport Name="GetData" ReturnType="Edm.String" m:HttpMethod="GET"/>';
			const result = parseMetadataForFunctionImports(xml);
			expect(result).toEqual(['GetData']);
		});
	});
});
