/**
 * SAP OData Node - Load Options Methods
 *
 * This file contains all dynamic dropdown population logic.
 * Extracted from the main node file for better maintainability.
 */

import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import {
	parseMetadataForEntitySets,
	parseMetadataForFunctionImports,
	sapOdataApiRequest,
} from './GenericFunctions';

export const sapODataLoadOptions = {
	// Get available SAP OData Services
	async getServices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const { discoverServices, getCommonServices } = await import('./DiscoveryService');
			const { CacheManager } = await import('../Shared/utils/CacheManager');
			const credentials = await this.getCredentials('sapOdataApi');

			// Try to get from cache first
			const cached = await CacheManager.getServiceCatalog(this, credentials.host as string);

			if (cached && cached.length > 0) {
				return cached.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description,
				}));
			}

			// Try to discover services from SAP Gateway Catalog Service
			const discoveredServices = await discoverServices(this);

			if (discoveredServices && discoveredServices.length > 0) {
				// Cache the discovered services
				await CacheManager.setServiceCatalog(this, credentials.host as string, discoveredServices);

				return discoveredServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description,
				}));
			}

			// Fallback: Return common SAP services if catalog discovery fails
			const commonServices = getCommonServices();

			return [
				{
					name: '⚠️ Could not load services from SAP - Showing common services',
					value: '',
					description: 'Switch to "Custom" mode to enter service path manually',
				},
				...commonServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description,
				})),
			];
		} catch (error) {
			// If service discovery fails completely, return common services
			const { getCommonServices } = await import('./DiscoveryService');
			const commonServices = getCommonServices();

			return [
				{
					name: '⚠️ Service discovery failed - Showing common services',
					value: '',
					description: 'Switch to "Custom" mode to enter service path manually',
				},
				...commonServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description,
				})),
			];
		}
	},

	// Get available SAP OData Services filtered by category
	async getServicesByCategory(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const { discoverServices, getCommonServices, groupServicesByCategory } = await import('./DiscoveryService');
			const { CacheManager } = await import('../Shared/utils/CacheManager');
			const credentials = await this.getCredentials('sapOdataApi');

			// Get selected category
			const category = this.getCurrentNodeParameter('serviceCategory') as string || 'all';

			// Try to get from cache first
			const cached = await CacheManager.getServiceCatalog(this, credentials.host as string);
			let services = cached && cached.length > 0 ? cached : null;

			// If not cached, try to discover
			if (!services) {
				const discoveredServices = await discoverServices(this);

				if (discoveredServices && discoveredServices.length > 0) {
					// Cache the discovered services
					await CacheManager.setServiceCatalog(this, credentials.host as string, discoveredServices);
					services = discoveredServices;
				}
			}

			// Fallback to common services if discovery failed
			if (!services || services.length === 0) {
				services = getCommonServices();
			}

			// Filter by category if not "all"
			if (category !== 'all') {
				const grouped = groupServicesByCategory(services);

				const categoryMap: { [key: string]: string } = {
					'standard': 'SAP Standard APIs',
					'custom': 'Custom Services (Z*)',
					'other': 'Other Services',
				};

				const categoryKey = categoryMap[category];
				services = grouped[categoryKey] || [];
			}

			// Convert to dropdown options
			const options = services.map((service) => ({
				name: `${service.title} (${service.technicalName})`,
				value: service.servicePath,
				description: service.description,
			}));

			// If empty after filtering, show helpful message
			if (options.length === 0) {
				return [
					{
						name: '⚠️ No services found in this category',
						value: '',
						description: 'Try selecting "All Services" or switch to "Custom" mode',
					},
				];
			}

			return options;

		} catch (error) {
			// If service discovery fails completely, return common services
			const { getCommonServices } = await import('./DiscoveryService');
			const commonServices = getCommonServices();

			return [
				{
					name: '⚠️ Service discovery failed - Showing common services',
					value: '',
					description: 'Switch to "Custom" mode to enter service path manually',
				},
				...commonServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description,
				})),
			];
		}
	},

	// Get Entity Sets from $metadata (with caching)
	async getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const credentials = await this.getCredentials('sapOdataApi');
			const { CacheManager } = await import('../Shared/utils/CacheManager');

			// Get servicePath from current node parameter
			const servicePath = this.getCurrentNodeParameter('servicePath') as string || '/sap/opu/odata/sap/';

			// Try to get from cache first
			const cached = await CacheManager.getMetadata(
				this,
				credentials.host as string,
				servicePath,
			);

			if (cached && cached.entitySets) {
				return cached.entitySets.map((entitySet) => ({
					name: entitySet,
					value: entitySet,
				}));
			}

			// Fetch from API if not cached
			const metadataXml = await sapOdataApiRequest.call(this, 'GET', '/$metadata');
			const entitySets = parseMetadataForEntitySets(
				typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
			);
			const functionImports = parseMetadataForFunctionImports(
				typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
			);

			// Cache the metadata
			await CacheManager.setMetadata(
				this,
				credentials.host as string,
				servicePath,
				entitySets,
				functionImports,
			);

			return entitySets.map((entitySet) => ({
				name: entitySet,
				value: entitySet,
			}));
		} catch (error) {
			// If metadata fetch fails, return helpful message
			// User can switch to "Custom" mode to manually enter entity set name
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return [
				{
					name: `⚠️ Could not load entity sets - ${errorMessage.substring(0, 60)}`,
					value: '',
					description: 'Switch to "Custom" mode in "Entity Set Mode" to enter the name manually',
				},
			];
		}
	},

	// Get Function Imports from $metadata (with caching)
	async getFunctionImports(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const credentials = await this.getCredentials('sapOdataApi');
			const { CacheManager } = await import('../Shared/utils/CacheManager');

			// Get servicePath from current node parameter
			const servicePath = this.getCurrentNodeParameter('servicePath') as string || '/sap/opu/odata/sap/';

			// Try to get from cache first
			const cached = await CacheManager.getMetadata(
				this,
				credentials.host as string,
				servicePath,
			);

			if (cached && cached.functionImports) {
				return cached.functionImports.map((functionImport) => ({
					name: functionImport,
					value: functionImport,
				}));
			}

			// Fetch from API if not cached
			const metadataXml = await sapOdataApiRequest.call(this, 'GET', '/$metadata');
			const entitySets = parseMetadataForEntitySets(
				typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
			);
			const functionImports = parseMetadataForFunctionImports(
				typeof metadataXml === 'string' ? metadataXml : JSON.stringify(metadataXml),
			);

			// Cache the metadata
			await CacheManager.setMetadata(
				this,
				credentials.host as string,
				servicePath,
				entitySets,
				functionImports,
			);

			return functionImports.map((functionImport) => ({
				name: functionImport,
				value: functionImport,
			}));
		} catch (error) {
			// If metadata fetch fails, return helpful message
			// User can switch to "Custom" mode to manually enter function import name
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return [
				{
					name: `⚠️ Could not load function imports - ${errorMessage.substring(0, 60)}`,
					value: '',
					description: 'Switch to "Custom" mode in "Function Name Mode" to enter the name manually',
				},
			];
		}
	},
};
