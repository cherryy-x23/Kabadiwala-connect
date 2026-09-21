import { Request, Response } from 'express';
import { isDbConnected } from '../config/db';

export const getHealth = (_req: Request, res: Response): void => {
  const dbStatus = isDbConnected() ? 'connected' : 'disconnected';

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    success: dbStatus === 'connected',
    message: 'Kabadiwala Connect API is running',
    database: dbStatus,
  });
};
