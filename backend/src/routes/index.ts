import { Router } from 'express';
import { getHealth } from '../controllers/healthController';
import authRoutes from './authRoutes';
import materialRoutes from './materialRoutes';
import recyclerRoutes from './recyclerRoutes';
import wasteRoutes from './wasteRoutes';
import handoverRequestRoutes from './handoverRequestRoutes';
import handoverRecordRoutes from './handoverRecordRoutes';
import transactionRoutes from './transactionRoutes';
import notificationRoutes from './notificationRoutes';
import aiRoutes from './aiRoutes';

const router = Router();

// Health check endpoint -> /api/v1/health
router.get('/health', getHealth);

// Authentication endpoints -> /api/v1/auth/*
router.use('/auth', authRoutes);

// Material catalog endpoints -> /api/v1/materials/*
router.use('/materials', materialRoutes);

// Recycler catalog endpoints -> /api/v1/recyclers/*
router.use('/recyclers', recyclerRoutes);

// Collector waste ingestion endpoints -> /api/v1/waste/*
router.use('/waste', wasteRoutes);

// Collector <-> Recycler Handover Request endpoints -> /api/v1/requests/*
router.use('/requests', handoverRequestRoutes);

// Digital Handover Record endpoints -> /api/v1/handover-records/*
router.use('/handover-records', handoverRecordRoutes);

// Transaction endpoints -> /api/v1/transactions/*
router.use('/transactions', transactionRoutes);

// In-app Notification endpoints -> /api/v1/notifications/*
router.use('/notifications', notificationRoutes);

// KabiAI assistant endpoints -> /api/v1/ai/*
router.use('/ai', aiRoutes);

export default router;


