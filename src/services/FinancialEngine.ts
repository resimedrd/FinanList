import { Transaction, PaymentCard, Budget, Debt, SavingGoal, PaymentMethod } from '../models/types';
import { roundCurrency, safeSubtract } from '../utils/currencyUtils';
import { getTodayDateString } from '../utils/dateUtils';

/**
 * Resultado estructurado para la validación previa de cualquier transacción financiera
 */
export interface TransactionValidationResult {
  isValid: boolean;
  errorTitle?: string;
  errorMessage?: string;
  shortfallAmount?: number;      // Monto exacto faltante si la capacidad fue excedida
  availableCapacity?: number;    // Capacidad disponible en el medio seleccionado
  suggestedCards?: PaymentCard[]; // Tarjetas activas alternativas con fondos/cupo suficiente
}

/**
 * Resumen financiero consolidado (Fuente Única de Verdad)
 */
export interface FinancialEngineSummary {
  // Saldo Total Consolidado (Patrimonio Neto):
  // Activos (Líquidos + Inversiones + Cuentas por Cobrar) - Pasivos (Deuda Tarjetas + Deudas Pendientes)
  consolidatedNetBalance: number;

  // Dinero Disponible Líquido Total = Efectivo (Caja) + Tarjetas de Débito
  // (Las deudas por pagar no se restan por adelantado; solo cuando se realiza un abono/pago efectivo)
  availableLiquidCash: number;
  currentBalance: number;

  // Desglose de liquidez directa
  cashBalance: number;          // Efectivo real en caja / billetera
  debitCardsBalance: number;    // Saldo acumulado en tarjetas de débito activas
  bankBalance: number;          // Compatibilidad: igual a debitCardsBalance

  // Fondos comprometidos en Metas de Ahorro
  goalsFrozenBalance: number;    // Dinero apartado/congelado en metas
  unallocatedLiquidCash: number; // Saldo líquido libre disponible (availableLiquidCash - goalsFrozenBalance)

  // Tarjetas de Crédito
  totalCreditCardDebt: number;   // Pasivo acumulado por compras en crédito
  totalCreditAvailable: number;  // Crédito total disponible para compras ((Límite - Deuda) + Saldo a favor)
  totalCreditLimit: number;      // Límite total de crédito aprobado
  totalPositiveBalance: number;  // Saldo a favor acumulado por sobrepagos
  statementBalance: number;      // Saldo exigible facturado tras fecha de corte
  currentCycleExpenses: number;  // Gastos del ciclo actual que aún no cortan
  nextCutoffInfo?: {
    cardName: string;
    cutoffDate: string;
    daysRemaining: number;
    isPastCutoff: boolean;
  };

  // Portafolio de Inversiones
  investmentsBalance: number;

  // Cuentas por cobrar y deudas
  totalReceivables: number;      // Dinero prestado a terceros pendiente de cobro (Activo)
  totalOwedDebts: number;        // Deudas adquiridas pendientes de pago a terceros (Pasivo)

  // Métricas mensuales del mes en curso
  monthlyIncome: number;
  monthlyExpense: number;        // Solo gastos de consumo (excluye amortizaciones de deuda y transferencias)
  monthlySavings: number;
  budgetProgress: number;        // Consumo presupuestario (0 - 100%)
}

/**
 * Detalles específicos del ciclo de facturación de una tarjeta de crédito
 */
export interface CreditCardCycleDetails {
  cardId: string;
  cardName: string;
  cutoffDay: number;
  graceDays: number;
  lastCutoffDate: string;      // "YYYY-MM-DD"
  nextCutoffDate: string;      // "YYYY-MM-DD"
  paymentDueDate: string;      // "YYYY-MM-DD"
  isPastCutoff: boolean;       // Si ya pasó el corte en el mes corriente
  daysUntilCutoff: number;     // Días restantes para el próximo corte
  daysUntilPaymentDue: number; // Días restantes para el límite de pago
  statementBalance: number;    // Saldo exigible facturado al corte
  currentCycleExpenses: number;// Compras del ciclo actual que aún no cortan
  totalDebt: number;           // balanceUsed
  positiveBalance: number;     // saldo a favor por sobrepago
  availableCredit: number;     // (creditLimit - balanceUsed) + positiveBalance
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
   * Aplica un pago o abono a una tarjeta de crédito, manejando sobrepago y saldo a favor.
   * Si el monto supera la deuda actual, el excedente se asigna a positiveBalance.
   */
  static applyPaymentToCreditCard(card: PaymentCard, amount: number, isRevert = false): void {
    if (isNaN(amount) || amount <= 0) return;
    const debt = card.balanceUsed ?? 0;
    const pos = card.positiveBalance ?? 0;

    if (!isRevert) {
      if (amount <= debt) {
        card.balanceUsed = roundCurrency(debt - amount);
        card.positiveBalance = pos;
      } else {
        card.balanceUsed = 0;
        const surplus = safeSubtract(amount, debt);
        card.positiveBalance = roundCurrency(pos + surplus);
      }
    } else {
      // Revertir pago: primero descuenta de positiveBalance; si no alcanza, restaura deuda
      if (pos >= amount) {
        card.positiveBalance = roundCurrency(pos - amount);
      } else {
        card.positiveBalance = 0;
        const remaining = safeSubtract(amount, pos);
        card.balanceUsed = roundCurrency(debt + remaining);
      }
    }
  }

  /**
   * Aplica un gasto/compra a una tarjeta de crédito.
   * El cargo se consume primero del positiveBalance antes de incrementar balanceUsed.
   */
  static applyExpenseToCreditCard(card: PaymentCard, amount: number, isRevert = false): void {
    if (isNaN(amount) || amount <= 0) return;
    const debt = card.balanceUsed ?? 0;
    const pos = card.positiveBalance ?? 0;

    if (!isRevert) {
      if (pos >= amount) {
        card.positiveBalance = roundCurrency(pos - amount);
      } else {
        card.positiveBalance = 0;
        const excess = safeSubtract(amount, pos);
        card.balanceUsed = roundCurrency(debt + excess);
      }
    } else {
      // Revertir gasto: primero reduce deuda; si sobra, restaura positiveBalance
      if (debt >= amount) {
        card.balanceUsed = roundCurrency(debt - amount);
      } else {
        card.balanceUsed = 0;
        const remainder = safeSubtract(amount, debt);
        card.positiveBalance = roundCurrency(pos + remainder);
      }
    }
  }

  /**
   * Calcula el crédito disponible total de una tarjeta:
   * (Límite - Deuda) + Saldo a favor
   */
  static getAvailableCredit(card: PaymentCard): number {
    const limit = card.creditLimit ?? 0;
    const debt = card.balanceUsed ?? 0;
    const pos = card.positiveBalance ?? 0;
    return roundCurrency(Math.max(0, limit - debt) + pos);
  }

  /**
   * Calcula los detalles del ciclo de facturación y días de gracia de una tarjeta de crédito.
   * Separa con precisión el saldo facturado exigible (statementBalance) y compras en ciclo (currentCycleExpenses).
   */
  static getCardBillingCycleDetails(
    card: PaymentCard,
    transactions: Transaction[] = [],
    fromDate: Date = new Date()
  ): CreditCardCycleDetails {
    const cutoffDay = Math.min(31, Math.max(1, card.cutoffDay ?? card.billingCutoffDay ?? 15));
    const graceDays = Math.max(1, card.graceDays ?? 20);

    const year = fromDate.getFullYear();
    const month = fromDate.getMonth();
    const day = fromDate.getDate();

    const getSafeDate = (y: number, m: number, d: number): Date => {
      const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
      return new Date(y, m, Math.min(d, lastDayOfMonth));
    };

    const isPastCutoff = day > cutoffDay;

    let lastCutoffDateObj: Date;
    let nextCutoffDateObj: Date;

    if (isPastCutoff) {
      lastCutoffDateObj = getSafeDate(year, month, cutoffDay);
      nextCutoffDateObj = getSafeDate(year, month + 1, cutoffDay);
    } else {
      lastCutoffDateObj = getSafeDate(year, month - 1, cutoffDay);
      nextCutoffDateObj = getSafeDate(year, month, cutoffDay);
    }

    const formatDateStr = (d: Date): string => {
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      return `${yStr}-${mStr}-${dStr}`;
    };

    const lastCutoffDate = formatDateStr(lastCutoffDateObj);
    const nextCutoffDate = formatDateStr(nextCutoffDateObj);

    // Fecha límite de pago: corte + graceDays
    const paymentDueDateObj = new Date(lastCutoffDateObj.getTime() + graceDays * 24 * 60 * 60 * 1000);
    const paymentDueDate = formatDateStr(paymentDueDateObj);

    const todayZero = new Date(year, month, day);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntilCutoff = Math.max(0, Math.round((nextCutoffDateObj.getTime() - todayZero.getTime()) / msPerDay));
    const daysUntilPaymentDue = Math.round((paymentDueDateObj.getTime() - todayZero.getTime()) / msPerDay);

    const totalDebt = card.balanceUsed ?? 0;
    const positiveBalance = card.positiveBalance ?? 0;
    const availableCredit = this.getAvailableCredit(card);

    let statementBalance = 0;
    let currentCycleExpenses = 0;

    if (totalDebt > 0) {
      const newExpenses = transactions
        .filter(tx => tx.cardId === card.id && tx.type === 'expense' && tx.date > lastCutoffDate)
        .reduce((sum, tx) => sum + tx.amount, 0);

      currentCycleExpenses = roundCurrency(Math.min(totalDebt, newExpenses));
      const unpaidPriorCutoff = roundCurrency(Math.max(0, totalDebt - currentCycleExpenses));

      statementBalance = unpaidPriorCutoff;
    }

    return {
      cardId: card.id,
      cardName: card.name,
      cutoffDay,
      graceDays,
      lastCutoffDate,
      nextCutoffDate,
      paymentDueDate,
      isPastCutoff,
      daysUntilCutoff,
      daysUntilPaymentDue,
      statementBalance,
      currentCycleExpenses,
      totalDebt,
      positiveBalance,
      availableCredit
    };
  }

  /**
   * Calcula el resumen financiero consolidado como Fuente Única de Verdad (Single Source of Truth).
   * Desacopla Efectivo, Tarjetas (Crédito y Débito), Inversiones, Deudas y Metas.
   */
  static calculateSummary(
    transactions: Transaction[],
    cards: PaymentCard[],
    budgets: Budget[] = [],
    dateFilter?: (dateStr: string) => boolean,
    debts: Debt[] = [],
    goals: SavingGoal[] = []
  ): FinancialEngineSummary {
    const currentYM = this.getCurrentYearMonth();

    // 1. Tarjetas de Crédito: Pasivos, Límites disponibles y Saldo a Favor
    const activeCreditCards = cards.filter(c => c.isActive && c.type === 'credit');
    const totalCreditLimit = roundCurrency(
      activeCreditCards.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0)
    );
    const totalCreditCardDebt = roundCurrency(
      activeCreditCards.reduce((sum, c) => sum + (c.balanceUsed ?? 0), 0)
    );
    const totalPositiveBalance = roundCurrency(
      activeCreditCards.reduce((sum, c) => sum + (c.positiveBalance ?? 0), 0)
    );
    const totalCreditAvailable = roundCurrency(
      activeCreditCards.reduce((sum, c) => sum + this.getAvailableCredit(c), 0)
    );

    // Ciclos de facturación para tarjetas de crédito
    let totalStatementBalance = 0;
    let totalCurrentCycleExpenses = 0;
    let nearestCutoff: { cardName: string; cutoffDate: string; daysRemaining: number; isPastCutoff: boolean; } | undefined = undefined;

    activeCreditCards.forEach(card => {
      const details = this.getCardBillingCycleDetails(card, transactions);
      totalStatementBalance += details.statementBalance;
      totalCurrentCycleExpenses += details.currentCycleExpenses;

      if (!nearestCutoff || details.daysUntilCutoff < nearestCutoff.daysRemaining) {
        nearestCutoff = {
          cardName: card.name,
          cutoffDate: details.nextCutoffDate,
          daysRemaining: details.daysUntilCutoff,
          isPastCutoff: details.isPastCutoff
        };
      }
    });

    totalStatementBalance = roundCurrency(totalStatementBalance);
    totalCurrentCycleExpenses = roundCurrency(totalCurrentCycleExpenses);

    // 2. Tarjetas de Débito: Saldo en tarjetas de débito activas
    const activeDebitCards = cards.filter(c => c.isActive && c.type === 'debit');
    const debitCardsBalance = roundCurrency(
      activeDebitCards.reduce((sum, c) => sum + (c.currentBalance ?? 0), 0)
    );

    // 3. Efectivo e Inversiones calculados a partir de los movimientos
    let cash = 0;
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

      // Identificar si la transacción está explícitamente ligada a una tarjeta registrada
      const associatedCard = tx.cardId ? cards.find(c => c.id === tx.cardId) : undefined;

      // Métricas de flujo del mes (excluye transferencias internas de inversiones)
      if (isCurrentMonth) {
        if (isIncome && !acc.includes('broker') && !acc.includes('inversiones')) {
          monthlyIncome += amt;
        } else if (tx.type === 'expense' && !acc.includes('broker') && !acc.includes('inversiones')) {
          monthlyExpense += amt;
          if (tx.categoryId === 'cat_saving' || (tx.notes && tx.notes.includes('#goal:'))) {
            monthlySavings += amt;
          }
        }
      }

      // Distribución de saldos por medio de pago
      if (acc.includes('broker') || acc.includes('inversiones')) {
        // Cuenta de inversiones
        if (isIncome) investments += amt;
        else if (isDebitOrExpense) investments -= amt;
      } else if (associatedCard) {
        // Transacción con tarjeta registrada: el saldo de la tarjeta es administrado por PaymentCard
        // Si fue un pago a una tarjeta de crédito en efectivo (payment sin cardId pero con destinationCardId):
        if (tx.type === 'payment' && !tx.cardId && tx.destinationCardId) {
          cash -= amt;
        }
      } else {
        // Sin tarjeta asociada: movimiento en Efectivo (incluye legacy 'Banco' que no tenía tarjeta)
        if (isIncome) cash += amt;
        else if (isDebitOrExpense) cash -= amt;
      }
    });

    // 4. Consolidación de Dinero Disponible Líquido
    const cashTotal = roundCurrency(cash);
    const investmentsTotal = roundCurrency(investments);
    const availableLiquidCash = roundCurrency(cashTotal + debitCardsBalance);

    // 5. Fondos Apartados en Metas de Ahorro
    const goalsFrozenBalance = roundCurrency(
      (goals || []).reduce((sum, g) => sum + (g.currentAmount || 0), 0)
    );
    const unallocatedLiquidCash = roundCurrency(
      Math.max(0, safeSubtract(availableLiquidCash, goalsFrozenBalance))
    );

    // 6. Cuentas por Cobrar y Deudas por Pagar
    const activeReceivables = (debts || []).filter(d => d.type === 'lent' && d.remainingAmount > 0);
    const totalReceivables = roundCurrency(
      activeReceivables.reduce((sum, d) => sum + (d.remainingAmount ?? d.amount ?? 0), 0)
    );

    const activePayables = (debts || []).filter(d => d.type === 'borrowed' && d.remainingAmount > 0);
    const totalOwedDebts = roundCurrency(
      activePayables.reduce((sum, d) => sum + (d.remainingAmount ?? d.amount ?? 0), 0)
    );

    // 7. Saldo Total Consolidado (Patrimonio Neto):
    // Activos = Líquido + Inversiones + Cuentas por Cobrar
    // Pasivos = Deuda de Tarjetas + Deudas por Pagar
    const totalAssets = roundCurrency(availableLiquidCash + investmentsTotal + totalReceivables);
    const totalLiabilities = roundCurrency(totalCreditCardDebt + totalOwedDebts);
    const consolidatedNetBalance = roundCurrency(safeSubtract(totalAssets, totalLiabilities));

    // 8. Progreso del Presupuesto
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
      currentBalance: availableLiquidCash,
      cashBalance: cashTotal,
      debitCardsBalance,
      bankBalance: debitCardsBalance, // Compatibilidad retroactiva
      goalsFrozenBalance,
      unallocatedLiquidCash,
      totalCreditCardDebt,
      totalCreditAvailable,
      totalCreditLimit,
      totalPositiveBalance,
      statementBalance: totalStatementBalance,
      currentCycleExpenses: totalCurrentCycleExpenses,
      nextCutoffInfo: nearestCutoff,
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
   * Obtiene el saldo disponible de efectivo líquido puro.
   */
  static getAvailableLiquidCash(transactions: Transaction[], cards: PaymentCard[] = []): number {
    const summary = FinancialEngine.calculateSummary(transactions, cards);
    return summary.cashBalance;
  }

  /**
   * Valida minuciosamente una transacción antes de confirmarla.
   * Verifica límites de crédito, saldos de débito y disponibilidad de efectivo,
   * calculando montos faltantes y sugiriendo tarjetas alternativas con capacidad suficiente.
   */
  static validateTransaction(
    amount: number,
    sourceType: PaymentMethod,
    selectedCard?: PaymentCard,
    summary?: FinancialEngineSummary,
    allCards: PaymentCard[] = []
  ): TransactionValidationResult {
    if (isNaN(amount) || amount <= 0) {
      return {
        isValid: false,
        errorTitle: 'Monto Inválido',
        errorMessage: 'Por favor, introduce un monto válido mayor a 0.'
      };
    }

    // 1. Validación de Efectivo
    if (sourceType === 'cash') {
      const availableCash = summary ? summary.cashBalance : Infinity;
      if (amount > availableCash) {
        const shortfall = roundCurrency(amount - availableCash);
        // Buscar tarjetas activas que puedan cubrir el monto total
        const suggestedCards = allCards.filter(c => {
          if (!c.isActive) return false;
          if (c.type === 'credit') {
            const cap = FinancialEngine.getAvailableCredit(c);
            return cap >= amount;
          }
          return (c.currentBalance ?? 0) >= amount;
        });

        return {
          isValid: false,
          errorTitle: 'Saldo Insuficiente en Efectivo',
          errorMessage: `No dispones de suficiente efectivo. Tienes ${roundCurrency(availableCash).toLocaleString()} disponible y faltan ${shortfall.toLocaleString()}.`,
          shortfallAmount: shortfall,
          availableCapacity: availableCash,
          suggestedCards
        };
      }
      return { isValid: true, availableCapacity: availableCash };
    }

    // 2. Validación de Tarjeta
    if (sourceType === 'card') {
      if (!selectedCard) {
        return {
          isValid: false,
          errorTitle: 'Tarjeta Requerida',
          errorMessage: 'Debes seleccionar una tarjeta para continuar.'
        };
      }

      // 2A. Tarjeta de Crédito: Validar cupo disponible ((Límite - Deuda) + Saldo a favor)
      if (selectedCard.type === 'credit') {
        const availableCredit = FinancialEngine.getAvailableCredit(selectedCard);

        if (amount > availableCredit) {
          const shortfall = roundCurrency(amount - availableCredit);
          // Sugerir otras tarjetas con capacidad suficiente
          const suggestedCards = allCards.filter(c => {
            if (!c.isActive || c.id === selectedCard.id) return false;
            if (c.type === 'credit') {
              const cap = FinancialEngine.getAvailableCredit(c);
              return cap >= amount;
            }
            return (c.currentBalance ?? 0) >= amount;
          });

          return {
            isValid: false,
            errorTitle: 'Cupo de Crédito Excedido',
            errorMessage: `El monto solicitado (${amount.toLocaleString()}) excede el cupo disponible en "${selectedCard.name}" (${availableCredit.toLocaleString()}). Te faltan ${shortfall.toLocaleString()}.`,
            shortfallAmount: shortfall,
            availableCapacity: availableCredit,
            suggestedCards
          };
        }
        return { isValid: true, availableCapacity: availableCredit };
      }

      // 2B. Tarjeta de Débito: Validar saldo disponible
      if (selectedCard.type === 'debit') {
        const balance = selectedCard.currentBalance ?? 0;
        const overdraft = selectedCard.allowOverdraft ? (selectedCard.overdraftLimit ?? 0) : 0;
        const availableDebit = roundCurrency(balance + overdraft);

        if (amount > availableDebit) {
          const shortfall = roundCurrency(amount - availableDebit);
          const suggestedCards = allCards.filter(c => {
            if (!c.isActive || c.id === selectedCard.id) return false;
            if (c.type === 'credit') {
              const cap = FinancialEngine.getAvailableCredit(c);
              return cap >= amount;
            }
            return (c.currentBalance ?? 0) >= amount;
          });

          return {
            isValid: false,
            errorTitle: 'Saldo Insuficiente en Tarjeta',
            errorMessage: `La tarjeta de débito "${selectedCard.name}" no cuenta con saldo suficiente (${availableDebit.toLocaleString()}). Te faltan ${shortfall.toLocaleString()}.`,
            shortfallAmount: shortfall,
            availableCapacity: availableDebit,
            suggestedCards
          };
        }
        return { isValid: true, availableCapacity: availableDebit };
      }
    }

    return { isValid: true };
  }

  /**
   * Valida un aporte a inversión, notificando de inmediato montos faltantes
   * y sugiriendo tarjetas con capacidad para diversificar o cambiar el origen de fondos.
   */
  static validateInvestmentAllocation(
    amount: number,
    sourceType: PaymentMethod,
    selectedCard?: PaymentCard,
    summary?: FinancialEngineSummary,
    allCards: PaymentCard[] = []
  ): TransactionValidationResult {
    const baseValidation = this.validateTransaction(amount, sourceType, selectedCard, summary, allCards);
    if (!baseValidation.isValid) {
      return {
        ...baseValidation,
        errorTitle: `Fondos Insuficientes para Inversión`,
        errorMessage: `${baseValidation.errorMessage} Puedes cambiar de medio de pago o ajustar el monto a invertir.`
      };
    }
    return baseValidation;
  }

  /**
   * Calcula el impacto de un abono o liquidación total a una deuda.
   * Si la deuda está vinculada a una tarjeta de crédito, libera el cupo consumido
   * de dicha tarjeta sin generar transacciones duplicadas.
   */
  static calculateDebtPaymentImpact(
    debt: Debt,
    paymentAmount: number
  ): {
    newRemaining: number;
    isFullyPaid: boolean;
    linkedCardId?: string;
  } {
    const validPayment = Math.max(0, paymentAmount);
    const newRemaining = roundCurrency(Math.max(0, debt.remainingAmount - validPayment));
    const isFullyPaid = newRemaining === 0;

    return {
      newRemaining,
      isFullyPaid,
      linkedCardId: debt.linkedCardId
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
