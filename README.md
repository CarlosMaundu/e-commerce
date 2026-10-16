# Carlos Shop

An online shop with a full back office: a React storefront and customer
account, and an Express + PostgreSQL API with staff roles, orders, invoices,
payments (card, M-Pesa, cash on delivery), returns and refunds, promo codes,
support requests and reports.

## Contents

- [What's in it](#whats-in-it)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Configuration](#configuration)
- [Payments](#payments)
- [Testing locally with M-Pesa (public callback)](#testing-locally-with-m-pesa-public-callback)
- [Backups](#backups)
- [Operations](#operations)
- [Tests](#tests)
- [Project layout](#project-layout)
- [Working on the code](#working-on-the-code)

## What's in it

**Storefront and account**

- Home page with hero, deal strip and photo banner, brands, curated picks and
  featured products; product list with filters and instant, typo-tolerant
  search; product pages with variants, reviews and "frequently bought
  together".
- Cart with gift wrapping, promo codes, checkout (card or cash on delivery),
  order tracking, invoices, returns and refunds.
- Account: orders, returns, refunds, invoices, addresses, wishlist, support
  requests, profile and sign-in security (sessions, activity).
- Support page, FAQ, About us, Terms, Privacy and Refund & Return policy.

**Back office** (`/admin`, by role and permission)

- Workspace: overview dashboard, orders (with SLA tracking), returns,
  support inbox.
- Catalog: products and variants, categories, brands, promo codes (rules,
  limits, usage by customer, order and invoice).
- Money: invoices, payments, refunds (with an approval queue), ledger.
- Reports: SLA performance.
- People: customers and staff, roles and permissions.
- System: store settings (including home page deals), site pages, FAQ,
  payment methods, delivery options, refund and financial settings,
  security, audit log.

## Tech stack

| Part | Built with |
| --- | --- |
| Web | React 18 (Create React App), MUI 5, Redux Toolkit, React Router 6 |
| API | Node, Express, TypeScript, zod, PostgreSQL (`pg`) |
| Payments | Stripe (cards, payment links), Safaricom Daraja (M-Pesa STK push) |
| Email | Nodemailer; Mailpit catches all mail locally |
| Tests | Jest (API and web), Playwright (end to end) |
| Run | Docker Compose: Postgres, Mailpit, API, web (nginx) |

## Run it locally

You need Docker Desktop and Node 20 or later.

```bash
git clone https://github.com/CarlosMaundu/e-commerce.git
cd e-commerce
cp backend/.env.example backend/.env   # then set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run stack                          # docker compose up -d --build
```

| Address | What |
| --- | --- |
| http://localhost:8080 | The shop (and `/admin` for the back office) |
| http://localhost:4000/api/health | The API |
| http://localhost:8025 | Mailpit: every email the shop sends |
| `localhost:5433` | Postgres (`shop` / `shop`, database `carlos_shop`) |

On first start the API runs its migrations, creates the first super admin
from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (at least 12 characters), and loads a
sample catalogue, promo codes and FAQ. Stop everything with
`npm run stack:down`.

**Developing the web app with hot reload:** keep the stack running and run
`npm start`; the dev server on http://localhost:3000 sends `/api` to the API
on port 4000.

**Developing the API:** `cd backend && npm install && npm run dev` (stop the
`api` container first, or change `PORT`).

## Configuration

- **API:** `backend/.env` (see `backend/.env.example`). The important ones:
  - `JWT_SECRET`: long random value (`openssl rand -base64 48`).
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD`: the first super admin.
  - `PAYMENTS_SECRET_KEY`: encrypts saved payment credentials (defaults to
    `JWT_SECRET`).
  - `SMTP_*`, `MAIL_FROM`: real email in production (Mailpit locally).
  - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`: optional; card keys can
    also be set in the back office.
  - `CURRENCY`, `TAX_*`, shipping prices: first-run defaults for Financial
    and Delivery settings.
- **Web:** `.env` (see `.env.example`): `REACT_APP_GOOGLE_CLIENT_ID` for
  Google sign-in; `REACT_APP_API_BASE_URL` only if the API isn't on `/api`.

Most shop settings (name, logo, contact details, home page, deals, taxes,
delivery, refunds, security, payment methods) are edited in the back office,
not in files.

## Payments

Set up in **Back office → System → Payment methods**. Each method has a
**Configure** dialog with its fields, **Save**, and **Test connection**.
Secrets are stored encrypted and only ever shown as `••••1234`.

- **Card (Stripe):** publishable and secret key. Test with card
  `4242 4242 4242 4242`, any future date and any CVC
  (`4000 0000 0000 0002` is declined, `4000 0000 0000 3220` asks for 3-D
  Secure).
- **M-Pesa (Daraja):** account type (Paybill or Till), shortcode, consumer
  key and secret, passkey, callback URL; sandbox or live. Daraja sandbox:
  shortcode `174379`, test phone `254708374149`.
- **Cash on delivery:** on by default. Staff can also take a **card tap**
  (QR code and link to a Stripe payment page) or send an **M-Pesa prompt**
  from the order page when the order arrives, or record cash.

Payments are recorded on the order's invoice and posted to the ledger.

## Testing locally with M-Pesa (public callback)

Safaricom only sends M-Pesa prompts when the callback is a **public
`https://` address**, and then calls it to confirm the payment. A shop on
`localhost` isn't reachable, so the prompt is refused ("Invalid CallBackURL").
For local testing, open a tunnel that gives the shop a temporary public
address:

1. Install cloudflared once: `brew install cloudflared`.
2. With the stack running, start the tunnel and leave it running:

   ```bash
   npm run tunnel   # cloudflared tunnel --url http://localhost:8080
   ```

   It prints an address like `https://random-words.trycloudflare.com`.
   Anyone with that address can reach your local shop while it runs.
3. In **Payment methods → M-Pesa → Configure**, set **Callback URL** to

   ```
   https://random-words.trycloudflare.com/api/payments/mpesa/callback
   ```

   then Save and **Test connection** (optionally with the sandbox phone
   number, which sends a real KES 1 sandbox prompt).
4. Send prompts from a cash-on-delivery order: **Collect payment → Send
   M-Pesa prompt**.

The quick-tunnel address changes every time cloudflared starts, so update
the Callback URL each time. The order screen also checks the payment status
with Safaricom every few seconds, so payments are recorded even if a
callback is slow. In production, leave Callback URL empty: the shop's own
https address is used.

## Backups

The `backup` service (in `docker-compose.yml`) writes a compressed copy of
the shop database to `./backups` when it starts and every night at 02:00
(Nairobi time), keeping 14 days. Change with `BACKUP_HOUR` and
`BACKUP_KEEP_DAYS`.

```bash
npm run backup                                          # a backup right now
npm run restore -- backups/carlos_shop-2026-10-15-0200.sql.gz   # replaces all data (asks first)
```

Copy `./backups` somewhere off the machine too (cloud drive, another
computer): a backup on the same disk doesn't survive that disk.

## Operations

- **Background jobs** run inside the API every minute: placing card orders
  Stripe shows as paid, settling card links and M-Pesa prompts, sending and
  retrying emails, and (every 6 hours) removing old analytics. Each job takes
  a database lock, so with several API servers only one runs it.
- **Several API servers**: settings saved on one server reload on the others
  (Postgres `NOTIFY`), and rate limits are counted in the database.
- **Logs**: one JSON line per request with a request id (also returned as
  `X-Request-Id` and shown in error messages as a reference). Turn off with
  `LOG_REQUESTS=false`.
- **Error tracking**: set `SENTRY_DSN` (API) and `REACT_APP_SENTRY_DSN` (web,
  at build time) to send unexpected errors to Sentry.
- **Health**: `/api/health` answers 200 only when the database does; point an
  uptime monitor at it.
- **Images**: uploads are resized (1600 px, avatars 512 px), turned upright
  and stripped of metadata such as GPS location. Set `S3_*` in
  `backend/.env` to store them in S3-compatible storage behind a CDN.
- **Retention**: searches and deal events 400 days, product views 3 years,
  the audit log 2 years, sent emails 90 days. Orders, invoices, the ledger
  and stock movements are kept.
- **Installable app**: shoppers can add the shop to their home screen. Its
  name and icons come from Store settings (the logo, else the favicon, else a
  plain bag icon), served at `/api/rest/manifest.webmanifest` and
  `/api/rest/app-icon/<size>.png`. Production builds include a service worker
  that keeps the app and the catalogue usable offline (cart, checkout and
  account always need a connection) and shows "A new version is ready" after a
  deploy. Installing needs HTTPS (or `localhost`), e.g. through the tunnel.

## Tests

```bash
npx eslint src e2e                              # lint (web and e2e)
npm test                                        # web unit tests (Jest)
cd backend && npm test                          # API tests (Jest; uses the carlos_shop_test database)
npm run test:e2e                                # Playwright end to end
```

The API and e2e tests need the Docker database (`npm run stack`). The e2e
suite starts its own API on port 4100 (database `carlos_shop_e2e`) and web
app on port 3100, in US dollars with 8% tax. Files ending in
`mobile.spec.js` run on a phone (Pixel 7); the rest on desktop Chrome. Run API tests one at a time
(`--runInBand`, as `npm test` does).

**On GitHub:** every pull request and push to `main` runs lint, the web unit
tests and the API tests (`.github/workflows/ci.yml`); the end-to-end suite
runs nightly and on demand (`e2e.yml`). Make the **CI** checks required in
the repository's branch protection so a red build can't be merged.

## Project layout

```
backend/               API (Express + TypeScript)
  migrations/          SQL migrations, applied on start
  seed/                sample catalogue and images
  src/routes/          REST routes (/api/rest for the shop, /api/admin for staff)
  src/lib/             business logic (orders, accounting, refunds, payments…)
  tests/               API tests
src/                   web app (React)
  pages/               storefront, account and back-office pages
  components/          shared UI (admin table kit, skeletons, timeline…)
  api/                 API client and mappers (see src/api/contract.md)
e2e/                   Playwright tests
docker/, Dockerfile.frontend, docker-compose.yml
```

## Working on the code

- One branch per feature from an up-to-date `main`, a pull request, then a
  squash merge.
- Every page that loads data shows a skeleton in its own layout (see
  `src/components/skeletons/README.md`); a unit test checks new pages.
- Never commit secrets: `backend/.env` and `.env` are gitignored.

## License

ISC. See `package.json`.
