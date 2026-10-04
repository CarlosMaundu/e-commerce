// src/server.ts — migrate, seed, then serve.
import { createApp } from './app';
import { config } from './config';
import { runMigrations } from './migrate';
import { runSeed } from './seed';
import { loadFinance } from './lib/finance';

const main = async () => {
  await runMigrations();
  await loadFinance(); // seeding prices demo data in the shop's currency
  await runSeed();
  createApp().listen(config.port, () => {
    console.log(`Carlos Shop API listening on :${config.port}`);
  });
};

main().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
