// src/server.ts — migrate, seed, then serve.
import { createApp } from './app';
import { config } from './config';
import { runMigrations } from './migrate';
import { runSeed } from './seed';
import { fillDemoCosts, restoreDemoImages } from './demoCatalog';
import { query } from './db';
import { loadFinance } from './lib/finance';
import { loadDelivery } from './lib/delivery';
import { loadSla } from './lib/sla';
import { loadProviders } from './lib/paymentProviders';
import { backfillAccounting } from './lib/accounting';
import { fixLegacyData } from './lib/dataFixes';
import { startJobs } from './lib/jobs';
import { listenForChanges } from './lib/changes';
import { stripeGateway } from './lib/payments';
import { darajaGateway } from './lib/mpesa';

const main = async () => {
  await runMigrations();
  await loadFinance(); // seeding prices demo data in the shop's currency
  await loadDelivery();
  await loadSla();
  await loadProviders();
  await runSeed();
  // Demo products get cost prices (once), so reports can show profit.
  const costed = await fillDemoCosts({ query: (q: string, p?: unknown[]) => query(q, p) });
  if (costed) console.log(`Set cost prices on ${costed} demo products`);
  const images = restoreDemoImages();
  if (images) console.log(`Restored ${images} demo images`);
  // Invoices and ledger entries for orders placed before accounting existed.
  const backfilled = await backfillAccounting();
  if (backfilled) console.log(`Posted accounts for ${backfilled} earlier orders`);
  const fixed = await fixLegacyData();
  if (fixed) console.log(`Updated ${fixed} order numbers, invoice numbers and payment references`);
  const payments = stripeGateway();
  const mpesa = darajaGateway();
  startJobs({ payments, mpesa });
  // Settings saved on another API server reload here too.
  await listenForChanges();
  createApp({ payments, mpesa }).listen(config.port, () => {
    console.log(`Carlos Shop API listening on :${config.port}`);
  });
};

main().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
