import { useEffect, useRef, useState } from 'react';
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
import { PaymentReauthModal } from './components/auth/PaymentReauthModal';
import { AdminView } from './components/admin/AdminView';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { Toast } from './components/ui/Toast';
import { parseLocation, syncUrlForView, isAuthRequiredView } from './utils/navigation';
import { authFetch } from './api/client';

function App() {
  const initial = parseLocation();
  const [currentView, setCurrentView] = useState(initial.view);
  const [isHudCollapsed, setIsHudCollapsed] = useState(true);
  const boardsApiRef = useRef(null);

  const navigate = (view, { boardId, replace = false } = {}) => {
    const boardsApi = boardsApiRef.current;

    if (view === 'board-details') {
      const id = boardId || boardsApi?.activeBoardId;
      if (!id) {
        setCurrentView('boards');
        boardsApi?.setActiveBoardId(null);
        syncUrlForView('boards', { replace });
        return;
      }
      boardsApi?.setActiveBoardId(id);
      setCurrentView('board-details');
      syncUrlForView('board-details', { boardId: id, replace });
      return;
    }

    if (view === 'boards') {
      boardsApi?.setActiveBoardId(null);
    }

    setCurrentView(view);
    syncUrlForView(view, { replace });
  };

  const auth = useAuth({
    onLogout: () => navigate('search'),
    onLoginSuccess: (nextUser) => {
      if (nextUser?.role === 'admin') {
        navigate(nextUser.mustEnable2FA ? 'dashboard' : 'admin');
        return;
      }
      if (nextUser?.role === 'client' && !nextUser.onboardingCompleted) {
        navigate('onboarding');
      }
    }
  });

  const search = useSearch({
    token: auth.token,
    user: auth.user,
    onRequireAuth: auth.openAuthModal,
    demoLogin: auth.demoLogin
  });

  const boards = useBoards({ token: auth.token });
  boardsApiRef.current = boards;

  const payments = usePayments({
    token: auth.token,
    user: auth.user,
    setUser: auth.setUser,
    onRequireAuth: auth.openAuthModal,
    onUpgraded: () => navigate('search'),
    requestReauthEmailCode: auth.requestReauthEmailCode
  });

  const admin = useAdmin({
    token: auth.token,
    user: auth.user,
    applySession: auth.applySession
  });

  // Force consumers through onboarding until completed (SRS §4)
  useEffect(() => {
    if (!auth.user) return;
    if (auth.user.role !== 'client') return;
    if (auth.user.onboardingCompleted) return;
    if (currentView === 'onboarding') return;
    navigate('onboarding', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user, currentView]);

  // Browser back / forward
  useEffect(() => {
    const onPopState = () => {
      const { view, boardId } = parseLocation();
      if (view === 'board-details' && boardId) {
        boardsApiRef.current?.setActiveBoardId(boardId);
      } else if (view === 'boards') {
        boardsApiRef.current?.setActiveBoardId(null);
      }
      setCurrentView(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Deep-link: /boards/:id after boards finish loading
  useEffect(() => {
    const { view, boardId } = parseLocation();
    if (view !== 'board-details' || !boardId || !auth.token) return;
    if (boards.activeBoardId === boardId) {
      if (currentView !== 'board-details') setCurrentView('board-details');
      return;
    }
    const exists = boards.boards.some(b => String(b._id) === String(boardId));
    if (exists) {
      boards.setActiveBoardId(boardId);
      setCurrentView('board-details');
    }
  }, [auth.token, boards.boards, boards.activeBoardId, currentView]);

  // Auth-required routes: bounce guests to home + sign-in
  useEffect(() => {
    if (!isAuthRequiredView(currentView)) return;
    if (auth.user || auth.token) return;
    setCurrentView('search');
    syncUrlForView('search', { replace: true });
    auth.openAuthModal?.('login');
  }, [currentView, auth.user, auth.token]);

  // Canonicalize URL on first paint (e.g. /pricing → /plans)
  useEffect(() => {
    const { view, boardId } = parseLocation();
    syncUrlForView(view, { boardId, replace: true });
  }, []);

  const handleLogout = () => {
    auth.handleLogout();
    search.resetSearch?.();
    navigate('search');
  };

  const { user } = auth;
  const isAdminUser = user?.role === 'admin';
  const adminNeeds2FA = isAdminUser && !!user?.mustEnable2FA;
  const activeBoard = boards.boards.find(b => b._id === boards.activeBoardId);
  const needsOnboarding = user?.role === 'client' && !user?.onboardingCompleted;
  const editingOnboarding = currentView === 'onboarding' && user?.role === 'client' && !!user?.onboardingCompleted;

  const safeView = currentView === 'admin' && adminNeeds2FA
    ? 'dashboard'
    : (needsOnboarding ? 'onboarding' : currentView);

  useEffect(() => {
    if (currentView === 'admin' && adminNeeds2FA) {
      syncUrlForView('dashboard', { replace: true });
    }
  }, [currentView, adminNeeds2FA]);

  return (
    <div id="root">
      <Navbar
        currentView={safeView}
        user={user}
        onNavigate={navigate}
        onOpenBoards={() => navigate('boards')}
        onSignIn={auth.openAuthModal}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1 }}>
        {safeView === 'onboarding' && user && (
          <OnboardingWizard
            user={user}
            token={auth.token}
            authFetch={authFetch}
            editMode={editingOnboarding}
            onDraftSaved={(nextUser) => auth.setUser(nextUser)}
            onCancel={() => navigate('dashboard')}
            onComplete={(nextUser) => {
              auth.setUser(nextUser);
              navigate(editingOnboarding ? 'dashboard' : 'search');
            }}
          />
        )}

        {safeView === 'search' && !needsOnboarding && (
          <SearchView
            search={search}
            boards={boards}
            user={user}
            onRequireAuth={auth.openAuthModal}
            onNavigate={navigate}
          />
        )}

        {safeView === 'pricing' && !needsOnboarding && (
          <PricingView
            onStartFreeSearch={() => navigate('search')}
            onUpgradeClick={payments.handleUpgradeClick}
          />
        )}

        {safeView === 'admin' && isAdminUser && !adminNeeds2FA && (
          <AdminView admin={admin} />
        )}

        {safeView === 'dashboard' && user && !needsOnboarding && (
          <DashboardView user={user} auth={auth} boards={boards} onNavigate={navigate} />
        )}

        {safeView === 'boards' && user && !needsOnboarding && (
          <BoardsView
            boards={boards}
            onOpenBoard={(boardId) => navigate('board-details', { boardId })}
          />
        )}

        {safeView === 'board-details' && user && !needsOnboarding && (
          activeBoard ? (
            <BoardDetailsView
              board={activeBoard}
              boards={boards}
              user={user}
              onBack={() => navigate('boards')}
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

      <Toast
        message={auth.accountMessage}
        error={auth.accountError}
        toastKey={auth.toastKey}
        onDismiss={auth.clearAccountFeedback}
      />

      {auth.showAuthModal && <AuthModal auth={auth} />}

      <PaymentReauthModal
        open={payments.showReauthModal}
        user={user}
        plan={payments.pendingPlan}
        reauthForm={payments.reauthForm}
        setReauthForm={payments.setReauthForm}
        reauthError={payments.reauthError}
        reauthBusy={payments.reauthBusy}
        emailCodeBusy={payments.emailCodeBusy}
        onRequestEmailCode={payments.sendEmailCode}
        onSubmit={payments.confirmReauthAndStartOrder}
        onCancel={payments.closeReauthModal}
      />

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
