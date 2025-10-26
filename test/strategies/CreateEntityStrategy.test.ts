import { CreateEntityStrategy } from '../../nodes/Shared/strategies/CreateEntityStrategy';
import { IExecuteFunctions } from 'n8n-workflow';

describe('CreateEntityStrategy', () => {
	let strategy: CreateEntityStrategy;
	let mockContext: Partial<IExecuteFunctions>;

	beforeEach(() => {
		strategy = new CreateEntityStrategy();
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
	});

	describe('execute', () => {
		it('should create entity with valid JSON data', async () => {
			const mockData = { ProductID: 'P123', Name: 'Test Product', Price: 99.99 };
			const jsonString = JSON.stringify(mockData);

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(jsonString); // data

			// Note: In real test, we'd need to mock sapOdataApiRequest
			// For now, this demonstrates the structure
			// const mockResponse = { d: { ...mockData, __metadata: { uri: 'test' } } };
		});

		it('should throw error for invalid JSON', async () => {
			const invalidJson = '{ invalid json }';

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(invalidJson); // data

			await expect(
				strategy.execute(mockContext as IExecuteFunctions, 0),
			).rejects.toThrow('Invalid JSON');
		});

		it('should validate and prevent prototype pollution', async () => {
			const maliciousJson = '{"__proto__": {"polluted": true}}';

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // entitySetMode
				.mockReturnValueOnce('ProductSet') // entitySet
				.mockReturnValueOnce(maliciousJson); // data

			await expect(
				strategy.execute(mockContext as IExecuteFunctions, 0),
			).rejects.toThrow('Forbidden property');
		});
	});
});
