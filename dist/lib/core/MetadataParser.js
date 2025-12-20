"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataParser = void 0;
class MetadataParser {
    static async parseMetadata(xml) {
        try {
            const entityTypes = this.parseEntityTypes(xml);
            const entitySets = this.parseEntitySets(xml);
            const associations = this.parseAssociations(xml);
            this.resolveNavigationTargets(entityTypes, associations);
            return {
                entityTypes,
                entitySets,
                associations,
            };
        }
        catch (error) {
            throw new Error(`Failed to parse metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    static extractAttribute(tag, attrName) {
        const pattern = new RegExp(`(?:^|\\s)(?:[^:]+:)?${attrName}\\s*=\\s*["']([^"']*)["']`, 'i');
        const match = tag.match(pattern);
        return match ? match[1] : undefined;
    }
    static stripNamespace(qualifiedName) {
        const parts = qualifiedName.split('.');
        return parts[parts.length - 1];
    }
    static extractTags(xml, tagName) {
        const tags = [];
        const pattern = new RegExp(`<(?:[^:]+:)?${tagName}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[^:]+:)?${tagName}>)`, 'gi');
        let match;
        while ((match = pattern.exec(xml)) !== null) {
            tags.push(match[0]);
        }
        return tags;
    }
    static parseEntityTypes(xml) {
        const entityTypes = new Map();
        const entityTypeTags = this.extractTags(xml, 'EntityType');
        for (const entityTypeTag of entityTypeTags) {
            const name = this.extractAttribute(entityTypeTag, 'Name');
            if (!name)
                continue;
            const keys = [];
            const keySection = entityTypeTag.match(/<(?:[^:]+:)?Key[^>]*>([\s\S]*?)<\/(?:[^:]+:)?Key>/i);
            if (keySection) {
                const propertyRefs = this.extractTags(keySection[1], 'PropertyRef');
                for (const ref of propertyRefs) {
                    const keyName = this.extractAttribute(ref, 'Name');
                    if (keyName)
                        keys.push(keyName);
                }
            }
            const properties = [];
            const propertyTags = this.extractTags(entityTypeTag, 'Property');
            for (const propTag of propertyTags) {
                const propName = this.extractAttribute(propTag, 'Name');
                const propType = this.extractAttribute(propTag, 'Type');
                if (propName && propType) {
                    properties.push({
                        name: propName,
                        type: propType,
                        nullable: this.extractAttribute(propTag, 'Nullable') === 'true',
                        maxLength: this.extractAttribute(propTag, 'MaxLength'),
                        precision: this.extractAttribute(propTag, 'Precision'),
                        scale: this.extractAttribute(propTag, 'Scale'),
                        isKey: keys.includes(propName),
                    });
                }
            }
            const navigationProperties = [];
            const navTags = this.extractTags(entityTypeTag, 'NavigationProperty');
            for (const navTag of navTags) {
                const navName = this.extractAttribute(navTag, 'Name');
                const relationship = this.extractAttribute(navTag, 'Relationship');
                const toRole = this.extractAttribute(navTag, 'ToRole');
                const fromRole = this.extractAttribute(navTag, 'FromRole');
                if (navName && relationship && toRole && fromRole) {
                    navigationProperties.push({
                        name: navName,
                        relationship,
                        toRole,
                        fromRole,
                    });
                }
            }
            entityTypes.set(name, {
                name,
                properties,
                navigationProperties,
                keys,
            });
        }
        return entityTypes;
    }
    static parseEntitySets(xml) {
        const entitySets = new Map();
        const containerMatch = xml.match(/<(?:[^:]+:)?EntityContainer[^>]*>([\s\S]*?)<\/(?:[^:]+:)?EntityContainer>/i);
        if (!containerMatch)
            return entitySets;
        const entitySetTags = this.extractTags(containerMatch[1], 'EntitySet');
        for (const entitySetTag of entitySetTags) {
            const name = this.extractAttribute(entitySetTag, 'Name');
            const entityType = this.extractAttribute(entitySetTag, 'EntityType');
            if (name && entityType) {
                entitySets.set(name, {
                    name,
                    entityType: this.stripNamespace(entityType),
                });
            }
        }
        return entitySets;
    }
    static parseAssociations(xml) {
        const associations = new Map();
        const associationTags = this.extractTags(xml, 'Association');
        for (const assocTag of associationTags) {
            const name = this.extractAttribute(assocTag, 'Name');
            if (!name)
                continue;
            const ends = [];
            const endTags = this.extractTags(assocTag, 'End');
            for (const endTag of endTags) {
                const role = this.extractAttribute(endTag, 'Role');
                const type = this.extractAttribute(endTag, 'Type');
                const multiplicity = this.extractAttribute(endTag, 'Multiplicity');
                if (role && type) {
                    ends.push({
                        role,
                        type: this.stripNamespace(type),
                        multiplicity,
                    });
                }
            }
            associations.set(name, {
                name,
                ends,
            });
        }
        return associations;
    }
    static resolveNavigationTargets(entityTypes, associations) {
        for (const entityType of entityTypes.values()) {
            for (const navProp of entityType.navigationProperties) {
                const relationshipName = this.stripNamespace(navProp.relationship);
                const association = associations.get(relationshipName);
                if (association) {
                    const targetEnd = association.ends.find((end) => end.role === navProp.toRole);
                    if (targetEnd) {
                        navProp.targetEntityType = targetEnd.type;
                    }
                }
            }
        }
    }
    static getDisplayType(edmType) {
        const typeMap = {
            'Edm.String': 'String',
            'Edm.Int16': 'Integer',
            'Edm.Int32': 'Integer',
            'Edm.Int64': 'Long Integer',
            'Edm.Decimal': 'Decimal',
            'Edm.Double': 'Number',
            'Edm.Single': 'Number',
            'Edm.Boolean': 'Boolean',
            'Edm.DateTime': 'DateTime',
            'Edm.DateTimeOffset': 'DateTimeOffset',
            'Edm.Date': 'Date',
            'Edm.TimeOfDay': 'Time',
            'Edm.Time': 'Time',
            'Edm.Guid': 'GUID',
            'Edm.Binary': 'Binary',
            'Edm.Byte': 'Byte',
        };
        return typeMap[edmType] || edmType;
    }
    static buildFieldDescription(property) {
        const parts = [];
        parts.push(this.getDisplayType(property.type));
        if (property.isKey) {
            parts.push('(Key)');
        }
        if (property.nullable === false) {
            parts.push('Required');
        }
        if (property.maxLength && property.maxLength !== 'Max') {
            parts.push(`Max: ${property.maxLength}`);
        }
        if (property.precision) {
            parts.push(`Precision: ${property.precision}`);
        }
        if (property.scale) {
            parts.push(`Scale: ${property.scale}`);
        }
        return parts.join(' · ');
    }
}
exports.MetadataParser = MetadataParser;
