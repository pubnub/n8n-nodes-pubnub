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
		expect(second).toHaveBeenCalledWith('x');
		sub.unsubscribe();
	});
});
