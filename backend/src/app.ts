// src/app.ts — Express app factory (tests build it with their own options).
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { GoogleVerifier, verifyGoogleIdToken } from './lib/google';
import { PaymentGateway, stripeGateway } from './lib/payments';
import { errorHandler, fail, handler } from './lib/http';
import { accountRoutes } from './routes/account';
import { adminCatalogRoutes } from './routes/adminCatalog';
import { adminOrderRoutes } from './routes/adminOrders';
import { adminFinanceRoutes } from './routes/adminFinance';
import { adminReportRoutes } from './routes/adminReports';
import { adminLegalRoutes, publicLegalRoutes } from './routes/legal';
import { adminSupportRoutes, supportRoutes } from './routes/support';
import { adminFaqRoutes, publicFaqRoutes } from './routes/faq';
import { adminSecurityRoutes } from './routes/adminSecurity';
import { adminRoleRoutes } from './routes/adminRoles';
import { adminUserRoutes } from './routes/adminUsers';
import { authRoutes } from './routes/auth';
import { cartRoutes } from './routes/cart';
import { catalogRoutes } from './routes/catalog';
import { checkoutRoutes } from './routes/checkout';
import { orderRoutes } from './routes/orders';

export interface AppOptions {
  verifyGoogle?: GoogleVerifier | null;
  payments?: PaymentGateway | null;
}

export const createApp = ({
  verifyGoogle = config.googleClientId ? verifyGoogleIdToken : null,
  payments = stripeGateway(),
}: AppOptions = {}) => {
  const app = express();
  app.set('trust proxy', 1); // behind nginx in Docker
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
      exposedHeaders: ['X-Total-Count', 'X-Search-Match'],
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/rest', authRoutes({ verifyGoogle }));
  app.use('/api/rest/account', accountRoutes());
  app.use('/api/rest', catalogRoutes());
  app.use('/api/rest', cartRoutes());
  app.use('/api/rest', checkoutRoutes({ payments }));
  app.use('/api/rest', orderRoutes());
  app.use('/api/admin', adminCatalogRoutes());
  app.use('/api/admin', adminUserRoutes());
  app.use('/api/admin', adminRoleRoutes());
  app.use('/api/admin', adminOrderRoutes({ payments }));
  app.use('/api/admin', adminFinanceRoutes({ payments }));
  app.use('/api/admin', adminReportRoutes());
  app.use('/api/rest', publicLegalRoutes());
  app.use('/api/admin', adminLegalRoutes());
  app.use('/api/rest', supportRoutes());
  app.use('/api/admin', adminSupportRoutes());
  app.use('/api/rest', publicFaqRoutes());
  app.use('/api/admin', adminFaqRoutes());
  app.use('/api/admin', adminSecurityRoutes());

  app.use(
    config.publicUploadsPath,
    express.static(config.uploadsDir, { maxAge: '7d', immutable: true, fallthrough: false })
  );

  app.use(
    '/api',
    handler(async () => {
      fail(404, 'Not found.');
    })
  );
  app.use(errorHandler);
  return app;
};
