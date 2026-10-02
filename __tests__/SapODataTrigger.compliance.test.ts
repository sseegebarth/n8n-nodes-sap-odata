/**
 * Guards the 1.0.0 compliance adjustments: the observable behaviour of the
 * trigger must stay as in 0.5.0-beta.7 while the n8n community-node rules are
 * satisfied.
 */
import { SapODataTrigger } from '../nodes/SapODataTrigger/SapODataTrigger.node';

const sapOdataApiRequest = jest.fn();
jest.mock('../nodes/SapOData/GenericFunctions', () => ({
	sapOdataApiRequest: (...args: unknown[]) => sapOdataApiRequest(...args),
}));

const node = { name: 'SAP Trigger', type: 'sapODataTrigger', typeVersion: 1, position: [0, 0], parameters: {} };
const makeLogger = () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() });

describe('SapODataTrigger description', () => {
	const trigger = new SapODataTrigger();

	it('does not declare usableAsTool', () => {
		expect((trigger.description as unknown as Record<string, unknown>).usableAsTool).toBeUndefined();
	});

	it('declares a credential test for the webhook credential', () => {
		const cred = trigger.description.credentials!.find((c) => c.name === 'sapOdataWebhookApi');
		expect(cred?.testedBy).toBe('sapOdataWebhookCredentialTest');
		expect(typeof trigger.methods.credentialTest.sapOdataWebhookCredentialTest).toBe('function');
	});
});

describe('webhook credential test', () => {
	const test = new SapODataTrigger().methods.credentialTest.sapOdataWebhookCredentialTest;

	it('fails without a secret', async () => {
		const result = await test.call({} as never, { id: '1', name: 'x', type: 'sapOdataWebhookApi', data: { secret: '' } });
		expect(result.status).toBe('Error');
	});

	it('passes with a secret and performs no request', async () => {
		const helpers = { request: jest.fn(), httpRequest: jest.fn() };
		const result = await test.call({ helpers } as never, { id: '1', name: 'x', type: 'sapOdataWebhookApi', data: { secret: 's3cret' } });
		expect(result.status).toBe('OK');
		expect(helpers.request).not.toHaveBeenCalled();
		expect(helpers.httpRequest).not.toHaveBeenCalled();
	});
});

describe('subscription lifecycle keeps its return values and logs instead of swallowing', () => {
	const methods = new SapODataTrigger().webhookMethods.default;

	beforeEach(() => sapOdataApiRequest.mockReset());

	it('checkExists returns false and warns when the SAP lookup throws', async () => {
		sapOdataApiRequest.mockRejectedValue(new Error('SAP down'));
		const staticData: Record<string, unknown> = { subscriptionId: 'SUB123' };
		const logger = makeLogger();
		const ctx = {
			getWorkflowStaticData: () => staticData,
			getCredentials: jest.fn().mockResolvedValue({ host: 'https://sap.example' }),
			getNode: () => node,
			logger,
		};
		await expect(methods.checkExists.call(ctx as never)).resolves.toBe(false);
		expect(staticData.subscriptionId).toBeUndefined();
	});

	it('checkExists returns false and warns when static data access throws', async () => {
		const logger = makeLogger();
		const ctx = {
			getWorkflowStaticData: () => {
				throw new Error('no static data');
			},
			getNode: () => node,
			logger,
		};
		await expect(methods.checkExists.call(ctx as never)).resolves.toBe(false);
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});

	it('delete returns true, clears the subscription and warns when the SAP DELETE throws', async () => {
		sapOdataApiRequest.mockRejectedValue(new Error('403'));
		const staticData: Record<string, unknown> = { subscriptionId: 'SUB123' };
		const logger = makeLogger();
		const ctx = {
			getWorkflowStaticData: () => staticData,
			getCredentials: jest.fn().mockResolvedValue({ host: 'https://sap.example' }),
			getNode: () => node,
			logger,
		};
		await expect(methods.delete.call(ctx as never)).resolves.toBe(true);
		expect(staticData.subscriptionId).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});
});

describe('webhook HMAC error handling', () => {
	const trigger = new SapODataTrigger();

	const makeCtx = (getCredentials: jest.Mock, signature?: string) => {
		const resp = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
		};
		const headers: Record<string, string> = {};
		if (signature) headers['x-sap-signature'] = signature;
		const params: Record<string, unknown> = {
			authentication: 'hmacSignature',
			responseMode: 'immediate',
			responseCode: 200,
			options: { enableRateLimiting: false },
		};
		const ctx = {
			getRequestObject: () => ({ headers, socket: { remoteAddress: '10.0.0.1' }, rawBody: '{"d":{}}' }),
			getResponseObject: () => resp,
			getNodeParameter: (name: string, fallback?: unknown) => (name in params ? params[name] : fallback),
			getBodyData: () => ({}),
			getCredentials,
			getNode: () => node,
			logger: makeLogger(),
		};
		return { ctx, resp };
	};

	it('still answers 401 on an invalid signature', async () => {
		const getCredentials = jest.fn().mockResolvedValue({ secret: 's3cret', algorithm: 'sha256', headerName: 'X-SAP-Signature' });
		const { ctx, resp } = makeCtx(getCredentials, 'deadbeef');
		const result = await trigger.webhook.call(ctx as never);
		expect(result).toEqual({ noWebhookResponse: true });
		expect(resp.status).toHaveBeenCalledWith(401);
		expect(resp.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
	});

	it('still answers 401 when the signature header is missing', async () => {
		const getCredentials = jest.fn().mockResolvedValue({ secret: 's3cret', algorithm: 'sha256', headerName: 'X-SAP-Signature' });
		const { ctx, resp } = makeCtx(getCredentials);
		await trigger.webhook.call(ctx as never);
		expect(resp.status).toHaveBeenCalledWith(401);
	});

	it.each([
		['ordinary error', new Error('credential store unavailable'), 'credential store unavailable'],
		['connection refused', new Error('connect ECONNREFUSED 127.0.0.1:5432'), 'connect ECONNREFUSED [localhost]'],
		['timeout', new Error('credential store ETIMEDOUT'), 'credential store ETIMEDOUT'],
		['empty message', new Error(''), ''],
		['null', null, 'null'],
		['undefined', undefined, 'undefined'],
		['string with a token', 'credential store token=sensitive', 'credential store token=***'],
	])('preserves the beta.7 HTTP 400 response for %s when loading the credential fails', async (_name, error, message) => {
		// Before 1.0.0 the raw error was re-thrown and caught by the outer handler,
		// which answers 400. Wrapping it in NodeOperationError must not change that.
		const getCredentials = jest.fn().mockRejectedValue(error);
		const { ctx, resp } = makeCtx(getCredentials, 'deadbeef');
		const result = await trigger.webhook.call(ctx as never);
		expect(result).toEqual({ noWebhookResponse: true });
		expect(resp.status).toHaveBeenCalledWith(400);
		expect(resp.status).not.toHaveBeenCalledWith(401);
		expect(resp.json).toHaveBeenCalledTimes(1);
		expect(resp.json).toHaveBeenCalledWith({ error: 'Webhook processing failed', message });
	});
});
