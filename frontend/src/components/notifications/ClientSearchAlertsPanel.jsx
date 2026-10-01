import { useEffect } from 'react';
import { NotificationList } from './NotificationList';

export function ClientSearchAlertsPanel({ notifications: api }) {
  useEffect(() => {
    if (api.enabled) api.loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.enabled]);

  if (!api.enabled) return null;

  return (
    <div className="glass-card" id="client-search-alerts">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <h3 style={{ margin: 0 }}>
          Client Search Alerts
          {api.unreadCount > 0 && <span className="badge badge-purple" style={{ marginLeft: '10px', fontSize: '11px' }}>{api.unreadCount} new</span>}
        </h3>
        {api.unreadCount > 0 && (
          <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={api.markAllRead}>
            Mark all read
          </button>
        )}
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
        When a client's AI or photo search matches your listing, you'll see it here. Client identities are kept private.
        Keep your Products and catalogue up to date to get more matches.
      </p>

      <NotificationList
        notifications={api.notifications}
        onItemClick={item => !item.read && api.markRead(item._id)}
        emptyText="No client searches have matched your listing yet."
      />

      {api.hasMore && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
          onClick={() => api.loadNotifications({ append: true })}
          disabled={api.loading}
        >
          {api.loading ? 'Loading…' : 'Load older alerts'}
        </button>
      )}
    </div>
  );
}

export default ClientSearchAlertsPanel;
