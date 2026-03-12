import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	INode,
} from 'n8n-workflow';
import { CREDENTIAL_TYPE } from '../../lib/constants';
import { executeRequest, IApiClientConfig } from '../../lib/core/ApiClient';
import {
	fetchAllItems,
	IPaginationConfig,
	IPaginationResult,
} from '../../lib/core/PaginationHandler';
import { buildCsrfTokenRequest } from '../../lib/core/RequestBuilder';
import { ISapOdataCredentials } from '../../lib/types';
import { formatODataValue, ODataValue } from '../../lib/utils/ODataValueFormatter';
import { resolveServicePath } from '../../lib/utils/ServicePathResolver';

export { resolveServicePath };

/**
 * Make an API request to SAP OData service.
 * Resolves service path and handles CSRF tokens for write operations.
 */
export async function sapOdataApiRequest<T = unknown>(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
	customServicePath?: string,
): Promise<T> {
	const resolvedServicePath = resolveServicePath(this, customServicePath);
	let csrfToken: string | undefined;
	if (method !== 'GET') {
		const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;
		if (credentials) {
			const host = credentials.host.replace(/\/$/, '');
			csrfToken = await getCsrfToken.call(this, host, resolvedServicePath);
		}
	}

	const config: IApiClientConfig = {
		method,
		resource,
		body,
		qs,
		uri,
		option,
		csrfToken,
		servicePath: resolvedServicePath,
	};

	return executeRequest.call(this, config) as T;
}

/** Get CSRF token for write operations (cached). */
export async function getCsrfToken(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	host: string,
	servicePath: string,
): Promise<string> {
	const { SapGatewayCompat } = await import('../../lib/utils/SapGatewayCompat');
	const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;

	return SapGatewayCompat.fetchCsrfToken(
		this,
		host,
		servicePath,
		(h, sp) => buildCsrfTokenRequest(h, sp, credentials, this.getNode()),
	);
}

/** Make an API request with automatic pagination (OData V2 __next / V4 @odata.nextLink). */
export async function sapOdataApiRequestAllItems(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	resource: string,
	body: IDataObject = {},
	query: IDataObject = {},
	continueOnFail = false,
	maxItems = 0,
): Promise<IDataObject[] | IPaginationResult> {
	const resolvedServicePath = resolveServicePath(this);
	let csrfToken: string | undefined;
	if (method !== 'GET') {
		const credentials = (await this.getCredentials(CREDENTIAL_TYPE)) as ISapOdataCredentials;
		if (credentials) {
			const host = credentials.host.replace(/\/$/, '');
			csrfToken = await getCsrfToken.call(this, host, resolvedServicePath);
		}
	}

	const requestFunction = async (qs?: IDataObject, uri?: string) => {
		const config: IApiClientConfig = {
			method,
			resource: uri ? '' : resource,
			body,
			qs: qs ? { ...query, ...qs } : query,
			uri,
			option: {},
			csrfToken,
			servicePath: resolvedServicePath,
		};
		return executeRequest.call(this, config);
	};

	const config: IPaginationConfig = {
		propertyName,
		continueOnFail,
		maxItems,
	};

	return fetchAllItems(requestFunction, config);
}

/**
 * Format a value for SAP OData based on its type (datetime, GUID, decimal, etc.)
 */
export function formatSapODataValue(value: ODataValue, typeHint?: string, node?: INode): string {
	return formatODataValue(value, typeHint, { autoDetect: true, warnOnAutoDetect: false }, node);
}
