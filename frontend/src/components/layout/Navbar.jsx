import { LogOut, User as UserIcon } from 'lucide-react';

export function Navbar({ currentView, user, onNavigate, onOpenBoards, onSignIn, onLogout }) {
  return (
    <nav className="navbar">
      <div className="logo" onClick={() => onNavigate('search')} style={{ cursor: 'pointer' }}>
        Scoutify <span>Hub</span>
      </div>

      <div className="nav-links">
        <button
          className={`btn btn-secondary ${currentView === 'search' ? 'active-tab' : ''}`}
          onClick={() => onNavigate('search')}
        >
          Search
        </button>

        <button
          className={`btn btn-secondary ${currentView === 'pricing' ? 'active-tab' : ''}`}
          onClick={() => onNavigate('pricing')}
        >
          Plans
        </button>

        {user ? (
          <div className="nav-user">
            <button
              className={`btn btn-secondary`}
              onClick={() => onNavigate('dashboard')}
            >
              <UserIcon size={16} />
              Portal
            </button>

            {user.role === 'client' && (
              <button
                className="btn btn-secondary"
                onClick={onOpenBoards}
                style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
              >
                📁 Boards
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.name}</span>
              {user.role === 'client' && (
                <span className={`badge ${user.subscriptionPlan !== 'basic' ? 'badge-purple' : ''}`} style={{ fontSize: '10px' }}>
                  {user.subscriptionPlan.toUpperCase()}
                </span>
              )}
              {user.role === 'artisan' && (
                <span className="badge" style={{ fontSize: '10px' }}>
                  ARTISAN
                </span>
              )}
            </div>

            <button className="btn btn-outline" onClick={onLogout} style={{ padding: '8px 14px' }}>
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => onSignIn('login')}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
