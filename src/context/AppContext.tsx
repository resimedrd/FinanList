import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, Category, Budget, SavingGoal, UserProfile, RecurringTransaction, Debt, PaymentCard, FinancialNotification } from '../models/types';
import { LocalRepository } from '../repositories/LocalRepository';
import { AppwriteService, AppwriteUser } from '../services/AppwriteService';
import { isAppwriteConfigured } from '../services/appwriteClient';
import { createLocalDate, formatLocalDateISO } from '../utils/dateUtils';
import { roundCurrency } from '../utils/currencyUtils';
import { FinancialEngine } from '../services/FinancialEngine';

interface AppContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: SavingGoal[];
  profile: UserProfile;
  recurring: RecurringTransaction[];
  debts: Debt[];
  cards: PaymentCard[];
  notifications: FinancialNotification[];
  isAuthenticated: boolean;
  setAuthenticated: (val: boolean) => void;
  isOnboarded: boolean;
  activeTab: 'home' | 'history' | 'budget' | 'stats' | 'profile' | 'cards';
  setActiveTab: (tab: 'home' | 'history' | 'budget' | 'stats' | 'profile' | 'cards') => void;
  
  // Appwrite specific
  user: AppwriteUser | null;
  isCloudSynced: boolean;
  authLoading: boolean;
  signUp: (email: string, pass: string, name: string, username: string) => Promise<any>;
  signIn: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetFinancialData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;

  // CRUD Ops
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Card Ops
  addCard: (cardData: Omit<PaymentCard, 'id' | 'createdAt'>) => string;
  updateCard: (card: PaymentCard) => void;
  deleteCard: (id: string) => void;
  toggleCardActive: (id: string) => void;
  recordCardPayment: (params: { destinationCardId: string; sourceCardId?: string; amount: number; date: string; time: string; notes?: string }) => void;

  // Notification Ops
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission | null>;

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
  const [cards, setCards] = useState<PaymentCard[]>(() => LocalRepository.getCards());
  const [notifications, setNotifications] = useState<FinancialNotification[]>(() => LocalRepository.getNotifications());
  
  // Appwrite auth state
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(() => isAppwriteConfigured);

  const [localIsOnboarded, setLocalIsOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('finanlist_onboarded') === 'true';
  });

  const [isAuthenticated, setAuthenticated] = useState<boolean>(() => {
    const p = LocalRepository.getProfile();
    return !p.pinCode;
  });

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'budget' | 'stats' | 'profile' | 'cards'>('home');
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
    setCards(LocalRepository.getCards());
    setNotifications(LocalRepository.getNotifications());
  };

  // Sync Appwrite Authentication
  useEffect(() => {
    if (!isAppwriteConfigured) {
      setAuthLoading(false);
      return;
    }

    AppwriteService.getCurrentUser()
      .then(async (activeUser) => {
        setUser(activeUser);
        setIsCloudSynced(!!activeUser);
        if (activeUser) {
          localStorage.setItem('finanlist_onboarded', 'true');
          setLocalIsOnboarded(true);
          try {
            await loadAllFromCloud(activeUser.id);
          } finally {
            setAuthLoading(false);
          }
        } else {
          setAuthLoading(false);
        }
      })
      .catch(() => {
        setAuthLoading(false);
      });
  }, []);

  // --- Transaction & Card Cloud Synchronization Helpers ---
  const syncTransactionToCloud = async (tx: Transaction, userId: string) => {
    if (!isAppwriteConfigured) return;
    try {
      await AppwriteService.syncTransaction(tx, userId);
    } catch (err) {
      console.warn('[Appwrite Sync] Unexpected transaction sync error:', err);
    }
  };

  const syncCardToCloud = async (card: PaymentCard, targetUserId?: string) => {
    const uid = targetUserId || user?.id;
    if (!uid || !isAppwriteConfigured) return;
    try {
      await AppwriteService.syncCard(card, uid);
    } catch (e) {
      console.warn('Error syncing card to Appwrite:', e);
    }
  };

  // Fetch all user records from Appwrite collections
  const loadAllFromCloud = async (userId: string) => {
    try {
      // 1. Profile
      const loadedProfile = await AppwriteService.getProfile(userId);
      if (loadedProfile) {
        setProfile(loadedProfile);
        LocalRepository.saveProfile(loadedProfile);
        setAuthenticated(!loadedProfile.pinCode);
      }

      // 2. Categories
      const loadedCats = await AppwriteService.listCategories(userId);
      if (loadedCats && loadedCats.length > 0) {
        setCategories(loadedCats);
        LocalRepository.saveCategories(loadedCats);
      }

      // 3. Transactions (Non-destructive reconciliation)
      try {
        const loadedTxs = await AppwriteService.listTransactions(userId);
        if (loadedTxs && loadedTxs.length > 0) {
          const localTxs = LocalRepository.getTransactions();
          const cloudTxIds = new Set(loadedTxs.map(t => t.id));
          const unsyncedLocalTxs = localTxs.filter(t => !cloudTxIds.has(t.id));

          const mergedTxs = [...loadedTxs, ...unsyncedLocalTxs];
          mergedTxs.sort((a, b) => {
            const dateComp = b.date.localeCompare(a.date);
            if (dateComp !== 0) return dateComp;
            return (b.time || '').localeCompare(a.time || '');
          });

          setTransactions(mergedTxs);
          LocalRepository.saveTransactions(mergedTxs);

          // Push any unsynced local transactions to cloud in background
          if (unsyncedLocalTxs.length > 0 && userId) {
            unsyncedLocalTxs.forEach(tx => {
              syncTransactionToCloud(tx, userId);
            });
          }
        }
      } catch (txEx) {
        console.warn('Exception loading transactions from Appwrite:', txEx);
      }

      // 4. Budgets
      const loadedBudgets = await AppwriteService.listBudgets(userId);
      if (loadedBudgets && loadedBudgets.length > 0) {
        setBudgets(loadedBudgets);
        LocalRepository.saveBudgets(loadedBudgets);
      }

      // 5. Goals
      const loadedGoals = await AppwriteService.listGoals(userId);
      if (loadedGoals && loadedGoals.length > 0) {
        setGoals(loadedGoals);
        LocalRepository.saveGoals(loadedGoals);
      }

      // 6. Debts
      const loadedDebts = await AppwriteService.listDebts(userId);
      if (loadedDebts && loadedDebts.length > 0) {
        setDebts(loadedDebts);
        LocalRepository.saveDebts(loadedDebts);
      }

      // 7. Recurring
      const loadedRec = await AppwriteService.listRecurring(userId);
      if (loadedRec && loadedRec.length > 0) {
        setRecurring(loadedRec);
        LocalRepository.saveRecurring(loadedRec);
      }

      // 8. Payment Cards (Non-destructive reconciliation)
      try {
        const loadedCards = await AppwriteService.listCards(userId);
        if (loadedCards && loadedCards.length > 0) {
          const localCards = LocalRepository.getCards();
          const cloudCardIds = new Set(loadedCards.map(c => c.id));
          const unsyncedCards = localCards.filter(c => !cloudCardIds.has(c.id));
          const mergedCards = [...loadedCards, ...unsyncedCards];

          setCards(mergedCards);
          LocalRepository.saveCards(mergedCards);

          if (unsyncedCards.length > 0) {
            unsyncedCards.forEach(c => syncCardToCloud(c, userId));
          }
        }
      } catch (cardErr) {
        console.warn('Could not load cards from Appwrite:', cardErr);
      }

      // 9. Financial Notifications
      try {
        const loadedNotifs = await AppwriteService.listNotifications(userId);
        if (loadedNotifs && loadedNotifs.length > 0) {
          setNotifications(loadedNotifs);
          LocalRepository.saveNotifications(loadedNotifs);
        }
      } catch (notifErr) {
        console.warn('Could not load notifications from Appwrite:', notifErr);
      }

    } catch (err) {
      console.error('Error fetching data from Appwrite: ', err);
    }
  };

  // Auth Operations
  const signUp = async (email: string, pass: string, name: string, username: string) => {
    if (!isAppwriteConfigured) throw new Error('Appwrite no está configurado.');

    const activeUser = await AppwriteService.signUp(email, pass, name, username);

    const initialProfile: UserProfile = {
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      avatar: '',
      currency: 'RD$',
      language: 'es',
      theme: 'dark',
      accentColor: '#8b5cf6',
      pinCode: undefined,
      biometricsEnabled: false,
      stealthModeEnabled: false
    };

    await AppwriteService.syncProfile(initialProfile, activeUser.id);

    // Seed default categories
    const defaultCats = LocalRepository.getCategories();
    for (const cat of defaultCats) {
      await AppwriteService.syncCategory(cat, activeUser.id);
    }

    setUser(activeUser);
    setIsCloudSynced(true);
    localStorage.setItem('finanlist_onboarded', 'true');
    setLocalIsOnboarded(true);
    return activeUser;
  };

  const signIn = async (email: string, pass: string) => {
    if (!isAppwriteConfigured) throw new Error('Appwrite no está configurado.');

    const activeUser = await AppwriteService.signIn(email, pass);
    setUser(activeUser);
    setIsCloudSynced(true);
    localStorage.setItem('finanlist_onboarded', 'true');
    setLocalIsOnboarded(true);
    await loadAllFromCloud(activeUser.id);
    return activeUser;
  };

  const signOut = async () => {
    if (isAppwriteConfigured) {
      await AppwriteService.signOut();
    }
    setUser(null);
    setIsCloudSynced(false);
    localStorage.clear();
    setLocalIsOnboarded(false);
    setAuthenticated(false);
    reloadAll();
    window.location.reload();
  };

  const resetFinancialData = async () => {
    // 1. Delete all financial records from Appwrite
    if (isCloudSynced && user) {
      try {
        await AppwriteService.resetFinancialData(user.id);
      } catch (e) {
        console.error('Error resetting cloud data in Appwrite:', e);
        throw e;
      }
    }

    // 2. Clear financial data in localStorage (keeping profile, onboarded status, preferences)
    localStorage.removeItem('finanlist_transactions');
    localStorage.removeItem('finanlist_budgets');
    localStorage.removeItem('finanlist_goals');
    localStorage.removeItem('finanlist_debts');
    localStorage.removeItem('finanlist_recurring');
    localStorage.removeItem('finanlist_cards');
    localStorage.removeItem('finanlist_notifications');

    // 3. Update React state immediately
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setDebts([]);
    setRecurring([]);
    setCards([]);
    setNotifications([]);
  };

  const deleteAccount = async () => {
    // 1. Delete all data and profile from Appwrite
    if (isCloudSynced && user) {
      try {
        await AppwriteService.deleteAllUserData(user.id);
      } catch (e) {
        console.error('Error deleting user data from Appwrite:', e);
      }
      try {
        await AppwriteService.signOut();
      } catch (e) {
        console.error('Error signing out during deletion:', e);
      }
    }

    // 2. Clear all local storage
    localStorage.clear();

    // 3. Reset states and reload cleanly
    setUser(null);
    setIsCloudSynced(false);
    setLocalIsOnboarded(false);
    setAuthenticated(false);
    reloadAll();
    window.location.reload();
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!isAppwriteConfigured) {
      throw new Error('Appwrite no está configurado.');
    }
    if (!user) {
      throw new Error('No hay una sesión activa.');
    }
    await AppwriteService.changePassword(newPass, currentPass);
  };

  const setStealthMode = (val: boolean) => {
    setStealthModeInternal(val);
    const updated = { ...profile, stealthModeEnabled: val };
    LocalRepository.saveProfile(updated);
    setProfile(updated);
    if (isCloudSynced && user) {
      AppwriteService.syncProfile(updated, user.id).catch(console.error);
    }
  };

  // --- Card & Notification Helpers ---
  const checkAndTriggerCardAlerts = (card: PaymentCard) => {
    if (!card.isActive) return;

    const notificationsToAdd: FinancialNotification[] = [];
    const existingNotifs = LocalRepository.getNotifications();

    if (card.type === 'credit') {
      const limit = card.creditLimit || 0;
      const used = card.balanceUsed || 0;
      if (limit > 0) {
        const usedPercent = (used / limit) * 100;
        const threshold = card.alertThresholdPercent || 80;

        if (used > limit) {
          const exceeded = used - limit;
          const title = 'Límite de Crédito Excedido';
          const message = `Tu tarjeta "${card.name}" ha superado su límite por ${card.currency}${exceeded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Saldo utilizado: ${card.currency}${used.toLocaleString()} de ${card.currency}${limit.toLocaleString()}.`;

          const alreadyNotified = existingNotifs.some(n => n.cardId === card.id && n.type === 'over_credit_limit' && !n.isRead);
          if (!alreadyNotified) {
            notificationsToAdd.push({
              id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
              cardId: card.id,
              cardName: card.name,
              type: 'over_credit_limit',
              severity: 'danger',
              title,
              message,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          }
        } else if (usedPercent >= threshold) {
          const roundedPercent = Math.round(usedPercent);
          const title = `Alerta de Crédito (${roundedPercent}%)`;
          const message = `Tu tarjeta "${card.name}" ha utilizado el ${roundedPercent}% de su límite de crédito disponible.`;

          const alreadyNotified = existingNotifs.some(n => n.cardId === card.id && n.type === 'credit_threshold' && !n.isRead);
          if (!alreadyNotified) {
            notificationsToAdd.push({
              id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
              cardId: card.id,
              cardName: card.name,
              type: 'credit_threshold',
              severity: roundedPercent >= 95 ? 'danger' : 'warning',
              title,
              message,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    } else if (card.type === 'debit') {
      const balance = card.currentBalance ?? 0;
      if (balance < 0) {
        const absNeg = Math.abs(balance);
        if (card.allowOverdraft) {
          const overdraftLimit = card.overdraftLimit || 0;
          if (absNeg > overdraftLimit) {
            const title = 'Límite de Sobregiro Excedido';
            const message = `Tu tarjeta "${card.name}" superó el sobregiro permitido (${card.currency}${overdraftLimit.toLocaleString()}). Saldo negativo actual: -${card.currency}${absNeg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
            const alreadyNotified = existingNotifs.some(n => n.cardId === card.id && n.type === 'overdraft' && !n.isRead);
            if (!alreadyNotified) {
              notificationsToAdd.push({
                id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
                cardId: card.id,
                cardName: card.name,
                type: 'overdraft',
                severity: 'danger',
                title,
                message,
                isRead: false,
                createdAt: new Date().toISOString()
              });
            }
          } else {
            const title = 'Cuenta en Sobregiro Autorizado';
            const message = `Tu tarjeta de débito "${card.name}" está utilizando sobregiro. Saldo actual: -${card.currency}${absNeg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
            const alreadyNotified = existingNotifs.some(n => n.cardId === card.id && n.type === 'overdraft' && !n.isRead);
            if (!alreadyNotified) {
              notificationsToAdd.push({
                id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
                cardId: card.id,
                cardName: card.name,
                type: 'overdraft',
                severity: 'warning',
                title,
                message,
                isRead: false,
                createdAt: new Date().toISOString()
              });
            }
          }
        } else {
          const title = 'Saldo Negativo en Débito';
          const message = `Tu tarjeta "${card.name}" presenta un saldo negativo de -${card.currency}${absNeg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sin sobregiro autorizado.`;
          const alreadyNotified = existingNotifs.some(n => n.cardId === card.id && n.type === 'overdraft' && !n.isRead);
          if (!alreadyNotified) {
            notificationsToAdd.push({
              id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
              cardId: card.id,
              cardName: card.name,
              type: 'overdraft',
              severity: 'danger',
              title,
              message,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      } else if (card.minBalanceAlert && balance <= card.minBalanceAlert) {
        const title = 'Alerta de Saldo Bajo';
        const message = `El saldo de tu tarjeta "${card.name}" (${card.currency}${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) está por debajo del mínimo configurado (${card.currency}${card.minBalanceAlert.toLocaleString()}).`;
        const alreadyNotified = existingNotifs.some(n => n.cardId === card.id && n.type === 'low_balance' && !n.isRead);
        if (!alreadyNotified) {
          notificationsToAdd.push({
            id: 'notif_' + Date.now() + Math.random().toString(36).substr(2, 4),
            cardId: card.id,
            cardName: card.name,
            type: 'low_balance',
            severity: 'warning',
            title,
            message,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    if (notificationsToAdd.length > 0) {
      notificationsToAdd.forEach(notif => {
        LocalRepository.addNotification(notif);
        if (isCloudSynced && user) {
          AppwriteService.syncNotification(notif, user.id).catch(console.error);
        }

        // Native Web Notification API
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(notif.title, {
              body: notif.message,
              icon: '/icons/icon-192x192.png'
            });
          } catch (e) {
            console.log('Web notification trigger error:', e);
          }
        }
      });
      setNotifications(LocalRepository.getNotifications());
    }
  };

  const applyTransactionToCard = (
    tx: { amount: number; type: 'income' | 'expense' | 'payment'; cardId?: string; destinationCardId?: string },
    isRevert = false
  ) => {
    const factor = isRevert ? -1 : 1;
    const currentCards = LocalRepository.getCards();
    let updated = false;

    // 1. Transaction made with or affecting cardId
    if (tx.cardId) {
      const card = currentCards.find(c => c.id === tx.cardId);
      if (card) {
        if (card.type === 'debit') {
          if (tx.type === 'expense' || tx.type === 'payment') {
            card.currentBalance = roundCurrency((card.currentBalance ?? 0) - (tx.amount * factor));
            updated = true;
          } else if (tx.type === 'income') {
            card.currentBalance = roundCurrency((card.currentBalance ?? 0) + (tx.amount * factor));
            updated = true;
          }
        } else if (card.type === 'credit') {
          if (tx.type === 'expense') {
            FinancialEngine.applyExpenseToCreditCard(card, tx.amount, isRevert);
            updated = true;
          } else if (tx.type === 'income') {
            FinancialEngine.applyPaymentToCreditCard(card, tx.amount, isRevert);
            updated = true;
          }
        }
        if (updated && !isRevert) {
          checkAndTriggerCardAlerts(card);
        }
      }
    }

    // 2. Transaction that pays a destination credit card
    if (tx.type === 'payment' && tx.destinationCardId) {
      const destCard = currentCards.find(c => c.id === tx.destinationCardId);
      if (destCard && destCard.type === 'credit') {
        FinancialEngine.applyPaymentToCreditCard(destCard, tx.amount, isRevert);
        updated = true;
        if (!isRevert) {
          checkAndTriggerCardAlerts(destCard);
        }
      }
    }

    if (updated) {
      LocalRepository.saveCards(currentCards);
      setCards([...currentCards]);
      if (isCloudSynced && user) {
        currentCards.forEach(c => syncCardToCloud(c));
      }
    }
  };

  // --- Transaction Ops ---
  const addTransaction = async (txData: Omit<Transaction, 'id'>): Promise<void> => {
    const id = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newTx: Transaction = { ...txData, id };
    
    // 1. Immediately persist locally (Local-First Guarantee)
    LocalRepository.addTransaction(newTx);
    applyTransactionToCard(newTx, false);

    // 2. Goal tracking update
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
            AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
          }
        }
      }
    }

    // 3. Update React state immediately
    reloadAll();

    // 4. Sync to Appwrite (Background / Non-blocking)
    if (isCloudSynced && user) {
      syncTransactionToCloud(newTx, user.id).catch(e => {
        console.warn('Error syncing new transaction to cloud:', e);
      });
    }
  };

  const updateTransaction = async (tx: Transaction): Promise<void> => {
    const oldTx = transactions.find(t => t.id === tx.id);
    LocalRepository.updateTransaction(tx);

    if (oldTx) {
      applyTransactionToCard(oldTx, true);
    }
    applyTransactionToCard(tx, false);

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
              AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
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
              AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
            }
          }
        }
      }
    }

    reloadAll();

    if (isCloudSynced && user) {
      syncTransactionToCloud(tx, user.id).catch(e => {
        console.warn('Error updating transaction in cloud:', e);
      });
    }
  };

  const deleteTransaction = async (id: string): Promise<void> => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      applyTransactionToCard(tx, true);
    }
    LocalRepository.deleteTransaction(id);

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
            AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
          }
        }
      }
    }

    reloadAll();

    if (isCloudSynced && user) {
      AppwriteService.deleteTransaction(id).catch(e => {
        console.warn('Error deleting transaction in cloud:', e);
      });
    }
  };

  // --- Card Ops ---
  const addCard = (cardData: Omit<PaymentCard, 'id' | 'createdAt'>): string => {
    const id = 'card_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newCard: PaymentCard = {
      ...cardData,
      id,
      createdAt: new Date().toISOString()
    };
    LocalRepository.addCard(newCard);
    syncCardToCloud(newCard);
    checkAndTriggerCardAlerts(newCard);
    setCards(LocalRepository.getCards());
    return id;
  };

  const updateCard = (card: PaymentCard) => {
    LocalRepository.updateCard(card);
    syncCardToCloud(card);
    checkAndTriggerCardAlerts(card);
    setCards(LocalRepository.getCards());
  };

  const deleteCard = async (id: string) => {
    LocalRepository.deleteCard(id);
    if (isCloudSynced && user) {
      try {
        await AppwriteService.deleteCard(id);
      } catch (e) {
        console.error(e);
      }
    }
    setCards(LocalRepository.getCards());
  };

  const toggleCardActive = (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card) {
      const updated = { ...card, isActive: !card.isActive };
      updateCard(updated);
    }
  };

  const recordCardPayment = (params: {
    destinationCardId: string;
    sourceCardId?: string;
    amount: number;
    date: string;
    time: string;
    notes?: string;
  }) => {
    const currentCards = LocalRepository.getCards();
    const destCard = currentCards.find(c => c.id === params.destinationCardId);
    const sourceCard = params.sourceCardId ? currentCards.find(c => c.id === params.sourceCardId) : undefined;

    const paymentTx: Omit<Transaction, 'id'> = {
      amount: params.amount,
      type: 'payment',
      categoryId: 'cat_bills',
      account: sourceCard ? sourceCard.name : 'Efectivo',
      cardId: params.sourceCardId,
      destinationCardId: params.destinationCardId,
      date: params.date,
      time: params.time,
      notes: params.notes || `Pago a tarjeta ${destCard ? destCard.name : ''}`,
      color: destCard?.color || '#4f46e5',
      icon: 'CreditCard'
    };

    addTransaction(paymentTx);
  };

  // --- Notification Ops ---
  const markNotificationRead = (id: string) => {
    LocalRepository.markNotificationAsRead(id);
    if (isCloudSynced && user) {
      AppwriteService.updateNotification(id, { isRead: true }).catch(console.warn);
    }
    setNotifications(LocalRepository.getNotifications());
  };

  const markAllNotificationsRead = () => {
    LocalRepository.markAllNotificationsAsRead();
    if (isCloudSynced && user) {
      AppwriteService.markAllNotificationsRead(user.id).catch(console.warn);
    }
    setNotifications(LocalRepository.getNotifications());
  };

  const deleteNotification = (id: string) => {
    LocalRepository.deleteNotification(id);
    if (isCloudSynced && user) {
      AppwriteService.deleteNotification(id).catch(console.warn);
    }
    setNotifications(LocalRepository.getNotifications());
  };

  const clearAllNotifications = () => {
    LocalRepository.clearNotifications();
    if (isCloudSynced && user) {
      AppwriteService.clearAllNotifications(user.id).catch(console.warn);
    }
    setNotifications([]);
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission | null> => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm;
      } catch (e) {
        console.warn('Error requesting notification permission:', e);
        return null;
      }
    }
    return null;
  };

  // --- Category Ops ---
  const addCategory = (catData: Omit<Category, 'id'>): string => {
    const id = 'cat_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newCat = { ...catData, id };
    LocalRepository.addCategory(newCat);

    if (isCloudSynced && user) {
      AppwriteService.syncCategory(newCat, user.id).catch(console.error);
    }

    setCategories(LocalRepository.getCategories());
    return id;
  };

  const updateCategory = async (cat: Category) => {
    LocalRepository.updateCategory(cat);

    if (isCloudSynced && user) {
      try {
        await AppwriteService.syncCategory(cat, user.id);
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
        await AppwriteService.deleteCategory(id);
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
        await AppwriteService.syncBudget(newB, user.id);
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
        await AppwriteService.syncBudget(b, user.id);
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
        await AppwriteService.deleteBudget(id);
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
        await AppwriteService.syncGoal(newG, user.id);
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
        await AppwriteService.syncGoal(g, user.id);
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
        await AppwriteService.deleteGoal(id);
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
        await AppwriteService.syncRecurring(newRec, user.id);
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
        await AppwriteService.syncRecurring(rec, user.id);
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
        await AppwriteService.deleteRecurring(id);
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
        await AppwriteService.syncDebt(newDebt, user.id);
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
        await AppwriteService.syncDebt(debt, user.id);
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
        await AppwriteService.deleteDebt(id);
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
        await AppwriteService.syncProfile(profData, user.id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Automated check and apply engine for recurring transactions
  useEffect(() => {
    if (!localIsOnboarded && !user) return;

    let isMounted = true;

    const processRecurring = async () => {
      const activeRecs = LocalRepository.getRecurring().filter(r => r.active);
      if (activeRecs.length === 0) return;

      const now = new Date();
      let didApplyAny = false;

      for (const rec of activeRecs) {
        if (!isMounted) break;

        const startDate = createLocalDate(rec.startDate);
        const lastApplied = rec.lastAppliedDate 
          ? createLocalDate(rec.lastAppliedDate) 
          : new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

        let nextCheck = new Date(lastApplied.getTime() + 24 * 60 * 60 * 1000);
        let recUpdated = false;

        while (nextCheck <= now) {
          const checkDateStr = formatLocalDateISO(nextCheck);
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
            recUpdated = true;
            didApplyAny = true;

            if (isCloudSynced && user) {
              try {
                await AppwriteService.syncTransaction(newTx, user.id);
              } catch (e) {
                console.error('[Recurring] Error syncing recurring transaction to Appwrite:', e);
              }
            }
          }

          nextCheck.setDate(nextCheck.getDate() + 1);
        }

        if (recUpdated) {
          LocalRepository.updateRecurring(rec);
          if (isCloudSynced && user) {
            try {
              await AppwriteService.syncRecurring(rec, user.id);
            } catch (e) {
              console.error('[Recurring] Error updating recurring schedule in Appwrite:', e);
            }
          }
        }
      }

      if (didApplyAny && isMounted) {
        reloadAll();
      }
    };

    processRecurring();

    return () => {
      isMounted = false;
    };
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
        cards,
        notifications,
        isAuthenticated,
        setAuthenticated,
        isOnboarded: localIsOnboarded || !!user,
        activeTab,
        setActiveTab,
        user,
        isCloudSynced,
        authLoading,
        signUp,
        signIn,
        signOut,
        resetFinancialData,
        deleteAccount,
        changePassword,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCard,
        updateCard,
        deleteCard,
        toggleCardActive,
        recordCardPayment,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,
        requestNotificationPermission,
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
