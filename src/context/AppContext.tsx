import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, Category, Budget, SavingGoal, UserProfile, RecurringTransaction, Debt } from '../models/types';
import { LocalRepository } from '../repositories/LocalRepository';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { User } from '@supabase/supabase-js';

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
  
  // Supabase specific
  user: User | null;
  isCloudSynced: boolean;
  signUp: (email: string, pass: string, name: string, username: string) => Promise<any>;
  signIn: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;

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
  // Initialize repository synchronously
  LocalRepository.init();

  const [transactions, setTransactions] = useState<Transaction[]>(() => LocalRepository.getTransactions());
  const [categories, setCategories] = useState<Category[]>(() => LocalRepository.getCategories());
  const [budgets, setBudgets] = useState<Budget[]>(() => LocalRepository.getBudgets());
  const [goals, setGoals] = useState<SavingGoal[]>(() => LocalRepository.getGoals());
  const [profile, setProfile] = useState<UserProfile>(() => LocalRepository.getProfile());
  const [recurring, setRecurring] = useState<RecurringTransaction[]>(() => LocalRepository.getRecurring());
  const [debts, setDebts] = useState<Debt[]>(() => LocalRepository.getDebts());
  
  // Supabase auth state
  const [user, setUser] = useState<User | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  const [localIsOnboarded, setLocalIsOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('finanlist_onboarded') === 'true';
  });

  const [isAuthenticated, setAuthenticated] = useState<boolean>(() => {
    const p = LocalRepository.getProfile();
    return !p.pinCode;
  });

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'budget' | 'stats' | 'profile'>('home');
  const [stealthMode, setStealthModeInternal] = useState<boolean>(() => {
    const p = LocalRepository.getProfile();
    return !!p.stealthModeEnabled;
  });

  // Reload local state values
  const reloadAll = () => {
    setTransactions(LocalRepository.getTransactions());
    setCategories(LocalRepository.getCategories());
    setBudgets(LocalRepository.getBudgets());
    setGoals(LocalRepository.getGoals());
    setProfile(LocalRepository.getProfile());
    setRecurring(LocalRepository.getRecurring());
    setDebts(LocalRepository.getDebts());
  };

  // Sync Supabase Authentication
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      setIsCloudSynced(!!activeUser);
      if (activeUser) {
        loadAllFromCloud(activeUser.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      setIsCloudSynced(!!activeUser);
      if (activeUser) {
        loadAllFromCloud(activeUser.id);
      } else {
        reloadAll();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch all user records from Supabase PostgreSQL tables
  const loadAllFromCloud = async (userId: string) => {
    try {
      // 1. Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      let localPin = '';
      if (profileData) {
        localPin = profileData.pin_code || '';
        const loadedProfile: UserProfile = {
          name: profileData.name,
          username: profileData.username,
          email: profileData.email,
          avatar: '',
          currency: profileData.currency,
          language: 'es',
          theme: profileData.theme as any,
          accentColor: profileData.accent_color,
          pinCode: profileData.pin_code || undefined,
          biometricsEnabled: false,
          stealthModeEnabled: profileData.stealth_mode_enabled
        };
        setProfile(loadedProfile);
        LocalRepository.saveProfile(loadedProfile);
        setAuthenticated(!localPin);
      }

      // 2. Categories
      const { data: catData } = await supabase.from('categories').select('*');
      if (catData && catData.length > 0) {
        const loadedCats = catData.map(c => ({
          id: c.id,
          name: c.name,
          parentId: c.parent_id || undefined,
          color: c.color,
          icon: c.icon
        }));
        setCategories(loadedCats);
        LocalRepository.saveCategories(loadedCats);
      }

      // 3. Transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      if (txData) {
        const loadedTxs = txData.map(t => ({
          id: t.id,
          amount: parseFloat(t.amount),
          type: t.type as any,
          categoryId: t.category_id,
          subcategoryId: t.subcategory_id || undefined,
          account: t.account,
          date: t.date,
          time: t.time,
          notes: t.notes || undefined,
          tags: t.tags || [],
          color: t.color,
          icon: t.icon,
          favorite: !!t.favorite
        }));
        setTransactions(loadedTxs);
        LocalRepository.saveTransactions(loadedTxs);
      }

      // 4. Budgets
      const { data: budgetData } = await supabase.from('budgets').select('*');
      if (budgetData) {
        const loadedBudgets = budgetData.map(b => ({
          id: b.id,
          amount: parseFloat(b.amount),
          contingencyAmount: b.contingency_amount ? parseFloat(b.contingency_amount) : undefined,
          type: b.type as any,
          categoryId: b.category_id || undefined,
          startDate: b.start_date,
          endDate: b.end_date,
          name: b.name || undefined
        }));
        setBudgets(loadedBudgets);
        LocalRepository.saveBudgets(loadedBudgets);
      }

      // 5. Goals
      const { data: goalData } = await supabase.from('goals').select('*');
      if (goalData) {
        const loadedGoals = goalData.map(g => ({
          id: g.id,
          name: g.name,
          targetAmount: parseFloat(g.target_amount),
          currentAmount: parseFloat(g.current_amount),
          icon: g.icon,
          color: g.color,
          targetDate: g.target_date
        }));
        setGoals(loadedGoals);
        LocalRepository.saveGoals(loadedGoals);
      }

      // 6. Debts
      const { data: debtData } = await supabase.from('debts').select('*');
      if (debtData) {
        const loadedDebts = debtData.map(d => ({
          id: d.id,
          personOrInstitution: d.person_or_institution,
          amount: parseFloat(d.amount),
          remainingAmount: parseFloat(d.remaining_amount),
          type: d.type as any,
          dueDate: d.due_date || undefined,
          notes: d.notes || undefined
        }));
        setDebts(loadedDebts);
        LocalRepository.saveDebts(loadedDebts);
      }

      // 7. Recurring
      const { data: recData } = await supabase.from('recurring').select('*');
      if (recData) {
        const loadedRec = recData.map(r => ({
          id: r.id,
          amount: parseFloat(r.amount),
          type: r.type as any,
          categoryId: r.category_id,
          account: r.account,
          notes: r.notes || undefined,
          frequency: r.frequency as any,
          startDate: r.start_date,
          lastAppliedDate: r.last_applied_date || undefined,
          active: !!r.active,
          color: r.color,
          icon: r.icon
        }));
        setRecurring(loadedRec);
        LocalRepository.saveRecurring(loadedRec);
      }

    } catch (err) {
      console.error('Error fetching data from Supabase: ', err);
    }
  };

  // Auth Operations
  const signUp = async (email: string, pass: string, name: string, username: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password: pass
    });

    if (authErr) throw authErr;
    if (!authData.user) throw new Error('Error al crear cuenta.');

    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        name,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        currency: 'RD$',
        theme: 'dark',
        accent_color: '#8b5cf6',
        pin_code: '',
        stealth_mode_enabled: false
      });

    if (profileErr) throw profileErr;

    // Seed default categories
    const defaultCats = LocalRepository.getCategories();
    for (const cat of defaultCats) {
      await supabase.from('categories').insert({
        id: cat.id,
        user_id: authData.user.id,
        name: cat.name,
        parent_id: cat.parentId || null,
        color: cat.color,
        icon: cat.icon
      });
    }

    localStorage.setItem('finanlist_onboarded', 'true');
    setLocalIsOnboarded(true);
    return authData.user;
  };

  const signIn = async (email: string, pass: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) throw error;
    
    localStorage.setItem('finanlist_onboarded', 'true');
    setLocalIsOnboarded(true);
    return data.user;
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsCloudSynced(false);
    localStorage.clear();
    setLocalIsOnboarded(false);
    setAuthenticated(false);
    reloadAll();
    window.location.reload();
  };

  const setStealthMode = (val: boolean) => {
    setStealthModeInternal(val);
    const updated = { ...profile, stealthModeEnabled: val };
    LocalRepository.saveProfile(updated);
    setProfile(updated);
    if (isCloudSynced && user) {
      supabase.from('profiles')
        .update({ stealth_mode_enabled: val })
        .eq('id', user.id)
        .then(({ error }) => { if (error) console.error(error); });
    }
  };

  // --- Transaction Ops ---
  const addTransaction = async (txData: Omit<Transaction, 'id'>) => {
    const id = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newTx: Transaction = { ...txData, id };
    
    LocalRepository.addTransaction(newTx);

    if (isCloudSynced && user) {
      try {
        await supabase.from('transactions').insert({
          id,
          user_id: user.id,
          amount: newTx.amount,
          type: newTx.type,
          category_id: newTx.categoryId,
          subcategory_id: newTx.subcategoryId || null,
          account: newTx.account,
          date: newTx.date,
          time: newTx.time,
          notes: newTx.notes || null,
          tags: newTx.tags || [],
          color: newTx.color,
          icon: newTx.icon,
          favorite: newTx.favorite || false
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (txData.type === 'expense' && txData.notes) {
      const match = txData.notes.match(/#goal:([a-zA-Z0-9_]+)/);
      if (match) {
        const goalId = match[1];
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
          const updatedGoal = {
            ...goal,
            currentAmount: goal.currentAmount + txData.amount
          };
          LocalRepository.updateGoal(updatedGoal);
          if (isCloudSynced && user) {
            await supabase.from('goals').update({ current_amount: updatedGoal.currentAmount }).eq('id', goalId);
          }
        }
      }
    }

    reloadAll();
  };

  const updateTransaction = async (tx: Transaction) => {
    const oldTx = transactions.find(t => t.id === tx.id);
    LocalRepository.updateTransaction(tx);

    if (isCloudSynced && user) {
      try {
        await supabase.from('transactions').update({
          amount: tx.amount,
          type: tx.type,
          category_id: tx.categoryId,
          subcategory_id: tx.subcategoryId || null,
          account: tx.account,
          date: tx.date,
          time: tx.time,
          notes: tx.notes || null,
          tags: tx.tags || [],
          color: tx.color,
          icon: tx.icon,
          favorite: tx.favorite || false
        }).eq('id', tx.id);
      } catch (e) {
        console.error(e);
      }
    }

    if (oldTx) {
      if (oldTx.type === 'expense' && oldTx.notes) {
        const match = oldTx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const goal = goals.find(g => g.id === goalId);
          if (goal) {
            const updatedGoal = {
              ...goal,
              currentAmount: Math.max(0, goal.currentAmount - oldTx.amount)
            };
            LocalRepository.updateGoal(updatedGoal);
            if (isCloudSynced && user) {
              await supabase.from('goals').update({ current_amount: updatedGoal.currentAmount }).eq('id', goalId);
            }
          }
        }
      }
      if (tx.type === 'expense' && tx.notes) {
        const match = tx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const goal = goals.find(g => g.id === goalId);
          if (goal) {
            const updatedGoal = {
              ...goal,
              currentAmount: goal.currentAmount + tx.amount
            };
            LocalRepository.updateGoal(updatedGoal);
            if (isCloudSynced && user) {
              await supabase.from('goals').update({ current_amount: updatedGoal.currentAmount }).eq('id', goalId);
            }
          }
        }
      }
    }

    reloadAll();
  };

  const deleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    LocalRepository.deleteTransaction(id);

    if (isCloudSynced && user) {
      try {
        await supabase.from('transactions').delete().eq('id', id);
      } catch (e) {
        console.error(e);
      }
    }

    if (tx && tx.type === 'expense' && tx.notes) {
      const match = tx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
      if (match) {
        const goalId = match[1];
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
          const updatedGoal = {
            ...goal,
            currentAmount: Math.max(0, goal.currentAmount - tx.amount)
          };
          LocalRepository.updateGoal(updatedGoal);
          if (isCloudSynced && user) {
            await supabase.from('goals').update({ current_amount: updatedGoal.currentAmount }).eq('id', goalId);
          }
        }
      }
    }

    reloadAll();
  };

  // --- Category Ops ---
  const addCategory = (catData: Omit<Category, 'id'>): string => {
    const id = 'cat_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newCat = { ...catData, id };
    LocalRepository.addCategory(newCat);

    if (isCloudSynced && user) {
      supabase.from('categories').insert({
        id,
        user_id: user.id,
        name: newCat.name,
        parent_id: newCat.parentId || null,
        color: newCat.color,
        icon: newCat.icon
      }).then(({ error }) => { if (error) console.error(error); });
    }

    setCategories(LocalRepository.getCategories());
    return id;
  };

  const updateCategory = async (cat: Category) => {
    LocalRepository.updateCategory(cat);

    if (isCloudSynced && user) {
      try {
        await supabase.from('categories').update({
          name: cat.name,
          color: cat.color,
          icon: cat.icon
        }).eq('id', cat.id);
      } catch (err) {
        console.error(err);
      }
    }

    setCategories(LocalRepository.getCategories());
  };

  const deleteCategory = async (id: string) => {
    LocalRepository.deleteCategory(id);

    if (isCloudSynced && user) {
      try {
        await supabase.from('categories').delete().eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }

    setCategories(LocalRepository.getCategories());
  };

  // --- Budget Ops ---
  const addBudget = async (bData: Omit<Budget, 'id'>) => {
    const id = 'bud_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newB = { ...bData, id };
    LocalRepository.addBudget(newB);

    if (isCloudSynced && user) {
      try {
        await supabase.from('budgets').insert({
          id,
          user_id: user.id,
          amount: newB.amount,
          contingency_amount: newB.contingencyAmount || 0,
          type: newB.type,
          category_id: newB.categoryId || null,
          start_date: newB.startDate,
          end_date: newB.endDate,
          name: newB.name || null
        });
      } catch (err) {
        console.error(err);
      }
    }

    setBudgets(LocalRepository.getBudgets());
  };

  const updateBudget = async (b: Budget) => {
    LocalRepository.updateBudget(b);

    if (isCloudSynced && user) {
      try {
        await supabase.from('budgets').update({
          amount: b.amount,
          contingency_amount: b.contingencyAmount || 0,
          type: b.type,
          category_id: b.categoryId || null,
          start_date: b.startDate,
          end_date: b.endDate,
          name: b.name || null
        }).eq('id', b.id);
      } catch (err) {
        console.error(err);
      }
    }

    setBudgets(LocalRepository.getBudgets());
  };

  const deleteBudget = async (id: string) => {
    LocalRepository.deleteBudget(id);

    if (isCloudSynced && user) {
      try {
        await supabase.from('budgets').delete().eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }

    setBudgets(LocalRepository.getBudgets());
  };

  // --- Saving Goal Ops ---
  const addGoal = async (gData: Omit<SavingGoal, 'id'>) => {
    const id = 'goal_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newG = { ...gData, id };
    LocalRepository.addGoal(newG);

    if (isCloudSynced && user) {
      try {
        await supabase.from('goals').insert({
          id,
          user_id: user.id,
          name: newG.name,
          target_amount: newG.targetAmount,
          current_amount: newG.currentAmount,
          icon: newG.icon,
          color: newG.color,
          target_date: newG.targetDate
        });
      } catch (err) {
        console.error(err);
      }
    }

    setGoals(LocalRepository.getGoals());
  };

  const updateGoal = async (g: SavingGoal) => {
    LocalRepository.updateGoal(g);

    if (isCloudSynced && user) {
      try {
        await supabase.from('goals').update({
          name: g.name,
          target_amount: g.targetAmount,
          current_amount: g.currentAmount,
          icon: g.icon,
          color: g.color,
          target_date: g.targetDate
        }).eq('id', g.id);
      } catch (err) {
        console.error(err);
      }
    }

    setGoals(LocalRepository.getGoals());
  };

  const deleteGoal = async (id: string) => {
    LocalRepository.deleteGoal(id);

    if (isCloudSynced && user) {
      try {
        await supabase.from('goals').delete().eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }

    setGoals(LocalRepository.getGoals());
  };

  // --- Recurring Ops ---
  const addRecurring = async (recData: Omit<RecurringTransaction, 'id'>) => {
    const id = 'rec_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newRec = { ...recData, id };
    LocalRepository.addRecurring(newRec);

    if (isCloudSynced && user) {
      try {
        await supabase.from('recurring').insert({
          id,
          user_id: user.id,
          amount: newRec.amount,
          type: newRec.type,
          category_id: newRec.categoryId,
          account: newRec.account,
          notes: newRec.notes || null,
          frequency: newRec.frequency,
          start_date: newRec.startDate,
          last_applied_date: newRec.lastAppliedDate || null,
          active: newRec.active,
          color: newRec.color,
          icon: newRec.icon
        });
      } catch (err) {
        console.error(err);
      }
    }

    setRecurring(LocalRepository.getRecurring());
  };

  const updateRecurring = async (rec: RecurringTransaction) => {
    LocalRepository.updateRecurring(rec);

    if (isCloudSynced && user) {
      try {
        await supabase.from('recurring').update({
          amount: rec.amount,
          type: rec.type,
          category_id: rec.categoryId,
          account: rec.account,
          notes: rec.notes || null,
          frequency: rec.frequency,
          start_date: rec.startDate,
          last_applied_date: rec.lastAppliedDate || null,
          active: rec.active,
          color: rec.color,
          icon: rec.icon
        }).eq('id', rec.id);
      } catch (err) {
        console.error(err);
      }
    }

    setRecurring(LocalRepository.getRecurring());
  };

  const deleteRecurring = async (id: string) => {
    LocalRepository.deleteRecurring(id);

    if (isCloudSynced && user) {
      try {
        await supabase.from('recurring').delete().eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }

    setRecurring(LocalRepository.getRecurring());
  };

  // --- Debt Ops ---
  const addDebt = async (debtData: Omit<Debt, 'id'>) => {
    const id = 'debt_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newDebt = { ...debtData, id };
    LocalRepository.addDebt(newDebt);

    if (isCloudSynced && user) {
      try {
        await supabase.from('debts').insert({
          id,
          user_id: user.id,
          person_or_institution: newDebt.personOrInstitution,
          amount: newDebt.amount,
          remaining_amount: newDebt.remainingAmount,
          type: newDebt.type,
          due_date: newDebt.dueDate || null,
          notes: newDebt.notes || null
        });
      } catch (err) {
        console.error(err);
      }
    }

    setDebts(LocalRepository.getDebts());
  };

  const updateDebt = async (debt: Debt) => {
    LocalRepository.updateDebt(debt);

    if (isCloudSynced && user) {
      try {
        await supabase.from('debts').update({
          person_or_institution: debt.personOrInstitution,
          amount: debt.amount,
          remaining_amount: debt.remainingAmount,
          type: debt.type,
          due_date: debt.dueDate || null,
          notes: debt.notes || null
        }).eq('id', debt.id);
      } catch (err) {
        console.error(err);
      }
    }

    setDebts(LocalRepository.getDebts());
  };

  const deleteDebt = async (id: string) => {
    LocalRepository.deleteDebt(id);

    if (isCloudSynced && user) {
      try {
        await supabase.from('debts').delete().eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }

    setDebts(LocalRepository.getDebts());
  };

  // --- User Profile Ops ---
  const updateProfile = async (profData: UserProfile) => {
    LocalRepository.saveProfile(profData);
    setProfile(profData);

    if (isCloudSynced && user) {
      try {
        await supabase.from('profiles').update({
          name: profData.name,
          username: profData.username || '',
          email: profData.email || '',
          currency: profData.currency,
          theme: profData.theme,
          accent_color: profData.accentColor,
          pin_code: profData.pinCode || null,
          stealth_mode_enabled: profData.stealthModeEnabled || false
        }).eq('id', user.id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Automated check and apply engine for recurring transactions
  useEffect(() => {
    if (!localIsOnboarded && !user) return;

    const activeRecs = LocalRepository.getRecurring().filter(r => r.active);
    if (activeRecs.length === 0) return;

    const now = new Date();
    let didApplyAny = false;

    activeRecs.forEach(async (rec) => {
      const startDate = new Date(rec.startDate);
      const lastApplied = rec.lastAppliedDate 
        ? new Date(rec.lastAppliedDate) 
        : new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

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

          if (isCloudSynced && user) {
            await supabase.from('transactions').insert({
              id: txId,
              user_id: user.id,
              amount: newTx.amount,
              type: newTx.type,
              category_id: newTx.categoryId,
              account: newTx.account,
              date: newTx.date,
              time: newTx.time,
              notes: newTx.notes,
              color: newTx.color,
              icon: newTx.icon
            });
          }
        }

        nextCheck.setDate(nextCheck.getDate() + 1);
      }

      if (didApplyAny) {
        LocalRepository.updateRecurring(rec);
        if (isCloudSynced && user) {
          await supabase.from('recurring').update({
            last_applied_date: rec.lastAppliedDate
          }).eq('id', rec.id);
        }
      }
    });

    if (didApplyAny) {
      reloadAll();
    }
  }, [localIsOnboarded, user]);

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
        isOnboarded: localIsOnboarded || !!user,
        activeTab,
        setActiveTab,
        user,
        isCloudSynced,
        signUp,
        signIn,
        signOut,
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
