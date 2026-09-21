import { Router } from 'express';
import {
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../controllers/materialController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Public material routes
router.get('/', getAllMaterials);
router.get('/:id', getMaterialById);

// Admin-only management routes
router.post('/', requireAuth, requireRole('admin'), createMaterial);
router.patch('/:id', requireAuth, requireRole('admin'), updateMaterial);
router.delete('/:id', requireAuth, requireRole('admin'), deleteMaterial);

export default router;
