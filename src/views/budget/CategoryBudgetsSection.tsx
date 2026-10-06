import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DynamicIcon } from '../../components/DynamicIcon';
import { Budget, PaymentMethod } from '../../models/types';
import { FinancialEngine } from '../../services/FinancialEngine';
import { StatsService } from '../../services/StatsService';

export const CategoryBudgetsSection: React.FC = () => {
  const {
    budgets,
    transactions,
    categories,
    profile,
    addBudget,
    updateBudget,
    deleteBudget,
    addTransaction,
    addCategory,
    stealthMode,
    cards
  } = useApp();

  const activeCards = cards.filter(c => c.isActive);
  const summary = StatsService.getSummary(transactions, budgets, cards);

  // Modal states
  const [showAddBudget, setShowAddBudget] = useState<boolean>(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [bAmount, setBAmount] = useState<string>('');
  const [bContingencyAmount, setBContingencyAmount] = useState<string>('');
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [bCategoryId, setBCategoryId] = useState<string>('all');
  const [bName, setBName] = useState<string>('');

  // Inline Category Creation State
  const [showInlineAddCategory, setShowInlineAddCategory] = useState<boolean>(false);
  const [inlineCatName, setInlineCatName] = useState<string>('');
  const [inlineCatColor, setInlineCatColor] = useState<string>('#6366f1');
  const [inlineCatIcon, setInlineCatIcon] = useState<string>('Tag');

  // Quick Expense Bottom Sheet State
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState<boolean>(false);
  const [quickExpenseBudget, setQuickExpenseBudget] = useState<Budget | null>(null);
  const [quickExpenseAmount, setQuickExpenseAmount] = useState<string>('');
  const [quickExpenseNotes, setQuickExpenseNotes] = useState<string>('');
  const [quickExpenseIsEmergency, setQuickExpenseIsEmergency] = useState<boolean>(false);
  const [quickExpenseMethod, setQuickExpenseMethod] = useState<PaymentMethod>('card');
  const [quickExpenseCardId, setQuickExpenseCardId] = useState<string>('');

  // Real-time quick expense validation
  const quickAmountNum = parseFloat(quickExpenseAmount) || 0;
  const quickSelectedCard = quickExpenseMethod === 'card'
    ? (activeCards.find(c => c.id === quickExpenseCardId) || activeCards[0])
    : undefined;
  const quickValidation = FinancialEngine.validateTransaction(
    quickAmountNum,
    quickExpenseMethod,
    quickSelectedCard,
    summary,
    activeCards
  );

  // Browser back navigation integration
  useEffect(() => {
    if (showAddBudget) {
      if (window.history.state?.modal !== 'budget') {
        window.history.pushState({ modal: 'budget', tab: 'budget' }, '', '');
      }
    }
  }, [showAddBudget]);

  useEffect(() => {
    const handlePopState = () => {
      if (showAddBudget) {
        setBAmount('');
        setBContingencyAmount('');
        setBName('');
        setBCategoryId('all');
        setBudgetPeriod('monthly');
        setEditingBudget(null);
        setShowAddBudget(false);
      }
      if (showQuickExpenseModal) {
        setQuickExpenseBudget(null);
        setShowQuickExpenseModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showAddBudget, showQuickExpenseModal]);

  const getHistoricalCategoryAverage = (catId: string): number => {
    const catExpenses = transactions.filter(tx => tx.type === 'expense' && tx.categoryId === catId);
    if (catExpenses.length === 0) return 0;

    const months = new Set(catExpenses.map(tx => tx.date.substring(0, 7)));
    const total = catExpenses.reduce((sum, tx) => sum + tx.amount, 0);
    return total / Math.max(1, months.size);
  };

  const getBudgetSpent = (b: Budget, type: 'regular' | 'contingency' | 'total' = 'regular'): number => {
    const activeCategoryBudgetIds = new Set(
      budgets.filter(x => x.type === 'category' && x.categoryId).map(x => x.categoryId)
    );

    return transactions
      .filter(tx => {
        if (tx.type !== 'expense') return false;

        const isWithinPeriod = tx.date >= b.startDate && tx.date <= b.endDate;
        if (!isWithinPeriod) return false;

        const isContingencyTx = !!tx.notes?.includes('#contingency');
        if (type === 'regular' && isContingencyTx) return false;
        if (type === 'contingency' && !isContingencyTx) return false;

        const belongsToCategoryBudget = b.type === 'category' && b.categoryId &&
          (tx.categoryId === b.categoryId || (isContingencyTx && tx.notes?.includes(`#budget_cat:${b.categoryId}`)));

        if (b.type === 'category' && b.categoryId) {
          return belongsToCategoryBudget;
        }

        if (b.type === 'weekly' || b.type === 'monthly') {
          if (isContingencyTx) {
            const hasAssociatedCatBudget = Array.from(activeCategoryBudgetIds).some(catId => tx.notes?.includes(`#budget_cat:${catId}`));
            if (hasAssociatedCatBudget) return false;
          }
          return !activeCategoryBudgetIds.has(tx.categoryId) && tx.categoryId !== 'cat_saving';
        }

        return true;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const getBudgetVelocityColor = (spent: number, limit: number): string => {
    if (spent > limit) return 'var(--color-danger)';

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const elapsedRatio = currentDay / daysInMonth;
    const spentRatio = spent / limit;

    if (spentRatio > elapsedRatio + 0.15) {
      return 'var(--color-danger)';
    }
    if (spentRatio > elapsedRatio) {
      return 'var(--color-warning)';
    }
    return 'var(--color-success)';
  };

  const handleStartEditBudget = (b: Budget) => {
    setEditingBudget(b);
    setBName(b.name || '');
    setBAmount(b.amount.toString());
    setBContingencyAmount(b.contingencyAmount?.toString() || '');
    setBCategoryId(b.categoryId || 'all');
    setBudgetPeriod(b.type === 'weekly' ? 'weekly' : 'monthly');
    setShowAddBudget(true);
  };

  const handleCreateBudget = () => {
    const val = parseFloat(bAmount);
    if (isNaN(val) || val <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    const isGlobal = bCategoryId === 'all' || !bCategoryId;
    const contVal = parseFloat(bContingencyAmount);
    const contingencyAmount = isNaN(contVal) || contVal <= 0 ? undefined : contVal;
    const finalType = isGlobal ? (budgetPeriod === 'weekly' ? 'weekly' : 'monthly') : 'category';

    const defaultName = !isGlobal
      ? categories.find(c => c.id === bCategoryId)?.name || 'Categoría'
      : budgetPeriod === 'weekly' ? 'Presupuesto Semanal' : 'Presupuesto Mensual';

    if (editingBudget) {
      updateBudget({
        ...editingBudget,
        amount: val,
        contingencyAmount,
        type: finalType,
        categoryId: isGlobal ? undefined : bCategoryId,
        name: bName || `${defaultName}`
      });
    } else {
      addBudget({
        amount: val,
        contingencyAmount,
        type: finalType,
        categoryId: isGlobal ? undefined : bCategoryId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        name: bName || `${defaultName}`
      });
    }

    handleCloseBudgetModal();
  };

  const handleCloseBudgetModal = () => {
    setBAmount('');
    setBContingencyAmount('');
    setBName('');
    setBCategoryId('all');
    setBudgetPeriod('monthly');
    setEditingBudget(null);
    setShowAddBudget(false);
    if (window.history.state?.modal === 'budget') {
      window.history.back();
    }
  };

  const handleCreateInlineCategory = () => {
    if (!inlineCatName.trim()) {
      alert('Por favor, ingresa un nombre para la categoría.');
      return;
    }

    const newId = addCategory({
      name: inlineCatName.trim(),
      color: inlineCatColor,
      icon: inlineCatIcon
    });

    setBCategoryId(newId);
    setInlineCatName('');
    setShowInlineAddCategory(false);
  };

  const handleDeleteBudget = (id: string) => {
    if (confirm('¿Deseas eliminar este presupuesto?')) {
      deleteBudget(id);
    }
  };

  const handleResetAllBudgets = () => {
    if (budgets.length === 0) {
      alert('No tienes presupuestos activos para reiniciar.');
      return;
    }
    if (confirm('¿Deseas reiniciar el ciclo de TODOS tus presupuestos?\nLos montos consumidos volverán a 0% a partir de hoy (los gastos anteriores se conservan en tu historial pero ya no se restarán de este nuevo ciclo).')) {
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const oneMonthLater = nextMonth.toISOString().split('T')[0];

      budgets.forEach(b => {
        updateBudget({
          ...b,
          startDate: today,
          endDate: oneMonthLater
        });
      });
      alert('¡Todos los presupuestos han sido reiniciados!');
    }
  };

  const handleQuickExpense = (budget: Budget) => {
    setQuickExpenseBudget(budget);
    setQuickExpenseAmount('');
    setQuickExpenseNotes('');
    setQuickExpenseIsEmergency(false);
    setQuickExpenseMethod(activeCards.length > 0 ? 'card' : 'cash');
    setQuickExpenseCardId(activeCards[0]?.id || '');
    setShowQuickExpenseModal(true);
  };

  const handleCloseQuickExpenseModal = () => {
    setQuickExpenseBudget(null);
    setShowQuickExpenseModal(false);
  };

  const handleSaveQuickExpense = () => {
    if (!quickExpenseBudget) return;

    const amount = parseFloat(quickExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    if (!quickValidation.isValid) {
      alert(`${quickValidation.errorTitle}: ${quickValidation.errorMessage}`);
      return;
    }

    const now = new Date();
    let categoryId = quickExpenseBudget.categoryId || 'cat_extra';
    let noteText = quickExpenseNotes.trim();

    if (quickExpenseIsEmergency) {
      categoryId = 'cat_emergency';
      const tag = quickExpenseBudget.categoryId ? `#budget_cat:${quickExpenseBudget.categoryId}` : `#budget_id:${quickExpenseBudget.id}`;
      noteText = noteText ? `${noteText} #contingency ${tag}` : `Imprevisto / Emergencia #contingency ${tag}`;
    }

    const catObj = categories.find(c => c.id === categoryId);
    const resolvedCardId = quickExpenseMethod === 'card' ? quickSelectedCard?.id : undefined;
    const resolvedAccount = quickExpenseMethod === 'card' ? (quickSelectedCard?.name || 'Tarjeta') : 'Efectivo';

    addTransaction({
      amount,
      type: 'expense',
      categoryId,
      paymentMethod: quickExpenseMethod,
      account: resolvedAccount,
      cardId: resolvedCardId,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].slice(0, 5),
      notes: noteText || `Gasto en ${quickExpenseBudget.name}`,
      color: catObj?.color || 'var(--color-primary)',
      icon: catObj?.icon || 'Coins'
    });

    handleCloseQuickExpenseModal();
  };

  const totalBudgetLimit = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + getBudgetSpent(b, 'regular'), 0);
  const totalContingencyLimit = budgets.reduce((sum, b) => sum + (b.contingencyAmount || 0), 0);
  const totalContingencySpent = budgets.reduce((sum, b) => sum + (b.contingencyAmount ? getBudgetSpent(b, 'contingency') : 0), 0);

  return (
    <div style={styles.listContainer}>
      <button className="btn btn-secondary" onClick={() => setShowAddBudget(true)} style={styles.addBtn}>
        <DynamicIcon name="Plus" size={16} />
        <span>Nuevo Presupuesto</span>
      </button>

      {budgets.length > 0 ? (
        <>
          <div style={styles.grid}>
            {budgets.map(b => {
              const spent = getBudgetSpent(b, 'regular');
              const finalLimit = b.amount;
              const percent = Math.min(100, Math.max(0, (spent / finalLimit) * 100));
              const remaining = Math.max(0, finalLimit - spent);
              const isOverBudget = spent > finalLimit;

              const hasContingency = !!b.contingencyAmount && b.contingencyAmount > 0;
              const contingencyLimit = b.contingencyAmount || 0;
              const contingencySpent = hasContingency ? getBudgetSpent(b, 'contingency') : 0;
              const contingencyPercent = hasContingency ? Math.min(100, Math.max(0, (contingencySpent / contingencyLimit) * 100)) : 0;
              const contingencyRemaining = hasContingency ? Math.max(0, contingencyLimit - contingencySpent) : 0;
              const isContingencyOver = contingencySpent > contingencyLimit;

              return (
                <div key={b.id} className="card" style={{ ...styles.planCard, padding: '12px 16px', gap: '8px' }}>
                  <div style={styles.planHeader}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ ...styles.badge, fontSize: '9px', padding: '1px 5px', display: 'inline-block', marginBottom: '2px' }}>
                        {b.type === 'category' ? 'Categoría' : b.type === 'weekly' ? 'Semanal' : 'Mensual'}
                      </span>
                      <h3 style={{ ...styles.planTitle, fontSize: '15px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.name}>
                        {b.name}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                      <button onClick={() => handleStartEditBudget(b)} style={styles.deleteBtn} title="Editar Presupuesto">
                        <DynamicIcon name="Edit" size={15} color="var(--text-secondary)" />
                      </button>
                      <button onClick={() => handleDeleteBudget(b.id)} style={styles.deleteBtn} title="Eliminar Presupuesto">
                        <DynamicIcon name="Trash2" size={15} color="var(--text-muted)" />
                      </button>
                    </div>
                  </div>

                  {/* Regular Budget Progress */}
                  <div>
                    <div style={{ ...styles.progressRow, marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Gasto Base: <b>{stealthMode ? '••••' : `${profile.currency}${spent.toLocaleString()}`}</b> / {stealthMode ? '••••' : `${profile.currency}${finalLimit.toLocaleString()}`}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: isOverBudget ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                        {percent.toFixed(0)}%
                      </span>
                    </div>

                    <div className="progress-bar-container" style={{ height: '6px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: getBudgetVelocityColor(spent, finalLimit)
                        }}
                      />
                    </div>
                  </div>

                  {/* Contingency Budget Progress */}
                  {hasContingency && (
                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                      <div style={{ ...styles.progressRow, marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          🚨 Imprevistos: <b>{stealthMode ? '••••' : `${profile.currency}${contingencySpent.toLocaleString()}`}</b> / {stealthMode ? '••••' : `${profile.currency}${contingencyLimit.toLocaleString()}`}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: isContingencyOver ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                          {contingencyPercent.toFixed(0)}%
                        </span>
                      </div>

                      <div className="progress-bar-container" style={{ height: '6px' }}>
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${contingencyPercent}%`,
                            backgroundColor: isContingencyOver ? 'var(--color-danger)' : 'var(--color-warning)'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ ...styles.planFooter, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', marginTop: '2px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {isOverBudget ? (
                        <span style={{ color: 'var(--color-danger)', fontWeight: '600', fontSize: '11px' }}>
                          ⚠️ Excedido: {stealthMode ? '••••' : `${profile.currency}${(spent - finalLimit).toFixed(0)}`}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Disponible: <b>{stealthMode ? '••••' : `${profile.currency}${remaining.toFixed(0)}`}</b>
                        </span>
                      )}
                      {hasContingency && (
                        <span style={{ fontSize: '11px', color: isContingencyOver ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          Colchón: <b>{stealthMode ? '••••' : `${profile.currency}${contingencyRemaining.toFixed(0)}`}</b>
                        </span>
                      )}
                    </div>

                    <button
                      className="btn btn-secondary"
                      onClick={() => handleQuickExpense(b)}
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', height: '24px', width: 'auto' }}
                    >
                      <DynamicIcon name="Plus" size={12} />
                      <span>Gasto Rápido</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* General budgets summary card */}
          <div className="card" style={{ marginTop: '16px', background: 'var(--color-primary-light)', borderColor: 'var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DynamicIcon name="PieChart" size={16} color="var(--color-primary)" />
                <span>Resumen General de Presupuestos</span>
              </h4>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetAllBudgets}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '24px',
                  width: 'auto',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                title="Reiniciar todos los presupuestos"
              >
                <DynamicIcon name="RotateCcw" size={11} color="white" />
                <span>Reiniciar Ciclos</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Presupuestado Total</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {stealthMode ? '••••' : `${profile.currency}${(totalBudgetLimit + totalContingencyLimit).toLocaleString()}`}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span>Base: {stealthMode ? '••••' : `${profile.currency}${totalBudgetLimit.toLocaleString()}`}</span>
                  {totalContingencyLimit > 0 && <span>Colchón: {stealthMode ? '••••' : `${profile.currency}${totalContingencyLimit.toLocaleString()}`}</span>}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Gastado Total</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: (totalBudgetSpent + totalContingencySpent) > (totalBudgetLimit + totalContingencyLimit) ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                  {stealthMode ? '••••' : `${profile.currency}${(totalBudgetSpent + totalContingencySpent).toLocaleString()}`}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span>Base: {stealthMode ? '••••' : `${profile.currency}${totalBudgetSpent.toLocaleString()}`}</span>
                  {totalContingencyLimit > 0 && <span>Imprevistos: {stealthMode ? '••••' : `${profile.currency}${totalContingencySpent.toLocaleString()}`}</span>}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Consumo Total</span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {(((totalBudgetSpent + totalContingencySpent) / Math.max(1, totalBudgetLimit + totalContingencyLimit)) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="progress-bar-container" style={{ height: '6px' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(100, ((totalBudgetSpent + totalContingencySpent) / Math.max(1, totalBudgetLimit + totalContingencyLimit)) * 100)}%`,
                    backgroundColor: (totalBudgetSpent + totalContingencySpent) > (totalBudgetLimit + totalContingencyLimit) ? 'var(--color-danger)' : 'var(--color-primary)'
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state card">
          <DynamicIcon name="LineChart" size={32} className="empty-state-icon" />
          <p>No has definido presupuestos para este mes.</p>
          <p className="empty-state-quote">"Un presupuesto te dice a dónde va tu dinero, en vez de preguntarte a dónde se fue."</p>
        </div>
      )}

      {/* --- ADD / EDIT BUDGET MODAL SHEET --- */}
      {showAddBudget && (
        <div className="modal-overlay open" onClick={handleCloseBudgetModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h2>
              <button className="btn-ghost" onClick={handleCloseBudgetModal} aria-label="Cerrar" title="Cerrar">
                <DynamicIcon name="X" size={20} color="var(--text-primary)" />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Nombre del Presupuesto</label>
              <input
                type="text"
                placeholder="Ej. Comida Mensual"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Monto Límite Base</label>
              <input
                type="number"
                placeholder="500.00"
                value={bAmount}
                onChange={(e) => setBAmount(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Monto para Imprevistos / Emergencias (Opcional)</label>
              <input
                type="number"
                placeholder="Ej. 1000.00 (Fondo extra)"
                value={bContingencyAmount}
                onChange={(e) => setBContingencyAmount(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Periodo del Presupuesto</label>
              <select
                value={budgetPeriod}
                onChange={(e) => setBudgetPeriod(e.target.value as any)}
                className="input-field"
              >
                <option value="monthly">Mensual</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: showInlineAddCategory ? '8px' : '15px' }}>
              <label className="input-label">Categoría Asociada</label>
              <select
                value={bCategoryId}
                onChange={(e) => setBCategoryId(e.target.value)}
                className="input-field"
                disabled={showInlineAddCategory}
              >
                <option value="all">Todas las categorías (Presupuesto Global)</option>
                {categories.filter(c => !c.parentId && !['cat_sal', 'cat_inv', 'cat_extra'].includes(c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {!showInlineAddCategory && (
              <button 
                type="button" 
                onClick={() => setShowInlineAddCategory(true)} 
                className="btn btn-ghost" 
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 0', 
                  color: 'var(--color-primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  alignSelf: 'flex-start', 
                  border: 'none', 
                  cursor: 'pointer', 
                  background: 'none',
                  marginTop: '-10px',
                  marginBottom: '14px'
                }}
              >
                <span>➕ ¿No está la categoría? Crear y vincular nueva</span>
              </button>
            )}

            {showInlineAddCategory && (
              <div style={{ 
                border: '1px dashed var(--color-primary)', 
                borderRadius: '12px', 
                padding: '12px', 
                backgroundColor: 'var(--bg-card)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px',
                marginBottom: '14px',
                marginTop: '-6px'
              }}>
                <div style={{ fontWeight: '700', fontSize: '11px', color: 'var(--color-primary)' }}>Nueva Categoría Rápida</div>
                
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <input
                    type="text"
                    placeholder="Nombre, ej. Comida Rápida"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '12px', padding: '6px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', margin: '4px 0' }}>
                  {['#ff4d4d', '#3399ff', '#b366ff', '#ff66b2', '#ffcc00', '#22c55e', '#00cccc', '#e11d48', '#f97316', '#a855f7', '#06b6d4', '#71717a'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setInlineCatColor(color)}
                      style={{
                        height: '18px',
                        width: '18px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: 'none',
                        outline: inlineCatColor === color ? '2px solid var(--text-primary)' : 'none',
                        cursor: 'pointer',
                        justifySelf: 'center'
                      }}
                    />
                  ))}
                </div>

                <select
                  value={inlineCatIcon}
                  onChange={(e) => setInlineCatIcon(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '12px', padding: '5px' }}
                >
                  <option value="Tag">🏷️ Etiqueta genérica</option>
                  <option value="Coffee">☕ Comida / Café</option>
                  <option value="Car">🚗 Vehículo / Transporte</option>
                  <option value="Tv">📺 Entretenimiento / Ocio</option>
                  <option value="ShoppingBag">🛍️ Compras / Ropa</option>
                  <option value="Zap">⚡ Servicios / Recibos</option>
                  <option value="HeartPulse">❤️ Salud / Farmacia</option>
                  <option value="Plane">✈️ Viajes / Vacaciones</option>
                  <option value="GraduationCap">🎓 Educación / Cursos</option>
                </select>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={handleCreateInlineCategory} 
                    className="btn btn-primary"
                    style={{ fontSize: '11px', padding: '6px', flex: 1 }}
                  >
                    Crear y Seleccionar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowInlineAddCategory(false);
                      setInlineCatName('');
                    }} 
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '6px', flex: 1 }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {bCategoryId !== 'all' && bCategoryId && !showInlineAddCategory && getHistoricalCategoryAverage(bCategoryId) > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '-8px', marginBottom: '10px', fontStyle: 'italic' }}>
                💡 Gasto promedio en esta categoría: {profile.currency}{getHistoricalCategoryAverage(bCategoryId).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mes. Te sugerimos establecer un presupuesto cercano.
              </div>
            )}

            <button className="btn btn-primary" onClick={handleCreateBudget}>
              {editingBudget ? 'Guardar Cambios' : 'Establecer Presupuesto'}
            </button>
          </div>
        </div>
      )}

      {/* --- QUICK EXPENSE BOTTOM SHEET MODAL --- */}
      {showQuickExpenseModal && quickExpenseBudget && (
        <div className="modal-overlay open" onClick={handleCloseQuickExpenseModal}>
          <div className="modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Gasto Rápido</h3>
              <button className="modal-close" onClick={handleCloseQuickExpenseModal}>
                <DynamicIcon name="X" size={20} />
              </button>
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '-8px' }}>
              Presupuesto: <strong>{quickExpenseBudget.name}</strong>
            </div>

            <div className="input-group">
              <label className="input-label">Monto Gastado ({profile.currency})</label>
              <input
                type="number"
                pattern="[0-9]*"
                inputMode="decimal"
                value={quickExpenseAmount}
                onChange={(e) => setQuickExpenseAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
                style={{ fontSize: '18px', fontWeight: '700' }}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Concepto / Detalle (Opcional)</label>
              <input
                type="text"
                value={quickExpenseNotes}
                onChange={(e) => setQuickExpenseNotes(e.target.value)}
                className="input-field"
                placeholder="Ej. McDonald's, Gasolina, Supermercado..."
              />
            </div>

            {quickExpenseBudget.contingencyAmount && quickExpenseBudget.contingencyAmount > 0 ? (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  backgroundColor: 'var(--color-danger-light)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '16px',
                  cursor: 'pointer'
                }}
                onClick={() => setQuickExpenseIsEmergency(!quickExpenseIsEmergency)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <DynamicIcon name="AlertOctagon" size={20} color="var(--color-danger)" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-danger)' }}>
                      ¿Es un imprevisto / emergencia?
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      Se restará del colchón de imprevistos.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={quickExpenseIsEmergency}
                  onChange={(e) => setQuickExpenseIsEmergency(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--color-danger)' }}
                />
              </div>
            ) : null}

            <div className="input-group">
              <label className="input-label">Método de Pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setQuickExpenseMethod('cash')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: quickExpenseMethod === 'cash' ? 'var(--color-primary)' : 'var(--border-color)',
                    backgroundColor: quickExpenseMethod === 'cash' ? 'var(--color-primary-light)' : 'var(--bg-input)',
                    color: quickExpenseMethod === 'cash' ? 'var(--color-primary)' : 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <DynamicIcon name="Banknote" size={16} color={quickExpenseMethod === 'cash' ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpenseMethod('card')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: quickExpenseMethod === 'card' ? 'var(--color-primary)' : 'var(--border-color)',
                    backgroundColor: quickExpenseMethod === 'card' ? 'var(--color-primary-light)' : 'var(--bg-input)',
                    color: quickExpenseMethod === 'card' ? 'var(--color-primary)' : 'var(--text-primary)',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <DynamicIcon name="CreditCard" size={16} color={quickExpenseMethod === 'card' ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                  <span>Tarjeta</span>
                </button>
              </div>
            </div>

            {quickExpenseMethod === 'cash' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: '12px'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Saldo en Efectivo disponible:</span>
                <span style={{ fontWeight: '700', color: summary.cashBalance > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {profile.currency}{summary.cashBalance.toLocaleString()}
                </span>
              </div>
            )}

            {quickExpenseMethod === 'card' && (
              <div className="input-group">
                <label className="input-label">Seleccionar Tarjeta</label>
                {activeCards.length === 0 ? (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '12px', fontSize: '12px' }}>
                    No tienes tarjetas activas registradas. Selecciona Efectivo o registra una tarjeta en la pestaña de Tarjetas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {activeCards.map(c => {
                      const isSelected = quickExpenseCardId === c.id || (!quickExpenseCardId && c.id === activeCards[0].id);
                      const isCredit = c.type === 'credit';
                      const capacity = isCredit 
                        ? Math.max(0, (c.creditLimit || 0) - (c.balanceUsed || 0))
                        : ((c.currentBalance || 0) + (c.allowOverdraft ? (c.overdraftLimit || 0) : 0));
                      const capacityLabel = isCredit ? 'Cupo disponible' : 'Saldo disponible';

                      return (
                        <div
                          key={c.id}
                          onClick={() => setQuickExpenseCardId(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                            backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.color || 'var(--color-primary)' }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {c.name} {c.lastFourDigits ? `(••${c.lastFourDigits})` : ''}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {c.bank} • <span style={{ textTransform: 'capitalize' }}>{c.type === 'credit' ? 'Crédito' : 'Débito'}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                              {profile.currency}{capacity.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {capacityLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!quickValidation.isValid && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontWeight: '700', fontSize: '12px' }}>
                  <DynamicIcon name="AlertTriangle" size={16} />
                  <span>{quickValidation.errorTitle}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {quickValidation.errorMessage}
                </div>

                {quickValidation.suggestedCards && quickValidation.suggestedCards.length > 0 && (
                  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tarjetas con capacidad suficiente:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {quickValidation.suggestedCards.map(sug => (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => {
                            setQuickExpenseMethod('card');
                            setQuickExpenseCardId(sug.id);
                          }}
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--color-primary)',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          👉 Usar {sug.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCloseQuickExpenseModal}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={!quickValidation.isValid}
                onClick={handleSaveQuickExpense}
                style={{ 
                  flex: 1,
                  opacity: !quickValidation.isValid ? 0.5 : 1,
                  cursor: !quickValidation.isValid ? 'not-allowed' : 'pointer'
                }}
              >
                Registrar Gasto
              </button>
            </div>
          </div>
        </div>
      )}
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
  badge: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-light)',
    padding: '2px 6px',
    borderRadius: '6px',
    textTransform: 'uppercase',
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
  planFooter: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '8px',
  },
};
