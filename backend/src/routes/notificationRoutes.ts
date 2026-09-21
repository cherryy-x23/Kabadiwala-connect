import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAsUnread,
  markAllAsRead,
} from '../controllers/notificationController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

// Base listing & summary endpoints (defined before parameterized routes)
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);

// Parameterized notification endpoints
router.get('/:id', getNotificationById);
router.patch('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);

export default router;
