import { CreateEntityStrategy } from './CreateEntityStrategy';
import { DeleteEntityStrategy } from './DeleteEntityStrategy';
import { FunctionImportStrategy } from './FunctionImportStrategy';
import { GetAllEntitiesStrategy } from './GetAllEntitiesStrategy';
import { GetEntityStrategy } from './GetEntityStrategy';
import { IOperationStrategy } from './IOperationStrategy';
import { UpdateEntityStrategy } from './UpdateEntityStrategy';

/**
 * Factory for creating operation strategies
 * Returns the appropriate strategy based on resource and operation
 */
export class OperationStrategyFactory {
	/**
	 * Get strategy for entity operations
	 */
	static getEntityStrategy(operation: string): IOperationStrategy {
		switch (operation) {
			case 'create':
				return new CreateEntityStrategy();

			case 'get':
				return new GetEntityStrategy();

			case 'getAll':
				return new GetAllEntitiesStrategy();

			case 'update':
				return new UpdateEntityStrategy();

			case 'delete':
				return new DeleteEntityStrategy();

			default:
				throw new Error(`Unknown entity operation: ${operation}`);
		}
	}

	/**
	 * Get strategy for function import
	 */
	static getFunctionImportStrategy(): IOperationStrategy {
		return new FunctionImportStrategy();
	}

	/**
	 * Get strategy based on resource and operation
	 */
	static getStrategy(resource: string, operation?: string): IOperationStrategy {
		if (resource === 'entity') {
			if (!operation) {
				throw new Error('Operation is required for entity resource');
			}
			return this.getEntityStrategy(operation);
		}

		if (resource === 'functionImport') {
			return this.getFunctionImportStrategy();
		}

		throw new Error(`Unknown resource: ${resource}`);
	}
}
