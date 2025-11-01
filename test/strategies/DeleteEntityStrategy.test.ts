import { DeleteEntityStrategy } from '../../nodes/Shared/strategies/DeleteEntityStrategy';
import { IExecuteFunctions } from 'n8n-workflow';
import * as GenericFunctions from '../../nodes/Sap/GenericFunctions';

jest.mock('../../nodes/Sap/GenericFunctions');

describe('DeleteEntityStrategy', () => {
	let strategy: DeleteEntityStrategy;
	let mockContext: Partial<IExecuteFunctions>;
	let sapOdataApiRequestSpy: jest.SpyInstance;

	beforeEach(() => {
		strategy = new DeleteEntityStrategy();
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
		it('should delete entity with simple key', async () => {
			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce('0500000001') // entityKey
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(null);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'DELETE',
				'/ProductSet(0500000001)',
				{},
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
					json: { success: true },
					pairedItem: { item: 0 },
				},
			]);
		});

		it('should delete entity with composite key', async () => {
			const mockResponse = { d: {} };

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('SalesOrderSet') // entitySet
				.mockReturnValueOnce("SalesOrderID='0500000001',ItemPosition='10'") // entityKey
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'DELETE',
				"/SalesOrderSet(SalesOrderID='0500000001',ItemPosition='10')",
				{},
				{},
				undefined,
				expect.objectContaining({
					headers: expect.objectContaining({
						'If-Match': '*',
					}),
				}),
			);
		});

		it('should use custom entity set when in custom mode', async () => {
			const mockResponse = { d: {} };

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('custom') // entitySetMode
				.mockReturnValueOnce('CustomEntitySet') // customEntitySet
				.mockReturnValueOnce('123') // entityKey
				.mockReturnValueOnce({}); // options

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'DELETE',
				'/CustomEntitySet(123)',
				{},
				{},
				undefined,
				expect.objectContaining({
					headers: expect.objectContaining({
						'If-Match': '*',
					}),
				}),
			);
		});
	});
});
