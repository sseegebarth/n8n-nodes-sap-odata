import {
	buildODataQuery,
	buildODataFilter,
	parseMetadataForEntitySets,
	parseMetadataForFunctionImports,
} from '../nodes/Sap/GenericFunctions';

describe('GenericFunctions', () => {
	describe('buildODataQuery', () => {
		it('should build query with filter', () => {
			const result = buildODataQuery({ $filter: "Status eq 'A'" });
			expect(result).toEqual({ $filter: "Status eq 'A'" });
		});

		it('should build query with select', () => {
			const result = buildODataQuery({ $select: 'Name,Price' });
			expect(result).toEqual({ $select: 'Name,Price' });
		});

		it('should build query with array select', () => {
			const result = buildODataQuery({ $select: ['Name', 'Price'] });
			expect(result).toEqual({ $select: 'Name,Price' });
		});

		it('should build query with expand', () => {
			const result = buildODataQuery({ $expand: 'ToItems' });
			expect(result).toEqual({ $expand: 'ToItems' });
		});

		it('should build query with orderby', () => {
			const result = buildODataQuery({ $orderby: 'CreatedAt desc' });
			expect(result).toEqual({ $orderby: 'CreatedAt desc' });
		});

		it('should build query with top and skip', () => {
			const result = buildODataQuery({ $top: 10, $skip: 20 });
			expect(result).toEqual({ $top: 10, $skip: 20 });
		});

		it('should build query with count', () => {
			const result = buildODataQuery({ $count: true });
			expect(result).toEqual({ $count: true });
		});

		it('should build query with multiple options', () => {
			const result = buildODataQuery({
				$filter: "Status eq 'A'",
				$select: 'Name,Price',
				$orderby: 'Name',
				$top: 5,
			});
			expect(result).toEqual({
				$filter: "Status eq 'A'",
				$select: 'Name,Price',
				$orderby: 'Name',
				$top: 5,
			});
		});

		it('should return empty object for no options', () => {
			const result = buildODataQuery({});
			expect(result).toEqual({});
		});

		it('should normalize non-prefixed parameters (filter -> $filter)', () => {
			const result = buildODataQuery({
				filter: "Status eq 'A'",
				select: 'Name,Price',
				orderby: 'Name',
				top: 5,
			} as any);
			expect(result).toEqual({
				$filter: "Status eq 'A'",
				$select: 'Name,Price',
				$orderby: 'Name',
				$top: 5,
			});
		});

		it('should handle mixed prefixed and non-prefixed parameters', () => {
			const result = buildODataQuery({
				$filter: "Status eq 'A'",
				select: 'Name,Price', // non-prefixed
				$orderby: 'Name',
				top: 5, // non-prefixed
			} as any);
			expect(result).toEqual({
				$filter: "Status eq 'A'",
				$select: 'Name,Price',
				$orderby: 'Name',
				$top: 5,
			});
		});

		it('should normalize search and apply parameters', () => {
			const result = buildODataQuery({
				search: 'blue',
				apply: 'groupby((Category))',
			} as any);
			expect(result).toEqual({
				$search: 'blue',
				$apply: 'groupby((Category))',
			});
		});
	});

	describe('buildODataFilter', () => {
		it('should build filter with string value', () => {
			const result = buildODataFilter({ Status: 'A' });
			expect(result).toBe("Status eq 'A'");
		});

		it('should build filter with number value', () => {
			const result = buildODataFilter({ Price: 100 });
			expect(result).toBe('Price eq 100');
		});

		it('should build filter with boolean value', () => {
			const result = buildODataFilter({ Active: true });
			expect(result).toBe('Active eq true');
		});

		it('should build filter with multiple values', () => {
			const result = buildODataFilter({ Status: 'A', Price: 100 });
			expect(result).toContain("Status eq 'A'");
			expect(result).toContain('Price eq 100');
			expect(result).toContain(' and ');
		});

		it('should ignore undefined values', () => {
			const result = buildODataFilter({ Status: 'A', Price: undefined });
			expect(result).toBe("Status eq 'A'");
		});

		it('should ignore null values', () => {
			const result = buildODataFilter({ Status: 'A', Price: null });
			expect(result).toBe("Status eq 'A'");
		});

		it('should ignore empty string values', () => {
			const result = buildODataFilter({ Status: 'A', Price: '' });
			expect(result).toBe("Status eq 'A'");
		});

		it('should escape single quotes in string values', () => {
		const result = buildODataFilter({ Name: "O'Brien" });
		expect(result).toBe("Name eq 'O''Brien'");
	});

	it('should escape multiple single quotes', () => {
		const result = buildODataFilter({ Description: "It's a 'test' value" });
		expect(result).toBe("Description eq 'It''s a ''test'' value'");
	});

	it('should throw error for object values', () => {
		expect(() => buildODataFilter({ Data: { nested: 'value' } })).toThrow(
			"Invalid filter value type for key 'Data': Objects and arrays are not supported",
		);
	});

	it('should throw error for array values', () => {
		expect(() => buildODataFilter({ Tags: ['tag1', 'tag2'] })).toThrow(
			"Invalid filter value type for key 'Tags': Objects and arrays are not supported",
		);
	});

	it('should return empty string for no values', () => {
			const result = buildODataFilter({});
			expect(result).toBe('');
		});
	});

	describe('parseMetadataForEntitySets', () => {
		it('should parse entity sets from metadata XML', () => {
			const metadata = `
				<?xml version="1.0" encoding="utf-8"?>
				<edmx:Edmx Version="1.0">
					<EntityContainer>
						<EntitySet Name="ProductSet" EntityType="Product"/>
						<EntitySet Name="SalesOrderSet" EntityType="SalesOrder"/>
						<EntitySet Name="CustomerSet" EntityType="Customer"/>
					</EntityContainer>
				</edmx:Edmx>
			`;
			const result = parseMetadataForEntitySets(metadata);
			expect(result).toEqual(['CustomerSet', 'ProductSet', 'SalesOrderSet']);
		});

		it('should return empty array for no entity sets', () => {
			const metadata = `<?xml version="1.0" encoding="utf-8"?><edmx:Edmx></edmx:Edmx>`;
			const result = parseMetadataForEntitySets(metadata);
			expect(result).toEqual([]);
		});

		it('should handle single entity set', () => {
			const metadata = `<EntitySet Name="ProductSet" EntityType="Product"/>`;
			const result = parseMetadataForEntitySets(metadata);
			expect(result).toEqual(['ProductSet']);
		});
	});

	describe('parseMetadataForFunctionImports', () => {
		it('should parse function imports from metadata XML', () => {
			const metadata = `
				<?xml version="1.0" encoding="utf-8"?>
				<edmx:Edmx Version="1.0">
					<EntityContainer>
						<FunctionImport Name="GetSalesOrder" ReturnType="SalesOrder"/>
						<FunctionImport Name="CreateOrder" ReturnType="Order"/>
						<FunctionImport Name="CalculatePrice" ReturnType="Decimal"/>
					</EntityContainer>
				</edmx:Edmx>
			`;
			const result = parseMetadataForFunctionImports(metadata);
			expect(result).toEqual(['CalculatePrice', 'CreateOrder', 'GetSalesOrder']);
		});

		it('should return empty array for no function imports', () => {
			const metadata = `<?xml version="1.0" encoding="utf-8"?><edmx:Edmx></edmx:Edmx>`;
			const result = parseMetadataForFunctionImports(metadata);
			expect(result).toEqual([]);
		});

		it('should handle single function import', () => {
			const metadata = `<FunctionImport Name="GetSalesOrder" ReturnType="SalesOrder"/>`;
			const result = parseMetadataForFunctionImports(metadata);
			expect(result).toEqual(['GetSalesOrder']);
		});
	});
});
