"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookSignatureValidator = exports.SignatureFormat = exports.SignatureAlgorithm = void 0;
const crypto = __importStar(require("crypto"));
const Logger_1 = require("./Logger");
var SignatureAlgorithm;
(function (SignatureAlgorithm) {
    SignatureAlgorithm["HMAC_SHA256"] = "sha256";
    SignatureAlgorithm["HMAC_SHA512"] = "sha512";
    SignatureAlgorithm["HMAC_SHA1"] = "sha1";
})(SignatureAlgorithm || (exports.SignatureAlgorithm = SignatureAlgorithm = {}));
var SignatureFormat;
(function (SignatureFormat) {
    SignatureFormat["Hex"] = "hex";
    SignatureFormat["Base64"] = "base64";
    SignatureFormat["PrefixedHex"] = "prefixed_hex";
    SignatureFormat["PrefixedBase64"] = "prefixed_base64";
})(SignatureFormat || (exports.SignatureFormat = SignatureFormat = {}));
class WebhookSignatureValidator {
    constructor(secret) {
        if (!secret || secret.length === 0) {
            throw new Error('Webhook secret cannot be empty');
        }
        if (secret.length < 32) {
            Logger_1.Logger.warn('Webhook secret is shorter than 32 characters - consider using a longer secret', {
                module: 'WebhookSignatureValidator',
                length: secret.length,
            });
        }
        this.secret = secret;
    }
    validate(payload, receivedSignature, options, headers) {
        const { algorithm, format, validateTimestamp = false, timestampHeaderName, toleranceMs = 300000 } = options;
        Logger_1.Logger.debug('Validating webhook signature', {
            module: 'WebhookSignatureValidator',
            algorithm,
            format,
            validateTimestamp,
        });
        if (validateTimestamp) {
            if (!headers || !timestampHeaderName) {
                return {
                    isValid: false,
                    error: 'Timestamp validation requested but headers or timestampHeaderName not provided',
                };
            }
            const timestamp = headers[timestampHeaderName.toLowerCase()];
            if (!timestamp) {
                return {
                    isValid: false,
                    error: `Timestamp header '${timestampHeaderName}' not found`,
                };
            }
            const timestampValidation = this.validateTimestamp(timestamp, toleranceMs);
            if (!timestampValidation.isValid) {
                return {
                    isValid: false,
                    error: timestampValidation.error,
                    timestampValid: false,
                    timestampAge: timestampValidation.age,
                };
            }
        }
        const expectedSignature = this.generateSignature(payload, algorithm, format);
        const isValid = this.constantTimeCompare(receivedSignature, expectedSignature);
        if (!isValid) {
            Logger_1.Logger.warn('Webhook signature validation failed', {
                module: 'WebhookSignatureValidator',
                algorithm,
                format,
            });
            return {
                isValid: false,
                error: 'Signature mismatch',
            };
        }
        Logger_1.Logger.info('Webhook signature validated successfully', {
            module: 'WebhookSignatureValidator',
            algorithm,
        });
        return {
            isValid: true,
            timestampValid: validateTimestamp ? true : undefined,
        };
    }
    generateSignature(payload, algorithm, format) {
        const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
        const hmac = crypto.createHmac(algorithm, this.secret);
        hmac.update(payloadBuffer);
        switch (format) {
            case SignatureFormat.Hex:
                return hmac.digest('hex');
            case SignatureFormat.Base64:
                return hmac.digest('base64');
            case SignatureFormat.PrefixedHex:
                return `${algorithm}=${hmac.digest('hex')}`;
            case SignatureFormat.PrefixedBase64:
                return `${algorithm}=${hmac.digest('base64')}`;
            default:
                throw new Error(`Unsupported signature format: ${format}`);
        }
    }
    validateTimestamp(timestamp, toleranceMs) {
        let timestampMs;
        if (timestamp.includes('T') || timestamp.includes('-')) {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return {
                    isValid: false,
                    error: 'Invalid timestamp format',
                };
            }
            timestampMs = date.getTime();
        }
        else {
            const ts = parseInt(timestamp, 10);
            if (isNaN(ts)) {
                return {
                    isValid: false,
                    error: 'Invalid timestamp format',
                };
            }
            timestampMs = ts < 10000000000 ? ts * 1000 : ts;
        }
        const now = Date.now();
        const age = now - timestampMs;
        if (age > toleranceMs) {
            Logger_1.Logger.warn('Webhook timestamp too old', {
                module: 'WebhookSignatureValidator',
                age: `${Math.floor(age / 1000)}s`,
                tolerance: `${Math.floor(toleranceMs / 1000)}s`,
            });
            return {
                isValid: false,
                error: `Timestamp too old: ${Math.floor(age / 1000)}s (max ${Math.floor(toleranceMs / 1000)}s)`,
                age,
            };
        }
        if (age < -60000) {
            Logger_1.Logger.warn('Webhook timestamp in the future', {
                module: 'WebhookSignatureValidator',
                age: `${Math.floor(age / 1000)}s`,
            });
            return {
                isValid: false,
                error: 'Timestamp is in the future',
                age,
            };
        }
        return {
            isValid: true,
            age,
        };
    }
    constantTimeCompare(a, b) {
        if (crypto.timingSafeEqual) {
            try {
                const bufferA = Buffer.from(a, 'utf8');
                const bufferB = Buffer.from(b, 'utf8');
                if (bufferA.length !== bufferB.length) {
                    return false;
                }
                return crypto.timingSafeEqual(bufferA, bufferB);
            }
            catch (error) {
                Logger_1.Logger.warn('crypto.timingSafeEqual failed, using fallback', {
                    module: 'WebhookSignatureValidator',
                });
            }
        }
        if (a.length !== b.length) {
            return false;
        }
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
    verifyWithMultipleAlgorithms(payload, receivedSignature, algorithms, format) {
        for (const algorithm of algorithms) {
            const expectedSignature = this.generateSignature(payload, algorithm, format);
            if (this.constantTimeCompare(receivedSignature, expectedSignature)) {
                Logger_1.Logger.info('Webhook verified with algorithm', {
                    module: 'WebhookSignatureValidator',
                    algorithm,
                });
                return {
                    isValid: true,
                    algorithm,
                };
            }
        }
        return {
            isValid: false,
            error: 'No matching signature found with any algorithm',
        };
    }
    static parsePrefixedSignature(prefixedSignature) {
        const match = prefixedSignature.match(/^([a-z0-9]+)=(.+)$/);
        if (!match) {
            return null;
        }
        return {
            algorithm: match[1],
            signature: match[2],
        };
    }
    static generateTimestamp(date) {
        return (date || new Date()).toISOString();
    }
    static generateUnixTimestamp(date) {
        return Math.floor(((date || new Date()).getTime()) / 1000);
    }
}
exports.WebhookSignatureValidator = WebhookSignatureValidator;
