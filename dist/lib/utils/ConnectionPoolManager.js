"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPoolManager = void 0;
const http_1 = require("http");
const https_1 = require("https");
const constants_1 = require("../constants");
class ConnectionPoolManager {
    constructor(config) {
        this.httpAgent = null;
        this.httpsAgent = null;
        this.httpFreeListener = null;
        this.httpsFreeListener = null;
        this.config = {
            ...ConnectionPoolManager.DEFAULT_CONFIG,
            ...config,
        };
        this.stats = {
            activeSockets: 0,
            freeSockets: 0,
            pendingRequests: 0,
            totalRequests: 0,
            totalConnectionsCreated: 0,
            totalConnectionsReused: 0,
        };
        this.initializeAgents();
    }
    static getInstance(config) {
        if (!ConnectionPoolManager.instance) {
            ConnectionPoolManager.instance = new ConnectionPoolManager(config);
        }
        else if (config) {
            ConnectionPoolManager.instance.updateConfig(config);
        }
        return ConnectionPoolManager.instance;
    }
    static resetInstance() {
        if (ConnectionPoolManager.instance) {
            ConnectionPoolManager.instance.destroy();
            ConnectionPoolManager.instance = undefined;
        }
    }
    initializeAgents() {
        const agentOptions = {
            keepAlive: this.config.keepAlive,
            keepAliveMsecs: this.config.keepAliveMsecs,
            maxSockets: this.config.maxSockets,
            maxFreeSockets: this.config.maxFreeSockets,
            timeout: this.config.timeout,
            freeSocketTimeout: this.config.freeSocketTimeout,
            scheduling: this.config.scheduling,
        };
        this.httpAgent = new http_1.Agent(agentOptions);
        this.httpsAgent = new https_1.Agent(agentOptions);
        this.setupEventListeners(this.httpAgent, 'http');
        this.setupEventListeners(this.httpsAgent, 'https');
    }
    setupEventListeners(agent, protocol) {
        const originalCreateConnection = agent.createConnection;
        if (originalCreateConnection) {
            agent.createConnection = (...args) => {
                this.stats.totalConnectionsCreated++;
                return originalCreateConnection.apply(agent, args);
            };
        }
        const freeListener = () => {
            this.stats.totalConnectionsReused++;
        };
        agent.on('free', freeListener);
        if (protocol === 'http') {
            this.httpFreeListener = freeListener;
        }
        else {
            this.httpsFreeListener = freeListener;
        }
    }
    getHttpAgent() {
        if (!this.httpAgent) {
            throw new Error('HTTP agent not initialized');
        }
        return this.httpAgent;
    }
    getHttpsAgent() {
        if (!this.httpsAgent) {
            throw new Error('HTTPS agent not initialized');
        }
        return this.httpsAgent;
    }
    getAgent(protocol) {
        this.stats.totalRequests++;
        if (protocol === 'https:') {
            return this.getHttpsAgent();
        }
        return this.getHttpAgent();
    }
    getStats() {
        const httpSockets = this.getAgentSockets(this.httpAgent);
        const httpsSockets = this.getAgentSockets(this.httpsAgent);
        return {
            ...this.stats,
            activeSockets: httpSockets.active + httpsSockets.active,
            freeSockets: httpSockets.free + httpsSockets.free,
            pendingRequests: httpSockets.pending + httpsSockets.pending,
        };
    }
    getAgentSockets(agent) {
        if (!agent) {
            return { active: 0, free: 0, pending: 0 };
        }
        const sockets = agent.sockets || {};
        const freeSockets = agent.freeSockets || {};
        const requests = agent.requests || {};
        const countSockets = (obj) => {
            return Object.values(obj).reduce((sum, arr) => {
                return sum + (Array.isArray(arr) ? arr.length : 0);
            }, 0);
        };
        return {
            active: countSockets(sockets),
            free: countSockets(freeSockets),
            pending: countSockets(requests),
        };
    }
    updateConfig(newConfig) {
        const hasChanged = Object.entries(newConfig).some(([key, value]) => {
            const configKey = key;
            return this.config[configKey] !== value;
        });
        if (!hasChanged) {
            return;
        }
        this.config = {
            ...this.config,
            ...newConfig,
        };
        this.destroy();
        this.initializeAgents();
    }
    getConfig() {
        return { ...this.config };
    }
    destroy() {
        if (this.httpAgent && this.httpFreeListener) {
            this.httpAgent.removeListener('free', this.httpFreeListener);
            this.httpFreeListener = null;
        }
        if (this.httpsAgent && this.httpsFreeListener) {
            this.httpsAgent.removeListener('free', this.httpsFreeListener);
            this.httpsFreeListener = null;
        }
        if (this.httpAgent) {
            this.httpAgent.destroy();
            this.httpAgent = null;
        }
        if (this.httpsAgent) {
            this.httpsAgent.destroy();
            this.httpsAgent = null;
        }
    }
    isHealthy() {
        const stats = this.getStats();
        if (stats.pendingRequests > this.config.maxSockets * 2) {
            return false;
        }
        if (stats.activeSockets > this.config.maxSockets) {
            return false;
        }
        return true;
    }
    resetStats() {
        this.stats = {
            activeSockets: 0,
            freeSockets: 0,
            pendingRequests: 0,
            totalRequests: 0,
            totalConnectionsCreated: 0,
            totalConnectionsReused: 0,
        };
    }
}
exports.ConnectionPoolManager = ConnectionPoolManager;
ConnectionPoolManager.DEFAULT_CONFIG = {
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: constants_1.DEFAULT_POOL_SIZE,
    maxFreeSockets: Math.floor(constants_1.DEFAULT_POOL_SIZE / 2),
    timeout: constants_1.DEFAULT_POOL_TIMEOUT,
    freeSocketTimeout: constants_1.DEFAULT_KEEP_ALIVE_TIMEOUT,
    scheduling: 'fifo',
};
