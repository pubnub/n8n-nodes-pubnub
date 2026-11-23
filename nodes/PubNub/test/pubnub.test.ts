import PubNubClient from '../pubnub';

describe('PubNub REST client', () => {
	const httpHelper = jest.fn();

	beforeEach(() => {
		httpHelper.mockReset();
		httpHelper.mockResolvedValue([1, 'Sent', '17000000000000000']);
	});

	describe('publish', () => {
		it('should POST the message to the publish endpoint', async () => {
			const client = PubNubClient({
				publishKey: 'pub',
				subscribeKey: 'sub',
				userId: 'me',
				authKey: 'tok',
				httpHelper,
			});

			const result = await client.publish({ channel: 'room', message: { hi: 1 } });

			expect(result).toEqual([1, 'Sent', '17000000000000000']);
			expect(httpHelper).toHaveBeenCalledWith({
				url: 'https://ps.pndsn.com/publish/pub/sub/0/room/0?uuid=me&auth=tok',
				method: 'POST',
				body: { hi: 1 },
				json: true,
			});
		});

		it('should URL-encode the channel, uuid and auth values', async () => {
			const client = PubNubClient({ userId: 'a b&c', authKey: 'x/y', httpHelper });

			await client.publish({ channel: 'my room/1', message: 'm' });

			const { url } = httpHelper.mock.calls[0][0];
			expect(url).toContain('/0/my%20room%2F1/0?');
			expect(url).toContain('uuid=a%20b%26c');
			expect(url).toContain('auth=x%2Fy');
		});

		it('should add encoded meta only when metadata is not empty', async () => {
			const client = PubNubClient({ httpHelper });

			await client.publish({ message: 'm', metadata: {} });
			expect(httpHelper.mock.calls[0][0].url).not.toContain('meta=');

			await client.publish({ message: 'm', metadata: { a: 'b&c' } });
			expect(httpHelper.mock.calls[1][0].url).toContain(
				`meta=${encodeURIComponent(JSON.stringify({ a: 'b&c' }))}`,
			);
		});

		it('should fall back to default keys, channel and origin', async () => {
			const client = PubNubClient({ httpHelper });

			await client.publish({ message: 'm' });

			expect(httpHelper.mock.calls[0][0].url).toMatch(
				/^https:\/\/ps\.pndsn\.com\/publish\/demo\/demo\/0\/pubnub\/0\?/,
			);
		});

		it('should return false when the request fails', async () => {
			httpHelper.mockRejectedValue(new Error('network'));
			const client = PubNubClient({ httpHelper });

			await expect(client.publish({ message: 'm' })).resolves.toBe(false);
		});

		it('should throw when no http helper is configured', async () => {
			const client = PubNubClient({});

			await expect(client.publish({ message: 'm' })).rejects.toThrow('HTTP helper is required');
		});
	});

	describe('signal', () => {
		it('should GET the signal endpoint with the message in the path', async () => {
			const client = PubNubClient({
				publishKey: 'pub',
				subscribeKey: 'sub',
				userId: 'me',
				authKey: 'tok',
				httpHelper,
			});

			await client.signal({ channel: 'room', message: 'hello world' });

			expect(httpHelper).toHaveBeenCalledWith({
				url: 'https://ps.pndsn.com/signal/pub/sub/0/room/0/hello%20world?uuid=me&auth=tok',
				method: 'GET',
				json: true,
			});
		});

		it('should truncate signal payloads to 30 characters', async () => {
			const client = PubNubClient({ httpHelper });

			await client.signal({ channel: 'room', message: 'x'.repeat(50) });

			expect(httpHelper.mock.calls[0][0].url).toContain(`/0/room/0/${'x'.repeat(30)}?`);
		});

		it('should return false when the request fails', async () => {
			httpHelper.mockRejectedValue(new Error('network'));
			const client = PubNubClient({ httpHelper });

			await expect(client.signal({ message: 'm' })).resolves.toBe(false);
		});

		it('should throw when no http helper is configured', async () => {
			const client = PubNubClient({});

			await expect(client.signal({ message: 'm' })).rejects.toThrow('HTTP helper is required');
		});
	});
});
