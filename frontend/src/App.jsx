import { useEffect, useState } from 'react';
import './App.css';

import { useAuth } from './hooks/useAuth';
import { useSearch } from './hooks/useSearch';
import { useBoards } from './hooks/useBoards';
import { usePayments } from './hooks/usePayments';
import { useAdmin } from './hooks/useAdmin';

import { Navbar } from './components/layout/Navbar';
import { DemoHud } from './components/layout/DemoHud';
import { SearchView } from './components/search/SearchView';
import { PricingView } from './components/pricing/PricingView';
import { DashboardView } from './components/dashboard/DashboardView';
import { BoardsView } from './components/boards/BoardsView';
import { BoardDetailsView } from './components/boards/BoardDetailsView';
import { AuthModal } from './components/auth/AuthModal';
import { PaymentModal } from './components/payments/PaymentModal';
import { AdminView } from './components/admin/AdminView';
import { syncUrlForView, viewFromPath } from './utils/navigation';

function App() {
  // Navigation / Views. /admin is the staff entry (not #admin).
  const [currentView, setCurrentView] = useState(() => viewFromPath() || 'search');
  const [isHudCollapsed, setIsHudCollapsed] = useState(true);

  const navigate = (view) => {
    setCurrentView(view);
    syncUrlForView(view);
  };

  useEffect(() => {
    const onPopState = () => {
      const fromPath = viewFromPath();
      setCurrentView(fromPath || 'search');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const auth = useAuth({
    onLogout: () => navigate('search')
  });

  const search = useSearch({
    token: auth.token,
    user: auth.user,
    onRequireAuth: auth.openAuthModal,
    demoLogin: auth.demoLogin
  });

  const boards = useBoards({ token: auth.token });

  const payments = usePayments({
    token: auth.token,
    user: auth.user,
    setUser: auth.setUser,
    onRequireAuth: auth.openAuthModal,
    onUpgraded: () => navigate('search')
  });

  const admin = useAdmin({
    token: auth.token,
    user: auth.user,
    applySession: auth.applySession
  });

  const handleLogout = () => {
    auth.handleLogout();
    search.resetSearch?.();
    navigate('search');
  };

  const { user } = auth;
  const isAdminUser = user?.role === 'admin';
  const activeBoard = boards.boards.find(b => b._id === boards.activeBoardId);

  return (
    <div id="root">
      <Navbar
        currentView={currentView}
        user={user}
        onNavigate={navigate}
        onOpenBoards={() => {
          navigate('boards');
          boards.setActiveBoardId(null);
        }}
        onSignIn={auth.openAuthModal}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1 }}>
        {currentView === 'search' && (
          <SearchView
            search={search}
            boards={boards}
            user={user}
            onRequireAuth={auth.openAuthModal}
            onNavigate={navigate}
          />
        )}

        {currentView === 'pricing' && (
          <PricingView
            onStartFreeSearch={() => navigate('search')}
            onUpgradeClick={payments.handleUpgradeClick}
          />
        )}

        {(currentView === 'admin' || (currentView === 'dashboard' && isAdminUser)) && (
          <AdminView admin={admin} />
        )}

        {currentView === 'dashboard' && user && !isAdminUser && (
          <DashboardView user={user} auth={auth} boards={boards} />
        )}

        {currentView === 'boards' && user && (
          <BoardsView
            boards={boards}
            onOpenBoard={(boardId) => {
              boards.setActiveBoardId(boardId);
              navigate('board-details');
            }}
          />
        )}

        {currentView === 'board-details' && user && (
          activeBoard ? (
            <BoardDetailsView
              board={activeBoard}
              boards={boards}
              user={user}
              onBack={() => {
                navigate('boards');
                boards.setActiveBoardId(null);
              }}
              onDeleteBoard={(boardId) => {
                boards.deleteBoard(boardId);
                navigate('boards');
              }}
            />
          ) : (
            <div style={{ color: 'red', textAlign: 'center', marginTop: '40px' }}>Board not found.</div>
          )
        )}
      </main>

      {auth.showAuthModal && <AuthModal auth={auth} />}

      {payments.showPaymentModal && payments.activePaymentOrder && (
        <PaymentModal
          order={payments.activePaymentOrder}
          onComplete={payments.completeSimulatedPayment}
        />
      )}

      <DemoHud
        isCollapsed={isHudCollapsed}
        setIsCollapsed={setIsHudCollapsed}
        onDemoLogin={auth.handleHudDemoLogin}
        onPaywallDemo={search.handleHudPaywallDemo}
        onAiDemo={search.handleHudAiDemo}
      />
    </div>
  );
}

export default App;
