import { IDataObject } from 'n8n-workflow';
export interface IZatwHealthResponse {
    status: 'ok' | 'error';
    sapRelease: string;
    systemId: string;
    client: string;
    timestamp: string;
    version?: string;
    message?: string;
}
export type ZatwParameterType = 'IMPORTING' | 'EXPORTING' | 'CHANGING' | 'TABLES';
export type ZatwAbapType = 'CHAR' | 'NUMC' | 'DATS' | 'TIMS' | 'DEC' | 'CURR' | 'QUAN' | 'INT1' | 'INT2' | 'INT4' | 'INT8' | 'FLTP' | 'STRING' | 'XSTRING' | 'RAW' | 'STRUCTURE' | 'TABLE';
export interface IZatwStructureField {
    name: string;
    dataType: ZatwAbapType | string;
    length: number;
    decimals?: number;
    description?: string;
    isKey?: boolean;
}
export interface IZatwFmParameter {
    name: string;
    type: ZatwParameterType;
    dataType: ZatwAbapType | string;
    abapType?: string;
    optional: boolean;
    defaultValue?: string;
    description?: string;
    structure?: IZatwStructureField[];
    referenceType?: string;
}
export interface IZatwFmException {
    name: string;
    description?: string;
}
export interface IZatwFmMetadata {
    functionName: string;
    functionGroup: string;
    description: string;
    parameters: IZatwFmParameter[];
    exceptions: IZatwFmException[];
    isRemoteEnabled: boolean;
    lastChanged?: string;
}
export interface IZatwFmSearchResult {
    functionName: string;
    functionGroup: string;
    description: string;
    isRemoteEnabled: boolean;
}
export interface IZatwRfcRequest {
    functionName: string;
    parameters: IDataObject;
    options?: IZatwRfcOptions;
}
export interface IZatwRfcOptions {
    commit?: boolean;
    rollbackOnError?: boolean;
    checkReturn?: boolean;
    timeout?: number;
}
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
export interface IZatwRfcBatchRequest {
    functions: IZatwRfcBatchItem[];
    options?: IZatwRfcBatchOptions;
}
export interface IZatwRfcBatchItem {
    functionName: string;
    parameters: IDataObject;
    commitAfter?: boolean;
}
export interface IZatwRfcBatchOptions {
    stopOnError?: boolean;
    commitAll?: boolean;
    rollbackAll?: boolean;
}
export interface IZatwRfcBatchResponse {
    success: boolean;
    results: IZatwRfcResponse[];
    totalExecutionTime?: number;
}
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
export interface IZatwIdocDataRecord {
    segmentName: string;
    segmentNumber: number;
    parentSegment?: number;
    hierarchyLevel?: number;
    data: Record<string, string>;
}
export interface IZatwIdocStatusRecord {
    status: string;
    statusText: string;
    timestamp: string;
    userName?: string;
}
export interface IZatwIdocRequest {
    controlRecord: IZatwIdocControlRecord;
    dataRecords: IZatwIdocDataRecord[];
    options?: IZatwIdocOptions;
}
export interface IZatwIdocOptions {
    generateDocnum?: boolean;
    validateOnly?: boolean;
    synchronous?: boolean;
    testMode?: boolean;
}
export interface IZatwIdocResponse {
    success: boolean;
    idocNumber: string;
    status: string;
    statusText: string;
    messages?: IZatwBapiReturn[];
    error?: IZatwError;
}
export interface IZatwIdocStatusResponse {
    success: boolean;
    idocNumber: string;
    currentStatus: string;
    currentStatusText: string;
    statusHistory: IZatwIdocStatusRecord[];
    error?: IZatwError;
}
export interface IZatwIdocTypeMetadata {
    idocType: string;
    extension?: string;
    description: string;
    messageTypes: string[];
    segments: IZatwIdocSegmentMetadata[];
}
export interface IZatwIdocSegmentMetadata {
    segmentType: string;
    description: string;
    parentSegment?: string;
    minOccurs: number;
    maxOccurs: number;
    fields: IZatwIdocSegmentField[];
}
export interface IZatwIdocSegmentField {
    name: string;
    dataType: string;
    length: number;
    description?: string;
}
export interface IZatwError {
    code: string;
    message: string;
    details?: string;
    sapCode?: string;
    sapMessage?: string;
    exception?: string;
}
export declare const ZATW_ERROR_CODES: {
    readonly CONNECTION_FAILED: "ZATW001";
    readonly AUTHENTICATION_FAILED: "ZATW002";
    readonly TIMEOUT: "ZATW003";
    readonly FUNCTION_NOT_FOUND: "ZATW101";
    readonly PARAMETER_ERROR: "ZATW102";
    readonly EXECUTION_ERROR: "ZATW103";
    readonly BAPI_ERROR: "ZATW104";
    readonly IDOC_TYPE_NOT_FOUND: "ZATW201";
    readonly SEGMENT_ERROR: "ZATW202";
    readonly PARTNER_ERROR: "ZATW203";
    readonly SEND_ERROR: "ZATW204";
    readonly INVALID_REQUEST: "ZATW901";
    readonly INTERNAL_ERROR: "ZATW999";
};
export interface ISapConnectorCredentials {
    host: string;
    client: string;
    username: string;
    password: string;
    language?: string;
    allowUnauthorizedCerts?: boolean;
}
export interface IZatwFmCacheEntry {
    metadata: IZatwFmMetadata;
    expires: number;
}
export interface IZatwFmSearchCacheEntry {
    results: IZatwFmSearchResult[];
    pattern: string;
    expires: number;
}
export interface IZatwApiResponse<T> {
    success: boolean;
    data?: T;
    error?: IZatwError;
    timestamp: string;
}
export type ZatwMetaAction = 'search_fm' | 'get_fm' | 'search_idoc' | 'get_idoc';
export interface IZatwMetaRequest {
    action: ZatwMetaAction;
    pattern?: string;
    name?: string;
}
