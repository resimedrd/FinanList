import { Transaction, Budget } from '../models/types';

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
  static getSummary(transactions: Transaction[], budgets: Budget[], dateFilter?: (dateStr: string) => boolean): {
    totalBalance: number;
    availableCash: number;
    monthlyIncome: number;
    monthlyExpense: number;
    monthlySavings: number;
    budgetProgress: number; // overall percentage
  } {
    const currentYM = this.getCurrentYearMonth();
    
    let totalBalance = 0;
    let availableCash = 0;
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    transactions.forEach(tx => {
      const val = tx.amount;
      const isCurrentMonth = dateFilter ? dateFilter(tx.date) : (this.getYearMonth(tx.date) === currentYM);

      if (tx.type === 'income') {
        totalBalance += val;
        if (isCurrentMonth) monthlyIncome += val;
        if (tx.account !== 'Broker' && tx.account !== 'Inversiones') {
          availableCash += val;
        }
      } else {
        totalBalance -= val;
        if (isCurrentMonth) monthlyExpense += val;
        if (tx.account !== 'Broker' && tx.account !== 'Inversiones') {
          availableCash -= val;
        }
      }
    });

    const monthlySavings = Math.max(0, monthlyIncome - monthlyExpense);

    // Budget progress
    // We take the total monthly budget amount and see what % has been consumed by expenses this month
    const monthlyTotalBudget = budgets.find(b => b.type === 'monthly' && this.getYearMonth(b.startDate) === currentYM);
    let budgetProgress = 0;
    if (monthlyTotalBudget && monthlyTotalBudget.amount > 0) {
      // Find category budget ids active this month
      const activeCategoryBudgetIds = new Set(
        budgets.filter(x => x.type === 'category' && x.categoryId && this.getYearMonth(x.startDate) === currentYM).map(x => x.categoryId)
      );
      // Filter expenses: exclude active category budgets and savings goals (cat_saving)
      const generalExpenses = transactions
        .filter(tx => tx.type === 'expense' && 
                      this.getYearMonth(tx.date) === currentYM && 
                      !activeCategoryBudgetIds.has(tx.categoryId) && 
                      tx.categoryId !== 'cat_saving')
        .reduce((sum, tx) => sum + tx.amount, 0);

      budgetProgress = Math.min(100, (generalExpenses / monthlyTotalBudget.amount) * 100);
    } else {
      // If no global budget is set, calculate sum of category budgets
      const catBudgets = budgets.filter(b => b.type === 'category' && this.getYearMonth(b.startDate) === currentYM);
      const totalCatBudget = catBudgets.reduce((sum, b) => sum + b.amount, 0);
      if (totalCatBudget > 0) {
        // find expenses matching those categories
        const catIds = new Set(catBudgets.map(b => b.categoryId));
        const matchedExpense = transactions
          .filter(tx => tx.type === 'expense' && this.getYearMonth(tx.date) === currentYM && catIds.has(tx.categoryId))
          .reduce((sum, tx) => sum + tx.amount, 0);
        budgetProgress = Math.min(100, (matchedExpense / totalCatBudget) * 100);
      }
    }

    return {
      totalBalance,
      availableCash,
      monthlyIncome,
      monthlyExpense,
      monthlySavings,
      budgetProgress
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
      const txDate = new Date(tx.date);
      if (txDate.getFullYear() === currentYear) {
        const monthIndex = txDate.getMonth();
        if (tx.type === 'income') {
          results[monthIndex].income += tx.amount;
        } else {
          results[monthIndex].expense += tx.amount;
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
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    
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
      const day = new Date(tx.date).getDate();
      if (day >= startDay && day <= endDay) {
        const index = day - startDay;
        if (index >= 0 && index < daysLength) {
          if (tx.type === 'income') {
            results[index].income += tx.amount;
          } else {
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

