import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  chat,
  getConversations,
  getConversation,
  deleteConversation,
} from '../controllers/aiController';

const router = Router();

// All AI endpoints require authentication
router.use(requireAuth);

// POST /api/v1/ai/chat
router.post('/chat', chat);

// GET /api/v1/ai/conversations
router.get('/conversations', getConversations);

// GET /api/v1/ai/conversations/:sessionId
router.get('/conversations/:sessionId', getConversation);

// DELETE /api/v1/ai/conversations/:sessionId
router.delete('/conversations/:sessionId', deleteConversation);

export default router;
