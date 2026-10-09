// src/server.ts — migrate, seed, then serve.
import { createApp } from './app';
import { config } from './config';
import { runMigrations } from './migrate';
import { runSeed } from './seed';
import { restoreDemoImages } from './demoCatalog';
import { loadFinance } from './lib/finance';
import { loadDelivery } from './lib/delivery';
import { loadSla } from './lib/sla';
import { backfillAccounting } from './lib/accounting';
import { fixLegacyData } from './lib/dataFixes';

const main = async () => {
  await runMigrations();
  await loadFinance(); // seeding prices demo data in the shop's currency
  await loadDelivery();
  await loadSla();
  await runSeed();
  const images = restoreDemoImages();
  if (images) console.log(`Restored ${images} demo images`);
  // Invoices and ledger entries for orders placed before accounting existed.
  const backfilled = await backfillAccounting();
  if (backfilled) console.log(`Posted accounts for ${backfilled} earlier orders`);
  const fixed = await fixLegacyData();
  if (fixed) console.log(`Updated ${fixed} order numbers, invoice numbers and payment references`);
  createApp().listen(config.port, () => {
    console.log(`Carlos Shop API listening on :${config.port}`);
  });
};

main().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
