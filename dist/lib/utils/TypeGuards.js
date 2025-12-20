"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isError = isError;
exports.isHttpError = isHttpError;
exports.getHttpStatusCode = getHttpStatusCode;
exports.isNetworkError = isNetworkError;
exports.isTimeoutError = isTimeoutError;
exports.isCertificateError = isCertificateError;
exports.extractSapError = extractSapError;
exports.getErrorMessage = getErrorMessage;
exports.isRetryableError = isRetryableError;
exports.isPlainObject = isPlainObject;
exports.isSapGuid = isSapGuid;
exports.isSapDateString = isSapDateString;
exports.isSapTimeString = isSapTimeString;
function isError(value) {
    return value instanceof Error ||
        (typeof value === 'object' &&
            value !== null &&
            'message' in value &&
            typeof value.message === 'string');
}
function isHttpError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const err = error;
    const hasStatusCode = (typeof err.statusCode === 'number' ||
        typeof err.status === 'number' ||
        (err.response && (typeof err.response.statusCode === 'number' ||
            typeof err.response.status === 'number')));
    return hasStatusCode;
}
function getHttpStatusCode(error) {
    var _a, _b;
    if (!isHttpError(error)) {
        return undefined;
    }
    const httpError = error;
    return httpError.statusCode ||
        httpError.status ||
        ((_a = httpError.response) === null || _a === void 0 ? void 0 : _a.statusCode) ||
        ((_b = httpError.response) === null || _b === void 0 ? void 0 : _b.status);
}
function isNetworkError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const err = error;
    const networkErrorCodes = [
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ESOCKETTIMEDOUT',
        'ECONNRESET',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'ECONNABORTED',
        'EPIPE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'CERT_HAS_EXPIRED',
        'CERT_NOT_YET_VALID'
    ];
    return typeof err.code === 'string' && networkErrorCodes.includes(err.code);
}
function isTimeoutError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const err = error;
    const timeoutCodes = ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'TIMEOUT', 'ECONNABORTED'];
    return (typeof err.code === 'string' && timeoutCodes.includes(err.code)) ||
        (typeof err.message === 'string' && /timeout/i.test(err.message));
}
function isCertificateError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const err = error;
    const certErrorCodes = [
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'CERT_HAS_EXPIRED',
        'CERT_NOT_YET_VALID',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
        'UNABLE_TO_GET_LOCAL_ISSUER_CERT'
    ];
    return (typeof err.code === 'string' && certErrorCodes.includes(err.code)) ||
        (typeof err.message === 'string' && /certificate/i.test(err.message));
}
function extractSapError(error) {
    var _a;
    if (!isHttpError(error)) {
        return undefined;
    }
    const httpError = error;
    if (((_a = httpError.response) === null || _a === void 0 ? void 0 : _a.data) &&
        typeof httpError.response.data === 'object' &&
        'error' in httpError.response.data) {
        return httpError.response.data.error;
    }
    if ('error' in httpError && typeof httpError.error === 'object') {
        return httpError.error;
    }
    return undefined;
}
function getErrorMessage(error) {
    var _a, _b;
    if (typeof error === 'string') {
        return error;
    }
    if (isError(error)) {
        return error.message;
    }
    const sapError = extractSapError(error);
    if (sapError) {
        if (typeof sapError.message === 'string') {
            return sapError.message;
        }
        if (typeof sapError.message === 'object' && ((_a = sapError.message) === null || _a === void 0 ? void 0 : _a.value)) {
            return sapError.message.value;
        }
    }
    if (isHttpError(error)) {
        const httpError = error;
        if (httpError.message) {
            return httpError.message;
        }
        if ((_b = httpError.response) === null || _b === void 0 ? void 0 : _b.message) {
            return httpError.response.message;
        }
    }
    return 'Unknown error occurred';
}
function isRetryableError(error) {
    if (isNetworkError(error)) {
        if (isCertificateError(error)) {
            return false;
        }
        return true;
    }
    const statusCode = getHttpStatusCode(error);
    if (statusCode) {
        const retryableStatusCodes = [
            408,
            429,
            500,
            502,
            503,
            504,
        ];
        return retryableStatusCodes.includes(statusCode);
    }
    return false;
}
function isPlainObject(value) {
    return typeof value === 'object' &&
        value !== null &&
        value.constructor === Object &&
        Object.prototype.toString.call(value) === '[object Object]';
}
function isSapGuid(value) {
    if (typeof value !== 'string') {
        return false;
    }
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
}
function isSapDateString(value) {
    if (typeof value !== 'string') {
        return false;
    }
    return /^\/Date\(\d+([+-]\d+)?\)\/$/.test(value);
}
function isSapTimeString(value) {
    if (typeof value !== 'string') {
        return false;
    }
    return /^PT(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(value);
}
