import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	NodeOperationError,
} from 'n8n-workflow';

type IContextType = IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions;

/**
 * Resource Locator value structure for servicePath
 */
interface IResourceLocatorValue {
	mode: string;
	value: string;
	__rl?: boolean;
}

/**
 * Centralized service path resolver
 * Supports both resourceLocator format and legacy string format
 *
 * @param context - n8n execution context
 * @param customServicePath - Optional custom service path to use instead of node parameters
 * @param itemIndex - Item index for multi-item executions (default: 0)
 * @returns Resolved service path with trailing slash removed
 */
export function resolveServicePath(
	context: IContextType,
	customServicePath?: string,
	itemIndex = 0,
): string {
	// If custom path provided, use it
	if (customServicePath) {
		return customServicePath.replace(/\/$/, '');
	}

	// Default service path
	let servicePath = '/sap/opu/odata/sap/';

	try {
		// Handle IExecuteFunctions and IHookFunctions (have getNodeParameter)
		if ('getNodeParameter' in context) {
			const servicePathParam = context.getNodeParameter('servicePath', itemIndex, null) as
				| string
				| IResourceLocatorValue
				| null;

			if (servicePathParam !== null) {
				// Handle resourceLocator format: { mode: 'list'|'path'|'url', value: '/sap/...' }
				if (typeof servicePathParam === 'object' && servicePathParam !== null) {
					servicePath = servicePathParam.value || '';
				} else {
					// Direct string value (for backwards compatibility)
					servicePath = servicePathParam as string;
				}
			}

			// Validate that a service was actually selected
			if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap/') {
				throw new NodeOperationError(
					context.getNode(),
					'No service selected. Please select a service from the list or enter a path manually.',
					{
						description:
							'Select a service from the dropdown (From List mode) or enter the service path manually (By Path mode). Example: /sap/opu/odata/sap/API_BUSINESS_PARTNER/',
						itemIndex,
					},
				);
			}
		}
		// Handle ILoadOptionsFunctions (have getCurrentNodeParameter)
		else if ('getCurrentNodeParameter' in context) {
			const loadContext = context as ILoadOptionsFunctions;
			const servicePathParam = loadContext.getCurrentNodeParameter('servicePath') as
				| string
				| IResourceLocatorValue
				| undefined;

			if (servicePathParam) {
				// Handle resourceLocator format
				if (typeof servicePathParam === 'object' && servicePathParam !== null) {
					servicePath = servicePathParam.value || servicePath;
				} else {
					servicePath = servicePathParam || servicePath;
				}
			}
		}
	} catch (error) {
		// Re-throw NodeOperationError from validation above
		if (error instanceof NodeOperationError) {
			throw error;
		}
		// If parameter doesn't exist (e.g., old workflows), fallback to default
		if (error instanceof Error && error.message.includes('not found')) {
			servicePath = '/sap/opu/odata/sap/';
		} else {
			throw error;
		}
	}

	// Remove trailing slash for consistency
	return servicePath.replace(/\/$/, '');
}
