import {
	extractItemsFromResponse,
	extractNextLink,
	fetchAllItems,
} from '../lib/core/PaginationHandler';

describe('PaginationHandler', () => {
	describe('extractItemsFromResponse', () => {
		it('should extract items from OData V2 d.results', () => {
			const response = { d: { results: [{ ID: '1' }, { ID: '2' }] } };
			expect(extractItemsFromResponse(response)).toEqual([{ ID: '1' }, { ID: '2' }]);
		});

		it('should extract items from OData V4 value', () => {
			const response = { value: [{ ID: '1' }, { ID: '2' }] };
			expect(extractItemsFromResponse(response)).toEqual([{ ID: '1' }, { ID: '2' }]);
		});

		it('should extract single V2 entity from d', () => {
			const response = { d: { ID: '1', Name: 'Test' } };
			expect(extractItemsFromResponse(response)).toEqual([{ ID: '1', Name: 'Test' }]);
		});

		it('should use specified propertyName', () => {
			const response = { results: [{ ID: '1' }] };
			expect(extractItemsFromResponse(response, 'results')).toEqual([{ ID: '1' }]);
		});

		it('should handle raw array response', () => {
			const response = [{ ID: '1' }, { ID: '2' }];
			expect(extractItemsFromResponse(response as any)).toEqual([{ ID: '1' }, { ID: '2' }]);
		});

		it('should wrap non-array raw response', () => {
			const response = { ID: '1', Name: 'Test' };
			expect(extractItemsFromResponse(response)).toEqual([{ ID: '1', Name: 'Test' }]);
		});

		it('should preserve expanded navigation properties in items', () => {
			const response = {
				value: [
					{
						ID: 'OP-1',
						openAmount: 1000,
						invoice: { ID: 'INV-1', invoiceNumber: 'RE-2024-0001' },
						customer: { ID: 'CUST-1', companyName: 'Acme' },
					},
				],
			};
			const items = extractItemsFromResponse(response);
			expect(items[0].invoice).toEqual({ ID: 'INV-1', invoiceNumber: 'RE-2024-0001' });
			expect(items[0].customer).toEqual({ ID: 'CUST-1', companyName: 'Acme' });
		});
	});

	describe('extractNextLink', () => {
		it('should extract V2 next link from d.__next', () => {
			const response = { d: { results: [], __next: 'http://sap/next' } };
			expect(extractNextLink(response)).toBe('http://sap/next');
		});

		it('should extract V4 next link from @odata.nextLink', () => {
			const response = { '@odata.nextLink': 'Products?$skip=100', value: [] };
			expect(extractNextLink(response)).toBe('Products?$skip=100');
		});

		it('should return undefined when no next link', () => {
			expect(extractNextLink({ d: { results: [] } })).toBeUndefined();
			expect(extractNextLink({ value: [] })).toBeUndefined();
		});
	});

	describe('fetchAllItems', () => {
		it('should fetch single page of results', async () => {
			const items = [{ ID: '1' }, { ID: '2' }];
			const requestFn = jest.fn().mockResolvedValueOnce({ value: items });

			const result = await fetchAllItems(requestFn);
			expect(result).toEqual(items);
			expect(requestFn).toHaveBeenCalledTimes(1);
		});

		it('should follow @odata.nextLink for pagination', async () => {
			const requestFn = jest.fn()
				.mockResolvedValueOnce({
					value: Array(100).fill({ ID: '1' }),
					'@odata.nextLink': 'Products?$skip=100',
				})
				.mockResolvedValueOnce({
					value: [{ ID: '101' }],
				});

			const result = await fetchAllItems(requestFn);
			expect(Array.isArray(result)).toBe(true);
			expect((result as any[]).length).toBe(101);
			expect(requestFn).toHaveBeenCalledTimes(2);
		});

		it('should respect maxItems limit', async () => {
			const requestFn = jest.fn().mockResolvedValueOnce({
				value: Array(100).fill({ ID: '1' }),
				'@odata.nextLink': 'Products?$skip=100',
			});

			const result = await fetchAllItems(requestFn, { maxItems: 50 });
			expect(typeof result === 'object' && !Array.isArray(result)).toBe(true);
			const paginationResult = result as any;
			expect(paginationResult.data.length).toBe(50);
			expect(paginationResult.limitReached).toBe(true);
		});

		it('should handle errors with continueOnFail', async () => {
			const requestFn = jest.fn().mockRejectedValueOnce(new Error('Network error'));

			const result = await fetchAllItems(requestFn, { continueOnFail: true });
			expect(typeof result === 'object' && !Array.isArray(result)).toBe(true);
			const paginationResult = result as any;
			expect(paginationResult.errors.length).toBe(1);
			expect(paginationResult.partial).toBe(true);
		});

		it('should throw errors without continueOnFail', async () => {
			const requestFn = jest.fn().mockRejectedValueOnce(new Error('Network error'));

			await expect(fetchAllItems(requestFn)).rejects.toThrow('Network error');
		});
	});
});
