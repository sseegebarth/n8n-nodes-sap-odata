"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ODataErrorHandler = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const constants_1 = require("../constants");
const SecurityUtils_1 = require("./SecurityUtils");
function createErrorWithStatusCode(node, message, statusCode, options, sapErrorCode) {
    const error = new n8n_workflow_1.NodeOperationError(node, message, options);
    if (statusCode) {
        error.httpStatusCode = statusCode;
    }
    if (sapErrorCode) {
        error.sapErrorCode = sapErrorCode;
    }
    throw error;
}
class ODataErrorHandler {
    static handleApiError(error, node, context = {}) {
        var _a, _b, _c, _d, _e, _f, _g;
        const httpError = error;
        const sanitizedMessage = (0, SecurityUtils_1.sanitizeErrorMessage)(httpError.message || 'Unknown error');
        const statusCode = ((_a = httpError.response) === null || _a === void 0 ? void 0 : _a.status) || ((_b = httpError.response) === null || _b === void 0 ? void 0 : _b.statusCode) || httpError.statusCode || context.statusCode;
        const sapError = ((_d = (_c = httpError.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || httpError.error;
        const sapCode = sapError === null || sapError === void 0 ? void 0 : sapError.code;
        const sapMessage = typeof (sapError === null || sapError === void 0 ? void 0 : sapError.message) === 'string' ? sapError.message : (_e = sapError === null || sapError === void 0 ? void 0 : sapError.message) === null || _e === void 0 ? void 0 : _e.value;
        const innererror = sapError === null || sapError === void 0 ? void 0 : sapError.innererror;
        let description = '';
        if (context.operation) {
            description += `Operation: ${context.operation}\n`;
        }
        if (context.resource) {
            description += `Resource: ${context.resource}\n`;
        }
        if (statusCode) {
            description += `Status Code: ${statusCode}\n`;
        }
        if (sapCode) {
            description += `SAP Error Code: ${sapCode}\n`;
        }
        if (innererror === null || innererror === void 0 ? void 0 : innererror.type) {
            description += `Error Type: ${innererror.type}\n`;
        }
        if (sapCode) {
            if (sapCode.includes('BAPI_ERROR') || sapCode.includes('/IWBEP/')) {
                createErrorWithStatusCode(node, `SAP Function Error: ${sapMessage || 'BAPI not available'}`, statusCode, {
                    description: `${description}\n\nCheck SAP Gateway transaction /IWFND/MAINT_SERVICE for available functions and their status.\n\nCommon causes:\n- Function not activated in SAP Gateway\n- Missing authorization for function module\n- Incorrect function import name`,
                    itemIndex: context.itemIndex,
                }, sapCode);
            }
            if (sapCode.includes('TYPE_MISMATCH') || (innererror === null || innererror === void 0 ? void 0 : innererror.type) === 'Type Mismatch') {
                createErrorWithStatusCode(node, `Type Mismatch: ${sapMessage}`, statusCode, {
                    description: `${description}\n\nThe data type provided does not match the expected type in SAP.\n\nCommon fixes:\n- Check field types in $metadata\n- Ensure numbers are not quoted as strings\n- Verify date/time format (e.g., datetime'2024-01-15T10:30:00')\n- Check GUID format (e.g., guid'xxx-xxx-xxx')`,
                    itemIndex: context.itemIndex,
                }, sapCode);
            }
            if ((innererror === null || innererror === void 0 ? void 0 : innererror.type) === 'Mandatory Parameter Missing' || sapCode.includes('MANDATORY')) {
                createErrorWithStatusCode(node, `Mandatory Parameter Missing: ${sapMessage}`, statusCode, {
                    description: `${description}\n\nA required field is missing from your request.\n\nCheck:\n- Review $metadata for mandatory fields (Nullable="false")\n- Ensure all key fields are provided\n- Verify entity structure matches OData service definition`,
                    itemIndex: context.itemIndex,
                }, sapCode);
            }
            createErrorWithStatusCode(node, `SAP Error (${sapCode}): ${sapMessage || sanitizedMessage}`, statusCode, {
                description: `${description}\n\nThis is a SAP-specific error. Check SAP Gateway error logs:\n- Transaction: /IWFND/ERROR_LOG\n- Transaction: /IWFND/GW_CLIENT (for testing)\n\nError details may provide more context in SAP system logs.`,
                itemIndex: context.itemIndex,
            }, sapCode);
        }
        const errorMessage = sanitizedMessage.toLowerCase();
        if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
            createErrorWithStatusCode(node, 'Connection Refused - Cannot reach SAP system', statusCode, {
                description: `${description}\n\nThe SAP system refused the connection.\n\nHow to fix:\n1. Verify the Host URL in your credential settings\n2. Check if SAP system is running\n3. Verify firewall allows connection to SAP port (443, 8000, 8001)\n4. If using ZATW: Ensure /sap/bc/zatw/connector/ service is active in SICF\n\nTest connectivity:\n- Try accessing the SAP URL in a browser\n- Check with your network administrator`,
                itemIndex: context.itemIndex,
            });
        }
        if (errorMessage.includes('etimedout') || errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            createErrorWithStatusCode(node, 'Connection Timeout - SAP system not responding', statusCode, {
                description: `${description}\n\nThe request timed out waiting for SAP response.\n\nHow to fix:\n1. Check SAP system availability\n2. Increase timeout in Advanced Options\n3. For large data requests, reduce batch size\n4. Check network latency to SAP system\n\nIf using ZATW Connector:\n- Verify /sap/bc/zatw/connector/ service is responding\n- Check SAP ICM service status (SMICM)`,
                itemIndex: context.itemIndex,
            });
        }
        if (errorMessage.includes('enotfound') || errorMessage.includes('getaddrinfo')) {
            createErrorWithStatusCode(node, 'Host Not Found - Invalid SAP hostname', statusCode, {
                description: `${description}\n\nCannot resolve the SAP hostname.\n\nHow to fix:\n1. Check the Host URL in your credential settings\n2. Verify the hostname is correct and accessible\n3. Check DNS configuration\n4. Try using IP address instead of hostname`,
                itemIndex: context.itemIndex,
            });
        }
        switch (statusCode) {
            case 400:
                createErrorWithStatusCode(node, 'Bad Request: Invalid OData syntax', 400, {
                    description: `${description}\n\nCommon causes:\n- Invalid $filter syntax (check quotes and operators)\n- Type mismatch in filter values\n- Malformed entity key format\n- Invalid field names in $select or $expand\n\nExample correct syntax:\n- Filter: Status eq 'A' and Amount gt 100\n- Key: ProductID='123' or ProductID='123',CompanyCode='0001'`,
                    itemIndex: context.itemIndex,
                });
            case 401:
                createErrorWithStatusCode(node, constants_1.ERROR_MESSAGES.AUTH_FAILED, 401, {
                    description: `${description}\n\nAuthentication failed.\n\nHow to fix:\n1. Go to n8n Settings → Credentials\n2. Open your SAP credential and verify:\n   - Username is correct (case-sensitive)\n   - Password is correct\n   - SAP Client (Mandant) number is correct\n\n3. Test in SAP:\n   - Try logging into SAP GUI with same credentials\n   - Check if user is locked (SU01)\n   - Verify user has authorization for this service`,
                    itemIndex: context.itemIndex,
                });
            case 403:
                createErrorWithStatusCode(node, 'Access Forbidden - Missing SAP Authorizations', 403, {
                    description: `${description}\n\nYour SAP user does not have permission to access this resource.\n\nCommon causes:\n- Missing authorization objects (S_SERVICE, S_ICF)\n- Service is not activated for your user role\n- Custom Z-services require specific custom authorizations\n\nHow to fix:\n1. Check authorization trace in SAP (transaction: ST01)\n2. Request access from SAP Administrator\n3. Verify service is activated in /IWFND/MAINT_SERVICE\n4. Test in SAP Gateway Client (/IWFND/GW_CLIENT)\n\nNote: Connection Test may succeed while data access fails if you only have metadata permissions.`,
                    itemIndex: context.itemIndex,
                });
            case 404:
                const entityKeyMatch = (_f = context.resource) === null || _f === void 0 ? void 0 : _f.match(/\(([^)]+)\)/);
                const entityKey = entityKeyMatch ? entityKeyMatch[1] : null;
                const entitySetMatch = (_g = context.resource) === null || _g === void 0 ? void 0 : _g.match(/^([^(]+)/);
                const entitySetName = entitySetMatch ? entitySetMatch[1] : context.resource;
                if (entityKey) {
                    createErrorWithStatusCode(node, 'Entity Not Found', 404, {
                        description: `${description}\n\nThe entity with key ${entityKey} does not exist in ${entitySetName}.\n\nPossible causes:\n- The entity was deleted\n- The key value is incorrect\n- Key format mismatch (check quotes for string keys)\n\nVerify the entity exists in SAP system.`,
                        itemIndex: context.itemIndex,
                    });
                }
                createErrorWithStatusCode(node, 'Resource Not Found', 404, {
                    description: `${description}\n\nThe requested resource does not exist.\n\nFor Entity Sets:\n- Verify entity set name spelling\n- Check service is deployed and active\n- Try Custom mode with exact name from /IWFND/GW_CLIENT`,
                    itemIndex: context.itemIndex,
                });
            case 405:
                createErrorWithStatusCode(node, 'HTTP Method Not Allowed', 405, {
                    description: `${description}\n\nThe HTTP method is not supported for this resource.\n\nFor Function Imports:\n- GET methods: Use for read-only functions\n- POST methods: Use for action functions that modify data\n- Check function definition in $metadata for allowed methods\n\nFor Entity Operations:\n- Use GET for retrieve, POST for create, PATCH for update, DELETE for delete`,
                    itemIndex: context.itemIndex,
                });
            case 429:
                createErrorWithStatusCode(node, constants_1.ERROR_MESSAGES.RATE_LIMIT_EXCEEDED, 429, {
                    description: `${description}\n\nToo many requests. Please wait before retrying.\n\nConsider:\n- Increasing throttle delay in Advanced Options\n- Reducing batch size for GetAll operations\n- Implementing retry logic with exponential backoff`,
                    itemIndex: context.itemIndex,
                });
            case 500:
                createErrorWithStatusCode(node, 'SAP Internal Server Error', 500, {
                    description: `${description}\n\nThe SAP server encountered an internal error.\n\nCheck:\n- SAP Gateway error logs (/IWFND/ERROR_LOG)\n- ABAP short dumps (transaction: ST22)\n- Gateway logs for detailed error messages\n\nThis often indicates a backend issue in SAP system.`,
                    itemIndex: context.itemIndex,
                });
            case 502:
                createErrorWithStatusCode(node, 'Bad Gateway', 502, {
                    description: `${description}\n\nSAP Gateway could not reach the backend system.\n\nCheck:\n- Backend connection in SAP Gateway (transaction: /IWFND/GW_CLIENT)\n- RFC destinations are configured correctly\n- Backend system is running and accessible`,
                    itemIndex: context.itemIndex,
                });
            case 503:
            case 504:
                createErrorWithStatusCode(node, 'Service Temporarily Unavailable', statusCode, {
                    description: `${description}\n\nThe SAP service is temporarily unavailable or timed out.\n\nConsider:\n- Retrying the request after a delay\n- Checking SAP system availability\n- Increasing timeout in Advanced Options\n- For large datasets, use smaller batch sizes`,
                    itemIndex: context.itemIndex,
                });
            default:
                const apiError = new n8n_workflow_1.NodeApiError(node, {
                    message: sanitizedMessage,
                    description,
                    ...(typeof error === 'object' && error !== null ? error : {}),
                }, {
                    itemIndex: context.itemIndex,
                });
                if (statusCode) {
                    apiError.httpStatusCode = statusCode;
                }
                throw apiError;
        }
    }
    static handleValidationError(message, node, itemIndex) {
        throw new n8n_workflow_1.NodeOperationError(node, message, {
            itemIndex,
        });
    }
    static handleOperationError(operation, error, node, itemIndex) {
        const context = {
            operation,
            itemIndex,
        };
        if (error instanceof n8n_workflow_1.NodeOperationError || error instanceof n8n_workflow_1.NodeApiError) {
            throw error;
        }
        this.handleApiError(error, node, context);
    }
    static async wrapAsync(operation, node, context = {}) {
        try {
            return await operation();
        }
        catch (error) {
            this.handleApiError(error, node, context);
        }
    }
}
exports.ODataErrorHandler = ODataErrorHandler;
