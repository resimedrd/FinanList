import { Category, Transaction, Budget, SavingGoal, UserProfile, RecurringTransaction, Debt, PaymentCard, FinancialNotification, BudgetDistributionTargets } from '../models/types';
import { CategoryDetector } from '../services/CategoryDetector';
import { CryptoService } from '../services/CryptoService';
import { IndexedDBAdapter, IDB_CONFIG } from './IndexedDBAdapter';

// Claves legadas para localStorage (usadas para detección y migración)
export const KEYS = {
  TRANSACTIONS: 'finanlist_transactions',
  CATEGORIES: 'finanlist_categories',
  BUDGETS: 'finanlist_budgets',
  GOALS: 'finanlist_goals',
  PROFILE: 'finanlist_profile',
  RECURRING: 'finanlist_recurring',
  DEBTS: 'finanlist_debts',
  CARDS: 'finanlist_cards',
  NOTIFICATIONS: 'finanlist_notifications',
  DISTRIBUTION_TARGETS: 'finanlist_distribution_targets',
  LAST_RESET: 'finanlist_last_reset_at',
  IS_RESET: 'finanlist_is_reset',
  LAST_RESET_TIMESTAMP: 'finanlist_last_reset_timestamp',
};

const DEFAULT_CARDS: PaymentCard[] = [
  {
    id: 'card_debit_default',
    name: 'BHD Débito Nómina',
    bank: 'Banco BHD',
    type: 'debit',
    lastFourDigits: '4120',
    currency: 'RD$',
    color: '#059669', // Emerald
    isActive: true,
    initialBalance: 15000,
    currentBalance: 15000,
    minBalanceAlert: 3000,
    allowOverdraft: false,
    overdraftLimit: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'card_credit_default',
    name: 'Banreservas Visa Oro',
    bank: 'Banreservas',
    type: 'credit',
    lastFourDigits: '8834',
    currency: 'RD$',
    color: '#4f46e5', // Indigo
    isActive: true,
    creditLimit: 50000,
    balanceUsed: 6500,
    alertThresholdPercent: 80,
    billingCutoffDay: 15,
    paymentDueDay: 5,
    createdAt: new Date().toISOString()
  }
];

// Seed Data
const DEFAULT_CATEGORIES: Category[] = [
  // Expenses
  { id: 'cat_food_super', name: 'Comida', color: '#ff4d4d', icon: 'ShoppingBasket' },
  { id: 'cat_food_out', name: 'Restaurante y pedidos', color: '#ff9f43', icon: 'Utensils' },
  { id: 'cat_trans', name: 'Transporte', color: '#3399ff', icon: 'Car' },
  { id: 'cat_fun', name: 'Entretenimiento', color: '#b366ff', icon: 'Tv' },
  { id: 'cat_shop', name: 'Compras', color: '#ff66b2', icon: 'ShoppingBag' },
  { id: 'cat_bills', name: 'Servicios', color: '#ffcc00', icon: 'Zap' },
  { id: 'cat_health', name: 'Salud', color: '#22c55e', icon: 'HeartPulse' },
  { id: 'cat_personal', name: 'Cuidado Personal', color: '#ec4899', icon: 'Sparkles' },
  { id: 'cat_travel', name: 'Viajes', color: '#00cccc', icon: 'Plane' },
  { id: 'cat_saving', name: 'Ahorro', color: '#2ecc71', icon: 'Target' },
  { id: 'cat_loan', name: 'Préstamos y Deudas', color: '#6366f1', icon: 'HandCoins' },
  { id: 'cat_emergency', name: 'Imprevistos / Emergencias', color: '#ef4444', icon: 'ShieldAlert' },
  
  // Subcategories
  { id: 'sub_uber', name: 'Uber / Taxi', parentId: 'cat_trans', color: '#4da6ff', icon: 'Sparkles' },
  { id: 'sub_gas', name: 'Gasolina', parentId: 'cat_trans', color: '#1a8cff', icon: 'Fuel' },
  
  // Incomes
  { id: 'cat_sal', name: 'Sueldo', color: '#2ecc71', icon: 'Briefcase' },
  { id: 'cat_inv', name: 'Inversiones', color: '#1abc9c', icon: 'TrendingUp' },
  { id: 'cat_extra', name: 'Extras', color: '#95a5a6', icon: 'Coins' }
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'Usuario Demo',
  username: 'usuario_demo',
  email: 'demo@example.com',
  avatar: '',
  currency: 'RD$',
  language: 'es',
  theme: 'dark',
  accentColor: '#8b5cf6',
  pinCode: undefined,
  biometricsEnabled: false,
};

const EMPTY_PROFILE: UserProfile = {
  name: '',
  avatar: '',
  currency: 'RD$',
  language: 'es',
  theme: 'dark',
  accentColor: '#6366f1',
};

const DEFAULT_GOALS: SavingGoal[] = [
  { id: 'goal_car', name: 'Comprar Vehículo', targetAmount: 15000, currentAmount: 4500, icon: 'Car', color: '#3399ff', targetDate: '2027-12-31' },
  { id: 'goal_trip', name: 'Viaje a Japón', targetAmount: 6000, currentAmount: 3200, icon: 'Plane', color: '#00cccc', targetDate: '2026-11-15' },
  { id: 'goal_emerg', name: 'Fondo de Emergencia', targetAmount: 5000, currentAmount: 2500, icon: 'ShieldAlert', color: '#2ecc71', targetDate: '2026-12-31' }
];

const DEFAULT_BUDGETS: Budget[] = [
  { id: 'bud_monthly_total', amount: 2000, type: 'monthly', startDate: '2026-06-01', endDate: '2026-06-30', name: 'Presupuesto Mensual' },
  { id: 'bud_food', amount: 500, type: 'category', categoryId: 'cat_food_super', startDate: '2026-06-01', endDate: '2026-06-30', name: 'Supermercado' },
  { id: 'bud_fun', amount: 300, type: 'category', categoryId: 'cat_fun', startDate: '2026-06-01', endDate: '2026-06-30', name: 'Entretenimiento' }
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_1',
    amount: 3200,
    type: 'income',
    categoryId: 'cat_sal',
    paymentMethod: 'card',
    cardId: 'card_debit_default',
    account: 'BHD Nómina Débito',
    date: '2026-06-05',
    time: '09:00',
    notes: 'Pago mensual de nómina',
    tags: ['salario', 'trabajo'],
    color: '#2ecc71',
    icon: 'Briefcase'
  },
  {
    id: 'tx_2',
    amount: 85.50,
    type: 'expense',
    categoryId: 'cat_food_super',
    paymentMethod: 'card',
    cardId: 'card_credit_default',
    account: 'Banreservas Visa Oro',
    date: '2026-06-12',
    time: '14:30',
    notes: 'Compras semanales Walmart',
    tags: ['supermercado', 'comida'],
    color: '#ff4d4d',
    icon: 'ShoppingBasket'
  },
  {
    id: 'tx_3',
    amount: 45,
    type: 'expense',
    categoryId: 'sub_gas',
    subcategoryId: 'sub_gas',
    paymentMethod: 'card',
    cardId: 'card_credit_default',
    account: 'Banreservas Visa Oro',
    date: '2026-06-14',
    time: '18:15',
    notes: 'Tanque lleno estación Shell',
    tags: ['gasolina', 'auto'],
    color: '#1a8cff',
    icon: 'Fuel'
  },
  {
    id: 'tx_4',
    amount: 25.50,
    type: 'expense',
    categoryId: 'cat_food_out',
    paymentMethod: 'card',
    cardId: 'card_credit_default',
    account: 'Banreservas Visa Oro',
    date: '2026-06-15',
    time: '12:45',
    notes: 'Almuerzo hamburguesa',
    tags: ['comida', 'salida'],
    color: '#ff9f43',
    icon: 'Utensils'
  },
  {
    id: 'tx_5',
    amount: 120,
    type: 'expense',
    categoryId: 'cat_fun',
    paymentMethod: 'card',
    cardId: 'card_credit_default',
    account: 'Banreservas Visa Oro',
    date: '2026-06-18',
    time: '21:00',
    notes: 'Cena y Cine',
    tags: ['salida', 'cine'],
    color: '#b366ff',
    icon: 'Tv'
  },
  {
    id: 'tx_6',
    amount: 150,
    type: 'income',
    categoryId: 'cat_inv',
    account: 'Inversiones',
    date: '2026-06-20',
    time: '10:00',
    notes: 'Dividendos acciones',
    tags: ['dividendos', 'inversion'],
    color: '#1abc9c',
    icon: 'TrendingUp'
  },
  {
    id: 'tx_7',
    amount: 60,
    type: 'expense',
    categoryId: 'cat_food_out',
    account: 'Tarjeta',
    date: '2026-06-25',
    time: '13:00',
    notes: 'Almuerzo ejecutivo de negocios',
    tags: ['restaurante', 'almuerzo'],
    color: '#ff9f43',
    icon: 'Utensils',
    favorite: true
  }
];

export class LocalRepository {
  // Cache en memoria para respuestas síncronas de latencia cero (<1 ms)
  private static cache: {
    transactions?: Transaction[];
    categories?: Category[];
    budgets?: Budget[];
    goals?: SavingGoal[];
    profile?: UserProfile;
    recurring?: RecurringTransaction[];
    debts?: Debt[];
    cards?: PaymentCard[];
    notifications?: FinancialNotification[];
    distributionTargets?: BudgetDistributionTargets;
    lastResetAt?: string | null;
  } = {};

  private static isInitialized = false;

  /**
   * Inicializa el repositorio. Lee desde el almacenamiento existente,
   * asegura la estructura base e inicia la migración transparente hacia IndexedDB.
   */
  static init(): void {
    if (this.isInitialized) return;

    // 1. Categories iniciales
    if (typeof localStorage !== 'undefined') {
      const rawCats = localStorage.getItem(KEYS.CATEGORIES);
      if (!rawCats) {
        this.cache.categories = [...DEFAULT_CATEGORIES];
        localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      } else {
        try {
          const cats: Category[] = JSON.parse(rawCats);
          let needsUpdate = false;

          // Migración suave de cat_loan y cat_personal
          if (!cats.some(c => c.id === 'cat_personal')) {
            cats.push({ id: 'cat_personal', name: 'Cuidado Personal', color: '#ec4899', icon: 'Sparkles' });
            needsUpdate = true;
          }
          if (!cats.some(c => c.id === 'cat_loan')) {
            cats.push({ id: 'cat_loan', name: 'Préstamos y Deudas', color: '#6366f1', icon: 'HandCoins' });
            needsUpdate = true;
          }
          if (!cats.some(c => c.id === 'cat_emergency')) {
            cats.push({ id: 'cat_emergency', name: 'Imprevistos / Emergencias', color: '#ef4444', icon: 'ShieldAlert' });
            needsUpdate = true;
          }

          if (needsUpdate) {
            localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(cats));
          }
          this.cache.categories = cats;
        } catch {
          this.cache.categories = [...DEFAULT_CATEGORIES];
        }
      }

      // 2. Tarjetas
      const rawCards = localStorage.getItem(KEYS.CARDS);
      if (!rawCards) {
        this.cache.cards = [];
        localStorage.setItem(KEYS.CARDS, '[]');
      } else {
        try {
          this.cache.cards = JSON.parse(rawCards);
        } catch {
          this.cache.cards = [];
          localStorage.setItem(KEYS.CARDS, '[]');
        }
      }

      // 3. Demás entidades desde localStorage si existen
      const rawTxs = localStorage.getItem(KEYS.TRANSACTIONS);
      if (rawTxs) {
        try { this.cache.transactions = JSON.parse(rawTxs); } catch {}
      }
      const rawBudgets = localStorage.getItem(KEYS.BUDGETS);
      if (rawBudgets) {
        try { this.cache.budgets = JSON.parse(rawBudgets); } catch {}
      }
      const rawGoals = localStorage.getItem(KEYS.GOALS);
      if (rawGoals) {
        try { this.cache.goals = JSON.parse(rawGoals); } catch {}
      }
      const rawDebts = localStorage.getItem(KEYS.DEBTS);
      if (rawDebts) {
        try { this.cache.debts = JSON.parse(rawDebts); } catch {}
      }
      const rawRec = localStorage.getItem(KEYS.RECURRING);
      if (rawRec) {
        try { this.cache.recurring = JSON.parse(rawRec); } catch {}
      }
      const rawNotifs = localStorage.getItem(KEYS.NOTIFICATIONS);
      if (rawNotifs) {
        try { this.cache.notifications = JSON.parse(rawNotifs); } catch {}
      }
      const rawProfile = localStorage.getItem(KEYS.PROFILE);
      if (rawProfile) {
        try { this.cache.profile = JSON.parse(rawProfile); } catch {}
      }

      // 4. Lanzar migración asíncrona hacia IndexedDB para liberar cuota de localStorage
      if (IndexedDBAdapter.isAvailable()) {
        IndexedDBAdapter.migrateFromLocalStorage(KEYS).catch((err) => {
          console.warn('[LocalRepository] Migración asíncrona a IndexedDB pospuesta:', err);
        });
      }
    }

    this.isInitialized = true;
  }

  /**
   * Carga asíncrona explícita desde IndexedDB hacia la memoria de la aplicación.
   */
  static async initAsync(): Promise<void> {
    this.init();

    if (!IndexedDBAdapter.isAvailable()) return;

    try {
      const stores = IDB_CONFIG.stores;
      const [txs, cats, budgets, goals, debts, cards, rec, notifs, profile] = await Promise.all([
        IndexedDBAdapter.getAll<Transaction>(stores.TRANSACTIONS),
        IndexedDBAdapter.getAll<Category>(stores.CATEGORIES),
        IndexedDBAdapter.getAll<Budget>(stores.BUDGETS),
        IndexedDBAdapter.getAll<SavingGoal>(stores.GOALS),
        IndexedDBAdapter.getAll<Debt>(stores.DEBTS),
        IndexedDBAdapter.getAll<PaymentCard>(stores.CARDS),
        IndexedDBAdapter.getAll<RecurringTransaction>(stores.RECURRING),
        IndexedDBAdapter.getAll<FinancialNotification>(stores.NOTIFICATIONS),
        IndexedDBAdapter.getKeyVal<UserProfile>('profile')
      ]);

      const isResetFlag = this.isReset();

      if (txs) this.cache.transactions = (isResetFlag && txs.length === 0) ? [] : (txs.length > 0 ? txs : this.cache.transactions || []);
      if (cats && cats.length > 0) this.cache.categories = cats;
      if (budgets) this.cache.budgets = (isResetFlag && budgets.length === 0) ? [] : (budgets.length > 0 ? budgets : this.cache.budgets || []);
      if (goals) this.cache.goals = (isResetFlag && goals.length === 0) ? [] : (goals.length > 0 ? goals : this.cache.goals || []);
      if (debts) this.cache.debts = (isResetFlag && debts.length === 0) ? [] : (debts.length > 0 ? debts : this.cache.debts || []);
      if (cards) this.cache.cards = (isResetFlag && cards.length === 0) ? [] : (cards.length > 0 ? cards : this.cache.cards || []);
      if (rec) this.cache.recurring = (isResetFlag && rec.length === 0) ? [] : (rec.length > 0 ? rec : this.cache.recurring || []);
      if (notifs) this.cache.notifications = (isResetFlag && notifs.length === 0) ? [] : (notifs.length > 0 ? notifs : this.cache.notifications || []);
      if (profile) {
        if (profile.pinCode && CryptoService.isLegacyPlaintext(profile.pinCode)) {
          try {
            const hashed = await CryptoService.hashPin(profile.pinCode);
            profile.pinCode = hashed;
            await IndexedDBAdapter.setKeyVal('profile', profile);
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
            }
          } catch (pinErr) {
            console.warn('[LocalRepository] Error migrando PIN a SHA-256 en initAsync:', pinErr);
          }
        }
        this.cache.profile = profile;
      }
    } catch (e) {
      console.warn('[LocalRepository] Error en initAsync:', e);
    }
  }

  // Seed data explícita para Modo Demo
  static seedDemoData(): void {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const updatedTransactions = DEFAULT_TRANSACTIONS.map(tx => ({
      ...tx,
      date: tx.date.replace('2026-06', `${currentYear}-${currentMonth}`)
    }));

    this.cache.profile = { ...DEFAULT_PROFILE };
    this.cache.goals = [...DEFAULT_GOALS];
    this.cache.budgets = [...DEFAULT_BUDGETS];
    this.cache.cards = [...DEFAULT_CARDS];
    this.cache.notifications = [];
    this.cache.transactions = updatedTransactions;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
      localStorage.setItem(KEYS.GOALS, JSON.stringify(DEFAULT_GOALS));
      localStorage.setItem(KEYS.BUDGETS, JSON.stringify(DEFAULT_BUDGETS));
      localStorage.setItem(KEYS.CARDS, JSON.stringify(DEFAULT_CARDS));
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updatedTransactions));
      localStorage.setItem('finanlist_onboarded', 'true');
    }

    // Persistir en IndexedDB
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.TRANSACTIONS, updatedTransactions).catch(() => {});
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.CARDS, DEFAULT_CARDS).catch(() => {});
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.GOALS, DEFAULT_GOALS).catch(() => {});
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.BUDGETS, DEFAULT_BUDGETS).catch(() => {});
    IndexedDBAdapter.setKeyVal('profile', DEFAULT_PROFILE).catch(() => {});
  }

  // --- Transacciones ---
  static getTransactions(): Transaction[] {
    this.init();
    if (this.cache.transactions) return this.cache.transactions;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.TRANSACTIONS);
      if (data) {
        try {
          this.cache.transactions = JSON.parse(data);
          return this.cache.transactions!;
        } catch {}
      }
    }
    this.cache.transactions = [];
    return this.cache.transactions;
  }

  static saveTransactions(transactions: Transaction[]): void {
    this.cache.transactions = [...transactions];
    // Persistencia asíncrona a IndexedDB (soporta fotos en Base64 sin límite de 5MB)
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.TRANSACTIONS, transactions).catch(console.warn);

    // Si no contiene fotos pesadas, mantener respaldo en localStorage para máxima compatibilidad
    if (typeof localStorage !== 'undefined') {
      try {
        const hasHeavyPhotos = transactions.some(t => t.receiptPhoto && t.receiptPhoto.length > 50000);
        if (!hasHeavyPhotos) {
          localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
        } else {
          // Remueve de localStorage para no agotar la cuota si hay fotos
          localStorage.removeItem(KEYS.TRANSACTIONS);
        }
      } catch {
        localStorage.removeItem(KEYS.TRANSACTIONS);
      }
    }
  }

  static addTransaction(tx: Transaction): void {
    const list = this.getTransactions();
    const updated = [tx, ...list];
    this.cache.transactions = updated;
    IndexedDBAdapter.put(IDB_CONFIG.stores.TRANSACTIONS, tx).catch(console.warn);
    this.saveTransactions(updated);
  }

  static updateTransaction(tx: Transaction): void {
    const list = this.getTransactions();
    const updated = list.map(t => t.id === tx.id ? tx : t);
    this.cache.transactions = updated;
    IndexedDBAdapter.put(IDB_CONFIG.stores.TRANSACTIONS, tx).catch(console.warn);
    this.saveTransactions(updated);
  }

  static deleteTransaction(id: string): void {
    const list = this.getTransactions();
    const updated = list.filter(t => t.id !== id);
    this.cache.transactions = updated;
    IndexedDBAdapter.delete(IDB_CONFIG.stores.TRANSACTIONS, id).catch(console.warn);
    this.saveTransactions(updated);
  }

  // --- Categorías ---
  static getCategories(): Category[] {
    this.init();
    if (this.cache.categories && this.cache.categories.length > 0) return this.cache.categories;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.CATEGORIES);
      if (data) {
        try {
          this.cache.categories = JSON.parse(data);
          return this.cache.categories!;
        } catch {}
      }
    }
    this.cache.categories = [...DEFAULT_CATEGORIES];
    return this.cache.categories;
  }

  static saveCategories(categories: Category[]): void {
    this.cache.categories = [...categories];
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.CATEGORIES, categories).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    }
  }

  static addCategory(cat: Category): void {
    const list = this.getCategories();
    list.push(cat);
    this.saveCategories(list);
  }

  static updateCategory(cat: Category): void {
    const list = this.getCategories();
    const index = list.findIndex(c => c.id === cat.id);
    if (index !== -1) {
      list[index] = cat;
      this.saveCategories(list);
      
      const txs = this.getTransactions();
      let changed = false;
      const updatedTxs = txs.map(tx => {
        if (tx.categoryId === cat.id) {
          changed = true;
          return { ...tx, color: cat.color, icon: cat.icon };
        }
        return tx;
      });
      if (changed) {
        this.saveTransactions(updatedTxs);
      }
    }
  }

  static deleteCategory(id: string): void {
    const list = this.getCategories();
    const filtered = list.filter(c => c.id !== id && c.parentId !== id);
    this.saveCategories(filtered);
  }

  // --- Presupuestos ---
  static getBudgets(): Budget[] {
    this.init();
    if (this.cache.budgets) return this.cache.budgets;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.BUDGETS);
      if (data) {
        try {
          this.cache.budgets = JSON.parse(data);
          return this.cache.budgets!;
        } catch {}
      }
    }
    this.cache.budgets = [];
    return this.cache.budgets;
  }

  static saveBudgets(budgets: Budget[]): void {
    this.cache.budgets = [...budgets];
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.BUDGETS, budgets).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets));
    }
  }

  static addBudget(budget: Budget): void {
    const list = this.getBudgets();
    list.push(budget);
    this.saveBudgets(list);
  }

  static updateBudget(budget: Budget): void {
    const list = this.getBudgets();
    const index = list.findIndex(b => b.id === budget.id);
    if (index !== -1) {
      list[index] = budget;
      this.saveBudgets(list);
    }
  }

  static deleteBudget(id: string): void {
    const list = this.getBudgets();
    const filtered = list.filter(b => b.id !== id);
    this.saveBudgets(filtered);
  }

  // --- Metas de Ahorro ---
  static getGoals(): SavingGoal[] {
    this.init();
    if (this.cache.goals) return this.cache.goals;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.GOALS);
      if (data) {
        try {
          this.cache.goals = JSON.parse(data);
          return this.cache.goals!;
        } catch {}
      }
    }
    this.cache.goals = [];
    return this.cache.goals;
  }

  static saveGoals(goals: SavingGoal[]): void {
    this.cache.goals = [...goals];
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.GOALS, goals).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
    }
  }

  static addGoal(goal: SavingGoal): void {
    const list = this.getGoals();
    list.push(goal);
    this.saveGoals(list);
  }

  static updateGoal(goal: SavingGoal): void {
    const list = this.getGoals();
    const index = list.findIndex(g => g.id === goal.id);
    if (index !== -1) {
      list[index] = goal;
      this.saveGoals(list);
    }
  }

  static deleteGoal(id: string): void {
    const list = this.getGoals();
    const filtered = list.filter(g => g.id !== id);
    this.saveGoals(filtered);
  }

  // --- Perfil de Usuario ---
  static getProfile(): UserProfile {
    this.init();
    if (this.cache.profile) return this.cache.profile;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.PROFILE);
      if (data) {
        try {
          this.cache.profile = JSON.parse(data);
          return this.cache.profile!;
        } catch {}
      }
    }
    this.cache.profile = { ...EMPTY_PROFILE };
    return this.cache.profile;
  }

  static saveProfile(profile: UserProfile): void {
    const profCopy = { ...profile };
    this.cache.profile = profCopy;

    // Si el PIN viene en texto plano legado (4-6 dígitos), nunca almacenarlo en claro
    if (profCopy.pinCode && CryptoService.isLegacyPlaintext(profCopy.pinCode)) {
      CryptoService.hashPin(profCopy.pinCode)
        .then((hashed) => {
          profCopy.pinCode = hashed;
          IndexedDBAdapter.setKeyVal('profile', profCopy).catch(console.warn);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(KEYS.PROFILE, JSON.stringify(profCopy));
          }
        })
        .catch(console.warn);
    } else {
      IndexedDBAdapter.setKeyVal('profile', profCopy).catch(console.warn);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(KEYS.PROFILE, JSON.stringify(profCopy));
      }
    }
  }

  // --- Metas de Distribución Presupuestaria (Mi Fórmula) ---
  static getDistributionTargets(): BudgetDistributionTargets {
    this.init();
    if (this.cache.distributionTargets) return this.cache.distributionTargets;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.DISTRIBUTION_TARGETS);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed.needs === 'number' && typeof parsed.wants === 'number' && typeof parsed.savings === 'number') {
            this.cache.distributionTargets = parsed;
            return parsed;
          }
        } catch {}
      }
    }
    const profile = this.getProfile();
    if (profile.budgetDistribution) {
      this.cache.distributionTargets = profile.budgetDistribution;
      return profile.budgetDistribution;
    }
    return { needs: 50, wants: 30, savings: 20 };
  }

  static saveDistributionTargets(targets: BudgetDistributionTargets): void {
    this.cache.distributionTargets = targets;
    IndexedDBAdapter.setKeyVal('distribution_targets', targets).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.DISTRIBUTION_TARGETS, JSON.stringify(targets));
      try {
        const profile = this.getProfile();
        if (profile) {
          profile.budgetDistribution = targets;
          this.saveProfile(profile);
        }
      } catch (e) {
        console.warn('Error guardando targets en perfil:', e);
      }
    }
  }

  // --- Transacciones Recurrentes ---
  static getRecurring(): RecurringTransaction[] {
    this.init();
    if (this.cache.recurring) return this.cache.recurring;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.RECURRING);
      if (data) {
        try {
          this.cache.recurring = JSON.parse(data);
          return this.cache.recurring!;
        } catch {}
      }
    }
    this.cache.recurring = [];
    return this.cache.recurring;
  }

  static saveRecurring(list: RecurringTransaction[]): void {
    this.cache.recurring = [...list];
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.RECURRING, list).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.RECURRING, JSON.stringify(list));
    }
  }

  static addRecurring(rec: RecurringTransaction): void {
    const list = this.getRecurring();
    list.push(rec);
    this.saveRecurring(list);
  }

  static updateRecurring(rec: RecurringTransaction): void {
    const list = this.getRecurring();
    const index = list.findIndex(r => r.id === rec.id);
    if (index !== -1) {
      list[index] = rec;
      this.saveRecurring(list);
    }
  }

  static deleteRecurring(id: string): void {
    const list = this.getRecurring();
    const filtered = list.filter(r => r.id !== id);
    this.saveRecurring(filtered);
  }

  // --- Deudas y Préstamos ---
  static getDebts(): Debt[] {
    this.init();
    if (this.cache.debts) return this.cache.debts;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.DEBTS);
      if (data) {
        try {
          this.cache.debts = JSON.parse(data);
          return this.cache.debts!;
        } catch {}
      }
    }
    this.cache.debts = [];
    return this.cache.debts;
  }

  static saveDebts(list: Debt[]): void {
    this.cache.debts = [...list];
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.DEBTS, list).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.DEBTS, JSON.stringify(list));
    }
  }

  static addDebt(debt: Debt): void {
    const list = this.getDebts();
    list.push(debt);
    this.saveDebts(list);
  }

  static updateDebt(debt: Debt): void {
    const list = this.getDebts();
    const index = list.findIndex(d => d.id === debt.id);
    if (index !== -1) {
      list[index] = debt;
      this.saveDebts(list);
    }
  }

  static deleteDebt(id: string): void {
    const list = this.getDebts();
    const filtered = list.filter(d => d.id !== id);
    this.saveDebts(filtered);
  }

  // --- Tarjetas de Pago ---
  static getCards(): PaymentCard[] {
    this.init();
    if (this.cache.cards) return this.cache.cards.map(c => ({ ...c }));
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.CARDS);
      if (data) {
        try {
          this.cache.cards = JSON.parse(data);
          return this.cache.cards!.map(c => ({ ...c }));
        } catch {}
      }
    }
    this.cache.cards = [];
    return [];
  }

  static saveCards(list: PaymentCard[]): void {
    this.cache.cards = list.map(c => ({ ...c }));
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.CARDS, list).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.CARDS, JSON.stringify(list));
    }
  }

  static addCard(card: PaymentCard): void {
    const list = this.getCards();
    list.push(card);
    this.saveCards(list);
  }

  static updateCard(card: PaymentCard): void {
    const list = this.getCards();
    const index = list.findIndex(c => c.id === card.id);
    if (index !== -1) {
      list[index] = card;
      this.saveCards(list);
    }
  }

  static deleteCard(id: string): void {
    const list = this.getCards();
    const filtered = list.filter(c => c.id !== id);
    this.saveCards(filtered);
  }

  // --- Notificaciones ---
  static getNotifications(): FinancialNotification[] {
    this.init();
    if (this.cache.notifications) return this.cache.notifications;
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(KEYS.NOTIFICATIONS);
      if (data) {
        try {
          this.cache.notifications = JSON.parse(data);
          return this.cache.notifications!;
        } catch {}
      }
    }
    this.cache.notifications = [];
    return this.cache.notifications;
  }

  static saveNotifications(list: FinancialNotification[]): void {
    this.cache.notifications = [...list];
    IndexedDBAdapter.setAll(IDB_CONFIG.stores.NOTIFICATIONS, list).catch(console.warn);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(list));
    }
  }

  static addNotification(notif: FinancialNotification): void {
    const list = this.getNotifications();
    list.unshift(notif);
    this.saveNotifications(list);
  }

  static markNotificationAsRead(id: string): void {
    const list = this.getNotifications();
    const item = list.find(n => n.id === id);
    if (item) {
      item.isRead = true;
      this.saveNotifications(list);
    }
  }

  static markAllNotificationsAsRead(): void {
    const list = this.getNotifications();
    list.forEach(n => { n.isRead = true; });
    this.saveNotifications(list);
  }

  static deleteNotification(id: string): void {
    const list = this.getNotifications();
    const filtered = list.filter(n => n.id !== id);
    this.saveNotifications(filtered);
  }

  static clearNotifications(): void {
    this.saveNotifications([]);
  }

  // --- Reset & Sincronización ---
  static getLastResetAt(): string | null {
    if (this.cache.lastResetAt !== undefined) return this.cache.lastResetAt;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(KEYS.LAST_RESET);
    }
    return null;
  }

  static setLastResetAt(isoString: string): void {
    this.cache.lastResetAt = isoString;
    IndexedDBAdapter.setKeyVal('last_reset_at', isoString).catch(() => {});
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.LAST_RESET, isoString);
    }
  }

  static isReset(): boolean {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem(KEYS.IS_RESET) === 'true' || !!localStorage.getItem(KEYS.LAST_RESET)) {
        return true;
      }
    }
    return !!this.cache.lastResetAt;
  }

  static async resetFinancialData(): Promise<void> {
    const nowIso = new Date().toISOString();

    this.cache.transactions = [];
    this.cache.budgets = [];
    this.cache.goals = [];
    this.cache.debts = [];
    this.cache.recurring = [];
    this.cache.cards = [];
    this.cache.notifications = [];
    this.cache.lastResetAt = nowIso;

    // Guardar explícitamente arrays vacíos en localStorage (en lugar de removeItem)
    // para evitar que el chequeo de null en init() vuelva a sembrar datos por defecto
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEYS.TRANSACTIONS, '[]');
      localStorage.setItem(KEYS.BUDGETS, '[]');
      localStorage.setItem(KEYS.GOALS, '[]');
      localStorage.setItem(KEYS.DEBTS, '[]');
      localStorage.setItem(KEYS.RECURRING, '[]');
      localStorage.setItem(KEYS.CARDS, '[]');
      localStorage.setItem(KEYS.NOTIFICATIONS, '[]');
      localStorage.setItem(KEYS.LAST_RESET, nowIso);
      localStorage.setItem(KEYS.IS_RESET, 'true');
      localStorage.setItem(KEYS.LAST_RESET_TIMESTAMP, String(Date.now()));
    }

    // Limpieza atómica y exhaustiva de IndexedDB (AWAIT EXPLÍCITO)
    await Promise.all([
      IndexedDBAdapter.clear(IDB_CONFIG.stores.TRANSACTIONS),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.BUDGETS),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.GOALS),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.DEBTS),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.RECURRING),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.CARDS),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.NOTIFICATIONS),
      IndexedDBAdapter.clear(IDB_CONFIG.stores.OUTBOX),
      IndexedDBAdapter.setKeyVal('last_reset_at', nowIso),
      IndexedDBAdapter.setKeyVal('is_reset', true),
      IndexedDBAdapter.setKeyVal('last_reset_timestamp', Date.now())
    ]);
  }

  // --- Backup and Import/Export ---
  static exportDataRaw(): string {
    const fullBackup = {
      transactions: this.getTransactions(),
      categories: this.getCategories(),
      budgets: this.getBudgets(),
      goals: this.getGoals(),
      profile: this.getProfile(),
      recurring: this.getRecurring(),
      debts: this.getDebts(),
      cards: this.getCards(),
      notifications: this.getNotifications(),
      version: '1.2.0',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(fullBackup);
  }

  static importDataRaw(rawJson: string): boolean {
    try {
      const data = JSON.parse(rawJson);
      if (data.transactions && data.categories && data.profile) {
        this.saveTransactions(data.transactions);
        this.saveCategories(data.categories);
        this.saveBudgets(data.budgets || []);
        this.saveGoals(data.goals || []);
        this.saveProfile(data.profile);
        this.saveRecurring(data.recurring || []);
        this.saveDebts(data.debts || []);
        if (data.cards) this.saveCards(data.cards);
        if (data.notifications) this.saveNotifications(data.notifications);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // AI Local Classification Helper
  static getCategorySuggestionByText(text: string): string {
    const categories = this.getCategories();
    const result = CategoryDetector.detect(text, categories);
    return result ? result.categoryId : '';
  }
}
