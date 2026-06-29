import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, Category, Budget, SavingGoal, UserProfile, RecurringTransaction, Debt } from '../models/types';
import { LocalRepository } from '../repositories/LocalRepository';
import { StatsService } from '../services/StatsService';


interface AppContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: SavingGoal[];
  profile: UserProfile;
  recurring: RecurringTransaction[];
  debts: Debt[];
  isAuthenticated: boolean;
  setAuthenticated: (val: boolean) => void;
  isOnboarded: boolean;
  activeTab: 'home' | 'history' | 'budget' | 'stats' | 'profile';
  setActiveTab: (tab: 'home' | 'history' | 'budget' | 'stats' | 'profile') => void;
  
  // CRUD Ops
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  
  addCategory: (cat: Omit<Category, 'id'>) => string;
  updateCategory: (cat: Category) => void;
  deleteCategory: (id: string) => void;
  
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (b: Budget) => void;
  deleteBudget: (id: string) => void;
  
  addGoal: (g: Omit<SavingGoal, 'id'>) => void;
  updateGoal: (g: SavingGoal) => void;
  deleteGoal: (id: string) => void;

  addRecurring: (rec: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurring: (rec: RecurringTransaction) => void;
  deleteRecurring: (id: string) => void;

  addDebt: (debt: Omit<Debt, 'id'>) => void;
  updateDebt: (debt: Debt) => void;
  deleteDebt: (id: string) => void;
  
  updateProfile: (profile: UserProfile) => void;
  backupData: () => string;
  restoreData: (json: string) => boolean;
  
  stealthMode: boolean;
  setStealthMode: (val: boolean) => void;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize repository synchronously before states are initialized
  LocalRepository.init();

  const [transactions, setTransactions] = useState<Transaction[]>(() => LocalRepository.getTransactions());
  const [categories, setCategories] = useState<Category[]>(() => LocalRepository.getCategories());
  const [budgets, setBudgets] = useState<Budget[]>(() => LocalRepository.getBudgets());
  const [goals, setGoals] = useState<SavingGoal[]>(() => LocalRepository.getGoals());
  const [profile, setProfile] = useState<UserProfile>(() => LocalRepository.getProfile());
  const [recurring, setRecurring] = useState<RecurringTransaction[]>(() => LocalRepository.getRecurring());
  const [debts, setDebts] = useState<Debt[]>(() => LocalRepository.getDebts());
  
  // App state
  const [isOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('finanlist_onboarded') === 'true';
  });

  const [isAuthenticated, setAuthenticated] = useState<boolean>(() => {
    // If no pin is set, auto-authenticate
    const p = LocalRepository.getProfile();
    return !p.pinCode;
  });
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'budget' | 'stats' | 'profile'>('home');
  const [stealthMode, setStealthModeInternal] = useState<boolean>(() => {
    const p = LocalRepository.getProfile();
    return !!p.stealthModeEnabled;
  });

  const setStealthMode = (val: boolean) => {
    setStealthModeInternal(val);
    const p = LocalRepository.getProfile();
    const updated = { ...p, stealthModeEnabled: val };
    LocalRepository.saveProfile(updated);
    setProfile(updated);
  };


  // Theme Syncing
  useEffect(() => {
    const root = document.documentElement;
    const isDark = profile.theme === 'dark' || 
      (profile.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    // Set accent color dynamically
    root.style.setProperty('--color-primary', profile.accentColor || '#6366f1');
  }, [profile.theme, profile.accentColor]);

  // Sync state helpers
  const reloadAll = () => {
    setTransactions(LocalRepository.getTransactions());
    setCategories(LocalRepository.getCategories());
    setBudgets(LocalRepository.getBudgets());
    setGoals(LocalRepository.getGoals());
    setProfile(LocalRepository.getProfile());
    setRecurring(LocalRepository.getRecurring());
    setDebts(LocalRepository.getDebts());
  };

  // --- Transaction Ops ---
  const addTransaction = (txData: Omit<Transaction, 'id'>) => {
    const id = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newTx: Transaction = { ...txData, id };
    
    // Auto-create debt if expense exceeds current total balance
    if (txData.type === 'expense') {
      const summary = StatsService.getSummary(transactions, budgets);
      const currentBalance = summary.totalBalance;
      const deficit = txData.amount - Math.max(0, currentBalance);
      
      if (deficit > 0) {
        let creditor = '';
        if (typeof window !== 'undefined') {
          creditor = prompt(
            `¡Has excedido tu saldo disponible por ${profile.currency}${deficit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}!\nEl excedente se registrará como una deuda. ¿Quién es el acreedor?`,
            'Acreedor por Sobregiro'
          ) || 'Acreedor por Sobregiro';
        } else {
          creditor = 'Acreedor por Sobregiro';
        }
        
        // Add Debt (borrowed)
        const debtId = 'debt_' + Date.now() + Math.random().toString(36).substr(2, 4);
        LocalRepository.addDebt({
          id: debtId,
          personOrInstitution: creditor.trim(),
          amount: deficit,
          remainingAmount: deficit,
          type: 'borrowed',
          notes: `Generado automáticamente por sobregiro en gasto: ${txData.notes || 'Sin concepto'}`
        });
        
        // Add offsetting income transaction to balance cash
        const now = new Date();
        const offsetTx: Transaction = {
          id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4) + '_offset',
          amount: deficit,
          type: 'income',
          categoryId: 'cat_extra',
          account: txData.account || 'Efectivo',
          date: txData.date || now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0].slice(0, 5),
          notes: `Crédito automático de ${creditor} por sobregiro`,
          color: '#22c55e',
          icon: 'Coins'
        };
        LocalRepository.addTransaction(offsetTx);
      }
    }

    LocalRepository.addTransaction(newTx);
    
    // Auto-credit saving goal if transaction is marked as goal transfer
    if (txData.type === 'expense' && txData.notes) {
      const match = txData.notes.match(/#goal:([a-zA-Z0-9_]+)/);
      if (match) {
        const goalId = match[1];
        const currentGoals = LocalRepository.getGoals();
        const goalIndex = currentGoals.findIndex(g => g.id === goalId);
        if (goalIndex !== -1) {
          const updatedGoal = {
            ...currentGoals[goalIndex],
            currentAmount: currentGoals[goalIndex].currentAmount + txData.amount
          };
          LocalRepository.updateGoal(updatedGoal);
        }
      }
    }

    reloadAll();
  };

  const updateTransaction = (tx: Transaction) => {
    // Sync saving goal if transaction has goal notes
    const oldTx = transactions.find(t => t.id === tx.id);
    if (oldTx) {
      // Subtract old amount if it was a goal contribution
      if (oldTx.type === 'expense' && oldTx.notes) {
        const match = oldTx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const currentGoals = LocalRepository.getGoals();
          const goalIndex = currentGoals.findIndex(g => g.id === goalId);
          if (goalIndex !== -1) {
            const updatedGoal = {
              ...currentGoals[goalIndex],
              currentAmount: Math.max(0, currentGoals[goalIndex].currentAmount - oldTx.amount)
            };
            LocalRepository.updateGoal(updatedGoal);
          }
        }
      }
      
      // Add new amount if it is a goal contribution
      if (tx.type === 'expense' && tx.notes) {
        const match = tx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const currentGoals = LocalRepository.getGoals();
          const goalIndex = currentGoals.findIndex(g => g.id === goalId);
          if (goalIndex !== -1) {
            const updatedGoal = {
              ...currentGoals[goalIndex],
              currentAmount: currentGoals[goalIndex].currentAmount + tx.amount
            };
            LocalRepository.updateGoal(updatedGoal);
          }
        }
      }
    }

    LocalRepository.updateTransaction(tx);
    reloadAll();
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx && tx.type === 'expense' && tx.notes) {
      const match = tx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
      if (match) {
        const goalId = match[1];
        const currentGoals = LocalRepository.getGoals();
        const goalIndex = currentGoals.findIndex(g => g.id === goalId);
        if (goalIndex !== -1) {
          const updatedGoal = {
            ...currentGoals[goalIndex],
            currentAmount: Math.max(0, currentGoals[goalIndex].currentAmount - tx.amount)
          };
          LocalRepository.updateGoal(updatedGoal);
        }
      }
    }

    LocalRepository.deleteTransaction(id);
    reloadAll();
  };

  // --- Category Ops ---
  const addCategory = (catData: Omit<Category, 'id'>): string => {
    const id = 'cat_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newCat: Category = { ...catData, id };
    LocalRepository.addCategory(newCat);
    setCategories(LocalRepository.getCategories());
    return id;
  };


  const updateCategory = (cat: Category) => {
    LocalRepository.updateCategory(cat);
    reloadAll(); // Reload everything since transactions might cache colors/icons
  };

  const deleteCategory = (id: string) => {
    LocalRepository.deleteCategory(id);
    reloadAll();
  };

  // --- Budget Ops ---
  const addBudget = (bData: Omit<Budget, 'id'>) => {
    const id = 'bud_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newB: Budget = { ...bData, id };
    LocalRepository.addBudget(newB);
    setBudgets(LocalRepository.getBudgets());
  };

  const updateBudget = (b: Budget) => {
    LocalRepository.updateBudget(b);
    setBudgets(LocalRepository.getBudgets());
  };

  const deleteBudget = (id: string) => {
    LocalRepository.deleteBudget(id);
    setBudgets(LocalRepository.getBudgets());
  };

  // --- Saving Goal Ops ---
  const addGoal = (gData: Omit<SavingGoal, 'id'>) => {
    const id = 'goal_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newG: SavingGoal = { ...gData, id };
    LocalRepository.addGoal(newG);
    setGoals(LocalRepository.getGoals());
  };

  const updateGoal = (g: SavingGoal) => {
    LocalRepository.updateGoal(g);
    setGoals(LocalRepository.getGoals());
  };

  const deleteGoal = (id: string) => {
    LocalRepository.deleteGoal(id);
    setGoals(LocalRepository.getGoals());
  };

  // --- Recurring Ops ---
  const addRecurring = (recData: Omit<RecurringTransaction, 'id'>) => {
    const id = 'rec_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newRec: RecurringTransaction = { ...recData, id };
    LocalRepository.addRecurring(newRec);
    setRecurring(LocalRepository.getRecurring());
  };

  const updateRecurring = (rec: RecurringTransaction) => {
    LocalRepository.updateRecurring(rec);
    setRecurring(LocalRepository.getRecurring());
  };

  const deleteRecurring = (id: string) => {
    LocalRepository.deleteRecurring(id);
    setRecurring(LocalRepository.getRecurring());
  };

  // --- Debt Ops ---
  const addDebt = (debtData: Omit<Debt, 'id'>) => {
    const id = 'debt_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newDebt: Debt = { ...debtData, id };
    LocalRepository.addDebt(newDebt);
    setDebts(LocalRepository.getDebts());
  };

  const updateDebt = (debt: Debt) => {
    LocalRepository.updateDebt(debt);
    setDebts(LocalRepository.getDebts());
  };

  const deleteDebt = (id: string) => {
    LocalRepository.deleteDebt(id);
    setDebts(LocalRepository.getDebts());
  };

  // --- Profile Ops ---
  const updateProfile = (profData: UserProfile) => {
    LocalRepository.saveProfile(profData);
    setProfile(profData);
  };

  // Automated check and apply engine for recurring transactions
  useEffect(() => {
    // If not onboarded, wait
    if (!isOnboarded) return;

    const activeRecs = LocalRepository.getRecurring().filter(r => r.active);
    if (activeRecs.length === 0) return;

    const now = new Date();
    let didApplyAny = false;

    activeRecs.forEach(rec => {
      const startDate = new Date(rec.startDate);
      const lastApplied = rec.lastAppliedDate 
        ? new Date(rec.lastAppliedDate) 
        : new Date(startDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before start date if never applied

      // Iterate day-by-day to check if transaction should be registered
      let nextCheck = new Date(lastApplied.getTime() + 24 * 60 * 60 * 1000);
      while (nextCheck <= now) {
        const checkDateStr = nextCheck.toISOString().split('T')[0];
        let isMatch = false;
        const diffTime = nextCheck.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          if (rec.frequency === 'daily') {
            isMatch = true;
          } else if (rec.frequency === 'weekly') {
            isMatch = diffDays % 7 === 0;
          } else if (rec.frequency === 'monthly') {
            isMatch = nextCheck.getDate() === startDate.getDate() || 
                      (nextCheck.getDate() === new Date(nextCheck.getFullYear(), nextCheck.getMonth() + 1, 0).getDate() && startDate.getDate() > nextCheck.getDate());
          } else if (rec.frequency === 'yearly') {
            isMatch = nextCheck.getMonth() === startDate.getMonth() && nextCheck.getDate() === startDate.getDate();
          }
        }

        if (isMatch) {
          // Add transaction
          const txId = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4);
          const newTx: Transaction = {
            id: txId,
            amount: rec.amount,
            type: rec.type,
            categoryId: rec.categoryId,
            account: rec.account,
            date: checkDateStr,
            time: '08:00',
            notes: rec.notes ? `${rec.notes} (Recurrente)` : 'Transacción recurrente',
            color: rec.color,
            icon: rec.icon
          };
          LocalRepository.addTransaction(newTx);
          rec.lastAppliedDate = checkDateStr;
          didApplyAny = true;
        }

        nextCheck.setDate(nextCheck.getDate() + 1);
      }

      if (didApplyAny) {
        LocalRepository.updateRecurring(rec);
      }
    });

    if (didApplyAny) {
      reloadAll();
    }
  }, [isOnboarded]);

  // --- Import / Export ---
  const backupData = () => {
    return LocalRepository.exportDataRaw();
  };

  const restoreData = (json: string): boolean => {
    const success = LocalRepository.importDataRaw(json);
    if (success) {
      reloadAll();
    }
    return success;
  };

  return (
    <AppContext.Provider
      value={{
        transactions,
        categories,
        budgets,
        goals,
        profile,
        recurring,
        debts,
        isAuthenticated,
        setAuthenticated,
        isOnboarded,
        activeTab,
        setActiveTab,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCategory,
        updateCategory,
        deleteCategory,
        addBudget,
        updateBudget,
        deleteBudget,
        addGoal,
        updateGoal,
        deleteGoal,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        addDebt,
        updateDebt,
        deleteDebt,
        updateProfile,
        backupData,
        restoreData,
        stealthMode,
        setStealthMode
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
