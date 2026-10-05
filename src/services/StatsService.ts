import { Transaction, Budget, PaymentCard, Debt, Category, BudgetDistributionTargets, CustomDistributionResult } from '../models/types';
import { parseLocalDate, getDaysInMonth } from '../utils/dateUtils';
import { FinancialEngine } from './FinancialEngine';

export class StatsService {
  // Get date info
  private static getYearMonth(dateStr: string): string {
    return dateStr.substring(0, 7); // "YYYY-MM"
  }

  private static getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // Calculates standard dashboard statistics
  static getSummary(
    transactions: Transaction[],
    budgets: Budget[],
    cards: PaymentCard[] = [],
    dateFilter?: (dateStr: string) => boolean,
    debts: Debt[] = [],
    goals: any[] = []
  ): {
    totalBalance: number;
    availableCash: number;
    currentBalance: number;
    availableLiquidCash: number;
    monthlyIncome: number;
    monthlyExpense: number;
    monthlySavings: number;
    budgetProgress: number; // overall percentage
    consolidatedNetBalance: number;
    totalCreditCardDebt: number;
    totalCreditAvailable: number;
    totalCreditLimit: number;
    totalPositiveBalance: number;
    statementBalance: number;
    currentCycleExpenses: number;
    nextCutoffInfo?: {
      cardName: string;
      cutoffDate: string;
      daysRemaining: number;
      isPastCutoff: boolean;
    };
    cashBalance: number;
    bankBalance: number;
    debitCardsBalance: number;
    goalsFrozenBalance: number;
    unallocatedLiquidCash: number;
    investmentsBalance: number;
    totalReceivables: number;
    totalOwedDebts: number;
  } {
    const summary = FinancialEngine.calculateSummary(transactions, cards, budgets, dateFilter, debts, goals);

    return {
      totalBalance: summary.availableLiquidCash,
      availableCash: summary.availableLiquidCash,
      currentBalance: summary.availableLiquidCash,
      availableLiquidCash: summary.availableLiquidCash,
      monthlyIncome: summary.monthlyIncome,
      monthlyExpense: summary.monthlyExpense,
      monthlySavings: summary.monthlySavings,
      budgetProgress: summary.budgetProgress,
      consolidatedNetBalance: summary.consolidatedNetBalance,
      totalCreditCardDebt: summary.totalCreditCardDebt,
      totalCreditAvailable: summary.totalCreditAvailable,
      totalCreditLimit: summary.totalCreditLimit,
      totalPositiveBalance: summary.totalPositiveBalance,
      statementBalance: summary.statementBalance,
      currentCycleExpenses: summary.currentCycleExpenses,
      nextCutoffInfo: summary.nextCutoffInfo,
      cashBalance: summary.cashBalance,
      bankBalance: summary.bankBalance,
      debitCardsBalance: summary.debitCardsBalance,
      goalsFrozenBalance: summary.goalsFrozenBalance,
      unallocatedLiquidCash: summary.unallocatedLiquidCash,
      investmentsBalance: summary.investmentsBalance,
      totalReceivables: summary.totalReceivables,
      totalOwedDebts: summary.totalOwedDebts
    };
  }

  /**
   * Calcula la distribución de gastos del mes frente a la fórmula personalizada del usuario.
   * Evalúa score, estado y recomendaciones exclusivamente respecto a los objetivos configurados.
   */
  static calculateCustomDistribution(
    transactions: Transaction[],
    categories: Category[] = [],
    targets: BudgetDistributionTargets = { needs: 50, wants: 30, savings: 20 },
    currentYM?: string
  ): CustomDistributionResult {
    const ym = currentYM || this.getCurrentYearMonth();
    const monthlyTxs = transactions.filter(t => t.date && t.date.substring(0, 7) === ym);

    const totalIncome = monthlyTxs
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    let needs = 0;
    let wants = 0;
    let savings = 0;

    monthlyTxs.forEach(t => {
      if (t.type === 'expense') {
        const catId = t.categoryId || '';
        const catObj = categories.find(c => c.id === catId);
        const parentId = catObj?.parentId || '';
        const catNameLower = (catObj?.name || '').toLowerCase();

        // 1. Ahorro / Inversión
        if (
          catId === 'cat_saving' ||
          catId === 'cat_inv' ||
          t.notes?.includes('#goal:') ||
          catNameLower.includes('ahorro') ||
          catNameLower.includes('inversi')
        ) {
          savings += t.amount;
        }
        // 2. Necesidades básicas
        else if (
          catId === 'cat_food_super' ||
          catId === 'cat_bills' ||
          catId === 'cat_trans' ||
          catId === 'cat_health' ||
          catId === 'cat_emergency' ||
          parentId === 'cat_trans' ||
          catNameLower.includes('supermercado') ||
          catNameLower.includes('comida') ||
          catNameLower.includes('servicio') ||
          catNameLower.includes('transporte') ||
          catNameLower.includes('gasolina') ||
          catNameLower.includes('salud') ||
          catNameLower.includes('farmacia') ||
          catNameLower.includes('alquiler') ||
          catNameLower.includes('renta') ||
          catNameLower.includes('luz') ||
          catNameLower.includes('agua') ||
          catNameLower.includes('internet')
        ) {
          needs += t.amount;
        }
        // 3. Deseos y gastos discrecionales
        else {
          wants += t.amount;
        }
      }
    });

    const totalSpent = needs + wants + savings;
    const baseBudget = totalIncome > 0 ? totalIncome : totalSpent;
    const needsPct = baseBudget > 0 ? (needs / baseBudget) * 100 : 0;
    const wantsPct = baseBudget > 0 ? (wants / baseBudget) * 100 : 0;
    const savingsPct = baseBudget > 0 ? (savings / baseBudget) * 100 : 0;

    const targetNeeds = targets.needs;
    const targetWants = targets.wants;
    const targetSavings = targets.savings;

    const needsDiff = needsPct - targetNeeds;
    const wantsDiff = wantsPct - targetWants;
    const savingsDiff = savingsPct - targetSavings;

    let score = 100;
    let status = 'Fórmula Alineada';
    let recommendation = '¡Felicidades! Tus gastos están perfectamente alineados con los objetivos de tu fórmula personalizada.';

    const alerts: string[] = [];

    // Evaluación relativa al objetivo del usuario:
    if (needsPct > targetNeeds + 5) {
      score -= (needsPct - targetNeeds) * 1.5;
      status = 'Necesidades Elevadas';
      alerts.push(`Tus gastos fijos y necesidades (${needsPct.toFixed(0)}%) superan tu objetivo del ${targetNeeds}%.`);
    }

    if (wantsPct > targetWants + 5) {
      score -= (wantsPct - targetWants) * 2;
      status = status === 'Fórmula Alineada' ? 'Exceso en Deseos' : `${status} y Deseos`;
      alerts.push(`Estás destinando el ${wantsPct.toFixed(0)}% a deseos (meta: ${targetWants}%).`);
    }

    // Ahorro e Inversión: evaluado exclusivamente contra el objetivo del usuario
    if (targetSavings > 0) {
      const minAcceptableSavings = targetSavings * 0.75;
      if (savingsPct < minAcceptableSavings) {
        score -= (targetSavings - savingsPct) * 2.5;
        if (status === 'Fórmula Alineada') {
          status = 'Ahorro por Debajo del Objetivo';
        }
        alerts.push(`Tu tasa de ahorro (${savingsPct.toFixed(0)}%) está por debajo de tu meta del ${targetSavings}%.`);
      }
    }

    if (alerts.length > 0) {
      recommendation = alerts.join(' ');
    }

    score = Math.max(10, Math.min(100, Math.round(score)));

    return {
      needs: Math.round(needs * 100) / 100,
      wants: Math.round(wants * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      needsPct,
      wantsPct,
      savingsPct,
      targetNeeds,
      targetWants,
      targetSavings,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      score,
      status,
      recommendation,
      differences: {
        needsDiff: Math.round(needsDiff * 10) / 10,
        wantsDiff: Math.round(wantsDiff * 10) / 10,
        savingsDiff: Math.round(savingsDiff * 10) / 10
      }
    };
  }

  // Get total expense and percentage split by category
  static getExpenseByCategory(transactions: Transaction[], dateFilter?: (dateStr: string) => boolean): Array<{
    categoryId: string;
    name: string;
    amount: number;
    percentage: number;
    color: string;
    icon: string;
  }> {
    const currentYM = this.getCurrentYearMonth();
    const monthlyExpenses = transactions.filter(tx => tx.type === 'expense' && (dateFilter ? dateFilter(tx.date) : (this.getYearMonth(tx.date) === currentYM)));
    const totalExpense = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0);

    if (totalExpense === 0) return [];

    const grouped: Record<string, { name: string; amount: number; color: string; icon: string }> = {};

    monthlyExpenses.forEach(tx => {
      const catId = tx.categoryId;
      if (!grouped[catId]) {
        grouped[catId] = {
          name: tx.categoryId.startsWith('cat_') ? tx.categoryId.replace('cat_', '') : 'Categoría', // fallback name placeholder
          amount: 0,
          color: tx.color || '#cccccc',
          icon: tx.icon || 'Circle'
        };
      }
      grouped[catId].amount += tx.amount;
    });

    // Resolve real names if possible (in context we will map them or pass actual transaction records with category info)
    // We'll clean names up or map them in view. Let's return list sorted by amount desc.
    return Object.entries(grouped).map(([id, info]) => {
      // capitalize first letter
      let displayName = info.name;
      if (id === 'cat_food_super') displayName = 'Comida';
      else if (id === 'cat_food_out') displayName = 'Restaurante y pedidos';
      else if (id === 'cat_trans') displayName = 'Transporte';
      else if (id === 'cat_fun') displayName = 'Entretenimiento';
      else if (id === 'cat_shop') displayName = 'Compras';
      else if (id === 'cat_bills') displayName = 'Servicios';
      else if (id === 'cat_health') displayName = 'Salud';
      else if (id === 'cat_travel') displayName = 'Viajes';
      else if (id === 'cat_sal') displayName = 'Sueldo';
      else if (id === 'cat_inv') displayName = 'Inversiones';
      else if (id === 'cat_extra') displayName = 'Otros Ingresos';
      else if (id === 'cat_emergency') displayName = 'Imprevistos / Emergencias';

      return {
        categoryId: id,
        name: displayName,
        amount: Number(info.amount.toFixed(2)),
        percentage: Number(((info.amount / totalExpense) * 100).toFixed(1)),
        color: info.color,
        icon: info.icon
      };
    }).sort((a, b) => b.amount - a.amount);
  }

  // Monthly income vs expense comparison for the current year
  static getIncomeVsExpenseMonthly(transactions: Transaction[]): Array<{
    monthName: string;
    income: number;
    expense: number;
  }> {
    const currentYear = new Date().getFullYear();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const results = months.map(name => ({ monthName: name, income: 0, expense: 0 }));

    transactions.forEach(tx => {
      const { year: txYear, month: txMonth } = parseLocalDate(tx.date);
      if (txYear === currentYear) {
        const monthIndex = txMonth - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          if (tx.type === 'income') {
            results[monthIndex].income += tx.amount;
          } else if (tx.type === 'expense') {
            results[monthIndex].expense += tx.amount;
          }
        }
      }
    });

    // Round values
    return results.map(r => ({
      ...r,
      income: Number(r.income.toFixed(2)),
      expense: Number(r.expense.toFixed(2))
    }));
  }

  // Calculate daily, weekly, and monthly averages for expenses
  static getAverages(transactions: Transaction[], dateFilter?: (dateStr: string) => boolean, totalDaysInRange?: number): {
    daily: number;
    weekly: number;
    monthly: number;
  } {
    const currentYM = this.getCurrentYearMonth();
    const monthlyExpenses = transactions.filter(tx => tx.type === 'expense' && (dateFilter ? dateFilter(tx.date) : (this.getYearMonth(tx.date) === currentYM)));
    const totalExpense = monthlyExpenses.reduce((sum, tx) => sum + tx.amount, 0);

    const now = new Date();
    const passedDays = totalDaysInRange || now.getDate();

    const daily = totalExpense / passedDays;
    const weekly = daily * 7;
    const monthly = totalExpense;

    return {
      daily: Number((daily || 0).toFixed(2)),
      weekly: Number((weekly || 0).toFixed(2)),
      monthly: Number((monthly || 0).toFixed(2))
    };
  }

  // Calculates daily cumulative balance for trend charts
  static getCashFlowTrends(
    transactions: Transaction[],
    dateFilter?: (dateStr: string) => boolean,
    startDayRange?: number,
    endDayRange?: number
  ): Array<{
    day: number;
    balance: number;
    income: number;
    expense: number;
  }> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const totalDays = getDaysInMonth(currentYear, currentMonth + 1);
    
    const startDay = startDayRange || 1;
    const endDay = endDayRange || totalDays;
    const daysLength = endDay - startDay + 1;

    const results = Array.from({ length: daysLength }, (_, i) => ({
      day: startDay + i,
      balance: 0,
      income: 0,
      expense: 0
    }));

    const currentYM = this.getCurrentYearMonth();
    const filteredTxs = transactions.filter(tx => dateFilter ? dateFilter(tx.date) : (this.getYearMonth(tx.date) === currentYM));

    filteredTxs.forEach(tx => {
      const day = parseLocalDate(tx.date).day;
      if (day >= startDay && day <= endDay) {
        const index = day - startDay;
        if (index >= 0 && index < daysLength) {
          if (tx.type === 'income') {
            results[index].income += tx.amount;
          } else if (tx.type === 'expense') {
            results[index].expense += tx.amount;
          }
        }
      }
    });

    let runningBalance = 0;
    for (let i = 0; i < daysLength; i++) {
      runningBalance += (results[i].income - results[i].expense);
      results[i].balance = Number(runningBalance.toFixed(2));
      results[i].income = Number(results[i].income.toFixed(2));
      results[i].expense = Number(results[i].expense.toFixed(2));
    }

    if (!startDayRange && !endDayRange) {
      const currentDay = now.getDate();
      return results.slice(0, currentDay);
    }
    return results;
  }

  // Smart insights engine to evaluate user spending patterns
  static getFinancialInsights(
    transactions: Transaction[],
    budgets: Budget[],
    currency: string
  ): Array<{
    id: string;
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
  }> {
    const insights: any[] = [];
    const currentYM = this.getCurrentYearMonth();
    
    budgets.forEach(b => {
      const spent = transactions
        .filter(tx => {
          if (tx.type !== 'expense') return false;
          if (this.getYearMonth(tx.date) !== currentYM) return false;
          if (b.type === 'category' && b.categoryId) {
            return tx.categoryId === b.categoryId;
          }
          return true; // global monthly budget
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const ratio = spent / b.amount;
      const remaining = b.amount - spent;

      if (spent > b.amount) {
        insights.push({
          id: `insight_over_${b.id}`,
          type: 'warning',
          title: `Límite superado en ${b.name}`,
          message: `Has gastado ${currency}${spent.toLocaleString()} de un presupuesto de ${currency}${b.amount.toLocaleString()}. Exceso de ${currency}${Math.abs(remaining).toLocaleString()}.`
        });
      } else if (ratio > 0.85) {
        insights.push({
          id: `insight_close_${b.id}`,
          type: 'info',
          title: `${b.name} cerca del límite`,
          message: `Has consumido el ${(ratio * 100).toFixed(0)}% de tu presupuesto. Te quedan ${currency}${remaining.toLocaleString()} disponibles.`
        });
      } else if (ratio > 0.1 && ratio < 0.6) {
        const day = new Date().getDate();
        if (day >= 15) {
          insights.push({
            id: `insight_save_${b.id}`,
            type: 'success',
            title: `Buen ritmo en ${b.name}`,
            message: `¡Excelente control! Has gastado solo ${currency}${spent.toLocaleString()} (${(ratio * 100).toFixed(0)}%) a mitad del mes.`
          });
        }
      }
    });

    const monthlyIncome = transactions
      .filter(tx => tx.type === 'income' && this.getYearMonth(tx.date) === currentYM)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const monthlyExpense = transactions
      .filter(tx => tx.type === 'expense' && this.getYearMonth(tx.date) === currentYM)
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (monthlyExpense > 0 && monthlyIncome > 0) {
      const savingsRatio = (monthlyIncome - monthlyExpense) / monthlyIncome;
      if (savingsRatio > 0.2) {
        insights.push({
          id: 'insight_savings_rate',
          type: 'success',
          title: 'Tasa de Ahorro Saludable',
          message: `Estás ahorrando el ${(savingsRatio * 100).toFixed(0)}% de tus ingresos este mes. ¡Sigue así!`
        });
      } else if (savingsRatio < 0 && monthlyIncome > 0) {
        insights.push({
          id: 'insight_savings_negative',
          type: 'warning',
          title: 'Déficit este mes',
          message: `Tus gastos (${currency}${monthlyExpense.toLocaleString()}) superan tus ingresos (${currency}${monthlyIncome.toLocaleString()}) este mes por ${currency}${Math.abs(monthlyIncome - monthlyExpense).toLocaleString()}.`
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        id: 'insight_default',
        type: 'info',
        title: 'Asistente FinanList',
        message: 'Comienza a registrar presupuestos y consumos para que el asistente pueda analizar tus patrones mensuales e insights.'
      });
    }

    return insights;
  }
}

