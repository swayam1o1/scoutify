import { useState } from 'react';
import './App.css';

import { useAuth } from './hooks/useAuth';
import { useSearch } from './hooks/useSearch';
import { useBoards } from './hooks/useBoards';
import { usePayments } from './hooks/usePayments';

import { Navbar } from './components/layout/Navbar';
import { DemoHud } from './components/layout/DemoHud';
import { SearchView } from './components/search/SearchView';
import { PricingView } from './components/pricing/PricingView';
import { DashboardView } from './components/dashboard/DashboardView';
import { BoardsView } from './components/boards/BoardsView';
import { BoardDetailsView } from './components/boards/BoardDetailsView';
import { AuthModal } from './components/auth/AuthModal';
import { PaymentModal } from './components/payments/PaymentModal';

function App() {
  // Navigation / Views
  const [currentView, setCurrentView] = useState('search'); // 'search' | 'dashboard' | 'pricing' | 'boards' | 'board-details'
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);

  const auth = useAuth({
    onLogout: () => setCurrentView('search')
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
    onUpgraded: () => setCurrentView('search')
  });

  const handleLogout = () => {
    auth.handleLogout();
    search.resetSearch?.();
    setCurrentView('search');
  };

  const { user } = auth;
  const activeBoard = boards.boards.find(b => b._id === boards.activeBoardId);

  return (
    <div id="root">
      <Navbar
        currentView={currentView}
        user={user}
        onNavigate={setCurrentView}
        onOpenBoards={() => {
          setCurrentView('boards');
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
            onNavigate={setCurrentView}
          />
        )}

        {currentView === 'pricing' && (
          <PricingView
            onStartFreeSearch={() => setCurrentView('search')}
            onUpgradeClick={payments.handleUpgradeClick}
          />
        )}

        {currentView === 'dashboard' && user && (
          <DashboardView user={user} auth={auth} boards={boards} />
        )}

        {currentView === 'boards' && user && (
          <BoardsView
            boards={boards}
            onOpenBoard={(boardId) => {
              boards.setActiveBoardId(boardId);
              setCurrentView('board-details');
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
                setCurrentView('boards');
                boards.setActiveBoardId(null);
              }}
              onDeleteBoard={(boardId) => {
                boards.deleteBoard(boardId);
                setCurrentView('boards');
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
