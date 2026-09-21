import { Router } from 'express';
import {
  register,
  login,
  getMe,
  logout,
  testCollectorAccess,
  testAdminAccess,
} from '../controllers/authController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Public Authentication Routes
router.post('/register', register);
router.post('/login', login);

// Authenticated Routes
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

// Temporary RBAC verification endpoints (Development/Test only)
router.get('/test/collector', requireAuth, requireRole('collector'), testCollectorAccess);
router.get('/test/admin', requireAuth, requireRole('admin'), testAdminAccess);

export default router;
