import { OperationStrategyFactory } from '../../nodes/Sap/strategies/OperationStrategyFactory';
import { CreateEntityStrategy } from '../../nodes/Sap/strategies/CreateEntityStrategy';
import { GetEntityStrategy } from '../../nodes/Sap/strategies/GetEntityStrategy';
import { GetAllEntitiesStrategy } from '../../nodes/Sap/strategies/GetAllEntitiesStrategy';
import { UpdateEntityStrategy } from '../../nodes/Sap/strategies/UpdateEntityStrategy';
import { DeleteEntityStrategy } from '../../nodes/Sap/strategies/DeleteEntityStrategy';
import { FunctionImportStrategy } from '../../nodes/Sap/strategies/FunctionImportStrategy';

describe('OperationStrategyFactory', () => {
	describe('getEntityStrategy', () => {
		it('should return CreateEntityStrategy for create operation', () => {
			const strategy = OperationStrategyFactory.getEntityStrategy('create');
			expect(strategy).toBeInstanceOf(CreateEntityStrategy);
		});

		it('should return GetEntityStrategy for get operation', () => {
			const strategy = OperationStrategyFactory.getEntityStrategy('get');
			expect(strategy).toBeInstanceOf(GetEntityStrategy);
		});

		it('should return GetAllEntitiesStrategy for getAll operation', () => {
			const strategy = OperationStrategyFactory.getEntityStrategy('getAll');
			expect(strategy).toBeInstanceOf(GetAllEntitiesStrategy);
		});

		it('should return UpdateEntityStrategy for update operation', () => {
			const strategy = OperationStrategyFactory.getEntityStrategy('update');
			expect(strategy).toBeInstanceOf(UpdateEntityStrategy);
		});

		it('should return DeleteEntityStrategy for delete operation', () => {
			const strategy = OperationStrategyFactory.getEntityStrategy('delete');
			expect(strategy).toBeInstanceOf(DeleteEntityStrategy);
		});

		it('should throw error for unknown operation', () => {
			expect(() => {
				OperationStrategyFactory.getEntityStrategy('unknown');
			}).toThrow('Unknown entity operation: unknown');
		});
	});

	describe('getFunctionImportStrategy', () => {
		it('should return FunctionImportStrategy', () => {
			const strategy = OperationStrategyFactory.getFunctionImportStrategy();
			expect(strategy).toBeInstanceOf(FunctionImportStrategy);
		});
	});

	describe('getStrategy', () => {
		it('should return entity strategy for entity resource', () => {
			const strategy = OperationStrategyFactory.getStrategy('entity', 'create');
			expect(strategy).toBeInstanceOf(CreateEntityStrategy);
		});

		it('should return function import strategy for functionImport resource', () => {
			const strategy = OperationStrategyFactory.getStrategy('functionImport');
			expect(strategy).toBeInstanceOf(FunctionImportStrategy);
		});

		it('should throw error when operation is missing for entity resource', () => {
			expect(() => {
				OperationStrategyFactory.getStrategy('entity');
			}).toThrow('Operation is required for entity resource');
		});

		it('should throw error for unknown resource', () => {
			expect(() => {
				OperationStrategyFactory.getStrategy('unknown');
			}).toThrow('Unknown resource: unknown');
		});
	});
});
