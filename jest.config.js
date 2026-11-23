/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/nodes', '<rootDir>/credentials'],
	testMatch: ['**/test/**/*.test.ts'],
	collectCoverageFrom: ['nodes/**/*.ts', 'credentials/**/*.ts', '!**/test/**'],
	coverageDirectory: 'coverage',
};
