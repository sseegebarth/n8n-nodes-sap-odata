import { ILoadOptionsFunctions } from 'n8n-workflow';

/**
 * DiscoveryService - SAP OData Service Discovery
 *
 * Provides methods to discover available SAP OData services using the SAP Gateway Catalog Service.
 * The CATALOGSERVICE endpoint lists all activated OData services on the SAP system.
 *
 * @module DiscoveryService
 */

const CATALOGSERVICE_PATH = '/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/';

export interface ISapODataService {
	id: string;
	title: string;
	technicalName: string;
	servicePath: string;
	version: string;
	description?: string;
}

export interface IServiceCollectionEntry {
	ID?: string;
	Title?: string;
	TechnicalServiceName?: string;
	TechnicalServiceVersion?: string;
	Description?: string;
}

/**
 * Fetch all available OData services from SAP Gateway Catalog Service
 *
 * @param context - n8n Load Options context
 * @returns Array of available SAP OData services
 */
export async function discoverServices(
	context: ILoadOptionsFunctions,
): Promise<ISapODataService[]> {
	try {
		// Import sapOdataApiRequest dynamically to avoid circular dependencies
		const { sapOdataApiRequest } = await import('./GenericFunctions');

		// Query the catalog service for all services
		// We use $select to only get the fields we need
		const response = await sapOdataApiRequest.call(
			context,
			'GET',
			'/ServiceCollection',
			{},
			{
				$select: 'ID,Title,TechnicalServiceName,TechnicalServiceVersion,Description',
				$orderby: 'Title asc',
			},
			undefined, // uri parameter
			{}, // option parameter
			CATALOGSERVICE_PATH, // customServicePath - Override service path to use CATALOGSERVICE
		);

		// Extract results from OData V2 response format
		const results = response?.d?.results || [];

		// Transform catalog entries to our service format
		const services: ISapODataService[] = results
			.filter((entry: IServiceCollectionEntry) => {
				// Filter out empty or invalid entries
				return entry.TechnicalServiceName && entry.ID;
			})
			.map((entry: IServiceCollectionEntry) => {
				// Construct the service path
				// SAP service paths typically follow: /sap/opu/odata/sap/SERVICE_NAME/
				const servicePath = constructServicePath(
					entry.TechnicalServiceName!,
					entry.TechnicalServiceVersion,
				);

				return {
					id: entry.ID!,
					title: entry.Title || entry.TechnicalServiceName || 'Unknown Service',
					technicalName: entry.TechnicalServiceName!,
					servicePath,
					version: entry.TechnicalServiceVersion || '1',
					description: entry.Description,
				};
			});

		return services;
	} catch (error) {
		// If catalog service is not available or user lacks permissions,
		// return empty array to allow fallback to manual input
		return [];
	}
}

/**
 * Construct SAP OData service path from technical name and version
 *
 * @param technicalName - Technical service name (e.g., "API_SALES_ORDER_SRV")
 * @param version - Service version (optional)
 * @returns Full service path (e.g., "/sap/opu/odata/sap/API_SALES_ORDER_SRV/")
 */
function constructServicePath(technicalName: string, version?: string): string {
	// Standard SAP OData service path pattern
	let path = `/sap/opu/odata/sap/${technicalName}/`;

	// Some services include version in the path
	// Example: /sap/opu/odata/sap/SERVICE_NAME;v=2/
	if (version && version !== '1') {
		path = `/sap/opu/odata/sap/${technicalName};v=${version}/`;
	}

	return path;
}

/**
 * Get common SAP OData services as fallback when catalog is unavailable
 * These are the most commonly used SAP standard APIs
 *
 * @returns Array of common SAP OData services
 */
export function getCommonServices(): ISapODataService[] {
	return [
		{
			id: 'api_business_partner',
			title: 'Business Partner API',
			technicalName: 'API_BUSINESS_PARTNER',
			servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
			version: '1',
			description: 'Manage business partners, customers, and suppliers',
		},
		{
			id: 'api_sales_order',
			title: 'Sales Order API',
			technicalName: 'API_SALES_ORDER_SRV',
			servicePath: '/sap/opu/odata/sap/API_SALES_ORDER_SRV/',
			version: '1',
			description: 'Create, read, update sales orders',
		},
		{
			id: 'api_purchase_order',
			title: 'Purchase Order API',
			technicalName: 'API_PURCHASEORDER_PROCESS_SRV',
			servicePath: '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/',
			version: '1',
			description: 'Manage purchase orders',
		},
		{
			id: 'api_material_document',
			title: 'Material Document API',
			technicalName: 'API_MATERIAL_DOCUMENT_SRV',
			servicePath: '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/',
			version: '1',
			description: 'Post goods movements and inventory transactions',
		},
		{
			id: 'api_product',
			title: 'Product Master API',
			technicalName: 'API_PRODUCT_SRV',
			servicePath: '/sap/opu/odata/sap/API_PRODUCT_SRV/',
			version: '1',
			description: 'Manage product master data',
		},
		{
			id: 'api_invoice',
			title: 'Invoice API',
			technicalName: 'API_BILLING_DOCUMENT_SRV',
			servicePath: '/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/',
			version: '1',
			description: 'Create and manage billing documents and invoices',
		},
		{
			id: 'api_delivery',
			title: 'Delivery API',
			technicalName: 'API_OUTBOUND_DELIVERY_SRV',
			servicePath: '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV/',
			version: '1',
			description: 'Manage outbound deliveries',
		},
		// Custom Service Examples (Z-Namespace)
		{
			id: 'z_custom_service',
			title: 'Custom Service Example',
			technicalName: 'Z_CUSTOM_SERVICE',
			servicePath: '/sap/opu/odata/sap/Z_CUSTOM_SERVICE/',
			version: '1',
			description: 'Customer-specific service (example)',
		},
		{
			id: 'y_custom_service',
			title: 'Y-Namespace Example',
			technicalName: 'Y_CUSTOM_API',
			servicePath: '/sap/opu/odata/sap/Y_CUSTOM_API/',
			version: '1',
			description: 'Customer-specific Y-namespace service (example)',
		},
	];
}

/**
 * Search services by keyword in title or technical name
 *
 * @param services - Array of services to search
 * @param keyword - Search keyword
 * @returns Filtered services matching the keyword
 */
export function searchServices(
	services: ISapODataService[],
	keyword: string,
): ISapODataService[] {
	const lowerKeyword = keyword.toLowerCase();

	return services.filter(
		(service) =>
			service.title.toLowerCase().includes(lowerKeyword) ||
			service.technicalName.toLowerCase().includes(lowerKeyword) ||
			service.description?.toLowerCase().includes(lowerKeyword),
	);
}

/**
 * Group services by common prefixes (API_, Z*, etc.)
 *
 * @param services - Array of services to group
 * @returns Grouped services by category
 */
export function groupServicesByCategory(
	services: ISapODataService[],
): Record<string, ISapODataService[]> {
	const groups: Record<string, ISapODataService[]> = {
		'SAP Standard APIs': [],
		'Custom Services (Z*)': [],
		'Other Services': [],
	};

	services.forEach((service) => {
		// Check for standard API prefix in both technicalName and title
		const isStandardAPI = service.technicalName.startsWith('API_') ||
		                      service.technicalName.startsWith('C_') ||
		                      service.title.startsWith('API_') ||
		                      service.title.startsWith('C_');

		// ZAPI_* and ZC_* are custom wrappers around standard APIs - treat as standard
		const isWrappedStandardAPI = /^Z(API_|C_)/.test(service.technicalName);

		if (isStandardAPI || isWrappedStandardAPI) {
			groups['SAP Standard APIs'].push(service);
		} else if (service.technicalName.startsWith('Z') || service.technicalName.startsWith('Y')) {
			groups['Custom Services (Z*)'].push(service);
		} else {
			groups['Other Services'].push(service);
		}
	});

	return groups;
}
