import {
	IExecuteFunctions,
	IDataObject,
	INode,
	NodeOperationError,
} from 'n8n-workflow';
import { buildODataQuery } from '../core/QueryBuilder';
import { IODataQueryOptions } from '../types';
import { validateEntitySetName, validateJsonInput, validateEntityKey } from './SecurityUtils';
import { convertDataTypes, removeMetadata, unwrapNavigationProperties } from './TypeConverter';

interface IResourceLocatorValue {
	mode: string;
	value: string;
	__rl?: boolean;
}

export function getEntitySet(context: IExecuteFunctions, itemIndex: number): string {
	const entitySetParam = context.getNodeParameter('entitySet', itemIndex) as string | IResourceLocatorValue;

	let entitySet: string;
	if (typeof entitySetParam === 'object' && entitySetParam !== null) {
		entitySet = entitySetParam.value || '';
	} else {
		entitySet = entitySetParam as string;
	}

	return validateEntitySetName(entitySet, context.getNode());
}

export function validateAndParseJson(
	input: string | IDataObject | IDataObject[],
	fieldName: string,
	node: INode,
): IDataObject | IDataObject[] {
	if (typeof input === 'object' && input !== null) {
		try {
			const jsonString = JSON.stringify(input);
			return validateJsonInput(jsonString, fieldName, node) as IDataObject | IDataObject[];
		} catch {
			return input as IDataObject | IDataObject[];
		}
	}

	if (!input || (typeof input === 'string' && input.trim() === '')) {
		throw new NodeOperationError(node, `${fieldName} cannot be empty`);
	}

	return validateJsonInput(input, fieldName, node) as IDataObject | IDataObject[];
}

export function validateAndFormatKey(key: string | IDataObject, node: INode): string {
	if (!key) {
		throw new NodeOperationError(node, 'Entity key is required');
	}

	if (typeof key !== 'string') {
		const keyParts = Object.entries(key).map(([k, v]) => {
			if (typeof v === 'string') {
				const escaped = v.replace(/'/g, "''");
				return `${k}='${escaped}'`;
			}
			return `${k}=${v}`;
		});

		if (keyParts.length === 0) {
			throw new NodeOperationError(node, 'Entity key object cannot be empty');
		}
		return keyParts.join(',');
	}

	const validated = validateEntityKey(key, node);

	if (validated.includes('=')) return validated;
	if (/^guid'[0-9a-fA-F-]+'$/i.test(validated)) return validated;
	if (/^'.*'$/.test(validated)) return validated;
	if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validated)) {
		return `guid'${validated}'`;
	}
	if (/^\d+(\.\d+)?$/.test(validated)) return validated;

	return `'${validated}'`;
}

export function applyTypeConversion(
	data: IDataObject | IDataObject[],
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject | IDataObject[] {
	try {
		const opts = context.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;

		let result: unknown = data;
		if (opts.convertDataTypes !== false) {
			result = convertDataTypes(result);
		}
		if (opts.removeMetadata !== false) {
			result = removeMetadata(result);
		}
		result = unwrapNavigationProperties(result);
		return result as IDataObject | IDataObject[];
	} catch {
		return data;
	}
}

export function buildResourcePath(entitySet: string, entityKey?: string): string {
	let path = `/${entitySet}`;
	if (entityKey) {
		path += `(${entityKey})`;
	}
	return path;
}

export function extractResult(response: IDataObject): IDataObject | IDataObject[] {
	if (Array.isArray(response)) return response;
	if (typeof response !== 'object' || response === null) return response as IDataObject;

	const responseObj = response as Record<string, unknown>;

	if (responseObj.value !== undefined) {
		if (Array.isArray(responseObj.value)) return responseObj.value as IDataObject[];
		return responseObj.value as IDataObject;
	}

	if (responseObj.d && typeof responseObj.d === 'object') {
		const dObj = responseObj.d as Record<string, unknown>;
		if (dObj.results) return dObj.results as IDataObject[];
		return responseObj.d as IDataObject;
	}

	return response;
}

export function getQueryOptions(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const options = context.getNodeParameter('options', itemIndex, {}) as IODataQueryOptions;
	return buildODataQuery(options, context.getNode());
}
