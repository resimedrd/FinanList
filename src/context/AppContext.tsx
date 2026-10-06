import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, Category, Budget, SavingGoal, UserProfile, RecurringTransaction, Debt, PaymentCard, FinancialNotification, TransactionType } from '../models/types';
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

  // --- Transaction & Card Cloud Synchronization Helpers (Outbox Pattern) ---
  const syncTransactionToCloud = useCallback(async (tx: Transaction, userId: string) => {
    if (!isAppwriteConfigured) return;
    try {
      await AppwriteService.enqueueOutbox('transaction', 'create', tx, userId);
    } catch (err) {
      console.warn('[Appwrite Sync] Error encolando transacción en Outbox:', err);
    }
  }, []);

  const syncCardToCloud = useCallback(async (card: PaymentCard, targetUserId?: string) => {
    const uid = targetUserId || user?.id;
    if (!uid || !isAppwriteConfigured) return;
    try {
      await AppwriteService.enqueueOutbox('card', 'create', card, uid);
    } catch (e) {
      console.warn('[Appwrite Sync] Error encolando tarjeta en Outbox:', e);
    }
  }, [user]);

  // Fetch all user records from Appwrite collections with reset-safety
  const loadAllFromCloud = useCallback(async (userId: string) => {
    try {
      // 1. Profile
      const loadedProfile = await AppwriteService.getProfile(userId);
      const localResetTime = LocalRepository.getLastResetAt() ? new Date(LocalRepository.getLastResetAt()!).getTime() : 0;
      const cloudResetTime = loadedProfile?.lastResetAt ? new Date(loadedProfile.lastResetAt).getTime() : 0;
      const effectiveResetTime = Math.max(localResetTime, cloudResetTime);

      if (loadedProfile) {
        const mergedProfile = {
          ...loadedProfile,
          lastResetAt: effectiveResetTime > 0 ? new Date(effectiveResetTime).toISOString() : loadedProfile.lastResetAt
        };
        setProfile(mergedProfile);
        LocalRepository.saveProfile(mergedProfile);
        setAuthenticated(!mergedProfile.pinCode);
      }

      const isBeforeReset = (createdAt?: string, dateStr?: string) => {
        if (effectiveResetTime <= 0) return false;
        if (createdAt) {
          const t = new Date(createdAt).getTime();
          if (!isNaN(t) && t <= effectiveResetTime) return true;
        }
        if (dateStr) {
          const t = new Date(dateStr).getTime();
          if (!isNaN(t) && t <= effectiveResetTime) return true;
        }
        return false;
      };

      // 2. Categories
      const loadedCats = await AppwriteService.listCategories(userId);
      if (loadedCats && loadedCats.length > 0) {
        setCategories(loadedCats);
        LocalRepository.saveCategories(loadedCats);
      }

      // 3. Transactions (Non-destructive reconciliation with reset isolation)
      try {
        const loadedTxs = await AppwriteService.listTransactions(userId);
        const validLoadedTxs = effectiveResetTime > 0
          ? (loadedTxs || []).filter(t => !isBeforeReset(t.createdAt, t.date))
          : (loadedTxs || []);

        if (effectiveResetTime > 0) {
          // Si hubo un reseteo reciente, la verdad son únicamente los registros posteriores al reseteo.
          // No reenviamos transacciones huérfanas locales a la nube.
          setTransactions(validLoadedTxs);
          LocalRepository.saveTransactions(validLoadedTxs);
        } else {
          const localTxs = LocalRepository.getTransactions();
          const cloudTxIds = new Set(validLoadedTxs.map(t => t.id));
          const unsyncedLocalTxs = localTxs.filter(t => !cloudTxIds.has(t.id));

          const mergedTxs = [...validLoadedTxs, ...unsyncedLocalTxs];
          mergedTxs.sort((a, b) => {
            const dateComp = b.date.localeCompare(a.date);
            if (dateComp !== 0) return dateComp;
            return (b.time || '').localeCompare(a.time || '');
          });

          setTransactions(mergedTxs);
          LocalRepository.saveTransactions(mergedTxs);

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
      const validBudgets = effectiveResetTime > 0
        ? (loadedBudgets || []).filter(b => !isBeforeReset(undefined, b.startDate))
        : (loadedBudgets || []);
      setBudgets(validBudgets);
      LocalRepository.saveBudgets(validBudgets);

      // 5. Goals
      const loadedGoals = await AppwriteService.listGoals(userId);
      const validGoals = effectiveResetTime > 0
        ? (loadedGoals || []).filter(g => !isBeforeReset(undefined, g.targetDate))
        : (loadedGoals || []);
      setGoals(validGoals);
      LocalRepository.saveGoals(validGoals);

      // 6. Debts
      const loadedDebts = await AppwriteService.listDebts(userId);
      const validDebts = effectiveResetTime > 0
        ? (loadedDebts || []).filter(d => !isBeforeReset(d.createdAt, d.dueDate))
        : (loadedDebts || []);
      setDebts(validDebts);
      LocalRepository.saveDebts(validDebts);

      // 7. Recurring
      const loadedRec = await AppwriteService.listRecurring(userId);
      const validRec = effectiveResetTime > 0
        ? (loadedRec || []).filter(r => !isBeforeReset(undefined, r.startDate))
        : (loadedRec || []);
      setRecurring(validRec);
      LocalRepository.saveRecurring(validRec);

      // 8. Payment Cards (Non-destructive reconciliation with reset isolation)
      try {
        const loadedCards = await AppwriteService.listCards(userId);
        const validLoadedCards = effectiveResetTime > 0
          ? (loadedCards || []).filter(c => !isBeforeReset(c.createdAt))
          : (loadedCards || []);

        if (effectiveResetTime > 0) {
          // Tras reseteo, NUNCA empujar tarjetas locales residuales como nuevas mutaciones.
          setCards(validLoadedCards);
          LocalRepository.saveCards(validLoadedCards);
        } else {
          const localCards = LocalRepository.getCards();
          const cloudCardIds = new Set(validLoadedCards.map(c => c.id));
          const unsyncedCards = localCards.filter(c => !cloudCardIds.has(c.id));
          const mergedCards = [...validLoadedCards, ...unsyncedCards];

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
        const validNotifs = effectiveResetTime > 0
          ? (loadedNotifs || []).filter(n => !isBeforeReset(n.createdAt))
          : (loadedNotifs || []);
        setNotifications(validNotifs);
        LocalRepository.saveNotifications(validNotifs);
      } catch (notifErr) {
        console.warn('Could not load notifications from Appwrite:', notifErr);
      }

    } catch (err) {
      console.error('Error fetching data from Appwrite: ', err);
    }
  }, [syncTransactionToCloud, syncCardToCloud]);

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
            await AppwriteService.flushOutbox().catch(console.warn);
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
  }, [loadAllFromCloud]);

  // Auth Operations
  const signUp = useCallback(async (email: string, pass: string, name: string, username: string) => {
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
  }, []);

  const signIn = useCallback(async (email: string, pass: string) => {
    if (!isAppwriteConfigured) throw new Error('Appwrite no está configurado.');

    const activeUser = await AppwriteService.signIn(email, pass);
    setUser(activeUser);
    setIsCloudSynced(true);
    localStorage.setItem('finanlist_onboarded', 'true');
    setLocalIsOnboarded(true);
    await loadAllFromCloud(activeUser.id);
    await AppwriteService.flushOutbox().catch(console.warn);
    return activeUser;
  }, [loadAllFromCloud]);

  const signOut = useCallback(async () => {
    if (isAppwriteConfigured) {
      try {
        await AppwriteService.signOut();
      } catch (err) {
        console.error(err);
      }
    }
    setUser(null);
    setIsCloudSynced(false);
    localStorage.clear();
    setLocalIsOnboarded(false);
    setAuthenticated(false);
    setTransactions([]);
    setCategories(LocalRepository.getCategories());
    setBudgets([]);
    setGoals([]);
    setProfile(LocalRepository.getProfile());
    setRecurring([]);
    setDebts([]);
    setCards([]);
    setNotifications([]);
    window.location.reload();
  }, []);

  const resetFinancialData = useCallback(async () => {
    const resetIso = new Date().toISOString();

    // 1. Limpia la cola outbox antes del reseteo para prevenir envío de operaciones residuales
    await AppwriteService.clearOutbox().catch(console.warn);

    // 2. Elimina registros financieros de Appwrite condicionado al éxito remoto
    if (isCloudSynced && user) {
      try {
        await AppwriteService.resetFinancialData(user.id);
        const updatedProfile = { ...profile, lastResetAt: resetIso };
        await AppwriteService.syncProfile(updatedProfile, user.id);
      } catch (e: any) {
        console.error('Error restableciendo datos en Appwrite:', e);
        throw new Error('No se pudo restablecer los datos en la nube. Operación cancelada para proteger tus datos locales: ' + (e?.message || e));
      }
    }

    // 3. Limpia los datos financieros en LocalRepository e IndexedDB con await explícito
    await LocalRepository.resetFinancialData();

    // 4. Vacía la cola outbox por completo tras la limpieza local
    await AppwriteService.clearOutbox().catch(console.warn);

    // 5. Actualiza el perfil local con la marca de tiempo de reseteo
    const updatedProfile = { ...profile, lastResetAt: resetIso };
    setProfile(updatedProfile);
    LocalRepository.saveProfile(updatedProfile);

    // 6. Actualiza el estado reactivo inmediatamente a vacío
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setDebts([]);
    setRecurring([]);
    setCards([]);
    setNotifications([]);
  }, [isCloudSynced, user, profile]);

  const deleteAccount = useCallback(async () => {
    if (isCloudSynced && user) {
      try {
        await AppwriteService.deleteAllUserData(user.id);
      } catch (e) {
        console.error('Error eliminando datos del usuario en Appwrite:', e);
      }
      try {
        await AppwriteService.signOut();
      } catch (e) {
        console.error('Error cerrando sesión tras eliminación:', e);
      }
    }

    localStorage.clear();
    setUser(null);
    setIsCloudSynced(false);
    setLocalIsOnboarded(false);
    setAuthenticated(false);
    setTransactions([]);
    setCategories(LocalRepository.getCategories());
    setBudgets([]);
    setGoals([]);
    setProfile(LocalRepository.getProfile());
    setRecurring([]);
    setDebts([]);
    setCards([]);
    setNotifications([]);
    window.location.reload();
  }, [isCloudSynced, user]);

  const changePassword = useCallback(async (currentPass: string, newPass: string) => {
    if (!isAppwriteConfigured) {
      throw new Error('Appwrite no está configurado.');
    }
    if (!user) {
      throw new Error('No hay una sesión activa.');
    }
    await AppwriteService.changePassword(newPass, currentPass);
  }, [user]);

  const setStealthMode = useCallback((val: boolean) => {
    setStealthModeInternal(val);
    setProfile(prev => {
      const updated = { ...prev, stealthModeEnabled: val };
      LocalRepository.saveProfile(updated);
      if (isCloudSynced && user) {
        AppwriteService.syncProfile(updated, user.id).catch(console.error);
      }
      return updated;
    });
  }, [isCloudSynced, user]);

  // --- Card & Notification Helpers ---
  const checkAndTriggerCardAlerts = useCallback((card: PaymentCard) => {
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
      setNotifications(prev => [...notificationsToAdd, ...prev]);
    }
  }, [isCloudSynced, user]);

  const applyTransactionToCard = useCallback((
    tx: { amount: number; type: TransactionType | 'payment'; cardId?: string; destinationCardId?: string; sourceAccountId?: string; destinationAccountId?: string },
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
          if (tx.type === 'expense' || tx.type === 'payment' || tx.type === 'transfer') {
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

    // 2. Transaction that transfers or pays to destination card
    if ((tx.type === 'payment' || tx.type === 'transfer') && tx.destinationCardId) {
      const destCard = currentCards.find(c => c.id === tx.destinationCardId);
      if (destCard) {
        if (destCard.type === 'credit') {
          FinancialEngine.applyPaymentToCreditCard(destCard, tx.amount, isRevert);
          updated = true;
          if (!isRevert) {
            checkAndTriggerCardAlerts(destCard);
          }
        } else if (destCard.type === 'debit') {
          destCard.currentBalance = roundCurrency((destCard.currentBalance ?? 0) + (tx.amount * factor));
          updated = true;
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
  }, [isCloudSynced, user, checkAndTriggerCardAlerts, syncCardToCloud]);

  // --- Transaction Ops ---
  const addTransaction = useCallback(async (txData: Omit<Transaction, 'id'>): Promise<void> => {
    const id = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newTx: Transaction = { ...txData, id };
    
    // 1. Immediately persist locally (Local-First Guarantee)
    LocalRepository.addTransaction(newTx);
    applyTransactionToCard(newTx, false);

    // 2. Goal tracking update (supports both 'expense' and 'transfer')
    let updatedGoalObj: SavingGoal | undefined;
    if ((txData.type === 'expense' || txData.type === 'transfer') && txData.notes) {
      const match = txData.notes.match(/#goal:([a-zA-Z0-9_]+)/);
      if (match) {
        const goalId = match[1];
        const currentGoals = LocalRepository.getGoals();
        const goal = currentGoals.find(g => g.id === goalId);
        if (goal) {
          const updatedGoal = {
            ...goal,
            currentAmount: roundCurrency(goal.currentAmount + txData.amount)
          };
          LocalRepository.updateGoal(updatedGoal);
          updatedGoalObj = updatedGoal;
          if (isCloudSynced && user) {
            AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
          }
        }
      }
    }

    // 3. Update React state immediately without synchronous file reads
    setTransactions(prev => [newTx, ...prev]);
    if (updatedGoalObj) {
      setGoals(prev => prev.map(g => g.id === updatedGoalObj!.id ? updatedGoalObj! : g));
    }

    // 4. Sync to Appwrite (Background / Non-blocking)
    if (isCloudSynced && user) {
      syncTransactionToCloud(newTx, user.id).catch(e => {
        console.warn('Error syncing new transaction to cloud:', e);
      });
    }
  }, [isCloudSynced, user, applyTransactionToCard, syncTransactionToCloud]);

  const updateTransaction = useCallback(async (tx: Transaction): Promise<void> => {
    let oldTx: Transaction | undefined;
    setTransactions(prev => {
      oldTx = prev.find(t => t.id === tx.id);
      return prev.map(t => t.id === tx.id ? tx : t);
    });

    LocalRepository.updateTransaction(tx);

    if (oldTx) {
      applyTransactionToCard(oldTx, true);
    }
    applyTransactionToCard(tx, false);

    let updatedGoalObj: SavingGoal | undefined;
    if (oldTx) {
      if ((oldTx.type === 'expense' || oldTx.type === 'transfer') && oldTx.notes) {
        const match = oldTx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const currentGoals = LocalRepository.getGoals();
          const goal = currentGoals.find(g => g.id === goalId);
          if (goal) {
            const updatedGoal = {
              ...goal,
              currentAmount: Math.max(0, roundCurrency(goal.currentAmount - oldTx.amount))
            };
            LocalRepository.updateGoal(updatedGoal);
            updatedGoalObj = updatedGoal;
            if (isCloudSynced && user) {
              AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
            }
          }
        }
      }
      if ((tx.type === 'expense' || tx.type === 'transfer') && tx.notes) {
        const match = tx.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const currentGoals = LocalRepository.getGoals();
          const goal = currentGoals.find(g => g.id === goalId);
          if (goal) {
            const updatedGoal = {
              ...goal,
              currentAmount: roundCurrency(goal.currentAmount + tx.amount)
            };
            LocalRepository.updateGoal(updatedGoal);
            updatedGoalObj = updatedGoal;
            if (isCloudSynced && user) {
              AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
            }
          }
        }
      }
    }

    if (updatedGoalObj) {
      setGoals(prev => prev.map(g => g.id === updatedGoalObj!.id ? updatedGoalObj! : g));
    }

    if (isCloudSynced && user) {
      syncTransactionToCloud(tx, user.id).catch(e => {
        console.warn('Error syncing updated transaction to cloud:', e);
      });
    }
  }, [isCloudSynced, user, applyTransactionToCard, syncTransactionToCloud]);

  const deleteTransaction = useCallback(async (id: string): Promise<void> => {
    let txToDelete: Transaction | undefined;
    setTransactions(prev => {
      txToDelete = prev.find(t => t.id === id);
      return prev.filter(t => t.id !== id);
    });

    LocalRepository.deleteTransaction(id);

    if (txToDelete) {
      applyTransactionToCard(txToDelete, true);

      let updatedGoalObj: SavingGoal | undefined;
      if ((txToDelete.type === 'expense' || txToDelete.type === 'transfer') && txToDelete.notes) {
        const match = txToDelete.notes.match(/#goal:([a-zA-Z0-9_]+)/);
        if (match) {
          const goalId = match[1];
          const currentGoals = LocalRepository.getGoals();
          const goal = currentGoals.find(g => g.id === goalId);
          if (goal) {
            const updatedGoal = {
              ...goal,
              currentAmount: Math.max(0, roundCurrency(goal.currentAmount - txToDelete.amount))
            };
            LocalRepository.updateGoal(updatedGoal);
            updatedGoalObj = updatedGoal;
            if (isCloudSynced && user) {
              AppwriteService.syncGoal(updatedGoal, user.id).catch(console.warn);
            }
          }
        }
      }
      if (updatedGoalObj) {
        setGoals(prev => prev.map(g => g.id === updatedGoalObj!.id ? updatedGoalObj! : g));
      }
    }

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('transaction', 'delete', { id }, user.id).catch(e => {
        console.warn('Error encolando eliminación de transacción en Outbox:', e);
      });
    }
  }, [isCloudSynced, user, applyTransactionToCard]);

  // --- Card Ops ---
  const addCard = useCallback((cardData: Omit<PaymentCard, 'id' | 'createdAt'>): string => {
    const id = 'card_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newCard: PaymentCard = {
      ...cardData,
      id,
      createdAt: new Date().toISOString()
    };
    LocalRepository.addCard(newCard);
    setCards(prev => [...prev, newCard]);

    if (isCloudSynced && user) {
      syncCardToCloud(newCard);
    }
    return id;
  }, [isCloudSynced, user, syncCardToCloud]);

  const updateCard = useCallback((card: PaymentCard) => {
    LocalRepository.updateCard(card);
    setCards(prev => prev.map(c => c.id === card.id ? card : c));

    if (isCloudSynced && user) {
      syncCardToCloud(card);
    }
  }, [isCloudSynced, user, syncCardToCloud]);

  const deleteCard = useCallback((id: string) => {
    LocalRepository.deleteCard(id);
    setCards(prev => prev.filter(c => c.id !== id));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('card', 'delete', { id }, user.id).catch(console.error);
    }
  }, [isCloudSynced, user]);

  const toggleCardActive = useCallback((id: string) => {
    setCards(prev => {
      const card = prev.find(c => c.id === id);
      if (card) {
        const updated = { ...card, isActive: !card.isActive };
        LocalRepository.updateCard(updated);
        if (isCloudSynced && user) {
          syncCardToCloud(updated);
        }
        return prev.map(c => c.id === id ? updated : c);
      }
      return prev;
    });
  }, [isCloudSynced, user, syncCardToCloud]);

  const recordCardPayment = useCallback((params: {
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
      type: 'transfer',
      categoryId: 'cat_bills',
      account: sourceCard ? sourceCard.name : 'Efectivo',
      cardId: params.sourceCardId,
      destinationCardId: params.destinationCardId,
      sourceAccountId: params.sourceCardId,
      destinationAccountId: params.destinationCardId,
      date: params.date,
      time: params.time,
      notes: params.notes || `Pago a tarjeta ${destCard ? destCard.name : ''}`,
      color: destCard?.color || '#4f46e5',
      icon: 'CreditCard'
    };

    addTransaction(paymentTx);
  }, [addTransaction]);

  // --- Notification Ops ---
  const markNotificationRead = useCallback((id: string) => {
    LocalRepository.markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

    if (isCloudSynced && user) {
      AppwriteService.updateNotification(id, { isRead: true }).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const markAllNotificationsRead = useCallback(() => {
    LocalRepository.markAllNotificationsAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    if (isCloudSynced && user) {
      AppwriteService.markAllNotificationsRead(user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const deleteNotification = useCallback((id: string) => {
    LocalRepository.deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (isCloudSynced && user) {
      AppwriteService.deleteNotification(id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const clearAllNotifications = useCallback(() => {
    LocalRepository.clearNotifications();
    setNotifications([]);

    if (isCloudSynced && user) {
      AppwriteService.clearAllNotifications(user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission | null> => {
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
  }, []);

  // --- Category Ops ---
  const addCategory = useCallback((catData: Omit<Category, 'id'>): string => {
    const id = 'cat_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newCat = { ...catData, id };
    LocalRepository.addCategory(newCat);
    setCategories(prev => [...prev, newCat]);

    if (isCloudSynced && user) {
      AppwriteService.syncCategory(newCat, user.id).catch(console.error);
    }
    return id;
  }, [isCloudSynced, user]);

  const updateCategory = useCallback(async (cat: Category) => {
    LocalRepository.updateCategory(cat);
    setCategories(prev => prev.map(c => c.id === cat.id ? cat : c));

    if (isCloudSynced && user) {
      try {
        await AppwriteService.syncCategory(cat, user.id);
      } catch (err) {
        console.error(err);
      }
    }
  }, [isCloudSynced, user]);

  const deleteCategory = useCallback(async (id: string) => {
    LocalRepository.deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));

    if (isCloudSynced && user) {
      try {
        await AppwriteService.deleteCategory(id);
      } catch (err) {
        console.error(err);
      }
    }
  }, [isCloudSynced, user]);

  // --- Budget Ops ---
  const addBudget = useCallback(async (bData: Omit<Budget, 'id'>) => {
    const id = 'bud_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newB = { ...bData, id };
    LocalRepository.addBudget(newB);
    setBudgets(prev => [...prev, newB]);

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('budget', 'create', newB, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const updateBudget = useCallback(async (b: Budget) => {
    LocalRepository.updateBudget(b);
    setBudgets(prev => prev.map(x => x.id === b.id ? b : x));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('budget', 'update', b, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const deleteBudget = useCallback(async (id: string) => {
    LocalRepository.deleteBudget(id);
    setBudgets(prev => prev.filter(x => x.id !== id));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('budget', 'delete', { id }, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  // --- Saving Goal Ops ---
  const addGoal = useCallback(async (gData: Omit<SavingGoal, 'id'>) => {
    const id = 'goal_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newG = { ...gData, id };
    LocalRepository.addGoal(newG);
    setGoals(prev => [...prev, newG]);

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('goal', 'create', newG, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const updateGoal = useCallback(async (g: SavingGoal) => {
    LocalRepository.updateGoal(g);
    setGoals(prev => prev.map(x => x.id === g.id ? g : x));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('goal', 'update', g, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const deleteGoal = useCallback(async (id: string) => {
    LocalRepository.deleteGoal(id);
    setGoals(prev => prev.filter(x => x.id !== id));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('goal', 'delete', { id }, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  // --- Recurring Ops ---
  const addRecurring = useCallback(async (recData: Omit<RecurringTransaction, 'id'>) => {
    const id = 'rec_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newRec = { ...recData, id };
    LocalRepository.addRecurring(newRec);
    setRecurring(prev => [...prev, newRec]);

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('recurring', 'create', newRec, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const updateRecurring = useCallback(async (rec: RecurringTransaction) => {
    LocalRepository.updateRecurring(rec);
    setRecurring(prev => prev.map(x => x.id === rec.id ? rec : x));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('recurring', 'update', rec, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const deleteRecurring = useCallback(async (id: string) => {
    LocalRepository.deleteRecurring(id);
    setRecurring(prev => prev.filter(x => x.id !== id));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('recurring', 'delete', { id }, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  // --- Debt Ops ---
  const addDebt = useCallback(async (debtData: Omit<Debt, 'id'>) => {
    const id = 'debt_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newDebt = { ...debtData, id };
    LocalRepository.addDebt(newDebt);
    setDebts(prev => [...prev, newDebt]);

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('debt', 'create', newDebt, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const updateDebt = useCallback(async (debt: Debt) => {
    LocalRepository.updateDebt(debt);
    setDebts(prev => prev.map(x => x.id === debt.id ? debt : x));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('debt', 'update', debt, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  const deleteDebt = useCallback(async (id: string) => {
    LocalRepository.deleteDebt(id);
    setDebts(prev => prev.filter(x => x.id !== id));

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('debt', 'delete', { id }, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  // --- User Profile Ops ---
  const updateProfile = useCallback(async (profData: UserProfile) => {
    LocalRepository.saveProfile(profData);
    setProfile(profData);

    if (isCloudSynced && user) {
      AppwriteService.enqueueOutbox('profile', 'update', profData, user.id).catch(console.warn);
    }
  }, [isCloudSynced, user]);

  // Automated check and apply engine for recurring transactions
  useEffect(() => {
    if (!localIsOnboarded && !user) return;

    let isMounted = true;

    const processRecurring = async () => {
      const activeRecs = LocalRepository.getRecurring().filter(r => r.active);
      if (activeRecs.length === 0) return;

      const now = new Date();
      let didApplyAny = false;
      const newlyCreatedTxs: Transaction[] = [];

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
            applyTransactionToCard(newTx, false);
            newlyCreatedTxs.push(newTx);
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
        setTransactions(prev => [...newlyCreatedTxs, ...prev]);
        setRecurring([...activeRecs]);
      }
    };

    processRecurring();

    return () => {
      isMounted = false;
    };
  }, [localIsOnboarded, user, isCloudSynced, applyTransactionToCard]);

  // --- Import / Export ---
  const backupData = useCallback(() => {
    return LocalRepository.exportDataRaw();
  }, []);

  const restoreData = useCallback((json: string): boolean => {
    const success = LocalRepository.importDataRaw(json);
    if (success) {
      try {
        const backup = JSON.parse(json);
        if (Array.isArray(backup.transactions)) setTransactions(backup.transactions);
        if (Array.isArray(backup.categories)) setCategories(backup.categories);
        if (Array.isArray(backup.budgets)) setBudgets(backup.budgets);
        if (Array.isArray(backup.goals)) setGoals(backup.goals);
        if (backup.profile) setProfile(backup.profile);
        if (Array.isArray(backup.recurring)) setRecurring(backup.recurring);
        if (Array.isArray(backup.debts)) setDebts(backup.debts);
        if (Array.isArray(backup.cards)) setCards(backup.cards);
        if (Array.isArray(backup.notifications)) setNotifications(backup.notifications);
      } catch (err) {
        console.error('Error restaurando backup en estado:', err);
      }
    }
    return success;
  }, []);

  const contextValue = useMemo<AppContextType>(() => ({
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
  }), [
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
    localIsOnboarded,
    activeTab,
    user,
    isCloudSynced,
    authLoading,
    stealthMode,
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
    setStealthMode
  ]);

  return (
    <AppContext.Provider value={contextValue}>
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
