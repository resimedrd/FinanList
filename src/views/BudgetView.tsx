import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from '../components/DynamicIcon';
import { Budget, SavingGoal, Debt, PaymentMethod } from '../models/types';
import { FinancialEngine } from '../services/FinancialEngine';
import { StatsService } from '../services/StatsService';
import { Modal } from '../components/Modal';
import { TransferReceiptModal, TransferReceiptData } from '../components/TransferReceiptModal';

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
    setStealthMode,
    cards
  } = useApp();


  const [activeSegment, setActiveSegment] = useState<'budgets' | 'goals' | 'debts' | 'investments'>('budgets');

  // Calculate total savings allocated this month
  const getMonthlySavingsAllocated = () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return transactions
      .filter(tx => tx.type === 'expense' && tx.categoryId === 'cat_saving' && tx.date.substring(0, 7) === currentYM)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };
  const monthlySavingsAllocated = getMonthlySavingsAllocated();
  
  // Calculate investments portfolio metrics
  const getInvestmentMetrics = () => {
    let currentVal = 0;
    
    // Calculate current value (deposits + yields - withdrawals in Inversiones account)
    transactions.forEach(tx => {
      const acc = tx.account ? tx.account.trim().toLowerCase() : '';
      if (acc.includes('broker') || acc.includes('inversiones')) {
        const amt = tx.amount;
        if (tx.type === 'income') {
          currentVal += amt;
        } else {
          currentVal -= amt;
        }
      }
    });

    // Calculate invested capital (expenses from liquid cash with category cat_inv)
    const capitalAportado = transactions
      .filter(tx => tx.type === 'expense' && 
                    tx.categoryId === 'cat_inv' && 
                    !(tx.account ? tx.account.trim().toLowerCase() : '').includes('broker') &&
                    !(tx.account ? tx.account.trim().toLowerCase() : '').includes('inversiones'))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const yieldNeto = currentVal - capitalAportado;
    const yieldPct = capitalAportado > 0 ? (yieldNeto / capitalAportado) * 100 : 0;

    return { currentVal, capitalAportado, yieldNeto, yieldPct };
  };
  const { currentVal: invCurrentVal, capitalAportado: invCapitalAportado, yieldNeto: invYieldNeto, yieldPct: invYieldPct } = getInvestmentMetrics();

  // Get all investment-related transactions
  const investmentTransactions = React.useMemo(() => {
    return transactions.filter(tx => {
      const acc = tx.account ? tx.account.trim().toLowerCase() : '';
      const isInvAcc = acc.includes('broker') || acc.includes('inversiones');
      const isInvCat = tx.categoryId === 'cat_inv';
      return isInvAcc || isInvCat;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [transactions]);
  
  // Modals state
  const [showAddBudget, setShowAddBudget] = useState<boolean>(false);
  const [showAddGoal, setShowAddGoal] = useState<boolean>(false);
  const [showAddDebt, setShowAddDebt] = useState<boolean>(false);

  // Investment Registration Modal State
  const [showAddInvestmentMove, setShowAddInvestmentMove] = useState<boolean>(false);
  const [invMoveType, setInvMoveType] = useState<'deposit' | 'yield' | 'withdrawal'>('deposit');
  const [invAmount, setInvAmount] = useState<string>('');
  const [invSourceMethod, setInvSourceMethod] = useState<PaymentMethod>('cash');
  const [invCardId, setInvCardId] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().split('T')[0]);

  React.useEffect(() => {
    if (showAddInvestmentMove) {
      if (window.history.state?.modal !== 'investment') {
        window.history.pushState({ modal: 'investment', tab: 'budget' }, '', '');
      }
    }
  }, [showAddInvestmentMove]);

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
        setDebtLinkedCardId('');
        setShowAddDebt(false);
      }
      if (showAddInvestmentMove) {
        setInvAmount('');
        setInvNotes('');
        setInvMoveType('deposit');
        setInvSourceMethod('cash');
        setInvCardId('');
        setShowAddInvestmentMove(false);
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

  // Decoupled Financial Summary & Active Cards
  const summary = StatsService.getSummary(transactions, budgets, cards, undefined, debts, goals);
  const activeCards = cards.filter(c => c.isActive);

  // Account Picker state
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);
  const [accountPickerTitle, setAccountPickerTitle] = useState<string>('');
  const [accountPickerCallback, setAccountPickerCallback] = useState<((acc: string, cardId?: string, method?: PaymentMethod) => void) | null>(null);

  const promptAccountSelection = (title: string, callback: (acc: string, cardId?: string, method?: PaymentMethod) => void) => {
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

  // Real-time investment allocation validation
  const invAmountNum = parseFloat(invAmount) || 0;
  const invSelectedCard = invSourceMethod === 'card'
    ? (activeCards.find(c => c.id === invCardId) || activeCards[0])
    : undefined;
  const invValidation = invMoveType === 'deposit'
    ? FinancialEngine.validateInvestmentAllocation(
        invAmountNum,
        invSourceMethod,
        invSelectedCard,
        summary,
        activeCards
      )
    : { isValid: true };

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
  const [debtLinkedCardId, setDebtLinkedCardId] = useState<string>('');

  // Abonar Debt Modal State
  const [abonarDebtTarget, setAbonarDebtTarget] = useState<Debt | null>(null);
  const [abonarAmount, setAbonarAmount] = useState<string>('');
  const [abonarError, setAbonarError] = useState<string | null>(null);
  const [abonarMethod, setAbonarMethod] = useState<PaymentMethod>('cash');
  const [abonarCardId, setAbonarCardId] = useState<string>('');
  const [receiptData, setReceiptData] = useState<TransferReceiptData | null>(null);





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

    promptAccountSelection(`Origen de fondos para "${goal.name}"`, (account, cardId, paymentMethod) => {
      const selectedCard = cardId ? cards.find(c => c.id === cardId) : undefined;
      const validation = FinancialEngine.validateTransaction(amount, paymentMethod || 'cash', selectedCard, summary, activeCards);
      if (!validation.isValid) {
        alert(`${validation.errorTitle}: ${validation.errorMessage}`);
        return;
      }

      const now = new Date();
      addTransaction({
        amount,
        type: 'expense',
        categoryId: 'cat_saving', // Category Ahorro
        paymentMethod: paymentMethod || (cardId ? 'card' : 'cash'),
        account,
        cardId,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `Aporte a meta: ${goal.name} #goal:${goal.id}`,
        color: goal.color,
        icon: goal.icon
      });
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

  const handleCloseInvestmentModal = () => {
    setInvAmount('');
    setInvNotes('');
    setInvMoveType('deposit');
    setInvDate(new Date().toISOString().split('T')[0]);
    setShowAddInvestmentMove(false);
    if (window.history.state?.modal === 'investment') {
      window.history.back();
    }
  };

  const handleSaveInvestmentMove = () => {
    const amt = parseFloat(invAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Por favor introduce un monto válido.');
      return;
    }

    if (invMoveType === 'deposit' && !invValidation.isValid) {
      alert(`${invValidation.errorTitle}: ${invValidation.errorMessage}`);
      return;
    }

    const baseNotes = invNotes.trim();
    const resolvedCardId = invSourceMethod === 'card' ? invSelectedCard?.id : undefined;
    const resolvedAccount = invSourceMethod === 'card' ? (invSelectedCard?.name || 'Tarjeta') : 'Efectivo';

    if (invMoveType === 'deposit') {
      // 1. Double entry: expense on liquid origin (cash or specific card)
      addTransaction({
        amount: amt,
        type: 'expense',
        categoryId: 'cat_inv',
        paymentMethod: invSourceMethod,
        account: resolvedAccount,
        cardId: resolvedCardId,
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes || 'Aportación a Inversiones',
        tags: ['inversion', 'aportacion'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });

      // 2. Income on Inversiones portfolio
      addTransaction({
        amount: amt,
        type: 'income',
        categoryId: 'cat_inv',
        account: 'Inversiones',
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes ? `[Aportación] ${baseNotes}` : 'Aportación Recibida',
        tags: ['inversion', 'portafolio'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });
    } else if (invMoveType === 'yield') {
      // Single entry: income on Inversiones account
      addTransaction({
        amount: amt,
        type: 'income',
        categoryId: 'cat_inv',
        account: 'Inversiones',
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes || 'Rendimiento de Inversiones',
        tags: ['inversion', 'rendimiento'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });
    } else if (invMoveType === 'withdrawal') {
      // Double entry: income on liquid destination, expense on Inversiones account
      addTransaction({
        amount: amt,
        type: 'income',
        categoryId: 'cat_inv',
        paymentMethod: invSourceMethod,
        account: resolvedAccount,
        cardId: resolvedCardId,
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes ? `[Retiro] ${baseNotes}` : 'Retiro de Inversiones',
        tags: ['inversion', 'retiro'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });

      addTransaction({
        amount: amt,
        type: 'expense',
        categoryId: 'cat_inv',
        account: 'Inversiones',
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes || 'Retiro de Inversiones',
        tags: ['inversion', 'portafolio'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });
    }

    // Reset & close
    setInvAmount('');
    setInvNotes('');
    setInvMoveType('deposit');
    setInvSourceMethod('cash');
    setInvCardId('');
    setInvDate(new Date().toISOString().split('T')[0]);
    setShowAddInvestmentMove(false);
    if (window.history.state?.modal === 'investment') {
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
        notes: debtNotes.trim() || undefined,
        linkedCardId: debtLinkedCardId || undefined
      });
      handleCloseDebtModal();
    } else {
      // Me Deben (Lent): Registers an initial expense transaction since cash left our wallet
      promptAccountSelection(`Cuenta para registrar la salida de dinero`, (account, cardId, paymentMethod) => {
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
          paymentMethod: paymentMethod || (cardId ? 'card' : 'cash'),
          account,
          cardId,
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
    setAbonarDebtTarget(debt);
    setAbonarAmount('');
    setAbonarError(null);
    setAbonarMethod('cash');
    setAbonarCardId('');
  };

  const handleConfirmAbonar = () => {
    if (!abonarDebtTarget) return;
    const amount = parseFloat(abonarAmount);
    if (isNaN(amount) || amount <= 0) {
      setAbonarError('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }
    if (amount > abonarDebtTarget.remainingAmount) {
      setAbonarError(`El monto no puede exceder el restante (${profile.currency} ${abonarDebtTarget.remainingAmount.toLocaleString()}).`);
      return;
    }

    const availableCash = FinancialEngine.getAvailableLiquidCash(transactions, cards);
    const sourceCard = abonarMethod === 'card' ? cards.find(c => c.id === abonarCardId) : undefined;
    const currentSourceFunds = sourceCard ? (sourceCard.currentBalance ?? 0) : availableCash;

    if (amount > currentSourceFunds) {
      const sourceLabel = sourceCard ? sourceCard.name : 'Efectivo';
      setAbonarError(`Saldo insuficiente en ${sourceLabel}. Tienes ${profile.currency} ${currentSourceFunds.toLocaleString()} disponible.`);
      return;
    }

    const { newRemaining, isFullyPaid, linkedCardId } = FinancialEngine.calculateDebtPaymentImpact(abonarDebtTarget, amount);
    if (isFullyPaid) {
      deleteDebt(abonarDebtTarget.id);
    } else {
      updateDebt({
        ...abonarDebtTarget,
        remainingAmount: newRemaining
      });
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
    const isLinkedCard = !!linkedCardId;
    const targetCard = isLinkedCard ? cards.find(c => c.id === linkedCardId) : undefined;

    addTransaction({
      amount,
      type: isLinkedCard ? 'payment' : (abonarDebtTarget.type === 'borrowed' ? 'expense' : 'income'),
      destinationCardId: isLinkedCard ? linkedCardId : undefined,
      categoryId: abonarDebtTarget.type === 'borrowed' ? 'cat_bills' : 'cat_extra',
      paymentMethod: abonarMethod,
      account: sourceCard ? sourceCard.name : 'Efectivo',
      cardId: sourceCard ? sourceCard.id : undefined,
      date: dateStr,
      time: timeStr,
      notes: `${abonarDebtTarget.type === 'borrowed' ? 'Abono a deuda' : 'Cobro de préstamo'}: ${abonarDebtTarget.personOrInstitution}`,
      color: abonarDebtTarget.type === 'borrowed' ? 'var(--color-danger)' : 'var(--color-success)',
      icon: abonarDebtTarget.type === 'borrowed' ? 'TrendingDown' : 'Coins'
    });

    const targetDebt = abonarDebtTarget;
    setAbonarDebtTarget(null);

    // Show digital receipt
    setReceiptData({
      referenceId: `ABN-${Date.now().toString().slice(-6)}`,
      amount,
      currency: profile.currency,
      sourceName: sourceCard ? `${sourceCard.name} (${sourceCard.bank})` : 'Efectivo disponible',
      destinationName: targetCard ? `${targetCard.name} (Cupo liberado)` : targetDebt.personOrInstitution,
      date: dateStr,
      time: timeStr,
      title: isFullyPaid ? '¡Deuda Totalmente Saldada!' : '¡Abono Registrado con Éxito!',
      subtitle: isFullyPaid ? 'Pasivo Cancelado' : `Restante: ${profile.currency} ${newRemaining.toLocaleString()}`,
      notes: `Abono a ${targetDebt.personOrInstitution}`,
      availableRestored: isLinkedCard ? amount : undefined
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
    
    promptAccountSelection(`¿Con qué medio deseas pagar?`, (account, cardId, paymentMethod) => {
      const now = new Date();
      const isLinkedCard = !!debt.linkedCardId;
      addTransaction({
        amount: debt.remainingAmount,
        type: isLinkedCard ? 'payment' : 'expense',
        destinationCardId: isLinkedCard ? debt.linkedCardId : undefined,
        categoryId: 'cat_extra',
        paymentMethod: paymentMethod || (cardId ? 'card' : 'cash'),
        account,
        cardId,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `Liquidación de deuda con ${debt.personOrInstitution}`,
        color: '#ef4444',
        icon: 'ArrowUpRight'
      });
      
      deleteDebt(debt.id);
      setReceiptData({
        referenceId: `LIQ-${Date.now().toString().slice(-6)}`,
        amount: debt.remainingAmount,
        currency: profile.currency,
        sourceName: cardId ? (cards.find(c => c.id === cardId)?.name || account) : 'Efectivo disponible',
        destinationName: isLinkedCard ? (cards.find(c => c.id === debt.linkedCardId)?.name || 'Tarjeta vinculada') : debt.personOrInstitution,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        title: '¡Deuda Totalmente Liquidada!',
        subtitle: 'Pasivo Eliminado',
        notes: `Liquidación total con ${debt.personOrInstitution}`,
        availableRestored: isLinkedCard ? debt.remainingAmount : undefined
      });
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
      setReceiptData({
        referenceId: `COB-${Date.now().toString().slice(-6)}`,
        amount: debt.remainingAmount,
        currency: profile.currency,
        sourceName: debt.personOrInstitution,
        destinationName: account,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        title: '¡Préstamo Cobrado con Éxito!',
        subtitle: 'Monto Reincorporado a Fondos',
        notes: `Cobro de préstamo de ${debt.personOrInstitution}`
      });
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
    <div className="view-screen animate-fade-in">
      {/* Fixed View Header */}
      <div className="view-header">
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
          {/* Card Resumen de Ahorros del Mes */}
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

      {activeSegment === 'investments' && (
        <div style={styles.listContainer}>
          {/* Action button to open transaction modal */}
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowAddInvestmentMove(true)} 
            style={styles.addBtn}
          >
            <DynamicIcon name="Plus" size={16} />
            <span>Registrar Movimiento de Inversión</span>
          </button>

          {/* Investment KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Valor del Portafolio</span>
              <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
                {stealthMode ? '••••' : `${profile.currency}${invCurrentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h2>
            </div>
            
            <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Capital Aportado</span>
              <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
                {stealthMode ? '••••' : `${profile.currency}${invCapitalAportado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h2>
            </div>
          </div>

          {/* Yield Yield Card */}
          <div className="card" style={{ 
            padding: '12px 16px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderLeft: '4px solid ' + (invYieldNeto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'),
            marginBottom: '16px'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Rendimiento Neto</span>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '800', 
                fontFamily: 'var(--font-display)', 
                margin: '2px 0 0 0',
                color: invYieldNeto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {invYieldNeto >= 0 ? '+' : ''}{stealthMode ? '••••' : `${profile.currency}${invYieldNeto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h3>
            </div>
            <div style={{ 
              backgroundColor: invYieldNeto >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              padding: '6px 12px',
              borderRadius: '8px',
              color: invYieldNeto >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              fontWeight: '800',
              fontSize: '14px'
            }}>
              {invYieldNeto >= 0 ? '+' : ''}{invYieldPct.toFixed(1)}%
            </div>
          </div>

          {/* Investment Instructions Card */}
          <div className="card" style={{ 
            backgroundColor: 'var(--bg-input)', 
            border: '1px solid var(--border-color)', 
            padding: '12px', 
            borderRadius: '12px', 
            marginBottom: '16px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: '1.4'
          }}>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <DynamicIcon name="Lightbulb" size={14} color="var(--color-primary)" />
              <span>¿Cómo funciona el registro de Inversiones?</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><b>Aportar Capital:</b> Registra un Gasto desde tu liquidez disponible (ej: Efectivo o Tarjeta) con categoría <i>Inversiones</i>. Esto reduce tu saldo líquido general.</li>
              <li><b>Registrar Ganancia/Rendimiento:</b> Registra un Ingreso con cuenta <i>Inversiones</i> y categoría <i>Inversiones</i>. Esto aumenta el valor de tu inversión sin afectar tu saldo líquido de Inicio.</li>
              <li><b>Retirar Fondos:</b> Registra un Ingreso en tu cuenta líquida (ej: Efectivo o Tarjeta) y un Gasto de igual monto en la cuenta <i>Inversiones</i>.</li>
            </ul>
          </div>

          {/* Exclusive Investment Ledger */}
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Historial de Inversiones
          </h3>
          {investmentTransactions.length > 0 ? (
            <div className="tx-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {investmentTransactions.map((tx) => {
                const isInvAcc = (tx.account || '').trim().toLowerCase().includes('inversiones');
                const isIncome = tx.type === 'income';
                
                // Determine transaction context label
                let typeLabel = '';
                if (isInvAcc && isIncome) typeLabel = 'Rendimiento';
                else if (isInvAcc && !isIncome) typeLabel = 'Retiro / Pérdida';
                else if (!isInvAcc && !isIncome) typeLabel = 'Aportación';
                else typeLabel = 'Movimiento';

                return (
                  <div key={tx.id} className="card" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '8px', 
                        backgroundColor: isIncome ? 'rgba(34, 197, 94, 0.12)' : 'rgba(139, 92, 246, 0.12)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <DynamicIcon 
                          name={isIncome ? 'TrendingUp' : 'ArrowRight'} 
                          size={16} 
                          color={isIncome ? 'var(--color-success)' : 'var(--color-primary)'} 
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {tx.notes || typeLabel}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {tx.account} • {tx.date}
                        </span>
                      </div>
                    </div>
                    <span style={{ 
                      fontWeight: '700', 
                      fontSize: '13px', 
                      color: isIncome ? 'var(--color-success)' : 'var(--text-primary)' 
                    }}>
                      {isIncome ? '+' : '-'}{profile.currency}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ marginBottom: '8px' }}>
                <DynamicIcon name="TrendingUp" size={24} color="var(--text-muted)" />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                Aún no has registrado movimientos de inversión.
              </p>
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
              <button className="btn-ghost" onClick={handleCloseDebtModal} aria-label="Cerrar" title="Cerrar">
                <DynamicIcon name="X" size={20} color="var(--text-primary)" />
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
                placeholder="Ej. Juan Pérez, Préstamo de Auto, Hipoteca"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', marginTop: '-8px' }}>
              {['💳 Tarjeta de Crédito', '🏢 Entidad Financiera', '👥 Préstamo Familiar', '🤝 Amigo'].map(sug => (
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

            {debtType === 'borrowed' && (
              <div className="input-group">
                <label className="input-label">Vincular a Tarjeta de Crédito (Opcional)</label>
                <select
                  value={debtLinkedCardId}
                  onChange={(e) => setDebtLinkedCardId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Ninguna (Deuda Externa / Persona)</option>
                  {cards.filter(c => c.type === 'credit' && c.isActive).map(c => (
                    <option key={c.id} value={c.id}>
                      💳 {c.name} ({c.bank}) - Cupo usado: {profile.currency}{(c.balanceUsed || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Al abonar o liquidar esta deuda, se liberará automáticamente el cupo de la tarjeta vinculada sin generar duplicados.
                </span>
              </div>
            )}

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

      {/* --- ADD SAVING GOAL MODAL SHEET --- */}
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

      {/* --- CUSTOM ACCOUNT PICKER SHEET --- */}
      {showAccountPicker && (
        <div className="modal-overlay open" onClick={() => setShowAccountPicker(false)}>
          <div className="modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{accountPickerTitle}</h3>
              <button className="btn-ghost" onClick={() => setShowAccountPicker(false)}>
                <DynamicIcon name="X" size={20} color="var(--text-secondary)" />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px', maxHeight: '320px', overflowY: 'auto' }}>
              {/* Option 1: Efectivo */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (accountPickerCallback) {
                    accountPickerCallback('Efectivo', undefined, 'cash');
                  }
                  setShowAccountPicker(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <DynamicIcon name="Banknote" size={18} color="var(--color-success)" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Efectivo</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Caja y liquidez directa</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: summary.cashBalance > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                    {profile.currency}{summary.cashBalance.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Disponible</div>
                </div>
              </button>

              {/* Option 2: Active Cards */}
              {activeCards.map(c => {
                const isCredit = c.type === 'credit';
                const capacity = isCredit
                  ? Math.max(0, (c.creditLimit || 0) - (c.balanceUsed || 0))
                  : ((c.currentBalance || 0) + (c.allowOverdraft ? (c.overdraftLimit || 0) : 0));
                const capacityLabel = isCredit ? 'Cupo disponible' : 'Saldo disponible';

                return (
                  <button
                    key={c.id}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (accountPickerCallback) {
                        accountPickerCallback(c.name, c.id, 'card');
                      }
                      setShowAccountPicker(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: `${c.color || 'var(--color-primary)'}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <DynamicIcon name="CreditCard" size={18} color={c.color || 'var(--color-primary)'} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {c.name} {c.lastFourDigits ? `(••${c.lastFourDigits})` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {c.bank} • <span style={{ textTransform: 'capitalize' }}>{isCredit ? 'Crédito' : 'Débito'}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {profile.currency}{capacity.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{capacityLabel}</div>
                    </div>
                  </button>
                );
              })}
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

            {/* Payment Method Selector */}
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

            {/* If Cash: display current cash balance */}
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

            {/* If Card: dynamic card selector with limits */}
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

            {/* Inline validation error & alternative card recommendations */}
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

      {/* --- ADD INVESTMENT MOVE MODAL SHEET --- */}
      {showAddInvestmentMove && (
        <div className="modal-overlay open" onClick={handleCloseInvestmentModal}>
          <div className="modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Movimiento</h2>
              <button className="modal-close" onClick={handleCloseInvestmentModal}>
                <DynamicIcon name="X" size={20} />
              </button>
            </div>

            {/* Move type segmented selector */}
            <div className="input-group">
              <label className="input-label">Tipo de Movimiento</label>
              <div style={styles.segmentControl}>
                <button
                  type="button"
                  onClick={() => setInvMoveType('deposit')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: invMoveType === 'deposit' ? 'var(--bg-phone)' : 'transparent',
                    color: invMoveType === 'deposit' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: invMoveType === 'deposit' ? '700' : '500',
                  }}
                >
                  Aportar Capital
                </button>
                <button
                  type="button"
                  onClick={() => setInvMoveType('yield')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: invMoveType === 'yield' ? 'var(--bg-phone)' : 'transparent',
                    color: invMoveType === 'yield' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: invMoveType === 'yield' ? '700' : '500',
                  }}
                >
                  Rendimiento
                </button>
                <button
                  type="button"
                  onClick={() => setInvMoveType('withdrawal')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: invMoveType === 'withdrawal' ? 'var(--bg-phone)' : 'transparent',
                    color: invMoveType === 'withdrawal' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: invMoveType === 'withdrawal' ? '700' : '500',
                  }}
                >
                  Retirar Fondos
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="input-group">
              <label className="input-label">Monto ({profile.currency})</label>
              <input
                type="number"
                inputMode="decimal"
                className="input-field"
                placeholder="0.00"
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Liquid Account Source / Destination Selector */}
            {invMoveType !== 'yield' && (
              <div className="input-group">
                <label className="input-label">
                  {invMoveType === 'deposit' ? 'Origen de Fondos (Se descuenta de aquí)' : 'Destino de Fondos (Se abona aquí)'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setInvSourceMethod('cash')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: invSourceMethod === 'cash' ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: invSourceMethod === 'cash' ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: invSourceMethod === 'cash' ? 'var(--color-primary)' : 'var(--text-primary)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <DynamicIcon name="Banknote" size={16} color={invSourceMethod === 'cash' ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvSourceMethod('card')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: invSourceMethod === 'card' ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: invSourceMethod === 'card' ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: invSourceMethod === 'card' ? 'var(--color-primary)' : 'var(--text-primary)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <DynamicIcon name="CreditCard" size={16} color={invSourceMethod === 'card' ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                    <span>Tarjeta</span>
                  </button>
                </div>
              </div>
            )}

            {/* If Cash for investment */}
            {invMoveType !== 'yield' && invSourceMethod === 'cash' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                marginBottom: '12px'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Efectivo Disponible:</span>
                <span style={{ fontWeight: '700', color: summary.cashBalance > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {profile.currency}{summary.cashBalance.toLocaleString()}
                </span>
              </div>
            )}

            {/* If Card for investment */}
            {invMoveType !== 'yield' && invSourceMethod === 'card' && (
              <div className="input-group">
                <label className="input-label">Seleccionar Tarjeta</label>
                {activeCards.length === 0 ? (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '12px', fontSize: '12px' }}>
                    No tienes tarjetas activas registradas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {activeCards.map(c => {
                      const isSelected = invCardId === c.id || (!invCardId && c.id === activeCards[0].id);
                      const isCredit = c.type === 'credit';
                      const capacity = isCredit 
                        ? Math.max(0, (c.creditLimit || 0) - (c.balanceUsed || 0))
                        : ((c.currentBalance || 0) + (c.allowOverdraft ? (c.overdraftLimit || 0) : 0));

                      return (
                        <div
                          key={c.id}
                          onClick={() => setInvCardId(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                            backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--bg-card)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.color || 'var(--color-primary)' }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {c.name} {c.lastFourDigits ? `(••${c.lastFourDigits})` : ''}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {c.bank} • {c.type === 'credit' ? 'Crédito' : 'Débito'}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                              {profile.currency}{capacity.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {isCredit ? 'Cupo' : 'Saldo'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Validation Banner for Investment Deposit */}
            {invMoveType === 'deposit' && !invValidation.isValid && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontWeight: '700', fontSize: '12px' }}>
                  <DynamicIcon name="AlertTriangle" size={16} />
                  <span>{invValidation.errorTitle}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {invValidation.errorMessage}
                </div>

                {invValidation.suggestedCards && invValidation.suggestedCards.length > 0 && (
                  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tarjetas con capacidad suficiente:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {invValidation.suggestedCards.map(sug => (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => {
                            setInvSourceMethod('card');
                            setInvCardId(sug.id);
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

            {/* Date Input */}
            <div className="input-group">
              <label className="input-label">Fecha</label>
              <input
                type="date"
                className="input-field"
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
              />
            </div>

            {/* Notes Input */}
            <div className="input-group">
              <label className="input-label">Notas / Concepto</label>
              <input
                type="text"
                className="input-field"
                placeholder={
                  invMoveType === 'deposit' ? 'Ej: Aportación a fondo indexado' :
                  invMoveType === 'yield' ? 'Ej: Interés mensual pagado' :
                  'Ej: Retiro por emergencia'
                }
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCloseInvestmentModal}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={invMoveType === 'deposit' && !invValidation.isValid}
                onClick={handleSaveInvestmentMove}
                style={{ 
                  flex: 1,
                  opacity: (invMoveType === 'deposit' && !invValidation.isValid) ? 0.5 : 1,
                  cursor: (invMoveType === 'deposit' && !invValidation.isValid) ? 'not-allowed' : 'pointer'
                }}
              >
                Registrar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Abonar a Deuda */}
      {abonarDebtTarget && (
        <Modal
          isOpen={!!abonarDebtTarget}
          onClose={() => setAbonarDebtTarget(null)}
          title={`Abonar a ${abonarDebtTarget.personOrInstitution}`}
          maxWidth="400px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monto Pendiente:</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: abonarDebtTarget.type === 'borrowed' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {profile.currency} {abonarDebtTarget.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Selector de origen */}
            <div className="input-group">
              <label className="input-label">Medio de Pago</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`btn ${abonarMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => {
                    setAbonarMethod('cash');
                    setAbonarError(null);
                  }}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  className={`btn ${abonarMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => {
                    setAbonarMethod('card');
                    if (!abonarCardId && activeCards.length > 0) {
                      setAbonarCardId(activeCards[0].id);
                    }
                    setAbonarError(null);
                  }}
                >
                  💳 Tarjeta
                </button>
              </div>

              {abonarMethod === 'card' && (
                <select
                  value={abonarCardId}
                  onChange={(e) => {
                    setAbonarCardId(e.target.value);
                    setAbonarError(null);
                  }}
                  className="input-field"
                  style={{ marginTop: '4px' }}
                >
                  {activeCards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.bank}) — {c.type === 'credit' ? `Cupo: ${c.currency}${(c.creditLimit! - (c.balanceUsed || 0)).toLocaleString()}` : `Saldo: ${c.currency}${(c.currentBalance || 0).toLocaleString()}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Monto del abono */}
            <div className="input-group">
              <label className="input-label">Monto a Abonar ({profile.currency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={abonarAmount}
                onChange={(e) => {
                  setAbonarAmount(e.target.value);
                  setAbonarError(null);
                }}
                className="input-field"
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {[0.25, 0.5, 1.0].map(ratio => {
                  const part = Math.round(abonarDebtTarget.remainingAmount * ratio);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '4px', fontSize: '11px' }}
                      onClick={() => setAbonarAmount(part.toString())}
                    >
                      {ratio === 1 ? 'Total (100%)' : `${ratio * 100}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            {abonarError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <DynamicIcon name="AlertTriangle" size={14} color="#ef4444" />
                <span>{abonarError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAbonarDebtTarget(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmAbonar}
                style={{ flex: 1 }}
              >
                Confirmar Abono
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Comprobante Digital */}
      <TransferReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
    </div>
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
