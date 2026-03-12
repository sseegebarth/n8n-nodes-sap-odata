import { ODataVersionHelper } from '../lib/utils/ODataVersionHelper';

describe('ODataVersionHelper', () => {
	describe('extractData', () => {
		describe('OData V2', () => {
			it('should extract collection from d.results', () => {
				const response = {
					d: {
						results: [{ ID: '1' }, { ID: '2' }],
						__count: '2',
					},
				};
				const result = ODataVersionHelper.extractData(response, 'v2');
				expect(result).toEqual([{ ID: '1' }, { ID: '2' }]);
			});

			it('should extract single entity from d', () => {
				const response = {
					d: { ID: '1', Name: 'Test' },
				};
				const result = ODataVersionHelper.extractData(response, 'v2');
				expect(result).toEqual({ ID: '1', Name: 'Test' });
			});

			it('should handle pre-processed array', () => {
				const response = [{ ID: '1' }];
				const result = ODataVersionHelper.extractData(response as any, 'v2');
				expect(result).toEqual([{ ID: '1' }]);
			});

			it('should return null for null response', () => {
				expect(ODataVersionHelper.extractData(null as any, 'v2')).toBeNull();
			});

			it('should preserve expanded navigation properties', () => {
				const response = {
					d: {
						results: [
							{
								ID: '1',
								ToItems: {
									results: [
										{ ItemID: '10', Material: 'MAT-A' },
									],
								},
							},
						],
					},
				};
				const result = ODataVersionHelper.extractData(response, 'v2');
				expect(((result as any[])[0]).ToItems.results[0].Material).toBe('MAT-A');
			});
		});

		describe('OData V4', () => {
			it('should extract collection from value', () => {
				const response = {
					'@odata.context': '$metadata#Products',
					value: [{ ID: '1' }, { ID: '2' }],
				};
				const result = ODataVersionHelper.extractData(response, 'v4');
				expect(result).toEqual([{ ID: '1' }, { ID: '2' }]);
			});

			it('should extract single entity without value', () => {
				const response = {
					'@odata.context': '$metadata#Products/$entity',
					'@odata.etag': 'W/"abc"',
					ID: '1',
					Name: 'Test',
				};
				const result = ODataVersionHelper.extractData(response, 'v4');
				expect(result).toEqual({ ID: '1', Name: 'Test' });
			});

			it('should handle pre-processed array', () => {
				const response = [{ ID: '1' }];
				const result = ODataVersionHelper.extractData(response as any, 'v4');
				expect(result).toEqual([{ ID: '1' }]);
			});

			it('should return null for null response', () => {
				expect(ODataVersionHelper.extractData(null as any, 'v4')).toBeNull();
			});

			it('should preserve expanded navigation properties', () => {
				const response = {
					'@odata.context': '$metadata#OpenItems',
					value: [
						{
							ID: 'OP-1',
							openAmount: 1000,
							invoice: { ID: 'INV-1', invoiceNumber: 'RE-2024-0001' },
							customer: { ID: 'CUST-1', companyName: 'Acme' },
						},
					],
				};
				const result = ODataVersionHelper.extractData(response, 'v4');
				expect(((result as any[])[0]).invoice.invoiceNumber).toBe('RE-2024-0001');
				expect(((result as any[])[0]).customer.companyName).toBe('Acme');
			});
		});
	});

	describe('getVersionSpecificParams', () => {
		it('should map count to $count for V4', () => {
			const result = ODataVersionHelper.getVersionSpecificParams('v4', {
				count: true,
			});
			expect(result.$count).toBe(true);
			expect(result.count).toBeUndefined();
		});

		it('should map count to $inlinecount for V2', () => {
			const result = ODataVersionHelper.getVersionSpecificParams('v2', {
				count: true,
			});
			expect(result.$inlinecount).toBe('allpages');
			expect(result.count).toBeUndefined();
		});

		it('should map includeCount for V4', () => {
			const result = ODataVersionHelper.getVersionSpecificParams('v4', {
				includeCount: true,
			});
			expect(result.$count).toBe(true);
			expect(result.includeCount).toBeUndefined();
		});

		it('should map includeCount for V2', () => {
			const result = ODataVersionHelper.getVersionSpecificParams('v2', {
				includeCount: true,
			});
			expect(result.$inlinecount).toBe('allpages');
			expect(result.includeCount).toBeUndefined();
		});

		it('should preserve other parameters', () => {
			const result = ODataVersionHelper.getVersionSpecificParams('v4', {
				$filter: "Name eq 'Test'",
				$expand: 'items',
				count: true,
			});
			expect(result.$filter).toBe("Name eq 'Test'");
			expect(result.$expand).toBe('items');
			expect(result.$count).toBe(true);
		});
	});

	describe('getTotalCount', () => {
		it('should return V2 count from d.__count', () => {
			const response = { d: { results: [], __count: 42 } };
			expect(ODataVersionHelper.getTotalCount(response, 'v2')).toBe(42);
		});

		it('should return V4 count from @odata.count', () => {
			const response = { '@odata.count': 42, value: [] };
			expect(ODataVersionHelper.getTotalCount(response, 'v4')).toBe(42);
		});

		it('should return undefined when no count present', () => {
			expect(ODataVersionHelper.getTotalCount({ d: { results: [] } }, 'v2')).toBeUndefined();
			expect(ODataVersionHelper.getTotalCount({ value: [] }, 'v4')).toBeUndefined();
		});
	});

	describe('formatEntityKey', () => {
		it('should quote string keys for V4', () => {
			expect(ODataVersionHelper.formatEntityKey('ABC123', 'v4')).toBe("'ABC123'");
		});

		it('should not quote numeric keys for V4', () => {
			expect(ODataVersionHelper.formatEntityKey('123', 'v4')).toBe('123');
		});

		it('should not quote already-quoted keys for V4', () => {
			expect(ODataVersionHelper.formatEntityKey("'ABC123'", 'v4')).toBe("'ABC123'");
		});

		it('should not quote composite keys for V4', () => {
			expect(ODataVersionHelper.formatEntityKey("Key1='A',Key2='B'", 'v4')).toBe("Key1='A',Key2='B'");
		});

		it('should return keys unchanged for V2', () => {
			expect(ODataVersionHelper.formatEntityKey('ABC123', 'v2')).toBe('ABC123');
		});
	});

	describe('parseError', () => {
		it('should parse V4 error with string message', () => {
			const error = { error: { message: 'Entity not found' } };
			expect(ODataVersionHelper.parseError(error, 'v4')).toBe('Entity not found');
		});

		it('should parse V2 error with value object', () => {
			const error = { error: { message: { value: 'Entity not found' } } };
			expect(ODataVersionHelper.parseError(error, 'v2')).toBe('Entity not found');
		});

		it('should return default message for unknown structure', () => {
			expect(ODataVersionHelper.parseError({}, 'v4')).toBe('An unknown SAP OData error occurred');
		});
	});
});
