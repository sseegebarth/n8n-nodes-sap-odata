import { IDataObject, INode } from 'n8n-workflow';
export declare function verifyHmacSignature(payload: string | Buffer, signature: string, secret: string, algorithm?: 'sha256' | 'sha512'): boolean;
export declare function isIpAllowed(clientIp: string, whitelist: string[], node?: INode): boolean;
export declare function isValidSapODataPayload(payload: any): boolean;
export declare function parseSapDates(obj: any): any;
export declare function extractEventInfo(payload: any): IDataObject;
export declare function extractChangedFields(oldValue: any, newValue: any): IDataObject;
export interface IRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export declare function checkWebhookRateLimit(clientIp: string, maxRequests?: number, windowMs?: number): IRateLimitResult;
