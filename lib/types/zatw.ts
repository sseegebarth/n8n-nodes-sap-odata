/**
 * ZATW (Z ABAP Toolbox Wrapper) Type Definitions
 *
 * Type definitions for HTTP-based SAP RFC/BAPI and IDoc integration.
 * These types define the contract between n8n nodes and the ZATW ABAP service.
 */

import { IDataObject } from 'n8n-workflow';

// ============================================
// Health Check Types
// ============================================

/**
 * Response from ZATW health endpoint
 */
export interface IZatwHealthResponse {
	status: 'ok' | 'error';
	sapRelease: string;
	systemId: string;
	client: string;
	timestamp: string;
	version?: string;
	message?: string;
}

// ============================================
// Function Module Metadata Types
// ============================================

/**
 * Parameter type enumeration
 */
export type ZatwParameterType = 'IMPORTING' | 'EXPORTING' | 'CHANGING' | 'TABLES';

/**
 * ABAP data types
 */
export type ZatwAbapType =
	| 'CHAR'
	| 'NUMC'
	| 'DATS'
	| 'TIMS'
	| 'DEC'
	| 'CURR'
	| 'QUAN'
	| 'INT1'
	| 'INT2'
	| 'INT4'
	| 'INT8'
	| 'FLTP'
	| 'STRING'
	| 'XSTRING'
	| 'RAW'
	| 'STRUCTURE'
	| 'TABLE';

/**
 * Structure field definition
 */
export interface IZatwStructureField {
	name: string;
	dataType: ZatwAbapType | string;
	length: number;
	decimals?: number;
	description?: string;
	isKey?: boolean;
}

/**
 * Function module parameter definition
 */
export interface IZatwFmParameter {
	name: string;
	type: ZatwParameterType;
	dataType: ZatwAbapType | string;
	abapType?: string; // Full ABAP type name (e.g., BAPI_USER_DETAIL)
	optional: boolean;
	defaultValue?: string;
	description?: string;
	structure?: IZatwStructureField[];
	referenceType?: string; // Reference to DDIC type
}

/**
 * Function module exception definition
 */
export interface IZatwFmException {
	name: string;
	description?: string;
}

/**
 * Complete function module metadata
 */
export interface IZatwFmMetadata {
	functionName: string;
	functionGroup: string;
	description: string;
	parameters: IZatwFmParameter[];
	exceptions: IZatwFmException[];
	isRemoteEnabled: boolean;
	lastChanged?: string;
}

/**
 * Function search result
 */
export interface IZatwFmSearchResult {
	functionName: string;
	functionGroup: string;
	description: string;
	isRemoteEnabled: boolean;
}

// ============================================
// RFC Execution Types
// ============================================

/**
 * RFC request payload
 */
export interface IZatwRfcRequest {
	functionName: string;
	parameters: IDataObject;
	options?: IZatwRfcOptions;
}

/**
 * RFC execution options
 */
export interface IZatwRfcOptions {
	commit?: boolean;
	rollbackOnError?: boolean;
	checkReturn?: boolean;
	timeout?: number;
}

/**
 * BAPI RETURN structure
 */
export interface IZatwBapiReturn {
	type: 'S' | 'W' | 'I' | 'E' | 'A';
	id: string;
	number: string;
	message: string;
	logNo?: string;
	logMsgNo?: string;
	messageV1?: string;
	messageV2?: string;
	messageV3?: string;
	messageV4?: string;
	parameter?: string;
	row?: number;
	field?: string;
	system?: string;
}

/**
 * RFC response payload
 */
export interface IZatwRfcResponse {
	success: boolean;
	functionName: string;
	exportParameters?: IDataObject;
	changingParameters?: IDataObject;
	tables?: Record<string, IDataObject[]>;
	return?: IZatwBapiReturn[];
	executionTime?: number;
	error?: IZatwError;
}

/**
 * Multiple RFC calls request (stateful)
 */
export interface IZatwRfcBatchRequest {
	functions: IZatwRfcBatchItem[];
	options?: IZatwRfcBatchOptions;
}

/**
 * Single function in batch
 */
export interface IZatwRfcBatchItem {
	functionName: string;
	parameters: IDataObject;
	commitAfter?: boolean;
}

/**
 * Batch execution options
 */
export interface IZatwRfcBatchOptions {
	stopOnError?: boolean;
	commitAll?: boolean;
	rollbackAll?: boolean;
}

/**
 * Batch response
 */
export interface IZatwRfcBatchResponse {
	success: boolean;
	results: IZatwRfcResponse[];
	totalExecutionTime?: number;
}

// ============================================
// IDoc Types
// ============================================

/**
 * IDoc control record
 */
export interface IZatwIdocControlRecord {
	docnum?: string;
	idoctyp: string;
	mestyp: string;
	mescod?: string;
	mesfct?: string;
	sndpor: string;
	sndprt: string;
	sndprn: string;
	rcvpor: string;
	rcvprt: string;
	rcvprn: string;
	credat?: string;
	cretim?: string;
	refint?: string;
	refgrp?: string;
	refmes?: string;
	test?: string;
}

/**
 * IDoc data record (segment)
 */
export interface IZatwIdocDataRecord {
	segmentName: string;
	segmentNumber: number;
	parentSegment?: number;
	hierarchyLevel?: number;
	data: Record<string, string>;
}

/**
 * IDoc status record
 */
export interface IZatwIdocStatusRecord {
	status: string;
	statusText: string;
	timestamp: string;
	userName?: string;
}

/**
 * IDoc send request
 */
export interface IZatwIdocRequest {
	controlRecord: IZatwIdocControlRecord;
	dataRecords: IZatwIdocDataRecord[];
	options?: IZatwIdocOptions;
}

/**
 * IDoc send options
 */
export interface IZatwIdocOptions {
	generateDocnum?: boolean;
	validateOnly?: boolean;
	synchronous?: boolean;
	testMode?: boolean;
}

/**
 * IDoc send response
 */
export interface IZatwIdocResponse {
	success: boolean;
	idocNumber: string;
	status: string;
	statusText: string;
	messages?: IZatwBapiReturn[];
	error?: IZatwError;
}

/**
 * IDoc status check response
 */
export interface IZatwIdocStatusResponse {
	success: boolean;
	idocNumber: string;
	currentStatus: string;
	currentStatusText: string;
	statusHistory: IZatwIdocStatusRecord[];
	error?: IZatwError;
}

/**
 * IDoc type metadata
 */
export interface IZatwIdocTypeMetadata {
	idocType: string;
	extension?: string;
	description: string;
	messageTypes: string[];
	segments: IZatwIdocSegmentMetadata[];
}

/**
 * IDoc segment metadata
 */
export interface IZatwIdocSegmentMetadata {
	segmentType: string;
	description: string;
	parentSegment?: string;
	minOccurs: number;
	maxOccurs: number;
	fields: IZatwIdocSegmentField[];
}

/**
 * IDoc segment field
 */
export interface IZatwIdocSegmentField {
	name: string;
	dataType: string;
	length: number;
	description?: string;
}

// ============================================
// Error Types
// ============================================

/**
 * ZATW error structure
 */
export interface IZatwError {
	code: string;
	message: string;
	details?: string;
	sapCode?: string;
	sapMessage?: string;
	exception?: string;
}

/**
 * Error codes from ZATW
 */
export const ZATW_ERROR_CODES = {
	// Connection errors
	CONNECTION_FAILED: 'ZATW001',
	AUTHENTICATION_FAILED: 'ZATW002',
	TIMEOUT: 'ZATW003',

	// RFC errors
	FUNCTION_NOT_FOUND: 'ZATW101',
	PARAMETER_ERROR: 'ZATW102',
	EXECUTION_ERROR: 'ZATW103',
	BAPI_ERROR: 'ZATW104',

	// IDoc errors
	IDOC_TYPE_NOT_FOUND: 'ZATW201',
	SEGMENT_ERROR: 'ZATW202',
	PARTNER_ERROR: 'ZATW203',
	SEND_ERROR: 'ZATW204',

	// General errors
	INVALID_REQUEST: 'ZATW901',
	INTERNAL_ERROR: 'ZATW999',
} as const;

// ============================================
// Credentials Types
// ============================================

/**
 * SAP Connector API credentials
 */
export interface ISapConnectorCredentials {
	host: string;
	client: string;
	username: string;
	password: string;
	language?: string;
	allowUnauthorizedCerts?: boolean;
}

// ============================================
// Cache Types
// ============================================

/**
 * FM metadata cache entry
 */
export interface IZatwFmCacheEntry {
	metadata: IZatwFmMetadata;
	expires: number;
}

/**
 * FM search cache entry
 */
export interface IZatwFmSearchCacheEntry {
	results: IZatwFmSearchResult[];
	pattern: string;
	expires: number;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Generic ZATW API response wrapper
 */
export interface IZatwApiResponse<T> {
	success: boolean;
	data?: T;
	error?: IZatwError;
	timestamp: string;
}

/**
 * Meta endpoint request types
 */
export type ZatwMetaAction = 'search_fm' | 'get_fm' | 'search_idoc' | 'get_idoc';

/**
 * Meta endpoint request
 */
export interface IZatwMetaRequest {
	action: ZatwMetaAction;
	pattern?: string;
	name?: string;
}
