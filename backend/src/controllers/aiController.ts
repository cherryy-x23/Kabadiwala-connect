import { Request, Response, NextFunction } from 'express';
import {
  chatMessageSchema,
  getConversationsQuerySchema,
} from '../validators/aiValidators';
import {
  processChatMessage,
  getUserConversations,
  getConversationBySessionId,
  deleteConversationBySessionId,
} from '../services/aiService';

export const chat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { message, sessionId } = chatMessageSchema.parse(req.body);

    const result = await processChatMessage({
      userId: req.user.id,
      userRole: req.user.role,
      message,
      sessionId,
    });

    res.status(200).json({
      success: true,
      message: 'AI response generated successfully',
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { page, limit } = getConversationsQuerySchema.parse(req.query);

    const { conversations, total, totalPages } = await getUserConversations(
      req.user.id,
      page,
      limit
    );

    res.status(200).json({
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Session ID is required',
      });
      return;
    }

    const conversation = await getConversationBySessionId(req.user.id, sessionId);

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation session not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: {
        conversation,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Session ID is required',
      });
      return;
    }

    const deleted = await deleteConversationBySessionId(req.user.id, sessionId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Conversation session not found or you do not have permission to delete it',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Conversation session deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};
