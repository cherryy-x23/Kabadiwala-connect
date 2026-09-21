import { Router } from 'express';
import {
  getAllRecyclers,
  getRecyclerById,
  getMyRecyclerProfile,
  updateMyRecyclerProfile,
  updateMyLocation,
  clearMyLocation,
  getNearbyRecyclers,
} from '../controllers/recyclerController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Public recycler catalog routes
router.get('/', getAllRecyclers);

// Recycler private profile routes (must precede /:id)
router.get('/me', requireAuth, requireRole('recycler'), getMyRecyclerProfile);
router.patch('/me', requireAuth, requireRole('recycler'), updateMyRecyclerProfile);

// Recycler private location routes (must precede /:id)
router.patch('/me/location', requireAuth, requireRole('recycler'), updateMyLocation);
router.delete('/me/location', requireAuth, requireRole('recycler'), clearMyLocation);

// Authenticated nearby recycler discovery (must precede /:id)
router.get('/nearby', requireAuth, getNearbyRecyclers);

// Public single recycler details
router.get('/:id', getRecyclerById);

export default router;
