/**
 * SAP OData Node - Load Options Methods
 *
 * This file contains all dynamic dropdown population logic.
 * Extracted from the main node file for better maintainability.
 */

import {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { LoggerAdapter } from '../../lib/utils/LoggerAdapter';
import {
	parseMetadataForEntitySets,
	parseMetadataForFunctionImports,
	resolveServicePath,
	sapOdataApiRequest,
} from './GenericFunctions';

export const sapODataLoadOptions = {
	// Get available SAP OData Services
	async getServices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const { discoverServices, getCommonServices } = await import('./DiscoveryService');
			const { CacheManager } = await import('../../lib/utils/CacheManager');
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

	// Get Discovered Services (auto-discover mode) - directly from SAP Gateway Catalog
	async getDiscoveredServices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const { discoverServices, getCommonServices } = await import('./DiscoveryService');
			const { CacheManager } = await import('../../lib/utils/CacheManager');
			const credentials = await this.getCredentials('sapOdataApi');

			// Try to get from cache first
			const cached = await CacheManager.getServiceCatalog(this, credentials.host as string);

			if (cached && cached.length > 0) {
				return cached.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description || 'No description available',
				}));
			}

			// Try to discover services from SAP Gateway Catalog Service
			const discoveredServices = await discoverServices(this);

			if (discoveredServices && discoveredServices.length > 0) {
				// Cache the discovered services
				await CacheManager.setServiceCatalog(this, credentials.host as string, discoveredServices);

				// Sort services: Standard SAP services (API_*, C_*) before Custom Z-services (Z*, Y*)
				// This ensures standard services are selected by default
				const sortedServices = discoveredServices.sort((a, b) => {
					const aIsStandard = a.technicalName.startsWith('API_') || a.technicalName.startsWith('C_');
					const bIsStandard = b.technicalName.startsWith('API_') || b.technicalName.startsWith('C_');
					const aIsCustom = a.technicalName.startsWith('Z') || a.technicalName.startsWith('Y');
					const bIsCustom = b.technicalName.startsWith('Z') || b.technicalName.startsWith('Y');

					// Standard services come first
					if (aIsStandard && !bIsStandard) return -1;
					if (!aIsStandard && bIsStandard) return 1;

					// Custom services come last
					if (aIsCustom && !bIsCustom) return 1;
					if (!aIsCustom && bIsCustom) return -1;

					// Otherwise alphabetical
					return a.technicalName.localeCompare(b.technicalName);
				});

				return sortedServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description || 'No description available',
				}));
			}

			// Fallback: Return common SAP services if catalog discovery fails
			const commonServices = getCommonServices();

			// Return services with warning message at the end (not as first item to avoid empty selection)
			return [
				...commonServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description || 'No description available',
				})),
				{
					name: '─────────────────────────────────',
					value: commonServices[0]?.servicePath || '/sap/opu/odata/sap/',
					description: 'Separator',
				},
				{
					name: '⚠️ Auto-discovery unavailable - Using common services list',
					value: commonServices[0]?.servicePath || '/sap/opu/odata/sap/',
					description: 'Check credentials and Gateway Catalog Service (/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/) access or switch to Custom mode',
				},
			];
		} catch (error) {
			// If service discovery fails completely, return common services
			const { getCommonServices } = await import('./DiscoveryService');
			const commonServices = getCommonServices();

			// Return services with warning message at the end (not as first item to avoid empty selection)
			return [
				...commonServices.map((service) => ({
					name: `${service.title} (${service.technicalName})`,
					value: service.servicePath,
					description: service.description || 'No description available',
				})),
				{
					name: '─────────────────────────────────',
					value: commonServices[0]?.servicePath || '/sap/opu/odata/sap/',
					description: 'Separator',
				},
				{
					name: '⚠️ Auto-discovery failed - Using common services list',
					value: commonServices[0]?.servicePath || '/sap/opu/odata/sap/',
					description: 'Check connection or switch to "Custom" mode to enter service path manually',
				},
			];
		}
	},

	// Get Entity Sets from $metadata (with caching)
	async getEntitySets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const credentials = await this.getCredentials('sapOdataApi');
			const { CacheManager } = await import('../../lib/utils/CacheManager');

			// Try to resolve service path from multiple possible sources
			// n8n's getCurrentNodeParameter sometimes returns undefined for dependent dropdowns
			let servicePath = '';

			// Try both modes to find the service path
			const servicePathMode = (this.getCurrentNodeParameter('servicePathMode') as string) || '';

			LoggerAdapter.debug('Resolving service path', {
				module: 'LoadOptions',
				operation: 'getEntitySets',
				servicePathMode,
			});

			if (servicePathMode === 'discover') {
				servicePath = (this.getCurrentNodeParameter('discoveredService') as string) || '';
			} else if (servicePathMode === 'custom') {
				servicePath = (this.getCurrentNodeParameter('servicePath') as string) || '';
			}

			// Fallback: try all parameters if mode-specific one is empty
			if (!servicePath || servicePath === '') {
				const discovered = (this.getCurrentNodeParameter('discoveredService') as string) || '';
				const custom = (this.getCurrentNodeParameter('servicePath') as string) || '';
				servicePath = discovered || custom || '';

				LoggerAdapter.debug('Used fallback service path resolution', {
					module: 'LoadOptions',
					operation: 'getEntitySets',
					resolvedPath: servicePath,
				});
			}

			// Validate that we have a specific service path (not just the base path)
			if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap' || servicePath === '/sap/opu/odata/sap/') {
				return [
					{
						name: '⚠️ No service selected',
						value: '',
						description: 'Please select a service from the "Service" dropdown above first',
					},
				];
			}

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

			// Check if this is a 403 Forbidden error
			const isForbidden = errorMessage.toLowerCase().includes('forbidden') ||
				errorMessage.toLowerCase().includes('403');

			if (isForbidden) {
				return [
					{
						name: '⚠️ Access Forbidden - Missing SAP Authorizations',
						value: '',
						description: 'Your SAP user lacks permissions for this service. Contact SAP Administrator or switch to "Custom" mode',
					},
				];
			}

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
			const { CacheManager } = await import('../../lib/utils/CacheManager');

			// Use centralized service path resolver (no duplication)
			const servicePath = resolveServicePath(this);

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

/**
 * List Search Methods for Resource Locator
 *
 * These methods support searchable dropdowns with filtering capability.
 * Used by resourceLocator type fields.
 */
export const sapODataListSearch = {
	/**
	 * Search SAP OData Services from Gateway Catalog with filtering support
	 *
	 * @param filter - Optional search filter string
	 * @param _paginationToken - Optional pagination token (not used)
	 * @returns Search results with service name, path, and URL
	 */
	async servicePathSearch(
		this: ILoadOptionsFunctions,
		filter?: string,
		_paginationToken?: unknown,
	): Promise<INodeListSearchResult> {
		try {
			const { discoverServices, getCommonServices } = await import('./DiscoveryService');
			const { CacheManager } = await import('../../lib/utils/CacheManager');
			const credentials = await this.getCredentials('sapOdataApi');
			const host = credentials.host as string;

			// Try to get from cache first
			let services = await CacheManager.getServiceCatalog(this, host);

			if (!services || services.length === 0) {
				// Try to discover services from SAP Gateway Catalog Service
				const discoveredServices = await discoverServices(this);

				if (discoveredServices && discoveredServices.length > 0) {
					// Cache the discovered services
					await CacheManager.setServiceCatalog(this, host, discoveredServices);
					services = discoveredServices;
				} else {
					// Fallback: Use common SAP services
					services = getCommonServices();
				}
			}

			// Apply filter if provided
			let filteredServices = services;
			if (filter) {
				const lowerFilter = filter.toLowerCase();
				filteredServices = services.filter(
					(service) =>
						service.title.toLowerCase().includes(lowerFilter) ||
						service.technicalName.toLowerCase().includes(lowerFilter) ||
						service.servicePath.toLowerCase().includes(lowerFilter),
				);
			}

			// Sort: Standard SAP services first, then custom Z-services
			filteredServices.sort((a, b) => {
				const aIsStandard = a.technicalName.startsWith('API_') || a.technicalName.startsWith('C_');
				const bIsStandard = b.technicalName.startsWith('API_') || b.technicalName.startsWith('C_');
				if (aIsStandard && !bIsStandard) return -1;
				if (!aIsStandard && bIsStandard) return 1;
				return a.technicalName.localeCompare(b.technicalName);
			});

			// Build results
			const results: INodeListSearchItems[] = filteredServices.map((service) => ({
				name: `${service.title} (${service.technicalName})`,
				value: service.servicePath,
				url: `${host}${service.servicePath}`,
			}));

			return { results };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Fallback to common services on error
			const { getCommonServices } = await import('./DiscoveryService');
			const commonServices = getCommonServices();

			return {
				results: [
					{
						name: `⚠️ Discovery failed: ${errorMessage.substring(0, 40)}`,
						value: '',
					},
					...commonServices.map((service) => ({
						name: `${service.title} (${service.technicalName})`,
						value: service.servicePath,
					})),
				],
			};
		}
	},

	/**
	 * Search Entity Sets from $metadata with filtering support
	 *
	 * @param filter - Optional search filter string
	 * @param paginationToken - Optional pagination token (not used for metadata)
	 * @returns Search results with name, value, and optional URL
	 */
	async entitySetSearch(
		this: ILoadOptionsFunctions,
		filter?: string,
		_paginationToken?: unknown,
	): Promise<INodeListSearchResult> {
		try {
			const credentials = await this.getCredentials('sapOdataApi');
			const { CacheManager } = await import('../../lib/utils/CacheManager');

			// Get service path from resourceLocator
			const servicePathParam = this.getCurrentNodeParameter('servicePath') as
				| string
				| { mode: string; value: string }
				| undefined;

			let servicePath = '';
			if (typeof servicePathParam === 'object' && servicePathParam !== null) {
				servicePath = servicePathParam.value || '';
			} else if (typeof servicePathParam === 'string') {
				servicePath = servicePathParam;
			}

			// Validate that we have a specific service path
			if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap' || servicePath === '/sap/opu/odata/sap/') {
				return {
					results: [{
						name: '⚠️ No service selected - Please select a service first',
						value: '',
					}],
				};
			}

			// Get entity sets from cache or API
			let entitySets: string[] = [];

			// Try to get from cache first
			const cached = await CacheManager.getMetadata(
				this,
				credentials.host as string,
				servicePath,
			);

			if (cached && cached.entitySets) {
				entitySets = cached.entitySets;
			} else {
				// Fetch from API if not cached
				const metadataXml = await sapOdataApiRequest.call(this, 'GET', '/$metadata');
				entitySets = parseMetadataForEntitySets(
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
			}

			// Apply filter if provided
			let filteredEntitySets = entitySets;
			if (filter) {
				const lowerFilter = filter.toLowerCase();
				filteredEntitySets = entitySets.filter(
					(entitySet) => entitySet.toLowerCase().includes(lowerFilter),
				);
			}

			// Build OData URL for each entity set
			const host = credentials.host as string;
			const results: INodeListSearchItems[] = filteredEntitySets.map((entitySet) => ({
				name: entitySet,
				value: entitySet,
				url: `${host}${servicePath}${entitySet}`,
			}));

			return { results };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			// Check if this is a 403 Forbidden error
			const isForbidden = errorMessage.toLowerCase().includes('forbidden') ||
				errorMessage.toLowerCase().includes('403');

			if (isForbidden) {
				return {
					results: [{
						name: '⚠️ Access Forbidden - Missing SAP Authorizations',
						value: '',
					}],
				};
			}

			return {
				results: [{
					name: `⚠️ Error: ${errorMessage.substring(0, 50)}`,
					value: '',
				}],
			};
		}
	},
};
