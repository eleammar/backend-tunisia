import express from 'express';
import dotenv from 'dotenv';
import cultureRoutes from './routes/cultureRoutes';

dotenv.config();

const app = express();

app.use(express.json());
app.use('/api/culture-items', cultureRoutes);

// Basic health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error fallback
app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});
export default app;