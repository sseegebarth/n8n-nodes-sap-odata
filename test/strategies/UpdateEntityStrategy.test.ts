import { UpdateEntityStrategy } from '../../nodes/Shared/strategies/UpdateEntityStrategy';
import { IExecuteFunctions } from 'n8n-workflow';
import * as GenericFunctions from '../../nodes/Sap/GenericFunctions';

jest.mock('../../nodes/Sap/GenericFunctions');

describe('UpdateEntityStrategy', () => {
	let strategy: UpdateEntityStrategy;
	let mockContext: Partial<IExecuteFunctions>;
	let sapOdataApiRequestSpy: jest.SpyInstance;

	beforeEach(() => {
		strategy = new UpdateEntityStrategy();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn(() => ({
				id: 'test-node',
				name: 'SAP OData',
				type: 'n8n-nodes-sap-odata.sapOData',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			})),
		};
		sapOdataApiRequestSpy = jest.spyOn(GenericFunctions, 'sapOdataApiRequest');
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('execute', () => {
		it('should update entity with valid JSON data', async () => {
			const mockResponse = {
				d: {
					ProductID: 'P123',
					Name: 'Updated Product',
					Price: 149.99,
				},
			};

			const updateData = JSON.stringify({
				Name: 'Updated Product',
				Price: 149.99,
			});

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('P123') // entityKey
				.mockReturnValueOnce(updateData) // data
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'PATCH',
				"/ProductSet('P123')",
				{
					Name: 'Updated Product',
					Price: 149.99,
				},
				{},
				undefined,
				expect.objectContaining({
					headers: expect.objectContaining({
						'If-Match': '*',
					}),
				}),
			);
			expect(result).toEqual([
				{
					json: mockResponse.d,
					pairedItem: { item: 0 },
				},
			]);
		});

		it('should update entity with composite key', async () => {
			const mockResponse = {
				d: {
					SalesOrderID: '0500000001',
					ItemPosition: '10',
					Quantity: 5,
				},
			};

			const updateData = JSON.stringify({ Quantity: 5 });

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('SalesOrderItemSet') // entitySet
				.mockReturnValueOnce("SalesOrderID='0500000001',ItemPosition='10'") // entityKey
				.mockReturnValueOnce(updateData) // data
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'PATCH',
				"/SalesOrderItemSet(SalesOrderID='0500000001',ItemPosition='10')",
				{ Quantity: 5 },
				{},
				undefined,
				expect.objectContaining({
					headers: expect.objectContaining({
						'If-Match': '*',
					}),
				}),
			);
		});

		it('should handle OData V4 response format', async () => {
			const mockResponse = {
				ProductID: 'P123',
				Name: 'Updated Product',
				'@odata.context': 'test',
			};

			const updateData = JSON.stringify({ Name: 'Updated Product' });

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('P123') // entityKey
				.mockReturnValueOnce(updateData) // data
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			// OData V4 doesn't have 'd' wrapper, so extractResult returns the full response
			expect(result[0].json).toEqual(mockResponse);
		});

		it('should use custom entity set when in custom mode', async () => {
			const mockResponse = {
				d: { success: true },
			};

			const updateData = JSON.stringify({ Status: 'Active' });

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('custom') // entitySetMode
				.mockReturnValueOnce('MyCustomEntitySet') // customEntitySet
				.mockReturnValueOnce('123') // entityKey
				.mockReturnValueOnce(updateData) // data
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'PATCH',
				'/MyCustomEntitySet(123)',
				{ Status: 'Active' },
				{},
				undefined,
				expect.objectContaining({
					headers: expect.objectContaining({
						'If-Match': '*',
					}),
				}),
			);
		});

		it('should handle empty response from server', async () => {
			const mockResponse = {};

			const updateData = JSON.stringify({ Name: 'Test' });

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('P123') // entityKey
				.mockReturnValueOnce(updateData) // data
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			// Empty response is returned as-is (extractResult returns {} which is truthy)
			expect(result[0].json).toEqual({});
		});
	});
});
