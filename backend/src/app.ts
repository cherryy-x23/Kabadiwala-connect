import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import apiRouter from './routes';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();

app.set('trust proxy', 1);

const productionVercelOrigin = 'https://kabadiwala-connect-taupe.vercel.app';
const clientUrlOrigins = (env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    productionVercelOrigin,
    ...clientUrlOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
);

// Security & Parsing Middleware
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow non-browser requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }
      const normalizedOrigin = requestOrigin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic Request Logger in development
if (env.NODE_ENV !== 'test') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// API Routes Mounted under /api/v1
app.use('/api/v1', apiRouter);

// Root informational endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Kabadiwala Connect API',
    version: '1.0.0',
    status: 'online',
    documentation: '/api/v1/health',
  });
});

// 404 Not Found Catch-all
app.use(notFound);

// Centralized Error Handler
app.use(errorHandler);

export default app;
