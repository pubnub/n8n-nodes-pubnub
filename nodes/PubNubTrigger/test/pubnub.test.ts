import PubNubClient from '../pubnub';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('PubNub subscribe client', () => {
	it('should long-poll and deliver messages, advancing timetoken and region', async () => {
		const received: unknown[] = [];
		const httpHelper = jest
			.fn()
			.mockResolvedValueOnce({ t: { t: '100', r: 4 }, m: [{ d: { n: 1 } }, { d: 'two' }] })
			// Hang forever afterwards so the loop does not spin
			.mockImplementation(() => new Promise(() => {}));

		const client = PubNubClient({ subscribeKey: 'sub', userId: 'me', authKey: 'tok', httpHelper });
		const sub = client.subscribe({
			channel: 'room',
			filter: 'a == 1',
			timetoken: '5',
			messages: (m) => received.push(m),
		});

		await flush();
		await flush();

		expect(httpHelper.mock.calls[0][0].url).toBe(
			'https://ps.pndsn.com/v2/subscribe/sub/room/0?uuid=me&tt=5&auth=tok&filter-expr=a%20%3D%3D%201',
		);
		expect(httpHelper.mock.calls[0][0].timeout).toBe(310000);
		expect(received).toEqual([{ n: 1 }, 'two']);
		expect(httpHelper.mock.calls[1][0].url).toContain('tt=100');
		expect(httpHelper.mock.calls[1][0].url).toContain('tr=4');

		sub.unsubscribe();
	});

	it('should stop polling after unsubscribe', async () => {
		// Yield to the event loop on every poll so the test can observe the stop
		const httpHelper = jest
			.fn()
			.mockImplementation(() => new Promise((r) => setImmediate(() => r({ t: { t: '1' } }))));
		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c' });

		await flush();
		sub.unsubscribe();
		await flush();
		const calls = httpHelper.mock.calls.length;
		await flush();

		expect(httpHelper.mock.calls.length).toBe(calls);
	});

	it('should throw when no http helper is configured', () => {
		expect(() => PubNubClient({}).subscribe({ channel: 'c' })).toThrow('HTTP helper is required');
	});

	it('should allow replacing the message handler', async () => {
		const first = jest.fn();
		const second = jest.fn();
		let release: (v: unknown) => void = () => {};
		const httpHelper = jest
			.fn()
			.mockImplementationOnce(() => new Promise((r) => (release = r)))
			.mockImplementation(() => new Promise(() => {}));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c', messages: first });
		sub.messages(second);
		release({ t: { t: '1' }, m: [{ d: 'x' }] });
		await flush();

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith('x', undefined);
		sub.unsubscribe();
	});
});

describe('PubNub subscribe client error handling', () => {
	afterEach(() => jest.useRealTimers());

	it('should retry timeouts immediately and back off on other errors', async () => {
		jest.useFakeTimers();
		const received: unknown[] = [];
		const timeout = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
		const socketTimeout = Object.assign(new Error('socket'), { code: 'ESOCKETTIMEDOUT' });
		const httpHelper = jest
			.fn()
			.mockRejectedValueOnce(timeout)
			.mockRejectedValueOnce(socketTimeout)
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValueOnce({ t: { t: '9' }, m: [{ d: 'after-errors' }] })
			.mockImplementation(() => new Promise(() => {}));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c', messages: (m) => received.push(m) });
		await jest.advanceTimersByTimeAsync(0);

		// Both timeouts retried straight away; the generic error is now waiting out its backoff
		expect(httpHelper).toHaveBeenCalledTimes(3);
		await jest.advanceTimersByTimeAsync(999);
		expect(httpHelper).toHaveBeenCalledTimes(3);
		await jest.advanceTimersByTimeAsync(1);

		expect(httpHelper).toHaveBeenCalledTimes(5);
		expect(received).toEqual(['after-errors']);
		// Errors must not advance the timetoken
		expect(httpHelper.mock.calls[3][0].url).toContain('tt=0');
		expect(httpHelper.mock.calls[4][0].url).toContain('tt=9');
		sub.unsubscribe();
	});

	it('should grow the backoff exponentially up to 30s and reset after a success', async () => {
		jest.useFakeTimers();
		const httpHelper = jest.fn();
		for (let i = 0; i < 7; i++) httpHelper.mockRejectedValueOnce(new Error('403'));
		httpHelper
			.mockResolvedValueOnce({ t: { t: '1' } })
			.mockRejectedValueOnce(new Error('403'))
			.mockImplementation(() => new Promise(() => {}));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c' });
		await jest.advanceTimersByTimeAsync(0);
		expect(httpHelper).toHaveBeenCalledTimes(1);

		// 1s, 2s, 4s, 8s, 16s, then capped at 30s
		for (const [delay, calls] of [[1000, 2], [2000, 3], [4000, 4], [8000, 5], [16000, 6], [30000, 7]]) {
			await jest.advanceTimersByTimeAsync(delay - 1);
			expect(httpHelper).toHaveBeenCalledTimes(calls - 1);
			await jest.advanceTimersByTimeAsync(1);
			expect(httpHelper).toHaveBeenCalledTimes(calls);
		}

		// 7th failure is also capped at 30s, then the success polls again immediately
		await jest.advanceTimersByTimeAsync(30000);
		expect(httpHelper).toHaveBeenCalledTimes(9);
		// The failure after a success starts again from 1s
		await jest.advanceTimersByTimeAsync(1000);
		expect(httpHelper).toHaveBeenCalledTimes(10);
		sub.unsubscribe();
	});

	it('should cancel a pending backoff on unsubscribe', async () => {
		jest.useFakeTimers();
		const httpHelper = jest.fn().mockRejectedValue(new Error('403'));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c' });
		await jest.advanceTimersByTimeAsync(0);
		sub.unsubscribe();

		expect(jest.getTimerCount()).toBe(0);
		await jest.advanceTimersByTimeAsync(60000);
		expect(httpHelper).toHaveBeenCalledTimes(1);
	});

	it('should drop a response that arrives after unsubscribe', async () => {
		const handler = jest.fn();
		let release: (v: unknown) => void = () => {};
		const httpHelper = jest.fn().mockImplementationOnce(() => new Promise((r) => (release = r)));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c', messages: handler });
		sub.unsubscribe();
		release({ t: { t: '1' }, m: [{ d: 'late' }] });
		await flush();

		expect(handler).not.toHaveBeenCalled();
		expect(httpHelper).toHaveBeenCalledTimes(1);
	});

	it('should stop retrying when a request fails after unsubscribe', async () => {
		let fail: (e: unknown) => void = () => {};
		const httpHelper = jest.fn().mockImplementationOnce(() => new Promise((_r, reject) => (fail = reject)));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c' });
		sub.unsubscribe();
		fail(new Error('aborted'));
		await flush();
		await flush();

		expect(httpHelper).toHaveBeenCalledTimes(1);
	});

	it('should ignore empty or malformed responses without losing the timetoken', async () => {
		const handler = jest.fn();
		const httpHelper = jest
			.fn()
			.mockResolvedValueOnce({ t: { t: '7' } })
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ t: {}, m: 'not-an-array' })
			.mockImplementation(() => new Promise(() => {}));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c', messages: handler });
		for (let i = 0; i < 4; i++) await flush();

		expect(handler).not.toHaveBeenCalled();
		expect(httpHelper.mock.calls[3][0].url).toContain('tt=7');
		expect(httpHelper.mock.calls[3][0].url).not.toContain('tr=');
		sub.unsubscribe();
	});

	it('should fall back to defaults and encode the channel', async () => {
		const httpHelper = jest.fn().mockImplementation(() => new Promise(() => {}));
		const sub = PubNubClient({ httpHelper }).subscribe();

		expect(httpHelper.mock.calls[0][0]).toMatchObject({
			url: 'https://ps.pndsn.com/v2/subscribe/demo/pubnub/0?uuid=user-default&tt=0&auth=user-default',
			method: 'GET',
			json: true,
		});
		sub.unsubscribe();

		const sub2 = PubNubClient({ httpHelper, origin: 'example.com' }).subscribe({ channel: 'a/b c' });
		expect(httpHelper.mock.calls[1][0].url).toMatch(/^https:\/\/example\.com\/v2\/subscribe\/demo\/a%2Fb%20c\/0\?/);
		sub2.unsubscribe();
	});
});

describe('PubNub subscribe client delivery', () => {
	it('should pass publish metadata from the envelope to the handler', async () => {
		const handler = jest.fn();
		const httpHelper = jest
			.fn()
			.mockResolvedValueOnce({ t: { t: '1' }, m: [{ d: 'a', u: { k: 'v' } }, { d: 'b' }] })
			.mockImplementation(() => new Promise(() => {}));

		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c', messages: handler });
		await flush();

		expect(handler.mock.calls).toEqual([
			['a', { k: 'v' }],
			['b', undefined],
		]);
		sub.unsubscribe();
	});

	it('should be async-iterable', async () => {
		const httpHelper = jest
			.fn()
			.mockResolvedValueOnce({ t: { t: '1' }, m: [{ d: 'first' }] })
			.mockImplementation(() => new Promise(() => {}));
		const sub = PubNubClient({ httpHelper }).subscribe({ channel: 'c' });

		for await (const message of sub) {
			expect(message).toBe('first');
			break;
		}
		sub.unsubscribe();
	});
});

describe('PubNub trigger client publish', () => {
	it('should POST the message with encoded params and meta', async () => {
		const httpHelper = jest.fn().mockResolvedValue([1, 'Sent', '123']);
		const client = PubNubClient({ publishKey: 'pub', subscribeKey: 'sub', userId: 'u 1', authKey: 'a&b', httpHelper });

		const result = await client.publish({ channel: 'ch/1', message: { hi: 1 }, metadata: { k: 'v' } });

		expect(result).toEqual([1, 'Sent', '123']);
		expect(httpHelper).toHaveBeenCalledWith({
			url: `https://ps.pndsn.com/publish/pub/sub/0/ch%2F1/0?uuid=u%201&auth=a%26b&meta=${encodeURIComponent('{"k":"v"}')}`,
			method: 'POST',
			body: { hi: 1 },
			json: true,
		});
	});

	it('should use defaults and omit empty meta', async () => {
		const httpHelper = jest.fn().mockResolvedValue('ok');
		await PubNubClient({ httpHelper }).publish();

		expect(httpHelper.mock.calls[0][0]).toMatchObject({
			url: 'https://ps.pndsn.com/publish/demo/demo/0/pubnub/0?uuid=user-default&auth=user-default',
			body: 'missing-message',
		});
	});

	it('should return false when the request fails', async () => {
		const httpHelper = jest.fn().mockRejectedValue(new Error('403'));
		await expect(PubNubClient({ httpHelper }).publish({ message: 'x' })).resolves.toBe(false);
	});

	it('should throw without an http helper', async () => {
		await expect(PubNubClient({}).publish({ message: 'x' })).rejects.toThrow('HTTP helper is required');
	});
});

describe('PubNub trigger client signal', () => {
	it('should GET with the payload truncated to 30 chars and encoded', async () => {
		const httpHelper = jest.fn().mockResolvedValue([1, 'Sent', '1']);
		const long = 'a b/'.repeat(10); // 40 chars
		const result = await PubNubClient({ publishKey: 'p', subscribeKey: 's', httpHelper }).signal({
			channel: 'c',
			message: long,
		});

		expect(result).toEqual([1, 'Sent', '1']);
		expect(httpHelper).toHaveBeenCalledWith({
			url: `https://ps.pndsn.com/signal/p/s/0/c/0/${encodeURIComponent(long.substring(0, 30))}?uuid=user-default&auth=user-default`,
			method: 'GET',
			json: true,
		});
	});

	it('should return false when the request fails', async () => {
		const httpHelper = jest.fn().mockRejectedValue(new Error('nope'));
		await expect(PubNubClient({ httpHelper }).signal({ message: 'x' })).resolves.toBe(false);
	});

	it('should throw without an http helper', async () => {
		await expect(PubNubClient({}).signal({ message: 'x' })).rejects.toThrow('HTTP helper is required');
	});
});
