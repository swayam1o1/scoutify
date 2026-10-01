import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationList } from './NotificationList';

export function NotificationBell({ notifications: api, onViewAll }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!api.enabled) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) api.loadNotifications();
  };

  return (
    <div ref={wrapper} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: '8px 10px', position: 'relative' }}
        onClick={toggle}
        aria-label={`Notifications${api.unreadCount ? ` (${api.unreadCount} unread)` : ''}`}
      >
        <Bell size={18} />
        {api.unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: 'var(--color-danger)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {api.unreadCount > 99 ? '99+' : api.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass-card animate-fade-in"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 'min(380px, calc(100vw - 32px))',
            maxHeight: '460px',
            overflowY: 'auto',
            padding: '12px',
            zIndex: 1100,
            background: 'var(--bg-secondary)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '14px' }}>Client search alerts</strong>
            {api.unreadCount > 0 && (
              <button type="button" className="btn btn-outline" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={api.markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {api.loading && api.notifications.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Loading…</p>
          ) : (
            <NotificationList
              notifications={api.notifications.slice(0, 8)}
              onItemClick={item => !item.read && api.markRead(item._id)}
              emptyText="No alerts yet. You'll be notified when clients search for products or services you offer."
            />
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '10px', justifyContent: 'center', fontSize: '12px', padding: '6px' }}
            onClick={() => { setOpen(false); onViewAll(); }}
          >
            View all alerts
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
