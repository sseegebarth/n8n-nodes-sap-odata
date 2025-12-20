"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchRequestBuilder = exports.BatchOperationType = void 0;
const crypto_1 = require("crypto");
const Logger_1 = require("./Logger");
var BatchOperationType;
(function (BatchOperationType) {
    BatchOperationType["CREATE"] = "POST";
    BatchOperationType["UPDATE"] = "PATCH";
    BatchOperationType["DELETE"] = "DELETE";
    BatchOperationType["GET"] = "GET";
})(BatchOperationType || (exports.BatchOperationType = BatchOperationType = {}));
class BatchRequestBuilder {
    static buildBatchRequest(config) {
        const batchBoundary = `${this.BATCH_BOUNDARY_PREFIX}${(0, crypto_1.randomUUID)()}`;
        const parts = [];
        if (config.useChangeSet) {
            const changeSetPart = this.buildChangeSet(config.operations);
            parts.push(changeSetPart);
        }
        else {
            config.operations.forEach((operation) => {
                const part = this.buildOperationPart(operation, config.servicePath);
                parts.push(part);
            });
        }
        const body = parts.map(part => `--${batchBoundary}\n${part}`).join('\n') +
            `\n--${batchBoundary}--`;
        return {
            body,
            contentType: `multipart/mixed; boundary=${batchBoundary}`,
            boundary: batchBoundary,
        };
    }
    static buildChangeSet(operations) {
        const changeSetBoundary = `${this.CHANGESET_BOUNDARY_PREFIX}${(0, crypto_1.randomUUID)()}`;
        const parts = [];
        parts.push('Content-Type: multipart/mixed; boundary=' + changeSetBoundary);
        parts.push('');
        operations.forEach((operation) => {
            const operationContent = this.buildOperationContent(operation, '');
            parts.push(`--${changeSetBoundary}`);
            parts.push('Content-Type: application/http');
            parts.push('Content-Transfer-Encoding: binary');
            parts.push('');
            parts.push(operationContent);
        });
        parts.push(`--${changeSetBoundary}--`);
        return parts.join('\n');
    }
    static buildOperationPart(operation, servicePath) {
        const parts = [];
        parts.push('Content-Type: application/http');
        parts.push('Content-Transfer-Encoding: binary');
        parts.push('');
        parts.push(this.buildOperationContent(operation, servicePath));
        return parts.join('\n');
    }
    static buildOperationContent(operation, servicePath) {
        const lines = [];
        const url = this.buildOperationUrl(operation, servicePath);
        lines.push(`${operation.type} ${url} HTTP/1.1`);
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...operation.headers,
        };
        Object.entries(headers).forEach(([key, value]) => {
            lines.push(`${key}: ${value}`);
        });
        if (operation.data && (operation.type === 'POST' || operation.type === 'PATCH')) {
            lines.push('');
            lines.push(JSON.stringify(operation.data));
        }
        return lines.join('\n');
    }
    static buildOperationUrl(operation, servicePath) {
        let url = `${servicePath}/${operation.entitySet}`;
        if (operation.entityKey && (operation.type === 'PATCH' || operation.type === 'DELETE' || operation.type === 'GET')) {
            url += `(${operation.entityKey})`;
        }
        if (operation.queryParams && Object.keys(operation.queryParams).length > 0) {
            const params = new URLSearchParams(Object.entries(operation.queryParams).map(([k, v]) => [k, String(v)]));
            url += `?${params.toString()}`;
        }
        return url;
    }
    static parseBatchResponse(responseText, boundary) {
        const results = [];
        const parts = responseText.split(`--${boundary}`);
        parts.forEach((part) => {
            if (!part.trim() || part.trim() === '--') {
                return;
            }
            try {
                const result = this.parseResponsePart(part);
                if (result) {
                    results.push(result);
                }
            }
            catch (error) {
                Logger_1.Logger.error('Failed to parse batch response part', error instanceof Error ? error : undefined, { module: 'BatchRequestBuilder' });
            }
        });
        const allSuccess = results.every(r => r.success);
        return {
            success: allSuccess,
            results,
        };
    }
    static parseResponsePart(part) {
        var _a, _b, _c;
        const lines = part.split('\n');
        const statusLine = lines.find(line => line.startsWith('HTTP/'));
        if (!statusLine) {
            return null;
        }
        const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+)/);
        if (!statusMatch) {
            return null;
        }
        const statusCode = parseInt(statusMatch[1], 10);
        const success = statusCode >= 200 && statusCode < 300;
        const emptyLineIndex = lines.findIndex(line => line.trim() === '');
        const bodyLines = lines.slice(emptyLineIndex + 1);
        const bodyText = bodyLines.join('\n').trim();
        let data = undefined;
        let error = undefined;
        if (bodyText) {
            try {
                const parsed = JSON.parse(bodyText);
                if (success) {
                    data = parsed;
                }
                else {
                    error = ((_b = (_a = parsed.error) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.value) || ((_c = parsed.error) === null || _c === void 0 ? void 0 : _c.message) || 'Unknown error';
                }
            }
            catch {
                if (!success) {
                    error = bodyText;
                }
            }
        }
        return {
            operation: {},
            success,
            statusCode,
            data,
            error,
        };
    }
    static splitIntoBatches(operations, batchSize = 100) {
        const batches = [];
        for (let i = 0; i < operations.length; i += batchSize) {
            batches.push(operations.slice(i, i + batchSize));
        }
        return batches;
    }
    static validateOperations(operations) {
        const errors = [];
        operations.forEach((op, index) => {
            if (!op.type) {
                errors.push(`Operation ${index}: Missing type`);
            }
            if (!op.entitySet) {
                errors.push(`Operation ${index}: Missing entitySet`);
            }
            if ((op.type === 'POST' || op.type === 'PATCH') && !op.data) {
                errors.push(`Operation ${index}: Missing data for ${op.type}`);
            }
            if ((op.type === 'PATCH' || op.type === 'DELETE') && !op.entityKey) {
                errors.push(`Operation ${index}: Missing entityKey for ${op.type}`);
            }
            if (op.entitySet && !/^[a-zA-Z0-9_]+$/.test(op.entitySet)) {
                errors.push(`Operation ${index}: Invalid entitySet name`);
            }
        });
        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
exports.BatchRequestBuilder = BatchRequestBuilder;
BatchRequestBuilder.BATCH_BOUNDARY_PREFIX = 'batch_';
BatchRequestBuilder.CHANGESET_BOUNDARY_PREFIX = 'changeset_';
