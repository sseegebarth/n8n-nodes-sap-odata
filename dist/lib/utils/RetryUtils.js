"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryHandler = void 0;
exports.withRetry = withRetry;
const n8n_workflow_1 = require("n8n-workflow");
const constants_1 = require("../constants");
const Logger_1 = require("./Logger");
function calculateDelay(attempt, initialDelay, maxDelay, backoffFactor) {
    const exponentialDelay = initialDelay * Math.pow(backoffFactor, attempt);
    const jitter = exponentialDelay * 0.2 * Math.random();
    return Math.min(exponentialDelay + jitter, maxDelay);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class RetryHandler {
    constructor(options = {}) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.options = {
            maxAttempts: (_a = options.maxAttempts) !== null && _a !== void 0 ? _a : constants_1.MAX_RETRY_ATTEMPTS,
            initialDelay: (_b = options.initialDelay) !== null && _b !== void 0 ? _b : constants_1.INITIAL_RETRY_DELAY,
            maxDelay: (_c = options.maxDelay) !== null && _c !== void 0 ? _c : constants_1.MAX_RETRY_DELAY,
            backoffFactor: (_d = options.backoffFactor) !== null && _d !== void 0 ? _d : 2,
            retryableStatusCodes: (_e = options.retryableStatusCodes) !== null && _e !== void 0 ? _e : constants_1.RETRY_STATUS_CODES,
            retryNetworkErrors: (_f = options.retryNetworkErrors) !== null && _f !== void 0 ? _f : true,
            onRetry: (_g = options.onRetry) !== null && _g !== void 0 ? _g : (() => { }),
        };
    }
    async execute(fn) {
        let lastError;
        for (let attempt = 0; attempt < this.options.maxAttempts; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                if (!this.isRetryable(error)) {
                    throw error;
                }
                if (attempt >= this.options.maxAttempts - 1) {
                    Logger_1.Logger.warn('Max retry attempts exhausted', {
                        module: 'RetryHandler',
                        maxAttempts: this.options.maxAttempts,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    throw error;
                }
                const delay = this.calculateDelay(attempt);
                this.options.onRetry(attempt + 1, error, delay);
                await sleep(delay);
            }
        }
        throw lastError;
    }
    calculateDelay(attempt) {
        return calculateDelay(attempt, this.options.initialDelay, this.options.maxDelay, this.options.backoffFactor);
    }
    isRetryable(error) {
        const statusCode = this.extractStatusCode(error);
        if (statusCode && this.options.retryableStatusCodes.includes(statusCode)) {
            return true;
        }
        if (this.options.retryNetworkErrors && this.isNetworkError(error)) {
            return true;
        }
        return false;
    }
    extractStatusCode(error) {
        if (error instanceof n8n_workflow_1.NodeApiError && error.httpCode) {
            return typeof error.httpCode === 'string'
                ? parseInt(error.httpCode, 10)
                : error.httpCode;
        }
        if (error.statusCode) {
            return error.statusCode;
        }
        return null;
    }
    isNetworkError(error) {
        const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
        return error.code && networkErrors.includes(error.code);
    }
}
exports.RetryHandler = RetryHandler;
async function withRetry(fn, options = {}) {
    const handler = new RetryHandler(options);
    return handler.execute(fn);
}
