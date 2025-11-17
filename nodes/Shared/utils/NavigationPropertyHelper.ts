/**
 * NavigationPropertyHelper - Support for OData Navigation Properties
 *
 * Navigation Properties ermöglichen Zugriff auf verwandte Entities
 * z.B. SalesOrder → OrderItems → Product
 *
 * Features:
 * - $expand für nested entities
 * - Deep navigation (mehrere Ebenen)
 * - $select on navigation properties
 * - Association creation/deletion
 */

import { IDataObject } from 'n8n-workflow';

/**
 * Navigation Property Configuration
 */
export interface INavigationConfig {
	path: string;                    // e.g., "Orders/Items"
	select?: string[];               // Fields to select
	filter?: string;                 // OData filter on navigation
	expand?: INavigationConfig[];    // Nested expansions
	orderBy?: string;                // Sort navigation results
	top?: number;                    // Limit navigation results
}

/**
 * Deep Insert Configuration (create entity with related entities)
 */
export interface IDeepInsertConfig {
	entity: IDataObject;
	navigationProperties: Record<string, IDataObject | IDataObject[]>;
}

/**
 * Association Link
 */
export interface IAssociationLink {
	sourceEntitySet: string;
	sourceKey: string;
	navigationProperty: string;
	targetEntitySet: string;
	targetKey: string;
}

export class NavigationPropertyHelper {
	/**
	 * Build $expand parameter from navigation config
	 */
	static buildExpandParameter(configs: INavigationConfig[]): string {
		return configs.map(config => this.buildSingleExpand(config)).join(',');
	}

	/**
	 * Build single $expand clause
	 */
	private static buildSingleExpand(config: INavigationConfig): string {
		const options: string[] = [];

		// Add $select
		if (config.select && config.select.length > 0) {
			options.push(`$select=${config.select.join(',')}`);
		}

		// Add $filter
		if (config.filter) {
			options.push(`$filter=${encodeURIComponent(config.filter)}`);
		}

		// Add $orderby
		if (config.orderBy) {
			options.push(`$orderby=${encodeURIComponent(config.orderBy)}`);
		}

		// Add $top
		if (config.top) {
			options.push(`$top=${config.top}`);
		}

		// Add nested $expand
		if (config.expand && config.expand.length > 0) {
			const nestedExpand = this.buildExpandParameter(config.expand);
			options.push(`$expand=${encodeURIComponent(nestedExpand)}`);
		}

		// Combine path with options
		if (options.length > 0) {
			return `${config.path}(${options.join(';')})`;
		}

		return config.path;
	}

	/**
	 * Parse navigation path into segments
	 * Example: "Orders/Items/Product" → ["Orders", "Items", "Product"]
	 */
	static parseNavigationPath(path: string): string[] {
		return path.split('/').filter(segment => segment.trim().length > 0);
	}

	/**
	 * Validate navigation path format
	 */
	static validateNavigationPath(path: string): {
		valid: boolean;
		error?: string;
	} {
		if (!path || path.trim().length === 0) {
			return { valid: false, error: 'Navigation path cannot be empty' };
		}

		const segments = this.parseNavigationPath(path);

		// Check segment format (alphanumeric + underscore)
		for (const segment of segments) {
			if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
				return {
					valid: false,
					error: `Invalid navigation segment: ${segment}. Must start with letter/underscore and contain only alphanumeric characters.`
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Build deep insert payload (entity with navigation properties)
	 */
	static buildDeepInsertPayload(config: IDeepInsertConfig): IDataObject {
		const payload: IDataObject = { ...config.entity };

		// Add navigation properties
		Object.entries(config.navigationProperties).forEach(([navProp, value]) => {
			if (Array.isArray(value)) {
				// To-Many relationship
				payload[navProp] = value.map(item => this.cleanNavigationEntity(item));
			} else {
				// To-One relationship
				payload[navProp] = this.cleanNavigationEntity(value);
			}
		});

		return payload;
	}

	/**
	 * Clean entity for navigation property (remove metadata)
	 */
	private static cleanNavigationEntity(entity: IDataObject): IDataObject {
		const cleaned: IDataObject = {};

		Object.entries(entity).forEach(([key, value]) => {
			// Skip metadata fields
			if (!key.startsWith('__')) {
				cleaned[key] = value;
			}
		});

		return cleaned;
	}

	/**
	 * Build URL for navigation property access
	 */
	static buildNavigationUrl(
		baseEntitySet: string,
		entityKey: string,
		navigationPath: string
	): string {
		const segments = this.parseNavigationPath(navigationPath);
		return `/${baseEntitySet}(${entityKey})/${segments.join('/')}`;
	}

	/**
	 * Build association link URL ($links endpoint for OData V2)
	 */
	static buildAssociationLinkUrl(link: IAssociationLink): string {
		return `/${link.sourceEntitySet}(${link.sourceKey})/$links/${link.navigationProperty}`;
	}

	/**
	 * Build association target reference
	 */
	static buildAssociationTarget(
		targetEntitySet: string,
		targetKey: string
	): { uri: string } {
		return {
			uri: `${targetEntitySet}(${targetKey})`
		};
	}

	/**
	 * Extract navigation results from response
	 */
	static extractNavigationResults(
		response: unknown,
		navigationPath: string
	): unknown {
		if (!response || typeof response !== 'object') {
			return null;
		}

		const segments = this.parseNavigationPath(navigationPath);
		let current: any = response;

		// Navigate through path
		for (const segment of segments) {
			// Handle OData V2 wrapper
			if (current.d) {
				current = current.d;
			}

			// Navigate to segment
			if (current[segment] !== undefined) {
				current = current[segment];
			} else {
				return null; // Path not found
			}
		}

		// Handle OData V2 results wrapper
		if (current && typeof current === 'object' && current.results) {
			return current.results;
		}

		return current;
	}

	/**
	 * Build complex $expand with multiple levels
	 */
	static buildMultiLevelExpand(paths: string[]): string {
		const expandTree: Map<string, Set<string>> = new Map();

		// Build tree structure
		paths.forEach(path => {
			const segments = this.parseNavigationPath(path);
			let currentPath = '';

			segments.forEach((segment) => {
				const parentPath = currentPath;
				currentPath = currentPath ? `${currentPath}/${segment}` : segment;

				if (!expandTree.has(parentPath)) {
					expandTree.set(parentPath, new Set());
				}
				expandTree.get(parentPath)!.add(segment);
			});
		});

		// Build expand parameter recursively
		const buildLevel = (parentPath: string): string => {
			const children = expandTree.get(parentPath);
			if (!children || children.size === 0) {
				return '';
			}

			return Array.from(children).map(child => {
				const childPath = parentPath ? `${parentPath}/${child}` : child;
				const nested = buildLevel(childPath);

				if (nested) {
					return `${child}($expand=${nested})`;
				}
				return child;
			}).join(',');
		};

		return buildLevel('');
	}

	/**
	 * Parse $expand parameter back into navigation configs
	 */
	static parseExpandParameter(expandParam: string): INavigationConfig[] {
		// Simplified parsing - handle basic cases
		const configs: INavigationConfig[] = [];
		const parts = expandParam.split(',');

		parts.forEach(part => {
			const match = part.match(/([^(]+)(\(([^)]+)\))?/);
			if (match) {
				const path = match[1];
				const optionsStr = match[3];

				const config: INavigationConfig = { path };

				if (optionsStr) {
					// Parse options (simplified)
					const options = optionsStr.split(';');
					options.forEach(opt => {
						if (opt.startsWith('$select=')) {
							config.select = opt.substring(8).split(',');
						} else if (opt.startsWith('$filter=')) {
							config.filter = decodeURIComponent(opt.substring(8));
						} else if (opt.startsWith('$orderby=')) {
							config.orderBy = decodeURIComponent(opt.substring(9));
						} else if (opt.startsWith('$top=')) {
							config.top = parseInt(opt.substring(5), 10);
						}
					});
				}

				configs.push(config);
			}
		});

		return configs;
	}
}
