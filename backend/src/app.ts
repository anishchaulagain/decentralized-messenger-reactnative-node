import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorHandler, notFound } from './middleware/error';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversations.routes';
import requestRoutes from './routes/requests.routes';
import userRoutes from './routes/users.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dipanix-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/conversations', conversationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
