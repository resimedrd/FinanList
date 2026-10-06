import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DynamicIcon } from '../../components/DynamicIcon';
import { PaymentMethod } from '../../models/types';
import { FinancialEngine } from '../../services/FinancialEngine';
import { StatsService } from '../../services/StatsService';

export const InvestmentsSection: React.FC = () => {
  const {
    transactions,
    profile,
    addTransaction,
    stealthMode,
    cards,
    budgets,
    debts,
    goals
  } = useApp();

  const activeCards = cards.filter(c => c.isActive);
  const summary = StatsService.getSummary(transactions, budgets, cards, undefined, debts, goals);

  // Investment Registration Modal State
  const [showAddInvestmentMove, setShowAddInvestmentMove] = useState<boolean>(false);
  const [invMoveType, setInvMoveType] = useState<'deposit' | 'yield' | 'withdrawal'>('deposit');
  const [invAmount, setInvAmount] = useState<string>('');
  const [invSourceMethod, setInvSourceMethod] = useState<PaymentMethod>('cash');
  const [invCardId, setInvCardId] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Calculate investments portfolio metrics
  const getInvestmentMetrics = () => {
    let currentVal = 0;

    transactions.forEach(tx => {
      const acc = tx.account ? tx.account.trim().toLowerCase() : '';
      if (acc.includes('broker') || acc.includes('inversiones')) {
        const amt = tx.amount;
        if (tx.type === 'income') {
          currentVal += amt;
        } else {
          currentVal -= amt;
        }
      }
    });

    const capitalAportado = transactions
      .filter(tx => tx.type === 'expense' && 
                    tx.categoryId === 'cat_inv' && 
                    !(tx.account ? tx.account.trim().toLowerCase() : '').includes('broker') &&
                    !(tx.account ? tx.account.trim().toLowerCase() : '').includes('inversiones'))
      .reduce((sum, tx) => sum + tx.amount, 0);

    const yieldNeto = currentVal - capitalAportado;
    const yieldPct = capitalAportado > 0 ? (yieldNeto / capitalAportado) * 100 : 0;

    return { currentVal, capitalAportado, yieldNeto, yieldPct };
  };
  const { currentVal: invCurrentVal, capitalAportado: invCapitalAportado, yieldNeto: invYieldNeto, yieldPct: invYieldPct } = getInvestmentMetrics();

  // Get all investment-related transactions
  const investmentTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const acc = tx.account ? tx.account.trim().toLowerCase() : '';
      const isInvAcc = acc.includes('broker') || acc.includes('inversiones');
      const isInvCat = tx.categoryId === 'cat_inv';
      return isInvAcc || isInvCat;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [transactions]);

  // Real-time investment allocation validation
  const invAmountNum = parseFloat(invAmount) || 0;
  const invSelectedCard = invSourceMethod === 'card'
    ? (activeCards.find(c => c.id === invCardId) || activeCards[0])
    : undefined;
  const invValidation = invMoveType === 'deposit'
    ? FinancialEngine.validateInvestmentAllocation(
        invAmountNum,
        invSourceMethod,
        invSelectedCard,
        summary,
        activeCards
      )
    : { isValid: true };

  // Browser back navigation integration
  useEffect(() => {
    if (showAddInvestmentMove) {
      if (window.history.state?.modal !== 'investment') {
        window.history.pushState({ modal: 'investment', tab: 'budget' }, '', '');
      }
    }
  }, [showAddInvestmentMove]);

  useEffect(() => {
    const handlePopState = () => {
      if (showAddInvestmentMove) {
        setInvAmount('');
        setInvNotes('');
        setInvMoveType('deposit');
        setInvSourceMethod('cash');
        setInvCardId('');
        setShowAddInvestmentMove(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showAddInvestmentMove]);

  const handleCloseInvestmentModal = () => {
    setInvAmount('');
    setInvNotes('');
    setInvMoveType('deposit');
    setInvDate(new Date().toISOString().split('T')[0]);
    setShowAddInvestmentMove(false);
    if (window.history.state?.modal === 'investment') {
      window.history.back();
    }
  };

  const handleSaveInvestmentMove = () => {
    const amt = parseFloat(invAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Por favor introduce un monto válido.');
      return;
    }

    if (invMoveType === 'deposit' && !invValidation.isValid) {
      alert(`${invValidation.errorTitle}: ${invValidation.errorMessage}`);
      return;
    }

    const baseNotes = invNotes.trim();
    const resolvedCardId = invSourceMethod === 'card' ? invSelectedCard?.id : undefined;
    const resolvedAccount = invSourceMethod === 'card' ? (invSelectedCard?.name || 'Tarjeta') : 'Efectivo';

    if (invMoveType === 'deposit') {
      // 1. Double entry: expense on liquid origin (cash or specific card)
      addTransaction({
        amount: amt,
        type: 'expense',
        categoryId: 'cat_inv',
        paymentMethod: invSourceMethod,
        account: resolvedAccount,
        cardId: resolvedCardId,
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes || 'Aportación a Inversiones',
        tags: ['inversion', 'aportacion'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });

      // 2. Income on Inversiones portfolio
      addTransaction({
        amount: amt,
        type: 'income',
        categoryId: 'cat_inv',
        account: 'Inversiones',
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes ? `[Aportación] ${baseNotes}` : 'Aportación Recibida',
        tags: ['inversion', 'portafolio'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });
    } else if (invMoveType === 'yield') {
      // Single entry: income on Inversiones account
      addTransaction({
        amount: amt,
        type: 'income',
        categoryId: 'cat_inv',
        account: 'Inversiones',
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes || 'Rendimiento de Inversiones',
        tags: ['inversion', 'rendimiento'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });
    } else if (invMoveType === 'withdrawal') {
      // Double entry: income on liquid destination, expense on Inversiones account
      addTransaction({
        amount: amt,
        type: 'income',
        categoryId: 'cat_inv',
        paymentMethod: invSourceMethod,
        account: resolvedAccount,
        cardId: resolvedCardId,
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes ? `[Retiro] ${baseNotes}` : 'Retiro de Inversiones',
        tags: ['inversion', 'retiro'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });

      addTransaction({
        amount: amt,
        type: 'expense',
        categoryId: 'cat_inv',
        account: 'Inversiones',
        date: invDate,
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        notes: baseNotes || 'Retiro de Inversiones',
        tags: ['inversion', 'portafolio'],
        favorite: false,
        color: '#8b5cf6',
        icon: 'TrendingUp'
      });
    }

    setInvAmount('');
    setInvNotes('');
    setInvMoveType('deposit');
    setInvSourceMethod('cash');
    setInvCardId('');
    setInvDate(new Date().toISOString().split('T')[0]);
    setShowAddInvestmentMove(false);
    if (window.history.state?.modal === 'investment') {
      window.history.back();
    }
  };

  return (
    <div style={styles.listContainer}>
      {/* Action button */}
      <button 
        className="btn btn-secondary" 
        onClick={() => setShowAddInvestmentMove(true)} 
        style={styles.addBtn}
      >
        <DynamicIcon name="Plus" size={16} />
        <span>Registrar Movimiento de Inversión</span>
      </button>

      {/* Investment KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Valor del Portafolio</span>
          <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
            {stealthMode ? '••••' : `${profile.currency}${invCurrentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </h2>
        </div>
        
        <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Capital Aportado</span>
          <h2 style={{ fontSize: '18px', fontWeight: '800', fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-primary)' }}>
            {stealthMode ? '••••' : `${profile.currency}${invCapitalAportado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </h2>
        </div>
      </div>

      {/* Yield Card */}
      <div className="card" style={{ 
        padding: '12px 16px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderLeft: '4px solid ' + (invYieldNeto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'),
        marginBottom: '16px'
      }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Rendimiento Neto</span>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '800', 
            fontFamily: 'var(--font-display)', 
            margin: '2px 0 0 0',
            color: invYieldNeto >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
          }}>
            {invYieldNeto >= 0 ? '+' : ''}{stealthMode ? '••••' : `${profile.currency}${invYieldNeto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </h3>
        </div>
        <div style={{ 
          backgroundColor: invYieldNeto >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          padding: '6px 12px',
          borderRadius: '8px',
          color: invYieldNeto >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
          fontWeight: '800',
          fontSize: '14px'
        }}>
          {invYieldNeto >= 0 ? '+' : ''}{invYieldPct.toFixed(1)}%
        </div>
      </div>

      {/* Investment Instructions Card */}
      <div className="card" style={{ 
        backgroundColor: 'var(--bg-input)', 
        border: '1px solid var(--border-color)', 
        padding: '12px', 
        borderRadius: '12px', 
        marginBottom: '16px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        lineHeight: '1.4'
      }}>
        <div style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <DynamicIcon name="Lightbulb" size={14} color="var(--color-primary)" />
          <span>¿Cómo funciona el registro de Inversiones?</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><b>Aportar Capital:</b> Registra un Gasto desde tu liquidez disponible (ej: Efectivo o Tarjeta) con categoría <i>Inversiones</i>. Esto reduce tu saldo líquido general.</li>
          <li><b>Registrar Ganancia/Rendimiento:</b> Registra un Ingreso con cuenta <i>Inversiones</i> y categoría <i>Inversiones</i>. Esto aumenta el valor de tu inversión sin afectar tu saldo líquido de Inicio.</li>
          <li><b>Retirar Fondos:</b> Registra un Ingreso en tu cuenta líquida (ej: Efectivo o Tarjeta) y un Gasto de igual monto en la cuenta <i>Inversiones</i>.</li>
        </ul>
      </div>

      {/* Investment Ledger */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
        Historial de Inversiones
      </h3>
      {investmentTransactions.length > 0 ? (
        <div className="tx-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {investmentTransactions.map((tx) => {
            const isInvAcc = (tx.account || '').trim().toLowerCase().includes('inversiones');
            const isIncome = tx.type === 'income';

            let typeLabel = '';
            if (isInvAcc && isIncome) typeLabel = 'Rendimiento';
            else if (isInvAcc && !isIncome) typeLabel = 'Retiro / Pérdida';
            else if (!isInvAcc && !isIncome) typeLabel = 'Aportación';
            else typeLabel = 'Movimiento';

            return (
              <div key={tx.id} className="card" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px', 
                    backgroundColor: isIncome ? 'rgba(34, 197, 94, 0.12)' : 'rgba(139, 92, 246, 0.12)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <DynamicIcon 
                      name={isIncome ? 'TrendingUp' : 'ArrowRight'} 
                      size={16} 
                      color={isIncome ? 'var(--color-success)' : 'var(--color-primary)'} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
                      {tx.notes || typeLabel}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {tx.account} • {tx.date}
                    </span>
                  </div>
                </div>
                <span style={{ 
                  fontWeight: '700', 
                  fontSize: '13px', 
                  color: isIncome ? 'var(--color-success)' : 'var(--text-primary)' 
                }}>
                  {isIncome ? '+' : '-'}{profile.currency}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}>
            <DynamicIcon name="TrendingUp" size={24} color="var(--text-muted)" />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
            Aún no has registrado movimientos de inversión.
          </p>
        </div>
      )}

      {/* --- ADD INVESTMENT MOVE MODAL SHEET --- */}
      {showAddInvestmentMove && (
        <div className="modal-overlay open" onClick={handleCloseInvestmentModal}>
          <div className="modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Movimiento</h2>
              <button className="modal-close" onClick={handleCloseInvestmentModal}>
                <DynamicIcon name="X" size={20} />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Tipo de Movimiento</label>
              <div style={styles.segmentControl}>
                <button
                  type="button"
                  onClick={() => setInvMoveType('deposit')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: invMoveType === 'deposit' ? 'var(--bg-phone)' : 'transparent',
                    color: invMoveType === 'deposit' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: invMoveType === 'deposit' ? '700' : '500',
                  }}
                >
                  Aportar Capital
                </button>
                <button
                  type="button"
                  onClick={() => setInvMoveType('yield')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: invMoveType === 'yield' ? 'var(--bg-phone)' : 'transparent',
                    color: invMoveType === 'yield' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: invMoveType === 'yield' ? '700' : '500',
                  }}
                >
                  Rendimiento
                </button>
                <button
                  type="button"
                  onClick={() => setInvMoveType('withdrawal')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: invMoveType === 'withdrawal' ? 'var(--bg-phone)' : 'transparent',
                    color: invMoveType === 'withdrawal' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: invMoveType === 'withdrawal' ? '700' : '500',
                  }}
                >
                  Retirar Fondos
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Monto ({profile.currency})</label>
              <input
                type="number"
                inputMode="decimal"
                className="input-field"
                placeholder="0.00"
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                autoFocus
              />
            </div>

            {invMoveType !== 'yield' && (
              <div className="input-group">
                <label className="input-label">
                  {invMoveType === 'deposit' ? 'Origen de Fondos (Se descuenta de aquí)' : 'Destino de Fondos (Se abona aquí)'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setInvSourceMethod('cash')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: invSourceMethod === 'cash' ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: invSourceMethod === 'cash' ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: invSourceMethod === 'cash' ? 'var(--color-primary)' : 'var(--text-primary)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <DynamicIcon name="Banknote" size={16} color={invSourceMethod === 'cash' ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvSourceMethod('card')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: invSourceMethod === 'card' ? 'var(--color-primary)' : 'var(--border-color)',
                      backgroundColor: invSourceMethod === 'card' ? 'var(--color-primary-light)' : 'var(--bg-input)',
                      color: invSourceMethod === 'card' ? 'var(--color-primary)' : 'var(--text-primary)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <DynamicIcon name="CreditCard" size={16} color={invSourceMethod === 'card' ? 'var(--color-primary)' : 'var(--text-secondary)'} />
                    <span>Tarjeta</span>
                  </button>
                </div>
              </div>
            )}

            {invMoveType !== 'yield' && invSourceMethod === 'cash' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                marginBottom: '12px'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Efectivo Disponible:</span>
                <span style={{ fontWeight: '700', color: summary.cashBalance > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {profile.currency}{summary.cashBalance.toLocaleString()}
                </span>
              </div>
            )}

            {invMoveType !== 'yield' && invSourceMethod === 'card' && (
              <div className="input-group">
                <label className="input-label">Seleccionar Tarjeta</label>
                {activeCards.length === 0 ? (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '12px', fontSize: '12px' }}>
                    No tienes tarjetas activas registradas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                    {activeCards.map(c => {
                      const isSelected = invCardId === c.id || (!invCardId && c.id === activeCards[0].id);
                      const isCredit = c.type === 'credit';
                      const capacity = isCredit 
                        ? Math.max(0, (c.creditLimit || 0) - (c.balanceUsed || 0))
                        : ((c.currentBalance || 0) + (c.allowOverdraft ? (c.overdraftLimit || 0) : 0));

                      return (
                        <div
                          key={c.id}
                          onClick={() => setInvCardId(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                            backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--bg-card)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.color || 'var(--color-primary)' }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {c.name} {c.lastFourDigits ? `(••${c.lastFourDigits})` : ''}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {c.bank} • {c.type === 'credit' ? 'Crédito' : 'Débito'}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                              {profile.currency}{capacity.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {isCredit ? 'Cupo' : 'Saldo'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {invMoveType === 'deposit' && !invValidation.isValid && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontWeight: '700', fontSize: '12px' }}>
                  <DynamicIcon name="AlertTriangle" size={16} />
                  <span>{invValidation.errorTitle}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {invValidation.errorMessage}
                </div>

                {invValidation.suggestedCards && invValidation.suggestedCards.length > 0 && (
                  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tarjetas con capacidad suficiente:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {invValidation.suggestedCards.map(sug => (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => {
                            setInvSourceMethod('card');
                            setInvCardId(sug.id);
                          }}
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--color-primary)',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          👉 Usar {sug.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Fecha</label>
              <input
                type="date"
                className="input-field"
                value={invDate}
                onChange={(e) => setInvDate(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Notas / Concepto</label>
              <input
                type="text"
                className="input-field"
                placeholder={
                  invMoveType === 'deposit' ? 'Ej: Aportación a fondo indexado' :
                  invMoveType === 'yield' ? 'Ej: Interés mensual pagado' :
                  'Ej: Retiro por emergencia'
                }
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCloseInvestmentModal}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={invMoveType === 'deposit' && !invValidation.isValid}
                onClick={handleSaveInvestmentMove}
                style={{ 
                  flex: 1,
                  opacity: (invMoveType === 'deposit' && !invValidation.isValid) ? 0.5 : 1,
                  cursor: (invMoveType === 'deposit' && !invValidation.isValid) ? 'not-allowed' : 'pointer'
                }}
              >
                Registrar Movimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  addBtn: {
    padding: '10px',
    fontSize: '13px',
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
};
