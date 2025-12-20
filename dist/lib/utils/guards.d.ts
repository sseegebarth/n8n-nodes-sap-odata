import { IODataV2Response, IODataV4Response, IODataResponse, IODataEntity } from '../types';
export declare function isODataV2Response<T = IODataEntity>(response: unknown): response is IODataV2Response<T>;
export declare function isODataV4Response<T = IODataEntity>(response: unknown): response is IODataV4Response<T>;
export declare function isODataResponse<T = IODataEntity>(value: unknown): value is IODataResponse<T>;
export declare function isError(error: unknown): error is Error;
