import React from 'react';
import { useApp } from '../context/AppContext';
import { StatsService } from '../services/StatsService';
import { DonutChart } from '../components/DonutChart';
import { DynamicIcon } from '../components/DynamicIcon';
import { Transaction } from '../models/types';
import { NotificationCenter } from '../components/NotificationCenter';

interface HomeViewProps {
  onOpenTransactionModal: (editTx?: Transaction, defaultType?: 'income' | 'expense') => void;
}

const FINANCE_QUOTES = [
  "El dinero es un gran siervo pero un mal amo. — Francis Bacon",
  "No ahorres lo que queda después de gastar; gasta lo que queda después de ahorrar. — Warren Buffett",
  "La riqueza consiste mucho más en el disfrute que en la posesión. — Aristóteles",
  "La mejor inversión que puedes hacer es en ti mismo. — Warren Buffett",
  "Controla tus finanzas o ellas te controlarán a ti. — Dave Ramsey",
  "El camino hacia la riqueza depende fundamentalmente de dos palabras: trabajo y ahorro. — Benjamin Franklin"
];

export const HomeView: React.FC<HomeViewProps> = ({ onOpenTransactionModal }) => {
  const { transactions, budgets, profile, deleteTransaction, categories, setActiveTab, stealthMode, setStealthMode, goals, debts, cards, notifications } = useApp();
  const [showNotificationCenter, setShowNotificationCenter] = React.useState<boolean>(false);
  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;
  // Check if monthly budget report should appear automatically (strictly on Day 1 of each month)
  const getMonthlyBudgetReportStatus = () => {
    const now = new Date();
    // Only display automatically on Day 1 of the month
    const isDayOne = now.getDate() === 1;

    let prevM = now.getMonth() - 1;
    let prevY = now.getFullYear();
    if (prevM < 0) {
      prevM = 11;
      prevY -= 1;
    }
    const prevYM = `${prevY}-${String(prevM + 1).padStart(2, '0')}`;
    const prevMonthName = new Date(prevY, prevM, 1).toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1);

    const isDismissedOrDownloaded = localStorage.getItem('finanlist_dismissed_report_' + prevYM) === 'true';
    const shouldShow = isDayOne && !isDismissedOrDownloaded;

    // Calculate previous month's budget data
    const prevTxs = transactions.filter(t => t.date.substring(0, 7) === prevYM);
    const prevExpense = prevTxs
      .filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving')
      .reduce((sum, t) => sum + t.amount, 0);

    const prevMonthBudgets = budgets.filter(b => b.type === 'monthly' && b.startDate.substring(0, 7) === prevYM);
    const totalBudgetLimit = prevMonthBudgets.reduce((sum, b) => sum + b.amount, 0);
    const leftover = Math.max(0, totalBudgetLimit - prevExpense);

    return {
      shouldShow,
      prevYM,
      label: `${capitalizedMonth} ${prevY}`,
      monthName: capitalizedMonth,
      budgetLimit: totalBudgetLimit,
      spent: prevExpense,
      leftover,
      hasBudgets: totalBudgetLimit > 0
    };
  };

  const monthlyReportData = getMonthlyBudgetReportStatus();
  const [showMonthlyBudgetCard, setShowMonthlyBudgetCard] = React.useState<boolean>(monthlyReportData.shouldShow);

  const handleDownloadMonthlyBudgetReport = async () => {
    try {
      const { PdfReportService } = await import('../services/PdfReportService');
      const doc = PdfReportService.generateMonthlyReport(
        transactions,
        budgets,
        goals,
        debts,
        categories,
        profile,
        stealthMode,
        monthlyReportData.prevYM
      );
      doc.save(`FinanList_Reporte_${monthlyReportData.prevYM}.pdf`);
      localStorage.setItem('finanlist_dismissed_report_' + monthlyReportData.prevYM, 'true');
      setShowMonthlyBudgetCard(false);
      alert('Reporte mensual de presupuesto descargado con éxito.');
    } catch (err) {
      console.error(err);
      alert('Hubo un error al generar el reporte.');
    }
  };

  const handleDismissMonthlyBudgetReport = () => {
    localStorage.setItem('finanlist_dismissed_report_' + monthlyReportData.prevYM, 'true');
    setShowMonthlyBudgetCard(false);
  };

  // Get daily/weekly random quote based on day
  const quoteIdx = new Date().getDate() % FINANCE_QUOTES.length;
  const quoteOfTheDay = FINANCE_QUOTES[quoteIdx];

  const summary = StatsService.getSummary(transactions, budgets, cards, undefined, debts, goals);
  const chartData = StatsService.getExpenseByCategory(transactions);
  
  // Format Currency Helper (with Stealth support)
  const formatVal = (val: number) => {
    if (stealthMode) return `${profile.currency} ••••`;
    return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatAccountVal = (val: number) => {
    if (stealthMode) return '••••';
    return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderHierarchicalBalance = (val: number) => {
    if (stealthMode) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-secondary)' }}>{profile.currency}</span>
          <span style={{ fontSize: '32px', fontWeight: '800' }}>••••</span>
        </span>
      );
    }
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const parts = absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '00';

    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '2px', fontFamily: 'var(--font-display)' }}>
        {isNegative && <span style={{ fontSize: '26px', fontWeight: '800', color: 'var(--color-danger)' }}>-</span>}
        <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-secondary)', marginRight: '2px' }}>
          {profile.currency}
        </span>
        <span style={{ fontSize: '36px', fontWeight: '800', color: isNegative ? 'var(--color-danger)' : 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          {integerPart}
        </span>
        <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-secondary)' }}>
          .{decimalPart}
        </span>
      </span>
    );
  };

  const getWeeklyReport = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Filter last 7 days of transactions
    const weeklyTxs = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= sevenDaysAgo && txDate <= now;
    });
    
    const weeklyIncome = weeklyTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const weeklyExpense = weeklyTxs.filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving').reduce((sum, t) => sum + t.amount, 0);
    
    let score = 100;
    if (weeklyExpense > 0) {
      if (weeklyIncome > 0) {
        const ratio = weeklyExpense / weeklyIncome;
        score = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
      } else {
        const monthlyB = budgets.find(b => b.type === 'monthly');
        const monthlyLimit = monthlyB ? monthlyB.amount : 10000;
        const weeklyShare = monthlyLimit / 4.3;
        const ratio = weeklyExpense / weeklyShare;
        score = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, ratio / 2)) * 100)));
      }
    }
    
    let statusText = 'Saludable 🟢';
    let statusColor = 'var(--color-success)';
    let advice = '¡Excelente control! Has mantenido tus gastos por debajo de tus ingresos esta semana.';
    
    if (score < 50) {
      statusText = 'Crítico 🔴';
      statusColor = 'var(--color-danger)';
      advice = 'Tus gastos de esta semana superan el límite saludable. Considera recortar salidas discrecionales.';
    } else if (score < 80) {
      statusText = 'Precaución 🟡';
      statusColor = 'var(--color-warning)';
      advice = 'Buen trabajo, pero estás cerca de tu límite semanal. Monitorea tu presupuesto general.';
    }
    
    return {
      weeklyIncome,
      weeklyExpense,
      score,
      statusText,
      statusColor,
      advice
    };
  };

  const weeklyReport = getWeeklyReport();

  // Recent transactions (Top 5)
  const recentTransactions = transactions.slice(0, 5);

  const handleDeleteTx = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering edit sheet
    if (confirm('¿Estás seguro de que deseas eliminar este movimiento?')) {
      deleteTransaction(id);
    }
  };

  return (
    <div className="view-screen animate-fade-in">
      {/* Fixed View Header */}
      <div className="view-header">
        <div style={styles.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <DynamicIcon name="Coins" size={20} color="var(--color-primary)" />
              <h1 style={{
                fontSize: '22px',
                fontWeight: '900',
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                FinanList
              </h1>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Hola de nuevo, <b>{profile.name}</b>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Notification Center Bell */}
            <button
              onClick={() => setShowNotificationCenter(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: unreadNotifsCount > 0 ? 'var(--color-primary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                position: 'relative'
              }}
              title="Centro de Notificaciones"
            >
              <DynamicIcon name="Bell" size={20} />
              {unreadNotifsCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: 'var(--color-danger)',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: '800',
                  borderRadius: '10px',
                  minWidth: '15px',
                  height: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  boxShadow: '0 0 0 2px var(--bg-phone)'
                }}>
                  {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setStealthMode(!stealthMode)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px'
              }}
              title={stealthMode ? 'Mostrar montos' : 'Ocultar montos'}
            >
              <DynamicIcon name={stealthMode ? 'EyeOff' : 'Eye'} size={20} />
            </button>
            
            <div 
              style={{ ...styles.avatarCircle, cursor: 'pointer' }} 
              onClick={() => setActiveTab('profile')}
              title="Ver perfil"
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="Profile" style={styles.avatarImg} />
              ) : (
                <span style={styles.avatarInitial}>{profile.name.charAt(0)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="view-content">
        {/* Motivational Quote banner */}
        <div style={styles.quoteBanner}>
          <DynamicIcon name="Sparkles" size={16} color="var(--color-primary)" />
          <span style={{ ...styles.quoteText, flex: 1, minWidth: 0 }}>{quoteOfTheDay}</span>
        </div>

      {/* Reporte mensual de presupuesto (Solo aparece automáticamente el día 1 de cada mes) */}
      {showMonthlyBudgetCard && (
        <div className="card animate-fade-in" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px', 
          borderLeft: '4px solid var(--color-primary)', 
          position: 'relative',
          paddingRight: '36px',
          backgroundColor: 'var(--color-primary-light)'
        }}>
          <button 
            onClick={handleDismissMonthlyBudgetReport}
            aria-label="Cerrar reporte"
            style={{ 
              position: 'absolute', 
              top: '12px', 
              right: '12px', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <DynamicIcon name="X" size={16} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', color: 'var(--color-primary)' }}>
            <DynamicIcon name="FileText" size={16} />
            <span>Reporte mensual de presupuesto</span>
          </div>
          
          <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>
            Tu reporte mensual correspondiente a <b>{monthlyReportData.label}</b> está disponible.
            {monthlyReportData.hasBudgets && (
              <> Límite: <b>{formatVal(monthlyReportData.budgetLimit)}</b> | Gastado: <b>{formatVal(monthlyReportData.spent)}</b>.</>
            )}
          </p>

          {monthlyReportData.hasBudgets && monthlyReportData.leftover > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: '600' }}>
              🎉 Sobrante final del mes: {formatVal(monthlyReportData.leftover)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
            <button 
              onClick={handleDownloadMonthlyBudgetReport}
              className="btn btn-primary"
              style={{ 
                padding: '8px 16px', 
                fontSize: '12px', 
                width: 'fit-content',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <DynamicIcon name="Download" size={14} />
              <span>Descargar Reporte PDF</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '12px', width: 'fit-content' }}
            >
              Ver en Estadísticas
            </button>
          </div>
        </div>
      )}

      {/* Hero Balance Card */}
      <div className="card" style={styles.balanceHero}>
        <div style={styles.balanceHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Dinero Disponible</span>
            <button
              type="button"
              onClick={() => setStealthMode(!stealthMode)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px'
              }}
              title={stealthMode ? 'Mostrar montos' : 'Ocultar montos'}
              aria-label={stealthMode ? 'Mostrar montos' : 'Ocultar montos'}
            >
              <DynamicIcon name={stealthMode ? 'EyeOff' : 'Eye'} size={15} />
            </button>
          </div>
          {summary.consolidatedNetBalance !== summary.availableCash && (
            <span 
              style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', textTransform: 'none' }} 
              title="Patrimonio neto total: Activos menos Deudas"
            >
              Patrimonio: {formatVal(summary.consolidatedNetBalance)}
            </span>
          )}
        </div>

        <div style={styles.balanceValue}>{renderHierarchicalBalance(summary.availableCash)}</div>

        {/* Desglose en mini-tarjetas / chips simétricos (Efectivo vs Cuentas/Débito) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {/* Chip 1: Efectivo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            minWidth: 0
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <DynamicIcon name="Banknote" size={15} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Efectivo
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatAccountVal(summary.cashBalance)}
              </div>
            </div>
          </div>

          {/* Chip 2: Cuentas / Débito */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            minWidth: 0
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <DynamicIcon name="CreditCard" size={15} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Cuentas / Débito
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatAccountVal(summary.debitCardsBalance ?? summary.bankBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Fila secundaria de Crédito Disponible (con menor peso visual para no confundirlo con dinero líquido) */}
        {summary.totalCreditAvailable > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 12px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            border: '1px dashed rgba(99, 102, 241, 0.25)',
            fontSize: '11px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DynamicIcon name="CreditCard" size={13} color="#6366f1" />
              <span>
                Crédito disponible: <strong style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{formatAccountVal(summary.totalCreditAvailable)}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="Ir a gestionar tarjetas"
            >
              Gestionar ➔
            </button>
          </div>
        )}

        {/* Módulos independientes secundarios (Inversiones, Por cobrar, Deudas, Saldo a Favor) */}
        {(summary.investmentsBalance > 0 || summary.totalReceivables > 0 || (summary.statementBalance ?? 0) > 0 || summary.totalOwedDebts > 0 || (summary.totalPositiveBalance ?? 0) > 0 || ((summary.statementBalance ?? 0) === 0 && summary.nextCutoffInfo && summary.totalCreditAvailable > 0)) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {summary.investmentsBalance > 0 && (
              <span 
                style={{
                  ...styles.availableBadge,
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  color: '#8b5cf6',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('budget')}
                title="Portafolio de Inversiones (activo independiente)"
              >
                📈 Inversiones: {formatAccountVal(summary.investmentsBalance)}
              </span>
            )}
            {summary.totalReceivables > 0 && (
              <span 
                style={{
                  ...styles.availableBadge,
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--color-success)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('budget')}
                title="Préstamos otorgados pendientes de cobro (activo independiente)"
              >
                🤝 Por cobrar: {formatAccountVal(summary.totalReceivables)}
              </span>
            )}
            {(summary.totalPositiveBalance ?? 0) > 0 && (
              <span 
                style={{
                  ...styles.availableBadge,
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--color-success)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('cards')}
                title="Saldo a favor acreditado en tarjetas de crédito por sobrepagos"
              >
                ✨ Saldo a favor: {formatAccountVal(summary.totalPositiveBalance)}
              </span>
            )}
            {(summary.statementBalance ?? 0) > 0 ? (
              <span 
                style={{
                  ...styles.availableBadge,
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('cards')}
                title="Saldo facturado exigible tras el corte de tarjeta (haz clic para pagar)"
              >
                💳 Saldo a pagar (facturado): {formatAccountVal(summary.statementBalance)}
              </span>
            ) : summary.nextCutoffInfo && (summary.totalCreditAvailable > 0 || summary.totalCreditCardDebt > 0) ? (
              <span 
                style={{
                  ...styles.availableBadge,
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  color: '#6366f1',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('cards')}
                title="Tarjeta dentro del ciclo de facturación actual (sin deuda facturada)"
              >
                🗓️ Próximo corte: en {summary.nextCutoffInfo.daysRemaining} {summary.nextCutoffInfo.daysRemaining === 1 ? 'día' : 'días'} ({summary.nextCutoffInfo.cardName})
              </span>
            ) : null}
            {summary.totalOwedDebts > 0 && (
              <span 
                style={{
                  ...styles.availableBadge,
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('budget')}
                title="Deudas por pagar a plazos (pasivo independiente - haz clic para abonar o gestionar)"
              >
                ⏳ Deuda por pagar: {formatAccountVal(summary.totalOwedDebts)}
              </span>
            )}
          </div>
        )}

        <div style={styles.inOutGrid}>
          <div style={styles.inOutItem}>
            <div style={{ ...styles.inOutIconCircle, backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
              <DynamicIcon name="ArrowDownLeft" size={18} />
            </div>
            <div>
              <div style={styles.inOutLabel}>Ingresos</div>
              <div style={styles.inOutValIncome}>{formatVal(summary.monthlyIncome)}</div>
            </div>
          </div>

          <div style={styles.inOutItem}>
            <div style={{ ...styles.inOutIconCircle, backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <DynamicIcon name="ArrowUpRight" size={18} />
            </div>
            <div>
              <div style={styles.inOutLabel}>Gastos</div>
              <div style={styles.inOutValExpense}>{formatVal(summary.monthlyExpense)}</div>
            </div>
          </div>
        </div>
        
        {/* Mini stats for savings */}
        <div style={styles.savingsRow}>
          <span style={styles.savingsLabel}>Ahorro destinado este mes:</span>
          <span style={styles.savingsVal}>{formatVal(summary.monthlySavings)}</span>
        </div>
      </div>

      {/* Quick Access Buttons (2 botones simétricos) */}
      <div style={styles.quickActionsGrid}>
        <button
          onClick={() => onOpenTransactionModal(undefined, 'expense')}
          style={{ ...styles.actionBtn, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
        >
          <DynamicIcon name="Minus" size={16} />
          <span>Registrar Gasto</span>
        </button>
        <button
          onClick={() => onOpenTransactionModal(undefined, 'income')}
          style={{ ...styles.actionBtn, backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}
        >
          <DynamicIcon name="Plus" size={16} />
          <span>Añadir Ingreso</span>
        </button>
      </div>

      {/* Recent Movements Section */}
      <div>
        <div style={styles.sectionTitleRow}>
          <h3>Movimientos Recientes</h3>
          <span 
            onClick={() => setActiveTab('history')} 
            style={{ ...styles.sectionTitleLink, cursor: 'pointer' }}
          >
            Ver todos
          </span>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="tx-list">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="tx-item"
                onClick={() => onOpenTransactionModal(tx)}
              >
                <div style={{ ...styles.txIconWrapper, backgroundColor: tx.color }}>
                  <DynamicIcon name={tx.icon} size={20} color="white" />
                </div>
                <div className="tx-details">
                  <div className="tx-title">
                    {(() => {
                      const cat = categories.find(c => c.id === tx.categoryId);
                      if (tx.notes) {
                        const cleanNotes = tx.notes.replace(/#\w+(:[^\s]+)?/g, '').trim();
                        if (cleanNotes) return cleanNotes;
                      }
                      return cat ? cat.name : tx.categoryId.replace('cat_', '').replace(/^\w/, c => c.toUpperCase());
                    })()}
                    {tx.favorite && (
                      <span style={{ marginLeft: '6px' }}>
                        <DynamicIcon name="Heart" size={12} color="#f43f5e" />
                      </span>
                    )}
                  </div>
                  <div className="tx-meta">
                    <span>{tx.account}</span>
                    <span>•</span>
                    <span>{tx.date} {tx.time}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`tx-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatVal(tx.amount)}
                  </div>
                  <button
                    onClick={(e) => handleDeleteTx(tx.id, e)}
                    style={styles.deleteTxBtn}
                    title="Eliminar movimiento"
                  >
                    <DynamicIcon name="Trash2" size={14} color="var(--text-muted)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <DynamicIcon name="Compass" size={32} className="empty-state-icon" />
            <p>No hay transacciones registradas este mes.</p>
            <p className="empty-state-quote">"El primer paso para ahorrar es saber en qué gastas."</p>
          </div>
        )}
      </div>

      {/* Budget Indicator Card */}
      <div className="card">
        <div style={styles.budgetHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DynamicIcon name="Activity" size={18} color="var(--color-primary)" />
            <span style={{ fontWeight: '600', fontSize: '14px' }}>Presupuesto Consumido</span>
          </div>
          <span style={styles.budgetValue}>{summary.budgetProgress.toFixed(0)}%</span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${summary.budgetProgress}%`,
              backgroundColor: summary.budgetProgress > 90 ? 'var(--color-danger)' : 'var(--color-primary)'
            }}
          />
        </div>
        <div style={styles.budgetFooter}>
          {summary.budgetProgress > 90 ? (
            <span style={{ color: 'var(--color-danger)', fontSize: '11px', fontWeight: '500' }}>
              ⚠️ ¡Atención! Has superado el 90% de tu presupuesto.
            </span>
          ) : (
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
              Vas por buen camino en este ciclo.
            </span>
          )}
        </div>
      </div>

      {/* Expense category ring chart */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-title">
          <span>Distribución de Gastos</span>
          <DynamicIcon name="PieChart" size={16} />
        </div>
        {chartData.length > 0 ? (
          <div style={styles.chartLayout}>
            <DonutChart data={chartData} total={summary.monthlyExpense} currency={profile.currency} stealthMode={stealthMode} />
            <div style={styles.chartLegendGrid}>
              {chartData.slice(0, 3).map((item) => (
                <div key={item.categoryId} style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: item.color }} />
                  <span style={styles.legendLabel}>{item.name}</span>
                  <span style={styles.legendValue}>{item.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
            <DonutChart data={[]} total={0} currency={profile.currency} stealthMode={stealthMode} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Registra un gasto este mes para ver tu distribución.
            </span>
          </div>
        )}
      </div>

      {/* Weekly Health Report Card */}
      <div className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DynamicIcon name="HeartPulse" size={18} color={weeklyReport.statusColor} />
            <span style={{ fontWeight: '700', fontSize: '14px' }}>Salud Financiera Semanal</span>
          </div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '700', 
            color: 'white',
            backgroundColor: weeklyReport.statusColor,
            padding: '2px 8px',
            borderRadius: '12px'
          }}>
            {weeklyReport.statusText}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            width: '54px', 
            height: '54px', 
            borderRadius: '50%', 
            border: `3px solid ${weeklyReport.statusColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            fontSize: '16px',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-input)'
          }}>
            {weeklyReport.score}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Últimos 7 días</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
              <span>Ingresado: {formatVal(weeklyReport.weeklyIncome)}</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span>Gastado: {formatVal(weeklyReport.weeklyExpense)}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4', fontStyle: 'italic' }}>
          💡 {weeklyReport.advice}
        </p>
      </div>
      </div>

      {/* Notification Center Portal Modal */}
      <NotificationCenter
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  greeting: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  username: {
    fontSize: '22px',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    marginTop: '2px',
  },
  avatarCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarInitial: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-display)',
  },
  quoteBanner: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '14px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
  },
  quoteText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    lineHeight: '1.4',
  },
  balanceHero: {
    background: 'radial-gradient(circle at 10% 20%, var(--bg-card) 0%, var(--bg-card-hover) 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    borderColor: 'var(--border-focus)',
  },
  balanceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  availableBadge: {
    backgroundColor: 'var(--bg-input)',
    padding: '4px 8px',
    borderRadius: '8px',
    fontSize: '10px',
    textTransform: 'none',
    letterSpacing: '0',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: '32px',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    letterSpacing: '-1px',
    color: 'var(--text-primary)',
  },
  inOutGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
  },
  inOutItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  inOutIconCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inOutLabel: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  inOutValIncome: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--color-success)',
    fontFamily: 'var(--font-display)',
  },
  inOutValExpense: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
  },
  savingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    borderTop: '1px dotted var(--border-color)',
    paddingTop: '10px',
    color: 'var(--text-secondary)',
  },
  savingsLabel: {
    fontWeight: '500',
  },
  savingsVal: {
    fontWeight: '700',
    color: 'var(--color-success)',
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    width: '100%',
    marginBottom: '2px',
  },
  actionBtn: {
    border: '1px solid transparent',
    borderRadius: '14px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.1s ease',
  },
  budgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  budgetValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
  },
  budgetFooter: {
    marginTop: '6px',
  },
  chartLayout: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  chartLegendGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: '500',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  legendLabel: {
    color: 'var(--text-secondary)',
    flex: 1,
  },
  legendValue: {
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  sectionTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '0 2px',
  },
  sectionTitleLink: {
    fontSize: '12px',
    color: 'var(--color-primary)',
    fontWeight: '600',
    cursor: 'pointer',
  },
  deleteTxBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    minWidth: '40px',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    opacity: 0.8,
    transition: 'all 0.15s ease',
  },
};
export default HomeView;
