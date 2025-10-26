import { GetAllEntitiesStrategy } from '../../nodes/Shared/strategies/GetAllEntitiesStrategy';
import { IExecuteFunctions } from 'n8n-workflow';
import * as GenericFunctions from '../../nodes/Sap/GenericFunctions';

jest.mock('../../nodes/Sap/GenericFunctions');

describe('GetAllEntitiesStrategy', () => {
	let strategy: GetAllEntitiesStrategy;
	let mockContext: Partial<IExecuteFunctions>;
	let sapOdataApiRequestSpy: jest.SpyInstance;
	let sapOdataApiRequestAllItemsSpy: jest.SpyInstance;

	beforeEach(() => {
		strategy = new GetAllEntitiesStrategy();
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
		sapOdataApiRequestAllItemsSpy = jest.spyOn(GenericFunctions, 'sapOdataApiRequestAllItems');

		// Mock buildODataQuery to return the input as-is
		jest.spyOn(GenericFunctions, 'buildODataQuery').mockImplementation((options) => options as any);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('execute', () => {
		it('should get all entities with returnAll=true', async () => {
			const mockData = [
				{ ProductID: 'P1', Name: 'Product 1' },
				{ ProductID: 'P2', Name: 'Product 2' },
				{ ProductID: 'P3', Name: 'Product 3' },
			];

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(true) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({}); // options (for batchSize check)

			sapOdataApiRequestAllItemsSpy.mockResolvedValue(mockData);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestAllItemsSpy).toHaveBeenCalledWith(
				'results',
				'GET',
				'/ProductSet',
				{},
				{},
				false,
				0,
			);
			expect(result).toHaveLength(3);
			expect(result[0].json).toEqual(mockData[0]);
			expect(result[1].json).toEqual(mockData[1]);
			expect(result[2].json).toEqual(mockData[2]);
		});

		it('should get limited entities with returnAll=false', async () => {
			const mockResponse = {
				d: {
					results: [
						{ ProductID: 'P1', Name: 'Product 1' },
						{ ProductID: 'P2', Name: 'Product 2' },
					],
				},
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(false) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({}) // options (for batchSize check)
				.mockReturnValueOnce(10); // limit

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				'/ProductSet',
				{},
				{ $top: 10 },
			);
			expect(result).toHaveLength(2);
		});

		it('should handle OData V4 response format', async () => {
			const mockResponse = {
				value: [
					{ ProductID: 'P1', Name: 'Product 1' },
					{ ProductID: 'P2', Name: 'Product 2' },
				],
				'@odata.context': 'test',
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(false) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({}) // options (for batchSize check)
				.mockReturnValueOnce(10); // limit

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(result).toHaveLength(2);
			expect(result[0].json).toEqual(mockResponse.value[0]);
		});

		it('should apply query options ($filter, $select, $orderby)', async () => {
			const mockData = [{ ProductID: 'P1', Name: 'Product 1' }];

			const queryOptions = {
				$filter: "Status eq 'A'",
				$select: 'ProductID,Name',
				$orderby: 'Name',
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(true) // returnAll
				.mockReturnValueOnce(queryOptions) // options (for getQueryOptions)
				.mockReturnValueOnce(queryOptions); // options (for batchSize check)

			sapOdataApiRequestAllItemsSpy.mockResolvedValue(mockData);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestAllItemsSpy).toHaveBeenCalledWith(
				'results',
				'GET',
				'/ProductSet',
				{},
				{
					$filter: "Status eq 'A'",
					$select: 'ProductID,Name',
					$orderby: 'Name',
				},
				false,
				0,
			);
		});

		it('should apply batchSize from options', async () => {
			const mockData = [{ ProductID: 'P1' }];

			const optionsWithBatch = { batchSize: 50 };

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(true) // returnAll
				.mockReturnValueOnce(optionsWithBatch) // options (for getQueryOptions)
				.mockReturnValueOnce(optionsWithBatch); // options (for batchSize check)

			sapOdataApiRequestAllItemsSpy.mockResolvedValue(mockData);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestAllItemsSpy).toHaveBeenCalledWith(
				'results',
				'GET',
				'/ProductSet',
				{},
				{ $top: 50 }, // batchSize is applied as $top, not passed separately
				false,
				0,
			);
		});

		it('should use custom entity set when in custom mode', async () => {
			const mockData = [{ ID: '1', Value: 'Test' }];

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('custom') // entitySetMode
				.mockReturnValueOnce('MyCustomEntitySet') // customEntitySet
				.mockReturnValueOnce(true) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({}); // options (for batchSize check)

			sapOdataApiRequestAllItemsSpy.mockResolvedValue(mockData);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestAllItemsSpy).toHaveBeenCalledWith(
				'results',
				'GET',
				'/MyCustomEntitySet',
				{},
				{},
				false,
				0,
			);
		});

		it('should handle single entity response as array', async () => {
			const mockResponse = {
				d: { ProductID: 'P1', Name: 'Product 1' }, // Single entity, not array
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(false) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({}) // options (for batchSize check)
				.mockReturnValueOnce(10); // limit

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			// Should convert single entity to array
			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({ ProductID: 'P1', Name: 'Product 1' });
		});

		it('should handle pagination errors with continueOnFail enabled', async () => {
			const partialResult = {
				data: [
					{ ProductID: 'P1', Name: 'Product 1' },
					{ ProductID: 'P2', Name: 'Product 2' },
				],
				errors: [
					{
						page: 2,
						error: 'Timeout error',
						itemsFetchedSoFar: 2,
					},
				],
				partial: true,
				message: 'Fetched 2 items before encountering 1 error(s)',
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(true) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({ continueOnFail: true }); // options (with continueOnFail)

			sapOdataApiRequestAllItemsSpy.mockResolvedValue(partialResult);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			// Should return data + error item
			expect(result).toHaveLength(3); // 2 data items + 1 error item
			expect(result[0].json).toEqual({ ProductID: 'P1', Name: 'Product 1' });
			expect(result[1].json).toEqual({ ProductID: 'P2', Name: 'Product 2' });
			expect(result[2].json).toHaveProperty('paginationErrors');
			expect(result[2].json).toHaveProperty('partial', true);
			expect(result[2].json.totalItemsFetched).toBe(2);
		});

		it('should handle maxItems limit and return partial results', async () => {
			const limitResult = {
				data: [
					{ ProductID: 'P1', Name: 'Product 1' },
					{ ProductID: 'P2', Name: 'Product 2' },
					{ ProductID: 'P3', Name: 'Product 3' },
				],
				partial: true,
				limitReached: true,
				message: 'Fetched 3 items. Max items limit (3) reached - more data may be available.',
			};

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(true) // returnAll
				.mockReturnValueOnce({}) // options (for getQueryOptions)
				.mockReturnValueOnce({ maxItems: 3 }); // options (with maxItems)

			sapOdataApiRequestAllItemsSpy.mockResolvedValue(limitResult);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			// Should return data + limit info item
			expect(result).toHaveLength(4); // 3 data items + 1 metadata item
			expect(result[0].json).toEqual({ ProductID: 'P1', Name: 'Product 1' });
			expect(result[1].json).toEqual({ ProductID: 'P2', Name: 'Product 2' });
			expect(result[2].json).toEqual({ ProductID: 'P3', Name: 'Product 3' });
			expect(result[3].json).toHaveProperty('limitReached', true);
			expect(result[3].json).toHaveProperty('partial', true);
			expect(result[3].json.totalItemsFetched).toBe(3);
		});
	});
});
