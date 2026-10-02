// src/config.ts — all settings come from the environment (see backend/.env.example)
const env = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(env('PORT', '4000')),
  databaseUrl: env('DATABASE_URL', 'postgres://shop:shop@localhost:5433/carlos_shop'),
  // Signing key for access tokens. Must be a long random value outside dev.
  jwtSecret: env('JWT_SECRET', isProduction ? undefined : 'dev-only-insecure-secret-change-me'),
  accessTokenMinutes: Number(env('ACCESS_TOKEN_MINUTES', '15')),
  sessionDays: Number(env('SESSION_DAYS', '7')),
  rememberMeDays: Number(env('REMEMBER_ME_DAYS', '30')),
  cookieSecure: env('COOKIE_SECURE', isProduction ? 'true' : 'false') === 'true',
  // Browser origins allowed to call the API with cookies.
  corsOrigins: env('CORS_ORIGINS', 'http://localhost:3000,http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  frontendUrl: env('FRONTEND_URL', 'http://localhost:3000'),
  publicUploadsPath: '/uploads',
  uploadsDir: env('UPLOADS_DIR', 'uploads'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  smtp: {
    host: env('SMTP_HOST', '127.0.0.1'),
    port: Number(env('SMTP_PORT', '1025')),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: env('SMTP_SECURE', 'false') === 'true',
    from: env('MAIL_FROM', 'Carlos Shop <no-reply@carlos-shop.local>'),
  },
  lockout: {
    maxAttempts: Number(env('LOCKOUT_MAX_ATTEMPTS', '5')),
    minutes: Number(env('LOCKOUT_MINUTES', '15')),
  },
  resetTokenMinutes: Number(env('RESET_TOKEN_MINUTES', '30')),
  setupTokenHours: Number(env('SETUP_TOKEN_HOURS', '72')),
  shop: {
    currency: env('CURRENCY', 'USD'),
    taxRate: Number(env('TAX_RATE', '0.08')),
    freeShippingOver: Number(env('FREE_SHIPPING_OVER', '150')),
    standardShipping: Number(env('STANDARD_SHIPPING', '10')),
    expressShipping: Number(env('EXPRESS_SHIPPING', '25')),
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  },
  seed: {
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    sampleCatalog: env('SEED_SAMPLE_CATALOG', 'true') === 'true',
  },
  isProduction,
};
