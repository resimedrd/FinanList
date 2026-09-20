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
  alertThresholdPercent?: number; // Configurable alert threshold: 80, 90, 100 (%)
  billingCutoffDay?: number;   // Día de corte (1-31)
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

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'payment';
  categoryId: string;
  subcategoryId?: string;
  account: string;      // e.g., "Efectivo", "Tarjeta", "Banco"
  cardId?: string;      // Associated PaymentCard ID if paid with card
  destinationCardId?: string; // For card payments: which credit card received the payment
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM
  notes?: string;
  tags?: string[];
  color: string;        // Cache category color for easy lookup
  icon: string;         // Cache category icon
  receiptPhoto?: string; // base64 string
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
  categoryId?: string; // Required if type is 'category'
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  name?: string;       // Custom name for the budget
}

export interface SavingGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  icon: string;
  color: string;
  targetDate: string;  // YYYY-MM-DD
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
}


export interface FinancialSummary {
  totalBalance: number;
  availableCash: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  budgetProgress: number; // 0 to 100
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  account: string;
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
  dueDate?: string;     // YYYY-MM-DD
  interestRate?: number; // %
  notes?: string;
}
