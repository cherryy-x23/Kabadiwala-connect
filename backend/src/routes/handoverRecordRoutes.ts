import { Router } from 'express';
import {
  getMyCollectorHandoverRecords,
  getIncomingRecyclerHandoverRecords,
  getHandoverRecordById,
} from '../controllers/handoverRecordController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All handover record endpoints require authentication
router.use(requireAuth);

// Collector-specific
router.get('/my', requireRole('collector'), getMyCollectorHandoverRecords);

// Recycler-specific
router.get('/incoming', requireRole('recycler'), getIncomingRecyclerHandoverRecords);

// Parameterized (viewable by involved collector or recycler)
router.get('/:id', getHandoverRecordById);

export default router;
