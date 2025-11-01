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
 */

import { parseStringPromise } from 'xml2js';

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
	 * Parse XML metadata document
	 */
	static async parseMetadata(xml: string): Promise<IParsedMetadata> {
		try {
			const parsed = await parseStringPromise(xml, {
				explicitArray: false,
				mergeAttrs: true,
				tagNameProcessors: [this.stripNamespaces],
				attrNameProcessors: [this.stripNamespaces],
			});

			// Extract schema from parsed XML
			const schema = this.extractSchema(parsed);
			if (!schema) {
				throw new Error('No schema found in metadata');
			}

			// Parse entity types
			const entityTypes = this.parseEntityTypes(schema);

			// Parse entity sets
			const entitySets = this.parseEntitySets(schema);

			// Parse associations (for navigation properties)
			const associations = this.parseAssociations(schema);

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
	 * Strip XML namespaces from tag and attribute names
	 */
	private static stripNamespaces(name: string): string {
		return name.replace(/^.*:/, '');
	}

	/**
	 * Extract schema element from parsed XML
	 */
	private static extractSchema(parsed: any): any {
		// OData V2: edmx:Edmx > edmx:DataServices > Schema
		// OData V4: edmx:Edmx > DataServices > Schema
		const edmx = parsed.Edmx || parsed['edmx:Edmx'];
		if (!edmx) return null;

		const dataServices = edmx.DataServices || edmx['edmx:DataServices'];
		if (!dataServices) return null;

		const schema = dataServices.Schema;
		return Array.isArray(schema) ? schema[0] : schema;
	}

	/**
	 * Parse EntityType definitions
	 */
	private static parseEntityTypes(schema: any): Map<string, IEntityType> {
		const entityTypes = new Map<string, IEntityType>();

		const entityTypeElements = this.ensureArray(schema.EntityType);
		for (const entityTypeElement of entityTypeElements) {
			const entityType = this.parseEntityType(entityTypeElement);
			if (entityType) {
				entityTypes.set(entityType.name, entityType);
			}
		}

		return entityTypes;
	}

	/**
	 * Parse a single EntityType
	 */
	private static parseEntityType(element: any): IEntityType | null {
		const name = element.Name;
		if (!name) return null;

		// Parse keys
		const keys: string[] = [];
		if (element.Key && element.Key.PropertyRef) {
			const keyRefs = this.ensureArray(element.Key.PropertyRef);
			keys.push(...keyRefs.map((ref: any) => ref.Name));
		}

		// Parse properties
		const properties: IEntityProperty[] = [];
		if (element.Property) {
			const propertyElements = this.ensureArray(element.Property);
			for (const prop of propertyElements) {
				properties.push({
					name: prop.Name,
					type: prop.Type,
					nullable: prop.Nullable === 'true',
					maxLength: prop.MaxLength,
					precision: prop.Precision,
					scale: prop.Scale,
					isKey: keys.includes(prop.Name),
				});
			}
		}

		// Parse navigation properties
		const navigationProperties: INavigationProperty[] = [];
		if (element.NavigationProperty) {
			const navElements = this.ensureArray(element.NavigationProperty);
			for (const nav of navElements) {
				navigationProperties.push({
					name: nav.Name,
					relationship: nav.Relationship,
					toRole: nav.ToRole,
					fromRole: nav.FromRole,
				});
			}
		}

		return {
			name,
			properties,
			navigationProperties,
			keys,
		};
	}

	/**
	 * Parse EntitySet definitions
	 */
	private static parseEntitySets(schema: any): Map<string, IEntitySet> {
		const entitySets = new Map<string, IEntitySet>();

		// Find EntityContainer (can be nested differently in V2/V4)
		const entityContainer = schema.EntityContainer;
		if (!entityContainer) return entitySets;

		const entitySetElements = this.ensureArray(entityContainer.EntitySet);
		for (const entitySetElement of entitySetElements) {
			const name = entitySetElement.Name;
			const entityType = entitySetElement.EntityType;
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
	 * Parse Association definitions (for navigation properties)
	 */
	private static parseAssociations(schema: any): Map<string, any> {
		const associations = new Map<string, any>();

		if (!schema.Association) return associations;

		const associationElements = this.ensureArray(schema.Association);
		for (const assoc of associationElements) {
			const name = assoc.Name;
			if (!name) continue;

			const ends = this.ensureArray(assoc.End);
			associations.set(name, {
				name,
				ends: ends.map((end: any) => ({
					role: end.Role,
					type: this.stripNamespace(end.Type),
					multiplicity: end.Multiplicity,
				})),
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
	 * Strip namespace prefix from qualified name
	 */
	private static stripNamespace(qualifiedName: string): string {
		const parts = qualifiedName.split('.');
		return parts[parts.length - 1];
	}

	/**
	 * Ensure value is array (xml2js sometimes returns single element as object)
	 */
	private static ensureArray(value: any): any[] {
		if (!value) return [];
		return Array.isArray(value) ? value : [value];
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
