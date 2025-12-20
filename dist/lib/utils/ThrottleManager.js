"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleManager = void 0;
const Logger_1 = require("./Logger");
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
        Logger_1.Logger.debug('ThrottleManager initialized', {
            module: 'ThrottleManager',
            maxRequestsPerSecond: this.options.maxRequestsPerSecond,
            strategy: this.options.strategy,
            burstSize: this.options.burstSize,
        });
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
                Logger_1.Logger.warn('Request dropped due to rate limiting', {
                    module: 'ThrottleManager',
                    strategy: 'drop',
                });
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
            Logger_1.Logger.debug('Tokens refilled', {
                module: 'ThrottleManager',
                tokens: this.tokens,
                tokensAdded: Math.floor(tokensToAdd),
            });
        }
    }
    async delayUntilAvailable() {
        const waitTime = this.calculateWaitTime();
        if (this.options.onThrottle) {
            this.options.onThrottle(waitTime);
        }
        Logger_1.Logger.debug('Request delayed due to throttling', {
            module: 'ThrottleManager',
            waitTime: `${waitTime}ms`,
            strategy: 'delay',
        });
        await this.sleep(waitTime);
        return this.acquire();
    }
    async queueRequest() {
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
            Logger_1.Logger.debug('Request queued', {
                module: 'ThrottleManager',
                queueLength: this.queue.length,
                strategy: 'queue',
            });
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
                Logger_1.Logger.debug('Queued request processed', {
                    module: 'ThrottleManager',
                    remainingQueue: this.queue.length,
                });
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
        Logger_1.Logger.debug('ThrottleManager destroyed', {
            module: 'ThrottleManager',
        });
    }
}
exports.ThrottleManager = ThrottleManager;
