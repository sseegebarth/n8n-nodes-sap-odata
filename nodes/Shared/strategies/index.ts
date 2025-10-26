/**
 * Strategy Pattern Implementation for SAP OData Operations
 *
 * This module exports all operation strategies and the factory
 * for creating them based on resource and operation type.
 */

export { IOperationStrategy } from './IOperationStrategy';
export { BaseEntityStrategy } from './BaseEntityStrategy';
export { CreateEntityStrategy } from './CreateEntityStrategy';
export { GetEntityStrategy } from './GetEntityStrategy';
export { GetAllEntitiesStrategy } from './GetAllEntitiesStrategy';
export { UpdateEntityStrategy } from './UpdateEntityStrategy';
export { DeleteEntityStrategy } from './DeleteEntityStrategy';
export { FunctionImportStrategy } from './FunctionImportStrategy';
export { OperationStrategyFactory } from './OperationStrategyFactory';
