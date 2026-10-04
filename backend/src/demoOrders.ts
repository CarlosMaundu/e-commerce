// src/demoOrders.ts — optional demo sales history for the back-office Store
// overview: ~40 demo shoppers (demo.buyer…@example.com, no password, so they
// can't sign in) and orders over the last 15 months (so the chart has a
// "last year" to compare with), shipped to
// towns across Kenya, using the real catalog's products and prices.
//
//   node dist/demoOrders.js            add demo orders
//   node dist/demoOrders.js --remove   delete demo shoppers and their orders
//
// Deterministic (seeded random), so runs give the same shape of data.
import { pool, query, transaction } from './db';
import { finance, loadFinance } from './lib/finance';
import { applyTax, round2 } from './lib/pricing';

const DEMO_EMAIL = 'demo.buyer%@example.com';

const FIRST = ['Amina', 'Brian', 'Wanjiru', 'Kevin', 'Achieng', 'Daniel', 'Faith', 'Otieno', 'Grace', 'Samuel',
  'Mercy', 'Joseph', 'Njeri', 'Peter', 'Halima', 'David', 'Akinyi', 'Michael', 'Zawadi', 'Eric'];
const LAST = ['Mwangi', 'Odhiambo', 'Kamau', 'Wekesa', 'Njoroge', 'Chebet', 'Omondi', 'Mutua', 'Hassan', 'Kiptoo'];

// Town, share of orders, street.
const TOWNS: [string, number, string][] = [
  ['Nairobi', 46, 'Moi Avenue'], ['Mombasa', 17, 'Nyerere Avenue'], ['Kisumu', 12, 'Oginga Odinga Street'],
  ['Nakuru', 9, 'Kenyatta Avenue'], ['Eldoret', 6, 'Uganda Road'], ['Thika', 4, 'Commercial Street'],
  ['Nyeri', 3, 'Kimathi Way'], ['Malindi', 3, 'Lamu Road'],
];

/** Small seeded PRNG (mulberry32). */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const removeDemoOrders = async () => {
  await query('DELETE FROM orders WHERE email LIKE $1', [DEMO_EMAIL]);
  const { rowCount } = await query('DELETE FROM users WHERE email LIKE $1', [DEMO_EMAIL]);
  return rowCount || 0;
};

export const seedDemoOrders = async () => {
  await removeDemoOrders();
  const rand = rng(20261004);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const weighted = <T>(list: [T, number][]) => {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [v, w] of list) if ((r -= w) <= 0) return v;
    return list[0][0];
  };

  const products = (
    await query(
      `SELECT p.id, p.name, p.price, p.special, p.images->>0 AS image,
         COALESCE(json_agg(json_build_object('id', v.id, 'options', v.options, 'price', v.price, 'special', v.special,
           'image', v.images->>0)) FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
       FROM products p LEFT JOIN product_variants v ON v.product_id = p.id
       WHERE p.status = 'published' GROUP BY p.id`
    )
  ).rows;
  if (!products.length) throw new Error('Seed the demo catalog first (node dist/demoCatalog.js).');
  // Cheaper items sell more often.
  const productWeights: [any, number][] = products.map((p) => [p, 1 / Math.sqrt(Number(p.special || p.price))]);

  const role = (await query(`SELECT id FROM roles WHERE code = 'customer'`)).rows[0].id;
  const buyers: { id: number; email: string; first: string; last: string; town: [string, number, string] }[] = [];
  for (let i = 1; i <= 40; i += 1) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const email = `demo.buyer${i}@example.com`;
    const town = weighted(TOWNS.map((t) => [t, t[1]] as [typeof t, number]));
    const joinedDaysAgo = Math.floor(rand() * 480);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, firstname, lastname, role_id, created_at)
       VALUES ($1, NULL, $2, $3, $4, now() - make_interval(days => $5)) RETURNING id`,
      [email, first, last, role, joinedDaysAgo]
    );
    buyers.push({ id: rows[0].id, email, first, last, town });
  }

  let count = 0;
  await transaction(async (db) => {
    const DAYS = 456;
    for (let day = DAYS; day >= 0; day -= 1) {
      // Steady growth towards today, with a weekend bump.
      const date = new Date(Date.now() - day * 86400000);
      const weekend = [0, 6].includes(date.getDay());
      const perDay = Math.round((1 + (DAYS - day) / 110 + rand() * 2.5) * (weekend ? 1.4 : 1));
      for (let n = 0; n < perDay; n += 1) {
        const buyer = pick(buyers);
        const [city, , street] = buyer.town;
        const lines = Array.from({ length: 1 + Math.floor(rand() * rand() * 3) }, () => {
          const p = weighted(productWeights);
          const v = p.variants.length ? pick(p.variants as any[]) : null;
          const unit = Number(v?.special || v?.price || p.special || p.price);
          const quantity = rand() < 0.85 ? 1 : 2;
          return { p, v, unit, quantity, total: round2(unit * quantity) };
        });
        const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
        const express = rand() < 0.25;
        const f = finance();
        const shipping = express
          ? f.express_shipping
          : f.free_shipping_over && subtotal >= f.free_shipping_over ? 0 : f.standard_shipping;
        const { tax, total } = applyTax(subtotal, shipping);
        const card = rand() < 0.55;
        const hoursAgo = day * 24 + Math.floor(rand() * (day === 0 ? 10 : 24));
        // Status follows the order's age.
        const r = rand();
        let status: string;
        if (day <= 1) status = r < 0.55 ? 'pending' : 'processing';
        else if (day <= 5) status = r < 0.2 ? 'processing' : r < 0.85 ? 'shipped' : 'delivered';
        else status = r < 0.04 ? 'cancelled' : r < 0.08 ? 'refunded' : r < 0.1 ? 'processing' : 'delivered';
        const paymentStatus =
          status === 'refunded' ? 'refunded'
            : status === 'cancelled' ? (card ? 'refunded' : 'pending')
              : card || status === 'delivered' ? 'paid' : 'pending';
        const address = {
          firstname: buyer.first, lastname: buyer.last, company: '', address_1: `${10 + Math.floor(rand() * 180)} ${street}`,
          address_2: '', city, postcode: '', country: 'KE', zone: '', telephone: '+254700000000',
        };
        const { rows } = await db.query(
          `INSERT INTO orders (user_id, email, status, payment_method, payment_status, shipping_method,
             shipping_address, payment_address, subtotal, discount, shipping_total, tax_total, total, currency,
             placed_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, 0, $9, $10, $11, $12,
             now() - make_interval(hours => $13), now() - make_interval(hours => $13), now())
           RETURNING id`,
          [buyer.id, buyer.email, status, card ? 'stripe' : 'cod', paymentStatus, express ? 'express' : 'standard',
            JSON.stringify(address), subtotal, shipping, tax, total, finance().currency, hoursAgo]
        );
        const orderId = rows[0].id;
        for (const l of lines) {
          await db.query(
            `INSERT INTO order_items (order_id, product_id, variant_id, name, image, options, unit_price, quantity, total)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [orderId, l.p.id, l.v?.id ?? null, l.p.name, l.v?.image || l.p.image || '', JSON.stringify(l.v?.options || {}),
              l.unit, l.quantity, l.total]
          );
        }
        // Shoppers look before they buy: about 25–35 product views per sale.
        for (const l of lines) {
          await db.query(
            `INSERT INTO product_views (product_id, day, views) VALUES ($1, current_date - $2::int, $3)
             ON CONFLICT (product_id, day) DO UPDATE SET views = product_views.views + EXCLUDED.views`,
            [l.p.id, day, 25 + Math.floor(rand() * 11)]
          );
        }
        await db.query(
          `INSERT INTO order_history (order_id, status, comment, created_at)
           VALUES ($1, $2, 'Demo order', now() - make_interval(hours => $3))`,
          [orderId, status, hoursAgo]
        );
        count += 1;
      }
    }
  });
  console.log(`Seeded ${count} demo orders from ${buyers.length} demo shoppers`);
};

if (require.main === module) {
  (process.argv.includes('--remove')
    ? removeDemoOrders().then((n) => console.log(`Removed ${n} demo shoppers and their orders`))
    : loadFinance().then(() => seedDemoOrders())
  )
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
