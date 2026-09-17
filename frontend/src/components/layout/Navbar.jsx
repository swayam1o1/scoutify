import { ShieldCheck } from 'lucide-react';
import { UserMenu } from './UserMenu';

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

        {user?.role === 'admin' && (
          <button
            className={`btn btn-secondary ${currentView === 'admin' ? 'active-tab' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <ShieldCheck size={16} />
            Admin
          </button>
        )}

        {user ? (
          <UserMenu
            user={user}
            currentView={currentView}
            onNavigate={onNavigate}
            onOpenBoards={onOpenBoards}
            onLogout={onLogout}
          />
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
