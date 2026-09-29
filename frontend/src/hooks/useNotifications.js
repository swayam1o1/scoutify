import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../api/client';

const POLL_INTERVAL_MS = 45000;

// In-app alerts for vendors when clients search for what they offer.
export function useNotifications({ token, user }) {
  const enabled = Boolean(token) && user?.role === 'artisan';
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await authFetch('/notifications/unread-count', { token });
      if (res.ok) setUnreadCount((await res.json()).unreadCount || 0);
    } catch (err) {
      console.error(err);
    }
  }, [enabled, token]);

  const loadNotifications = useCallback(async ({ append = false } = {}) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const last = append ? notifications[notifications.length - 1] : null;
      const query = last ? `?before=${encodeURIComponent(last.createdAt)}` : '';
      const res = await authFetch(`/notifications${query}`, { token });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(prev => (append ? [...prev, ...(data.notifications || [])] : data.notifications || []));
      setHasMore(Boolean(data.hasMore));
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, notifications, token]);

  const markRead = async (notificationId) => {
    setNotifications(prev => prev.map(item => (item._id === notificationId ? { ...item, read: true } : item)));
    try {
      const res = await authFetch(`/notifications/${notificationId}/read`, { token, method: 'POST' });
      if (res.ok) setUnreadCount((await res.json()).unreadCount || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      await authFetch('/notifications/read-all', { token, method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      return undefined;
    }

    refreshUnreadCount();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refreshUnreadCount]);

  return {
    enabled,
    notifications,
    unreadCount,
    hasMore,
    loading,
    loadNotifications,
    refreshUnreadCount,
    markRead,
    markAllRead
  };
}

export default useNotifications;
