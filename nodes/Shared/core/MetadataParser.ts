/**
 * MetadataParser - Parse OData $metadata XML
 *
 * Parses SAP OData $metadata XML documents to extract:
 * - EntityType definitions with properties
 * - NavigationProperty definitions
 * - EDM type information
 * - Key properties
 *
 * Supports both OData V2 and V4 metadata formats.
 *
 * IMPORTANT: Uses native XML parsing (no external dependencies)
 * to maintain compatibility with n8n community node requirements.
 */

export interface IEntityProperty {
	name: string;
	type: string;
	nullable?: boolean;
	maxLength?: string;
	precision?: string;
	scale?: string;
	isKey?: boolean;
}

export interface INavigationProperty {
	name: string;
	relationship: string;
	toRole: string;
	fromRole: string;
	targetEntityType?: string;
}

export interface IEntityType {
	name: string;
	properties: IEntityProperty[];
	navigationProperties: INavigationProperty[];
	keys: string[];
}

export interface IEntitySet {
	name: string;
	entityType: string;
}

export interface IParsedMetadata {
	entityTypes: Map<string, IEntityType>;
	entitySets: Map<string, IEntitySet>;
	associations: Map<string, any>;
}

/**
 * Parse OData $metadata XML to extract entity schema information
 */
export class MetadataParser {
	/**
	 * Parse XML metadata document using native string parsing
	 */
	static async parseMetadata(xml: string): Promise<IParsedMetadata> {
		try {
			// Parse entity types
			const entityTypes = this.parseEntityTypes(xml);

			// Parse entity sets
			const entitySets = this.parseEntitySets(xml);

			// Parse associations (for navigation properties)
			const associations = this.parseAssociations(xml);

			// Resolve navigation property targets
			this.resolveNavigationTargets(entityTypes, associations);

			return {
				entityTypes,
				entitySets,
				associations,
			};
		} catch (error) {
			throw new Error(`Failed to parse metadata: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Extract attribute value from XML tag
	 */
	private static extractAttribute(tag: string, attrName: string): string | undefined {
		// Match attribute with various quote styles and namespace prefixes
		const pattern = new RegExp(`(?:^|\\s)(?:[^:]+:)?${attrName}\\s*=\\s*["']([^"']*)["']`, 'i');
		const match = tag.match(pattern);
		return match ? match[1] : undefined;
	}

	/**
	 * Strip namespace prefix from qualified name
	 */
	private static stripNamespace(qualifiedName: string): string {
		const parts = qualifiedName.split('.');
		return parts[parts.length - 1];
	}

	/**
	 * Extract all tags matching a pattern
	 */
	private static extractTags(xml: string, tagName: string): string[] {
		const tags: string[] = [];
		// Match both self-closing and paired tags, ignoring namespaces
		const pattern = new RegExp(`<(?:[^:]+:)?${tagName}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[^:]+:)?${tagName}>)`, 'gi');
		let match;
		while ((match = pattern.exec(xml)) !== null) {
			tags.push(match[0]);
		}
		return tags;
	}

	/**
	 * Parse EntityType definitions from XML
	 */
	private static parseEntityTypes(xml: string): Map<string, IEntityType> {
		const entityTypes = new Map<string, IEntityType>();

		// Extract all EntityType elements
		const entityTypeTags = this.extractTags(xml, 'EntityType');

		for (const entityTypeTag of entityTypeTags) {
			const name = this.extractAttribute(entityTypeTag, 'Name');
			if (!name) continue;

			// Parse keys
			const keys: string[] = [];
			const keySection = entityTypeTag.match(/<(?:[^:]+:)?Key[^>]*>([\s\S]*?)<\/(?:[^:]+:)?Key>/i);
			if (keySection) {
				const propertyRefs = this.extractTags(keySection[1], 'PropertyRef');
				for (const ref of propertyRefs) {
					const keyName = this.extractAttribute(ref, 'Name');
					if (keyName) keys.push(keyName);
				}
			}

			// Parse properties
			const properties: IEntityProperty[] = [];
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

			// Parse navigation properties
			const navigationProperties: INavigationProperty[] = [];
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

	/**
	 * Parse EntitySet definitions from XML
	 */
	private static parseEntitySets(xml: string): Map<string, IEntitySet> {
		const entitySets = new Map<string, IEntitySet>();

		// Extract EntityContainer section
		const containerMatch = xml.match(/<(?:[^:]+:)?EntityContainer[^>]*>([\s\S]*?)<\/(?:[^:]+:)?EntityContainer>/i);
		if (!containerMatch) return entitySets;

		// Extract all EntitySet elements within container
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

	/**
	 * Parse Association definitions (for navigation properties) from XML
	 */
	private static parseAssociations(xml: string): Map<string, any> {
		const associations = new Map<string, any>();

		// Extract all Association elements
		const associationTags = this.extractTags(xml, 'Association');

		for (const assocTag of associationTags) {
			const name = this.extractAttribute(assocTag, 'Name');
			if (!name) continue;

			// Parse association ends
			const ends: any[] = [];
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

	/**
	 * Resolve navigation property target entity types using associations
	 */
	private static resolveNavigationTargets(
		entityTypes: Map<string, IEntityType>,
		associations: Map<string, any>,
	): void {
		for (const entityType of entityTypes.values()) {
			for (const navProp of entityType.navigationProperties) {
				// Strip namespace from relationship name
				const relationshipName = this.stripNamespace(navProp.relationship);
				const association = associations.get(relationshipName);

				if (association) {
					// Find the target end (ToRole)
					const targetEnd = association.ends.find((end: any) => end.role === navProp.toRole);
					if (targetEnd) {
						navProp.targetEntityType = targetEnd.type;
					}
				}
			}
		}
	}

	/**
	 * Get display-friendly type name for EDM type
	 */
	static getDisplayType(edmType: string): string {
		const typeMap: Record<string, string> = {
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

	/**
	 * Build field description with type and constraints
	 */
	static buildFieldDescription(property: IEntityProperty): string {
		const parts: string[] = [];

		// Type
		parts.push(this.getDisplayType(property.type));

		// Key indicator
		if (property.isKey) {
			parts.push('(Key)');
		}

		// Nullable
		if (property.nullable === false) {
			parts.push('Required');
		}

		// MaxLength
		if (property.maxLength && property.maxLength !== 'Max') {
			parts.push(`Max: ${property.maxLength}`);
		}

		// Precision/Scale for decimals
		if (property.precision) {
			parts.push(`Precision: ${property.precision}`);
		}
		if (property.scale) {
			parts.push(`Scale: ${property.scale}`);
		}

		return parts.join(' · ');
	}
}
