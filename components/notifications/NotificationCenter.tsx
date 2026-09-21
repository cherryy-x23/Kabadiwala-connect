'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Calendar,
  Truck,
  Wallet,
  XCircle,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Package,
} from 'lucide-react';
import { notificationsApi, NotificationItem, NotificationType } from '@/lib/api/notifications';
import { useAuth } from '@/lib/authContext';
import { useNotificationCount } from '@/lib/notificationContext';

interface NotificationCenterProps {
  role?: 'collector' | 'recycler' | 'admin';
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'request_created':
      return {
        icon: <Package size={18} />,
        bg: 'bg-blue-50 text-blue-600 border-blue-200',
      };
    case 'request_accepted':
      return {
        icon: <CheckCircle2 size={18} />,
        bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      };
    case 'request_rejected':
      return {
        icon: <XCircle size={18} />,
        bg: 'bg-rose-50 text-rose-600 border-rose-200',
      };
    case 'request_scheduled':
      return {
        icon: <Calendar size={18} />,
        bg: 'bg-amber-50 text-amber-600 border-amber-200',
      };
    case 'request_in_transit':
      return {
        icon: <Truck size={18} />,
        bg: 'bg-purple-50 text-purple-600 border-purple-200',
      };
    case 'request_completed':
      return {
        icon: <CheckCircle2 size={18} />,
        bg: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      };
    case 'transaction_created':
      return {
        icon: <Wallet size={18} />,
        bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      };
    case 'system':
    default:
      return {
        icon: <Bell size={18} />,
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

function formatNotificationTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

export default function NotificationCenter({ role }: NotificationCenterProps) {
  const { isAuthenticated } = useAuth();
  const { refreshUnreadCount } = useNotificationCount();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const isReadParam = filter === 'unread' ? false : filter === 'read' ? true : undefined;
      const res = await notificationsApi.getNotifications({
        limit: 50,
        isRead: isReadParam,
      });
      setNotifications(res.notifications);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Unable to load notifications from backend.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleToggleRead = async (item: NotificationItem) => {
    setActionLoadingId(item.id);
    try {
      if (item.isRead) {
        const updated = await notificationsApi.markAsUnread(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: false } : n))
        );
      } else {
        const updated = await notificationsApi.markAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      }
      await refreshUnreadCount();
    } catch (err: any) {
      console.error('Failed to update notification read status:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshUnreadCount();
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100">
        <div className="flex gap-2">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'unread' ? `Unread (${unreadCount})` : f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
            >
              {markingAll ? 'Marking...' : 'Mark all as read'}
            </button>
          )}

          <button
            onClick={fetchNotifications}
            title="Refresh notifications"
            disabled={loading}
            className="p-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchNotifications}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="card p-12 text-center text-gray-500">
          <div className="size-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading your real notifications from backend...</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <div className="card p-12 text-center">
          <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Bell size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No notifications found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {filter === 'unread'
              ? 'You have caught up with all your updates. No unread notifications!'
              : 'Updates regarding handovers, requests, schedules, and settlement transactions will appear here.'}
          </p>
        </div>
      ) : (
        /* Notification items list */
        <div className="flex flex-col gap-3">
          {notifications.map((n) => {
            const { icon, bg } = getNotificationIcon(n.type);
            const isActing = actionLoadingId === n.id;

            return (
              <div
                key={n.id}
                className={`card p-5 flex gap-4 transition-all duration-200 ${
                  !n.isRead
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Notification Icon */}
                <div
                  className={`size-11 rounded-2xl border flex items-center justify-center shrink-0 ${bg}`}
                >
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                      {!n.isRead && (
                        <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatNotificationTime(n.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{n.message}</p>

                  {/* Metadata tags if present */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-gray-100/80">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-2 py-0.5 rounded-md bg-gray-100">
                      {n.type.replace(/_/g, ' ')}
                    </span>

                    {/* Mark read / unread button */}
                    <button
                      onClick={() => handleToggleRead(n)}
                      disabled={isActing}
                      className="text-xs font-medium text-gray-500 hover:text-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {isActing
                        ? 'Updating...'
                        : n.isRead
                        ? 'Mark as unread'
                        : 'Mark as read'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
