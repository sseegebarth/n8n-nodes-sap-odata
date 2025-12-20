"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTextField = createTextField;
exports.createNumberField = createNumberField;
exports.createBooleanField = createBooleanField;
exports.createOptionsField = createOptionsField;
exports.createMultiOptionsField = createMultiOptionsField;
exports.createCollectionField = createCollectionField;
exports.createFixedCollectionField = createFixedCollectionField;
exports.createJsonField = createJsonField;
exports.createResourceLocatorField = createResourceLocatorField;
exports.createDisplayOptions = createDisplayOptions;
exports.createSapFieldDescription = createSapFieldDescription;
exports.createPaginationOptions = createPaginationOptions;
exports.createRetryOptions = createRetryOptions;
function createTextField(name, displayName, description, options) {
    return {
        displayName,
        name,
        type: 'string',
        default: (options === null || options === void 0 ? void 0 : options.default) || '',
        required: options === null || options === void 0 ? void 0 : options.required,
        placeholder: options === null || options === void 0 ? void 0 : options.placeholder,
        description,
        displayOptions: options === null || options === void 0 ? void 0 : options.displayOptions,
        typeOptions: options === null || options === void 0 ? void 0 : options.typeOptions,
    };
}
function createNumberField(name, displayName, description, options) {
    const typeOptions = {};
    if ((options === null || options === void 0 ? void 0 : options.min) !== undefined) {
        typeOptions.minValue = options.min;
    }
    if ((options === null || options === void 0 ? void 0 : options.max) !== undefined) {
        typeOptions.maxValue = options.max;
    }
    return {
        displayName,
        name,
        type: 'number',
        default: (options === null || options === void 0 ? void 0 : options.default) || 0,
        required: options === null || options === void 0 ? void 0 : options.required,
        description,
        displayOptions: options === null || options === void 0 ? void 0 : options.displayOptions,
        typeOptions: Object.keys(typeOptions).length > 0 ? typeOptions : undefined,
    };
}
function createBooleanField(name, displayName, description, defaultValue = false, displayOptions) {
    return {
        displayName,
        name,
        type: 'boolean',
        default: defaultValue,
        description,
        displayOptions,
    };
}
function createOptionsField(name, displayName, description, options, defaultValue, displayOptions) {
    var _a;
    return {
        displayName,
        name,
        type: 'options',
        options: options.map(opt => ({
            name: opt.name,
            value: opt.value,
            description: opt.description,
        })),
        default: defaultValue || ((_a = options[0]) === null || _a === void 0 ? void 0 : _a.value) || '',
        description,
        displayOptions,
    };
}
function createMultiOptionsField(name, displayName, description, options, defaultValues, displayOptions) {
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
function createCollectionField(name, displayName, description, properties, options) {
    return {
        displayName,
        name,
        type: 'collection',
        placeholder: (options === null || options === void 0 ? void 0 : options.placeholder) || 'Add Field',
        default: (options === null || options === void 0 ? void 0 : options.default) || {},
        displayOptions: options === null || options === void 0 ? void 0 : options.displayOptions,
        description,
        options: properties,
    };
}
function createFixedCollectionField(name, displayName, description, items, displayOptions) {
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
function createJsonField(name, displayName, description, options) {
    return {
        displayName,
        name,
        type: 'json',
        default: (options === null || options === void 0 ? void 0 : options.default) || '{}',
        required: options === null || options === void 0 ? void 0 : options.required,
        description,
        displayOptions: options === null || options === void 0 ? void 0 : options.displayOptions,
        typeOptions: {
            alwaysOpenEditWindow: (options === null || options === void 0 ? void 0 : options.alwaysOpenEditWindow) !== false,
        },
    };
}
function createResourceLocatorField(name, displayName, description, modes, displayOptions) {
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
        })),
    };
}
function createDisplayOptions(show, hide) {
    const options = {};
    if (show) {
        options.show = show;
    }
    if (hide) {
        options.hide = hide;
    }
    return Object.keys(options).length > 0 ? options : undefined;
}
function createSapFieldDescription(fieldName, sapType, nullable, maxLength) {
    const typeMap = {
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
    const hints = {
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
function createPaginationOptions() {
    return [
        createNumberField('limit', 'Limit', 'Maximum number of items to return', {
            default: 50,
            min: 1,
            max: 1000,
            displayOptions: createDisplayOptions({
                operation: ['getAll'],
            }),
        }),
        createBooleanField('returnAll', 'Return All', 'Return all items instead of limiting', false, createDisplayOptions({
            operation: ['getAll'],
        })),
    ];
}
function createRetryOptions() {
    return [
        createBooleanField('retryOnFail', 'Retry On Fail', 'Automatically retry if the request fails', true),
        createNumberField('maxRetries', 'Max Retries', 'Maximum number of retry attempts', {
            default: 3,
            min: 0,
            max: 10,
            displayOptions: createDisplayOptions({
                retryOnFail: [true],
            }),
        }),
        createNumberField('retryDelay', 'Retry Delay', 'Delay between retries in milliseconds', {
            default: 1000,
            min: 0,
            max: 60000,
            displayOptions: createDisplayOptions({
                retryOnFail: [true],
            }),
        }),
    ];
}
