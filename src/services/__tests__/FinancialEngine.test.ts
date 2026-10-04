import { describe, it, expect } from 'vitest';
import { FinancialEngine } from '../FinancialEngine';
import { Transaction, PaymentCard } from '../../models/types';
import { getTodayDateString } from '../../utils/dateUtils';

describe('FinancialEngine', () => {
  const today = getTodayDateString();

  const creditCard: PaymentCard = {
    id: 'card_credit_1',
    name: 'Visa Platinum',
    bank: 'Banco BHD',
    type: 'credit',
    currency: 'RD$',
    color: '#4f46e5',
    isActive: true,
    creditLimit: 50000,
    balanceUsed: 10000,
    alertThresholdPercent: 80,
    billingCutoffDay: 15,
    paymentDueDay: 5,
    createdAt: new Date().toISOString()
  };

  const debitCard: PaymentCard = {
    id: 'card_debit_1',
    name: 'Cuenta Nómina',
    bank: 'Banreservas',
    type: 'debit',
    currency: 'RD$',
    color: '#059669',
    isActive: true,
    initialBalance: 20000,
    currentBalance: 20000,
    allowOverdraft: false,
    overdraftLimit: 0,
    createdAt: new Date().toISOString()
  };

  it('correctly calculates consolidated net balance: Liquid Assets - Credit Card Debt', () => {
    // Liquid Assets:
    // Cash from tx: 5,000
    // Debit Card balance: 20,000
    // Total Liquid: 25,000
    // Liabilities:
    // Credit Card Debt: 10,000
    // Expected Consolidated Net: 25,000 - 10,000 = 15,000
    const cashIncomeTx: Transaction = {
      id: 'tx_cash_1',
      amount: 5000,
      type: 'income',
      categoryId: 'cat_sal',
      account: 'Efectivo',
      date: today,
      time: '09:00',
      color: '#2ecc71',
      icon: 'Cash'
    };

    const summary = FinancialEngine.calculateSummary([cashIncomeTx], [creditCard, debitCard]);

    expect(summary.cashBalance).toBe(5000);
    expect(summary.bankBalance).toBe(20000);
    expect(summary.availableLiquidCash).toBe(25000);
    expect(summary.totalCreditCardDebt).toBe(10000);
    expect(summary.totalCreditAvailable).toBe(40000);
    expect(summary.totalCreditLimit).toBe(50000);
    expect(summary.consolidatedNetBalance).toBe(15000);
  });

  it('credit card expense increases debt without reducing liquid cash or bank balances', () => {
    // Initial: Cash 5,000, Debit 20,000 -> Liquid 25,000. Debt: 10,000. Net: 15,000.
    // Credit card expense: RD$ 2,000 with Visa Platinum
    const initialTxs: Transaction[] = [
      {
        id: 'tx_cash_1',
        amount: 5000,
        type: 'income',
        categoryId: 'cat_sal',
        account: 'Efectivo',
        date: today,
        time: '09:00',
        color: '#2ecc71',
        icon: 'Cash'
      },
      {
        id: 'tx_cc_exp_1',
        amount: 2000,
        type: 'expense',
        categoryId: 'cat_food_super',
        account: creditCard.name,
        cardId: creditCard.id,
        date: today,
        time: '14:00',
        color: '#ef4444',
        icon: 'ShoppingCart'
      }
    ];

    // Simulating how AppContext updates creditCard.balanceUsed when cardId is set:
    const updatedCreditCard: PaymentCard = {
      ...creditCard,
      balanceUsed: 12000 // 10,000 + 2,000
    };

    const summary = FinancialEngine.calculateSummary(initialTxs, [updatedCreditCard, debitCard]);

    // Liquid cash and bank must be COMPLETELY UNTOUCHED by a credit card purchase
    expect(summary.cashBalance).toBe(5000);
    expect(summary.bankBalance).toBe(20000);
    expect(summary.availableLiquidCash).toBe(25000);

    // Debt increased by 2,000
    expect(summary.totalCreditCardDebt).toBe(12000);
    expect(summary.totalCreditAvailable).toBe(38000);

    // Consolidated Net decreased by 2,000 (from 15,000 to 13,000)
    expect(summary.consolidatedNetBalance).toBe(13000);

    // Monthly expense includes the 2,000
    expect(summary.monthlyExpense).toBe(2000);
  });

  it('payment to credit card amortizes debt and does NOT double-deduct from net balance or count as living expense', () => {
    // Starting with updated state: Debt 12,000, Debit 20,000, Cash 5,000.
    // User pays RD$ 5,000 to the credit card from their debit account
    const paymentTx: Transaction = {
      id: 'tx_pay_1',
      amount: 5000,
      type: 'payment',
      categoryId: 'cat_bills',
      account: debitCard.name,
      cardId: debitCard.id,
      destinationCardId: creditCard.id,
      date: today,
      time: '16:00',
      color: '#4f46e5',
      icon: 'CreditCard'
    };

    const txs: Transaction[] = [
      {
        id: 'tx_cash_1',
        amount: 5000,
        type: 'income',
        categoryId: 'cat_sal',
        account: 'Efectivo',
        date: today,
        time: '09:00',
        color: '#2ecc71',
        icon: 'Cash'
      },
      {
        id: 'tx_cc_exp_1',
        amount: 2000,
        type: 'expense',
        categoryId: 'cat_food_super',
        account: creditCard.name,
        cardId: creditCard.id,
        date: today,
        time: '14:00',
        color: '#ef4444',
        icon: 'ShoppingCart'
      },
      paymentTx
    ];

    // Simulating AppContext card updates for payment:
    // Debit card drops by 5,000 (20,000 -> 15,000)
    // Credit card balanceUsed drops by 5,000 (12,000 -> 7,000)
    const paidDebitCard: PaymentCard = {
      ...debitCard,
      currentBalance: 15000
    };
    const amortizedCreditCard: PaymentCard = {
      ...creditCard,
      balanceUsed: 7000
    };

    const summary = FinancialEngine.calculateSummary(txs, [amortizedCreditCard, paidDebitCard]);

    // Liquid cash = 5,000 + 15,000 = 20,000
    expect(summary.availableLiquidCash).toBe(20000);
    // Debt = 7,000
    expect(summary.totalCreditCardDebt).toBe(7000);
    // Net = 20,000 - 7,000 = 13,000 (CONSOLIDATED NET BALANCE STAYS CONSTANT!)
    expect(summary.consolidatedNetBalance).toBe(13000);

    // Monthly expense MUST NOT include the 5,000 payment (still only 2,000 living expense)
    expect(summary.monthlyExpense).toBe(2000);
  });

  it('handles transactions without cards cleanly (legacy backwards compatibility)', () => {
    const legacyTxs: Transaction[] = [
      {
        id: 'leg_1',
        amount: 8000,
        type: 'income',
        categoryId: 'cat_sal',
        account: 'Banco',
        date: today,
        time: '10:00',
        color: '#2ecc71',
        icon: 'Bank'
      },
      {
        id: 'leg_2',
        amount: 1500,
        type: 'expense',
        categoryId: 'cat_food',
        account: 'Banco',
        date: today,
        time: '12:00',
        color: '#ef4444',
        icon: 'Food'
      }
    ];

    const summary = FinancialEngine.calculateSummary(legacyTxs, []);

    expect(summary.bankBalance).toBe(6500);
    expect(summary.cashBalance).toBe(0);
    expect(summary.availableLiquidCash).toBe(6500);
    expect(summary.totalCreditCardDebt).toBe(0);
    expect(summary.consolidatedNetBalance).toBe(6500);
    expect(summary.monthlyIncome).toBe(8000);
    expect(summary.monthlyExpense).toBe(1500);
  });
});
