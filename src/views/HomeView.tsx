import React from 'react';
import { useApp } from '../context/AppContext';
import { StatsService } from '../services/StatsService';
import { DonutChart } from '../components/DonutChart';
import { DynamicIcon } from '../components/DynamicIcon';
import { Transaction, Budget } from '../models/types';

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
  const { transactions, budgets, profile, deleteTransaction, addTransaction, categories, setActiveTab, stealthMode, setStealthMode } = useApp();
  const [showMonthlyReport, setShowMonthlyReport] = React.useState<boolean>(true);

  // Get daily/weekly random quote based on day
  const quoteIdx = new Date().getDate() % FINANCE_QUOTES.length;
  const quoteOfTheDay = FINANCE_QUOTES[quoteIdx];

  const summary = StatsService.getSummary(transactions, budgets);
  const chartData = StatsService.getExpenseByCategory(transactions);
  
  // Format Currency Helper (with Stealth support)
  const formatVal = (val: number) => {
    if (stealthMode) return `${profile.currency} ••••`;
    return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Get cash and card balances
  const getAccountBalances = () => {
    let cash = 0;
    let card = 0;
    transactions.forEach(tx => {
      const amt = tx.amount;
      const isExpense = tx.type === 'expense';
      const acc = tx.account ? tx.account.trim().toLowerCase() : '';
      if (acc.includes('efectivo')) {
        if (isExpense) cash -= amt;
        else cash += amt;
      } else if (acc.includes('tarjeta')) {
        if (isExpense) card -= amt;
        else card += amt;
      }
    });
    return { cash, card };
  };

  const { cash: cashBalance, card: cardBalance } = getAccountBalances();

  const formatAccountVal = (val: number) => {
    if (stealthMode) return '••••';
    return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const getPreviousMonthReport = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYM = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthName = prevMonth.toLocaleString('es-ES', { month: 'long' });
    
    const prevTxs = transactions.filter(t => t.date.substring(0, 7) === prevYM);
    if (prevTxs.length === 0) return null;
    
    const prevExpense = prevTxs.filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving').reduce((sum, t) => sum + t.amount, 0);
    
    // Find previous month's global monthly budget
    const prevMonthBudgets = budgets.filter(b => b.type === 'monthly' && b.startDate.substring(0, 7) === prevYM);
    const totalBudgetLimit = prevMonthBudgets.reduce((sum, b) => sum + b.amount, 0);
    
    if (totalBudgetLimit === 0) return null;
    
    const leftover = Math.max(0, totalBudgetLimit - prevExpense);
    
    return {
      monthName: prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1),
      budgetLimit: totalBudgetLimit,
      spent: prevExpense,
      leftover
    };
  };

  const weeklyReport = getWeeklyReport();
  const prevMonthReport = getPreviousMonthReport();

  // Calculate category usage frequencies from transactions history
  const getUsageFrequency = (categoryId: string) => {
    return transactions.filter(tx => tx.categoryId === categoryId).length;
  };

  // Get active budgets that have a category or fallback to all main categories
  const activeCategoryBudgets = budgets.filter(b => b.categoryId);
  const rawPills = activeCategoryBudgets.length > 0 
    ? activeCategoryBudgets.map(b => {
        const cat = categories.find(c => c.id === b.categoryId);
        return {
          id: b.id,
          name: b.name || cat?.name || 'Gasto',
          categoryId: b.categoryId || 'cat_extra',
          color: cat?.color || 'var(--color-primary)',
          icon: cat?.icon || 'Tag',
          budget: b
        };
      })
    : categories
        .filter(c => !c.parentId && !['cat_sal', 'cat_inv', 'cat_extra'].includes(c.id))
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          categoryId: cat.id,
          color: cat.color,
          icon: cat.icon,
          budget: undefined
        }));

  // Sort quick pills by usage frequency (highest transaction count first)
  const quickPills = [...rawPills].sort((a, b) => {
    const freqA = getUsageFrequency(a.categoryId);
    const freqB = getUsageFrequency(b.categoryId);
    return freqB - freqA; // descending order
  });

  const handleQuickHomeExpense = (categoryId: string, name: string, budget?: Budget) => {
    const amountStr = prompt(`Registrar gasto rápido para "${name}"\n¿Cuánto gastaste?`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    let note = prompt('Nota o concepto (Opcional):', '') || '';

    // If budget has contingency fund
    if (budget && budget.contingencyAmount && budget.contingencyAmount > 0) {
      const isContingency = confirm('¿Este gasto es un imprevisto / emergencia?');
      if (isContingency) {
        note = note.trim() ? `${note.trim()} #contingency` : 'Imprevisto / Emergencia #contingency';
      }
    }

    const accountOption = prompt(`¿Con qué cuenta pagaste?\nEscribe: Efectivo, Tarjeta o Banco`, 'Efectivo');
    if (accountOption === null) return;
    const account = accountOption.trim() || 'Efectivo';

    const now = new Date();
    const catObj = categories.find(c => c.id === categoryId);

    addTransaction({
      amount,
      type: 'expense',
      categoryId,
      account,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0].slice(0, 5),
      notes: note.trim() || `Gasto en ${name}`,
      color: catObj?.color || 'var(--color-primary)',
      icon: catObj?.icon || 'Coins'
    });

    alert('Gasto registrado con éxito.');
  };

  // Recent transactions (Limit to 4)
  const recentTransactions = transactions.slice(0, 4);

  const handleDeleteTx = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering edit sheet
    if (confirm('¿Estás seguro de que deseas eliminar este movimiento?')) {
      deleteTransaction(id);
    }
  };

  return (
    <div className="view-content animate-fade-in">
      {/* Header Profile Info with Brand Title and Sub-greeting */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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


      {/* Motivational Quote banner */}
      <div style={styles.quoteBanner}>
        <DynamicIcon name="Sparkles" size={16} color="var(--color-primary)" />
        <span style={{ ...styles.quoteText, flex: 1, minWidth: 0 }}>{quoteOfTheDay}</span>
      </div>

      {/* Monthly Closure Report Card */}
      {prevMonthReport && showMonthlyReport && (
        <div className="card animate-fade-in" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          borderLeft: '4px solid var(--color-success)', 
          position: 'relative',
          paddingRight: '36px',
          backgroundColor: 'rgba(34, 197, 94, 0.06)'
        }}>
          <button 
            onClick={() => setShowMonthlyReport(false)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13px', color: 'var(--color-success)' }}>
            <DynamicIcon name="Award" size={16} />
            <span>Cierre Mensual de {prevMonthReport.monthName}</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>
            Tu presupuesto finalizó con Límite de <b>{formatVal(prevMonthReport.budgetLimit)}</b> y Gasto de <b>{formatVal(prevMonthReport.spent)}</b>.
          </p>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
            🎉 El sobrante final de <b>{formatVal(prevMonthReport.leftover)}</b> quedó guardado en tu saldo total.
          </div>
        </div>
      )}

      {/* Hero Balance Card */}
      <div className="card" style={styles.balanceHero}>
        <div style={styles.balanceHeader}>
          <span>Saldo Total</span>
        </div>
        <h1 style={styles.balanceValue}>{formatVal(summary.totalBalance)}</h1>

        {/* Dinero en Efectivo y Tarjeta debajo del saldo total */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '-10px', marginBottom: '2px' }}>
          <span style={styles.availableBadge}>💵 Efectivo: {formatAccountVal(cashBalance)}</span>
          <span style={styles.availableBadge}>💳 Tarjeta: {formatAccountVal(cardBalance)}</span>
        </div>

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
          <span style={styles.savingsLabel}>Ahorro estimado este mes:</span>
          <span style={styles.savingsVal}>{formatVal(summary.monthlySavings)}</span>
        </div>
      </div>

      {/* Quick Access Buttons */}
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

      {/* Quick Pills Widget */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', marginBottom: '8px', width: '100%' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Gasto Rápido Diario
        </span>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px', 
          width: '100%'
        }}>
          {quickPills.map(pill => (
            <button
              key={pill.id}
              onClick={() => handleQuickHomeExpense(pill.categoryId, pill.name, pill.budget)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: '100%',
                boxSizing: 'border-box',
                textAlign: 'left',
                justifyContent: 'flex-start',
                overflow: 'hidden'
              }}
              className="pin-btn"
            >
              <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: pill.color,
                color: 'white',
                flexShrink: 0
              }}>
                <DynamicIcon name={pill.icon} size={11} color="white" />
              </span>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: '600', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                flex: 1
              }}>
                {pill.name}
              </span>
            </button>
          ))}
        </div>
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
      {chartData.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card-title">
            <span>Distribución de Gastos</span>
            <DynamicIcon name="PieChart" size={16} />
          </div>
          <div style={styles.chartLayout}>
            <DonutChart data={chartData} total={summary.monthlyExpense} currency={profile.currency} />
            <div style={styles.chartLegendGrid}>
              {chartData.slice(0, 3).map((item) => (
                <div key={item.categoryId} style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: item.color }} />
                  <span style={styles.legendLabel}>{item.name}</span>
                  <span style={styles.legendValue}>{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Recent Movements Section */}
      <div>
        <div style={styles.sectionTitleRow}>
          <h3>Movimientos Recientes</h3>
          <span style={styles.sectionTitleLink}>Ver todos</span>
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
                    {tx.categoryId.replace('cat_', '').replace(/^\w/, c => c.toUpperCase())}
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
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '10px',
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
    gap: '16px',
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
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    width: '100%',
  },
  actionBtn: {
    flex: '1 1 130px',
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
    padding: '6px',
    opacity: 0.7,
    transition: 'opacity 0.1s ease',
  },
};
export default HomeView;
