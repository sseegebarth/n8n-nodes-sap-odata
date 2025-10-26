import { GetEntityStrategy } from '../../nodes/Shared/strategies/GetEntityStrategy';
import { IExecuteFunctions } from 'n8n-workflow';
import * as GenericFunctions from '../../nodes/Sap/GenericFunctions';

jest.mock('../../nodes/Sap/GenericFunctions');

describe('GetEntityStrategy', () => {
	let strategy: GetEntityStrategy;
	let mockContext: Partial<IExecuteFunctions>;
	let sapOdataApiRequestSpy: jest.SpyInstance;

	beforeEach(() => {
		strategy = new GetEntityStrategy();
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

		// Mock buildODataQuery to return the input as-is
		jest.spyOn(GenericFunctions, 'buildODataQuery').mockImplementation((options) => options as any);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('execute', () => {
		it('should get entity without query options', async () => {
			const mockResponse = {
				d: {
					ProductID: 'P123',
					Name: 'Test Product',
					Price: 99.99,
				},
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('P123') // entityKey
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				"/ProductSet('P123')",
				{},
				{},
			);
			expect(result).toEqual([
				{
					json: mockResponse.d,
					pairedItem: { item: 0 },
				},
			]);
		});

		it('should get entity with query options ($select, $expand)', async () => {
			const mockResponse = {
				d: {
					ProductID: 'P123',
					Name: 'Test Product',
				},
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('P123') // entityKey
				.mockReturnValueOnce({
					$select: 'ProductID,Name',
					$expand: 'Category',
				}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				"/ProductSet('P123')",
				{},
				{
					$select: 'ProductID,Name',
					$expand: 'Category',
				},
			);
		});

		it('should handle OData V4 response format', async () => {
			const mockResponse = {
				ProductID: 'P123',
				Name: 'Test Product',
				'@odata.context': 'test',
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('P123') // entityKey
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(result[0].json).toEqual(mockResponse);
		});
	});
});
