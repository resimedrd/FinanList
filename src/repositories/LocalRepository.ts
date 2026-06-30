import { Category, Transaction, Budget, SavingGoal, UserProfile, RecurringTransaction, Debt } from '../models/types';

// Key names for localStorage
const KEYS = {
  TRANSACTIONS: 'finanlist_transactions',
  CATEGORIES: 'finanlist_categories',
  BUDGETS: 'finanlist_budgets',
  GOALS: 'finanlist_goals',
  PROFILE: 'finanlist_profile',
  RECURRING: 'finanlist_recurring',
  DEBTS: 'finanlist_debts',
};

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
  { id: 'cat_travel', name: 'Viajes', color: '#00cccc', icon: 'Plane' },
  { id: 'cat_saving', name: 'Ahorro', color: '#2ecc71', icon: 'Target' },
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
  accentColor: '#8b5cf6', // Purple / Morado Bonito
  pinCode: '0000', // Generic default PIN
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
    account: 'Banco',
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
    account: 'Tarjeta',
    date: '2026-06-12',
    time: '14:30',
    notes: 'Compras semanales Walmart',
    tags: ['supermercado', 'comida'],
    color: '#ff4d4d',
    icon: 'ShoppingBasket'
  },
  {
    id: 'tx_3',
    amount: 12.80,
    type: 'expense',
    categoryId: 'cat_trans',
    subcategoryId: 'sub_uber',
    account: 'Efectivo',
    date: '2026-06-15',
    time: '18:15',
    notes: 'Regreso de la oficina',
    tags: ['transporte', 'uber'],
    color: '#3399ff',
    icon: 'Car'
  },
  {
    id: 'tx_4',
    amount: 150,
    type: 'expense',
    categoryId: 'cat_bills',
    account: 'Banco',
    date: '2026-06-10',
    time: '08:00',
    notes: 'Pago de Electricidad e Internet',
    tags: ['servicios', 'casa'],
    color: '#ffcc00',
    icon: 'Zap'
  },
  {
    id: 'tx_5',
    amount: 45,
    type: 'expense',
    categoryId: 'cat_fun',
    account: 'Tarjeta',
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
    account: 'Broker',
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
  static init() {
    if (!localStorage.getItem(KEYS.CATEGORIES)) {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    } else {
      try {
        const cats = JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]');
        const hasOldFoodCat = cats.some((c: Category) => c.id === 'cat_food');
        if (hasOldFoodCat) {
          const migratedCats = cats
            .filter((c: Category) => c.id !== 'cat_food' && c.parentId !== 'cat_food')
            .concat([
              { id: 'cat_food_super', name: 'Comida', color: '#ff4d4d', icon: 'ShoppingBasket' },
              { id: 'cat_food_out', name: 'Restaurante y pedidos', color: '#ff9f43', icon: 'Utensils' }
            ]);
          localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(migratedCats));

          const txsRaw = localStorage.getItem(KEYS.TRANSACTIONS);
          if (txsRaw) {
            const txs = JSON.parse(txsRaw);
            const migratedTxs = txs.map((tx: Transaction) => {
              if (tx.categoryId === 'cat_food') {
                const subId = tx.subcategoryId;
                const newCatId = subId === 'sub_rest' ? 'cat_food_out' : 'cat_food_super';
                const catObj = migratedCats.find((c: Category) => c.id === newCatId);
                return {
                  ...tx,
                  categoryId: newCatId,
                  subcategoryId: undefined,
                  color: catObj?.color || tx.color,
                  icon: catObj?.icon || tx.icon
                };
              }
              return tx;
            });
            localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(migratedTxs));
          }

          const budgetsRaw = localStorage.getItem(KEYS.BUDGETS);
          if (budgetsRaw) {
            const budg = JSON.parse(budgetsRaw);
            const migratedBudg = budg.map((b: Budget) => {
              if (b.categoryId === 'cat_food') {
                return { ...b, categoryId: 'cat_food_super' };
              }
              return b;
            });
            localStorage.setItem(KEYS.BUDGETS, JSON.stringify(migratedBudg));
          }
        }

        // Clean up / normalize category names to exact user preference
        let needsUpdate = false;
        const cleanedCats = cats.map((c: Category) => {
          if (c.id === 'cat_food_super' && c.name !== 'Comida') {
            needsUpdate = true;
            return { ...c, name: 'Comida' };
          }
          if (c.id === 'cat_food_out' && c.name !== 'Restaurante y pedidos') {
            needsUpdate = true;
            return { ...c, name: 'Restaurante y pedidos' };
          }
          return c;
        });
        if (needsUpdate) {
          localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(cleanedCats));
        }

        // Ensure cat_emergency exists for existing users
        const finalCats = JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]');
        if (!finalCats.some((c: Category) => c.id === 'cat_emergency')) {
          finalCats.push({ id: 'cat_emergency', name: 'Imprevistos / Emergencias', color: '#ef4444', icon: 'ShieldAlert' });
          localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(finalCats));
        }
      } catch (e) {
        console.error("Migration error: ", e);
      }
    }
  }

  // Seed data explicitly for Demo Mode
  static seedDemoData() {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
    localStorage.setItem(KEYS.GOALS, JSON.stringify(DEFAULT_GOALS));
    localStorage.setItem(KEYS.BUDGETS, JSON.stringify(DEFAULT_BUDGETS));
    
    // Seed transactions using dates relative to current month/year
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const updatedTransactions = DEFAULT_TRANSACTIONS.map(tx => ({
      ...tx,
      date: tx.date.replace('2026-06', `${currentYear}-${currentMonth}`)
    }));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updatedTransactions));
    
    // Set onboarded flag
    localStorage.setItem('finanlist_onboarded', 'true');
  }

  // --- Transactions ---
  static getTransactions(): Transaction[] {
    this.init();
    const data = localStorage.getItem(KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  }

  static saveTransactions(transactions: Transaction[]) {
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  static addTransaction(tx: Transaction) {
    const list = this.getTransactions();
    list.unshift(tx); // Newest first
    this.saveTransactions(list);
  }

  static updateTransaction(tx: Transaction) {
    const list = this.getTransactions();
    const index = list.findIndex(t => t.id === tx.id);
    if (index !== -1) {
      list[index] = tx;
      this.saveTransactions(list);
    }
  }

  static deleteTransaction(id: string) {
    const list = this.getTransactions();
    const filtered = list.filter(t => t.id !== id);
    this.saveTransactions(filtered);
  }

  // --- Categories ---
  static getCategories(): Category[] {
    this.init();
    const data = localStorage.getItem(KEYS.CATEGORIES);
    return data ? JSON.parse(data) : [];
  }

  static saveCategories(categories: Category[]) {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
  }

  static addCategory(cat: Category) {
    const list = this.getCategories();
    list.push(cat);
    this.saveCategories(list);
  }

  static updateCategory(cat: Category) {
    const list = this.getCategories();
    const index = list.findIndex(c => c.id === cat.id);
    if (index !== -1) {
      list[index] = cat;
      this.saveCategories(list);
      
      // Cascade update transactions cached colors/icons if major category changed
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

  static deleteCategory(id: string) {
    const list = this.getCategories();
    const filtered = list.filter(c => c.id !== id && c.parentId !== id);
    this.saveCategories(filtered);
  }

  // --- Budgets ---
  static getBudgets(): Budget[] {
    this.init();
    const data = localStorage.getItem(KEYS.BUDGETS);
    return data ? JSON.parse(data) : [];
  }

  static saveBudgets(budgets: Budget[]) {
    localStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets));
  }

  static addBudget(budget: Budget) {
    const list = this.getBudgets();
    list.push(budget);
    this.saveBudgets(list);
  }

  static updateBudget(budget: Budget) {
    const list = this.getBudgets();
    const index = list.findIndex(b => b.id === budget.id);
    if (index !== -1) {
      list[index] = budget;
      this.saveBudgets(list);
    }
  }

  static deleteBudget(id: string) {
    const list = this.getBudgets();
    const filtered = list.filter(b => b.id !== id);
    this.saveBudgets(filtered);
  }

  // --- Savings Goals ---
  static getGoals(): SavingGoal[] {
    this.init();
    const data = localStorage.getItem(KEYS.GOALS);
    return data ? JSON.parse(data) : [];
  }

  static saveGoals(goals: SavingGoal[]) {
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
  }

  static addGoal(goal: SavingGoal) {
    const list = this.getGoals();
    list.push(goal);
    this.saveGoals(list);
  }

  static updateGoal(goal: SavingGoal) {
    const list = this.getGoals();
    const index = list.findIndex(g => g.id === goal.id);
    if (index !== -1) {
      list[index] = goal;
      this.saveGoals(list);
    }
  }

  static deleteGoal(id: string) {
    const list = this.getGoals();
    const filtered = list.filter(g => g.id !== id);
    this.saveGoals(filtered);
  }

  // --- User Profile ---
  static getProfile(): UserProfile {
    this.init();
    const data = localStorage.getItem(KEYS.PROFILE);
    return data ? JSON.parse(data) : EMPTY_PROFILE;
  }

  static saveProfile(profile: UserProfile) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  }

  // --- Recurring Transactions ---
  static getRecurring(): RecurringTransaction[] {
    this.init();
    const data = localStorage.getItem(KEYS.RECURRING);
    return data ? JSON.parse(data) : [];
  }

  static saveRecurring(list: RecurringTransaction[]) {
    localStorage.setItem(KEYS.RECURRING, JSON.stringify(list));
  }

  static addRecurring(rec: RecurringTransaction) {
    const list = this.getRecurring();
    list.push(rec);
    this.saveRecurring(list);
  }

  static updateRecurring(rec: RecurringTransaction) {
    const list = this.getRecurring();
    const index = list.findIndex(r => r.id === rec.id);
    if (index !== -1) {
      list[index] = rec;
      this.saveRecurring(list);
    }
  }

  static deleteRecurring(id: string) {
    const list = this.getRecurring();
    const filtered = list.filter(r => r.id !== id);
    this.saveRecurring(filtered);
  }

  // --- Debts and Loans ---
  static getDebts(): Debt[] {
    this.init();
    const data = localStorage.getItem(KEYS.DEBTS);
    return data ? JSON.parse(data) : [];
  }

  static saveDebts(list: Debt[]) {
    localStorage.setItem(KEYS.DEBTS, JSON.stringify(list));
  }

  static addDebt(debt: Debt) {
    const list = this.getDebts();
    list.push(debt);
    this.saveDebts(list);
  }

  static updateDebt(debt: Debt) {
    const list = this.getDebts();
    const index = list.findIndex(d => d.id === debt.id);
    if (index !== -1) {
      list[index] = debt;
      this.saveDebts(list);
    }
  }

  static deleteDebt(id: string) {
    const list = this.getDebts();
    const filtered = list.filter(d => d.id !== id);
    this.saveDebts(filtered);
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
      version: '1.0.0',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(fullBackup);
  }

  static importDataRaw(rawJson: string): boolean {
    try {
      const data = JSON.parse(rawJson);
      if (data.transactions && data.categories && data.profile) {
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
        localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(data.categories));
        localStorage.setItem(KEYS.BUDGETS, JSON.stringify(data.budgets || []));
        localStorage.setItem(KEYS.GOALS, JSON.stringify(data.goals || []));
        localStorage.setItem(KEYS.PROFILE, JSON.stringify(data.profile));
        localStorage.setItem(KEYS.RECURRING, JSON.stringify(data.recurring || []));
        localStorage.setItem(KEYS.DEBTS, JSON.stringify(data.debts || []));
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
    const input = text.toLowerCase().trim();
    if (!input) return '';
    
    // Supermercado / Compras para casa
    if (/supermercado|bravo|nacional|sirena|jumbo|colmado|despensa|comida en casa|groceries/i.test(input)) {
      return 'cat_food_super';
    }
    // Comida fuera / Pedidos / Salidas
    if (/mcdonald|pizza|burger|burger king|restaurant|café|coffee|starbucks|uber eats|pedidosya|comida fuera|delivery|pedido|cena|almuerzo|desayuno|salida|snack|dulce|pan/i.test(input)) {
      return 'cat_food_out';
    }
    // Transport keywords
    if (/uber|taxi|diDi|indriver|carro|combustible|gasolina|gasoil|peaje|taller|repuesto|mantenimiento|moto|metro|autobús|publico/i.test(input)) {
      return 'cat_trans';
    }
    // Entertainment keywords
    if (/netflix|spotify|disney|hbo|cine|movie|teatro|concierto|salida|bar|trago|cerveza|fiesta|juego|gaming|steam|playstation/i.test(input)) {
      return 'cat_fun';
    }
    // Shopping keywords
    if (/tienda|ropa|zapatos|camisa|mall|plaza|zara|h&m|amazon|shein|ebay|regalo|juguete|compras|adornos|reloj/i.test(input)) {
      return 'cat_shop';
    }
    // Bills & Services keywords
    if (/teléfono|claro|altice|wind|luz|edeeste|edesur|edenorte|agua|internet|cable|basura|alquiler|casa|mantenimiento/i.test(input)) {
      return 'cat_bills';
    }
    // Health keywords
    if (/farmacia|carol|medicamento|medicina|doctor|consulta|clinica|hospital|dentista|odontologo|seguro medico/i.test(input)) {
      return 'cat_health';
    }
    // Travel keywords
    if (/vuelo|avion|hotel|airbnb|playa|resort|reserva|maleta|vacaciones/i.test(input)) {
      return 'cat_travel';
    }
    // Savings keywords
    if (/ahorro|depósito|meta|cooperativa|fondo/i.test(input)) {
      return 'cat_saving';
    }
    
    return '';
  }
}
