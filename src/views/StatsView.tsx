import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatsService } from '../services/StatsService';
import { PdfReportService } from '../services/PdfReportService';
import { DonutChart } from '../components/DonutChart';
import { IncomeExpenseBarChart, CashFlowLineChart } from '../components/FinancialCharts';
import { DynamicIcon } from '../components/DynamicIcon';

export const StatsView: React.FC = () => {
  const { transactions, budgets, profile, stealthMode, setStealthMode, goals, debts, categories } = useApp();

  const [activeTab, setActiveTab] = useState<'distribution' | 'comparison' | 'flow' | 'report'>('distribution');

  // Calculations (Month level)
  const summary = StatsService.getSummary(transactions, budgets);
  const chartData = StatsService.getExpenseByCategory(transactions);
  const monthlyComparisons = StatsService.getIncomeVsExpenseMonthly(transactions);
  const averages = StatsService.getAverages(transactions);
  const cashFlowTrend = StatsService.getCashFlowTrends(transactions);
  const insights = StatsService.getFinancialInsights(transactions, budgets, profile.currency);

  const handleDownloadPdf = () => {
    try {
      const now = new Date();
      let prevM = now.getMonth() - 1;
      let prevY = now.getFullYear();
      if (prevM < 0) {
        prevM = 11;
        prevY -= 1;
      }
      const prevYM = `${prevY}-${String(prevM + 1).padStart(2, '0')}`;
      const doc = PdfReportService.generateMonthlyReport(
        transactions,
        budgets,
        goals,
        debts,
        categories,
        profile,
        stealthMode
      );
      doc.save(`FinanList_Reporte_${prevYM}.pdf`);
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


  const totalExpense = summary.monthlyExpense;

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
          onClick={() => setActiveTab('distribution')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'distribution' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'distribution' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'distribution' ? '700' : '500',
          }}
        >
          Distribución
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'comparison' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'comparison' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'comparison' ? '700' : '500',
          }}
        >
          Comparación
        </button>
        <button
          onClick={() => setActiveTab('flow')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'flow' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'flow' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'flow' ? '700' : '500',
          }}
        >
          Tendencias
        </button>
        <button
          onClick={() => setActiveTab('report')}
          style={{
            ...styles.segmentBtn,
            backgroundColor: activeTab === 'report' ? 'var(--bg-phone)' : 'transparent',
            color: activeTab === 'report' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'report' ? '700' : '500',
          }}
        >
          Reporte PDF
        </button>
      </div>

      {/* --- CHART CONTAINERS --- */}
      <div className="card" style={styles.chartCard}>
        {activeTab === 'distribution' && (
          <div className="animate-fade-in" style={styles.distributionLayout}>
            <DonutChart data={chartData} total={totalExpense} currency={profile.currency} />
            {chartData.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Registra un gasto este mes para ver la distribución.
              </p>
            )}
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
          {insights.map(item => (
            <div 
              key={item.id} 
              style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                <DynamicIcon 
                  name={item.type === 'warning' ? 'AlertTriangle' : item.type === 'success' ? 'CheckCircle' : 'Info'} 
                  size={14} 
                  color={item.type === 'warning' ? 'var(--color-danger)' : item.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)'} 
                />
                <span style={{ color: item.type === 'warning' ? 'var(--color-danger)' : item.type === 'success' ? 'var(--color-success)' : 'var(--text-primary)' }}>
                  {item.title}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', margin: '0', fontSize: '11px', lineHeight: '1.4' }}>{item.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* --- PROMEDIOS CARD --- */}
      <div className="card">
        <div className="card-title">
          <span>Promedios de Gasto Diario</span>
          <DynamicIcon name="LineChart" size={16} />
        </div>
        <div style={styles.averagesGrid}>
          <div style={styles.averageItem}>
            <span style={styles.averageLabel}>Diario</span>
            <span style={styles.averageValue}>{formatVal(averages.daily)}</span>
          </div>
          <div style={{ ...styles.averageItem, borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
            <span style={styles.averageLabel}>Semanal</span>
            <span style={styles.averageValue}>{formatVal(averages.weekly)}</span>
          </div>
          <div style={styles.averageItem}>
            <span style={styles.averageLabel}>Mensual</span>
            <span style={styles.averageValue}>{formatVal(averages.monthly)}</span>
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

        {activeTab === 'report' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'center', margin: '10px 0' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--color-primary-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <DynamicIcon name="FileText" size={24} color="var(--color-primary)" />
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Reporte Mensual Inteligente
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', maxWidth: '300px', margin: '0 auto' }}>
                Genera un informe detallado en PDF con tus métricas de ahorro, KPIs de salud financiera, desglose de presupuestos y consejos personalizados del asesor.
              </p>
            </div>

            <button 
              onClick={handleDownloadPdf}
              className="btn btn-primary"
              style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}
            >
              <DynamicIcon name="Download" size={16} />
              <span>Generar y Descargar PDF</span>
            </button>
            
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)', 
              textAlign: 'center', 
              backgroundColor: 'var(--bg-input)', 
              padding: '10px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              marginTop: '10px'
            }}>
              💡 <b>Nota:</b> El informe analizará de forma automática los datos del <b>mes natural anterior</b> para cerrar el ciclo financiero.
            </div>
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
