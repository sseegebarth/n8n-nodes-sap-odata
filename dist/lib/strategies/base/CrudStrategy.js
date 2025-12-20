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
exports.CrudStrategy = void 0;
const Logger_1 = require("../../utils/Logger");
const SecurityUtils_1 = require("../../utils/SecurityUtils");
const StrategyHelpers = __importStar(require("../../utils/StrategyHelpers"));
class CrudStrategy {
    getServicePath(context, itemIndex) {
        return StrategyHelpers.getServicePath(context, itemIndex);
    }
    getEntitySet(context, itemIndex) {
        return StrategyHelpers.getEntitySet(context, itemIndex);
    }
    validateAndFormatKey(key, node) {
        return StrategyHelpers.validateAndFormatKey(key, node);
    }
    getQueryOptions(context, itemIndex) {
        return StrategyHelpers.getQueryOptions(context, itemIndex);
    }
    extractResult(response) {
        return StrategyHelpers.extractResult(response);
    }
    validateAndParseJson(dataString, fieldName, node) {
        return StrategyHelpers.validateAndParseJson(dataString, fieldName, node);
    }
    formatSuccessResponse(data, itemIndex) {
        const jsonData = (typeof data === 'object' && data !== null)
            ? data
            : { value: data };
        return [
            {
                json: jsonData,
                pairedItem: { item: itemIndex },
            },
        ];
    }
    handleOperationError(error, operation, itemIndex, continueOnFail = false) {
        const errorMessage = error.message || 'Unknown error occurred';
        const sanitizedMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(errorMessage);
        Logger_1.Logger.error(`${operation} failed`, error, {
            module: 'CrudStrategy',
            operation,
            itemIndex,
        });
        if (continueOnFail) {
            return [
                {
                    json: {
                        error: true,
                        message: sanitizedMessage,
                        operation,
                    },
                    pairedItem: { item: itemIndex },
                },
            ];
        }
        throw error;
    }
    buildResourcePath(entitySet, entityKey) {
        return StrategyHelpers.buildResourcePath(entitySet, entityKey);
    }
    logOperation(operation, details) {
        Logger_1.Logger.debug(`CRUD Operation: ${operation}`, {
            module: 'CrudStrategy',
            operation,
            ...details,
        });
    }
    applyTypeConversion(context, itemIndex, data) {
        return StrategyHelpers.applyTypeConversion(data, context, itemIndex);
    }
}
exports.CrudStrategy = CrudStrategy;
