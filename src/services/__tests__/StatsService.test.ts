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
});
