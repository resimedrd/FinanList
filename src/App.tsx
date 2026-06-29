import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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

const MainLayout: React.FC = () => {
  const { isAuthenticated, activeTab, setActiveTab, isOnboarded } = useApp();
  
  // Transaction Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editTx, setEditTx] = useState<Transaction | undefined>(undefined);
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');

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
        return <ProfileView />;
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
        onClose={() => {
          setModalOpen(false);
          setEditTx(undefined);
        }}
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
