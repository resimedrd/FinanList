import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from '../components/DynamicIcon';
import { Budget, SavingGoal, Debt } from '../models/types';



export const BudgetView: React.FC = () => {
  const {
    budgets,
    goals,
    transactions,
    categories,
    profile,
    addBudget,
    updateBudget,
    deleteBudget,
    addGoal,
    updateGoal,
    deleteGoal,
    addTransaction,
    debts,
    addDebt,
    updateDebt,
    deleteDebt,
    addCategory,
    stealthMode,
    setStealthMode
  } = useApp();


  const [activeSegment, setActiveSegment] = useState<'budgets' | 'goals' | 'debts'>('budgets');
  
  // Modals state
  const [showAddBudget, setShowAddBudget] = useState<boolean>(false);
  const [showAddGoal, setShowAddGoal] = useState<boolean>(false);
  const [showAddDebt, setShowAddDebt] = useState<boolean>(false);

  React.useEffect(() => {
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
      if (showAddDebt) {
        setDebtPerson('');
        setDebtAmount('');
        setDebtDueDate('');
        setDebtNotes('');
        setShowAddDebt(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showAddBudget, showAddGoal, showAddDebt]);

  React.useEffect(() => {
    if (showAddBudget) {
      if (window.history.state?.modal !== 'budget') {
        window.history.pushState({ modal: 'budget', tab: 'budget' }, '', '');
      }
    }
  }, [showAddBudget]);

  React.useEffect(() => {
    if (showAddGoal) {
      if (window.history.state?.modal !== 'goal') {
        window.history.pushState({ modal: 'goal', tab: 'budget' }, '', '');
      }
    }
  }, [showAddGoal]);

  React.useEffect(() => {
    if (showAddDebt) {
      if (window.history.state?.modal !== 'debt') {
        window.history.pushState({ modal: 'debt', tab: 'budget' }, '', '');
      }
    }
  }, [showAddDebt]);

  // Account Picker state
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);
  const [accountPickerTitle, setAccountPickerTitle] = useState<string>('');
  const [accountPickerCallback, setAccountPickerCallback] = useState<((acc: string) => void) | null>(null);

  const promptAccountSelection = (title: string, callback: (acc: string) => void) => {
    setAccountPickerTitle(title);
    setAccountPickerCallback(() => callback);
    setShowAccountPicker(true);
  };

  // Quick Expense Bottom Sheet State
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState<boolean>(false);
  const [quickExpenseBudget, setQuickExpenseBudget] = useState<Budget | null>(null);
  const [quickExpenseAmount, setQuickExpenseAmount] = useState<string>('');
  const [quickExpenseNotes, setQuickExpenseNotes] = useState<string>('');
  const [quickExpenseIsEmergency, setQuickExpenseIsEmergency] = useState<boolean>(false);
  const [quickExpenseAccount, setQuickExpenseAccount] = useState<string>('Efectivo');

  // Inline Category Creation State
  const [showInlineAddCategory, setShowInlineAddCategory] = useState<boolean>(false);
  const [inlineCatName, setInlineCatName] = useState<string>('');
  const [inlineCatColor, setInlineCatColor] = useState<string>('#6366f1');
  const [inlineCatIcon, setInlineCatIcon] = useState<string>('Tag');

  // New Budget Form State
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [bAmount, setBAmount] = useState<string>('');
  const [bContingencyAmount, setBContingencyAmount] = useState<string>('');
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [bCategoryId, setBCategoryId] = useState<string>('all');
  const [bName, setBName] = useState<string>('');

  // New Goal Form State
  const [editingGoal, setEditingGoal] = useState<SavingGoal | null>(null);
  const [gName, setGName] = useState<string>('');
  const [gTarget, setGTarget] = useState<string>('');
  const [gSaved, setGSaved] = useState<string>('0');
  const [gIcon, setGIcon] = useState<string>('Target');
  const [gColor, setGColor] = useState<string>('#6366f1');
  const [gDate, setGDate] = useState<string>('');

  // New Debt Form State
  const [debtPerson, setDebtPerson] = useState<string>('');
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [debtType, setDebtType] = useState<'lent' | 'borrowed'>('borrowed');
  const [debtDueDate, setDebtDueDate] = useState<string>('');
  const [debtNotes, setDebtNotes] = useState<string>('');





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
        
        // Filter by budget period (manually resettable)
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
          // If it's a contingency transaction belonging to an active category budget, exclude it from global total to prevent double counting
          if (isContingencyTx) {
            const hasAssociatedCatBudget = Array.from(activeCategoryBudgetIds).some(catId => tx.notes?.includes(`#budget_cat:${catId}`));
            if (hasAssociatedCatBudget) return false;
          }
          return !activeCategoryBudgetIds.has(tx.categoryId) && tx.categoryId !== 'cat_saving';
        }

        return true; // monthly total
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
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
    
    // Parse optional contingency amount
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

    // Reset Form
    setBAmount('');
    setBContingencyAmount('');
    setBName('');
    setBCategoryId('all');
    setBudgetPeriod('monthly');
    setEditingBudget(null);
    setShowAddBudget(false);
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

  const handleQuickExpense = (budget: Budget) => {
    setQuickExpenseBudget(budget);
    setQuickExpenseAmount('');
    setQuickExpenseNotes('');
    setQuickExpenseIsEmergency(false);
    setQuickExpenseAccount('Efectivo');
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

    const now = new Date();
    let categoryId = quickExpenseBudget.categoryId || 'cat_extra';
    let noteText = quickExpenseNotes.trim();

    if (quickExpenseIsEmergency) {
      categoryId = 'cat_emergency';
      const tag = quickExpenseBudget.categoryId ? `#budget_cat:${quickExpenseBudget.categoryId}` : `#budget_id:${quickExpenseBudget.id}`;
      noteText = noteText ? `${noteText} #contingency ${tag}` : `Imprevisto / Emergencia #contingency ${tag}`;
    }

    const catObj = categories.find(c => c.id === categoryId);

    addTransaction({
      amount,
      type: 'expense',
      categoryId,
      account: quickExpenseAccount,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].slice(0, 5),
      notes: noteText || `Gasto en ${quickExpenseBudget.name}`,
      color: catObj?.color || 'var(--color-primary)',
      icon: catObj?.icon || 'Coins'
    });

    handleCloseQuickExpenseModal();
  };



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

    const accountOption = prompt(`¿De qué cuenta deseas aportar?\nEscribe: Efectivo, Tarjeta o Banco`, 'Banco');
    if (accountOption === null) return; // User cancelled
    const account = accountOption.trim() || 'Banco';

    const now = new Date();
    addTransaction({
      amount,
      type: 'expense',
      categoryId: 'cat_saving', // Category Ahorro
      account,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].slice(0, 5),
      notes: `Aporte a meta: ${goal.name} #goal:${goal.id}`,
      color: goal.color,
      icon: goal.icon
    });
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

  const handleDeleteGoal = (id: string) => {
    if (confirm('¿Deseas eliminar esta meta de ahorro?')) {
      deleteGoal(id);
    }
  };

  const handleCloseDebtModal = () => {
    setDebtPerson('');
    setDebtAmount('');
    setDebtDueDate('');
    setDebtNotes('');
    setShowAddDebt(false);
    if (window.history.state?.modal === 'debt') {
      window.history.back();
    }
  };

  const handleCreateDebt = () => {
    const total = parseFloat(debtAmount);
    if (isNaN(total) || total <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    if (!debtPerson.trim()) {
      alert('Por favor, ingresa el nombre de la persona o institución.');
      return;
    }

    if (debtType === 'borrowed') {
      // Yo Debo (Borrowed): Do not register any initial transaction (won't affect cash balance until paid)
      addDebt({
        personOrInstitution: debtPerson.trim(),
        amount: total,
        remainingAmount: total,
        type: debtType,
        dueDate: debtDueDate || undefined,
        notes: debtNotes.trim() || undefined
      });
      handleCloseDebtModal();
    } else {
      // Me Deben (Lent): Registers an initial expense transaction since cash left our wallet
      promptAccountSelection(`Cuenta para registrar la salida de dinero`, (account) => {
        addDebt({
          personOrInstitution: debtPerson.trim(),
          amount: total,
          remainingAmount: total,
          type: debtType,
          dueDate: debtDueDate || undefined,
          notes: debtNotes.trim() || undefined
        });

        const now = new Date();
        addTransaction({
          amount: total,
          type: 'expense',
          categoryId: 'cat_saving',
          account,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0].slice(0, 5),
          notes: `Préstamo realizado a: ${debtPerson.trim()}`,
          color: 'var(--color-danger)',
          icon: 'TrendingDown'
        });

        handleCloseDebtModal();
      });
    }
  };

  const handleAbonarDebt = (debt: Debt) => {
    const amountStr = prompt(`¿Cuánto deseas abonar a la deuda de "${debt.personOrInstitution}"? (Restante: ${profile.currency}${debt.remainingAmount.toLocaleString()})`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    promptAccountSelection(`Cuenta para realizar el abono`, (account) => {
      const newRemaining = Math.max(0, debt.remainingAmount - amount);
      if (newRemaining === 0) {
        deleteDebt(debt.id);
        alert('🎉 ¡Deuda totalmente saldada y eliminada!');
      } else {
        updateDebt({
          ...debt,
          remainingAmount: newRemaining
        });
      }

      const now = new Date();
      addTransaction({
        amount,
        type: debt.type === 'borrowed' ? 'expense' : 'income',
        categoryId: debt.type === 'borrowed' ? 'cat_saving' : 'cat_extra',
        account,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `${debt.type === 'borrowed' ? 'Abono a deuda' : 'Cobro de préstamo'}: ${debt.personOrInstitution}`,
        color: debt.type === 'borrowed' ? 'var(--color-danger)' : 'var(--color-success)',
        icon: debt.type === 'borrowed' ? 'TrendingDown' : 'Coins'
      });
    });
  };

  const handleDeleteDebt = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de deuda?')) {
      deleteDebt(id);
    }
  };

  const handlePayDebtInFull = (debt: Debt) => {
    const confirmPay = confirm(`¿Estás seguro de que deseas liquidar esta deuda de ${profile.currency}${debt.remainingAmount.toLocaleString()}?`);
    if (!confirmPay) return;
    
    promptAccountSelection(`¿Con qué cuenta deseas pagar?`, (account) => {
      const now = new Date();
      addTransaction({
        amount: debt.remainingAmount,
        type: 'expense',
        categoryId: 'cat_extra',
        account,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `Liquidación de deuda con ${debt.personOrInstitution}`,
        color: '#ef4444',
        icon: 'ArrowUpRight'
      });
      
      deleteDebt(debt.id);
      alert('Deuda liquidada y eliminada con éxito.');
    });
  };

  const handleCollectDebtInFull = (debt: Debt) => {
    const confirmCollect = confirm(`¿Estás seguro de que deseas marcar como cobrado este préstamo de ${profile.currency}${debt.remainingAmount.toLocaleString()}?`);
    if (!confirmCollect) return;
    
    promptAccountSelection(`¿En qué cuenta recibiste el pago?`, (account) => {
      const now = new Date();
      addTransaction({
        amount: debt.remainingAmount,
        type: 'income',
        categoryId: 'cat_sal',
        account,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `Retorno de préstamo de ${debt.personOrInstitution}`,
        color: '#22c55e',
        icon: 'ArrowDownLeft'
      });
      
      deleteDebt(debt.id);
      alert('Préstamo cobrado y eliminado con éxito.');
    });
  };


  // Helper date remaining
  // Helper to determine budget velocity status (semáforo)
  const getBudgetVelocityColor = (spent: number, limit: number): string => {
    if (spent > limit) return 'var(--color-danger)';
    
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const elapsedRatio = currentDay / daysInMonth;
    const spentRatio = spent / limit;
    
    // If spent ratio is 15% ahead of current day ratio in the month
    if (spentRatio > elapsedRatio + 0.15) {
      return 'var(--color-danger)'; // Critical (Red)
    }
    if (spentRatio > elapsedRatio) {
      return 'var(--color-warning)'; // Warning (Amber)
    }
    return 'var(--color-success)'; // Healthy (Green)
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


  const totalBudgetLimit = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalBudgetSpent = budgets.reduce((sum, b) => sum + getBudgetSpent(b, 'regular'), 0);
  const totalContingencyLimit = budgets.reduce((sum, b) => sum + (b.contingencyAmount || 0), 0);
  const totalContingencySpent = budgets.reduce((sum, b) => sum + (b.contingencyAmount ? getBudgetSpent(b, 'contingency') : 0), 0);


  return (
    <>
      <div className="view-content animate-fade-in">
      <div style={styles.header}>
        <h2>Planificación</h2>
        <button
          onClick={() => setStealthMode(!stealthMode)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px'
          }}
          title={stealthMode ? 'Mostrar montos' : 'Ocultar montos'}
        >
          <DynamicIcon name={stealthMode ? 'EyeOff' : 'Eye'} size={20} />
        </button>
      </div>


      {/* Selector segment */}
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
      </div>

      {/* --- BUDGETS SEGMENT --- */}
      {activeSegment === 'budgets' && (
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
                        <h3 style={{ ...styles.planTitle, fontSize: '15px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.name}>{b.name}</h3>
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
        </div>
      )}

      {/* --- SAVINGS GOALS SEGMENT --- */}
      {activeSegment === 'goals' && (
        <div style={styles.listContainer}>
          <button className="btn btn-secondary" onClick={() => setShowAddGoal(true)} style={styles.addBtn}>
            <DynamicIcon name="Plus" size={16} />
            <span>Nueva Meta de Ahorro</span>
          </button>

          {goals.length > 0 ? (
            <div style={styles.grid}>
              {goals.map(g => {
                const percent = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
                const isCompleted = g.currentAmount >= g.targetAmount;

                // Monthly saving calculator
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
                        <button onClick={() => handleEditGoal(g)} style={styles.deleteBtn}>
                          <DynamicIcon name="Pencil" size={16} color="var(--text-muted)" />
                        </button>
                        <button onClick={() => handleDeleteGoal(g.id)} style={styles.deleteBtn}>
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
        </div>
      )}

      {/* --- DEBTS SEGMENT --- */}
      {activeSegment === 'debts' && (
        <div style={styles.listContainer}>
          <button className="btn btn-secondary" onClick={() => setShowAddDebt(true)} style={styles.addBtn}>
            <DynamicIcon name="Plus" size={16} />
            <span>Registrar Deuda / Préstamo</span>
          </button>

          {debts.length > 0 ? (
            <div style={styles.grid}>
              {debts.map(d => {
                const paid = d.amount - d.remainingAmount;
                const percent = Math.min(100, (paid / d.amount) * 100);
                const isCompleted = d.remainingAmount <= 0;
                const isBorrowed = d.type === 'borrowed';

                return (
                  <div key={d.id} className="card" style={styles.planCard}>
                    <div style={styles.planHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          ...styles.iconCircle, 
                          backgroundColor: isBorrowed ? 'var(--color-danger-light)' : 'var(--color-success-light)'
                        }}>
                          <DynamicIcon 
                            name={isBorrowed ? 'ArrowUpRight' : 'ArrowDownLeft'} 
                            size={18} 
                            color={isBorrowed ? 'var(--color-danger)' : 'var(--color-success)'} 
                          />
                        </div>
                        <div>
                          <h3 style={styles.planTitle}>{d.personOrInstitution}</h3>
                          <span style={styles.timeRemaining}>
                            {isBorrowed ? 'Yo debo (Deuda)' : 'Me deben (Préstamo)'}
                            {d.dueDate && ` • Límite: ${d.dueDate}`}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteDebt(d.id)} style={styles.deleteBtn}>
                        <DynamicIcon name="Trash2" size={16} color="var(--text-muted)" />
                      </button>
                    </div>

                    <div style={styles.progressRow}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Restante: {profile.currency}{d.remainingAmount.toLocaleString()} / {profile.currency}{d.amount.toLocaleString()}
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
                          backgroundColor: isCompleted ? 'var(--color-success)' : isBorrowed ? 'var(--color-danger)' : 'var(--color-success)'
                        }}
                      />
                    </div>

                    {d.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0 2px' }}>
                        Nota: {d.notes}
                      </div>
                    )}

                    <div style={{ ...styles.planFooterGoal, display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                      {isCompleted ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🎉 {isBorrowed ? 'Liquidada' : 'Cobrado'}
                        </span>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleAbonarDebt(d)}
                            style={{ ...styles.contributeBtn, padding: '4px 8px', fontSize: '11px', height: '28px' }}
                          >
                            Abonar
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => isBorrowed ? handlePayDebtInFull(d) : handleCollectDebtInFull(d)}
                            style={{ padding: '4px 8px', fontSize: '11px', height: '28px', backgroundColor: isBorrowed ? 'var(--color-danger)' : 'var(--color-success)', borderColor: isBorrowed ? 'var(--color-danger)' : 'var(--color-success)', color: 'white' }}
                          >
                            {isBorrowed ? 'Pagar' : 'Cobrar'}
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state card">
              <DynamicIcon name="Coins" size={32} className="empty-state-icon" />
              <p>No tienes deudas ni préstamos activos registrados.</p>
              <p className="empty-state-quote">"El que paga lo que debe, sana su paz mental."</p>
            </div>
          )}
        </div>
      )}

      </div>

      {/* --- ADD DEBT MODAL SHEET --- */}
      {showAddDebt && (
        <div className="modal-overlay open" onClick={handleCloseDebtModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Deuda / Préstamo</h2>
              <button className="btn-ghost" onClick={handleCloseDebtModal}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Tipo de Registro</label>
              <div style={styles.segmentControl}>
                <button
                  type="button"
                  onClick={() => setDebtType('borrowed')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: debtType === 'borrowed' ? 'var(--bg-phone)' : 'transparent',
                    color: debtType === 'borrowed' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: debtType === 'borrowed' ? '700' : '500',
                  }}
                >
                  Yo Debo (Deuda)
                </button>
                <button
                  type="button"
                  onClick={() => setDebtType('lent')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: debtType === 'lent' ? 'var(--bg-phone)' : 'transparent',
                    color: debtType === 'lent' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: debtType === 'lent' ? '700' : '500',
                  }}
                >
                  Me Deben (Préstamo)
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Persona / Institución</label>
              <input
                type="text"
                placeholder="Ej. Banco Popular, Juan Pérez"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', marginTop: '-8px' }}>
              {['💳 Tarjeta de Crédito', '🏢 Banco (Préstamo)', '👥 Préstamo Familiar', '🤝 Amigo'].map(sug => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setDebtPerson(sug.substring(3))}
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
                  {sug}
                </button>
              ))}
            </div>


            <div className="input-group">
              <label className="input-label">Monto Total</label>
              <input
                type="number"
                placeholder="Ej. 5000"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Fecha Límite (Opcional)</label>
              <input
                type="date"
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Notas</label>
              <input
                type="text"
                placeholder="Detalles adicionales"
                value={debtNotes}
                onChange={(e) => setDebtNotes(e.target.value)}
                className="input-field"
              />
            </div>

            <button className="btn btn-primary" onClick={handleCreateDebt} style={{ marginTop: '10px' }}>
              Registrar
            </button>
          </div>
        </div>
      )}

      {/* --- ADD BUDGET MODAL SHEET --- */}
      {showAddBudget && (
        <div className="modal-overlay open" onClick={handleCloseBudgetModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h2>
              <button className="btn-ghost" onClick={handleCloseBudgetModal}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
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

      {/* --- ADD SAVING GOAL MODAL SHEET --- */}
      {showAddGoal && (
        <div className="modal-overlay open" onClick={handleCloseGoalModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGoal ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}</h2>
              <button className="btn-ghost" onClick={handleCloseGoalModal}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
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

      {/* --- CUSTOM ACCOUNT PICKER SHEET --- */}
      {showAccountPicker && (
        <div className="modal-overlay open" onClick={() => setShowAccountPicker(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: '30px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{accountPickerTitle}</h3>
              <button className="btn-ghost" onClick={() => setShowAccountPicker(false)}>
                <DynamicIcon name="X" size={20} color="var(--text-secondary)" />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              {[
                { name: 'Efectivo', icon: 'Banknote' },
                { name: 'Tarjeta', icon: 'CreditCard' },
                { name: 'Banco', icon: 'Building2' },
                { name: 'Broker', icon: 'TrendingUp' }
              ].map(acc => (
                <button
                  key={acc.name}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (accountPickerCallback) {
                      accountPickerCallback(acc.name);
                    }
                    setShowAccountPicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '14px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '12px'
                  }}
                >
                  <DynamicIcon 
                    name={acc.icon} 
                    size={18} 
                    color="var(--color-primary)" 
                  />
                  <span>{acc.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QUICK EXPENSE BOTTOM SHEET MODAL */}
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

            {/* Emergency Toggle (Only if budget has a contingency amount) */}
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

            {/* Account Selector segmented cards */}
            <div className="input-group">
              <label className="input-label">Cuenta de Pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                {[
                  { name: 'Efectivo', icon: 'Banknote' },
                  { name: 'Tarjeta', icon: 'CreditCard' },
                  { name: 'Banco', icon: 'Building2' },
                  { name: 'Broker', icon: 'TrendingUp' }
                ].map(acc => (
                  <button
                    key={acc.name}
                    type="button"
                    onClick={() => setQuickExpenseAccount(acc.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: quickExpenseAccount === acc.name ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: quickExpenseAccount === acc.name ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: quickExpenseAccount === acc.name ? 'var(--color-primary)' : 'var(--text-primary)',
                      fontWeight: '600',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <DynamicIcon 
                      name={acc.icon} 
                      size={16} 
                      color={quickExpenseAccount === acc.name ? 'var(--color-primary)' : 'var(--text-secondary)'} 
                    />
                    <span>{acc.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
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
                onClick={handleSaveQuickExpense}
                style={{ flex: 1 }}
              >
                Registrar Gasto
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
export default BudgetView;
