import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DynamicIcon } from '../../components/DynamicIcon';
import { SavingGoal, PaymentMethod } from '../../models/types';
import { FinancialEngine } from '../../services/FinancialEngine';
import { StatsService } from '../../services/StatsService';
import { AccountPickerModal } from './AccountPickerModal';

export const GoalsSection: React.FC = () => {
  const {
    goals,
    transactions,
    profile,
    addGoal,
    updateGoal,
    deleteGoal,
    addTransaction,
    stealthMode,
    cards,
    budgets,
    debts
  } = useApp();

  const activeCards = cards.filter(c => c.isActive);
  const summary = StatsService.getSummary(transactions, budgets, cards, undefined, debts, goals);

  // Modals state
  const [showAddGoal, setShowAddGoal] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<SavingGoal | null>(null);
  const [gName, setGName] = useState<string>('');
  const [gTarget, setGTarget] = useState<string>('');
  const [gSaved, setGSaved] = useState<string>('0');
  const [gIcon, setGIcon] = useState<string>('Target');
  const [gColor, setGColor] = useState<string>('#6366f1');
  const [gDate, setGDate] = useState<string>('');

  // Account picker for depositing to goals
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);
  const [targetGoalForDeposit, setTargetGoalForDeposit] = useState<{ goal: SavingGoal; amount: number } | null>(null);

  // Calculate total savings allocated this month (including transfers to goals)
  const getMonthlySavingsAllocated = () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return transactions
      .filter(tx => (tx.type === 'expense' || tx.type === 'transfer') && tx.categoryId === 'cat_saving' && tx.date.substring(0, 7) === currentYM)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };
  const monthlySavingsAllocated = getMonthlySavingsAllocated();

  // Browser back navigation integration
  useEffect(() => {
    if (showAddGoal) {
      if (window.history.state?.modal !== 'goal') {
        window.history.pushState({ modal: 'goal', tab: 'budget' }, '', '');
      }
    }
  }, [showAddGoal]);

  useEffect(() => {
    const handlePopState = () => {
      if (showAddGoal) {
        setEditingGoal(null);
        setGName('');
        setGTarget('');
        setGSaved('0');
        setGIcon('Target');
        setGColor('#6366f1');
        setGDate('');
        setShowAddGoal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showAddGoal]);

  const handleEditGoal = (goal: SavingGoal) => {
    setEditingGoal(goal);
    setGName(goal.name);
    setGTarget(goal.targetAmount.toString());
    setGSaved(goal.currentAmount.toString());
    setGIcon(goal.icon);
    setGColor(goal.color);
    setGDate(goal.targetDate);
    setShowAddGoal(true);
  };

  const handleCloseGoalModal = () => {
    setEditingGoal(null);
    setGName('');
    setGTarget('');
    setGSaved('0');
    setGIcon('Target');
    setGColor('#6366f1');
    setGDate('');
    setShowAddGoal(false);
    if (window.history.state?.modal === 'goal') {
      window.history.back();
    }
  };

  const handleCreateGoal = () => {
    const target = parseFloat(gTarget);
    const saved = parseFloat(gSaved);
    if (isNaN(target) || target <= 0) {
      alert('Ingresa una meta de ahorro válida.');
      return;
    }

    if (editingGoal) {
      updateGoal({
        ...editingGoal,
        name: gName || 'Objetivo de Ahorro',
        targetAmount: target,
        currentAmount: isNaN(saved) ? 0 : saved,
        icon: gIcon,
        color: gColor,
        targetDate: gDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
      });
    } else {
      addGoal({
        name: gName || 'Objetivo de Ahorro',
        targetAmount: target,
        currentAmount: isNaN(saved) ? 0 : saved,
        icon: gIcon,
        color: gColor,
        targetDate: gDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
      });
    }

    handleCloseGoalModal();
  };

  const handleAportarGoal = (goal: SavingGoal) => {
    const amountStr = prompt(`¿Cuánto deseas aportar a "${goal.name}"?`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    setTargetGoalForDeposit({ goal, amount });
    setShowAccountPicker(true);
  };

  const handleConfirmGoalDeposit = (account: string, cardId?: string, paymentMethod?: PaymentMethod) => {
    if (!targetGoalForDeposit) return;
    const { goal, amount } = targetGoalForDeposit;

    const selectedCard = cardId ? cards.find(c => c.id === cardId) : undefined;
    const validation = FinancialEngine.validateTransaction(amount, paymentMethod || 'cash', selectedCard, summary, activeCards);
    if (!validation.isValid) {
      alert(`${validation.errorTitle}: ${validation.errorMessage}`);
      return;
    }

    const now = new Date();
    addTransaction({
      amount,
      type: 'transfer',
      categoryId: 'cat_saving',
      paymentMethod: paymentMethod || (cardId ? 'card' : 'cash'),
      account,
      cardId,
      destinationAccountId: `goal_${goal.id}`,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].slice(0, 5),
      notes: `Aporte a meta: ${goal.name} #goal:${goal.id}`,
      color: goal.color,
      icon: goal.icon
    });

    setTargetGoalForDeposit(null);
  };

  const handleDeleteGoal = (id: string) => {
    if (confirm('¿Deseas eliminar esta meta de ahorro?')) {
      deleteGoal(id);
    }
  };

  const getRemainingTimeText = (dateStr: string) => {
    const now = new Date();
    const target = new Date(dateStr);
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return 'Meta cumplida';

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days > 365) {
      const years = (days / 365).toFixed(1);
      return `Restan ${years} años`;
    }
    if (days > 30) {
      const months = Math.ceil(days / 30);
      return `Restan ${months} meses`;
    }
    return `Restan ${days} días`;
  };

  return (
    <div style={styles.listContainer}>
      {/* Resumen de Ahorros del Mes */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--color-primary)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DynamicIcon name="PiggyBank" size={20} color="var(--color-primary)" />
          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-secondary)' }}>Ahorro Destinado este Mes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {stealthMode ? '••••' : `${profile.currency}${monthlySavingsAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </h2>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Dinero depositado en metas y aportes directos al ahorro en este ciclo.
        </span>
      </div>

      <button className="btn btn-secondary" onClick={() => setShowAddGoal(true)} style={styles.addBtn}>
        <DynamicIcon name="Plus" size={16} />
        <span>Nueva Meta de Ahorro</span>
      </button>

      {goals.length > 0 ? (
        <div style={styles.grid}>
          {goals.map(g => {
            const percent = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
            const isCompleted = g.currentAmount >= g.targetAmount;

            const now = new Date();
            const targetDate = new Date(g.targetDate);
            const diffTime = targetDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const remainingAmount = g.targetAmount - g.currentAmount;

            let recText = '';
            let isBehind = false;

            if (remainingAmount > 0) {
              if (diffDays > 0) {
                const months = Math.max(1, Math.ceil(diffDays / 30.4));
                const weekly = Math.max(1, Math.ceil(diffDays / 7));
                const monthlyRec = remainingAmount / months;
                const weeklyRec = remainingAmount / weekly;

                recText = `Recomendado: ${profile.currency}${monthlyRec.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mes (o ${profile.currency}${weeklyRec.toLocaleString(undefined, { maximumFractionDigits: 0 })}/sem)`;

                if (months <= 3 && (g.currentAmount / g.targetAmount) < 0.5) {
                  isBehind = true;
                }
              } else {
                recText = '⚠️ Fecha límite superada';
                isBehind = true;
              }
            } else {
              recText = '🎉 ¡Meta alcanzada!';
            }

            return (
              <div key={g.id} className="card" style={styles.planCard}>
                <div style={styles.planHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ ...styles.iconCircle, backgroundColor: g.color }}>
                      <DynamicIcon name={g.icon} size={18} color="white" />
                    </div>
                    <div>
                      <h3 style={styles.planTitle}>{g.name}</h3>
                      <span style={styles.timeRemaining}>{getRemainingTimeText(g.targetDate)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => handleEditGoal(g)} style={styles.deleteBtn} title="Editar Meta">
                      <DynamicIcon name="Pencil" size={16} color="var(--text-muted)" />
                    </button>
                    <button onClick={() => handleDeleteGoal(g.id)} style={styles.deleteBtn} title="Eliminar Meta">
                      <DynamicIcon name="Trash2" size={16} color="var(--text-muted)" />
                    </button>
                  </div>
                </div>

                <div style={styles.progressRow}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Ahorrado: {profile.currency}{g.currentAmount.toLocaleString()} / {profile.currency}{g.targetAmount.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: isCompleted ? 'var(--color-success)' : 'var(--text-primary)' }}>
                    {percent.toFixed(0)}%
                  </span>
                </div>

                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: isCompleted ? 'var(--color-success)' : g.color
                    }}
                  />
                </div>

                <div style={{ fontSize: '11px', color: isBehind ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: isBehind ? '600' : '400', padding: '0 2px' }}>
                  {recText}
                </div>

                <div style={styles.planFooterGoal}>
                  {isCompleted ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🎉 ¡Meta Alcanzada!
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleAportarGoal(g)}
                      style={styles.contributeBtn}
                    >
                      Aportar Dinero
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state card">
          <DynamicIcon name="Award" size={32} className="empty-state-icon" />
          <p>No tienes objetivos de ahorro configurados.</p>
          <p className="empty-state-quote">"Ahorrar no es solo guardar, es cuidar tu libertad futura."</p>
        </div>
      )}

      {/* --- ADD / EDIT GOAL MODAL SHEET --- */}
      {showAddGoal && (
        <div className="modal-overlay open" onClick={handleCloseGoalModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGoal ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}</h2>
              <button className="btn-ghost" onClick={handleCloseGoalModal} aria-label="Cerrar" title="Cerrar">
                <DynamicIcon name="X" size={20} color="var(--text-primary)" />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Nombre del Objetivo</label>
              <input
                type="text"
                placeholder="Ej. Viaje a Japón"
                value={gName}
                onChange={(e) => setGName(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', marginTop: '-8px' }}>
              {[
                { label: '🚗 Auto', name: 'Comprar Vehículo', icon: 'Car', color: '#6366f1' },
                { label: '✈️ Viaje', name: 'Vacaciones', icon: 'Plane', color: '#00cccc' },
                { label: '🏠 Casa', name: 'Inicial de Vivienda', icon: 'Home', color: '#2ecc71' },
                { label: '🛡️ Fondo', name: 'Fondo de Emergencia', icon: 'ShieldAlert', color: '#ff4d4d' }
              ].map(sug => (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => {
                    setGName(sug.name);
                    setGIcon(sug.icon);
                    setGColor(sug.color);
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {sug.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Monto Meta</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={gTarget}
                  onChange={(e) => setGTarget(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Ahorro Inicial</label>
                <input
                  type="number"
                  placeholder="0"
                  value={gSaved}
                  onChange={(e) => setGSaved(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Fecha Objetivo</label>
              <input
                type="date"
                value={gDate}
                onChange={(e) => setGDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Icono</label>
                <select
                  value={gIcon}
                  onChange={(e) => setGIcon(e.target.value)}
                  className="input-field"
                >
                  <option value="Target">Meta (Diana)</option>
                  <option value="Car">Vehículo</option>
                  <option value="Plane">Viaje</option>
                  <option value="Home">Casa</option>
                  <option value="GraduationCap">Estudios</option>
                  <option value="Heart">Salud</option>
                  <option value="ShieldAlert">Emergencia</option>
                </select>
              </div>

              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Color de Progreso</label>
                <select
                  value={gColor}
                  onChange={(e) => setGColor(e.target.value)}
                  className="input-field"
                >
                  <option value="#6366f1">Indigo (Azul)</option>
                  <option value="#2ecc71">Esmeralda (Verde)</option>
                  <option value="#00cccc">Turquesa (Celeste)</option>
                  <option value="#ffaa00">Ámbar (Naranja)</option>
                  <option value="#ff4d4d">Carmín (Rojo)</option>
                  <option value="#a855f7">Púrpura</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleCreateGoal}>
              {editingGoal ? 'Guardar Cambios' : 'Crear Meta'}
            </button>
          </div>
        </div>
      )}

      {/* Account Picker for Goal Contribution */}
      <AccountPickerModal
        isOpen={showAccountPicker}
        title={targetGoalForDeposit ? `Origen de fondos para "${targetGoalForDeposit.goal.name}"` : 'Seleccionar Origen'}
        onClose={() => {
          setShowAccountPicker(false);
          setTargetGoalForDeposit(null);
        }}
        onSelect={handleConfirmGoalDeposit}
        activeCards={activeCards}
        cashBalance={summary.cashBalance}
        currency={profile.currency}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  addBtn: {
    padding: '10px',
    fontSize: '13px',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  planCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  planHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '4px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planFooterGoal: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '8px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRemaining: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  contributeBtn: {
    width: 'auto',
    padding: '6px 12px',
    fontSize: '11px',
    borderRadius: '8px',
  },
};
