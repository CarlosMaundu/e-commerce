// Integration tests run against the carlos_shop_test database in the Docker
// Postgres (docker compose up -d db).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  testTimeout: 20000,
};
