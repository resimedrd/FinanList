import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Budget, SavingGoal, Debt, Category } from '../models/types';
import { parseLocalDate } from '../utils/dateUtils';
import { roundCurrency } from '../utils/currencyUtils';

export interface GenerateReportOptions {
  transactions: Transaction[];
  budgets?: Budget[];
  goals?: SavingGoal[];
  debts?: Debt[];
  categories?: Category[];
  profile: { name: string; currency: string };
  stealthMode?: boolean;
  selectedPeriodYM?: string;
  selectedEmissionDate?: string;
  startDate?: string;
  endDate?: string;
}

export const PdfReportService = {
  /**
   * Generates a high-fidelity, professional financial and budget report.
   * Supports both custom date ranges (startDate to endDate) and standard month keys (selectedPeriodYM).
   */
  generateMonthlyReport: (
    transactions: Transaction[],
    budgets: Budget[] = [],
    goals: SavingGoal[] = [],
    debts: Debt[] = [],
    categories: Category[] = [],
    profile: { name: string; currency: string },
    stealthMode: boolean = false,
    selectedPeriodYM?: string,
    selectedEmissionDate?: string,
    startDate?: string,
    endDate?: string
  ): jsPDF => {
    return PdfReportService.generateCustomRangeReport({
      transactions,
      budgets,
      goals,
      debts,
      categories,
      profile,
      stealthMode,
      selectedPeriodYM,
      selectedEmissionDate,
      startDate,
      endDate
    });
  },

  /**
   * Core generator for custom date range reports with vector graphics and financial diagnostics.
   */
  generateCustomRangeReport: (options: GenerateReportOptions): jsPDF => {
    const {
      transactions = [],
      budgets = [],
      goals = [],
      debts = [],
      categories = [],
      profile,
      stealthMode = false,
      selectedPeriodYM,
      selectedEmissionDate,
      startDate: explicitStart,
      endDate: explicitEnd
    } = options;

    // 1. Resolve Range Dates (Lexical ISO strings 'YYYY-MM-DD')
    let startRange = explicitStart || '';
    let endRange = explicitEnd || '';
    let periodTitle = '';

    if (startRange && endRange) {
      if (startRange > endRange) {
        const temp = startRange;
        startRange = endRange;
        endRange = temp;
      }
      const sParts = parseLocalDate(startRange);
      const eParts = parseLocalDate(endRange);
      const sName = new Date(sParts.year, sParts.month - 1, sParts.day, 12).toLocaleString('es-ES', { month: 'short' });
      const eName = new Date(eParts.year, eParts.month - 1, eParts.day, 12).toLocaleString('es-ES', { month: 'short' });
      periodTitle = `${sParts.day} ${sName} ${sParts.year} – ${eParts.day} ${eName} ${eParts.year}`;
    } else if (selectedPeriodYM) {
      const [yearStr, monthStr] = selectedPeriodYM.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const lastDay = new Date(y, m, 0).getDate();
      startRange = `${yearStr}-${monthStr}-01`;
      endRange = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      const mName = new Date(y, m - 1, 1).toLocaleString('es-ES', { month: 'long' });
      periodTitle = `${mName.charAt(0).toUpperCase() + mName.slice(1)} ${y}`;
    } else {
      const now = new Date();
      let prevM = now.getMonth() - 1;
      let prevY = now.getFullYear();
      if (prevM < 0) {
        prevM = 11;
        prevY -= 1;
      }
      const lastDay = new Date(prevY, prevM + 1, 0).getDate();
      const mPad = String(prevM + 1).padStart(2, '0');
      startRange = `${prevY}-${mPad}-01`;
      endRange = `${prevY}-${mPad}-${String(lastDay).padStart(2, '0')}`;
      const mName = new Date(prevY, prevM, 1).toLocaleString('es-ES', { month: 'long' });
      periodTitle = `${mName.charAt(0).toUpperCase() + mName.slice(1)} ${prevY}`;
    }

    // Calculate total inclusive days
    const sP = parseLocalDate(startRange);
    const eP = parseLocalDate(endRange);
    const d1 = new Date(sP.year, sP.month - 1, sP.day, 12, 0, 0);
    const d2 = new Date(eP.year, eP.month - 1, eP.day, 12, 0, 0);
    const totalDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Format Emission Date
    let emissionStr = '';
    const nowEmission = selectedEmissionDate ? new Date(selectedEmissionDate) : new Date();
    if (!isNaN(nowEmission.getTime())) {
      const day = String(nowEmission.getDate()).padStart(2, '0');
      const month = String(nowEmission.getMonth() + 1).padStart(2, '0');
      const year = nowEmission.getFullYear();
      const hour = String(nowEmission.getHours()).padStart(2, '0');
      const min = String(nowEmission.getMinutes()).padStart(2, '0');
      emissionStr = `${day}/${month}/${year} ${hour}:${min}`;
    } else {
      emissionStr = new Date().toLocaleDateString('es-ES');
    }

    // 2. Filter Transactions Strictly by Range
    const rangeTxs = transactions.filter(t => t.date && t.date >= startRange && t.date <= endRange);

    // Map Category Names cleanly
    const catMap = new Map<string, Category>();
    categories.forEach(c => catMap.set(c.id, c));

    const resolveCategoryName = (catId?: string): string => {
      if (!catId) return 'General';
      const c = catMap.get(catId);
      if (c) return c.name;
      if (catId === 'cat_food_super') return 'Comida';
      if (catId === 'cat_food_out') return 'Restaurante y pedidos';
      if (catId === 'cat_trans') return 'Transporte';
      if (catId === 'cat_fun') return 'Entretenimiento';
      if (catId === 'cat_shop') return 'Compras';
      if (catId === 'cat_bills') return 'Servicios';
      if (catId === 'cat_health') return 'Salud';
      if (catId === 'cat_travel') return 'Viajes';
      if (catId === 'cat_sal') return 'Sueldo';
      if (catId === 'cat_inv') return 'Inversiones';
      if (catId === 'cat_extra') return 'Otros Ingresos';
      if (catId === 'cat_emergency') return 'Imprevistos';
      if (catId === 'cat_saving') return 'Ahorro';
      if (catId === 'cat_loan') return 'Préstamos y Deudas';
      if (catId === 'sub_uber') return 'Uber / Taxi';
      if (catId === 'sub_gas') return 'Gasolina';
      const clean = catId.replace(/^cat_|^sub_/, '').trim();
      if (/^\d+$/.test(clean) || /^\d+[a-z0-9]*$/i.test(clean)) {
        return 'Otros Gastos';
      }
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    // 3. Financial Calculations & KPIs
    const totalIncome = rangeTxs
      .filter(t => t.type === 'income' && !(t.account || '').toLowerCase().includes('inversiones'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = rangeTxs
      .filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving' && !(t.account || '').toLowerCase().includes('inversiones'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSavings = rangeTxs
      .filter(t => (t.type === 'expense' || t.type === 'transfer') && (t.categoryId === 'cat_saving' || t.notes?.includes('#goal:')))
      .reduce((sum, t) => sum + t.amount, 0);

    const netCashFlow = totalIncome - (totalExpense + totalSavings);
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;
    const dailyBurnRate = roundCurrency(totalExpense / totalDays);

    // Score de Salud Financiera (0 - 100)
    let healthScore = 60;
    if (totalIncome > 0) {
      const expRatio = totalExpense / totalIncome;
      if (expRatio <= 0.5) healthScore += 25;
      else if (expRatio <= 0.75) healthScore += 15;
      else if (expRatio > 1.0) healthScore -= 30;

      if (savingsRate >= 20) healthScore += 15;
      else if (savingsRate >= 10) healthScore += 8;
      else healthScore -= 10;
    }
    const activeBorrowed = debts.filter(d => d.type === 'borrowed' && d.remainingAmount > 0);
    if (activeBorrowed.length > 0) {
      healthScore -= Math.min(15, activeBorrowed.length * 5);
    }
    healthScore = Math.max(10, Math.min(100, Math.round(healthScore)));

    const scoreStatusText = healthScore >= 80 ? 'Excelente' : healthScore >= 60 ? 'Saludable' : healthScore >= 45 ? 'Precaución' : 'Crítico';

    // 4. Budget Overlap & Execution Analysis
    const budgetRows: any[] = [];
    let totalProratedBudgetLimit = 0;
    let totalMatchedBudgetExpense = 0;

    budgets.forEach(b => {
      const bStart = b.startDate || startRange;
      const bEnd = b.endDate || endRange;

      // Check overlap
      const overlapStart = bStart > startRange ? bStart : startRange;
      const overlapEnd = bEnd < endRange ? bEnd : endRange;

      if (overlapStart <= overlapEnd) {
        // Calculate days
        const bs = parseLocalDate(bStart);
        const be = parseLocalDate(bEnd);
        const bDays = Math.max(1, Math.round((new Date(be.year, be.month - 1, be.day, 12).getTime() - new Date(bs.year, bs.month - 1, bs.day, 12).getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const os = parseLocalDate(overlapStart);
        const oe = parseLocalDate(overlapEnd);
        const oDays = Math.max(1, Math.round((new Date(oe.year, oe.month - 1, oe.day, 12).getTime() - new Date(os.year, os.month - 1, os.day, 12).getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const proratedLimit = roundCurrency(b.amount * (oDays / bDays));
        totalProratedBudgetLimit += proratedLimit;

        let spent = 0;
        if (b.type === 'category' && b.categoryId) {
          spent = rangeTxs
            .filter(t => t.type === 'expense' && (t.categoryId === b.categoryId || t.notes?.includes(`#budget_cat:${b.categoryId}`)))
            .reduce((sum, t) => sum + t.amount, 0);
        } else {
          spent = totalExpense;
        }
        totalMatchedBudgetExpense += spent;

        const diff = proratedLimit - spent;
        const pct = proratedLimit > 0 ? (spent / proratedLimit) * 100 : 0;
        const bName = b.type === 'category' && b.categoryId ? resolveCategoryName(b.categoryId) : (b.name || 'Presupuesto General');

        budgetRows.push({
          name: bName,
          limit: proratedLimit,
          spent,
          diff,
          pct: Math.round(pct),
          status: pct > 100 ? 'Excedido' : pct > 85 ? 'Precaución' : 'Bajo Control'
        });
      }
    });

    // 5. Category Breakdown Analysis (Sorting by Expense)
    const categoryAgg: Record<string, { count: number; total: number; name: string; color: string }> = {};
    rangeTxs.filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving').forEach(tx => {
      const cId = tx.categoryId || 'cat_other';
      if (!categoryAgg[cId]) {
        categoryAgg[cId] = {
          count: 0,
          total: 0,
          name: resolveCategoryName(cId),
          color: tx.color || '#6366f1'
        };
      }
      categoryAgg[cId].count += 1;
      categoryAgg[cId].total += tx.amount;
    });

    const categoryList = Object.entries(categoryAgg)
      .map(([id, item]) => ({
        id,
        name: item.name,
        count: item.count,
        amount: roundCurrency(item.total),
        percentage: totalExpense > 0 ? Number(((item.total / totalExpense) * 100).toFixed(1)) : 0,
        color: item.color
      }))
      .sort((a, b) => b.amount - a.amount);

    // 6. Micro-expense / Gastos Hormiga Detection
    let hormoneFuga = {
      detected: false,
      category: '',
      count: 0,
      total: 0,
      annualized: 0
    };

    for (const cat of categoryList) {
      const avg = cat.amount / cat.count;
      if (cat.count >= 4 && avg <= Math.max(500, totalExpense * 0.06)) {
        const annualFactor = 365 / totalDays;
        hormoneFuga = {
          detected: true,
          category: cat.name,
          count: cat.count,
          total: cat.amount,
          annualized: roundCurrency(cat.amount * annualFactor)
        };
        break;
      }
    }

    // 7. Initialize jsPDF Document (A4 Portrait)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const PALETTE = {
      primaryDark: [15, 23, 42] as [number, number, number],    // Slate 900 #0F172A
      primaryAccent: [79, 70, 229] as [number, number, number], // Indigo 600 #4F46E5
      emeraldSuccess: [5, 150, 105] as [number, number, number],// Emerald 600 #059669
      amberWarning: [217, 119, 6] as [number, number, number],  // Amber 600 #D97706
      roseDanger: [225, 29, 72] as [number, number, number],    // Rose 600 #E11D48
      bgLight: [248, 250, 252] as [number, number, number],     // Slate 50 #F8FAFC
      borderLight: [226, 232, 240] as [number, number, number], // Slate 200 #E2E8F0
      textMain: [51, 65, 85] as [number, number, number],       // Slate 700 #334155
      textMuted: [100, 116, 139] as [number, number, number]    // Slate 500 #64748B
    };

    const formatMoney = (val: number) => {
      if (stealthMode) return '••••';
      return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const addHeaderFooter = (pageNum: number) => {
      if (pageNum === 1) return;
      // Header
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
      doc.text('FinanList • Reporte de Presupuesto & Inteligencia Financiera', 20, 14);
      doc.text(`${periodTitle}`, 190, 14, { align: 'right' });
      doc.setDrawColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
      doc.setLineWidth(0.3);
      doc.line(20, 17, 190, 17);

      // Footer
      doc.line(20, 280, 190, 280);
      doc.text('Documento Confidencial • Generado automáticamente para uso personal del cliente', 20, 285);
      doc.text(`Página ${pageNum} de 4`, 190, 285, { align: 'right' });
    };

    // ==========================================
    // PÁGINA 1: PORTADA EJECUTIVA Y KPIS
    // ==========================================
    // Left decorative bar
    doc.setFillColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.rect(0, 0, 12, 297, 'F');
    doc.setFillColor(PALETTE.primaryAccent[0], PALETTE.primaryAccent[1], PALETTE.primaryAccent[2]);
    doc.rect(12, 0, 3, 297, 'F');

    // Title & Institution
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(PALETTE.primaryAccent[0], PALETTE.primaryAccent[1], PALETTE.primaryAccent[2]);
    doc.text('FINANLIST WEALTH ANALYTICS', 26, 40);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.text('REPORTE INTEGRAL', 26, 52);
    doc.text('DE PRESUPUESTO & FINANZAS', 26, 62);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
    doc.text(`Evaluación personalizada de gasto, ahorro y ejecución de metas`, 26, 70);

    // Client & Period Metadata Box
    doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
    doc.setDrawColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
    doc.roundedRect(26, 80, 164, 42, 3, 3, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(PALETTE.primaryAccent[0], PALETTE.primaryAccent[1], PALETTE.primaryAccent[2]);
    doc.text('FICHA TÉCNICA DEL PERIODO', 32, 90);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    doc.text(`Titular: ${profile.name}`, 32, 99);
    doc.text(`Rango Analizado: Del ${startRange} al ${endRange} (${totalDays} días)`, 32, 107);
    doc.text(`Moneda: ${profile.currency}  |  Emisión: ${emissionStr}`, 32, 115);

    // Executive Diagnostic Letter
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.text('Diagnóstico Ejecutivo de Tesorería', 26, 134);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);

    let narrative = `Estimado(a) ${profile.name},\n\nDurante el periodo evaluado de ${totalDays} días, tus ingresos ascendieron a ${formatMoney(totalIncome)} y tus consumos operativos sumaron ${formatMoney(totalExpense)}.`;
    if (netCashFlow >= 0) {
      narrative += ` Finalizaste con un superávit neto de ${formatMoney(netCashFlow)}, reflejando disciplina y capacidad de acumulación. Tu ritmo de consumo diario se mantuvo en ${formatMoney(dailyBurnRate)}/día.`;
    } else {
      narrative += ` Presentaste un déficit de caja de ${formatMoney(Math.abs(netCashFlow))}, absorbiendo reservas a un ritmo de ${formatMoney(dailyBurnRate)}/día. Te sugerimos revisar las partidas con sobregiro.`;
    }

    if (savingsRate >= 15) {
      narrative += ` Lograste destinar un ${savingsRate}% de tus ingresos hacia ahorro e inversión (${formatMoney(totalSavings)}), superando el umbral de referencia del 10%.`;
    } else {
      narrative += ` Tu tasa de ahorro se situó en un ${savingsRate}% (${formatMoney(totalSavings)}). Considera automatizar aportes a tus metas activas al inicio de cada ciclo.`;
    }

    const narrativeLines = doc.splitTextToSize(narrative, 164);
    doc.text(narrativeLines, 26, 142);

    // 4 KPI Cards (With Vector Progress Bar for Score)
    const drawKPICard = (x: number, y: number, w: number, h: number, title: string, val: string, colorRgb: [number, number, number]) => {
      doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
      doc.setDrawColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
      doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
      doc.text(title.toUpperCase(), x + 7, y + 9);

      doc.setFontSize(15);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
      doc.text(val, x + 7, y + 21);
    };

    drawKPICard(26, 185, 78, 28, 'Ingresos Totales', formatMoney(totalIncome), PALETTE.emeraldSuccess);
    drawKPICard(112, 185, 78, 28, 'Gastos Operativos', formatMoney(totalExpense), PALETTE.primaryDark);
    drawKPICard(26, 220, 78, 38, 'Flujo de Caja Neto', `${netCashFlow >= 0 ? '+' : '-'}${formatMoney(Math.abs(netCashFlow))}`, netCashFlow >= 0 ? PALETTE.emeraldSuccess : PALETTE.roseDanger);

    // Score Card with Native Vector Progress Bar
    doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
    doc.setDrawColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
    doc.roundedRect(112, 220, 78, 38, 2.5, 2.5, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
    doc.text('SCORE DE SALUD FINANCIERA', 119, 229);

    doc.setFontSize(16);
    const scoreRgb = healthScore >= 75 ? PALETTE.emeraldSuccess : healthScore >= 55 ? PALETTE.amberWarning : PALETTE.roseDanger;
    doc.setTextColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
    doc.text(`${healthScore}/100`, 119, 241);

    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'bold');
    doc.text(scoreStatusText, 183, 241, { align: 'right' });

    // Vector Bar Track
    doc.setFillColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
    doc.roundedRect(119, 247, 64, 4, 2, 2, 'F');
    // Vector Bar Fill
    const fillW = Math.max(4, (healthScore / 100) * 64);
    doc.setFillColor(scoreRgb[0], scoreRgb[1], scoreRgb[2]);
    doc.roundedRect(119, 247, fillW, 4, 2, 2, 'F');

    // ==========================================
    // PÁGINA 2: CONTROL Y EJECUCIÓN PRESUPUESTARIA
    // ==========================================
    doc.addPage();
    addHeaderFooter(2);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.text('Desempeño y Control Presupuestario', 20, 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
    doc.text('Monitoreo del gasto real frente a los techos presupuestarios prorrateados al periodo:', 20, 36);

    const tableBody = budgetRows.map(b => [
      b.name,
      formatMoney(b.limit),
      formatMoney(b.spent),
      b.pct, // passed as number for didDrawCell vector rendering
      `${b.pct}%`,
      b.status
    ]);

    if (budgetRows.length > 0) {
      autoTable(doc, {
        startY: 42,
        margin: { left: 20, right: 20 },
        head: [['Presupuesto / Partida', 'Límite', 'Gasto Real', 'Progreso', '%', 'Estado']],
        body: tableBody,
        headStyles: {
          fillColor: PALETTE.primaryDark,
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: PALETTE.textMain
        },
        alternateRowStyles: {
          fillColor: PALETTE.bgLight
        },
        columnStyles: {
          0: { cellWidth: 46 },
          1: { cellWidth: 26 },
          2: { cellWidth: 26 },
          3: { cellWidth: 32 },
          4: { cellWidth: 16, halign: 'right' },
          5: { cellWidth: 24, fontStyle: 'bold', halign: 'center' }
        },
        didDrawCell: function (data) {
          // Draw native vector progress bar in column 3 (Progreso)
          if (data.section === 'body' && data.column.index === 3) {
            const rawPct = Number(data.cell.raw) || 0;
            const c = data.cell;
            const barW = c.width - 6;
            const barH = 3.5;
            const barX = c.x + 3;
            const barY = c.y + (c.height / 2) - 1.75;

            // Background Track
            doc.setFillColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
            doc.roundedRect(barX, barY, barW, barH, 1.2, 1.2, 'F');

            // Semantic Fill
            const fillWidth = Math.min(barW, Math.max(2, (rawPct / 100) * barW));
            const fillCol = rawPct > 100 ? PALETTE.roseDanger : rawPct > 85 ? PALETTE.amberWarning : PALETTE.emeraldSuccess;
            doc.setFillColor(fillCol[0], fillCol[1], fillCol[2]);
            doc.roundedRect(barX, barY, fillWidth, barH, 1.2, 1.2, 'F');
          }
        },
        didParseCell: function (data) {
          // Suppress text in the vector bar column so only the bar renders
          if (data.section === 'body' && data.column.index === 3) {
            data.cell.text = [];
          }
          if (data.section === 'body' && data.column.index === 5) {
            const status = String(data.cell.raw);
            if (status === 'Excedido') data.cell.styles.textColor = PALETTE.roseDanger;
            else if (status === 'Precaución') data.cell.styles.textColor = PALETTE.amberWarning;
            else data.cell.styles.textColor = PALETTE.emeraldSuccess;
          }
        }
      });
    } else {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
      doc.text('No hay presupuestos activos que solapen con este rango de fechas.', 20, 48);
    }

    const afterTableY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : 60;

    // Budget Health Summary Box
    doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
    doc.setDrawColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
    doc.roundedRect(20, afterTableY, 170, 32, 2.5, 2.5, 'FD');

    const exceededBudgets = budgetRows.filter(b => b.pct > 100);
    const underControlCount = budgetRows.filter(b => b.pct <= 85).length;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    if (exceededBudgets.length > 0) {
      doc.setTextColor(PALETTE.roseDanger[0], PALETTE.roseDanger[1], PALETTE.roseDanger[2]);
      doc.text('⚠️ Alerta de Desviación Presupuestaria Detectada', 26, afterTableY + 9);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      const mainOver = exceededBudgets[0];
      const alertMsg = doc.splitTextToSize(`La partida '${mainOver.name}' superó su asignación por ${formatMoney(Math.abs(mainOver.diff))} (+${mainOver.pct - 100}%). Te recomendamos frenar compras no esenciales en este rubro hasta el próximo ciclo.`, 158);
      doc.text(alertMsg, 26, afterTableY + 17);
    } else {
      doc.setTextColor(PALETTE.emeraldSuccess[0], PALETTE.emeraldSuccess[1], PALETTE.emeraldSuccess[2]);
      doc.text('✓ Excelente Cumplimiento Presupuestario', 26, afterTableY + 9);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      const goodMsg = doc.splitTextToSize(`Todas tus partidas presupuestarias (${underControlCount}/${budgetRows.length}) se mantuvieron dentro de los parámetros previstos. Mantén este ritmo para preservar tu liquidez disponible.`, 158);
      doc.text(goodMsg, 26, afterTableY + 17);
    }

    // ==========================================
    // PÁGINA 3: DISTRIBUCIÓN DE GASTOS & GASTOS HORMIGA
    // ==========================================
    doc.addPage();
    addHeaderFooter(3);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.text('Distribución de Gastos por Categoría', 20, 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
    doc.text('Top 5 categorías con mayor volumen de egreso en el periodo:', 20, 36);

    // Vector Horizontal Bar Chart
    let barStartY = 45;
    const top5 = categoryList.slice(0, 5);
    const maxBarW = 75;

    top5.forEach((cat) => {
      // Name
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      doc.text(cat.name, 20, barStartY);

      // Percentage
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
      doc.text(`${cat.percentage}%`, 66, barStartY, { align: 'right' });

      // Track
      doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
      doc.roundedRect(70, barStartY - 3.5, maxBarW, 4.5, 1.5, 1.5, 'F');

      // Vector Fill
      const catBarWidth = Math.max(3, (cat.percentage / 100) * maxBarW);
      doc.setFillColor(PALETTE.primaryAccent[0], PALETTE.primaryAccent[1], PALETTE.primaryAccent[2]);
      doc.roundedRect(70, barStartY - 3.5, catBarWidth, 4.5, 1.5, 1.5, 'F');

      // Amount
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
      doc.text(formatMoney(cat.amount), 150, barStartY);

      barStartY += 10.5;
    });

    // Complete Table of Categories
    const catTableBody = categoryList.map((c, i) => [
      `${i + 1}. ${c.name}`,
      c.count,
      formatMoney(c.amount),
      `${c.percentage}%`
    ]);

    autoTable(doc, {
      startY: barStartY + 6,
      margin: { left: 20, right: 20 },
      head: [['Categoría', 'Movimientos', 'Monto Acumulado', 'Participación']],
      body: catTableBody,
      headStyles: {
        fillColor: PALETTE.primaryDark,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: PALETTE.textMain
      },
      alternateRowStyles: {
        fillColor: PALETTE.bgLight
      }
    });

    const catTableFinalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : barStartY + 40;

    // Fuga de Capital / Gastos Hormiga Box
    if (hormoneFuga.detected) {
      doc.setFillColor(254, 242, 242); // Red tint
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(20, catTableFinalY, 170, 28, 2.5, 2.5, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(PALETTE.roseDanger[0], PALETTE.roseDanger[1], PALETTE.roseDanger[2]);
      doc.text('🔍 Detección de Fuga de Capital (Gastos Hormiga)', 26, catTableFinalY + 8);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      const fugaDesc = `Se registraron ${hormoneFuga.count} compras frecuentes de bajo importe en '${hormoneFuga.category}', acumulando ${formatMoney(hormoneFuga.total)}. Anualizado, este hábito representa una fuga estimada de ${formatMoney(hormoneFuga.annualized)} que podría capitalizar tus metas de ahorro.`;
      doc.text(doc.splitTextToSize(fugaDesc, 158), 26, catTableFinalY + 15);
    }

    // ==========================================
    // PÁGINA 4: FÓRMULA 50/30/20 & PLAN DE ACCIÓN
    // ==========================================
    doc.addPage();
    addHeaderFooter(4);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.text('Distribución Macroeconómica & Plan de Acción', 20, 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
    doc.text('Equilibrio estructural de tus finanzas personales y recomendaciones tácticas:', 20, 36);

    // 50/30/20 Cards
    const needsAmount = rangeTxs
      .filter(t => t.type === 'expense' && ['cat_food_super', 'cat_bills', 'cat_trans', 'cat_health', 'cat_emergency', 'sub_gas'].includes(t.categoryId || ''))
      .reduce((sum, t) => sum + t.amount, 0);

    const savingsAmount = totalSavings;
    const wantsAmount = Math.max(0, totalExpense - needsAmount);

    const baseRev = totalIncome > 0 ? totalIncome : (totalExpense + totalSavings);
    const needsPct = baseRev > 0 ? Math.round((needsAmount / baseRev) * 100) : 0;
    const wantsPct = baseRev > 0 ? Math.round((wantsAmount / baseRev) * 100) : 0;
    const savPct = baseRev > 0 ? Math.round((savingsAmount / baseRev) * 100) : 0;

    const drawMacroCard = (x: number, y: number, w: number, label: string, target: string, actual: string, pct: number, isGood: boolean) => {
      doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
      doc.setDrawColor(PALETTE.borderLight[0], PALETTE.borderLight[1], PALETTE.borderLight[2]);
      doc.roundedRect(x, y, w, 36, 2.5, 2.5, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
      doc.text(label.toUpperCase(), x + 6, y + 8);

      doc.setFontSize(11);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(isGood ? PALETTE.emeraldSuccess[0] : PALETTE.roseDanger[0], isGood ? PALETTE.emeraldSuccess[1] : PALETTE.roseDanger[1], isGood ? PALETTE.emeraldSuccess[2] : PALETTE.roseDanger[2]);
      doc.text(`${pct}% (Meta: ${target})`, x + 6, y + 18);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      doc.text(`Monto: ${actual}`, x + 6, y + 26);
    };

    drawMacroCard(20, 44, 54, 'Necesidades Fijas', '50%', formatMoney(needsAmount), needsPct, needsPct <= 55);
    drawMacroCard(78, 44, 54, 'Deseos y Ocio', '30%', formatMoney(wantsAmount), wantsPct, wantsPct <= 35);
    drawMacroCard(136, 44, 54, 'Ahorro e Inversión', '20%', formatMoney(savingsAmount), savPct, savPct >= 15);

    // Tactical Action Plan Table
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(PALETTE.primaryDark[0], PALETTE.primaryDark[1], PALETTE.primaryDark[2]);
    doc.text('Plan Táctico para el Siguiente Periodo', 20, 94);

    const actionItems = [
      ['Inmediato (1-3 días)', exceededBudgets.length > 0 ? `Congelar compras en '${exceededBudgets[0].name}' para recuperar margen.` : 'Mantener disciplina en categorías variables.', 'Alta'],
      ['Semanal (Día 7)', goals.length > 0 ? `Aportar el 10% de ingresos a la meta: ${goals[0].name}.` : 'Fijar una meta de ahorro formal en el módulo de Planificación.', 'Alta'],
      ['Quincenal (Día 15)', hormoneFuga.detected ? `Moderar gastos hormiga en '${hormoneFuga.category}' para evitar fugas.` : 'Verificar saldo disponible en tarjetas antes del corte.', 'Media'],
      ['Mensual (Cierre)', netCashFlow < 0 ? 'Reajustar techos presupuestarios para revertir el déficit neto.' : 'Consolidar el superávit neto en el fondo de reserva.', 'Media']
    ];

    autoTable(doc, {
      startY: 100,
      margin: { left: 20, right: 20 },
      head: [['Plazo', 'Acción Recomendada por el Asesor', 'Prioridad']],
      body: actionItems,
      headStyles: {
        fillColor: PALETTE.primaryDark,
        textColor: [255, 255, 255],
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: PALETTE.textMain
      },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold' },
        1: { cellWidth: 106 },
        2: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: function(cellData) {
        if (cellData.section === 'body' && cellData.column.index === 2) {
          if (cellData.cell.raw === 'Alta') cellData.cell.styles.textColor = PALETTE.roseDanger;
          else cellData.cell.styles.textColor = PALETTE.amberWarning;
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 220;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(PALETTE.textMuted[0], PALETTE.textMuted[1], PALETTE.textMuted[2]);
    const legalDisclaimer = doc.splitTextToSize('Aviso de Privacidad y Validez: Este informe ha sido compilado localmente con el motor de análisis patrimonial de FinanList a partir de los datos registrados por el usuario. No constituye asesoramiento financiero regulado ni auditoría bancaria externa. La información se procesa bajo estricta confidencialidad local.', 170);
    doc.text(legalDisclaimer, 20, finalY);

    return doc;
  }
};
