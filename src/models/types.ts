export interface Category {
  id: string;
  name: string;
  parentId?: string; // Optional for subcategories
  color: string;     // Hex or HSL
  icon: string;      // Lucide icon name
}

export type CardType = 'debit' | 'credit';

export interface PaymentCard {
  id: string;
  name: string;                // e.g. "BHD Débito", "Visa Oro Banreservas"
  bank: string;                // e.g. "Banco BHD", "Banreservas", "Banco Popular"
  type: CardType;              // 'debit' | 'credit'
  lastFourDigits?: string;     // e.g. "4589" (only 4 digits, never CVV or full card number!)
  currency: string;            // e.g. "RD$", "$", "€"
  color: string;               // Card theme / gradient color
  isActive: boolean;           // Active or inactive

  // Debit card specific fields
  initialBalance?: number;     // Starting balance
  currentBalance?: number;     // Current available balance for debit
  minBalanceAlert?: number;    // Configurable minimum balance threshold (e.g. 5000)
  allowOverdraft?: boolean;    // Allow calculated negative balance or overdraft
  overdraftLimit?: number;     // Maximum authorized overdraft limit

  // Credit card specific fields
  creditLimit?: number;        // Total credit limit approved
  balanceUsed?: number;        // Total amount spent / balance used
  positiveBalance?: number;    // Saldo a favor por sobrepago (>= 0)
  alertThresholdPercent?: number; // Configurable alert threshold: 80, 90, 100 (%)
  cutoffDay?: number;          // Día del mes en que corta la tarjeta (1-31)
  billingCutoffDay?: number;   // Alias para retrocompatibilidad (1-31)
  graceDays?: number;          // Días de gracia tras el corte para pagar (default: 20)
  paymentDueDay?: number;      // Día límite de pago (1-31)

  createdAt: string;
  updatedAt?: string;
}

export interface FinancialNotification {
  id: string;
  cardId?: string;
  cardName?: string;
  type: 'low_balance' | 'overdraft' | 'credit_threshold' | 'over_credit_limit' | 'info';
  severity: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'card';

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'payment';
  categoryId: string;
  subcategoryId?: string;
  paymentMethod?: PaymentMethod; // 'cash' | 'card'
  account: string;               // e.g. "Efectivo", or card name (e.g. "BHD Débito", "Visa Oro")
  cardId?: string;               // Associated PaymentCard ID if paid with card
  destinationCardId?: string;    // For card payments: which credit card received the payment
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:MM
  notes?: string;
  tags?: string[];
  color: string;                 // Cache category color for easy lookup
  icon: string;                  // Cache category icon
  receiptPhoto?: string;         // base64 string
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
  };
  favorite?: boolean;
}

export interface Budget {
  id: string;
  amount: number;
  contingencyAmount?: number; // Optional fund for emergency contingencies
  type: 'weekly' | 'monthly' | 'category';
  categoryId?: string;        // Required if type is 'category'
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  name?: string;              // Custom name for the budget
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;      // Amount allocated/frozen in this goal
  icon: string;
  color: string;
  targetDate: string;         // YYYY-MM-DD
}

export interface InvestmentPosition {
  id: string;
  name: string;              // e.g. "S&P 500 ETF", "Fondo Mutuo Renta Fija", "Acciones Apple"
  type?: 'etf' | 'stocks' | 'crypto' | 'real_estate' | 'fixed_income' | 'other';
  amountInvested: number;    // Capital aportado total acumulado
  currentValue: number;      // Valor actual estimado de mercado
  yieldAmount?: number;      // Ganancia/Rendimiento acumulado
  currency: string;
  notes?: string;
  updatedAt: string;
}

export interface InvestmentMove {
  id: string;
  investmentId?: string;
  type: 'deposit' | 'yield' | 'withdrawal';
  amount: number;
  sourceType: PaymentMethod; // 'cash' | 'card'
  cardId?: string;
  date: string;              // YYYY-MM-DD
  notes?: string;
}

export interface BudgetDistributionTargets {
  needs: number;    // % (0-100)
  wants: number;    // % (0-100)
  savings: number;  // % (0-100)
}

export interface CustomDistributionResult {
  needs: number;
  wants: number;
  savings: number;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  targetNeeds: number;
  targetWants: number;
  targetSavings: number;
  totalSpent: number;
  totalIncome: number;
  score: number;
  status: string;
  recommendation: string;
  differences: {
    needsDiff: number;    // needsPct - targetNeeds
    wantsDiff: number;    // wantsPct - targetWants
    savingsDiff: number;  // savingsPct - targetSavings
  };
}

export interface UserProfile {
  name: string;
  username?: string;    // Custom login username
  email?: string;       // User email address
  avatar: string;       // base64 or placeholder initial
  currency: string;     // e.g., "$", "€", "COL$"
  language: 'es' | 'en';
  theme: 'light' | 'dark' | 'system';
  accentColor: string;  // e.g., HSL or hex color
  pinCode?: string;      // PIN for app security lock
  biometricsEnabled?: boolean;
  stealthModeEnabled?: boolean;
  budgetDistribution?: BudgetDistributionTargets;
}

export interface FinancialSummary {
  totalBalance: number;
  availableCash: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  budgetProgress: number; // 0 to 100
  cashBalance?: number;
  debitCardsBalance?: number;
  goalsFrozenBalance?: number;
  unallocatedLiquidCash?: number;
  totalCreditAvailable?: number;
  totalCreditLimit?: number;
  totalCreditCardDebt?: number;
  investmentsBalance?: number;
  totalReceivables?: number;
  totalOwedDebts?: number;
  totalPositiveBalance?: number;
  statementBalance?: number;
  currentCycleExpenses?: number;
  nextCutoffInfo?: {
    cardName: string;
    cutoffDate: string;
    daysRemaining: number;
    isPastCutoff: boolean;
  };
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  account: string;
  cardId?: string;
  notes?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;      // YYYY-MM-DD
  lastAppliedDate?: string; // YYYY-MM-DD
  active: boolean;
  color: string;
  icon: string;
}

export interface Debt {
  id: string;
  personOrInstitution: string;
  amount: number;
  remainingAmount: number;
  type: 'lent' | 'borrowed'; // 'lent' (me deben), 'borrowed' (yo debo)
  dueDate?: string;          // YYYY-MM-DD
  interestRate?: number;     // %
  notes?: string;
  linkedCardId?: string;     // Optional: ID de tarjeta de crédito asociada (libera cupo al pagar)
}
