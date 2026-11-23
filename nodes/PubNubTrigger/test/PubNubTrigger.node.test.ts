import { mock } from 'jest-mock-extended';
import type { INode, ITriggerFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { PubNubTrigger } from '../PubNubTrigger.node';

type Params = Record<string, unknown>;

describe('PubNubTrigger node', () => {
	const node = new PubNubTrigger();
	const httpRequest = jest.fn();

	function createContext(params: Params) {
		const ctx = mock<ITriggerFunctions>();
		ctx.getNodeParameter.mockImplementation(((name: string, fallback?: unknown) =>
			name in params ? params[name] : fallback) as never);
		ctx.getCredentials.mockResolvedValue({ subscribeKey: 'sub', publishKey: 'pub', userId: 'me' });
		ctx.getNode.mockReturnValue(mock<INode>({ name: 'PubNub Trigger' }));
		ctx.helpers.httpRequest = httpRequest as never;
		ctx.helpers.returnJsonArray = ((d: unknown) =>
			(Array.isArray(d) ? d : [d]).map((json) => ({ json }))) as never;
		return ctx;
	}

	beforeEach(() => {
		httpRequest.mockReset();
		httpRequest.mockImplementation(() => new Promise(() => {}));
	});

	it('should be a trigger with no inputs', () => {
		expect(node.description.group).toEqual(['trigger']);
		expect(node.description.inputs).toEqual([]);
	});

	it('should reject channel groups', async () => {
		const ctx = createContext({ triggerOn: 'message', channels: 'a', channelGroups: 'g' });

		await expect(node.trigger.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
	});

	it('should require at least one channel', async () => {
		const ctx = createContext({ triggerOn: 'message', channels: ' , ', channelGroups: '' });

		await expect(node.trigger.call(ctx)).rejects.toThrow('at least one channel');
	});

	it('should subscribe to each channel and emit incoming messages', async () => {
		let release: (v: unknown) => void = () => {};
		httpRequest
			.mockImplementationOnce(() => new Promise((r) => (release = r)))
			.mockImplementation(() => new Promise(() => {}));
		const ctx = createContext({
			triggerOn: 'message',
			channels: 'a',
			channelGroups: '',
			options: {},
		});

		const response = await node.trigger.call(ctx);
		release({ t: { t: '1' }, m: [{ d: { hello: 'world' } }] });
		await new Promise((r) => setImmediate(r));

		expect(ctx.emit).toHaveBeenCalledTimes(1);
		const payload = (ctx.emit.mock.calls[0][0] as unknown as Array<Array<{ json: Record<string, unknown> }>>)[0][0];
		expect(payload.json).toMatchObject({ event: 'message', channel: 'a', message: { hello: 'world' } });

		await response.closeFunction?.();
	});

	it('should not emit messages when triggering on presence only', async () => {
		let release: (v: unknown) => void = () => {};
		httpRequest
			.mockImplementationOnce(() => new Promise((r) => (release = r)))
			.mockImplementation(() => new Promise(() => {}));
		const ctx = createContext({ triggerOn: 'presence', channels: 'a', channelGroups: '', options: {} });

		const response = await node.trigger.call(ctx);
		release({ t: { t: '1' }, m: [{ d: 'x' }] });
		await new Promise((r) => setImmediate(r));

		expect(ctx.emit).not.toHaveBeenCalled();
		await response.closeFunction?.();
	});

	it('should stop polling when closed', async () => {
		// Yield to the event loop on every poll so the test can observe the stop
		httpRequest.mockImplementation(() => new Promise((r) => setImmediate(() => r({ t: { t: '1' } }))));
		const ctx = createContext({ triggerOn: 'message', channels: 'a,b', channelGroups: '', options: {} });

		const response = await node.trigger.call(ctx);
		await response.closeFunction?.();
		await new Promise((r) => setImmediate(r));
		const calls = httpRequest.mock.calls.length;
		await new Promise((r) => setImmediate(r));

		expect(httpRequest.mock.calls.length).toBe(calls);
	});
	function deferredFirstPoll() {
		let release: (v: unknown) => void = () => {};
		httpRequest
			.mockImplementationOnce(() => new Promise((r) => (release = r)))
			.mockImplementation(() => new Promise(() => {}));
		return (v: unknown) => release(v);
	}

	const firstPayload = (ctx: ReturnType<typeof createContext>, call = 0) =>
		(ctx.emit.mock.calls[call][0] as unknown as Array<Array<{ json: Record<string, unknown> }>>)[0][0].json;

	it('should resolve the manual trigger on the first message and emit it', async () => {
		const release = deferredFirstPoll();
		const ctx = createContext({ triggerOn: 'message', channels: 'first,second', channelGroups: '', options: {} });

		const response = await node.trigger.call(ctx);
		const manual = response.manualTriggerFunction!();
		release({ t: { t: '1' }, m: [{ d: { n: 1 } }] });
		await manual;

		// The manual handler replaces the regular one, so exactly one emit happens
		expect(ctx.emit).toHaveBeenCalledTimes(1);
		expect(firstPayload(ctx)).toMatchObject({ event: 'message', channel: 'first', message: { n: 1 } });
		await response.closeFunction?.();
	});

	it('should emit messages when triggering on both', async () => {
		const release = deferredFirstPoll();
		const ctx = createContext({ triggerOn: 'both', channels: 'a', channelGroups: '', options: {} });

		const response = await node.trigger.call(ctx);
		release({ t: { t: '1' }, m: [{ d: 'x' }] });
		await new Promise((r) => setImmediate(r));

		expect(ctx.emit).toHaveBeenCalledTimes(1);
		await response.closeFunction?.();
	});

	it('should include envelope metadata only when includeMeta is enabled', async () => {
		const envelope = { d: { text: 'hi' }, u: { k: 'v' } };

		let release = deferredFirstPoll();
		let ctx = createContext({ triggerOn: 'message', channels: 'a', channelGroups: '', options: { includeMeta: true } });
		let response = await node.trigger.call(ctx);
		release({ t: { t: '1' }, m: [envelope] });
		await new Promise((r) => setImmediate(r));
		expect(firstPayload(ctx)).toMatchObject({ message: { text: 'hi' }, metadata: { k: 'v' } });
		await response.closeFunction?.();

		release = deferredFirstPoll();
		ctx = createContext({ triggerOn: 'message', channels: 'a', channelGroups: '', options: {} });
		response = await node.trigger.call(ctx);
		release({ t: { t: '1' }, m: [envelope] });
		await new Promise((r) => setImmediate(r));
		expect(firstPayload(ctx)).not.toHaveProperty('metadata');
		await response.closeFunction?.();
	});

	it('should pass filter, timetoken and credentials through to the subscribe request', async () => {
		const ctx = createContext({
			triggerOn: 'message',
			channels: 'a',
			channelGroups: '',
			options: { filterExpression: "type == 'x'", timetoken: '42' },
		});

		const response = await node.trigger.call(ctx);
		const { url } = httpRequest.mock.calls[0][0];

		expect(url).toMatch(/^https:\/\/ps\.pndsn\.com\/v2\/subscribe\/sub\/a\/0\?/);
		expect(url).toContain('uuid=me');
		expect(url).toContain('tt=42');
		expect(url).toContain(`filter-expr=${encodeURIComponent("type == 'x'")}`);
		await response.closeFunction?.();
	});
});
