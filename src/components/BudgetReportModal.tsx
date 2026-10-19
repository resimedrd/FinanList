import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StatsService } from '../services/StatsService';
import { DynamicIcon } from './DynamicIcon';
import { DonutChart } from './DonutChart';
import { roundCurrency } from '../utils/currencyUtils';

interface BudgetReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPreset?: 'thisMonth' | 'prevMonth' | 'last30' | 'custom';
}

export const BudgetReportModal: React.FC<BudgetReportModalProps> = ({ isOpen, onClose, initialPreset = 'prevMonth' }) => {
  const { transactions, budgets, categories, profile, stealthMode, debts, goals } = useApp();

  // Helper to get formatted local dates
  const formatDateISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getPresetRange = (preset: 'thisMonth' | 'prevMonth' | 'last30' | 'lastQuarter'): { start: string; end: string } => {
    const now = new Date();
    if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatDateISO(start), end: formatDateISO(now) };
    }
    if (preset === 'prevMonth') {
      const prevM = now.getMonth() - 1;
      const prevY = now.getFullYear();
      const start = new Date(prevY, prevM, 1);
      const end = new Date(prevY, prevM + 1, 0);
      return { start: formatDateISO(start), end: formatDateISO(end) };
    }
    if (preset === 'last30') {
      const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { start: formatDateISO(start), end: formatDateISO(now) };
    }
    // lastQuarter (90 days)
    const start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
    return { start: formatDateISO(start), end: formatDateISO(now) };
  };

  const [activePreset, setActivePreset] = useState<'thisMonth' | 'prevMonth' | 'last30' | 'lastQuarter' | 'custom'>(initialPreset);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => getPresetRange(initialPreset === 'custom' ? 'prevMonth' : initialPreset));
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const applyPreset = (preset: 'thisMonth' | 'prevMonth' | 'last30' | 'lastQuarter' | 'custom') => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      setDateRange(getPresetRange(preset));
    }
  };

  // Filter transactions strictly by selected range
  const filteredTxs = useMemo(() => {
    const { start, end } = dateRange;
    return transactions.filter(t => t.date && t.date >= start && t.date <= end);
  }, [transactions, dateRange]);

  // Aggregate metrics
  const totalIncome = useMemo(() => {
    return filteredTxs
      .filter(t => t.type === 'income' && !(t.account || '').toLowerCase().includes('inversiones'))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTxs]);

  const totalExpense = useMemo(() => {
    return filteredTxs
      .filter(t => t.type === 'expense' && t.categoryId !== 'cat_saving' && !(t.account || '').toLowerCase().includes('inversiones'))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTxs]);

  const totalSavings = useMemo(() => {
    return filteredTxs
      .filter(t => (t.type === 'expense' || t.type === 'transfer') && (t.categoryId === 'cat_saving' || t.notes?.includes('#goal:')))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTxs]);

  const netCashFlow = totalIncome - (totalExpense + totalSavings);
  const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

  // Chart data with real user category names resolved
  const chartData = useMemo(() => {
    return StatsService.getExpenseByCategory(filteredTxs, categories);
  }, [filteredTxs, categories]);

  // Prorated Budget calculation for visual progress bar
  const budgetSummary = useMemo(() => {
    let totalLimit = 0;
    budgets.forEach(b => {
      const bStart = b.startDate || dateRange.start;
      const bEnd = b.endDate || dateRange.end;
      const overlapStart = bStart > dateRange.start ? bStart : dateRange.start;
      const overlapEnd = bEnd < dateRange.end ? bEnd : dateRange.end;

      if (overlapStart <= overlapEnd) {
        const bDays = Math.max(1, Math.round((new Date(bEnd).getTime() - new Date(bStart).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const oDays = Math.max(1, Math.round((new Date(overlapEnd).getTime() - new Date(overlapStart).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        totalLimit += roundCurrency(b.amount * (oDays / bDays));
      }
    });

    const executionPct = totalLimit > 0 ? Math.min(150, Math.round((totalExpense / totalLimit) * 100)) : 0;
    return {
      limit: totalLimit,
      spent: totalExpense,
      executionPct,
      hasBudgets: totalLimit > 0
    };
  }, [budgets, dateRange, totalExpense]);

  const handleDownloadPdf = async () => {
    if (filteredTxs.length === 0) {
      alert('No se encontraron transacciones en el rango de fechas seleccionado.');
      return;
    }

    try {
      setIsGenerating(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(15);
      }

      const { PdfReportService } = await import('../services/PdfReportService');
      const doc = PdfReportService.generateCustomRangeReport({
        transactions,
        budgets,
        goals,
        debts,
        categories,
        profile,
        stealthMode,
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      doc.save(`FinanList_Reporte_${dateRange.start}_a_${dateRange.end}.pdf`);
      onClose();
    } catch (err: any) {
      console.error('Error al generar el reporte PDF:', err);
      alert('Hubo un error al generar el PDF: ' + (err?.message || err));
    } finally {
      setIsGenerating(false);
    }
  };

  const formatVal = (val: number) => {
    if (stealthMode) return `${profile.currency} ••••`;
    return `${profile.currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-sheet animate-slide-up" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px'
        }}
      >
        {/* Handle bar */}
        <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 12px auto' }} />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <DynamicIcon name="FileText" size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Reporte de Presupuesto
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Rango personalizado & Diagnóstico Financiero
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }} title="Cerrar">
            <DynamicIcon name="X" size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '2px' }}>
          
          {/* Quick Presets Carousel */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
              Periodo a Analizar
            </label>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: 'thisMonth', label: 'Este Mes' },
                { id: 'prevMonth', label: 'Mes Anterior' },
                { id: 'last30', label: 'Últimos 30 días' },
                { id: 'lastQuarter', label: 'Últimos 3 meses' },
                { id: 'custom', label: 'Personalizado' },
              ].map(p => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id as any)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: isSelected ? '700' : '500',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Pickers: Desde y Hasta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label" style={{ fontSize: '10px' }}>Desde (Inicio)</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange(prev => ({ ...prev, start: e.target.value }));
                  setActivePreset('custom');
                }}
                className="input-field"
                style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '10px' }}
              />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label" style={{ fontSize: '10px' }}>Hasta (Fin)</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange(prev => ({ ...prev, end: e.target.value }));
                  setActivePreset('custom');
                }}
                className="input-field"
                style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '10px' }}
              />
            </div>
          </div>

          {/* Real-time KPI Preview Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="card" style={{ padding: '10px 12px', borderLeft: '4px solid var(--color-success)', margin: 0 }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Ingresos</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-success)', marginTop: '2px' }}>
                {formatVal(totalIncome)}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 12px', borderLeft: '4px solid var(--text-primary)', margin: 0 }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Gastos Operativos</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatVal(totalExpense)}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 12px', borderLeft: `4px solid ${netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}`, margin: 0 }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Flujo de Caja Neto</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)', marginTop: '2px' }}>
                {netCashFlow >= 0 ? '+' : ''}{formatVal(netCashFlow)}
              </div>
            </div>
            <div className="card" style={{ padding: '10px 12px', borderLeft: '4px solid var(--color-primary)', margin: 0 }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Tasa de Ahorro</span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{savingsRate}%</span>
                <span style={{
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  backgroundColor: savingsRate >= 20 ? 'rgba(34, 197, 94, 0.15)' : savingsRate >= 10 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: savingsRate >= 20 ? 'var(--color-success)' : savingsRate >= 10 ? 'var(--color-warning)' : 'var(--color-danger)'
                }}>
                  {savingsRate >= 20 ? 'Óptimo' : savingsRate >= 10 ? 'Estable' : 'Bajo'}
                </span>
              </div>
            </div>
          </div>

          {/* Budget Execution Progress Bar (if active budgets exist) */}
          {budgetSummary.hasBudgets && (
            <div className="card" style={{ padding: '12px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Ejecución de Presupuestos</span>
                <span style={{ fontWeight: '800', color: budgetSummary.executionPct > 100 ? 'var(--color-danger)' : budgetSummary.executionPct > 85 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {budgetSummary.executionPct}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, budgetSummary.executionPct)}%`,
                  height: '100%',
                  backgroundColor: budgetSummary.executionPct > 100 ? 'var(--color-danger)' : budgetSummary.executionPct > 85 ? 'var(--color-warning)' : 'var(--color-success)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                <span>Gastado: {formatVal(budgetSummary.spent)}</span>
                <span>Límite: {formatVal(budgetSummary.limit)}</span>
              </div>
            </div>
          )}

          {/* Real-time Category Expense Distribution Chart */}
          <div className="card" style={{ padding: '14px', margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Distribución de Gastos en el Rango
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {filteredTxs.length} movimientos
              </span>
            </div>
            {chartData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <DonutChart data={chartData} total={totalExpense} currency={profile.currency} stealthMode={stealthMode} />
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {chartData.slice(0, 4).map(item => (
                    <div key={item.categoryId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontWeight: '700' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.percentage}%</span>
                        <span style={{ color: 'var(--text-primary)' }}>{formatVal(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                No hay gastos registrados en este intervalo de fechas.
              </div>
            )}
          </div>
        </div>

        {/* Action Button: Download PDF */}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isGenerating || filteredTxs.length === 0}
          className="btn btn-primary"
          style={{
            marginTop: '14px',
            padding: '13px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: isGenerating || filteredTxs.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isGenerating || filteredTxs.length === 0 ? 0.6 : 1
          }}
        >
          {isGenerating ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span>Compilando informe vectorial...</span>
            </>
          ) : (
            <>
              <DynamicIcon name="Download" size={17} />
              <span>Descargar Reporte PDF Profesional</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
