import { Router } from 'express';
import {
  getMyCollectorTransactions,
  getIncomingRecyclerTransactions,
  getTransactionById,
} from '../controllers/transactionController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All transaction endpoints require authentication
router.use(requireAuth);

// Collector-specific
router.get('/my', requireRole('collector'), getMyCollectorTransactions);

// Recycler-specific
router.get('/incoming', requireRole('recycler'), getIncomingRecyclerTransactions);

// Parameterized (viewable by involved collector or recycler)
router.get('/:id', getTransactionById);

export default router;
