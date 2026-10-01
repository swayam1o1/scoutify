import { Camera, Search } from 'lucide-react';

function timeAgo(value) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function NotificationList({ notifications, onItemClick, emptyText = 'No notifications yet.' }) {
  if (notifications.length === 0) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', padding: '12px 4px', margin: 0 }}>{emptyText}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {notifications.map(item => {
        const Icon = item.data?.searchType === 'ai_image' ? Camera : Search;
        const chips = [item.data?.city, item.data?.material, item.data?.useCase].filter(Boolean);
        return (
          <div
            key={item._id}
            onClick={() => onItemClick?.(item)}
            style={{
              display: 'flex',
              gap: '10px',
              padding: '10px',
              borderRadius: '10px',
              cursor: item.read ? 'default' : 'pointer',
              background: item.read ? 'transparent' : 'rgba(20,241,149,0.06)',
              border: `1px solid ${item.read ? 'var(--border-color)' : 'rgba(20,241,149,0.25)'}`
            }}
          >
            <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'rgba(153,69,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={15} style={{ color: '#c084fc' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{timeAgo(item.createdAt)}</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0', lineHeight: 1.45 }}>{item.message}</p>
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {chips.map(chip => <span key={chip} className="spec-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>{chip}</span>)}
                </div>
              )}
            </div>
            {!item.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        );
      })}
    </div>
  );
}

export default NotificationList;
