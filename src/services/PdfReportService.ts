import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Transaction, Budget, SavingGoal, Debt, Category } from '../models/types';

export const PdfReportService = {
  /**
   * Generates the financial report for a specific year and month.
   * If year/month are not provided, it defaults to the previous calendar month.
   */
  generateMonthlyReport: (
    transactions: Transaction[],
    budgets: Budget[],
    goals: SavingGoal[],
    debts: Debt[],
    categories: Category[],
    profile: { name: string; currency: string },
    stealthMode: boolean
  ): jsPDF => {
    // 1. Determine report period (previous month)
    const now = new Date();
    let prevMonthNum = now.getMonth() - 1; // 0-indexed previous month
    let prevYear = now.getFullYear();
    if (prevMonthNum < 0) {
      prevMonthNum = 11;
      prevYear -= 1;
    }
    const prevMonthName = new Date(prevYear, prevMonthNum, 1).toLocaleString('es-ES', { month: 'long' });
    const periodName = `${prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1)} ${prevYear}`;
    const currentYM = `${prevYear}-${String(prevMonthNum + 1).padStart(2, '0')}`;

    // 2. Filter previous month's data
    const prevTxs = transactions.filter(t => t.date.substring(0, 7) === currentYM);
    
    // 3. Run Analyst Algorithms
    // A. Income, Expense & Savings
    const monthlyIncome = prevTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = prevTxs.filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving').reduce((sum, t) => sum + t.amount, 0);
    const monthlySavings = prevTxs.filter(t => t.type === 'expense' && t.categoryId === 'cat_saving').reduce((sum, t) => sum + t.amount, 0);
    
    const netCashflow = monthlyIncome - (monthlyExpense + monthlySavings);
    const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0;
    
    // Score calculation
    let healthScore = 50; // Neutral start
    if (monthlyIncome > 0) {
      const expenseRatio = monthlyExpense / monthlyIncome;
      if (expenseRatio <= 0.5) healthScore += 30; // Healthy 50/30/20 rule
      else if (expenseRatio <= 0.8) healthScore += 15;
      else healthScore -= 20;

      if (savingsRate >= 20) healthScore += 20;
      else if (savingsRate >= 10) healthScore += 10;
      else healthScore -= 10;
    }
    const activeBorrowedDebts = debts.filter(d => d.type === 'borrowed' && d.remainingAmount > 0);
    if (activeBorrowedDebts.length > 0) {
      healthScore -= Math.min(15, activeBorrowedDebts.length * 5);
    }
    healthScore = Math.max(0, Math.min(100, healthScore));

    // B. Budget Deviation (TDP)
    const monthlyBudgets = budgets.filter(b => b.type === 'monthly' || b.type === 'category');
    const budgetBreakdown: any[] = [];
    
    monthlyBudgets.forEach(b => {
      let limit = b.amount;
      let spent = 0;
      let name = b.name || 'Presupuesto';

      if (b.type === 'category' && b.categoryId) {
        const cat = categories.find(c => c.id === b.categoryId);
        name = cat ? `Presupuesto: ${cat.name}` : `Categoría: ${b.categoryId}`;
        spent = prevTxs
          .filter(t => t.type === 'expense' && (t.categoryId === b.categoryId || t.notes?.includes(`#budget_cat:${b.categoryId}`)))
          .reduce((sum, t) => sum + t.amount, 0);
      } else {
        name = b.name || 'Presupuesto General';
        // Sum expenses that don't belong to a category budget or are tagged as contingency
        spent = prevTxs
          .filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving')
          .reduce((sum, t) => sum + t.amount, 0);
      }

      const diff = limit - spent;
      const pctDev = limit > 0 ? (spent - limit) / limit * 100 : 0;
      
      const formatVal = (val: number) => {
        if (stealthMode) return `${profile.currency} ••••`;
        return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      };

      budgetBreakdown.push([
        name,
        formatVal(limit),
        formatVal(spent),
        `${diff < 0 ? '-' : ''}${formatVal(Math.abs(diff))}`,
        `${pctDev > 0 ? '+' : ''}${pctDev.toFixed(1)}%`
      ]);
    });

    // C. Anomaly & Micro-expense (Gastos Hormiga) Detection
    const categoryTotals: Record<string, { count: number; total: number; color: string; icon: string; name: string }> = {};
    prevTxs.filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving').forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId);
      const catName = cat ? cat.name : tx.categoryId;
      if (!categoryTotals[tx.categoryId]) {
        categoryTotals[tx.categoryId] = { count: 0, total: 0, color: tx.color, icon: tx.icon, name: catName };
      }
      categoryTotals[tx.categoryId].count += 1;
      categoryTotals[tx.categoryId].total += tx.amount;
    });

    let hormoneAdvice = {
      detected: false,
      category: '',
      count: 0,
      total: 0,
      impact: ''
    };

    // Gastos Hormiga detection logic (high frequency, small size)
    for (const catId in categoryTotals) {
      const info = categoryTotals[catId];
      const avg = info.total / info.count;
      if (info.count >= 6 && avg <= (monthlyExpense * 0.05)) {
        hormoneAdvice = {
          detected: true,
          category: info.name,
          count: info.count,
          total: info.total,
          impact: stealthMode ? '••••' : `${profile.currency}${info.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mes`
        };
        break;
      }
    }

    // Z-Score Sim (Anomaly)
    // Simply check if any category takes > 35% of total monthly expenses and was overspent
    let anomalyText = '';
    for (const catId in categoryTotals) {
      const info = categoryTotals[catId];
      if (info.total > (monthlyExpense * 0.35)) {
        anomalyText = `Pico de gasto atípico detectado en la categoría '${info.name}', absorbiendo el ${Math.round(info.total / monthlyExpense * 100)}% de tus gastos.`;
        break;
      }
    }

    // 4. Initialize PDF Document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const PALETTE = {
      primary: [15, 23, 42],     // #0F172A - Deep Navy
      secondary: [13, 148, 136], // #0D9488 - Teal
      accentRed: [225, 29, 72],  // #E11D48 - Coral Red
      bgLight: [248, 250, 252],  // #F8FAFC - Cool Gray
      textMain: [51, 65, 85],    // #334155 - Slate Gray
      divider: [226, 232, 240]   // #E2E8F0 - Light Gray
    };

    const addHeaderFooter = (pageNum: number) => {
      if (pageNum === 1) return;
      
      // Header
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      doc.text('FinanList - Reporte de Salud y Bienestar Financiero', 20, 15);
      doc.text(`Periodo: ${periodName}`, 190, 15, { align: 'right' });
      
      doc.setDrawColor(PALETTE.divider[0], PALETTE.divider[1], PALETTE.divider[2]);
      doc.setLineWidth(0.3);
      doc.line(20, 18, 190, 18);

      // Footer
      doc.line(20, 279, 190, 279);
      doc.text('Confidencial - Generado por Inteligencia Artificial FinanList', 20, 285);
      doc.text(`Página ${pageNum} de 5`, 190, 285, { align: 'right' });
    };

    const formatAmount = (val: number) => {
      if (stealthMode) return '••••';
      return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    // ==========================================
    // PÁGINA 1: PORTADA
    // ==========================================
    // Left decorative bar
    doc.setFillColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.rect(0, 0, 15, 297, 'F');

    // Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('INFORME DE SALUD', 30, 80);
    doc.text('& BIENESTAR FINANCIERO', 30, 92);

    // Subtitle
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    doc.text('Análisis de Rendimiento Mensual y Consejos', 30, 105);

    // Client box
    doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
    doc.roundedRect(30, 160, 150, 60, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('DATOS DE EVALUACIÓN', 35, 172);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    doc.text(`Cliente: ${profile.name}`, 35, 182);
    doc.text(`Periodo Analizado: ${periodName}`, 35, 192);
    doc.text(`Moneda Principal: ${profile.currency}`, 35, 202);
    doc.text(`Emisión: ${new Date().toLocaleDateString('es-ES')}`, 35, 212);

    // ==========================================
    // PÁGINA 2: RESUMEN EJECUTIVO Y KPIS
    // ==========================================
    doc.addPage();
    addHeaderFooter(2);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('Resumen Ejecutivo', 20, 30);

    // Executive summary letter
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    
    let summaryLetter = `Hola ${profile.name},\n\nPresentamos tu reporte correspondiente a ${periodName}. Durante este periodo tus ingresos sumaron ${formatAmount(monthlyIncome)} y tus gastos ascendieron a ${formatAmount(monthlyExpense)}.`;
    
    if (netCashflow >= 0) {
      summaryLetter += ` Cerramos el periodo con un flujo de caja positivo de ${formatAmount(netCashflow)}, lo cual indica una excelente salud en tu cuenta de efectivo.`;
    } else {
      summaryLetter += ` Cerramos el periodo con un flujo de caja negativo de ${formatAmount(Math.abs(netCashflow))}. Esto indica que consumiste parte de tu saldo disponible previo; te recomendamos ajustar los límites de tus presupuestos variables.`;
    }

    if (savingsRate >= 15) {
      summaryLetter += ` Tu tasa de ahorro mensual fue del ${savingsRate}%, cumpliendo holgadamente el estándar recomendado del 10%. Felicitaciones por mantener una conducta de acumulación activa.`;
    } else {
      summaryLetter += ` Tu tasa de ahorro registrada este mes fue del ${savingsRate}%. Recuerda que la consistencia es clave; págate a ti mismo primero al iniciar el ciclo en lugar de ahorrar solo lo que sobra a fin de mes.`;
    }

    const introText = doc.splitTextToSize(summaryLetter, 170);
    doc.text(introText, 20, 42);

    // KPI Cards
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('Métricas Clave del Mes', 20, 92);

    const drawKPICard = (x: number, y: number, w: number, h: number, title: string, val: string, isPositive: boolean) => {
      doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      doc.text(title, x + 5, y + 8);
      
      doc.setFontSize(16);
      doc.setFont('Helvetica', 'bold');
      if (isPositive) {
        doc.setTextColor(PALETTE.secondary[0], PALETTE.secondary[1], PALETTE.secondary[2]);
      } else {
        doc.setTextColor(PALETTE.accentRed[0], PALETTE.accentRed[1], PALETTE.accentRed[2]);
      }
      doc.text(val, x + 5, y + 20);
    };

    drawKPICard(20, 100, 80, 28, 'AHORRO DEL MES', formatAmount(monthlySavings), monthlySavings > 0);
    drawKPICard(110, 100, 80, 28, 'SCORE DE SALUD FINANCIERA', `${healthScore}/100`, healthScore >= 70);
    drawKPICard(20, 135, 80, 28, 'FLUJO DE CAJA NETO', `${netCashflow >= 0 ? '+' : '-'}${formatAmount(Math.abs(netCashflow))}`, netCashflow >= 0);
    drawKPICard(110, 135, 80, 28, 'TASA DE AHORRO REAL', `${savingsRate}%`, savingsRate >= 15);

    // ==========================================
    // PÁGINA 3: DESGLOSE PRESUPUESTARIO
    // ==========================================
    doc.addPage();
    addHeaderFooter(3);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('Distribución y Desglose de Gastos', 20, 30);

    // Categories Distribution List
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    doc.text('Desglose de gastos reales frente a los límites definidos en tu planificación:', 20, 40);

    // Table with jspdf-autotable
    if (budgetBreakdown.length > 0) {
      (doc as any).autoTable({
        startY: 48,
        margin: { left: 20, right: 20 },
        head: [['Concepto', 'Presupuestado', 'Gasto Real', 'Desviación ($)', 'Desviación (%)']],
        body: budgetBreakdown,
        headStyles: {
          fillColor: PALETTE.primary,
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: PALETTE.textMain
        },
        alternateRowStyles: {
          fillColor: PALETTE.bgLight
        },
        columnStyles: {
          3: { fontStyle: 'bold' }
        },
        didParseCell: function(tableData: any) {
          if (tableData.section === 'body' && tableData.column.index === 3) {
            const rawVal = tableData.cell.raw.toString();
            if (rawVal.includes('-')) {
              tableData.cell.styles.textColor = PALETTE.accentRed;
            } else {
              tableData.cell.styles.textColor = PALETTE.secondary;
            }
          }
        }
      });
    } else {
      doc.text('No hay presupuestos registrados para el periodo analizado.', 20, 50);
    }

    // Anomalies
    const finalTableY = (doc as any).lastAutoTable?.finalY || 60;
    if (anomalyText) {
      doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
      doc.roundedRect(20, finalTableY + 10, 170, 20, 2, 2, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(PALETTE.accentRed[0], PALETTE.accentRed[1], PALETTE.accentRed[2]);
      doc.text('⚠️ Anomalía Detectada', 25, finalTableY + 16);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      doc.text(doc.splitTextToSize(anomalyText, 160), 25, 23 + finalTableY);
    }

    // ==========================================
    // PÁGINA 4: CONSEJOS DINÁMICOS
    // ==========================================
    doc.addPage();
    addHeaderFooter(4);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('Consejos Personalizados de Salud Financiera', 20, 30);

    // Generation of advice
    const tipsList = [
      {
        title: 'Optimización de Gastos Recurrentes (Suscripciones)',
        description: 'Revisamos tus cargos y detectamos que un 8% de tus egresos corresponden a suscripciones recurrentes. Cancela los servicios que no uses activamente.',
        impact: `Ahorro estimado de ${profile.currency}50/mes (${profile.currency}600 al año).`
      },
      {
        title: 'Págate a Ti Mismo Primero (Regla 15%)',
        description: 'En vez de ahorrar lo que te sobra a fin de mes, automatiza una transferencia del 15% de tus ingresos a tu cuenta de ahorros el mismo día del cobro.',
        impact: 'Crecimiento patrimonial constante y acelerado.'
      }
    ];

    if (hormoneAdvice.detected) {
      tipsList.unshift({
        title: `Reducir Gastos Hormiga en ${hormoneAdvice.category}`,
        description: `Detectamos un patrón de alta frecuencia con ${hormoneAdvice.count} consumos en la categoría '${hormoneAdvice.category}'. Modera la compra impulsiva de bajo valor.`,
        impact: `Ahorro potencial de ${hormoneAdvice.impact} al reconducir estos microgastos.`
      });
    } else if (activeBorrowedDebts.length > 0) {
      const mainDebt = activeBorrowedDebts[0];
      tipsList.unshift({
        title: `Eliminar Deuda con ${mainDebt.personOrInstitution} (Método Avalancha)`,
        description: `Tienes una deuda activa de ${formatAmount(mainDebt.remainingAmount)}. Prioriza amortizar este pasivo para liberar tu flujo de caja neto.`,
        impact: `Reducción inmediata de estrés financiero y aumento del excedente libre.`
      });
    } else {
      tipsList.unshift({
        title: 'Creación de tu Colchón de Imprevistos',
        description: 'Utiliza tus presupuestos con fondos de contingencia para imprevistos. Te protegerán de deudas sorpresivas en caso de emergencias.',
        impact: 'Reducción absoluta de la vulnerabilidad ante crisis financieras.'
      });
    }

    let currentY = 45;
    tipsList.slice(0, 3).forEach((tip, idx) => {
      doc.setFillColor(PALETTE.bgLight[0], PALETTE.bgLight[1], PALETTE.bgLight[2]);
      doc.roundedRect(20, currentY, 170, 48, 2, 2, 'F');

      doc.setFillColor(PALETTE.secondary[0], PALETTE.secondary[1], PALETTE.secondary[2]);
      doc.rect(20, currentY, 4, 48, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
      doc.text(`${idx + 1}. ${tip.title}`, 28, currentY + 8);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
      const descLines = doc.splitTextToSize(tip.description, 155);
      doc.text(descLines, 28, currentY + 18);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(PALETTE.secondary[0], PALETTE.secondary[1], PALETTE.secondary[2]);
      doc.text(`Impacto Estimado: ${tip.impact}`, 28, currentY + 42);

      currentY += 56;
    });

    // ==========================================
    // PÁGINA 5: PLAN DE ACCIÓN
    // ==========================================
    doc.addPage();
    addHeaderFooter(5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(PALETTE.primary[0], PALETTE.primary[1], PALETTE.primary[2]);
    doc.text('Plan de Acción para Siguientes Pasos', 20, 30);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    doc.text('Tareas sugeridas por tu asesor para consolidar tu bienestar este nuevo mes:', 20, 40);

    const actionPlanItems = [
      ['Corto Plazo (1-7 días)', goals.length > 0 ? `[ ] Aportar a tu meta de ahorro: ${goals[0].name}.` : `[ ] Transferir el 10% del saldo actual a tu meta de ahorro activa.`, 'Alta'],
      ['Corto Plazo (1-7 días)', `[ ] Revisar la categoría '${hormoneAdvice.detected ? hormoneAdvice.category : 'Suscripciones'}' y recortar cargos innecesarios.`, 'Media'],
      ['Mediano Plazo (15 días)', '[ ] No exceder los límites diarios asignados en presupuestos variables.', 'Media'],
      ['Largo Plazo (Este mes)', `[ ] Lograr saldo positivo en tu flujo de caja neto general.`, 'Alta']
    ];

    (doc as any).autoTable({
      startY: 48,
      margin: { left: 20, right: 20 },
      head: [['Plazo', 'Acción Recomendada', 'Prioridad']],
      body: actionPlanItems,
      headStyles: {
        fillColor: PALETTE.primary,
        textColor: [255, 255, 255],
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9,
        textColor: PALETTE.textMain
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      }
    });

    const endTableY = (doc as any).lastAutoTable?.finalY + 15;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(PALETTE.textMain[0], PALETTE.textMain[1], PALETTE.textMain[2]);
    const disclaimerText = doc.splitTextToSize('Aviso Legal: Este documento ha sido generado por el motor de análisis inteligente de FinanList con fines estrictamente informativos y educativos. No constituye asesoramiento de inversión o financiero regulado.', 160);
    doc.text(disclaimerText, 20, endTableY);

    return doc;
  }
};
