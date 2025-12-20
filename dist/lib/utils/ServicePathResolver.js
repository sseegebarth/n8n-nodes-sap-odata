"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveServicePath = resolveServicePath;
const n8n_workflow_1 = require("n8n-workflow");
function resolveServicePath(context, customServicePath, itemIndex = 0) {
    if (customServicePath) {
        return customServicePath.replace(/\/$/, '');
    }
    let servicePath = '/sap/opu/odata/sap/';
    try {
        if ('getNodeParameter' in context) {
            const servicePathParam = context.getNodeParameter('servicePath', itemIndex, null);
            if (servicePathParam !== null) {
                if (typeof servicePathParam === 'object' && servicePathParam !== null) {
                    servicePath = servicePathParam.value || '';
                }
                else {
                    servicePath = servicePathParam;
                }
            }
            if (!servicePath || servicePath === '' || servicePath === '/sap/opu/odata/sap/') {
                throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'No service selected. Please select a service from the list or enter a path manually.', {
                    description: 'Select a service from the dropdown (From List mode) or enter the service path manually (By Path mode). Example: /sap/opu/odata/sap/API_BUSINESS_PARTNER/',
                    itemIndex,
                });
            }
        }
        else if ('getCurrentNodeParameter' in context) {
            const loadContext = context;
            const servicePathParam = loadContext.getCurrentNodeParameter('servicePath');
            if (servicePathParam) {
                if (typeof servicePathParam === 'object' && servicePathParam !== null) {
                    servicePath = servicePathParam.value || servicePath;
                }
                else {
                    servicePath = servicePathParam || servicePath;
                }
            }
        }
    }
    catch (error) {
        if (error instanceof n8n_workflow_1.NodeOperationError) {
            throw error;
        }
        if (error instanceof Error && error.message.includes('not found')) {
            servicePath = '/sap/opu/odata/sap/';
        }
        else {
            throw error;
        }
    }
    return servicePath.replace(/\/$/, '');
}
