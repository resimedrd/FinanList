import { Transaction, PaymentCard, Budget, Debt } from '../models/types';
import { roundCurrency, safeSubtract } from '../utils/currencyUtils';
import { getTodayDateString } from '../utils/dateUtils';

export interface FinancialEngineSummary {
  // Saldo Total Consolidado (Patrimonio Neto Total): Activos (Líquidos + Inversiones + Por Cobrar) - Pasivos (Tarjetas + Deudas)
  consolidatedNetBalance: number;

  // Dinero Disponible Líquido (Efectivo + Cuentas Bancarias / Débito)
  availableLiquidCash: number;

  // Deuda Total de Tarjetas de Crédito (Pasivo acumulado por compras en crédito)
  totalCreditCardDebt: number;

  // Crédito Disponible Total para gastar en tarjetas de crédito activas
  totalCreditAvailable: number;

  // Límite de Crédito Total aprobado
  totalCreditLimit: number;

  // Desglose de activos por tipo de cuenta
  cashBalance: number;
  bankBalance: number;
  investmentsBalance: number;

  // Deudas y cuentas por cobrar
  totalReceivables: number; // Préstamos otorgados a otros pendientes de cobro (Activo)
  totalOwedDebts: number;   // Deudas adquiridas pendientes de pago a terceros (Pasivo)

  // Métricas mensuales del mes en curso
  monthlyIncome: number;
  monthlyExpense: number; // Solo gastos de consumo (excluye pagos de tarjetas y transferencias)
  monthlySavings: number;
  budgetProgress: number; // Porcentaje de consumo presupuestario 0-100
}

export class FinancialEngine {
  /**
   * Obtiene la clave "YYYY-MM" de una fecha.
   */
  private static getYearMonth(dateStr: string): string {
    if (!dateStr || dateStr.length < 7) {
      return getTodayDateString().substring(0, 7);
    }
    return dateStr.substring(0, 7);
  }

  /**
   * Retorna el año y mes actual en hora local "YYYY-MM".
   */
  private static getCurrentYearMonth(): string {
    return getTodayDateString().substring(0, 7);
  }

  /**
   * Calcula el resumen financiero consolidado como Fuente Única de Verdad (Single Source of Truth).
   */
  static calculateSummary(
    transactions: Transaction[],
    cards: PaymentCard[],
    budgets: Budget[] = [],
    dateFilter?: (dateStr: string) => boolean,
    debts: Debt[] = []
  ): FinancialEngineSummary {
    const currentYM = this.getCurrentYearMonth();

    // 1. Tarjetas de Crédito: cálculo directo y exacto de Pasivos y Crédito Disponible
    const activeCreditCards = cards.filter(c => c.isActive && c.type === 'credit');
    const totalCreditLimit = roundCurrency(
      activeCreditCards.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0)
    );
    const totalCreditCardDebt = roundCurrency(
      activeCreditCards.reduce((sum, c) => sum + (c.balanceUsed ?? 0), 0)
    );
    const totalCreditAvailable = roundCurrency(
      activeCreditCards.reduce((sum, c) => {
        const limit = c.creditLimit ?? 0;
        const used = c.balanceUsed ?? 0;
        return sum + Math.max(0, limit - used);
      }, 0)
    );

    // 2. Tarjetas de Débito: saldo en cuentas bancarias asociadas
    const activeDebitCards = cards.filter(c => c.isActive && c.type === 'debit');
    const debitCardsBalance = roundCurrency(
      activeDebitCards.reduce((sum, c) => sum + (c.currentBalance ?? 0), 0)
    );

    // 3. Cuentas de Efectivo, Banco general e Inversiones desde el historial de transacciones
    let cash = 0;
    let bankGeneral = 0;
    let investments = 0;

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let monthlySavings = 0;

    transactions.forEach(tx => {
      const amt = tx.amount;
      const isCurrentMonth = dateFilter ? dateFilter(tx.date) : (this.getYearMonth(tx.date) === currentYM);
      const acc = (tx.account || '').trim().toLowerCase();
      const isDebitOrExpense = tx.type === 'expense' || tx.type === 'payment';
      const isIncome = tx.type === 'income';

      // Comprobar si la transacción está explícitamente ligada a una tarjeta de débito o crédito
      const associatedCard = tx.cardId ? cards.find(c => c.id === tx.cardId) : undefined;

      // Métricas de flujo del mes
      if (isCurrentMonth) {
        if (isIncome && !acc.includes('broker') && !acc.includes('inversiones')) {
          monthlyIncome += amt;
        } else if (tx.type === 'expense' && !acc.includes('broker') && !acc.includes('inversiones')) {
          // Un pago a tarjeta de crédito ('payment') NO es un gasto de consumo, es amortización de deuda
          monthlyExpense += amt;
          if (tx.categoryId === 'cat_saving' || (tx.notes && tx.notes.includes('#goal:'))) {
            monthlySavings += amt;
          }
        }
      }

      // Distribución por cuenta de liquidez
      if (acc.includes('broker') || acc.includes('inversiones')) {
        if (isIncome) investments += amt;
        else if (isDebitOrExpense) investments -= amt;
      } else if (acc.includes('efectivo') || (!associatedCard && !acc.includes('banco') && !acc.includes('tarjeta'))) {
        // Movimientos en efectivo
        if (isIncome) cash += amt;
        else if (isDebitOrExpense) cash -= amt;
      } else if (associatedCard) {
        // Si está asociada a una tarjeta de débito o crédito registrada,
        // el saldo de la tarjeta se gestiona en la entidad PaymentCard.
        // Pero si fue un pago realizado en efectivo o cuenta bancaria genérica:
        if (tx.type === 'payment' && !tx.cardId && tx.destinationCardId) {
          // Pago en efectivo a la tarjeta
          cash -= amt;
        }
      } else {
        // Banco general sin tarjeta específica
        if (isIncome) bankGeneral += amt;
        else if (isDebitOrExpense) bankGeneral -= amt;
      }
    });

    // 4. Consolidación de Dinero Disponible Líquido (Activos)
    // El banco total incluye el saldo de las tarjetas de débito activas + banco general no ligado
    const bankTotal = roundCurrency(bankGeneral + debitCardsBalance);
    const cashTotal = roundCurrency(cash);
    const investmentsTotal = roundCurrency(investments);

    const availableLiquidCash = roundCurrency(cashTotal + bankTotal);

    // 5. Cuentas por Cobrar (dinero prestado a terceros) y Deudas Personales (por pagar)
    const activeReceivables = (debts || []).filter(d => d.type === 'lent' && d.remainingAmount > 0);
    const totalReceivables = roundCurrency(
      activeReceivables.reduce((sum, d) => sum + (d.remainingAmount ?? d.amount ?? 0), 0)
    );

    const activePayables = (debts || []).filter(d => d.type === 'borrowed' && d.remainingAmount > 0);
    const totalOwedDebts = roundCurrency(
      activePayables.reduce((sum, d) => sum + (d.remainingAmount ?? d.amount ?? 0), 0)
    );

    // 6. Saldo Total Consolidado (Patrimonio Neto Total):
    // (Activos Líquidos + Inversiones + Cuentas por Cobrar) - (Deuda Tarjetas + Préstamos por Pagar)
    const totalAssets = roundCurrency(availableLiquidCash + investmentsTotal + totalReceivables);
    const totalLiabilities = roundCurrency(totalCreditCardDebt + totalOwedDebts);
    const consolidatedNetBalance = roundCurrency(safeSubtract(totalAssets, totalLiabilities));

    // 7. Progreso del presupuesto
    let budgetProgress = 0;
    const monthlyTotalBudget = budgets.find(b => b.type === 'monthly');
    if (monthlyTotalBudget && monthlyTotalBudget.amount > 0) {
      const activeCategoryBudgetIds = new Set(
        budgets.filter(x => x.type === 'category' && x.categoryId).map(x => x.categoryId)
      );
      const generalExpenses = transactions
        .filter(tx => tx.type === 'expense' && 
                      tx.date >= monthlyTotalBudget.startDate && 
                      tx.date <= monthlyTotalBudget.endDate && 
                      !activeCategoryBudgetIds.has(tx.categoryId) && 
                      tx.categoryId !== 'cat_saving')
        .reduce((sum, tx) => sum + tx.amount, 0);

      budgetProgress = Math.min(100, (generalExpenses / monthlyTotalBudget.amount) * 100);
    } else {
      const catBudgets = budgets.filter(b => b.type === 'category');
      const totalCatBudget = catBudgets.reduce((sum, b) => sum + b.amount, 0);
      if (totalCatBudget > 0) {
        let totalMatchedExpense = 0;
        catBudgets.forEach(b => {
          const matchedExpense = transactions
            .filter(tx => tx.type === 'expense' && tx.date >= b.startDate && tx.date <= b.endDate && tx.categoryId === b.categoryId)
            .reduce((sum, tx) => sum + tx.amount, 0);
          totalMatchedExpense += matchedExpense;
        });
        budgetProgress = Math.min(100, (totalMatchedExpense / totalCatBudget) * 100);
      }
    }

    return {
      consolidatedNetBalance,
      availableLiquidCash,
      totalCreditCardDebt,
      totalCreditAvailable,
      totalCreditLimit,
      cashBalance: cashTotal,
      bankBalance: bankTotal,
      investmentsBalance: investmentsTotal,
      totalReceivables,
      totalOwedDebts,
      monthlyIncome: roundCurrency(monthlyIncome),
      monthlyExpense: roundCurrency(monthlyExpense),
      monthlySavings: roundCurrency(monthlySavings),
      budgetProgress: roundCurrency(budgetProgress)
    };
  }

  /**
   * Calcula los días restantes para el día de corte de una tarjeta de crédito.
   */
  static getDaysUntilCutoff(cutoffDay: number = 15, fromDate: Date = new Date()): {
    days: number;
    nextDate: Date;
    isToday: boolean;
  } {
    const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const currentDay = today.getDate();
    
    let targetMonth = today.getMonth();
    let targetYear = today.getFullYear();
    
    if (currentDay > cutoffDay) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }
    
    const targetDate = new Date(targetYear, targetMonth, cutoffDay);
    const diffTime = targetDate.getTime() - today.getTime();
    const days = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    
    return {
      days,
      nextDate: targetDate,
      isToday: days === 0
    };
  }

  /**
   * Calcula los días restantes para la fecha límite de pago de una tarjeta de crédito.
   */
  static getDaysUntilPaymentDue(paymentDueDay: number = 5, fromDate: Date = new Date()): {
    days: number;
    nextDate: Date;
    isToday: boolean;
  } {
    const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const currentDay = today.getDate();
    
    let targetMonth = today.getMonth();
    let targetYear = today.getFullYear();
    
    if (currentDay > paymentDueDay) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }
    
    const targetDate = new Date(targetYear, targetMonth, paymentDueDay);
    const diffTime = targetDate.getTime() - today.getTime();
    const days = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    
    return {
      days,
      nextDate: targetDate,
      isToday: days === 0
    };
  }
}
