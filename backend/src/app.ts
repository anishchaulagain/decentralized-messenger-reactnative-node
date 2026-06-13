import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import { authLimiter, generalLimiter } from './middleware/rate-limit';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversations.routes';
import requestRoutes from './routes/requests.routes';
import userRoutes from './routes/users.routes';

const app = express();

// Trust N proxy hops so rate limiting / req.ip use the real client address.
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet());

const corsOrigins = env.CORS_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(corsOrigins && corsOrigins.length ? { origin: corsOrigins } : {}));

app.use(express.json({ limit: '64kb' }));

app.use('/api', generalLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dipanix-api' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/conversations', conversationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
