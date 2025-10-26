/**
 * PaginationHandler Tests
 */

import {
	fetchAllItems,
	streamAllItems,
	extractItemsFromResponse,
	extractNextLink,
	IPaginationConfig,
} from '../../nodes/Shared/core/PaginationHandler';

describe('PaginationHandler', () => {
	describe('extractItemsFromResponse', () => {
		it('should extract items from OData V2 format', () => {
			const response = {
				d: {
					results: [{ id: 1 }, { id: 2 }, { id: 3 }],
				},
			};

			const result = extractItemsFromResponse(response);
			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		});

		it('should extract items from OData V4 format', () => {
			const response = {
				value: [{ id: 1 }, { id: 2 }, { id: 3 }],
			};

			const result = extractItemsFromResponse(response);
			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		});

		it('should extract single item from OData V2 format', () => {
			const response = {
				d: { id: 1, name: 'Test' },
			};

			const result = extractItemsFromResponse(response);
			expect(result).toEqual([{ id: 1, name: 'Test' }]);
		});

		it('should extract items using custom property name', () => {
			const response = {
				customProp: [{ id: 1 }, { id: 2 }],
			};

			const result = extractItemsFromResponse(response, 'customProp');
			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it('should handle single item with custom property name', () => {
			const response = {
				customProp: { id: 1 },
			};

			const result = extractItemsFromResponse(response, 'customProp');
			expect(result).toEqual([{ id: 1 }]);
		});

		it('should handle array response directly', () => {
			const response = [{ id: 1 }, { id: 2 }];

			const result = extractItemsFromResponse(response);
			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it('should handle single object response', () => {
			const response = { id: 1, name: 'Test' };

			const result = extractItemsFromResponse(response);
			expect(result).toEqual([{ id: 1, name: 'Test' }]);
		});
	});

	describe('extractNextLink', () => {
		it('should extract next link from OData V2 format', () => {
			const response = {
				d: {
					__next: 'https://api.example.com/ProductSet?$skiptoken=100',
					results: [],
				},
			};

			const result = extractNextLink(response);
			expect(result).toBe('https://api.example.com/ProductSet?$skiptoken=100');
		});

		it('should extract next link from OData V4 format', () => {
			const response = {
				'@odata.nextLink': 'https://api.example.com/ProductSet?$skip=100',
				value: [],
			};

			const result = extractNextLink(response);
			expect(result).toBe('https://api.example.com/ProductSet?$skip=100');
		});

		it('should return undefined if no next link', () => {
			const response = {
				d: {
					results: [],
				},
			};

			const result = extractNextLink(response);
			expect(result).toBeUndefined();
		});

		it('should prioritize V2 format if both exist', () => {
			const response = {
				d: {
					__next: 'https://v2.link',
				},
				'@odata.nextLink': 'https://v4.link',
			};

			const result = extractNextLink(response);
			expect(result).toBe('https://v2.link');
		});
	});

	describe('fetchAllItems', () => {
		it('should fetch all items from single page', async () => {
			const requestFn = jest.fn().mockResolvedValue({
				d: {
					results: [{ id: 1 }, { id: 2 }, { id: 3 }],
				},
			});

			const result = await fetchAllItems(requestFn);

			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(requestFn).toHaveBeenCalledTimes(1);
		});

		it('should fetch all items from multiple pages', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }, { id: 2 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 3 }, { id: 4 }],
						__next: 'https://api.example.com/page3',
					},
				})
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 5 }],
					},
				});

			const result = await fetchAllItems(requestFn);

			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
			expect(requestFn).toHaveBeenCalledTimes(3);
		});

		it('should respect maxItems limit', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }, { id: 2 }, { id: 3 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 4 }, { id: 5 }, { id: 6 }],
					},
				});

			const config: IPaginationConfig = { maxItems: 4 };
			const result = await fetchAllItems(requestFn, config);

			expect(result).toHaveProperty('data');
			expect((result as any).data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
			expect((result as any).limitReached).toBe(true);
			expect((result as any).partial).toBe(true);
		});

		it('should continue on fail and collect errors', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }, { id: 2 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockRejectedValueOnce(new Error('Network error'));

			const config: IPaginationConfig = { continueOnFail: true };
			const result = await fetchAllItems(requestFn, config);

			expect(result).toHaveProperty('data');
			expect((result as any).data).toEqual([{ id: 1 }, { id: 2 }]);
			expect((result as any).errors).toHaveLength(1);
			expect((result as any).errors[0].error).toBe('Network error');
			expect((result as any).partial).toBe(true);
		});

		it('should throw on error if continueOnFail is false', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockRejectedValueOnce(new Error('Network error'));

			await expect(fetchAllItems(requestFn)).rejects.toThrow('Network error');
		});

		it('should use custom property name', async () => {
			const requestFn = jest.fn().mockResolvedValue({
				customData: [{ id: 1 }, { id: 2 }],
			});

			const config: IPaginationConfig = { propertyName: 'customData' };
			const result = await fetchAllItems(requestFn, config);

			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it('should handle OData V4 pagination', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					value: [{ id: 1 }, { id: 2 }],
					'@odata.nextLink': 'https://api.example.com/page2',
				})
				.mockResolvedValueOnce({
					value: [{ id: 3 }],
				});

			const result = await fetchAllItems(requestFn);

			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(requestFn).toHaveBeenCalledTimes(2);
		});

		it('should use next link in subsequent requests', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 2 }],
					},
				});

			await fetchAllItems(requestFn);

			expect(requestFn).toHaveBeenNthCalledWith(1, { $top: 100 }); // DEFAULT_PAGE_SIZE is 100
			expect(requestFn).toHaveBeenNthCalledWith(2, undefined, 'https://api.example.com/page2');
		});
	});

	describe('streamAllItems', () => {
		it('should yield items one by one', async () => {
			const requestFn = jest.fn().mockResolvedValue({
				d: {
					results: [{ id: 1 }, { id: 2 }, { id: 3 }],
				},
			});

			const items: any[] = [];
			for await (const item of streamAllItems(requestFn)) {
				items.push(item);
			}

			expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(requestFn).toHaveBeenCalledTimes(1);
		});

		it('should stream items from multiple pages', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }, { id: 2 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 3 }],
					},
				});

			const items: any[] = [];
			for await (const item of streamAllItems(requestFn)) {
				items.push(item);
			}

			expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(requestFn).toHaveBeenCalledTimes(2);
		});

		it('should respect maxItems limit in streaming', async () => {
			const requestFn = jest.fn().mockResolvedValue({
				d: {
					results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
					__next: 'https://api.example.com/page2',
				},
			});

			const items: any[] = [];
			const config: IPaginationConfig = { maxItems: 3 };

			for await (const item of streamAllItems(requestFn, config)) {
				items.push(item);
			}

			expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(requestFn).toHaveBeenCalledTimes(1); // Stopped before fetching next page
		});

		it('should stop streaming when maxItems reached mid-page', async () => {
			const requestFn = jest
				.fn()
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 1 }, { id: 2 }],
						__next: 'https://api.example.com/page2',
					},
				})
				.mockResolvedValueOnce({
					d: {
						results: [{ id: 3 }, { id: 4 }, { id: 5 }],
					},
				});

			const items: any[] = [];
			const config: IPaginationConfig = { maxItems: 4 };

			for await (const item of streamAllItems(requestFn, config)) {
				items.push(item);
			}

			expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
		});
	});
});
