import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatsService } from '../services/StatsService';
import { PdfReportService } from '../services/PdfReportService';
import { IncomeExpenseBarChart, CashFlowLineChart } from '../components/FinancialCharts';
import { DynamicIcon } from '../components/DynamicIcon';

export const StatsView: React.FC = () => {
  const { transactions, budgets, profile, stealthMode, setStealthMode, goals, debts, categories } = useApp();

  const [activeTab, setActiveTab] = useState<'rule' | 'comparison' | 'flow'>('rule');

  // Calculations (Month level)
  const chartData = StatsService.getExpenseByCategory(transactions);
  const monthlyComparisons = StatsService.getIncomeVsExpenseMonthly(transactions);
  const averages = StatsService.getAverages(transactions);
  const cashFlowTrend = StatsService.getCashFlowTrends(transactions);
  const insights = StatsService.getFinancialInsights(transactions, budgets, profile.currency);

  // 50/30/20 Rule Calculator
  const getBudgetRuleBreakdown = () => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    let needs = 0;
    let wants = 0;
    let savings = 0;

    transactions.forEach(t => {
      if (t.type === 'expense') {
        const catId = t.categoryId;
        if (catId === 'cat_saving' || catId === 'cat_inv') {
          savings += t.amount;
        } else if (
          catId === 'cat_food_super' || 
          catId === 'cat_services' || 
          catId === 'cat_rent' || 
          catId === 'cat_transport'
        ) {
          needs += t.amount;
        } else {
          wants += t.amount;
        }
      }
    });

    const totalSpent = needs + wants + savings;
    const needsPct = totalSpent > 0 ? (needs / totalSpent) * 100 : 0;
    const wantsPct = totalSpent > 0 ? (wants / totalSpent) * 100 : 0;
    const savingsPct = totalSpent > 0 ? (savings / totalSpent) * 100 : 0;

    let score = 100;
    let status = 'Distribución Excelente';
    let recommendation = '¡Felicidades! Estás siguiendo la regla de oro del presupuesto casi a la perfección.';

    if (needsPct > 55) {
      score -= (needsPct - 50) * 1.5;
      status = 'Necesidades Elevadas';
      recommendation = 'Tus gastos fijos y necesidades superan el 50%. Intenta revisar contratos de servicios o buscar formas de abaratar tu costo de vida mensual.';
    }
    if (wantsPct > 35) {
      score -= (wantsPct - 30) * 2;
      status = 'Exceso en Deseos';
      recommendation = 'Estás destinando más del 30% a entretenimiento y extras. Intenta recortar salidas a comer o compras no esenciales.';
    }
    if (savingsPct < 15) {
      score -= (20 - savingsPct) * 2.5;
      if (status === 'Distribución Excelente') status = 'Ahorro Insuficiente';
      recommendation = 'Tu tasa de ahorro/inversión está por debajo del 20% recomendado. Intenta pagarte a ti mismo primero al recibir tus ingresos.';
    }

    score = Math.max(10, Math.min(100, Math.round(score)));

    return {
      needs,
      wants,
      savings,
      needsPct,
      wantsPct,
      savingsPct,
      totalSpent,
      totalIncome,
      score,
      status,
      recommendation
    };
  };

  const rule = getBudgetRuleBreakdown();

  const getPrevMonthYM = () => {
    const now = new Date();
    let m = now.getMonth() - 1;
    let y = now.getFullYear();
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  };

  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const [reportPeriod, setReportPeriod] = useState<string>(getPrevMonthYM());
  const [reportEmission, setReportEmission] = useState<string>(getCurrentDateTimeLocal());

  const handleDownloadPdf = () => {
    try {
      const doc = PdfReportService.generateMonthlyReport(
        transactions,
        budgets,
        goals,
        debts,
        categories,
        profile,
        stealthMode,
        reportPeriod,
        reportEmission
      );
      doc.save(`FinanList_Reporte_${reportPeriod}.pdf`);
      alert('Reporte PDF de salud financiera descargado con éxito.');
    } catch (err) {
      console.error(err);
      alert('Hubo un error al generar el reporte en PDF.');
    }
  };

  const formatVal = (val: number) => {
    if (stealthMode) return `${profile.currency} ••••`;
    return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };


  // Filter out any income categories for top expense listing
  const topExpenses = chartData.slice(0, 5);

  return (
    <div className="view-content animate-fade-in">
      <div style={styles.header}>
        <h2>Estadísticas</h2>
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
      </div>


      {/* Segment switcher */}
      <div style={styles.segmentControl}>
        <button
          onClick={() => setActiveTab('rule')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'rule' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'rule' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'rule' ? '700' : '500',
            boxShadow: activeTab === 'rule' ? '0 2px 8px rgba(0, 0, 0, 0.04)' : 'none',
          }}
        >
          <DynamicIcon name="Sliders" size={14} />
          <span style={{ marginLeft: '4px' }}>Fórmula 50/30/20</span>
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'comparison' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'comparison' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'comparison' ? '700' : '500',
            boxShadow: activeTab === 'comparison' ? '0 2px 8px rgba(0, 0, 0, 0.04)' : 'none',
          }}
        >
          <DynamicIcon name="BarChart2" size={14} />
          <span style={{ marginLeft: '4px' }}>Comparación</span>
        </button>
        <button
          onClick={() => setActiveTab('flow')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'flow' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'flow' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'flow' ? '700' : '500',
            boxShadow: activeTab === 'flow' ? '0 2px 8px rgba(0, 0, 0, 0.04)' : 'none',
          }}
        >
          <DynamicIcon name="TrendingUp" size={14} />
          <span style={{ marginLeft: '4px' }}>Tendencias</span>
        </button>
      </div>

      {/* --- CHART CONTAINERS --- */}
      <div className="card" style={styles.chartCard}>
        {activeTab === 'rule' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={styles.chartTitle}>Fórmula de Presupuesto 50/30/20</h4>
            <p style={{ ...styles.chartSubtitle, marginTop: '-6px' }}>
              Evalúa cómo distribuyes tus gastos frente al estándar ideal de finanzas personales.
            </p>

            {/* Stacked Progress Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', width: '100%', height: '24px', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                {rule.needsPct > 0 && (
                  <div style={{ width: `${rule.needsPct}%`, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold' }} title={`Necesidades: ${rule.needsPct.toFixed(1)}%`}>
                    {rule.needsPct >= 10 ? `${rule.needsPct.toFixed(0)}%` : ''}
                  </div>
                )}
                {rule.wantsPct > 0 && (
                  <div style={{ width: `${rule.wantsPct}%`, backgroundColor: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold' }} title={`Deseos: ${rule.wantsPct.toFixed(1)}%`}>
                    {rule.wantsPct >= 10 ? `${rule.wantsPct.toFixed(0)}%` : ''}
                  </div>
                )}
                {rule.savingsPct > 0 && (
                  <div style={{ width: `${rule.savingsPct}%`, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold' }} title={`Ahorros: ${rule.savingsPct.toFixed(1)}%`}>
                    {rule.savingsPct >= 10 ? `${rule.savingsPct.toFixed(0)}%` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', padding: '0 4px' }}>
                <span>Necesidades (Ideal 50%)</span>
                <span>Deseos (Ideal 30%)</span>
                <span>Ahorros/Inversión (Ideal 20%)</span>
              </div>
            </div>

            {/* List breakdown of values */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'var(--bg-phone)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Necesidades</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Súper, Servicios, Transporte, Renta</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{formatVal(rule.needs)}</div>
                  <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '700' }}>{rule.needsPct.toFixed(0)}% de tus gastos</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'var(--bg-phone)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Deseos</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Restaurantes, Ocio, Compras y Extras</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{formatVal(rule.wants)}</div>
                  <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>{rule.wantsPct.toFixed(0)}% de tus gastos</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'var(--bg-phone)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Ahorro e Inversión</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Metas de Ahorro y Aportes a Portafolio</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{formatVal(rule.savings)}</div>
                  <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>{rule.savingsPct.toFixed(0)}% de tus gastos</div>
                </div>
              </div>
            </div>

            {/* Score & Recommendation Card */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--border-color)', marginTop: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'white', border: '2px solid var(--color-primary)', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Score</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'var(--font-display)', marginTop: '-2px' }}>{rule.score}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{rule.status}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0', lineHeight: '1.4' }}>{rule.recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="animate-fade-in">
            <h4 style={styles.chartTitle}>Ingresos vs Gastos Anuales</h4>
            <div style={styles.barLegends}>
              <div style={styles.barLegendItem}>
                <span style={{ ...styles.barLegendDot, backgroundColor: 'var(--color-success)' }} />
                <span>Ingreso</span>
              </div>
              <div style={styles.barLegendItem}>
                <span style={{ ...styles.barLegendDot, backgroundColor: 'var(--color-primary)' }} />
                <span>Gasto</span>
              </div>
            </div>
            <IncomeExpenseBarChart data={monthlyComparisons} currency={profile.currency} />
          </div>
        )}

        {activeTab === 'flow' && (
          <div className="animate-fade-in">
            <h4 style={styles.chartTitle}>Flujo de Caja Mensual y Proyección</h4>
            <p style={styles.chartSubtitle}>
              Línea continua: saldo real diario. Línea punteada: proyección final basada en gasto actual.
            </p>
            <CashFlowLineChart data={cashFlowTrend} currency={profile.currency} stealthMode={stealthMode} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '14px', flexWrap: 'wrap' }}>
              <div style={styles.barLegendItem}>
                <span style={{ width: '16px', height: '3px', backgroundColor: 'var(--color-primary)', display: 'inline-block', borderRadius: '2px', marginRight: '6px' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Saldo Real</span>
              </div>
              <div style={styles.barLegendItem}>
                <span style={{ width: '16px', height: '3px', borderTop: '3px dashed var(--text-muted)', display: 'inline-block', marginRight: '6px' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Proyección Fin de Mes</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- FINANLIST INSIGHTS CARD --- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--color-primary)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DynamicIcon name="Sparkles" size={16} color="var(--color-primary)" />
          <span style={{ fontWeight: '800' }}>FinanList Insights (Consejos)</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {insights.map(item => {
            const isWarning = item.type === 'warning';
            const isSuccess = item.type === 'success';
            const itemBgColor = isWarning 
              ? 'rgba(239, 68, 68, 0.05)' 
              : isSuccess 
                ? 'rgba(16, 185, 129, 0.05)' 
                : 'rgba(99, 102, 241, 0.05)';
            const itemBorderColor = isWarning 
              ? 'rgba(239, 68, 68, 0.15)' 
              : isSuccess 
                ? 'rgba(16, 185, 129, 0.15)' 
                : 'rgba(99, 102, 241, 0.15)';
            const iconColor = isWarning 
              ? 'var(--color-danger)' 
              : isSuccess 
                ? 'var(--color-success)' 
                : 'var(--color-primary)';
            const iconName = isWarning 
              ? 'AlertTriangle' 
              : isSuccess 
                ? 'CheckCircle' 
                : 'Info';

            return (
              <div 
                key={item.id} 
                style={{ 
                  padding: '10px 14px', 
                  borderRadius: '12px', 
                  backgroundColor: itemBgColor,
                  border: `1px solid ${itemBorderColor}`,
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'transform 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                  <DynamicIcon name={iconName} size={14} color={iconColor} />
                  <span style={{ color: isWarning ? 'var(--color-danger)' : isSuccess ? 'var(--color-success)' : 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '11px', lineHeight: '1.4' }}>{item.message}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- PROMEDIOS CARD --- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="card-title">
          <span>Promedios de Gasto Diario</span>
          <DynamicIcon name="LineChart" size={16} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%' }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '12px 8px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--bg-phone)', 
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <DynamicIcon name="Calendar" size={12} color="var(--color-primary)" />
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Diario</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{formatVal(averages.daily)}</span>
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '12px 8px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--bg-phone)', 
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <DynamicIcon name="TrendingUp" size={12} color="var(--color-success)" />
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Semanal</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{formatVal(averages.weekly)}</span>
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '12px 8px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--bg-phone)', 
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              <DynamicIcon name="FileText" size={12} color="#06b6d4" />
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Mensual</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{formatVal(averages.monthly)}</span>
          </div>
        </div>
      </div>

      {/* --- TOP CATEGORIES PROGRESS LIST --- */}
      <div>
        <h3 style={{ marginBottom: '12px' }}>Categorías Más Utilizadas</h3>
        {topExpenses.length > 0 ? (
          <div className="card" style={styles.topExpensesList}>
            {topExpenses.map(item => (
              <div key={item.categoryId} style={styles.progressItem}>
                <div style={styles.progressHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...styles.catIconIconCircle, backgroundColor: item.color }}>
                      <DynamicIcon name={item.icon} size={14} color="white" />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>{formatVal(item.amount)}</span>
                </div>
                
                {/* Progress fill bar */}
                <div className="progress-bar-container" style={{ height: '6px' }}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
                <div style={styles.progressFooter}>
                  <span>Representa el {item.percentage}% del gasto total</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <DynamicIcon name="TrendingUp" size={32} className="empty-state-icon" />
            <p>Aún no hay transacciones para analizar.</p>
            <p className="empty-state-quote">"El dinero se multiplica cuando se administra con sabiduría."</p>
          </div>
        )}
      </div>

      {/* --- STANDALONE PDF REPORT CARD --- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
          <div style={{ 
            width: '44px', 
            height: '44px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--color-primary-light)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <DynamicIcon name="FileText" size={22} color="var(--color-primary)" />
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Reporte mensual de presupuesto
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', maxWidth: '320px', margin: '0 auto' }}>
            Consulta y descarga el informe detallado en PDF para cualquier mes, con balance de ingresos, gastos, desglose de presupuestos y KPIs financieros.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '300px', marginTop: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Mes a Analizar</label>
            <input 
              type="month" 
              value={reportPeriod} 
              onChange={(e) => setReportPeriod(e.target.value)} 
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '13px',
                width: '100%',
                boxSizing: 'border-box'
              }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Fecha y Hora de Emisión</label>
            <input 
              type="datetime-local" 
              value={reportEmission} 
              onChange={(e) => setReportEmission(e.target.value)} 
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '13px',
                width: '100%',
                boxSizing: 'border-box'
              }} 
            />
          </div>
        </div>

        <button 
          onClick={handleDownloadPdf}
          className="btn btn-primary"
          style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px', width: '100%', maxWidth: '300px' }}
        >
          <DynamicIcon name="Download" size={16} />
          <span>Generar y Descargar PDF</span>
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentControl: {
    display: 'flex',
    backgroundColor: 'var(--bg-input)',
    padding: '4px',
    borderRadius: '12px',
    gap: '4px',
  },
  segmentBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  chartCard: {
    padding: '16px',
    backgroundColor: 'var(--bg-card)',
  },
  distributionLayout: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  chartTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textAlign: 'center',
    marginBottom: '8px',
  },
  chartSubtitle: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    marginBottom: '12px',
  },
  barLegends: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  barLegendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  barLegendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '2px',
  },
  averagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    textAlign: 'center',
    padding: '4px 0',
  },
  averageItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '4px',
  },
  averageLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  averageValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
  },
  topExpensesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  progressItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catIconIconCircle: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFooter: {
    fontSize: '10px',
    color: 'var(--text-secondary)',
    textAlign: 'right',
  },
};
export default StatsView;
