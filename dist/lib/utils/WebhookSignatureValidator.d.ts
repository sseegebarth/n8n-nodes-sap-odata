export declare enum SignatureAlgorithm {
    HMAC_SHA256 = "sha256",
    HMAC_SHA512 = "sha512",
    HMAC_SHA1 = "sha1"
}
export declare enum SignatureFormat {
    Hex = "hex",
    Base64 = "base64",
    PrefixedHex = "prefixed_hex",
    PrefixedBase64 = "prefixed_base64"
}
export interface IValidationOptions {
    algorithm: SignatureAlgorithm;
    format: SignatureFormat;
    headerName: string;
    toleranceMs?: number;
    validateTimestamp?: boolean;
    timestampHeaderName?: string;
}
export interface IValidationResult {
    isValid: boolean;
    error?: string;
    timestampValid?: boolean;
    timestampAge?: number;
}
export declare class WebhookSignatureValidator {
    private secret;
    constructor(secret: string);
    validate(payload: string | Buffer, receivedSignature: string, options: IValidationOptions, headers?: Record<string, string>): IValidationResult;
    generateSignature(payload: string | Buffer, algorithm: SignatureAlgorithm, format: SignatureFormat): string;
    validateTimestamp(timestamp: string, toleranceMs: number): {
        isValid: boolean;
        error?: string;
        age?: number;
    };
    private constantTimeCompare;
    verifyWithMultipleAlgorithms(payload: string | Buffer, receivedSignature: string, algorithms: SignatureAlgorithm[], format: SignatureFormat): {
        isValid: boolean;
        algorithm?: SignatureAlgorithm;
        error?: string;
    };
    static parsePrefixedSignature(prefixedSignature: string): {
        algorithm: string;
        signature: string;
    } | null;
    static generateTimestamp(date?: Date): string;
    static generateUnixTimestamp(date?: Date): number;
}
