"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationStrategyFactory = void 0;
const CreateEntityStrategy_1 = require("./CreateEntityStrategy");
const DeleteEntityStrategy_1 = require("./DeleteEntityStrategy");
const FunctionImportStrategy_1 = require("./FunctionImportStrategy");
const GetAllEntitiesStrategy_1 = require("./GetAllEntitiesStrategy");
const GetEntityStrategy_1 = require("./GetEntityStrategy");
const GetMetadataStrategy_1 = require("./GetMetadataStrategy");
const UpdateEntityStrategy_1 = require("./UpdateEntityStrategy");
class OperationStrategyFactory {
    static getEntityStrategy(operation) {
        switch (operation) {
            case 'create':
                return new CreateEntityStrategy_1.CreateEntityStrategy();
            case 'get':
                return new GetEntityStrategy_1.GetEntityStrategy();
            case 'getAll':
                return new GetAllEntitiesStrategy_1.GetAllEntitiesStrategy();
            case 'getMetadata':
                return new GetMetadataStrategy_1.GetMetadataStrategy();
            case 'update':
                return new UpdateEntityStrategy_1.UpdateEntityStrategy();
            case 'delete':
                return new DeleteEntityStrategy_1.DeleteEntityStrategy();
            default:
                throw new Error(`Unknown entity operation: ${operation}`);
        }
    }
    static getFunctionImportStrategy() {
        return new FunctionImportStrategy_1.FunctionImportStrategy();
    }
    static getStrategy(resource, operation) {
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
exports.OperationStrategyFactory = OperationStrategyFactory;
