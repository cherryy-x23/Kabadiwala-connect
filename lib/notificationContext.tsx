'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from './authContext';
import { notificationsApi } from './api/notifications';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<number>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshUnreadCount = useCallback(async (): Promise<number> => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return 0;
    }
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
      return count;
    } catch (err) {
      console.warn('Could not fetch unread notification count:', err);
      return 0;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && user) {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [isAuthenticated, user?.id, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationCount(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback if rendered outside provider: safe defaults
    return {
      unreadCount: 0,
      refreshUnreadCount: async () => 0,
      setUnreadCount: () => {},
    };
  }
  return context;
}
