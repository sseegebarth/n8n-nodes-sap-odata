import {
	escapeODataString,
	normalizeODataOptions,
	buildODataQuery,
	buildEncodedQueryString,
	parseMetadataForEntitySets,
	parseMetadataForFunctionImports,
} from '../lib/core/QueryBuilder';

describe('QueryBuilder', () => {
	describe('escapeODataString', () => {
		it('should escape single quotes by doubling them', () => {
			expect(escapeODataString("O'Brien")).toBe("O''Brien");
		});

		it('should handle multiple single quotes', () => {
			expect(escapeODataString("it's a test's value")).toBe("it''s a test''s value");
		});

		it('should return unchanged string without quotes', () => {
			expect(escapeODataString('Hello World')).toBe('Hello World');
		});

		it('should handle empty string', () => {
			expect(escapeODataString('')).toBe('');
		});
	});

	describe('normalizeODataOptions', () => {
		it('should add $ prefix to standard parameters', () => {
			const result = normalizeODataOptions({
				filter: "Name eq 'John'",
				select: 'Name,Age',
				top: 10,
			});
			expect(result).toEqual({
				$filter: "Name eq 'John'",
				$select: 'Name,Age',
				$top: 10,
			});
		});

		it('should keep existing $ prefix', () => {
			const result = normalizeODataOptions({
				$filter: "Name eq 'John'",
				$top: 5,
			});
			expect(result).toEqual({
				$filter: "Name eq 'John'",
				$top: 5,
			});
		});

		it('should skip null, undefined, and empty values', () => {
			const result = normalizeODataOptions({
				filter: "Name eq 'John'",
				select: '',
				top: null,
				skip: undefined,
			});
			expect(result).toEqual({
				$filter: "Name eq 'John'",
			});
		});
	});

	describe('buildODataQuery', () => {
		it('should build query with $select as comma-separated string', () => {
			const result = buildODataQuery({
				$select: ['Name', 'Age', 'City'] as any,
			});
			expect(result.$select).toBe('Name,Age,City');
		});

		it('should keep $select string as-is', () => {
			const result = buildODataQuery({ $select: 'Name,Age' });
			expect(result.$select).toBe('Name,Age');
		});

		it('should handle $expand as array', () => {
			const result = buildODataQuery({
				$expand: ['ToItems', 'ToPartner'] as any,
			});
			expect(result.$expand).toBe('ToItems,ToPartner');
		});

		it('should keep $expand string as-is', () => {
			const result = buildODataQuery({ $expand: 'ToItems' });
			expect(result.$expand).toBe('ToItems');
		});

		it('should pass through $top, $skip, $orderby', () => {
			const result = buildODataQuery({
				$top: 10,
				$skip: 20,
				$orderby: 'Name asc',
			});
			expect(result.$top).toBe(10);
			expect(result.$skip).toBe(20);
			expect(result.$orderby).toBe('Name asc');
		});

		it('should handle $count', () => {
			const result = buildODataQuery({ $count: true });
			expect(result.$count).toBe(true);
		});

		it('should handle $search and $apply', () => {
			const result = buildODataQuery({
				$search: 'laptop',
				$apply: 'groupby((Category))',
			});
			expect(result.$search).toBe('laptop');
			expect(result.$apply).toBe('groupby((Category))');
		});

		it('should normalize keys without $ prefix', () => {
			const result = buildODataQuery({
				expand: 'invoice,customer',
				top: 50,
			} as any);
			expect(result.$expand).toBe('invoice,customer');
			expect(result.$top).toBe(50);
		});

		it('should return empty object for empty options', () => {
			const result = buildODataQuery({});
			expect(result).toEqual({});
		});
	});

	describe('buildEncodedQueryString', () => {
		it('should encode parameters', () => {
			const result = buildEncodedQueryString({ Name: "O'Brien", Age: 25 });
			expect(result).toContain("Name=O'Brien");
			expect(result).toContain('Age=25');
		});

		it('should use custom separator', () => {
			const result = buildEncodedQueryString({ ID: '100', Type: 'A' }, ',');
			expect(result).toBe('ID=100,Type=A');
		});

		it('should skip empty values', () => {
			const result = buildEncodedQueryString({
				Name: 'John',
				Empty: '',
				Null: null,
				Undef: undefined,
			});
			expect(result).toBe('Name=John');
		});

		it('should return empty string for empty object', () => {
			expect(buildEncodedQueryString({})).toBe('');
		});
	});

	describe('parseMetadataForEntitySets', () => {
		it('should extract EntitySet names from metadata XML', () => {
			const xml = `
				<EntityContainer>
					<EntitySet Name="Products" EntityType="Product"/>
					<EntitySet Name="Customers" EntityType="Customer"/>
					<EntitySet Name="Orders" EntityType="Order"/>
				</EntityContainer>
			`;
			const result = parseMetadataForEntitySets(xml);
			expect(result).toEqual(['Customers', 'Orders', 'Products']);
		});

		it('should return empty array for XML without EntitySets', () => {
			expect(parseMetadataForEntitySets('<Schema/>')).toEqual([]);
		});
	});

	describe('parseMetadataForFunctionImports', () => {
		it('should extract FunctionImport names from metadata XML', () => {
			const xml = `
				<EntityContainer>
					<FunctionImport Name="GetStock" ReturnType="Collection(Product)"/>
					<FunctionImport Name="CalculatePrice" ReturnType="Decimal"/>
				</EntityContainer>
			`;
			const result = parseMetadataForFunctionImports(xml);
			expect(result).toEqual(['CalculatePrice', 'GetStock']);
		});

		it('should return empty array for XML without FunctionImports', () => {
			expect(parseMetadataForFunctionImports('<Schema/>')).toEqual([]);
		});
	});
});
