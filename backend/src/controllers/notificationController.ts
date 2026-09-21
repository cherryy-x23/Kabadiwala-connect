import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { getNotificationsQuerySchema } from '../validators/notificationValidators';

export const getNotifications = async (
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

    const queryParams = getNotificationsQuerySchema.parse(req.query);
    const { page, limit, isRead } = queryParams;

    const filter: Record<string, any> = {
      userId: req.user.id,
    };

    if (typeof isRead === 'boolean') {
      filter.isRead = isRead;
    }

    const total = await Notification.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
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

export const getUnreadCount = async (
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

    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: 'Unread notification count retrieved successfully',
      data: {
        count,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getNotificationById = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
      return;
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
      return;
    }

    // Ownership check: user can only view their own notifications
    if (notification.userId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you are not authorized to view this notification',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification retrieved successfully',
      data: {
        notification,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const markAsRead = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
      return;
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
      return;
    }

    // Ownership check
    if (notification.userId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you can only update your own notifications',
      });
      return;
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const markAsUnread = async (
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

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
      return;
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
      return;
    }

    // Ownership check
    if (notification.userId.toString() !== req.user.id) {
      res.status(403).json({
        success: false,
        message: 'Access denied: you can only update your own notifications',
      });
      return;
    }

    notification.isRead = false;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as unread',
      data: {
        notification,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const markAllAsRead = async (
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

    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
