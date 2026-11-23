import { mock } from 'jest-mock-extended';
import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { PubNub } from '../PubNub.node';

type Params = Record<string, unknown>;

describe('PubNub node', () => {
	const node = new PubNub();
	const httpRequest = jest.fn();

	const credentials = {
		publishKey: 'pub',
		subscribeKey: 'sub',
		userId: 'me',
		authKey: 'tok',
	};

	function createContext(params: Params, opts: { items?: number; continueOnFail?: boolean } = {}) {
		const ctx = mock<IExecuteFunctions>();
		ctx.getInputData.mockReturnValue(Array.from({ length: opts.items ?? 1 }, () => ({ json: {} })));
		ctx.getNodeParameter.mockImplementation(((name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback) as never);
		ctx.getCredentials.mockResolvedValue(credentials);
		ctx.getNode.mockReturnValue(mock<INode>({ name: 'PubNub' }));
		ctx.continueOnFail.mockReturnValue(opts.continueOnFail ?? false);
		ctx.helpers.httpRequest = httpRequest as never;
		ctx.helpers.returnJsonArray = ((d: unknown) =>
			(Array.isArray(d) ? d : [d]).map((json) => ({ json }))) as never;
		ctx.helpers.constructExecutionMetaData = ((data: unknown[], meta: { itemData: unknown }) =>
			data.map((d) => ({ ...(d as object), pairedItem: meta.itemData }))) as never;
		return ctx;
	}

	beforeEach(() => {
		httpRequest.mockReset();
		httpRequest.mockResolvedValue({ ok: true });
	});

	describe('description', () => {
		it('should require the pubNubApi credential', () => {
			expect(node.description.credentials).toEqual([{ name: 'pubNubApi', required: true }]);
		});

		it('should expose the four resources', () => {
			const resource = node.description.properties.find((p) => p.name === 'resource');
			const values = (resource?.options as Array<{ value: string }>).map((o) => o.value);
			expect(values).toEqual(['message', 'history', 'presence', 'channelGroup']);
		});
	});

	describe('message', () => {
		it('should publish a message with parsed metadata', async () => {
			httpRequest.mockResolvedValue({ status: 'Sent' });
			const ctx = createContext({
				resource: 'message',
				operation: 'publish',
				channel: 'room',
				message: { hello: 'world' },
				publishOptions: { meta: '{"k":"v"}' },
			});

			const [out] = await node.execute.call(ctx);

			const req = httpRequest.mock.calls[0][0];
			expect(req.method).toBe('POST');
			expect(req.url).toContain('/publish/pub/sub/0/room/0');
			expect(req.url).toContain(`meta=${encodeURIComponent('{"k":"v"}')}`);
			expect(req.body).toEqual({ hello: 'world' });
			expect(out).toHaveLength(1);
			expect(out[0].json).toEqual({ status: 'Sent' });
		});

		it('should throw a NodeOperationError for invalid metadata JSON', async () => {
			const ctx = createContext({
				resource: 'message',
				operation: 'publish',
				channel: 'room',
				message: 'm',
				publishOptions: { meta: '{bad' },
			});

			await expect(node.execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
			expect(httpRequest).not.toHaveBeenCalled();
		});

		it('should send a signal', async () => {
			const ctx = createContext({
				resource: 'message',
				operation: 'signal',
				channel: 'room',
				signalMessage: 'ping',
			});

			await node.execute.call(ctx);

			const req = httpRequest.mock.calls[0][0];
			expect(req.method).toBe('GET');
			expect(req.url).toContain('/signal/pub/sub/0/room/0/ping');
		});
	});

	describe('history', () => {
		it('should fetch messages with query options', async () => {
			const ctx = createContext({
				resource: 'history',
				operation: 'fetchMessages',
				channel: 'my room',
				historyOptions: { count: 10, start: '1', end: '2', includeMeta: true, includeMessageActions: true },
			});

			await node.execute.call(ctx);

			expect(httpRequest).toHaveBeenCalledWith({
				method: 'GET',
				url: 'https://ps.pndsn.com/v3/history/sub-key/sub/channel/my%20room',
				qs: {
					max: 10,
					start: '1',
					end: '2',
					include_meta: 'true',
					include_message_actions: 'true',
					uuid: 'me',
					auth: 'tok',
				},
				body: undefined,
				json: true,
			});
		});

		it('should default to 100 messages', async () => {
			const ctx = createContext({ resource: 'history', operation: 'fetchMessages', channel: 'c' });

			await node.execute.call(ctx);

			expect(httpRequest.mock.calls[0][0].qs.max).toBe(100);
		});

		it('should delete messages', async () => {
			const ctx = createContext({ resource: 'history', operation: 'deleteMessages', channel: 'c' });

			await node.execute.call(ctx);

			expect(httpRequest.mock.calls[0][0].method).toBe('DELETE');
			expect(httpRequest.mock.calls[0][0].url).toContain('/v3/history/sub-key/sub/channel/c');
		});

		it('should fetch message counts', async () => {
			const ctx = createContext({ resource: 'history', operation: 'messageCounts', channel: 'c' });

			await node.execute.call(ctx);

			expect(httpRequest.mock.calls[0][0].url).toContain('/v3/history/sub-key/sub/message-counts/c');
		});
	});

	describe('presence', () => {
		it('should run hereNow for multiple channels', async () => {
			const ctx = createContext({
				resource: 'presence',
				operation: 'hereNow',
				channels: 'a, b',
				presenceOptions: { includeUUIDs: false, includeState: true },
			});

			await node.execute.call(ctx);

			const req = httpRequest.mock.calls[0][0];
			expect(req.url).toContain('/v2/presence/sub-key/sub/channel/a%2Cb');
			expect(req.qs).toMatchObject({ disable_uuids: '1', state: '1' });
		});

		it('should use the credential user id for whereNow when uuid is empty', async () => {
			const ctx = createContext({ resource: 'presence', operation: 'whereNow', uuid: '' });

			await node.execute.call(ctx);

			expect(httpRequest.mock.calls[0][0].url).toContain('/uuid/me');
		});

		it('should set state as JSON', async () => {
			const ctx = createContext({
				resource: 'presence',
				operation: 'setState',
				channels: 'a,b',
				uuid: 'bob',
				state: { s: 1 },
			});

			await node.execute.call(ctx);

			const req = httpRequest.mock.calls[0][0];
			expect(req.url).toContain('/channel/a%2Cb/uuid/bob/data');
			expect(req.qs.state).toBe('{"s":1}');
		});

		it('should get state', async () => {
			const ctx = createContext({ resource: 'presence', operation: 'getState', channels: 'a', uuid: '' });

			await node.execute.call(ctx);

			expect(httpRequest.mock.calls[0][0].url).toContain('/channel/a/uuid/me');
		});
	});

	describe('channelGroup', () => {
		const base = { resource: 'channelGroup', channelGroup: 'grp' };
		const endpoint = 'https://ps.pndsn.com/v1/channel-registration/sub-key/sub/channel-group/grp';

		it.each([
			['addChannels', { channels: 'a, b' }, { add: 'a,b' }],
			['removeChannels', { channels: 'a, b' }, { remove: 'a,b' }],
			['listChannels', {}, {}],
			['deleteGroup', {}, { 'remove-group': '' }],
		])('should handle %s', async (operation, extra, expectedQs) => {
			const ctx = createContext({ ...base, operation, ...extra });

			await node.execute.call(ctx);

			const req = httpRequest.mock.calls[0][0];
			expect(req.url).toBe(endpoint);
			expect(req.qs).toEqual({ ...expectedQs, uuid: 'me', auth: 'tok' });
		});
	});

	describe('error handling', () => {
		it('should wrap request errors in a NodeOperationError', async () => {
			httpRequest.mockRejectedValue(new Error('boom'));
			const ctx = createContext({ resource: 'history', operation: 'messageCounts', channel: 'c' });

			await expect(node.execute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
		});

		it('should return the error per item when continueOnFail is enabled', async () => {
			httpRequest.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ ok: true });
			const ctx = createContext(
				{ resource: 'history', operation: 'messageCounts', channel: 'c' },
				{ items: 2, continueOnFail: true },
			);

			const [out] = await node.execute.call(ctx);

			expect(out).toHaveLength(2);
			expect(out[0].json).toEqual({ error: 'boom' });
			expect(out[1].json).toEqual({ ok: true });
		});
	});
});
