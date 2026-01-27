"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleManager = void 0;
class ThrottleManager {
    constructor(options) {
        this.queue = [];
        this.refillTimer = null;
        this.destroyed = false;
        this.options = {
            maxRequestsPerSecond: options.maxRequestsPerSecond,
            strategy: options.strategy,
            burstSize: options.burstSize,
            onThrottle: options.onThrottle,
        };
        this.tokens = options.burstSize;
        this.lastRefill = Date.now();
        this.startRefillTimer();
    }
    async acquire() {
        if (this.destroyed) {
            throw new Error('ThrottleManager has been destroyed');
        }
        this.refillTokens();
        if (this.tokens > 0) {
            this.tokens--;
            return true;
        }
        switch (this.options.strategy) {
            case 'delay':
                return this.delayUntilAvailable();
            case 'drop':
                return false;
            case 'queue':
                return this.queueRequest();
            default:
                return false;
        }
    }
    refillTokens() {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
        const tokensToAdd = timePassed * this.options.maxRequestsPerSecond;
        if (Math.floor(tokensToAdd) > 0) {
            this.tokens = Math.min(this.options.burstSize, this.tokens + Math.floor(tokensToAdd));
            this.lastRefill = now;
        }
    }
    async delayUntilAvailable() {
        const waitTime = this.calculateWaitTime();
        if (this.options.onThrottle) {
            this.options.onThrottle(waitTime);
        }
        await this.sleep(waitTime);
        return this.acquire();
    }
    async queueRequest() {
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
        });
    }
    calculateWaitTime() {
        const tokensNeeded = 1;
        const timePerToken = 1000 / this.options.maxRequestsPerSecond;
        return Math.ceil(tokensNeeded * timePerToken);
    }
    startRefillTimer() {
        if (this.refillTimer) {
            clearInterval(this.refillTimer);
            this.refillTimer = null;
        }
        this.refillTimer = setInterval(() => {
            if (this.destroyed) {
                if (this.refillTimer) {
                    clearInterval(this.refillTimer);
                    this.refillTimer = null;
                }
                return;
            }
            this.refillTokens();
            this.processQueue();
        }, 100);
        if (this.refillTimer && typeof this.refillTimer.unref === 'function') {
            this.refillTimer.unref();
        }
    }
    processQueue() {
        while (this.queue.length > 0 && this.tokens > 0) {
            const next = this.queue.shift();
            if (next) {
                this.tokens--;
                next.resolve(true);
            }
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    getStatus() {
        return {
            tokens: this.tokens,
            queueLength: this.queue.length,
            maxRequestsPerSecond: this.options.maxRequestsPerSecond,
            strategy: this.options.strategy,
        };
    }
    destroy() {
        this.destroyed = true;
        if (this.refillTimer) {
            clearInterval(this.refillTimer);
            this.refillTimer = null;
        }
        while (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) {
                next.reject(new Error('ThrottleManager destroyed'));
            }
        }
    }
}
exports.ThrottleManager = ThrottleManager;
