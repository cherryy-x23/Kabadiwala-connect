import { Router } from 'express';
import {
  createWaste,
  getMyWaste,
  getWasteById,
  updateWaste,
  deleteWaste,
} from '../controllers/wasteController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All waste routes are restricted to authenticated collectors
router.use(requireAuth, requireRole('collector'));

router.post('/', createWaste);
router.get('/my', getMyWaste);
router.get('/:id', getWasteById);
router.patch('/:id', updateWaste);
router.delete('/:id', deleteWaste);

export default router;
