import { FunctionImportStrategy } from '../../nodes/Sap/strategies/FunctionImportStrategy';
import { IExecuteFunctions } from 'n8n-workflow';
import * as GenericFunctions from '../../nodes/Sap/GenericFunctions';

// Mock the module but preserve the actual formatSapODataValue function
jest.mock('../../nodes/Sap/GenericFunctions', () => {
	const actual = jest.requireActual('../../nodes/Sap/GenericFunctions');
	return {
		...actual,
		sapOdataApiRequest: jest.fn(),
	};
});

describe('FunctionImportStrategy', () => {
	let strategy: FunctionImportStrategy;
	let mockContext: Partial<IExecuteFunctions>;
	let sapOdataApiRequestSpy: jest.SpyInstance;

	beforeEach(() => {
		strategy = new FunctionImportStrategy();
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
		it('should execute function import with GET method and parameters', async () => {
			const mockResponse = {
				d: {
					Result: 'Success',
					Value: 123,
				},
			};

			const parameters = JSON.stringify({
				Customer: '0100000001',
				Year: 2024,
			});

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // functionNameMode
				.mockReturnValueOnce('GetCustomerData') // functionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('GET') // functionHttpMethod
				.mockReturnValueOnce('query'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				"/GetCustomerData?Customer='0100000001'&Year=2024",
			);
			expect(result).toEqual([
				{
					json: mockResponse.d,
					pairedItem: { item: 0 },
				},
			]);
		});

		it('should execute function import with POST method', async () => {
			const mockResponse = {
				d: {
					OrderID: 'SO123',
					Status: 'Created',
				},
			};

			const parameters = JSON.stringify({
				ProductID: 'P001',
				Quantity: 5,
			});

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // functionNameMode
				.mockReturnValueOnce('CreateOrder') // functionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('POST') // functionHttpMethod
				.mockReturnValueOnce('query'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'POST',
				"/CreateOrder?ProductID='P001'&Quantity=5",
			);
		});

		it('should execute function import without parameters', async () => {
			const mockResponse = {
				d: {
					Count: 42,
				},
			};

			const parameters = JSON.stringify({});

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // functionNameMode
				.mockReturnValueOnce('GetTotalCount') // functionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('GET') // functionHttpMethod
				.mockReturnValueOnce('query'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'GET',
				'/GetTotalCount',
			);
			expect(result[0].json).toEqual({ Count: 42 });
		});

		it('should use custom function name when in custom mode', async () => {
			const mockResponse = { d: { Result: 'OK' } };

			const parameters = JSON.stringify({ Param1: 'Value1' });

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('custom') // functionNameMode
				.mockReturnValueOnce('MyCustomFunction') // customFunctionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('POST') // functionHttpMethod
				.mockReturnValueOnce('query'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'POST',
				"/MyCustomFunction?Param1='Value1'",
			);
		});

		it('should handle OData V4 response format', async () => {
			const mockResponse = {
				Result: 'Success',
				'@odata.context': 'test',
			};

			const parameters = JSON.stringify({ ID: '123' });

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // functionNameMode
				.mockReturnValueOnce('ProcessData') // functionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('POST') // functionHttpMethod
				.mockReturnValueOnce('canonical'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			const result = await strategy.execute(mockContext as IExecuteFunctions, 0);

			// OData V4 doesn't have 'd' wrapper
			expect(result[0].json).toEqual(mockResponse);
		});

		it('should handle string and numeric parameters correctly', async () => {
			const mockResponse = { d: { Result: 'OK' } };

			const parameters = JSON.stringify({
				StringParam: 'Test Value',
				NumericParam: 100,
				BoolParam: true,
			});

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // functionNameMode
				.mockReturnValueOnce('ComplexFunction') // functionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('POST') // functionHttpMethod
				.mockReturnValueOnce('query'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			// String parameters get quotes, numeric/boolean don't
			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'POST',
				"/ComplexFunction?StringParam='Test Value'&NumericParam=100&BoolParam=true",
			);
		});

		it('should use POST as default HTTP method', async () => {
			const mockResponse = { d: {} };
			const parameters = JSON.stringify({});

			(mockContext.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('list') // functionNameMode
				.mockReturnValueOnce('TestFunction') // functionName
				.mockReturnValueOnce(parameters) // functionParameters
				.mockReturnValueOnce('POST') // functionHttpMethod (default)
				.mockReturnValueOnce('query'); // functionUrlFormat

			sapOdataApiRequestSpy.mockResolvedValue(mockResponse);

			await strategy.execute(mockContext as IExecuteFunctions, 0);

			// Verify POST is used
			expect(sapOdataApiRequestSpy).toHaveBeenCalledWith(
				'POST',
				'/TestFunction',
			);
		});
	});
});
