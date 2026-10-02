// e2e/globalSetup.js — fail fast with a clear message if Docker isn't up.
const { Client } = require('pg');
const { E2E_DATABASE_URL, MAILPIT_URL } = require('./backend');

module.exports = async () => {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Can't reach the e2e database (${error.message}). Start Docker services first: docker compose up -d db mailpit`
    );
  } finally {
    await client.end().catch(() => {});
  }
  const res = await fetch(`${MAILPIT_URL}/api/v1/info`).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(
      'Mailpit is not running. Start it with: docker compose up -d mailpit'
    );
  }
};
