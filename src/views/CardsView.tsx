import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PaymentCard, CardType } from '../models/types';
import { DynamicIcon } from '../components/DynamicIcon';
import { Modal } from '../components/Modal';
import { FinancialEngine } from '../services/FinancialEngine';
import { TransferReceiptModal, TransferReceiptData } from '../components/TransferReceiptModal';

interface CardsViewProps {
  onBack: () => void;
}

const CARD_THEMES = [
  { name: 'Índigo Real', color: '#4f46e5', gradient: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6366f1 100%)' },
  { name: 'Esmeralda', color: '#059669', gradient: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)' },
  { name: 'Púrpura Neón', color: '#7c3aed', gradient: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)' },
  { name: 'Oro / Ámbar', color: '#d97706', gradient: 'linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)' },
  { name: 'Rubí Carmesí', color: '#e11d48', gradient: 'linear-gradient(135deg, #9f1239 0%, #e11d48 50%, #f43f5e 100%)' },
  { name: 'Obsidiana', color: '#1e293b', gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' },
  { name: 'Océano Cyan', color: '#0891b2', gradient: 'linear-gradient(135deg, #155e75 0%, #0891b2 50%, #06b6d4 100%)' }
];

export const CardsView: React.FC<CardsViewProps> = ({ onBack }) => {
  const {
    cards,
    transactions,
    addCard,
    updateCard,
    deleteCard,
    toggleCardActive,
    recordCardPayment,
    profile,
    stealthMode
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'debit' | 'credit' | 'inactive'>('all');

  // Add / Edit Card Modal state
  const [showCardModal, setShowCardModal] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<PaymentCard | null>(null);

  const [formType, setFormType] = useState<CardType>('debit');
  const [formName, setFormName] = useState<string>('');
  const [formBank, setFormBank] = useState<string>('Banco BHD');
  const [formLastFour, setFormLastFour] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<string>(profile.currency || 'RD$');
  const [formColor, setFormColor] = useState<string>('#4f46e5');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Debit fields
  const [formDebitBalance, setFormDebitBalance] = useState<string>('0');
  const [formMinBalanceAlert, setFormMinBalanceAlert] = useState<string>('3000');
  const [formAllowOverdraft, setFormAllowOverdraft] = useState<boolean>(false);
  const [formOverdraftLimit, setFormOverdraftLimit] = useState<string>('0');

  // Credit fields
  const [formCreditLimit, setFormCreditLimit] = useState<string>('50000');
  const [formBalanceUsed, setFormBalanceUsed] = useState<string>('0');
  const [formAlertThreshold, setFormAlertThreshold] = useState<string>('80');
  const [formBillingCutoffDay, setFormBillingCutoffDay] = useState<string>('15');
  const [formPaymentDueDay, setFormPaymentDueDay] = useState<string>('5');

  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [payTargetCardId, setPayTargetCardId] = useState<string>('');
  const [paySourceCardId, setPaySourceCardId] = useState<string>(''); // empty for cash
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cardFormError, setCardFormError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<TransferReceiptData | null>(null);

  // Delete confirmation
  const [deletingCard, setDeletingCard] = useState<PaymentCard | null>(null);

  // Reset or initialize Add/Edit form
  const handleOpenAddCard = () => {
    setEditingCard(null);
    setFormType('debit');
    setFormName('');
    setFormBank('Banco BHD');
    setFormLastFour('');
    setFormCurrency(profile.currency || 'RD$');
    setFormColor('#059669');
    setFormIsActive(true);
    setFormDebitBalance('0');
    setFormMinBalanceAlert('3000');
    setFormAllowOverdraft(false);
    setFormOverdraftLimit('0');
    setFormCreditLimit('50000');
    setFormBalanceUsed('0');
    setFormAlertThreshold('80');
    setFormBillingCutoffDay('15');
    setFormPaymentDueDay('5');
    setShowCardModal(true);
  };

  const handleOpenEditCard = (card: PaymentCard) => {
    setEditingCard(card);
    setFormType(card.type);
    setFormName(card.name);
    setFormBank(card.bank);
    setFormLastFour(card.lastFourDigits || '');
    setFormCurrency(card.currency);
    setFormColor(card.color);
    setFormIsActive(card.isActive);
    setFormDebitBalance((card.currentBalance ?? card.initialBalance ?? 0).toString());
    setFormMinBalanceAlert(card.minBalanceAlert?.toString() || '');
    setFormAllowOverdraft(!!card.allowOverdraft);
    setFormOverdraftLimit(card.overdraftLimit?.toString() || '0');
    setFormCreditLimit(card.creditLimit?.toString() || '0');
    setFormBalanceUsed((card.balanceUsed ?? 0).toString());
    setFormAlertThreshold(card.alertThresholdPercent?.toString() || '80');
    setFormBillingCutoffDay(card.billingCutoffDay?.toString() || '15');
    setFormPaymentDueDay(card.paymentDueDay?.toString() || '5');
    setShowCardModal(true);
  };

  const handleSaveCard = () => {
    if (!formName.trim()) {
      setCardFormError('Por favor, ingresa un nombre o alias para la tarjeta.');
      return;
    }
    if (!formBank.trim()) {
      setCardFormError('Por favor, ingresa el banco emisor.');
      return;
    }
    setCardFormError(null);

    const cleanDigits = formLastFour.replace(/\D/g, '').slice(-4);

    if (formType === 'debit') {
      const balance = parseFloat(formDebitBalance) || 0;
      const minAlert = formMinBalanceAlert ? parseFloat(formMinBalanceAlert) : undefined;
      const overLimit = formAllowOverdraft ? (parseFloat(formOverdraftLimit) || 0) : 0;

      if (editingCard) {
        updateCard({
          ...editingCard,
          name: formName.trim(),
          bank: formBank.trim(),
          lastFourDigits: cleanDigits || undefined,
          currency: formCurrency,
          color: formColor,
          isActive: formIsActive,
          currentBalance: balance,
          minBalanceAlert: minAlert,
          allowOverdraft: formAllowOverdraft,
          overdraftLimit: overLimit,
          updatedAt: new Date().toISOString()
        });
      } else {
        addCard({
          name: formName.trim(),
          bank: formBank.trim(),
          type: 'debit',
          lastFourDigits: cleanDigits || undefined,
          currency: formCurrency,
          color: formColor,
          isActive: formIsActive,
          initialBalance: balance,
          currentBalance: balance,
          minBalanceAlert: minAlert,
          allowOverdraft: formAllowOverdraft,
          overdraftLimit: overLimit
        });
      }
    } else {
      const limit = parseFloat(formCreditLimit) || 0;
      const used = parseFloat(formBalanceUsed) || 0;
      const threshold = parseInt(formAlertThreshold, 10) || 80;
      const cutoff = parseInt(formBillingCutoffDay, 10) || 15;
      const due = parseInt(formPaymentDueDay, 10) || 5;

      if (editingCard) {
        updateCard({
          ...editingCard,
          name: formName.trim(),
          bank: formBank.trim(),
          lastFourDigits: cleanDigits || undefined,
          currency: formCurrency,
          color: formColor,
          isActive: formIsActive,
          creditLimit: limit,
          balanceUsed: used,
          alertThresholdPercent: threshold,
          billingCutoffDay: cutoff,
          paymentDueDay: due,
          updatedAt: new Date().toISOString()
        });
      } else {
        addCard({
          name: formName.trim(),
          bank: formBank.trim(),
          type: 'credit',
          lastFourDigits: cleanDigits || undefined,
          currency: formCurrency,
          color: formColor,
          isActive: formIsActive,
          creditLimit: limit,
          balanceUsed: used,
          alertThresholdPercent: threshold,
          billingCutoffDay: cutoff,
          paymentDueDay: due
        });
      }
    }

    setShowCardModal(false);
  };

  const handleOpenPaymentModal = (targetCard?: PaymentCard) => {
    const activeCreditCards = cards.filter(c => c.isActive && c.type === 'credit');
    if (activeCreditCards.length === 0) {
      setPaymentError('No tienes tarjetas de crédito activas registradas para realizar pagos.');
      setShowPaymentModal(true);
      return;
    }
    const target = targetCard && targetCard.type === 'credit' ? targetCard : activeCreditCards[0];
    setPayTargetCardId(target.id);
    setPaySourceCardId('');
    setPayAmount((target.balanceUsed ?? 0) > 0 ? (target.balanceUsed ?? 0).toString() : '');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
    setPaymentError(null);
    setShowPaymentModal(true);
  };

  const handleExecutePayment = () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Por favor, ingresa un monto válido a pagar.');
      return;
    }
    if (!payTargetCardId) {
      setPaymentError('Por favor, selecciona la tarjeta de crédito a pagar.');
      return;
    }

    const target = cards.find(c => c.id === payTargetCardId);
    if (!target) {
      setPaymentError('Tarjeta destino no encontrada.');
      return;
    }

    // Pre-flight check funds
    const availableCash = FinancialEngine.getAvailableLiquidCash(transactions, cards);
    const sourceCard = paySourceCardId ? cards.find(c => c.id === paySourceCardId) : null;
    const currentSourceFunds = sourceCard ? (sourceCard.currentBalance ?? 0) : availableCash;

    if (amount > currentSourceFunds) {
      const sourceLabel = sourceCard ? sourceCard.name : 'Efectivo';
      const diff = amount - currentSourceFunds;
      setPaymentError(`Saldo insuficiente en ${sourceLabel}. Tienes ${formatAmount(currentSourceFunds, sourceCard?.currency || profile.currency)} disponible (Faltan ${formatAmount(diff, profile.currency)}).`);
      return;
    }

    const now = new Date();
    const time = now.toTimeString().split(' ')[0].slice(0, 5);

    recordCardPayment({
      destinationCardId: payTargetCardId,
      sourceCardId: paySourceCardId || undefined,
      amount,
      date: payDate,
      time,
      notes: payNotes.trim() || undefined
    });

    setShowPaymentModal(false);
    setPaymentError(null);

    // Show high-fidelity digital voucher immediately
    setReceiptData({
      referenceId: `PAG-${Date.now().toString().slice(-6)}`,
      amount,
      currency: target.currency || profile.currency,
      sourceName: sourceCard ? `${sourceCard.name} (${sourceCard.bank})` : 'Efectivo disponible',
      destinationName: `${target.name} (${target.bank})`,
      date: payDate,
      time,
      title: '¡Pago a Tarjeta Registrado!',
      subtitle: 'Crédito Restaurado con Éxito',
      notes: payNotes.trim() || undefined,
      availableRestored: amount
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingCard) return;
    deleteCard(deletingCard.id);
    setDeletingCard(null);
  };

  // Filtered card list
  const filteredCards = cards.filter(c => {
    if (filterType === 'debit') return c.type === 'debit' && c.isActive;
    if (filterType === 'credit') return c.type === 'credit' && c.isActive;
    if (filterType === 'inactive') return !c.isActive;
    return true; // 'all'
  });

  // Calculate totals
  const totalDebitBalance = cards
    .filter(c => c.isActive && c.type === 'debit')
    .reduce((sum, c) => sum + (c.currentBalance ?? 0), 0);

  const totalCreditLimit = cards
    .filter(c => c.isActive && c.type === 'credit')
    .reduce((sum, c) => sum + (c.creditLimit ?? 0), 0);

  const totalCreditUsed = cards
    .filter(c => c.isActive && c.type === 'credit')
    .reduce((sum, c) => sum + (c.balanceUsed ?? 0), 0);

  const totalCreditAvailable = Math.max(0, totalCreditLimit - totalCreditUsed);

  const formatAmount = (val: number, cur = profile.currency) => {
    if (stealthMode) return `${cur} ••••`;
    return `${cur}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="view-screen animate-fade-in">
      {/* Top Header */}
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '8px'
              }}
              title="Volver"
            >
              <DynamicIcon name="ArrowLeft" size={22} />
            </button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Mis Tarjetas
              </h1>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {cards.filter(c => c.isActive).length} activas
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cards.some(c => c.isActive && c.type === 'credit') && (
              <button
                onClick={() => handleOpenPaymentModal()}
                className="btn btn-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  gap: '4px',
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  color: '#6366f1'
                }}
                title="Pagar Tarjeta de Crédito"
              >
                <DynamicIcon name="Sparkles" size={13} color="#6366f1" />
                <span>Pagar</span>
              </button>
            )}
            <button
              onClick={handleOpenAddCard}
              className="btn btn-primary"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                gap: '4px'
              }}
            >
              <DynamicIcon name="Plus" size={14} color="#ffffff" />
              <span>Añadir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Summary Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="card" style={{ padding: '12px', borderLeft: '4px solid #059669' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '11px', fontWeight: '700' }}>
              <DynamicIcon name="Wallet" size={14} />
              <span>Saldo Débito</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '4px', color: totalDebitBalance < 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {formatAmount(totalDebitBalance)}
            </div>
          </div>

          <div className="card" style={{ padding: '12px', borderLeft: '4px solid #4f46e5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6366f1', fontSize: '11px', fontWeight: '700' }}>
              <DynamicIcon name="CreditCard" size={14} />
              <span>Crédito Disponible</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', marginTop: '4px', color: 'var(--text-primary)' }}>
              {formatAmount(totalCreditAvailable)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Usado: {formatAmount(totalCreditUsed)}
            </div>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-card)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          gap: '4px'
        }}>
          {(['all', 'debit', 'credit', 'inactive'] as const).map(tabKey => {
            const labels: Record<string, string> = {
              all: 'Todas',
              debit: 'Débito',
              credit: 'Crédito',
              inactive: 'Inactivas'
            };
            const isSel = filterType === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setFilterType(tabKey)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '11px',
                  fontWeight: isSel ? '700' : '500',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isSel ? 'var(--color-primary)' : 'transparent',
                  color: isSel ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {labels[tabKey]}
              </button>
            );
          })}
        </div>

        {/* Cards List */}
        {filteredCards.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              <DynamicIcon name="CreditCard" size={24} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              No hay tarjetas en esta categoría
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, maxWidth: '280px' }}>
              Registra tus tarjetas de débito o crédito para llevar un control automático de saldos y recibir alertas oportunas.
            </p>
            <button onClick={handleOpenAddCard} className="btn btn-primary" style={{ marginTop: '8px', fontSize: '12px' }}>
              <DynamicIcon name="Plus" size={14} color="#ffffff" />
              <span>Registrar mi primera tarjeta</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredCards.map(card => {
              const isCredit = card.type === 'credit';
              const isDebit = card.type === 'debit';
              const cardTheme = CARD_THEMES.find(t => t.color === card.color) || CARD_THEMES[0];

              // Credit specific math
              const creditLimit = card.creditLimit || 0;
              const balanceUsed = card.balanceUsed || 0;
              const availableCredit = Math.max(0, creditLimit - balanceUsed);
              const usedPercent = creditLimit > 0 ? (balanceUsed / creditLimit) * 100 : 0;
              const isCreditOverLimit = balanceUsed > creditLimit;
              const isCreditNearThreshold = usedPercent >= (card.alertThresholdPercent || 80);
              const cutoffInfo = isCredit ? FinancialEngine.getDaysUntilCutoff(card.billingCutoffDay || 15) : null;
              const paymentDueInfo = isCredit ? FinancialEngine.getDaysUntilPaymentDue(card.paymentDueDay || 5) : null;

              // Debit specific math
              const debitBalance = card.currentBalance ?? 0;
              const isDebitNegative = debitBalance < 0;
              const isDebitLowBalance = !!card.minBalanceAlert && debitBalance <= card.minBalanceAlert && !isDebitNegative;
              const isOverdraftExceeded = card.allowOverdraft && isDebitNegative && Math.abs(debitBalance) > (card.overdraftLimit || 0);

              return (
                <div
                  key={card.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    opacity: card.isActive ? 1 : 0.65
                  }}
                >
                  {/* Visual Credit/Debit Card Surface */}
                  <div
                    style={{
                      background: cardTheme.gradient,
                      borderRadius: '20px',
                      padding: '20px',
                      color: '#ffffff',
                      boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: '190px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    {/* Background decorative circles */}
                    <div style={{
                      position: 'absolute',
                      right: '-30px',
                      top: '-30px',
                      width: '140px',
                      height: '140px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      pointerEvents: 'none'
                    }} />
                    <div style={{
                      position: 'absolute',
                      right: '30px',
                      bottom: '-50px',
                      width: '180px',
                      height: '180px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      pointerEvents: 'none'
                    }} />

                    {/* Card Top Row: Bank & Type Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.9 }}>
                          {card.bank}
                        </span>
                        <div style={{ fontSize: '11px', fontWeight: '500', opacity: 0.75 }}>
                          {card.name}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!card.isActive && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: '800',
                            backgroundColor: 'rgba(0, 0, 0, 0.45)',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            textTransform: 'uppercase'
                          }}>
                            PAUSADA
                          </span>
                        )}
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          backgroundColor: isCredit ? 'rgba(255, 255, 255, 0.22)' : 'rgba(16, 185, 129, 0.35)',
                          backdropFilter: 'blur(4px)',
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase'
                        }}>
                          {isCredit ? 'CRÉDITO' : 'DÉBITO'}
                        </span>
                      </div>
                    </div>

                    {/* Card Middle: Chip, Contactless Icon, and Card Number Mask */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0', position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Realistic EMV Chip */}
                        <div style={{
                          width: '34px',
                          height: '26px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
                          border: '1px solid rgba(0,0,0,0.2)',
                          boxShadow: 'inset 0 0 3px rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{ width: '20px', height: '14px', border: '1px solid rgba(0,0,0,0.3)', borderRadius: '3px' }} />
                        </div>
                        {/* Contactless waves */}
                        <DynamicIcon name="Wifi" size={16} color="rgba(255,255,255,0.7)" />
                      </div>

                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '15px',
                        letterSpacing: '2px',
                        fontWeight: '700',
                        opacity: 0.95
                      }}>
                        •••• •••• •••• {card.lastFourDigits || '••••'}
                      </span>
                    </div>

                    {/* Card Bottom: Balance & Key Info */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.5px' }}>
                            {isCredit ? 'Crédito Disponible' : 'Saldo Disponible'}
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '900',
                            letterSpacing: '0.5px',
                            color: isDebitNegative || isCreditOverLimit ? '#fca5a5' : '#ffffff'
                          }}>
                            {isCredit ? formatAmount(availableCredit, card.currency) : formatAmount(debitBalance, card.currency)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.75, letterSpacing: '0.5px' }}>
                            Titular
                          </span>
                          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                            {profile.name || 'TITULAR'}
                          </div>
                        </div>
                      </div>

                      {/* Credit Card Progress Bar */}
                      {isCredit && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', opacity: 0.85, marginBottom: '3px' }}>
                            <span>Usado: {formatAmount(balanceUsed, card.currency)}</span>
                            <span>Límite: {formatAmount(creditLimit, card.currency)} ({Math.round(usedPercent)}%)</span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '5px',
                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(100, usedPercent)}%`,
                              height: '100%',
                              backgroundColor: usedPercent >= 90 ? '#ef4444' : usedPercent >= 75 ? '#f59e0b' : '#10b981',
                              borderRadius: '3px',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Operational Status & Alert Badges */}
                  {(isCreditOverLimit || isCreditNearThreshold || isDebitNegative || isDebitLowBalance || isOverdraftExceeded) && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: isCreditOverLimit || isDebitNegative ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      border: `1px solid ${isCreditOverLimit || isDebitNegative ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      color: isCreditOverLimit || isDebitNegative ? 'var(--color-danger)' : 'var(--color-warning)'
                    }}>
                      <DynamicIcon name={isCreditOverLimit || isDebitNegative ? 'AlertTriangle' : 'Info'} size={14} />
                      <span>
                        {isCreditOverLimit
                          ? `Has sobrepasado tu límite en ${formatAmount(balanceUsed - creditLimit, card.currency)}`
                          : isCreditNearThreshold
                          ? `Has utilizado el ${Math.round(usedPercent)}% de tu límite (Umbral: ${card.alertThresholdPercent}%)`
                          : isOverdraftExceeded
                          ? `Sobregiro excedido. Límite permitido: ${formatAmount(card.overdraftLimit || 0, card.currency)}`
                          : isDebitNegative
                          ? 'Cuenta en sobregiro negativo'
                          : `Saldo por debajo del mínimo de alerta (${formatAmount(card.minBalanceAlert || 0, card.currency)})`
                        }
                      </span>
                    </div>
                  )}

                  {/* Card Extra Information & Quick Actions Bar */}
                  <div className="card" style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {isCredit && cutoffInfo && paymentDueInfo && (
                        <>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: cutoffInfo.isToday ? 'rgba(239, 68, 68, 0.15)' : cutoffInfo.days <= 3 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)',
                            color: cutoffInfo.isToday ? 'var(--color-danger)' : cutoffInfo.days <= 3 ? 'var(--color-warning)' : 'var(--text-primary)',
                            fontWeight: '600'
                          }}>
                            <span>✂️ {cutoffInfo.isToday ? 'Corta HOY' : `Corta en ${cutoffInfo.days}d`}</span>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>(día {card.billingCutoffDay || 15})</span>
                          </div>

                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: paymentDueInfo.isToday ? 'rgba(239, 68, 68, 0.2)' : paymentDueInfo.days <= 5 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-input)',
                            color: paymentDueInfo.isToday || paymentDueInfo.days <= 5 ? 'var(--color-danger)' : 'var(--text-primary)',
                            fontWeight: '600'
                          }}>
                            <span>💳 {paymentDueInfo.isToday ? 'Vence HOY' : `Vence en ${paymentDueInfo.days}d`}</span>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>(día {card.paymentDueDay || 5})</span>
                          </div>
                        </>
                      )}
                      {isDebit && (
                        <span>
                          {card.allowOverdraft ? `Sobregiro hasta: ${formatAmount(card.overdraftLimit || 0, card.currency)}` : 'Sin sobregiro'}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isCredit && card.isActive && (
                        <button
                          onClick={() => handleOpenPaymentModal(card)}
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#6366f1',
                            borderColor: 'rgba(99, 102, 241, 0.3)'
                          }}
                          title="Pagar esta tarjeta"
                        >
                          <DynamicIcon name="Coins" size={12} color="#6366f1" />
                          <span>Pagar</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleCardActive(card.id)}
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: card.isActive ? 'var(--text-secondary)' : '#10b981',
                          borderColor: 'var(--border-color)'
                        }}
                        title={card.isActive ? 'Pausar tarjeta' : 'Activar tarjeta'}
                      >
                        <DynamicIcon name={card.isActive ? 'Pause' : 'Play'} size={12} />
                      </button>

                      <button
                        onClick={() => handleOpenEditCard(card)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', borderColor: 'var(--border-color)' }}
                        title="Editar detalles"
                      >
                        <DynamicIcon name="Pencil" size={12} />
                      </button>

                      <button
                        onClick={() => setDeletingCard(card)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        title="Eliminar tarjeta"
                      >
                        <DynamicIcon name="Trash2" size={12} color="#ef4444" />
                      </button>
                    </div>
                  </div>

                  {/* Strategic Credit Intelligence / Advice */}
                  {isCredit && card.isActive && cutoffInfo && paymentDueInfo && (
                    <>
                      {cutoffInfo.days > 20 && (
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          fontSize: '11px',
                          color: 'var(--color-success)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <DynamicIcon name="Sparkles" size={13} color="var(--color-success)" />
                          <span><b>Financiamiento óptimo:</b> Compras de hoy tendrán hasta ~45 días sin intereses.</span>
                        </div>
                      )}
                      {paymentDueInfo.days <= 5 && balanceUsed > 0 && (
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          fontSize: '11px',
                          color: 'var(--color-danger)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <DynamicIcon name="AlertCircle" size={13} color="var(--color-danger)" />
                          <span><b>Pago próximo:</b> Vence el día {card.paymentDueDay || 5}. Paga a tiempo para evitar recargos e intereses.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. Modal Añadir / Editar Tarjeta */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        title={editingCard ? 'Editar Tarjeta' : 'Registrar Nueva Tarjeta'}
        maxWidth="440px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card Type Switch */}
          <div className="input-group">
            <label className="input-label">Tipo de Instrumento</label>
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => setFormType('debit')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '12px',
                  fontWeight: formType === 'debit' ? '700' : '500',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: formType === 'debit' ? '#059669' : 'transparent',
                  color: formType === 'debit' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Tarjeta de Débito
              </button>
              <button
                type="button"
                onClick={() => setFormType('credit')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '12px',
                  fontWeight: formType === 'credit' ? '700' : '500',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: formType === 'credit' ? '#4f46e5' : 'transparent',
                  color: formType === 'credit' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Tarjeta de Crédito
              </button>
            </div>
          </div>

          {/* Alias / Name */}
          <div className="input-group">
            <label className="input-label">Nombre o Alias de la Tarjeta</label>
            <input
              type="text"
              placeholder="Ej: BHD Nómina, Visa Oro Banreservas"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {/* Bank & Currency */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="input-group" style={{ flex: 2 }}>
              <label className="input-label">Banco Emisor</label>
              <input
                type="text"
                placeholder="Ej: Banco BHD, Banreservas, Popular"
                value={formBank}
                onChange={(e) => setFormBank(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Moneda</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="input-field"
              >
                <option value="RD$">RD$</option>
                <option value="$">USD ($)</option>
                <option value="€">EUR (€)</option>
                <option value="COL$">COL$</option>
                <option value="MXN$">MXN$</option>
              </select>
            </div>
          </div>

          {/* Last 4 digits (Security safe: never full number or CVV) */}
          <div className="input-group">
            <label className="input-label">Últimos 4 dígitos (Opcional)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="Ej: 4120"
              value={formLastFour}
              onChange={(e) => setFormLastFour(e.target.value.replace(/\D/g, ''))}
              className="input-field"
              inputMode="numeric"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
              🔒 Por seguridad, FinanList nunca te pedirá tu número completo ni código CVV.
            </span>
          </div>

          {/* Color theme selection */}
          <div className="input-group">
            <label className="input-label">Color Visual del Plástico</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CARD_THEMES.map(theme => {
                const isSelected = formColor === theme.color;
                return (
                  <button
                    key={theme.color}
                    type="button"
                    onClick={() => setFormColor(theme.color)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: theme.gradient,
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: isSelected ? '0 0 0 2px var(--color-primary)' : 'none',
                      cursor: 'pointer'
                    }}
                    title={theme.name}
                  />
                );
              })}
            </div>
          </div>

          {/* Debit Specific Configuration */}
          {formType === 'debit' && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981' }}>Configuración de Débito</span>

              <div className="input-group">
                <label className="input-label">Saldo Actual / Inicial ({formCurrency})</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formDebitBalance}
                  onChange={(e) => setFormDebitBalance(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Umbral de Alerta de Saldo Bajo ({formCurrency})</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 5000"
                  value={formMinBalanceAlert}
                  onChange={(e) => setFormMinBalanceAlert(e.target.value)}
                  className="input-field"
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Te avisaremos cuando tu saldo disponible descienda de esta cifra.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600' }}>Permitir Sobregiro</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Habilitar si el banco autoriza saldo negativo.</div>
                </div>
                <input
                  type="checkbox"
                  checked={formAllowOverdraft}
                  onChange={(e) => setFormAllowOverdraft(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                />
              </div>

              {formAllowOverdraft && (
                <div className="input-group">
                  <label className="input-label">Límite de Sobregiro Autorizado ({formCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 10000"
                    value={formOverdraftLimit}
                    onChange={(e) => setFormOverdraftLimit(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}
            </div>
          )}

          {/* Credit Specific Configuration */}
          {formType === 'credit' && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1' }}>Configuración de Límites y Ciclo</span>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Límite Total ({formCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 50000"
                    value={formCreditLimit}
                    onChange={(e) => setFormCreditLimit(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Saldo Utilizado ({formCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formBalanceUsed}
                    onChange={(e) => setFormBalanceUsed(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Alerta al alcanzar el % del límite</label>
                <select
                  value={formAlertThreshold}
                  onChange={(e) => setFormAlertThreshold(e.target.value)}
                  className="input-field"
                >
                  <option value="70">70% de uso</option>
                  <option value="80">80% de uso (Recomendado)</option>
                  <option value="90">90% de uso (Crítico)</option>
                  <option value="100">100% de uso</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Día de Corte</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Ej: 15"
                    value={formBillingCutoffDay}
                    onChange={(e) => setFormBillingCutoffDay(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Día Límite Pago</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Ej: 5"
                    value={formPaymentDueDay}
                    onChange={(e) => setFormPaymentDueDay(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>Tarjeta Activa</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Disponible para vincular gastos rápidamente.</div>
            </div>
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
            />
          </div>

          {cardFormError && (
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
              <span>{cardFormError}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setCardFormError(null);
                setShowCardModal(false);
              }}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveCard}
              style={{ flex: 1 }}
            >
              {editingCard ? 'Guardar Cambios' : 'Registrar Tarjeta'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. Modal Pago a Tarjeta de Crédito */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Pagar Tarjeta de Crédito"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Registra un abono o pago total a tu tarjeta. Esto restablece tu crédito disponible y reduce el saldo de la cuenta de origen, sin duplicar gastos ni contabilizarse como ingreso.
          </p>

          {/* Target credit card */}
          <div className="input-group">
            <label className="input-label">Tarjeta a Pagar (Destino)</label>
            <select
              value={payTargetCardId}
              onChange={(e) => {
                setPayTargetCardId(e.target.value);
                const target = cards.find(c => c.id === e.target.value);
                if (target && (target.balanceUsed ?? 0) > 0) {
                  setPayAmount((target.balanceUsed ?? 0).toString());
                }
              }}
              className="input-field"
            >
              {cards.filter(c => c.isActive && c.type === 'credit').map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.bank}) — Usado: {formatAmount(c.balanceUsed ?? 0, c.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Source debit card or cash */}
          <div className="input-group">
            <label className="input-label">Origen de los Fondos</label>
            <select
              value={paySourceCardId}
              onChange={(e) => setPaySourceCardId(e.target.value)}
              className="input-field"
            >
              <option value="">Efectivo / Sin Tarjeta</option>
              {cards.filter(c => c.isActive && c.type === 'debit').map(c => (
                <option key={c.id} value={c.id}>
                  💳 {c.name} ({c.bank}) — Saldo: {formatAmount(c.currentBalance ?? 0, c.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Source balance feedback indicator */}
          {(() => {
            const sourceDebit = paySourceCardId ? cards.find(c => c.id === paySourceCardId) : null;
            const availableCash = FinancialEngine.getAvailableLiquidCash(transactions, cards);
            const sourceBalance = sourceDebit ? (sourceDebit.currentBalance ?? 0) : availableCash;
            const sourceCurrency = sourceDebit?.currency || profile.currency;
            const numAmount = parseFloat(payAmount) || 0;
            const isInsufficient = numAmount > 0 && numAmount > sourceBalance;

            return (
              <div style={{
                backgroundColor: isInsufficient ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                border: `1px solid ${isInsufficient ? 'rgba(239, 68, 68, 0.28)' : 'rgba(16, 185, 129, 0.18)'}`,
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Disponible en {sourceDebit ? sourceDebit.name : 'Efectivo'}:
                  </span>
                  <span style={{ fontWeight: '700', color: isInsufficient ? '#ef4444' : '#10b981' }}>
                    {formatAmount(sourceBalance, sourceCurrency)}
                  </span>
                </div>
                {isInsufficient && (
                  <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <DynamicIcon name="AlertTriangle" size={12} color="#ef4444" />
                    <span>Faltan {formatAmount(numAmount - sourceBalance, sourceCurrency)} para completar este pago.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Amount */}
          <div className="input-group">
            <label className="input-label">Monto del Pago ({profile.currency})</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={payAmount}
              onChange={(e) => {
                setPayAmount(e.target.value);
                setPaymentError(null);
              }}
              className="input-field"
              autoFocus
              required
            />
          </div>

          {/* Date */}
          <div className="input-group">
            <label className="input-label">Fecha del Pago</label>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Notes */}
          <div className="input-group">
            <label className="input-label">Nota (Opcional)</label>
            <input
              type="text"
              placeholder="Ej: Pago total del corte de mes"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="input-field"
            />
          </div>

          {paymentError && (
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
              <span>{paymentError}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPaymentError(null);
                setShowPaymentModal(false);
              }}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExecutePayment}
              style={{ flex: 1 }}
            >
              Confirmar Pago
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. Modal Confirmación de Eliminación */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!deletingCard}
        onClose={() => setDeletingCard(null)}
        title="Eliminar Tarjeta"
        maxWidth="380px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            <DynamicIcon name="Trash2" size={24} color="#ef4444" />
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
              ¿Eliminar "{deletingCard?.name}"?
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: 1.4 }}>
              Esta tarjeta se eliminará de tu lista. Los gastos históricos registrados previamente con ella se mantendrán sin alterarse.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletingCard(null)}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmDelete}
              style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}
            >
              Sí, Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Comprobante Digital de Transferencia / Pago */}
      <TransferReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
        onViewHistory={onBack}
      />
    </div>
  );
};

export default CardsView;
