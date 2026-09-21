import { apiClient, ApiResponse } from '../apiClient';

export type NotificationType =
  | 'request_created'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_scheduled'
  | 'request_in_transit'
  | 'request_completed'
  | 'transaction_created'
  | 'system';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  eventKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const notificationsApi = {
  /**
   * Retrieve notifications for authenticated user
   */
  getNotifications: async (
    params?: GetNotificationsParams
  ): Promise<NotificationsResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.isRead !== undefined) query.append('isRead', params.isRead.toString());

    const qs = query.toString();
    const endpoint = qs ? `/notifications?${qs}` : '/notifications';

    const res = await apiClient.get<ApiResponse<NotificationItem[]>>(endpoint);
    return {
      notifications: res.data || [],
      pagination: res.pagination,
    };
  },

  /**
   * Retrieve total unread notifications count for authenticated user
   */
  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return res.data?.count ?? 0;
  },

  /**
   * Retrieve single notification by ID
   */
  getNotificationById: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.get<ApiResponse<{ notification: NotificationItem }>>(`/notifications/${id}`);
    if (!res.data?.notification) {
      throw new Error(res.message || 'Notification not found');
    }
    return res.data.notification;
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.patch<ApiResponse<{ notification: NotificationItem }>>(`/notifications/${id}/read`);
    if (!res.data?.notification) {
      throw new Error(res.message || 'Failed to mark notification as read');
    }
    return res.data.notification;
  },

  /**
   * Mark a single notification as unread
   */
  markAsUnread: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.patch<ApiResponse<{ notification: NotificationItem }>>(`/notifications/${id}/unread`);
    if (!res.data?.notification) {
      throw new Error(res.message || 'Failed to mark notification as unread');
    }
    return res.data.notification;
  },

  /**
   * Mark all unread notifications as read
   */
  markAllAsRead: async (): Promise<number> => {
    const res = await apiClient.patch<ApiResponse<{ modifiedCount: number }>>('/notifications/read-all');
    return res.data?.modifiedCount ?? 0;
  },
};
