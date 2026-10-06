import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DynamicIcon } from '../../components/DynamicIcon';
import { Debt, PaymentMethod } from '../../models/types';
import { FinancialEngine } from '../../services/FinancialEngine';
import { StatsService } from '../../services/StatsService';
import { Modal } from '../../components/Modal';
import { TransferReceiptModal, TransferReceiptData } from '../../components/TransferReceiptModal';
import { AccountPickerModal } from './AccountPickerModal';

export const DebtsSection: React.FC = () => {
  const {
    debts,
    transactions,
    profile,
    addDebt,
    updateDebt,
    deleteDebt,
    addTransaction,
    cards,
    budgets,
    goals
  } = useApp();

  const activeCards = cards.filter(c => c.isActive);
  const summary = StatsService.getSummary(transactions, budgets, cards, undefined, debts, goals);

  // Modals state
  const [showAddDebt, setShowAddDebt] = useState<boolean>(false);
  const [debtPerson, setDebtPerson] = useState<string>('');
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [debtType, setDebtType] = useState<'lent' | 'borrowed'>('borrowed');
  const [debtDueDate, setDebtDueDate] = useState<string>('');
  const [debtNotes, setDebtNotes] = useState<string>('');
  const [debtLinkedCardId, setDebtLinkedCardId] = useState<string>('');

  // Abonar Debt Modal State
  const [abonarDebtTarget, setAbonarDebtTarget] = useState<Debt | null>(null);
  const [abonarAmount, setAbonarAmount] = useState<string>('');
  const [abonarError, setAbonarError] = useState<string | null>(null);
  const [abonarMethod, setAbonarMethod] = useState<PaymentMethod>('cash');
  const [abonarCardId, setAbonarCardId] = useState<string>('');
  const [receiptData, setReceiptData] = useState<TransferReceiptData | null>(null);

  // Account Picker state for Full Pay, Collect, and Lent debt creation
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);
  const [accountPickerTitle, setAccountPickerTitle] = useState<string>('');
  const [accountPickerCallback, setAccountPickerCallback] = useState<((acc: string, cardId?: string, method?: PaymentMethod) => void) | null>(null);

  const promptAccountSelection = (title: string, callback: (acc: string, cardId?: string, method?: PaymentMethod) => void) => {
    setAccountPickerTitle(title);
    setAccountPickerCallback(() => callback);
    setShowAccountPicker(true);
  };

  // Browser back navigation integration
  useEffect(() => {
    if (showAddDebt) {
      if (window.history.state?.modal !== 'debt') {
        window.history.pushState({ modal: 'debt', tab: 'budget' }, '', '');
      }
    }
  }, [showAddDebt]);

  useEffect(() => {
    const handlePopState = () => {
      if (showAddDebt) {
        setDebtPerson('');
        setDebtAmount('');
        setDebtDueDate('');
        setDebtNotes('');
        setDebtLinkedCardId('');
        setShowAddDebt(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showAddDebt]);

  const handleCloseDebtModal = () => {
    setDebtPerson('');
    setDebtAmount('');
    setDebtDueDate('');
    setDebtNotes('');
    setDebtLinkedCardId('');
    setShowAddDebt(false);
    if (window.history.state?.modal === 'debt') {
      window.history.back();
    }
  };

  const handleCreateDebt = () => {
    const total = parseFloat(debtAmount);
    if (isNaN(total) || total <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    if (!debtPerson.trim()) {
      alert('Por favor, ingresa el nombre de la persona o institución.');
      return;
    }

    if (debtType === 'borrowed') {
      addDebt({
        personOrInstitution: debtPerson.trim(),
        amount: total,
        remainingAmount: total,
        type: debtType,
        dueDate: debtDueDate || undefined,
        notes: debtNotes.trim() || undefined,
        linkedCardId: debtLinkedCardId || undefined
      });
      handleCloseDebtModal();
    } else {
      promptAccountSelection(`Cuenta para registrar la salida de dinero`, (account, cardId, paymentMethod) => {
        addDebt({
          personOrInstitution: debtPerson.trim(),
          amount: total,
          remainingAmount: total,
          type: debtType,
          dueDate: debtDueDate || undefined,
          notes: debtNotes.trim() || undefined
        });

        const now = new Date();
        addTransaction({
          amount: total,
          type: 'expense',
          categoryId: 'cat_loan',
          paymentMethod: paymentMethod || (cardId ? 'card' : 'cash'),
          account,
          cardId,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0].slice(0, 5),
          notes: `Préstamo realizado a: ${debtPerson.trim()}`,
          color: 'var(--color-danger)',
          icon: 'TrendingDown'
        });

        handleCloseDebtModal();
      });
    }
  };

  const handleAbonarDebt = (debt: Debt) => {
    setAbonarDebtTarget(debt);
    setAbonarAmount('');
    setAbonarError(null);
    setAbonarMethod('cash');
    setAbonarCardId(activeCards[0]?.id || '');
  };

  const handleConfirmAbonar = () => {
    if (!abonarDebtTarget) return;
    const amount = parseFloat(abonarAmount);
    if (isNaN(amount) || amount <= 0) {
      setAbonarError('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }
    if (amount > abonarDebtTarget.remainingAmount) {
      setAbonarError(`El monto no puede exceder el restante (${profile.currency} ${abonarDebtTarget.remainingAmount.toLocaleString()}).`);
      return;
    }

    const availableCash = FinancialEngine.getAvailableLiquidCash(transactions, cards);
    const sourceCard = abonarMethod === 'card' ? cards.find(c => c.id === abonarCardId) : undefined;
    const currentSourceFunds = sourceCard ? (sourceCard.currentBalance ?? 0) : availableCash;

    if (amount > currentSourceFunds) {
      const sourceLabel = sourceCard ? sourceCard.name : 'Efectivo';
      setAbonarError(`Saldo insuficiente en ${sourceLabel}. Tienes ${profile.currency} ${currentSourceFunds.toLocaleString()} disponible.`);
      return;
    }

    const { newRemaining, isFullyPaid, linkedCardId } = FinancialEngine.calculateDebtPaymentImpact(abonarDebtTarget, amount);
    if (isFullyPaid) {
      deleteDebt(abonarDebtTarget.id);
    } else {
      updateDebt({
        ...abonarDebtTarget,
        remainingAmount: newRemaining
      });
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
    const isLinkedCard = !!linkedCardId;
    const targetCard = isLinkedCard ? cards.find(c => c.id === linkedCardId) : undefined;

    addTransaction({
      amount,
      type: isLinkedCard ? 'payment' : (abonarDebtTarget.type === 'borrowed' ? 'expense' : 'income'),
      destinationCardId: isLinkedCard ? linkedCardId : undefined,
      categoryId: abonarDebtTarget.type === 'borrowed' ? 'cat_bills' : 'cat_extra',
      paymentMethod: abonarMethod,
      account: sourceCard ? sourceCard.name : 'Efectivo',
      cardId: sourceCard ? sourceCard.id : undefined,
      date: dateStr,
      time: timeStr,
      notes: `${abonarDebtTarget.type === 'borrowed' ? 'Abono a deuda' : 'Cobro de préstamo'}: ${abonarDebtTarget.personOrInstitution}`,
      color: abonarDebtTarget.type === 'borrowed' ? 'var(--color-danger)' : 'var(--color-success)',
      icon: abonarDebtTarget.type === 'borrowed' ? 'TrendingDown' : 'Coins'
    });

    const targetDebt = abonarDebtTarget;
    setAbonarDebtTarget(null);

    setReceiptData({
      referenceId: `ABN-${Date.now().toString().slice(-6)}`,
      amount,
      currency: profile.currency,
      sourceName: sourceCard ? `${sourceCard.name} (${sourceCard.bank})` : 'Efectivo disponible',
      destinationName: targetCard ? `${targetCard.name} (Cupo liberado)` : targetDebt.personOrInstitution,
      date: dateStr,
      time: timeStr,
      title: isFullyPaid ? '¡Deuda Totalmente Saldada!' : '¡Abono Registrado con Éxito!',
      subtitle: isFullyPaid ? 'Pasivo Cancelado' : `Restante: ${profile.currency} ${newRemaining.toLocaleString()}`,
      notes: `Abono a ${targetDebt.personOrInstitution}`,
      availableRestored: isLinkedCard ? amount : undefined
    });
  };

  const handleDeleteDebt = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de deuda?')) {
      deleteDebt(id);
    }
  };

  const handlePayDebtInFull = (debt: Debt) => {
    const confirmPay = confirm(`¿Estás seguro de que deseas liquidar esta deuda de ${profile.currency}${debt.remainingAmount.toLocaleString()}?`);
    if (!confirmPay) return;

    promptAccountSelection(`¿Con qué medio deseas pagar?`, (account, cardId, paymentMethod) => {
      const now = new Date();
      const isLinkedCard = !!debt.linkedCardId;
      addTransaction({
        amount: debt.remainingAmount,
        type: isLinkedCard ? 'payment' : 'expense',
        destinationCardId: isLinkedCard ? debt.linkedCardId : undefined,
        categoryId: 'cat_extra',
        paymentMethod: paymentMethod || (cardId ? 'card' : 'cash'),
        account,
        cardId,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `Liquidación de deuda con ${debt.personOrInstitution}`,
        color: '#ef4444',
        icon: 'ArrowUpRight'
      });

      deleteDebt(debt.id);
      setReceiptData({
        referenceId: `LIQ-${Date.now().toString().slice(-6)}`,
        amount: debt.remainingAmount,
        currency: profile.currency,
        sourceName: cardId ? (cards.find(c => c.id === cardId)?.name || account) : 'Efectivo disponible',
        destinationName: isLinkedCard ? (cards.find(c => c.id === debt.linkedCardId)?.name || 'Tarjeta vinculada') : debt.personOrInstitution,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        title: '¡Deuda Totalmente Liquidada!',
        subtitle: 'Pasivo Eliminado',
        notes: `Liquidación total con ${debt.personOrInstitution}`,
        availableRestored: isLinkedCard ? debt.remainingAmount : undefined
      });
    });
  };

  const handleCollectDebtInFull = (debt: Debt) => {
    const confirmCollect = confirm(`¿Estás seguro de que deseas marcar como cobrado este préstamo de ${profile.currency}${debt.remainingAmount.toLocaleString()}?`);
    if (!confirmCollect) return;

    promptAccountSelection(`¿En qué cuenta recibiste el pago?`, (account) => {
      const now = new Date();
      addTransaction({
        amount: debt.remainingAmount,
        type: 'income',
        categoryId: 'cat_sal',
        account,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: `Retorno de préstamo de ${debt.personOrInstitution}`,
        color: '#22c55e',
        icon: 'ArrowDownLeft'
      });

      deleteDebt(debt.id);
      setReceiptData({
        referenceId: `COB-${Date.now().toString().slice(-6)}`,
        amount: debt.remainingAmount,
        currency: profile.currency,
        sourceName: debt.personOrInstitution,
        destinationName: account,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        title: '¡Préstamo Cobrado con Éxito!',
        subtitle: 'Monto Reincorporado a Fondos',
        notes: `Cobro de préstamo de ${debt.personOrInstitution}`
      });
    });
  };

  return (
    <div style={styles.listContainer}>
      <button className="btn btn-secondary" onClick={() => setShowAddDebt(true)} style={styles.addBtn}>
        <DynamicIcon name="Plus" size={16} />
        <span>Registrar Deuda / Préstamo</span>
      </button>

      {debts.length > 0 ? (
        <div style={styles.grid}>
          {debts.map(d => {
            const paid = d.amount - d.remainingAmount;
            const percent = Math.min(100, (paid / d.amount) * 100);
            const isCompleted = d.remainingAmount <= 0;
            const isBorrowed = d.type === 'borrowed';

            return (
              <div key={d.id} className="card" style={styles.planCard}>
                <div style={styles.planHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      ...styles.iconCircle, 
                      backgroundColor: isBorrowed ? 'var(--color-danger-light)' : 'var(--color-success-light)'
                    }}>
                      <DynamicIcon 
                        name={isBorrowed ? 'ArrowUpRight' : 'ArrowDownLeft'} 
                        size={18} 
                        color={isBorrowed ? 'var(--color-danger)' : 'var(--color-success)'} 
                      />
                    </div>
                    <div>
                      <h3 style={styles.planTitle}>{d.personOrInstitution}</h3>
                      <span style={styles.timeRemaining}>
                        {isBorrowed ? 'Yo debo (Deuda)' : 'Me deben (Préstamo)'}
                        {d.dueDate && ` • Límite: ${d.dueDate}`}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDebt(d.id)} style={styles.deleteBtn} title="Eliminar registro">
                    <DynamicIcon name="Trash2" size={16} color="var(--text-muted)" />
                  </button>
                </div>

                <div style={styles.progressRow}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Restante: {profile.currency}{d.remainingAmount.toLocaleString()} / {profile.currency}{d.amount.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: isCompleted ? 'var(--color-success)' : 'var(--text-primary)' }}>
                    {percent.toFixed(0)}%
                  </span>
                </div>

                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: isCompleted ? 'var(--color-success)' : isBorrowed ? 'var(--color-danger)' : 'var(--color-success)'
                    }}
                  />
                </div>

                {d.notes && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0 2px' }}>
                    Nota: {d.notes}
                  </div>
                )}

                <div style={{ ...styles.planFooterGoal, display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  {isCompleted ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🎉 {isBorrowed ? 'Liquidada' : 'Cobrado'}
                    </span>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleAbonarDebt(d)}
                        style={{ ...styles.contributeBtn, padding: '4px 8px', fontSize: '11px', height: '28px' }}
                      >
                        Abonar
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => isBorrowed ? handlePayDebtInFull(d) : handleCollectDebtInFull(d)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          height: '28px',
                          backgroundColor: isBorrowed ? 'var(--color-danger)' : 'var(--color-success)',
                          borderColor: isBorrowed ? 'var(--color-danger)' : 'var(--color-success)',
                          color: 'white'
                        }}
                      >
                        {isBorrowed ? 'Pagar' : 'Cobrar'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state card">
          <DynamicIcon name="Coins" size={32} className="empty-state-icon" />
          <p>No tienes deudas ni préstamos activos registrados.</p>
          <p className="empty-state-quote">"El que paga lo que debe, sana su paz mental."</p>
        </div>
      )}

      {/* --- ADD DEBT MODAL SHEET --- */}
      {showAddDebt && (
        <div className="modal-overlay open" onClick={handleCloseDebtModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Deuda / Préstamo</h2>
              <button className="btn-ghost" onClick={handleCloseDebtModal} aria-label="Cerrar" title="Cerrar">
                <DynamicIcon name="X" size={20} color="var(--text-primary)" />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Tipo de Registro</label>
              <div style={styles.segmentControl}>
                <button
                  type="button"
                  onClick={() => setDebtType('borrowed')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: debtType === 'borrowed' ? 'var(--bg-phone)' : 'transparent',
                    color: debtType === 'borrowed' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: debtType === 'borrowed' ? '700' : '500',
                  }}
                >
                  Yo Debo (Deuda)
                </button>
                <button
                  type="button"
                  onClick={() => setDebtType('lent')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: debtType === 'lent' ? 'var(--bg-phone)' : 'transparent',
                    color: debtType === 'lent' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: debtType === 'lent' ? '700' : '500',
                  }}
                >
                  Me Deben (Préstamo)
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Persona / Institución</label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez, Préstamo de Auto, Hipoteca"
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', marginTop: '-8px' }}>
              {['💳 Tarjeta de Crédito', '🏢 Entidad Financiera', '👥 Préstamo Familiar', '🤝 Amigo'].map(sug => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setDebtPerson(sug.substring(3))}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {sug}
                </button>
              ))}
            </div>

            {debtType === 'borrowed' && (
              <div className="input-group">
                <label className="input-label">Vincular a Tarjeta de Crédito (Opcional)</label>
                <select
                  value={debtLinkedCardId}
                  onChange={(e) => setDebtLinkedCardId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Ninguna (Deuda Externa / Persona)</option>
                  {cards.filter(c => c.type === 'credit' && c.isActive).map(c => (
                    <option key={c.id} value={c.id}>
                      💳 {c.name} ({c.bank}) - Cupo usado: {profile.currency}{(c.balanceUsed || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Al abonar o liquidar esta deuda, se liberará automáticamente el cupo de la tarjeta vinculada sin generar duplicados.
                </span>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Monto Total</label>
              <input
                type="number"
                placeholder="Ej. 5000"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Fecha Límite (Opcional)</label>
              <input
                type="date"
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Notas</label>
              <input
                type="text"
                placeholder="Detalles adicionales"
                value={debtNotes}
                onChange={(e) => setDebtNotes(e.target.value)}
                className="input-field"
              />
            </div>

            <button className="btn btn-primary" onClick={handleCreateDebt} style={{ marginTop: '10px' }}>
              Registrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Abonar a Deuda */}
      {abonarDebtTarget && (
        <Modal
          isOpen={!!abonarDebtTarget}
          onClose={() => setAbonarDebtTarget(null)}
          title={`Abonar a ${abonarDebtTarget.personOrInstitution}`}
          maxWidth="400px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monto Pendiente:</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: abonarDebtTarget.type === 'borrowed' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {profile.currency} {abonarDebtTarget.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="input-group">
              <label className="input-label">Medio de Pago</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`btn ${abonarMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => {
                    setAbonarMethod('cash');
                    setAbonarError(null);
                  }}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  className={`btn ${abonarMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px', fontSize: '12px' }}
                  onClick={() => {
                    setAbonarMethod('card');
                    if (!abonarCardId && activeCards.length > 0) {
                      setAbonarCardId(activeCards[0].id);
                    }
                    setAbonarError(null);
                  }}
                >
                  💳 Tarjeta
                </button>
              </div>

              {abonarMethod === 'card' && (
                <select
                  value={abonarCardId}
                  onChange={(e) => {
                    setAbonarCardId(e.target.value);
                    setAbonarError(null);
                  }}
                  className="input-field"
                  style={{ marginTop: '4px' }}
                >
                  {activeCards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.bank}) — {c.type === 'credit' ? `Cupo: ${c.currency}${(c.creditLimit! - (c.balanceUsed || 0)).toLocaleString()}` : `Saldo: ${c.currency}${(c.currentBalance || 0).toLocaleString()}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Monto a Abonar ({profile.currency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={abonarAmount}
                onChange={(e) => {
                  setAbonarAmount(e.target.value);
                  setAbonarError(null);
                }}
                className="input-field"
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {[0.25, 0.5, 1.0].map(ratio => {
                  const part = Math.round(abonarDebtTarget.remainingAmount * ratio);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '4px', fontSize: '11px' }}
                      onClick={() => setAbonarAmount(part.toString())}
                    >
                      {ratio === 1 ? 'Total (100%)' : `${ratio * 100}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            {abonarError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <DynamicIcon name="AlertTriangle" size={14} color="#ef4444" />
                <span>{abonarError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAbonarDebtTarget(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmAbonar}
                style={{ flex: 1 }}
              >
                Confirmar Abono
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Account Picker for Lent Creation and Full Payment */}
      <AccountPickerModal
        isOpen={showAccountPicker}
        title={accountPickerTitle}
        onClose={() => {
          setShowAccountPicker(false);
          setAccountPickerCallback(null);
        }}
        onSelect={(acc, cardId, method) => {
          if (accountPickerCallback) {
            accountPickerCallback(acc, cardId, method);
          }
        }}
        activeCards={activeCards}
        cashBalance={summary.cashBalance}
        currency={profile.currency}
      />

      {/* Digital Receipt Modal */}
      <TransferReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
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
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  planCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  planHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '4px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planFooterGoal: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '8px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRemaining: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  contributeBtn: {
    width: 'auto',
    padding: '6px 12px',
    fontSize: '11px',
    borderRadius: '8px',
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
