"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayProtectionManager = void 0;
class ReplayProtectionManager {
    constructor(config) {
        this.cleanupTimer = null;
        this.config = {
            ...ReplayProtectionManager.DEFAULT_CONFIG,
            ...config,
        };
        this.nonceStore = new Map();
        this.startCleanup();
    }
    static getInstance(config) {
        if (!ReplayProtectionManager.instance) {
            ReplayProtectionManager.instance = new ReplayProtectionManager(config);
        }
        return ReplayProtectionManager.instance;
    }
    static resetInstance() {
        if (ReplayProtectionManager.instance) {
            ReplayProtectionManager.instance.destroy();
            ReplayProtectionManager.instance = null;
        }
    }
    destroy() {
        this.stopCleanup();
        this.clearAll();
    }
    checkNonce(nonce) {
        if (!nonce || nonce.length === 0) {
            return {
                isReplay: true,
                error: 'Nonce is required',
            };
        }
        const entry = this.nonceStore.get(nonce);
        if (!entry) {
            return {
                isReplay: false,
            };
        }
        const now = Date.now();
        const age = now - entry.timestamp;
        if (entry.expiresAt < now) {
            return {
                isReplay: false,
                isExpired: true,
            };
        }
        return {
            isReplay: true,
            error: 'Nonce already used',
            age,
        };
    }
    checkNonceWithTimestamp(nonce, timestamp, toleranceMs) {
        const nonceResult = this.checkNonce(nonce);
        if (nonceResult.isReplay) {
            return nonceResult;
        }
        const timestampResult = this.validateTimestamp(timestamp, toleranceMs);
        if (!timestampResult.isValid) {
            return {
                isReplay: true,
                error: timestampResult.error || 'Invalid timestamp',
            };
        }
        return {
            isReplay: false,
        };
    }
    storeNonce(nonce, signature, ttl) {
        if (!nonce || nonce.length === 0) {
            return false;
        }
        if (this.nonceStore.size >= this.config.maxNonces) {
            this.cleanup();
            if (this.nonceStore.size >= this.config.maxNonces) {
                return false;
            }
        }
        const now = Date.now();
        const effectiveTTL = ttl || this.config.nonceTTL;
        const entry = {
            nonce,
            timestamp: now,
            expiresAt: now + effectiveTTL,
            signature,
        };
        this.nonceStore.set(nonce, entry);
        return true;
    }
    validateTimestamp(timestamp, toleranceMs) {
        const tolerance = toleranceMs || this.config.nonceTTL;
        let timestampMs;
        if (typeof timestamp === 'string') {
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
        }
        else {
            timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
        }
        const now = Date.now();
        const age = now - timestampMs;
        if (age > tolerance) {
            return {
                isValid: false,
                error: `Timestamp too old: ${Math.floor(age / 1000)}s (max ${Math.floor(tolerance / 1000)}s)`,
            };
        }
        if (age < -this.config.maxClockSkewMs) {
            return {
                isValid: false,
                error: `Timestamp in the future: ${Math.floor(-age / 1000)}s`,
            };
        }
        return {
            isValid: true,
        };
    }
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [nonce, entry] of this.nonceStore.entries()) {
            if (entry.expiresAt < now) {
                this.nonceStore.delete(nonce);
                cleanedCount++;
            }
        }
    }
    startCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupIntervalMs);
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
    clearAll() {
        this.nonceStore.clear();
    }
    getStats() {
        const size = this.nonceStore.size;
        const maxSize = this.config.maxNonces;
        const utilizationPercent = (size / maxSize) * 100;
        return {
            size,
            maxSize,
            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
        };
    }
    static generateNonce(length = 32) {
        const crypto = require('crypto');
        return crypto.randomBytes(length).toString('hex');
    }
}
exports.ReplayProtectionManager = ReplayProtectionManager;
ReplayProtectionManager.DEFAULT_CONFIG = {
    nonceTTL: 5 * 60 * 1000,
    cleanupIntervalMs: 60 * 1000,
    maxNonces: 10000,
    requireTimestamp: true,
    maxClockSkewMs: 60 * 1000,
};
