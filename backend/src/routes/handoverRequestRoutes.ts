import { Router } from 'express';
import {
  createRequest,
  getMyCollectorRequests,
  getIncomingRecyclerRequests,
  getRequestById,
  acceptRequest,
  rejectRequest,
  scheduleRequest,
  inTransitRequest,
  cancelRequest,
  completeRequest,
} from '../controllers/handoverRequestController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All request routes require authentication
router.use(requireAuth);

// Collector-specific routes (defined before parameterized routes)
router.post('/', requireRole('collector'), createRequest);
router.get('/my', requireRole('collector'), getMyCollectorRequests);

// Recycler-specific routes (defined before parameterized routes)
router.get('/incoming', requireRole('recycler'), getIncomingRecyclerRequests);

// Shared / Parameterized routes
router.get('/:id', getRequestById);
router.post('/:id/cancel', requireRole('collector'), cancelRequest);
router.post('/:id/accept', requireRole('recycler'), acceptRequest);
router.post('/:id/reject', requireRole('recycler'), rejectRequest);
router.post('/:id/schedule', requireRole('recycler'), scheduleRequest);
router.post('/:id/in-transit', inTransitRequest);
router.post('/:id/complete', completeRequest);

export default router;

