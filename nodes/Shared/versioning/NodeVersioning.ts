/**
 * NodeVersioning - Support for n8n node versioning
 *
 * n8n Node Versioning Guidelines:
 * - Version nodes when making breaking changes
 * - Maintain backward compatibility
 * - Provide migration paths
 * - Use semantic versioning principles
 */

import { INodeTypeDescription } from 'n8n-workflow';

/**
 * Versioned node type interface
 */
export interface INodeVersionedType {
	currentVersion: number;
	nodeVersions: Record<number, INodeTypeDescription>;
	migrate: (nodeData: any, fromVersion: number) => any;
}

/**
 * Version migration interface
 */
export interface IVersionMigration {
	from: number;
	to: number;
	migrate: (nodeData: any) => any;
}

/**
 * Node version configuration
 */
export interface INodeVersionConfig {
	version: number;
	description: INodeTypeDescription;
	migrations?: IVersionMigration[];
}

/**
 * Helper class for managing node versions
 */
export class NodeVersionManager {
	private versions: Map<number, INodeVersionConfig> = new Map();
	private latestVersion = 1;

	/**
	 * Register a node version
	 */
	registerVersion(config: INodeVersionConfig): void {
		this.versions.set(config.version, config);
		if (config.version > this.latestVersion) {
			this.latestVersion = config.version;
		}
	}

	/**
	 * Get description for specific version
	 */
	getVersionDescription(version: number): INodeTypeDescription | undefined {
		return this.versions.get(version)?.description;
	}

	/**
	 * Get latest version number
	 */
	getLatestVersion(): number {
		return this.latestVersion;
	}

	/**
	 * Migrate node data between versions
	 */
	migrateNodeData(
		nodeData: any,
		fromVersion: number,
		toVersion?: number
	): any {
		const targetVersion = toVersion || this.latestVersion;
		let currentData = { ...nodeData };
		let currentVersion = fromVersion;

		// Apply migrations sequentially
		while (currentVersion < targetVersion) {
			const nextVersion = currentVersion + 1;
			const migration = this.findMigration(currentVersion, nextVersion);

			if (migration) {
				currentData = migration.migrate(currentData);
			}

			currentVersion = nextVersion;
		}

		return currentData;
	}

	/**
	 * Find migration between versions
	 */
	private findMigration(from: number, to: number): IVersionMigration | undefined {
		for (const version of this.versions.values()) {
			if (version.migrations) {
				const migration = version.migrations.find(
					m => m.from === from && m.to === to
				);
				if (migration) {
					return migration;
				}
			}
		}
		return undefined;
	}

	/**
	 * Check if migration is needed
	 */
	needsMigration(nodeVersion: number): boolean {
		return nodeVersion < this.latestVersion;
	}

	/**
	 * Get migration path
	 */
	getMigrationPath(fromVersion: number): number[] {
		const path: number[] = [];
		let current = fromVersion;

		while (current < this.latestVersion) {
			current++;
			path.push(current);
		}

		return path;
	}
}

/**
 * Example migrations for SAP OData node
 */
export const sapODataMigrations: IVersionMigration[] = [
	{
		from: 1,
		to: 2,
		migrate: (nodeData: any) => {
			// Example: Migrate old property names to new structure
			const migrated = { ...nodeData };

			// Rename old properties
			if (migrated.parameters?.entitySetCustom) {
				migrated.parameters.customEntitySet = migrated.parameters.entitySetCustom;
				delete migrated.parameters.entitySetCustom;
			}

			// Update operation names
			if (migrated.parameters?.operation === 'retrieve') {
				migrated.parameters.operation = 'get';
			}

			// Migrate authentication settings
			if (migrated.credentials?.auth) {
				migrated.credentials.authentication = 'basicAuth';
				delete migrated.credentials.auth;
			}

			return migrated;
		}
	}
];

/**
 * Create versioned node type
 */
export function createVersionedNode(
	_baseDescription: INodeTypeDescription,
	versionConfigs: INodeVersionConfig[]
): INodeVersionedType {
	const manager = new NodeVersionManager();

	// Register all versions
	versionConfigs.forEach(config => {
		manager.registerVersion(config);
	});

	return {
		// Use latest version as default
		currentVersion: manager.getLatestVersion(),

		// Version descriptions
		nodeVersions: versionConfigs.reduce((acc, config) => {
			acc[config.version] = config.description;
			return acc;
		}, {} as Record<number, INodeTypeDescription>),

		// Migration function
		migrate: (nodeData: any, fromVersion: number) => {
			return manager.migrateNodeData(nodeData, fromVersion);
		}
	} as INodeVersionedType;
}

/**
 * Version compatibility checker
 */
export class VersionCompatibility {
	/**
	 * Check if a feature is available in a version
	 */
	static isFeatureAvailable(
		feature: string,
		nodeVersion: number,
		featureVersionMap: Map<string, number>
	): boolean {
		const requiredVersion = featureVersionMap.get(feature);
		return requiredVersion ? nodeVersion >= requiredVersion : false;
	}

	/**
	 * Get deprecation warnings for old versions
	 */
	static getDeprecationWarnings(nodeVersion: number): string[] {
		const warnings: string[] = [];

		if (nodeVersion < 2) {
			warnings.push(
				'This node version is deprecated. Please update to the latest version for improved features and security.'
			);
		}

		// Add specific deprecation warnings based on version
		const deprecations: Map<number, string[]> = new Map([
			[1, [
				'The "entitySetCustom" property is deprecated. Use "customEntitySet" instead.',
				'Authentication method "auth" is deprecated. Use "authentication" instead.'
			]]
		]);

		const versionDeprecations = deprecations.get(nodeVersion);
		if (versionDeprecations) {
			warnings.push(...versionDeprecations);
		}

		return warnings;
	}

	/**
	 * Get breaking changes between versions
	 */
	static getBreakingChanges(fromVersion: number, toVersion: number): string[] {
		const changes: string[] = [];

		// Define breaking changes for each version
		const breakingChanges: Map<number, string[]> = new Map([
			[2, [
				'Property names have been updated to follow n8n naming conventions',
				'Authentication configuration has been restructured',
				'Some operation names have been renamed for clarity'
			]]
		]);

		// Collect all breaking changes between versions
		for (let v = fromVersion + 1; v <= toVersion; v++) {
			const versionChanges = breakingChanges.get(v);
			if (versionChanges) {
				changes.push(`Version ${v}:`, ...versionChanges.map(c => `  - ${c}`));
			}
		}

		return changes;
	}
}