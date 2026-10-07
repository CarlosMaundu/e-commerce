import './env';

export default async () => {
  const { runMigrations } = await import('../src/migrate');
  const { pool } = await import('../src/db');
  await runMigrations();
  await pool.end();
};
