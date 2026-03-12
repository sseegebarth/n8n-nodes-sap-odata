import { IDataObject, INode } from 'n8n-workflow';
export declare function verifyHmacSignature(payload: string | Buffer, signature: string, secret: string, algorithm?: 'sha256' | 'sha512'): boolean;
export declare function isIpAllowed(clientIp: string, whitelist: string[], node?: INode): boolean;
export declare function isValidSapODataPayload(payload: unknown): boolean;
export declare function parseSapDates(obj: unknown): unknown;
export declare function extractEventInfo(payload: Record<string, unknown>): IDataObject;
export declare function extractChangedFields(oldValue: Record<string, unknown>, newValue: Record<string, unknown>): IDataObject;
export interface IRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export declare function checkWebhookRateLimit(clientIp: string, maxRequests?: number, windowMs?: number): IRateLimitResult;
