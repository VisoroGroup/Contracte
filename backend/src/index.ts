import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import db from './db';

// Routes
import authRouter from './routes/auth';
import templatesRouter from './routes/templates';
import contractsRouter from './routes/contracts';
import settingsRouter from './routes/settings';
import usersRouter from './routes/users';
import categoriesRouter from './routes/categories';

const app = express();
const PORT = process.env.PORT || 3001;
const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

// Ensure storage directories exist
['templates', 'contracts', 'previews', 'logos', 'tmp'].forEach((dir) => {
  fs.mkdirSync(path.join(storagePath, dir), { recursive: true });
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for logos
app.use('/storage', express.static(storagePath));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Contract Management Platform API', version: '1.0.0' });
});

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not Found', details: `Route ${req.path} not found.` });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal Server Error', details: err.message });
});

// Run migrations and start server
async function start() {
  try {
    console.log('Running database migrations...');
    await db.migrate.latest({
      directory: path.join(__dirname, 'db/migrations'),
      extension: 'ts',
    });
    console.log('✅ Migrations complete.');

    app.listen(PORT, () => {
      console.log(`🚀 Backend running at http://localhost:${PORT}`);
      console.log(`📁 Storage path: ${storagePath}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
