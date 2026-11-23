import { PubNubApi } from '../PubNubApi.credentials';

describe('PubNubApi credentials', () => {
	const credential = new PubNubApi();

	it('should have the expected identity', () => {
		expect(credential.name).toBe('pubNubApi');
		expect(credential.displayName).toBe('PubNub API');
	});

	it('should require publish and subscribe keys', () => {
		const required = credential.properties.filter((p) => p.required).map((p) => p.name);
		expect(required).toEqual(['publishKey', 'subscribeKey']);
	});

	it('should mask secret values', () => {
		const masked = credential.properties
			.filter((p) => p.typeOptions?.password)
			.map((p) => p.name);
		expect(masked).toEqual(expect.arrayContaining(['secretKey', 'authKey']));
	});

	it('should test the subscribe key against the presence endpoint', () => {
		expect(credential.test.request.url).toContain('{{$credentials.subscribeKey}}');
		expect(credential.test.request.baseURL).toBe('https://ps.pndsn.com');
	});
});
