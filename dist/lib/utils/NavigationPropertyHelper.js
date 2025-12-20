"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigationPropertyHelper = void 0;
class NavigationPropertyHelper {
    static buildExpandParameter(configs) {
        return configs.map(config => this.buildSingleExpand(config)).join(',');
    }
    static buildSingleExpand(config) {
        const options = [];
        if (config.select && config.select.length > 0) {
            options.push(`$select=${config.select.join(',')}`);
        }
        if (config.filter) {
            options.push(`$filter=${encodeURIComponent(config.filter)}`);
        }
        if (config.orderBy) {
            options.push(`$orderby=${encodeURIComponent(config.orderBy)}`);
        }
        if (config.top) {
            options.push(`$top=${config.top}`);
        }
        if (config.expand && config.expand.length > 0) {
            const nestedExpand = this.buildExpandParameter(config.expand);
            options.push(`$expand=${encodeURIComponent(nestedExpand)}`);
        }
        if (options.length > 0) {
            return `${config.path}(${options.join(';')})`;
        }
        return config.path;
    }
    static parseNavigationPath(path) {
        return path.split('/').filter(segment => segment.trim().length > 0);
    }
    static validateNavigationPath(path) {
        if (!path || path.trim().length === 0) {
            return { valid: false, error: 'Navigation path cannot be empty' };
        }
        const segments = this.parseNavigationPath(path);
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
    static buildDeepInsertPayload(config) {
        const payload = { ...config.entity };
        Object.entries(config.navigationProperties).forEach(([navProp, value]) => {
            if (Array.isArray(value)) {
                payload[navProp] = value.map(item => this.cleanNavigationEntity(item));
            }
            else {
                payload[navProp] = this.cleanNavigationEntity(value);
            }
        });
        return payload;
    }
    static cleanNavigationEntity(entity) {
        const cleaned = {};
        Object.entries(entity).forEach(([key, value]) => {
            if (!key.startsWith('__')) {
                cleaned[key] = value;
            }
        });
        return cleaned;
    }
    static buildNavigationUrl(baseEntitySet, entityKey, navigationPath) {
        const segments = this.parseNavigationPath(navigationPath);
        return `/${baseEntitySet}(${entityKey})/${segments.join('/')}`;
    }
    static buildAssociationLinkUrl(link) {
        return `/${link.sourceEntitySet}(${link.sourceKey})/$links/${link.navigationProperty}`;
    }
    static buildAssociationTarget(targetEntitySet, targetKey) {
        return {
            uri: `${targetEntitySet}(${targetKey})`
        };
    }
    static extractNavigationResults(response, navigationPath) {
        if (!response || typeof response !== 'object') {
            return null;
        }
        const segments = this.parseNavigationPath(navigationPath);
        let current = response;
        for (const segment of segments) {
            if (current.d) {
                current = current.d;
            }
            if (current[segment] !== undefined) {
                current = current[segment];
            }
            else {
                return null;
            }
        }
        if (current && typeof current === 'object' && current.results) {
            return current.results;
        }
        return current;
    }
    static buildMultiLevelExpand(paths) {
        const expandTree = new Map();
        paths.forEach(path => {
            const segments = this.parseNavigationPath(path);
            let currentPath = '';
            segments.forEach((segment) => {
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${segment}` : segment;
                if (!expandTree.has(parentPath)) {
                    expandTree.set(parentPath, new Set());
                }
                expandTree.get(parentPath).add(segment);
            });
        });
        const buildLevel = (parentPath) => {
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
    static parseExpandParameter(expandParam) {
        const configs = [];
        const parts = expandParam.split(',');
        parts.forEach(part => {
            const match = part.match(/([^(]+)(\(([^)]+)\))?/);
            if (match) {
                const path = match[1];
                const optionsStr = match[3];
                const config = { path };
                if (optionsStr) {
                    const options = optionsStr.split(';');
                    options.forEach(opt => {
                        if (opt.startsWith('$select=')) {
                            config.select = opt.substring(8).split(',');
                        }
                        else if (opt.startsWith('$filter=')) {
                            config.filter = decodeURIComponent(opt.substring(8));
                        }
                        else if (opt.startsWith('$orderby=')) {
                            config.orderBy = decodeURIComponent(opt.substring(9));
                        }
                        else if (opt.startsWith('$top=')) {
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
exports.NavigationPropertyHelper = NavigationPropertyHelper;
