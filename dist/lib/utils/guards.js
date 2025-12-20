"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isODataV2Response = isODataV2Response;
exports.isODataV4Response = isODataV4Response;
exports.isODataResponse = isODataResponse;
exports.isError = isError;
function isODataV2Response(response) {
    return (typeof response === 'object' &&
        response !== null &&
        'd' in response);
}
function isODataV4Response(response) {
    return (typeof response === 'object' &&
        response !== null &&
        ('value' in response || '@odata.nextLink' in response || '@odata.context' in response));
}
function isODataResponse(value) {
    return isODataV2Response(value) || isODataV4Response(value);
}
function isError(error) {
    return error instanceof Error ||
        (typeof error === 'object' &&
            error !== null &&
            'message' in error);
}
