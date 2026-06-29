import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LocalRepository } from './repositories/LocalRepository';
import { LockScreen } from './views/LockScreen';
import { HomeView } from './views/HomeView';
import { HistoryView } from './views/HistoryView';
import { BudgetView } from './views/BudgetView';
import { StatsView } from './views/StatsView';
import { ProfileView } from './views/ProfileView';
import { OnboardingView } from './views/OnboardingView';
import { TransactionModal } from './components/TransactionModal';
import { DynamicIcon } from './components/DynamicIcon';
import { Transaction } from './models/types';
import { WelcomeTour } from './components/WelcomeTour';

const MainLayout: React.FC = () => {
  const { isAuthenticated, activeTab, setActiveTab, isOnboarded, profile, setAuthenticated } = useApp();
  
  // Apply theme and accent color globally
  React.useEffect(() => {
    if (!profile) return;
    
    // Apply theme
    const isDark = profile.theme === 'dark' || 
                   (profile.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply accent color
    if (profile.accentColor) {
      document.documentElement.style.setProperty('--color-primary', profile.accentColor);
      
      const hex = profile.accentColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        document.documentElement.style.setProperty('--color-primary-light', `rgba(${r}, ${g}, ${b}, 0.1)`);
      }
    }
  }, [profile.theme, profile.accentColor]);

  // Lock app after 30 seconds of inactivity in background (Multi-event listener with local fallback)
  React.useEffect(() => {
    const recordLeave = () => {
      const activeProf = profile || LocalRepository.getProfile();
      if (!activeProf || !activeProf.pinCode) return;

      if (!localStorage.getItem('finanlist_leave_time')) {
        localStorage.setItem('finanlist_leave_time', Date.now().toString());
      }
    };

    const checkReturn = () => {
      const activeProf = profile || LocalRepository.getProfile();
      if (!activeProf || !activeProf.pinCode) return;

      const leaveStr = localStorage.getItem('finanlist_leave_time');
      if (leaveStr) {
        const leaveTime = parseInt(leaveStr, 10);
        const diffSeconds = (Date.now() - leaveTime) / 1000;
        if (diffSeconds >= 30) {
          setAuthenticated(false);
        }
      }
      localStorage.removeItem('finanlist_leave_time'); // Clear after check
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordLeave();
      } else if (document.visibilityState === 'visible') {
        checkReturn();
      }
    };

    // Listen to multiple exit/enter browser cues to guarantee locking on iOS/Safari/Chrome
    window.addEventListener('blur', recordLeave);
    window.addEventListener('focus', checkReturn);
    window.addEventListener('pagehide', recordLeave);
    window.addEventListener('pageshow', checkReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', recordLeave);
      window.removeEventListener('focus', checkReturn);
      window.removeEventListener('pagehide', recordLeave);
      window.removeEventListener('pageshow', checkReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile, setAuthenticated]);

  // Welcome Tour state
  const [showWelcomeTour, setShowWelcomeTour] = useState<boolean>(false);

  React.useEffect(() => {
    if (isAuthenticated && isOnboarded) {
      const tourDone = localStorage.getItem('finanlist_tour_done');
      if (!tourDone) {
        setShowWelcomeTour(true);
      }
    }
  }, [isAuthenticated, isOnboarded]);

  // Transaction Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editTx, setEditTx] = useState<Transaction | undefined>(undefined);
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');

  // Synchronize browser history with activeTab and modals
  React.useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab }, '', '');
    } else if (window.history.state.tab !== activeTab) {
      window.history.pushState({ tab: activeTab }, '', '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (modalOpen) {
        setModalOpen(false);
        setEditTx(undefined);
      }

      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, modalOpen]);

  React.useEffect(() => {
    if (modalOpen) {
      // Only push if not already at modal state
      if (window.history.state?.modal !== 'transaction') {
        window.history.pushState({ modal: 'transaction', tab: activeTab }, '', '');
      }
    }
  }, [modalOpen]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditTx(undefined);
    if (window.history.state?.modal === 'transaction') {
      window.history.back();
    }
  };

  // Open modal helper
  const handleOpenTransactionModal = (tx?: Transaction, type?: 'income' | 'expense') => {
    setEditTx(tx);
    if (type) {
      setDefaultType(type);
    }
    setModalOpen(true);
  };

  // Render view depending on activeTab
  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView onOpenTransactionModal={handleOpenTransactionModal} />;
      case 'history':
        return <HistoryView onOpenTransactionModal={handleOpenTransactionModal} />;
      case 'budget':
        return <BudgetView />;
      case 'stats':
        return <StatsView />;
      case 'profile':
        return <ProfileView onTriggerWelcomeTour={() => setShowWelcomeTour(true)} />;
      default:
        return <HomeView onOpenTransactionModal={handleOpenTransactionModal} />;
    }
  };

  // If not onboarded, show Onboarding
  if (!isOnboarded) {
    return <OnboardingView />;
  }

  // If not authenticated, show Lockscreen
  if (!isAuthenticated) {
    return <LockScreen />;
  }

  return (
    <div className="phone-viewport">
      {/* Top notch space safe area */}
      <div className="safe-area-top" />
      
      {/* Main active view component */}
      {renderActiveView()}

      {/* Global Transaction Bottom Sheet Modal */}
      <TransactionModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        editTransaction={editTx}
        defaultType={defaultType}
      />

      {/* Floating Action Bar (Bottom Navigation) */}
      <nav className="bottom-nav">
        <button
          onClick={() => setActiveTab('home')}
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        >
          <DynamicIcon name="Home" size={22} />
          <span>Inicio</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
        >
          <DynamicIcon name="ArrowRightLeft" size={22} />
          <span>Movimientos</span>
        </button>

        {/* Center Floating Action Button */}
        <div className="nav-item fab-container">
          <button
            onClick={() => handleOpenTransactionModal(undefined, 'expense')}
            className="fab-button"
            title="Añadir Movimiento"
          >
            <DynamicIcon name="Plus" size={28} color="white" />
          </button>
        </div>

        <button
          onClick={() => setActiveTab('budget')}
          className={`nav-item ${activeTab === 'budget' ? 'active' : ''}`}
        >
          <DynamicIcon name="Wallet" size={22} />
          <span>Presupuesto</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
        >
          <DynamicIcon name="PieChart" size={22} />
          <span>Estadísticas</span>
        </button>
      </nav>
      
      {/* Bottom home indicator safe area */}
      <div className="safe-area-bottom" />

      {showWelcomeTour && (
        <WelcomeTour 
          setActiveTab={setActiveTab}
          onClose={() => {
            localStorage.setItem('finanlist_tour_done', 'true');
            setShowWelcomeTour(false);
          }} 
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="app-container">
        <MainLayout />
      </div>
    </AppProvider>
  );
};

export default App;
