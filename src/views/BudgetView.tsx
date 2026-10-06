import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from '../components/DynamicIcon';
import { CategoryBudgetsSection } from './budget/CategoryBudgetsSection';
import { GoalsSection } from './budget/GoalsSection';
import { DebtsSection } from './budget/DebtsSection';
import { InvestmentsSection } from './budget/InvestmentsSection';

export const BudgetView: React.FC = () => {
  const { stealthMode, setStealthMode } = useApp();
  const [activeSegment, setActiveSegment] = useState<'budgets' | 'goals' | 'debts' | 'investments'>('budgets');

  return (
    <div className="view-screen animate-fade-in">
      {/* Fixed View Header */}
      <div className="view-header">
        <div style={styles.header}>
          <h2>Planificación</h2>
          <button
            onClick={() => setStealthMode(!stealthMode)}
            style={styles.stealthBtn}
            title={stealthMode ? 'Mostrar montos' : 'Ocultar montos'}
            aria-label={stealthMode ? 'Mostrar montos' : 'Ocultar montos'}
          >
            <DynamicIcon name={stealthMode ? 'EyeOff' : 'Eye'} size={20} />
          </button>
        </div>

        {/* Segmented Control */}
        <div style={styles.segmentControl}>
          <button
            onClick={() => setActiveSegment('budgets')}
            style={{
              ...styles.segmentBtn,
              backgroundColor: activeSegment === 'budgets' ? 'var(--bg-phone)' : 'transparent',
              color: activeSegment === 'budgets' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeSegment === 'budgets' ? '700' : '500',
            }}
          >
            Presupuestos
          </button>
          <button
            onClick={() => setActiveSegment('goals')}
            style={{
              ...styles.segmentBtn,
              backgroundColor: activeSegment === 'goals' ? 'var(--bg-phone)' : 'transparent',
              color: activeSegment === 'goals' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeSegment === 'goals' ? '700' : '500',
            }}
          >
            Metas
          </button>
          <button
            onClick={() => setActiveSegment('debts')}
            style={{
              ...styles.segmentBtn,
              backgroundColor: activeSegment === 'debts' ? 'var(--bg-phone)' : 'transparent',
              color: activeSegment === 'debts' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeSegment === 'debts' ? '700' : '500',
            }}
          >
            Deudas
          </button>
          <button
            onClick={() => setActiveSegment('investments')}
            style={{
              ...styles.segmentBtn,
              backgroundColor: activeSegment === 'investments' ? 'var(--bg-phone)' : 'transparent',
              color: activeSegment === 'investments' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: activeSegment === 'investments' ? '700' : '500',
            }}
          >
            Inversiones
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="view-content">
        {activeSegment === 'budgets' && <CategoryBudgetsSection />}
        {activeSegment === 'goals' && <GoalsSection />}
        {activeSegment === 'debts' && <DebtsSection />}
        {activeSegment === 'investments' && <InvestmentsSection />}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stealthBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
  },
  segmentControl: {
    display: 'flex',
    backgroundColor: 'var(--bg-input)',
    padding: '4px',
    borderRadius: '12px',
    gap: '4px',
  },
  segmentBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
};

export default BudgetView;
