import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	NodeOperationError,
} from 'n8n-workflow';

type IContextType = IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions;

/**
 * Centralized service path resolver
 * Detects servicePathMode and returns the appropriate path
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
			const servicePathMode = context.getNodeParameter('servicePathMode', itemIndex, 'discover') as string;

			if (servicePathMode === 'discover') {
				servicePath = context.getNodeParameter('discoveredService', itemIndex, '') as string;
				// Validate that a service was actually selected in discover mode
				if (!servicePath || servicePath === '') {
					throw new NodeOperationError(
						context.getNode(),
						'No service selected. Please select a service from the Auto-Discover dropdown.',
						{
							description:
								'The Auto-Discover mode requires selecting a service from the list. If no services appear, check your SAP Gateway Catalog Service access or switch to "Custom" mode to enter the service path manually.',
							itemIndex,
						},
					);
				}
			} else if (servicePathMode === 'list') {
				servicePath = context.getNodeParameter('servicePathFromList', itemIndex, servicePath) as string;
			} else {
				servicePath = context.getNodeParameter('servicePath', itemIndex, servicePath) as string;
			}
		}
		// Handle ILoadOptionsFunctions (have getCurrentNodeParameter)
		else if ('getCurrentNodeParameter' in context) {
			const loadContext = context as ILoadOptionsFunctions;
			const servicePathMode = (loadContext.getCurrentNodeParameter('servicePathMode') as string) || 'discover';

			if (servicePathMode === 'discover') {
				servicePath = (loadContext.getCurrentNodeParameter('discoveredService') as string) || '/sap/opu/odata/sap/';
			} else if (servicePathMode === 'list') {
				servicePath = (loadContext.getCurrentNodeParameter('servicePathFromList') as string) || servicePath;
			} else {
				servicePath = (loadContext.getCurrentNodeParameter('servicePath') as string) || servicePath;
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
