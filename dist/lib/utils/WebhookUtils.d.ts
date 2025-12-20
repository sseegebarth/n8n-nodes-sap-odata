import { IDataObject } from 'n8n-workflow';
export declare function verifyHmacSignature(payload: string | Buffer, signature: string, secret: string, algorithm?: 'sha256' | 'sha512'): boolean;
export declare function generateHmacSignature(payload: string | Buffer, secret: string, algorithm?: 'sha256' | 'sha512'): string;
export declare function isIpAllowed(clientIp: string, whitelist: string[]): boolean;
export declare function isValidSapODataPayload(payload: any): boolean;
export declare function isValidSapIdocXml(xmlData: string): boolean;
export declare function parseSapDates(obj: any): any;
export declare function extractEventInfo(payload: any): IDataObject;
export declare function extractChangedFields(oldValue: any, newValue: any): IDataObject;
export declare function validateBasicAuth(authHeader: string | undefined, expectedUsername: string, expectedPassword: string): boolean;
export declare function extractBearerToken(authHeader: string | undefined): string | null;
export declare function safeJsonParse<T = any>(jsonString: string, defaultValue: T): T;
export declare function buildWebhookResponse(success: boolean, message: string, data?: IDataObject): IDataObject;
export declare function buildWebhookErrorResponse(message: string, statusCode?: number): IDataObject;
export declare function sanitizePayload(payload: any, sensitiveFields?: string[]): any;
export interface IRateLimitConfig {
    maxRequests: number;
    windowMs: number;
}
export interface IRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export declare class WebhookRateLimiter {
    private static instance;
    private requests;
    private config;
    private cleanupTimer;
    private constructor();
    static getInstance(config?: Partial<IRateLimitConfig>): WebhookRateLimiter;
    static resetInstance(): void;
    checkLimit(ip: string): IRateLimitResult;
    getStatus(ip: string): {
        requests: number;
        remaining: number;
        windowMs: number;
    };
    resetIp(ip: string): void;
    private startCleanupTimer;
    private cleanup;
    destroy(): void;
    getTrackedIpCount(): number;
}
export declare function checkWebhookRateLimit(clientIp: string, maxRequests?: number, windowMs?: number): IRateLimitResult;
