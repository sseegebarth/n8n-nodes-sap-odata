"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCompatibility = exports.sapODataMigrations = exports.NodeVersionManager = void 0;
exports.createVersionedNode = createVersionedNode;
class NodeVersionManager {
    constructor() {
        this.versions = new Map();
        this.latestVersion = 1;
    }
    registerVersion(config) {
        this.versions.set(config.version, config);
        if (config.version > this.latestVersion) {
            this.latestVersion = config.version;
        }
    }
    getVersionDescription(version) {
        var _a;
        return (_a = this.versions.get(version)) === null || _a === void 0 ? void 0 : _a.description;
    }
    getLatestVersion() {
        return this.latestVersion;
    }
    migrateNodeData(nodeData, fromVersion, toVersion) {
        const targetVersion = toVersion || this.latestVersion;
        let currentData = { ...nodeData };
        let currentVersion = fromVersion;
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
    findMigration(from, to) {
        for (const version of this.versions.values()) {
            if (version.migrations) {
                const migration = version.migrations.find(m => m.from === from && m.to === to);
                if (migration) {
                    return migration;
                }
            }
        }
        return undefined;
    }
    needsMigration(nodeVersion) {
        return nodeVersion < this.latestVersion;
    }
    getMigrationPath(fromVersion) {
        const path = [];
        let current = fromVersion;
        while (current < this.latestVersion) {
            current++;
            path.push(current);
        }
        return path;
    }
}
exports.NodeVersionManager = NodeVersionManager;
exports.sapODataMigrations = [
    {
        from: 1,
        to: 2,
        migrate: (nodeData) => {
            var _a, _b, _c;
            const migrated = { ...nodeData };
            if ((_a = migrated.parameters) === null || _a === void 0 ? void 0 : _a.entitySetCustom) {
                migrated.parameters.customEntitySet = migrated.parameters.entitySetCustom;
                delete migrated.parameters.entitySetCustom;
            }
            if (((_b = migrated.parameters) === null || _b === void 0 ? void 0 : _b.operation) === 'retrieve') {
                migrated.parameters.operation = 'get';
            }
            if ((_c = migrated.credentials) === null || _c === void 0 ? void 0 : _c.auth) {
                migrated.credentials.authentication = 'basicAuth';
                delete migrated.credentials.auth;
            }
            return migrated;
        }
    }
];
function createVersionedNode(_baseDescription, versionConfigs) {
    const manager = new NodeVersionManager();
    versionConfigs.forEach(config => {
        manager.registerVersion(config);
    });
    return {
        currentVersion: manager.getLatestVersion(),
        nodeVersions: versionConfigs.reduce((acc, config) => {
            acc[config.version] = config.description;
            return acc;
        }, {}),
        migrate: (nodeData, fromVersion) => {
            return manager.migrateNodeData(nodeData, fromVersion);
        }
    };
}
class VersionCompatibility {
    static isFeatureAvailable(feature, nodeVersion, featureVersionMap) {
        const requiredVersion = featureVersionMap.get(feature);
        return requiredVersion ? nodeVersion >= requiredVersion : false;
    }
    static getDeprecationWarnings(nodeVersion) {
        const warnings = [];
        if (nodeVersion < 2) {
            warnings.push('This node version is deprecated. Please update to the latest version for improved features and security.');
        }
        const deprecations = new Map([
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
    static getBreakingChanges(fromVersion, toVersion) {
        const changes = [];
        const breakingChanges = new Map([
            [2, [
                    'Property names have been updated to follow n8n naming conventions',
                    'Authentication configuration has been restructured',
                    'Some operation names have been renamed for clarity'
                ]]
        ]);
        for (let v = fromVersion + 1; v <= toVersion; v++) {
            const versionChanges = breakingChanges.get(v);
            if (versionChanges) {
                changes.push(`Version ${v}:`, ...versionChanges.map(c => `  - ${c}`));
            }
        }
        return changes;
    }
}
exports.VersionCompatibility = VersionCompatibility;
