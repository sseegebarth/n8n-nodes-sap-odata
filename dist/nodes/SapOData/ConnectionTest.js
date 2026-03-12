"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSapODataConnection = testSapODataConnection;
async function testSapODataConnection(credential) {
    var _a;
    const credentials = credential.data;
    if (!credentials) {
        return {
            status: 'Error',
            message: 'No credentials provided',
        };
    }
    const host = (_a = credentials.host) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, '');
    if (!host) {
        return {
            status: 'Error',
            message: 'Host URL is required',
        };
    }
    try {
        const requestOptions = {
            method: 'GET',
            url: `${host}/`,
            skipSslCertificateValidation: credentials.allowUnauthorizedCerts === true,
            returnFullResponse: true,
            ignoreHttpStatusErrors: true,
            timeout: 10000,
        };
        if (credentials.authentication === 'basicAuth' && credentials.username && credentials.password) {
            requestOptions.auth = {
                username: credentials.username,
                password: credentials.password,
            };
        }
        const headers = {};
        if (credentials.sapClient) {
            headers['sap-client'] = credentials.sapClient;
        }
        if (credentials.sapLanguage) {
            headers['sap-language'] = credentials.sapLanguage;
        }
        if (Object.keys(headers).length > 0) {
            requestOptions.headers = headers;
        }
        const response = await this.helpers.httpRequest(requestOptions);
        if (response !== undefined) {
            return {
                status: 'OK',
                message: 'Connection successful',
            };
        }
        return {
            status: 'Error',
            message: 'No response from SAP system',
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('ECONNREFUSED')) {
            return {
                status: 'Error',
                message: `Connection refused. Is the SAP system running at ${host}?`,
            };
        }
        if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
            return {
                status: 'Error',
                message: `Host not found: ${host}. Please check the URL.`,
            };
        }
        if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
            return {
                status: 'Error',
                message: `Connection timed out. The SAP system at ${host} is not responding.`,
            };
        }
        if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
            return {
                status: 'Error',
                message: 'SSL certificate error. Enable "Ignore SSL Issues" if using self-signed certificates.',
            };
        }
        return {
            status: 'Error',
            message: `Connection failed: ${errorMessage}`,
        };
    }
}
