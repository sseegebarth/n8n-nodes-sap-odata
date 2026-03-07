import {
	convertSapDate,
	convertSapTime,
	convertValue,
	convertDataTypes,
	removeMetadata,
	unwrapNavigationProperties,
	convertToSapV2Format,
} from '../lib/utils/TypeConverter';

describe('TypeConverter', () => {
	describe('convertSapDate', () => {
		it('should convert SAP date format to ISO string', () => {
			const result = convertSapDate('/Date(1507248000000)/');
			expect(result).toBe('2017-10-06T00:00:00.000Z');
		});

		it('should handle SAP date with timezone offset', () => {
			const result = convertSapDate('/Date(1507248000000+0000)/');
			expect(result).toBe('2017-10-06T00:00:00.000Z');
		});

		it('should return null for invalid format', () => {
			expect(convertSapDate('2017-10-06')).toBeNull();
			expect(convertSapDate('')).toBeNull();
			expect(convertSapDate(null as any)).toBeNull();
		});
	});

	describe('convertSapTime', () => {
		it('should convert full ISO duration to HH:MM:SS', () => {
			expect(convertSapTime('PT14H30M00S')).toBe('14:30:00');
		});

		it('should handle hours and minutes only', () => {
			expect(convertSapTime('PT2H30M')).toBe('02:30:00');
		});

		it('should handle minutes only', () => {
			expect(convertSapTime('PT5M')).toBe('00:05:00');
		});

		it('should handle seconds only', () => {
			expect(convertSapTime('PT30S')).toBe('00:00:30');
		});

		it('should handle hours only', () => {
			expect(convertSapTime('PT2H')).toBe('02:00:00');
		});

		it('should return null for invalid time values', () => {
			expect(convertSapTime('PT25H')).toBeNull();
			expect(convertSapTime('PT60M')).toBeNull();
			expect(convertSapTime('')).toBeNull();
			expect(convertSapTime('invalid')).toBeNull();
		});
	});

	describe('convertValue', () => {
		it('should convert SAP dates in strings', () => {
			expect(convertValue('/Date(1507248000000)/')).toBe('2017-10-06T00:00:00.000Z');
		});

		it('should convert SAP time strings', () => {
			expect(convertValue('PT14H30M00S')).toBe('14:30:00');
		});

		it('should convert numeric strings to numbers', () => {
			expect(convertValue('175.50')).toBe(175.5);
			expect(convertValue('0')).toBe(0);
			expect(convertValue('9170.00')).toBe(9170);
		});

		it('should not convert non-numeric strings', () => {
			expect(convertValue('Hello')).toBe('Hello');
			expect(convertValue('2017-10-06')).toBe('2017-10-06');
		});

		it('should handle null and undefined', () => {
			expect(convertValue(null)).toBeNull();
			expect(convertValue(undefined)).toBeUndefined();
		});

		it('should preserve booleans and numbers', () => {
			expect(convertValue(true)).toBe(true);
			expect(convertValue(42)).toBe(42);
		});

		it('should recursively convert arrays', () => {
			const result = convertValue(['/Date(1507248000000)/', '175.50', 'text']);
			expect(result).toEqual(['2017-10-06T00:00:00.000Z', 175.5, 'text']);
		});

		it('should recursively convert objects', () => {
			const result = convertValue({
				Amount: '175.50',
				Date: '/Date(1507248000000)/',
				Name: 'Acme',
			});
			expect(result).toEqual({
				Amount: 175.5,
				Date: '2017-10-06T00:00:00.000Z',
				Name: 'Acme',
			});
		});

		it('should preserve __metadata and __deferred as-is', () => {
			const result = convertValue({
				Name: 'Test',
				__metadata: { uri: '/some/path', type: 'Entity' },
				__deferred: { uri: '/lazy/load' },
			});
			expect(result.__metadata).toEqual({ uri: '/some/path', type: 'Entity' });
			expect(result.__deferred).toEqual({ uri: '/lazy/load' });
		});

		it('should handle nested expanded navigation properties', () => {
			const result = convertValue({
				OrderID: '100',
				Items: [
					{ MaterialID: 'MAT-001', Amount: '50.00' },
					{ MaterialID: 'MAT-002', Amount: '25.00' },
				],
			});
			expect(result).toEqual({
				OrderID: 100,
				Items: [
					{ MaterialID: 'MAT-001', Amount: 50 },
					{ MaterialID: 'MAT-002', Amount: 25 },
				],
			});
		});
	});

	describe('convertDataTypes', () => {
		it('should be an alias for convertValue', () => {
			const input = { Amount: '175.50' };
			expect(convertDataTypes(input)).toEqual(convertValue(input));
		});
	});

	describe('removeMetadata', () => {
		it('should remove __metadata from objects', () => {
			const result = removeMetadata({
				Name: 'Test',
				__metadata: { uri: '/path', type: 'Type' },
			});
			expect(result).toEqual({ Name: 'Test' });
			expect(result.__metadata).toBeUndefined();
		});

		it('should remove __deferred from objects', () => {
			const result = removeMetadata({
				Name: 'Test',
				__deferred: { uri: '/lazy' },
			});
			expect(result).toEqual({ Name: 'Test' });
		});

		it('should recursively clean nested objects', () => {
			const result = removeMetadata({
				OrderID: '100',
				Items: {
					results: [
						{ MaterialID: 'A', __metadata: { uri: '...' } },
						{ MaterialID: 'B', __metadata: { uri: '...' } },
					],
				},
			});
			expect(result.Items.results[0].__metadata).toBeUndefined();
			expect(result.Items.results[0].MaterialID).toBe('A');
		});

		it('should handle null and undefined', () => {
			expect(removeMetadata(null)).toBeNull();
			expect(removeMetadata(undefined)).toBeUndefined();
		});

		it('should handle arrays', () => {
			const result = removeMetadata([
				{ Name: 'A', __metadata: {} },
				{ Name: 'B', __metadata: {} },
			]);
			expect(result).toEqual([{ Name: 'A' }, { Name: 'B' }]);
		});

		it('should preserve expanded navigation properties', () => {
			const result = removeMetadata({
				ID: '1',
				invoice: { ID: 'INV-1', amount: 100 },
				customer: { ID: 'CUST-1', name: 'Acme' },
			});
			expect(result.invoice).toEqual({ ID: 'INV-1', amount: 100 });
			expect(result.customer).toEqual({ ID: 'CUST-1', name: 'Acme' });
		});
	});

	describe('unwrapNavigationProperties', () => {
		it('should unwrap V2 navigation property wrapper', () => {
			const result = unwrapNavigationProperties({
				OrderID: '500',
				to_Items: { results: [{ ItemNumber: '10' }, { ItemNumber: '20' }] },
			});
			expect(result).toEqual({
				OrderID: '500',
				to_Items: [{ ItemNumber: '10' }, { ItemNumber: '20' }],
			});
		});

		it('should unwrap wrapper with __count', () => {
			const result = unwrapNavigationProperties({
				to_Items: { results: [{ A: 1 }], __count: '1' },
			});
			expect(result).toEqual({ to_Items: [{ A: 1 }] });
		});

		it('should not modify V4 arrays (no wrapper)', () => {
			const input = { Items: [{ A: 1 }, { A: 2 }] };
			const result = unwrapNavigationProperties(input);
			expect(result).toEqual(input);
		});

		it('should unwrap nested navigation properties', () => {
			const result = unwrapNavigationProperties({
				to_Items: {
					results: [
						{ ItemNumber: '10', to_SubItems: { results: [{ Sub: 'A' }] } },
					],
				},
			});
			expect(result).toEqual({
				to_Items: [{ ItemNumber: '10', to_SubItems: [{ Sub: 'A' }] }],
			});
		});

		it('should not unwrap objects where results is not an array', () => {
			const input = { query: { results: 'success', count: 5 } };
			const result = unwrapNavigationProperties(input);
			expect(result).toEqual(input);
		});

		it('should handle null and undefined', () => {
			expect(unwrapNavigationProperties(null)).toBeNull();
			expect(unwrapNavigationProperties(undefined)).toBeUndefined();
		});

		it('should unwrap empty results array', () => {
			const result = unwrapNavigationProperties({
				to_Items: { results: [] },
			});
			expect(result).toEqual({ to_Items: [] });
		});
	});

	describe('convertToSapV2Format', () => {
		it('should convert ISO datetime to /Date()/', () => {
			expect(convertToSapV2Format('2017-10-06T00:00:00.000Z')).toBe('/Date(1507248000000)/');
		});

		it('should convert ISO datetime with timezone offset', () => {
			const result = convertToSapV2Format('2017-10-06T02:00:00+02:00');
			expect(result).toBe(`/Date(${Date.parse('2017-10-06T02:00:00+02:00')})/`);
		});

		it('should convert HH:MM:SS time to PT duration', () => {
			expect(convertToSapV2Format('14:30:00')).toBe('PT14H30M0S');
		});

		it('should convert midnight time', () => {
			expect(convertToSapV2Format('00:00:00')).toBe('PT0H0M0S');
		});

		it('should recursively convert nested objects', () => {
			const result = convertToSapV2Format({
				CreationDate: '2017-10-06T00:00:00.000Z',
				StartTime: '14:30:00',
				Name: 'Test',
				Amount: 175.5,
			});
			expect(result).toEqual({
				CreationDate: '/Date(1507248000000)/',
				StartTime: 'PT14H30M0S',
				Name: 'Test',
				Amount: 175.5,
			});
		});

		it('should not convert plain date strings without T separator', () => {
			expect(convertToSapV2Format('2017-10-06')).toBe('2017-10-06');
		});

		it('should not convert non-date strings', () => {
			expect(convertToSapV2Format('Hello')).toBe('Hello');
			expect(convertToSapV2Format('MAT-001')).toBe('MAT-001');
		});

		it('should preserve numbers and booleans', () => {
			expect(convertToSapV2Format(42)).toBe(42);
			expect(convertToSapV2Format(true)).toBe(true);
		});

		it('should handle null and undefined', () => {
			expect(convertToSapV2Format(null)).toBeNull();
			expect(convertToSapV2Format(undefined)).toBeUndefined();
		});

		it('should skip __metadata and __deferred', () => {
			const result = convertToSapV2Format({
				Name: 'Test',
				Date: '2017-10-06T00:00:00.000Z',
				__metadata: { uri: '/path', type: 'Entity' },
				__deferred: { uri: '/lazy' },
			});
			expect(result.Date).toBe('/Date(1507248000000)/');
			expect(result.__metadata).toEqual({ uri: '/path', type: 'Entity' });
			expect(result.__deferred).toEqual({ uri: '/lazy' });
		});
	});
});
