import { describe, it, expect } from 'vitest';
import { StatsService } from '../StatsService';
import { Transaction } from '../../models/types';
import { getTodayDateString } from '../../utils/dateUtils';

describe('StatsService', () => {
  const today = getTodayDateString();

  const mockTransactions: Transaction[] = [
    {
      id: 'tx_1',
      amount: 1000,
      type: 'income',
      categoryId: 'cat_sal',
      account: 'Banco',
      date: today,
      time: '10:00',
      color: '#2ecc71',
      icon: 'Briefcase'
    },
    {
      id: 'tx_2',
      amount: 300,
      type: 'expense',
      categoryId: 'cat_food_super',
      account: 'Banco',
      date: today,
      time: '12:00',
      color: '#ff4d4d',
      icon: 'ShoppingBasket'
    },
    {
      id: 'tx_3',
      amount: 150,
      type: 'payment', // Credit card payment
      categoryId: 'cat_bills',
      account: 'Banco',
      date: today,
      time: '14:00',
      color: '#4f46e5',
      icon: 'CreditCard'
    },
    {
      id: 'tx_4',
      amount: 100,
      type: 'expense',
      categoryId: 'cat_saving',
      account: 'Banco',
      date: today,
      time: '16:00',
      color: '#2ecc71',
      icon: 'Target'
    }
  ];

  it('correctly calculates total balance and available cash accounting for payments', () => {
    const summary = StatsService.getSummary(mockTransactions, []);
    
    // Income: +1000
    // Expense: -300 (food) -100 (saving) = -400
    // Payment: -150
    // Balance: 1000 - 300 - 150 - 100 = 450
    expect(summary.totalBalance).toBe(450);
    expect(summary.availableCash).toBe(450);
    expect(summary.monthlyIncome).toBe(1000);
    // monthlyExpense includes expenses (300 + 100 = 400), but NOT payment (150)
    expect(summary.monthlyExpense).toBe(400);
    expect(summary.monthlySavings).toBe(100);
  });

  it('calculates category breakdown accurately', () => {
    const breakdown = StatsService.getExpenseByCategory(mockTransactions);
    expect(breakdown).toHaveLength(2); // cat_food_super (300) and cat_saving (100)
    
    const foodCat = breakdown.find(b => b.categoryId === 'cat_food_super');
    expect(foodCat).toBeDefined();
    expect(foodCat?.amount).toBe(300);

    const savingCat = breakdown.find(b => b.categoryId === 'cat_saving');
    expect(savingCat).toBeDefined();
    expect(savingCat?.amount).toBe(100);
  });

  it('keeps totalBalance / availableCash (Saldo Actual) independent of unpaid borrowed debts and credit card debt', () => {
    // User has RD$ 20,000 in bank, but has a loan of RD$ 50,000 to pay in installments
    const salaryTx: Transaction = {
      id: 'tx_salary',
      amount: 20000,
      type: 'income',
      categoryId: 'cat_sal',
      account: 'Banco',
      date: today,
      time: '09:00',
      color: '#2ecc71',
      icon: 'Briefcase'
    };

    const debts = [
      {
        id: 'debt_loan_1',
        personOrInstitution: 'Préstamo Banco',
        amount: 50000,
        remainingAmount: 50000,
        type: 'borrowed' as const
      }
    ];

    // Summary calculation
    const summary = StatsService.getSummary([salaryTx], [], [], undefined, debts);

    // Saldo Actual MUST be 20,000 (the money the user actually possesses), NOT -30,000!
    expect(summary.totalBalance).toBe(20000);
    expect(summary.availableCash).toBe(20000);
    expect(summary.currentBalance).toBe(20000);

    // Debt is tracked independently
    expect(summary.totalOwedDebts).toBe(50000);

    // Patrimonio Neto reflects the full picture: 20,000 - 50,000 = -30,000
    expect(summary.consolidatedNetBalance).toBe(-30000);
  });

  it('deducts from totalBalance only when an actual abono or payment to the debt is executed', () => {
    const salaryTx: Transaction = {
      id: 'tx_salary',
      amount: 20000,
      type: 'income',
      categoryId: 'cat_sal',
      account: 'Banco',
      date: today,
      time: '09:00',
      color: '#2ecc71',
      icon: 'Briefcase'
    };

    // User makes an installment payment / abono of RD$ 5,000 towards the loan
    const abonoTx: Transaction = {
      id: 'tx_abono',
      amount: 5000,
      type: 'expense',
      categoryId: 'cat_bills',
      account: 'Banco',
      date: today,
      time: '11:00',
      notes: 'Abono a deuda: Préstamo Banco',
      color: '#ef4444',
      icon: 'ArrowUpRight'
    };

    // Debt is now reduced to 45,000 remaining
    const debts = [
      {
        id: 'debt_loan_1',
        personOrInstitution: 'Préstamo Banco',
        amount: 50000,
        remainingAmount: 45000,
        type: 'borrowed' as const
      }
    ];

    const summary = StatsService.getSummary([salaryTx, abonoTx], [], [], undefined, debts);

    // Saldo Actual is now 20,000 - 5,000 = 15,000
    expect(summary.totalBalance).toBe(15000);
    expect(summary.availableCash).toBe(15000);
    expect(summary.currentBalance).toBe(15000);

    // Debt reflects updated remaining balance
    expect(summary.totalOwedDebts).toBe(45000);

    // Net worth remains 15,000 - 45,000 = -30,000
    expect(summary.consolidatedNetBalance).toBe(-30000);
  });
});
