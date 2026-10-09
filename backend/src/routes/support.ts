// src/routes/support.ts — customer support, end to end.
// Shop (anyone, signed in or not):
//   POST /rest/support                       { name, email, phone?, category, subject, message, order_id? }
// Signed-in customers:
//   GET  /rest/support                       their requests
//   GET  /rest/support/:number               one request with its messages
//   POST /rest/support/:number/messages      { body } — a reply (reopens it)
// Back office (support.tickets.view / support.tickets.reply):
//   GET  /admin/support                      ?status=&category=&search=&page=&limit= → { tickets, total, counts }
//   GET  /admin/support/:id                  the request, messages, customer and order
//   POST /admin/support/:id/messages         { body, status? } — reply (emails the customer)
//   PUT  /admin/support/:id                  { status }
// New requests email the customer an acknowledgement and the shop an alert;
// staff replies email the customer.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { query, transaction } from '../db';
import { audit } from '../lib/audit';
import { fail, handler, ok, parse } from '../lib/http';
import { sendSupportAlertEmail, sendSupportReceivedEmail, sendSupportReplyEmail } from '../lib/mailer';
import { insertNumbered, ticketNumber } from '../lib/numbers';
import { getStore } from '../lib/store';
import { authenticate, customersOnly, optionalAuth, requirePermission } from '../middleware/auth';

export const SUPPORT_CATEGORIES: Record<string, string> = {
  order: 'An order or delivery',
  returns: 'Returns and refunds',
  payment: 'Payment or invoice',
  product: 'A product question',
  account: 'My account or sign-in',
  other: 'Something else',
};
export const SUPPORT_STATUSES: Record<string, string> = {
  open: 'Open',
  waiting: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const base = () => config.frontendUrl.replace(/\/$/, '');
const customerLink = (number: string, signedIn: boolean) =>
  signedIn ? `${base()}/account/support/${number}` : `${base()}/support`;
const staffLink = (id: number) => `${base()}/admin/support/${id}`;

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max);

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: 0, error: ['Too many requests. Please wait a few minutes and try again.'], data: {} }),
  skip: () => process.env.NODE_ENV === 'test',
});

const SELECT = `
  SELECT t.*, o.number AS order_number,
    (SELECT count(*)::int FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
  FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id`;

const toContract = (t: any, { admin = false } = {}) => ({
  ticket_id: admin ? t.id : undefined,
  number: t.number,
  subject: t.subject,
  category: t.category,
  category_name: SUPPORT_CATEGORIES[t.category] || t.category,
  status: t.status,
  status_name: SUPPORT_STATUSES[t.status] || t.status,
  name: t.name,
  email: t.email,
  phone: admin ? t.phone : undefined,
  order: t.order_id ? { order_id: t.order_id, order_number: t.order_number } : null,
  customer_id: admin ? t.user_id : undefined,
  last_from: t.last_from,
  message_count: t.message_count ?? undefined,
  created_at: t.created_at,
  last_message_at: t.last_message_at,
});

const messagesOf = async (ticketId: number) =>
  (
    await query(
      `SELECT m.*, NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), '') AS user_name
       FROM support_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`,
      [ticketId]
    )
  ).rows;

const toMessage = (m: any, store: string, { admin = false } = {}) => ({
  author: m.author,
  // Customers see "<shop> support"; staff see who replied.
  name: m.author === 'staff' ? (admin ? m.user_name || 'Staff' : `${store} support`) : m.user_name || null,
  body: m.body,
  created_at: m.created_at,
});

export const supportRoutes = () => {
  const router = Router();

  router.get('/support/categories', (_req, res) => ok(res, SUPPORT_CATEGORIES));

  router.post('/support', formLimiter, optionalAuth, handler(async (req, res) => {
    const b = parse(
      z.object({
        name: text(120, 'Please tell us your name.'),
        email: z.string().trim().toLowerCase().email('Please enter a valid email address.'),
        phone: z.string().trim().max(40).default(''),
        category: z.enum(Object.keys(SUPPORT_CATEGORIES) as [string, ...string[]], {
          errorMap: () => ({ message: 'Please choose what your request is about.' }),
        }),
        subject: text(160, 'Please add a subject.'),
        message: z.string().trim().min(10, 'Please tell us a little more (at least 10 characters).').max(5000),
        order_id: z.coerce.number().int().positive().optional(),
      }),
      req.body
    );
    const userId = req.auth?.userId ?? null;
    // An order can only be linked to its own customer's request.
    let orderId: number | null = null;
    if (b.order_id) {
      if (!userId) fail(400, 'Sign in to link a request to an order.');
      const own = (await query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [b.order_id, userId])).rows[0];
      if (!own) fail(400, 'That order isn’t in your account.');
      orderId = own.id;
    }
    const ticket = await transaction(async (db) => {
      const [t] = await insertNumbered(() => ticketNumber(), async (number) => (await db.query(
        `INSERT INTO support_tickets (number, user_id, name, email, phone, category, subject, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (number) DO NOTHING RETURNING *`,
        [number, userId, b.name, b.email, b.phone, b.category, b.subject, orderId]
      )).rows);
      await db.query(
        `INSERT INTO support_messages (ticket_id, author, user_id, body) VALUES ($1, 'customer', $2, $3)`,
        [t.id, userId, b.message]
      );
      return t;
    });
    audit(req, 'support.ticket_created', `support:${ticket.id}`, { category: b.category }, userId ?? undefined);
    const store = await getStore();
    sendSupportReceivedEmail(b.email, b.name, ticket.number, b.subject, customerLink(ticket.number, Boolean(userId)))
      .catch((e) => console.error('Support email failed:', e));
    if (store.email) {
      sendSupportAlertEmail(store.email, ticket.number, b.subject, `${b.name} <${b.email}>`, b.message, staffLink(ticket.id))
        .catch((e) => console.error('Support alert failed:', e));
    }
    ok(res, { number: ticket.number, status: ticket.status, signed_in: Boolean(userId) }, 201);
  }));

  router.use('/support', authenticate, customersOnly);

  router.get('/support', handler(async (req, res) => {
    const rows = (await query(`${SELECT} WHERE t.user_id = $1 ORDER BY t.last_message_at DESC`, [req.auth!.userId])).rows;
    ok(res, rows.map((t) => toContract(t)));
  }));

  const own = async (number: string, userId: number) => {
    const t = (await query(`${SELECT} WHERE t.number = $1 AND t.user_id = $2`, [number.toUpperCase(), userId])).rows[0];
    if (!t) fail(404, 'Request not found.');
    return t;
  };

  router.get('/support/:number', handler(async (req, res) => {
    const t = await own(req.params.number, req.auth!.userId);
    const store = (await getStore()).name;
    ok(res, { ...toContract(t), messages: (await messagesOf(t.id)).map((m) => toMessage(m, store)) });
  }));

  router.post('/support/:number/messages', handler(async (req, res) => {
    const { body } = parse(z.object({ body: z.string().trim().min(2, 'Please write your reply.').max(5000) }), req.body);
    const t = await own(req.params.number, req.auth!.userId);
    if (t.status === 'closed') fail(400, 'This request is closed. Please send a new request.');
    await transaction(async (db) => {
      await db.query(`INSERT INTO support_messages (ticket_id, author, user_id, body) VALUES ($1, 'customer', $2, $3)`,
        [t.id, req.auth!.userId, body]);
      await db.query(
        `UPDATE support_tickets SET status = 'open', last_from = 'customer', last_message_at = now(), updated_at = now() WHERE id = $1`,
        [t.id]
      );
    });
    const fresh = await own(req.params.number, req.auth!.userId);
    const store = (await getStore()).name;
    ok(res, { ...toContract(fresh), messages: (await messagesOf(t.id)).map((m) => toMessage(m, store)) });
  }));

  return router;
};

export const adminSupportRoutes = () => {
  const router = Router();
  router.use('/support', authenticate);

  router.get('/support', requirePermission('support.tickets.view'), handler(async (req, res) => {
    const q = parse(
      z.object({
        status: z.string().optional(),
        category: z.string().optional(),
        search: z.string().trim().max(100).optional(),
        customer: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query
    );
    const params: unknown[] = [];
    const where: string[] = [];
    if (q.category) {
      params.push(q.category);
      where.push(`t.category = $${params.length}`);
    }
    if (q.customer) {
      params.push(q.customer);
      where.push(`t.user_id = $${params.length}`);
    }
    if (q.search) {
      params.push(`%${q.search}%`);
      where.push(`(t.number ILIKE $${params.length} OR t.subject ILIKE $${params.length} OR t.email ILIKE $${params.length}
        OR t.name ILIKE $${params.length} OR o.number ILIKE $${params.length})`);
    }
    const from = 'FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id';
    // Tab counts ignore the status filter itself.
    const counts = Object.fromEntries((await query(
      `SELECT t.status, count(*)::int AS n ${from} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY t.status`,
      params
    )).rows.map((r) => [r.status, r.n]));
    if (q.status) {
      params.push(q.status.split(','));
      where.push(`t.status = ANY($${params.length}::text[])`);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (await query(`SELECT count(*)::int AS n ${from} ${w}`, params)).rows[0].n;
    params.push(q.limit, (q.page - 1) * q.limit);
    const rows = (await query(
      `${SELECT} ${w} ORDER BY (t.status = 'open') DESC, t.last_message_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )).rows;
    ok(res, { tickets: rows.map((t) => toContract(t, { admin: true })), total, counts });
  }));

  const load = async (id: number) => {
    const t = (await query(`${SELECT} WHERE t.id = $1`, [id])).rows[0];
    if (!t) fail(404, 'Request not found.');
    return t;
  };
  const full = async (id: number) => {
    const t = await load(id);
    const store = (await getStore()).name;
    return { ...toContract(t, { admin: true }), messages: (await messagesOf(id)).map((m) => toMessage(m, store, { admin: true })) };
  };

  router.get('/support/:id', requirePermission('support.tickets.view'), handler(async (req, res) => {
    ok(res, await full(Number(req.params.id)));
  }));

  router.post('/support/:id/messages', requirePermission('support.tickets.reply'), handler(async (req, res) => {
    const b = parse(
      z.object({
        body: z.string().trim().min(2, 'Please write your reply.').max(5000),
        status: z.enum(['waiting', 'resolved', 'closed']).default('waiting'),
      }),
      req.body
    );
    const t = await load(Number(req.params.id));
    await transaction(async (db) => {
      await db.query(`INSERT INTO support_messages (ticket_id, author, user_id, body) VALUES ($1, 'staff', $2, $3)`,
        [t.id, req.auth!.userId, b.body]);
      await db.query(
        `UPDATE support_tickets SET status = $2, last_from = 'staff', last_message_at = now(), updated_at = now() WHERE id = $1`,
        [t.id, b.status]
      );
    });
    audit(req, 'support.replied', `support:${t.id}`, { status: b.status });
    sendSupportReplyEmail(t.email, t.name, t.number, t.subject, b.body, customerLink(t.number, Boolean(t.user_id)))
      .catch((e) => console.error('Support reply email failed:', e));
    ok(res, await full(t.id));
  }));

  router.put('/support/:id', requirePermission('support.tickets.reply'), handler(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['open', 'waiting', 'resolved', 'closed']) }), req.body);
    const t = await load(Number(req.params.id));
    await query('UPDATE support_tickets SET status = $2, updated_at = now() WHERE id = $1', [t.id, status]);
    audit(req, 'support.status_changed', `support:${t.id}`, { from: t.status, to: status });
    ok(res, await full(t.id));
  }));

  return router;
};
