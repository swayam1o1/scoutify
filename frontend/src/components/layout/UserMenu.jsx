import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  FolderOpen,
  LogOut,
  Settings,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function roleLabel(user) {
  if (user.role === 'admin') return 'Admin';
  if (user.role === 'artisan') return 'Vendor';
  return (user.subscriptionPlan || 'basic').toUpperCase();
}

export function UserMenu({ user, currentView, onNavigate, onOpenBoards, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const go = (action) => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className={`user-menu-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="user-menu-avatar">{getInitials(user.name)}</span>
        <span className="user-menu-meta">
          <span className="user-menu-name">{user.name}</span>
          <span className="user-menu-plan">{roleLabel(user)}</span>
        </span>
        <ChevronRight size={16} className={`user-menu-chevron ${open ? 'is-open' : ''}`} />
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <button
            type="button"
            className="user-menu-header"
            onClick={() => go(() => onNavigate(
              user.role === 'admin'
                ? (user.mustEnable2FA ? 'dashboard' : 'admin')
                : 'dashboard'
            ))}
          >
            <span className="user-menu-avatar">{getInitials(user.name)}</span>
            <span className="user-menu-meta">
              <span className="user-menu-name">{user.name}</span>
              <span className="user-menu-plan">{roleLabel(user)}</span>
            </span>
            <ChevronRight size={16} />
          </button>

          <div className="user-menu-divider" />

          {user.role === 'admin' ? (
            <>
              <button
                type="button"
                className={`user-menu-item ${currentView === 'dashboard' ? 'is-active' : ''}`}
                onClick={() => go(() => onNavigate('dashboard'))}
              >
                <Settings size={16} />
                <span>Security / 2FA</span>
              </button>
              {!user.mustEnable2FA && (
                <button
                  type="button"
                  className={`user-menu-item ${currentView === 'admin' ? 'is-active' : ''}`}
                  onClick={() => go(() => onNavigate('admin'))}
                >
                  <ShieldCheck size={16} />
                  <span>Admin console</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className={`user-menu-item ${currentView === 'dashboard' ? 'is-active' : ''}`}
              onClick={() => go(() => onNavigate('dashboard'))}
            >
              <UserIcon size={16} />
              <span>Profile / Portal</span>
            </button>
          )}

          {user.role === 'client' && (
            <button
              type="button"
              className={`user-menu-item ${currentView === 'boards' || currentView === 'board-details' ? 'is-active' : ''}`}
              onClick={() => go(onOpenBoards)}
            >
              <FolderOpen size={16} />
              <span>Boards</span>
            </button>
          )}

          {user.role !== 'admin' && (
            <button
              type="button"
              className="user-menu-item"
              onClick={() => go(() => onNavigate('pricing'))}
            >
              <Settings size={16} />
              <span>Plans & billing</span>
            </button>
          )}

          <div className="user-menu-divider" />

          <button
            type="button"
            className="user-menu-item user-menu-item-danger"
            onClick={() => go(onLogout)}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
