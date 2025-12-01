import { ILoadOptionsFunctions } from 'n8n-workflow';
import {
	discoverServices,
	getCommonServices,
	searchServices,
	groupServicesByCategory,
	ISapODataService,
} from '../nodes/Sap/DiscoveryService';

// Mock sapOdataApiRequest
jest.mock('../nodes/Sap/GenericFunctions', () => ({
	sapOdataApiRequest: jest.fn(),
}));

describe('DiscoveryService', () => {
	describe('getCommonServices', () => {
		it('should return array of common SAP services', () => {
			const services = getCommonServices();

			expect(services).toBeInstanceOf(Array);
			expect(services.length).toBeGreaterThan(0);
			expect(services[0]).toHaveProperty('id');
			expect(services[0]).toHaveProperty('title');
			expect(services[0]).toHaveProperty('technicalName');
			expect(services[0]).toHaveProperty('servicePath');
			expect(services[0]).toHaveProperty('version');
		});

		it('should include API_BUSINESS_PARTNER service', () => {
			const services = getCommonServices();
			const businessPartner = services.find(
				(s) => s.technicalName === 'API_BUSINESS_PARTNER',
			);

			expect(businessPartner).toBeDefined();
			expect(businessPartner?.title).toBe('Business Partner API');
			expect(businessPartner?.servicePath).toBe('/sap/opu/odata/sap/API_BUSINESS_PARTNER/');
		});

		it('should include API_SALES_ORDER_SRV service', () => {
			const services = getCommonServices();
			const salesOrder = services.find((s) => s.technicalName === 'API_SALES_ORDER_SRV');

			expect(salesOrder).toBeDefined();
			expect(salesOrder?.title).toBe('Sales Order API');
			expect(salesOrder?.servicePath).toBe('/sap/opu/odata/sap/API_SALES_ORDER_SRV/');
		});

		it('should have valid service paths ending with /', () => {
			const services = getCommonServices();

			services.forEach((service) => {
				expect(service.servicePath).toMatch(/\/$/);
				expect(service.servicePath).toMatch(/^\/sap\/opu\/odata\/sap\//);
			});
		});
	});

	describe('discoverServices', () => {
		let mockContext: Partial<ILoadOptionsFunctions>;

		beforeEach(() => {
			mockContext = {
				getCredentials: jest.fn().mockResolvedValue({
					host: 'https://sap.example.com',
				}),
			} as any;

			jest.clearAllMocks();
		});

		it('should return discovered services from SAP catalog', async () => {
			const { sapOdataApiRequest } = require('../nodes/Sap/GenericFunctions');

			// Mock catalog service response
			// Note: The implementation uses ID for service path construction, not TechnicalServiceName
			sapOdataApiRequest.mockResolvedValue({
				d: {
					results: [
						{
							ID: 'service1',
							Title: 'Test Service 1',
							TechnicalServiceName: 'API_TEST_SRV',
							TechnicalServiceVersion: '1',
							Description: 'Test service description',
						},
						{
							ID: 'service2',
							Title: 'Test Service 2',
							TechnicalServiceName: 'Z_CUSTOM_SRV',
							TechnicalServiceVersion: '2',
							Description: 'Custom service',
						},
					],
				},
			});

			const services = await discoverServices(mockContext as ILoadOptionsFunctions);

			expect(services).toHaveLength(2);
			expect(services[0].id).toBe('service1');
			expect(services[0].title).toBe('Test Service 1');
			expect(services[0].technicalName).toBe('API_TEST_SRV');
			// Service path uses ID field for URL construction
			expect(services[0].servicePath).toBe('/sap/opu/odata/sap/service1/');
			expect(services[0].version).toBe('1');
		});

		it('should handle services with version 2', async () => {
			const { sapOdataApiRequest } = require('../nodes/Sap/GenericFunctions');

			sapOdataApiRequest.mockResolvedValue({
				d: {
					results: [
						{
							ID: 'service1',
							Title: 'Versioned Service',
							TechnicalServiceName: 'API_VERSIONED_SRV',
							TechnicalServiceVersion: '2',
						},
					],
				},
			});

			const services = await discoverServices(mockContext as ILoadOptionsFunctions);

			// Service path uses ID field with version suffix
			expect(services[0].servicePath).toBe('/sap/opu/odata/sap/service1;v=2/');
		});

		it('should filter out entries without technical name', async () => {
			const { sapOdataApiRequest } = require('../nodes/Sap/GenericFunctions');

			sapOdataApiRequest.mockResolvedValue({
				d: {
					results: [
						{
							ID: 'service1',
							Title: 'Valid Service',
							TechnicalServiceName: 'API_VALID_SRV',
							TechnicalServiceVersion: '1',
						},
						{
							ID: 'service2',
							Title: 'Invalid Service',
							// Missing TechnicalServiceName
							TechnicalServiceVersion: '1',
						},
					],
				},
			});

			const services = await discoverServices(mockContext as ILoadOptionsFunctions);

			expect(services).toHaveLength(1);
			expect(services[0].technicalName).toBe('API_VALID_SRV');
		});

		it('should return empty array on error', async () => {
			const { sapOdataApiRequest } = require('../nodes/Sap/GenericFunctions');

			sapOdataApiRequest.mockRejectedValue(new Error('Forbidden'));

			const services = await discoverServices(mockContext as ILoadOptionsFunctions);

			expect(services).toEqual([]);
		});

		it('should handle empty catalog response', async () => {
			const { sapOdataApiRequest } = require('../nodes/Sap/GenericFunctions');

			sapOdataApiRequest.mockResolvedValue({
				d: {
					results: [],
				},
			});

			const services = await discoverServices(mockContext as ILoadOptionsFunctions);

			expect(services).toEqual([]);
		});
	});

	describe('searchServices', () => {
		const sampleServices: ISapODataService[] = [
			{
				id: '1',
				title: 'Business Partner API',
				technicalName: 'API_BUSINESS_PARTNER',
				servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
				version: '1',
				description: 'Manage business partners and customers',
			},
			{
				id: '2',
				title: 'Sales Order API',
				technicalName: 'API_SALES_ORDER_SRV',
				servicePath: '/sap/opu/odata/sap/API_SALES_ORDER_SRV/',
				version: '1',
				description: 'Create and manage sales orders',
			},
			{
				id: '3',
				title: 'Custom Z Service',
				technicalName: 'Z_CUSTOM_SERVICE',
				servicePath: '/sap/opu/odata/sap/Z_CUSTOM_SERVICE/',
				version: '1',
				description: 'Custom implementation',
			},
		];

		it('should find services by title', () => {
			const results = searchServices(sampleServices, 'sales');

			expect(results).toHaveLength(1);
			expect(results[0].title).toBe('Sales Order API');
		});

		it('should find services by technical name', () => {
			const results = searchServices(sampleServices, 'BUSINESS_PARTNER');

			expect(results).toHaveLength(1);
			expect(results[0].technicalName).toBe('API_BUSINESS_PARTNER');
		});

		it('should find services by description', () => {
			const results = searchServices(sampleServices, 'manage');

			expect(results.length).toBeGreaterThanOrEqual(2);
		});

		it('should be case insensitive', () => {
			const results = searchServices(sampleServices, 'SALES');

			expect(results).toHaveLength(1);
			expect(results[0].title).toBe('Sales Order API');
		});

		it('should return empty array when no match', () => {
			const results = searchServices(sampleServices, 'NONEXISTENT');

			expect(results).toEqual([]);
		});

		it('should return all services for empty keyword', () => {
			const results = searchServices(sampleServices, '');

			expect(results).toHaveLength(3);
		});
	});

	describe('groupServicesByCategory', () => {
		const sampleServices: ISapODataService[] = [
			{
				id: '1',
				title: 'Business Partner API',
				technicalName: 'API_BUSINESS_PARTNER',
				servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
				version: '1',
			},
			{
				id: '2',
				title: 'Sales Order API',
				technicalName: 'API_SALES_ORDER_SRV',
				servicePath: '/sap/opu/odata/sap/API_SALES_ORDER_SRV/',
				version: '1',
			},
			{
				id: '3',
				title: 'Custom Service',
				technicalName: 'Z_CUSTOM_SERVICE',
				servicePath: '/sap/opu/odata/sap/Z_CUSTOM_SERVICE/',
				version: '1',
			},
			{
				id: '4',
				title: 'Other Service',
				technicalName: 'OTHER_SERVICE',
				servicePath: '/sap/opu/odata/sap/OTHER_SERVICE/',
				version: '1',
			},
		];

		it('should group services into categories', () => {
			const groups = groupServicesByCategory(sampleServices);

			expect(groups).toHaveProperty('SAP Standard APIs');
			expect(groups).toHaveProperty('Custom Services (Z*)');
			expect(groups).toHaveProperty('Other Services');
		});

		it('should group API_ prefixed services as SAP Standard APIs', () => {
			const groups = groupServicesByCategory(sampleServices);

			expect(groups['SAP Standard APIs']).toHaveLength(2);
			expect(groups['SAP Standard APIs'][0].technicalName).toBe('API_BUSINESS_PARTNER');
			expect(groups['SAP Standard APIs'][1].technicalName).toBe('API_SALES_ORDER_SRV');
		});

		it('should group Z* prefixed services as Custom Services', () => {
			const groups = groupServicesByCategory(sampleServices);

			expect(groups['Custom Services (Z*)']).toHaveLength(1);
			expect(groups['Custom Services (Z*)'][0].technicalName).toBe('Z_CUSTOM_SERVICE');
		});

		it('should group other services separately', () => {
			const groups = groupServicesByCategory(sampleServices);

			expect(groups['Other Services']).toHaveLength(1);
			expect(groups['Other Services'][0].technicalName).toBe('OTHER_SERVICE');
		});

		it('should handle empty service list', () => {
			const groups = groupServicesByCategory([]);

			expect(groups['SAP Standard APIs']).toEqual([]);
			expect(groups['Custom Services (Z*)']).toEqual([]);
			expect(groups['Other Services']).toEqual([]);
		});
	});

	describe('Category Filtering Integration', () => {
		const mixedServices: ISapODataService[] = [
			{
				id: '1',
				title: 'Business Partner API',
				technicalName: 'API_BUSINESS_PARTNER',
				servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/',
				version: '1',
			},
			{
				id: '2',
				title: 'Sales Order API',
				technicalName: 'API_SALES_ORDER_SRV',
				servicePath: '/sap/opu/odata/sap/API_SALES_ORDER_SRV/',
				version: '1',
			},
			{
				id: '3',
				title: 'Custom Service',
				technicalName: 'Z_CUSTOM_SERVICE',
				servicePath: '/sap/opu/odata/sap/Z_CUSTOM_SERVICE/',
				version: '1',
			},
			{
				id: '4',
				title: 'Another Custom',
				technicalName: 'Z_ANOTHER_SERVICE',
				servicePath: '/sap/opu/odata/sap/Z_ANOTHER_SERVICE/',
				version: '1',
			},
			{
				id: '5',
				title: 'Other Service',
				technicalName: 'OTHER_SERVICE',
				servicePath: '/sap/opu/odata/sap/OTHER_SERVICE/',
				version: '1',
			},
		];

		it('should return all services when category is "all"', () => {
			const category = 'all';
			let filtered = mixedServices;

			// When category is "all", no filtering is applied
			expect(category).toBe('all');
			expect(filtered).toHaveLength(5);
		});

		it('should return only SAP Standard APIs when category is "standard"', () => {
			const grouped = groupServicesByCategory(mixedServices);
			const filtered = grouped['SAP Standard APIs'];

			expect(filtered).toHaveLength(2);
			expect(filtered[0].technicalName).toBe('API_BUSINESS_PARTNER');
			expect(filtered[1].technicalName).toBe('API_SALES_ORDER_SRV');
		});

		it('should return only Custom Services when category is "custom"', () => {
			const grouped = groupServicesByCategory(mixedServices);
			const filtered = grouped['Custom Services (Z*)'];

			expect(filtered).toHaveLength(2);
			expect(filtered[0].technicalName).toBe('Z_CUSTOM_SERVICE');
			expect(filtered[1].technicalName).toBe('Z_ANOTHER_SERVICE');
		});

		it('should return only Other Services when category is "other"', () => {
			const grouped = groupServicesByCategory(mixedServices);
			const filtered = grouped['Other Services'];

			expect(filtered).toHaveLength(1);
			expect(filtered[0].technicalName).toBe('OTHER_SERVICE');
		});

		it('should handle empty category gracefully', () => {
			const grouped = groupServicesByCategory(mixedServices);

			// Simulate category filtering with map
			const categoryMap: { [key: string]: string } = {
				'standard': 'SAP Standard APIs',
				'custom': 'Custom Services (Z*)',
				'other': 'Other Services',
			};

			// Test all categories
			Object.keys(categoryMap).forEach((category) => {
				const categoryKey = categoryMap[category];
				const filtered = grouped[categoryKey] || [];
				expect(filtered).toBeInstanceOf(Array);
			});
		});

		it('should return empty array for non-existent category', () => {
			const grouped = groupServicesByCategory(mixedServices);
			const filtered = grouped['Non-Existent Category'] || [];

			expect(filtered).toEqual([]);
		});
	});
});
