import mongoose, { Types } from 'mongoose';
import { Notification, NotificationType, INotification } from '../models/Notification';

export interface CreateNotificationParams {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: 'HandoverRequest' | 'Transaction' | 'HandoverRecord' | string;
  relatedEntityId?: string | Types.ObjectId;
  metadata?: Record<string, any>;
  eventKey?: string;
}

/**
 * Strips sensitive authentication and credential keys from metadata objects.
 */
export function sanitizeMetadata(
  metadata?: Record<string, any>
): Record<string, any> | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const sanitized = { ...metadata };
  const sensitiveKeys = ['password', 'passwordhash', 'token', 'secret', 'cookie', 'jwt'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

/**
 * Creates and persists an in-app notification with event-key duplicate protection.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<INotification> {
  const {
    userId,
    type,
    title,
    message,
    relatedEntityType,
    relatedEntityId,
    metadata,
    eventKey,
  } = params;

  if (!userId) {
    throw new Error('Notification recipient userId is required');
  }

  // Pre-check for duplicate eventKey
  if (eventKey) {
    const existing = await Notification.findOne({ eventKey });
    if (existing) {
      return existing;
    }
  }

  const cleanMetadata = sanitizeMetadata(metadata);

  try {
    const notification = await Notification.create({
      userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId:
        relatedEntityId && typeof relatedEntityId === 'string'
          ? new mongoose.Types.ObjectId(relatedEntityId)
          : relatedEntityId,
      metadata: cleanMetadata,
      eventKey,
    });

    return notification;
  } catch (error: any) {
    // Handle duplicate key error gracefully if concurrent calls occurred
    if (error.code === 11000 && eventKey) {
      const existing = await Notification.findOne({ eventKey });
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}

/**
 * Transaction-safe notification dispatcher:
 * Logs any notification failure without breaking caller business workflows.
 */
export async function safeCreateNotification(
  params: CreateNotificationParams
): Promise<INotification | null> {
  try {
    return await createNotification(params);
  } catch (error) {
    console.error('⚠️ [NotificationService] Failed to create notification:', {
      params,
      error,
    });
    return null;
  }
}

/**
 * Server-side system notification helper.
 */
export async function createSystemNotification(params: {
  userId: string | Types.ObjectId;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  eventKey?: string;
}): Promise<INotification | null> {
  return safeCreateNotification({
    userId: params.userId,
    type: 'system',
    title: params.title,
    message: params.message,
    metadata: params.metadata,
    eventKey: params.eventKey,
  });
}
