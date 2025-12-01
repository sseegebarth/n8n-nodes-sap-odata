/**
 * N8nPropertyHelpers - Helpers for creating n8n-compliant node properties
 *
 * n8n Property Guidelines:
 * - Use clear, descriptive names
 * - Provide helpful descriptions
 * - Use appropriate display options
 * - Include placeholders and hints
 * - Follow consistent naming patterns
 */

import { INodeProperties, INodePropertyMode } from 'n8n-workflow';

/**
 * Create a standard text input property
 */
export function createTextField(
	name: string,
	displayName: string,
	description: string,
	options?: {
		required?: boolean;
		placeholder?: string;
		default?: string;
		displayOptions?: any;
		typeOptions?: any;
	}
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		default: options?.default || '',
		required: options?.required,
		placeholder: options?.placeholder,
		description,
		displayOptions: options?.displayOptions,
		typeOptions: options?.typeOptions,
	};
}

/**
 * Create a number input property
 */
export function createNumberField(
	name: string,
	displayName: string,
	description: string,
	options?: {
		default?: number;
		min?: number;
		max?: number;
		required?: boolean;
		displayOptions?: any;
	}
): INodeProperties {
	const typeOptions: any = {};

	if (options?.min !== undefined) {
		typeOptions.minValue = options.min;
	}
	if (options?.max !== undefined) {
		typeOptions.maxValue = options.max;
	}

	return {
		displayName,
		name,
		type: 'number',
		default: options?.default || 0,
		required: options?.required,
		description,
		displayOptions: options?.displayOptions,
		typeOptions: Object.keys(typeOptions).length > 0 ? typeOptions : undefined,
	};
}

/**
 * Create a boolean toggle property
 */
export function createBooleanField(
	name: string,
	displayName: string,
	description: string,
	defaultValue = false,
	displayOptions?: any
): INodeProperties {
	return {
		displayName,
		name,
		type: 'boolean',
		default: defaultValue,
		description,
		displayOptions,
	};
}

/**
 * Create a dropdown select property
 */
export function createOptionsField(
	name: string,
	displayName: string,
	description: string,
	options: Array<{
		name: string;
		value: string;
		description?: string;
	}>,
	defaultValue?: string,
	displayOptions?: any
): INodeProperties {
	return {
		displayName,
		name,
		type: 'options',
		options: options.map(opt => ({
			name: opt.name,
			value: opt.value,
			description: opt.description,
		})),
		default: defaultValue || options[0]?.value || '',
		description,
		displayOptions,
	};
}

/**
 * Create a multi-select property
 */
export function createMultiOptionsField(
	name: string,
	displayName: string,
	description: string,
	options: Array<{
		name: string;
		value: string;
		description?: string;
	}>,
	defaultValues?: string[],
	displayOptions?: any
): INodeProperties {
	return {
		displayName,
		name,
		type: 'multiOptions',
		options: options.map(opt => ({
			name: opt.name,
			value: opt.value,
			description: opt.description,
		})),
		default: defaultValues || [],
		description,
		displayOptions,
	};
}

/**
 * Create a collection property for grouped fields
 */
export function createCollectionField(
	name: string,
	displayName: string,
	description: string,
	properties: INodeProperties[],
	options?: {
		default?: any;
		displayOptions?: any;
		placeholder?: string;
	}
): INodeProperties {
	return {
		displayName,
		name,
		type: 'collection',
		placeholder: options?.placeholder || 'Add Field',
		default: options?.default || {},
		displayOptions: options?.displayOptions,
		description,
		options: properties,
	};
}

/**
 * Create a fixed collection for repeatable field groups
 */
export function createFixedCollectionField(
	name: string,
	displayName: string,
	description: string,
	items: Array<{
		name: string;
		displayName: string;
		values: INodeProperties[];
	}>,
	displayOptions?: any
): INodeProperties {
	return {
		displayName,
		name,
		type: 'fixedCollection',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		displayOptions,
		description,
		options: items,
	};
}

/**
 * Create a JSON input field
 */
export function createJsonField(
	name: string,
	displayName: string,
	description: string,
	options?: {
		default?: string;
		required?: boolean;
		displayOptions?: any;
		alwaysOpenEditWindow?: boolean;
	}
): INodeProperties {
	return {
		displayName,
		name,
		type: 'json',
		default: options?.default || '{}',
		required: options?.required,
		description,
		displayOptions: options?.displayOptions,
		typeOptions: {
			alwaysOpenEditWindow: options?.alwaysOpenEditWindow !== false,
		},
	};
}

/**
 * Create a resource locator field (for dynamic loading)
 */
export function createResourceLocatorField(
	name: string,
	displayName: string,
	description: string,
	modes: Array<'id' | 'url' | 'name'>,
	displayOptions?: any
): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: modes[0], value: '' },
		required: true,
		description,
		displayOptions,
		modes: modes.map(mode => ({
			name: mode.charAt(0).toUpperCase() + mode.slice(1),
			value: mode,
		} as unknown as INodePropertyMode)),
	};
}

/**
 * Create display options for conditional field visibility
 */
export function createDisplayOptions(
	show?: Record<string, any>,
	hide?: Record<string, any>
): any {
	const options: any = {};

	if (show) {
		options.show = show;
	}
	if (hide) {
		options.hide = hide;
	}

	return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Create standard SAP field descriptions
 */
export function createSapFieldDescription(
	fieldName: string,
	sapType: string,
	nullable: boolean,
	maxLength?: number
): string {
	// Map SAP types to user-friendly descriptions
	const typeMap: Record<string, string> = {
		'Edm.String': 'Text',
		'Edm.Int32': 'Number',
		'Edm.Decimal': 'Decimal',
		'Edm.DateTime': 'Date & Time',
		'Edm.Boolean': 'Yes/No',
		'Edm.Guid': 'Unique ID',
	};

	let description = typeMap[sapType] || sapType;

	if (!nullable) {
		description += ' (Required)';
	}

	if (maxLength) {
		description += ` - Max ${maxLength} characters`;
	}

	// Add field-specific hints
	const hints: Record<string, string> = {
		'date': ' Format: YYYY-MM-DD',
		'time': ' Format: HH:MM:SS',
		'email': ' Must be valid email',
		'phone': ' Include country code',
		'amount': ' Use decimal point for cents',
	};

	const fieldLower = fieldName.toLowerCase();
	for (const [key, hint] of Object.entries(hints)) {
		if (fieldLower.includes(key)) {
			description += hint;
			break;
		}
	}

	return description;
}

/**
 * Create pagination options
 */
export function createPaginationOptions(): INodeProperties[] {
	return [
		createNumberField(
			'limit',
			'Limit',
			'Maximum number of items to return',
			{
				default: 50,
				min: 1,
				max: 1000,
				displayOptions: createDisplayOptions({
					operation: ['getAll'],
				}),
			}
		),
		createBooleanField(
			'returnAll',
			'Return All',
			'Return all items instead of limiting',
			false,
			createDisplayOptions({
				operation: ['getAll'],
			})
		),
	];
}

/**
 * Create retry options
 */
export function createRetryOptions(): INodeProperties[] {
	return [
		createBooleanField(
			'retryOnFail',
			'Retry On Fail',
			'Automatically retry if the request fails',
			true
		),
		createNumberField(
			'maxRetries',
			'Max Retries',
			'Maximum number of retry attempts',
			{
				default: 3,
				min: 0,
				max: 10,
				displayOptions: createDisplayOptions({
					retryOnFail: [true],
				}),
			}
		),
		createNumberField(
			'retryDelay',
			'Retry Delay',
			'Delay between retries in milliseconds',
			{
				default: 1000,
				min: 0,
				max: 60000,
				displayOptions: createDisplayOptions({
					retryOnFail: [true],
				}),
			}
		),
	];
}