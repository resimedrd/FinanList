import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from './DynamicIcon';
import { Transaction, Category, TransactionType } from '../models/types';
import { compressImageFile } from '../utils/imageUtils';
import { useDebounce } from '../utils/useDebounce';
import { CategoryDetector, CategoryDetectionResult } from '../services/CategoryDetector';
import { FinancialEngine } from '../services/FinancialEngine';

type CardImpact =
  | {
      isCredit: true;
      currentDebt: number;
      projectedDebt: number;
      currentAvailable: number;
      projectedAvailable: number;
      currentPositive: number;
      projectedPositive: number;
      isOverLimit: boolean;
      creditLimit: number;
      currency: string;
      isOverdraftExceeded?: never;
    }
  | {
      isCredit: false;
      currentBalance: number;
      projectedBalance: number;
      isNegative: boolean;
      isOverdraftExceeded: boolean;
      allowOverdraft?: boolean;
      currency: string;
      isOverLimit?: never;
    };

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTransaction?: Transaction; // optional for edit mode
  defaultType?: 'income' | 'expense';
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, editTransaction, defaultType }) => {
  const { categories, transactions, addTransaction, updateTransaction, profile, addCategory, cards, setActiveTab } = useApp();

  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<TransactionType | 'payment'>('expense');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>('');
  const [account, setAccount] = useState<string>('Tarjeta');
  const [cardId, setCardId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [detectedResult, setDetectedResult] = useState<CategoryDetectionResult | null>(null);
  const debouncedNotes = useDebounce(notes, 350);
  const [tagsInput, setTagsInput] = useState<string>('');
  const [favorite, setFavorite] = useState<boolean>(false);
  const [suggestedCatId, setSuggestedCatId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Advanced fields
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [locationName, setLocationName] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');

  // Inline category creation states
  const [showInlineAddCategory, setShowInlineAddCategory] = useState<boolean>(false);
  const [inlineCatName, setInlineCatName] = useState<string>('');
  const [inlineCatColor, setInlineCatColor] = useState<string>('#6366f1');
  const [inlineCatIcon, setInlineCatIcon] = useState<string>('Tag');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateInlineCategory = () => {
    if (!inlineCatName.trim()) {
      setFormError('Por favor, ingresa un nombre para la categoría.');
      return;
    }
    const newCatId = addCategory({
      name: inlineCatName.trim(),
      color: inlineCatColor,
      icon: inlineCatIcon
    });
    setSelectedCatId(newCatId);
    setInlineCatName('');
    setShowInlineAddCategory(false);
    setFormError(null);
  };

  // Top 5 frequent categories for current type
  const frequentCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    (transactions || [])
      .filter(t => t.type === type)
      .slice(0, 50)
      .forEach(t => {
        if (t.categoryId) {
          counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
        }
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([catId]) => categories.find(c => c.id === catId))
      .filter((c): c is Category => !!c && !c.parentId);
  }, [transactions, type, categories]);

  // Default values or load edit details
  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      setDetectedResult(null);
      setSuggestedCatId('');
      setShowInlineAddCategory(false);
      setInlineCatName('');
      setInlineCatColor('#6366f1');
      setInlineCatIcon('Tag');
      
      if (editTransaction) {
        setAmount(editTransaction.amount.toString());
        setType(editTransaction.type);
        setSelectedCatId(editTransaction.categoryId);
        setSelectedSubCatId(editTransaction.subcategoryId || '');
        setAccount(editTransaction.account);
        setCardId(editTransaction.cardId);
        setDate(editTransaction.date);
        setTime(editTransaction.time);
        setNotes(editTransaction.notes || '');
        setTagsInput((editTransaction.tags || []).join(', '));
        setFavorite(editTransaction.favorite || false);
        setLocationName(editTransaction.location?.name || '');
        setReceiptPhoto(editTransaction.receiptPhoto || '');
        setShowAdvanced(!!(editTransaction.notes || editTransaction.tags?.length || editTransaction.location || editTransaction.receiptPhoto));
      } else {
        // Reset to default
        setAmount('');
        setType(defaultType || 'expense');
        setSelectedCatId('');
        setSelectedSubCatId('');

        const activeCards = cards.filter(c => c.isActive);
        const lastCardId = localStorage.getItem('finanlist_last_card_id');
        const lastAccount = localStorage.getItem('finanlist_last_account');
        const rememberedCard = lastCardId ? activeCards.find(c => c.id === lastCardId) : undefined;

        if (rememberedCard) {
          setCardId(rememberedCard.id);
          setAccount(rememberedCard.name);
        } else if (lastAccount === 'Efectivo') {
          setCardId(undefined);
          setAccount('Efectivo');
        } else if (activeCards.length > 0) {
          setCardId(activeCards[0].id);
          setAccount(activeCards[0].name);
        } else {
          setCardId(undefined);
          setAccount('Efectivo');
        }
        
        const now = new Date();
        setDate(now.toISOString().split('T')[0]);
        setTime(now.toTimeString().split(' ')[0].slice(0, 5));
        
        setNotes('');
        setTagsInput('');
        setFavorite(false);
        setLocationName('');
        setReceiptPhoto('');
        setShowAdvanced(false);
      }
    }
  }, [isOpen, editTransaction, defaultType, cards]);

  // Auto-categorize via CategoryDetector with debounce
  useEffect(() => {
    // Only auto-categorize expenses when user is typing notes
    if (type !== 'expense' || !debouncedNotes.trim()) {
      setDetectedResult(null);
      return;
    }
    const result = CategoryDetector.detect(debouncedNotes, categories);
    if (result) {
      setDetectedResult(result);
      setSelectedCatId(result.categoryId);
      setSelectedSubCatId('');
      setSuggestedCatId(result.categoryId);
    } else {
      setDetectedResult(null);
    }
  }, [debouncedNotes, type, categories]);

  // Filter categories by type
  const isIncomeCat = (catId: string) => ['cat_sal', 'cat_inv', 'cat_extra'].includes(catId);
  const filteredCategories = categories.filter(c => !c.parentId && (type === 'income' ? isIncomeCat(c.id) : !isIncomeCat(c.id)));
  const subcategories = categories.filter(c => c.parentId === selectedCatId);

  // Auto select subcategory if empty
  useEffect(() => {
    if (filteredCategories.length > 0 && !selectedCatId) {
      setSelectedCatId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, selectedCatId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 1024, 1024, 0.7);
        setReceiptPhoto(compressed);
      } catch (err) {
        console.warn('[TransactionModal] Image compression failed, falling back to direct reader:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setReceiptPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationName(`Coordenadas: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          setLocationName('San José, Costa Rica (Simulado)');
        }
      );
    } else {
      setLocationName('Ubicación no soportada');
    }
  };

  const selectedCard = cardId ? cards.find(c => c.id === cardId) : undefined;
  const numAmountVal = parseFloat(amount) || 0;

  // Real-time projected balance calculation for the selected card
  const getCardImpact = (): CardImpact | null => {
    if (!selectedCard) return null;

    if (selectedCard.type === 'credit') {
      const currentDebt = selectedCard.balanceUsed ?? 0;
      const creditLimit = selectedCard.creditLimit ?? 0;
      const currentPositive = selectedCard.positiveBalance ?? 0;
      const currentAvailable = FinancialEngine.getAvailableCredit(selectedCard);

      let projectedDebt = currentDebt;
      let projectedPositive = currentPositive;

      if (numAmountVal > 0) {
        if (type === 'expense') {
          const simCard = { ...selectedCard };
          FinancialEngine.applyExpenseToCreditCard(simCard, numAmountVal);
          projectedDebt = simCard.balanceUsed ?? 0;
          projectedPositive = simCard.positiveBalance ?? 0;
        } else {
          const simCard = { ...selectedCard };
          FinancialEngine.applyPaymentToCreditCard(simCard, numAmountVal);
          projectedDebt = simCard.balanceUsed ?? 0;
          projectedPositive = simCard.positiveBalance ?? 0;
        }
      }

      const projectedAvailable = FinancialEngine.getAvailableCredit({
        ...selectedCard,
        balanceUsed: projectedDebt,
        positiveBalance: projectedPositive
      });
      const isOverLimit = type === 'expense' && numAmountVal > currentAvailable;

      return {
        isCredit: true,
        currentDebt,
        projectedDebt,
        currentAvailable,
        projectedAvailable,
        currentPositive,
        projectedPositive,
        isOverLimit,
        creditLimit,
        currency: selectedCard.currency || profile.currency
      };
    } else {
      const currentBalance = selectedCard.currentBalance ?? 0;
      const projectedBalance = type === 'expense'
        ? currentBalance - numAmountVal
        : currentBalance + numAmountVal;
      
      const isNegative = projectedBalance < 0;
      const overdraftLimit = selectedCard.overdraftLimit ?? 0;
      const isOverdraftExceeded = isNegative && (!selectedCard.allowOverdraft || Math.abs(projectedBalance) > overdraftLimit);

      return {
        isCredit: false,
        currentBalance,
        projectedBalance,
        isNegative,
        isOverdraftExceeded,
        allowOverdraft: selectedCard.allowOverdraft,
        currency: selectedCard.currency || profile.currency
      };
    }
  };

  const cardImpact = getCardImpact();

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }

    const categoryObj = categories.find(c => c.id === selectedCatId);
    if (!categoryObj) {
      setFormError('Por favor, selecciona una categoría para el movimiento.');
      return;
    }

    setFormError(null);

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const finalAccount = selectedCard ? selectedCard.name : (account || 'Efectivo');

    const transactionData = {
      amount: numAmount,
      type,
      categoryId: selectedCatId,
      subcategoryId: selectedSubCatId || undefined,
      account: finalAccount,
      cardId: selectedCard ? selectedCard.id : undefined,
      date,
      time,
      notes: notes || undefined,
      tags: tags.length ? tags : undefined,
      color: categoryObj.color,
      icon: categoryObj.icon,
      receiptPhoto: receiptPhoto || undefined,
      location: locationName ? { name: locationName } : undefined,
      favorite
    };

    if (isSaving) return;

    try {
      setIsSaving(true);
      if (editTransaction) {
        updateTransaction({
          ...editTransaction,
          ...transactionData
        });
      } else {
        addTransaction(transactionData);
        try {
          if (selectedCard) {
            localStorage.setItem('finanlist_last_card_id', selectedCard.id);
            localStorage.setItem('finanlist_last_account', selectedCard.name);
          } else {
            localStorage.removeItem('finanlist_last_card_id');
            localStorage.setItem('finanlist_last_account', 'Efectivo');
          }
        } catch {
          // Ignore localStorage errors in private mode
        }
      }

      // Memorizar asociación en la memoria local del usuario
      if (type === 'expense' && notes.trim() && selectedCatId) {
        CategoryDetector.learn(notes, selectedCatId);
      }

      onClose();
    } catch (err) {
      console.error('Error saving transaction:', err);
      setFormError('Hubo un error al guardar el movimiento. Por favor intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={styles.modalSheet}>
        {/* Sticky Modal Header */}
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
            {editTransaction ? 'Editar Movimiento' : 'Nuevo Movimiento'}
          </h2>
          <button className="btn-ghost" onClick={onClose} style={styles.closeBtn}>
            <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div style={styles.modalBody}>
          {/* Expense/Income Toggle */}
          <div style={styles.typeToggle}>
            <button
              onClick={() => setType('expense')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: type === 'expense' ? 'var(--color-danger-light)' : 'transparent',
                color: type === 'expense' ? 'var(--color-danger)' : 'var(--text-secondary)',
                borderColor: type === 'expense' ? 'var(--color-danger)' : 'transparent',
              }}
            >
              Gasto
            </button>
            <button
              onClick={() => setType('income')}
              style={{
                ...styles.toggleBtn,
                backgroundColor: type === 'income' ? 'var(--color-success-light)' : 'transparent',
                color: type === 'income' ? 'var(--color-success)' : 'var(--text-secondary)',
                borderColor: type === 'income' ? 'var(--color-success)' : 'transparent',
              }}
            >
              Ingreso
            </button>
          </div>

          {/* Big Amount Input */}
          <div style={styles.amountContainer}>
            <span style={styles.currencySymbol}>{profile.currency}</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setAmount(val);
                }
              }}
              style={styles.amountInput}
              autoFocus
            />
          </div>

          {/* Concepto / Comercio Input con Auto-Categorización Local */}
          <div className="input-group" style={{ marginTop: '10px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="input-label" style={{ margin: 0 }}>Concepto o Comercio</label>
              {detectedResult && (
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DynamicIcon name="Sparkles" size={11} color="#10b981" />
                  <span>{detectedResult.source === 'user_memory' ? 'Recordado de tus hábitos' : 'Detectado automáticamente'}</span>
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Ej: La Sirena, McDonalds, Gasolina, Edesur..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field"
              style={{ fontSize: '14px', padding: '10px 12px' }}
            />
          </div>

          {/* Chip interactivo de categoría detectada */}
          {detectedResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                padding: '8px 12px',
                borderRadius: '10px',
                marginBottom: '10px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Categoría:</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(() => {
                    const cat = categories.find(c => c.id === detectedResult.categoryId);
                    return (
                      <>
                        {cat && <DynamicIcon name={cat.icon} size={14} color={cat.color} />}
                        <span>{cat ? cat.name : detectedResult.categoryName}</span>
                      </>
                    );
                  })()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetectedResult(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '6px',
                }}
              >
                (Cambiar)
              </button>
            </div>
          )}

          {/* 1-Tap Quick Frequent Categories Chips */}
          {frequentCategories.length > 0 && (
            <div style={styles.frequentSection}>
              <div style={styles.frequentLabel}>
                <DynamicIcon name="Zap" size={13} color="var(--color-primary)" />
                <span>Categorías frecuentes (1 toque)</span>
              </div>
              <div style={styles.frequentChipsList}>
                {frequentCategories.map(cat => {
                  const isSelected = selectedCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCatId(cat.id);
                        setSelectedSubCatId('');
                        setSuggestedCatId('');
                      }}
                      style={{
                        ...styles.frequentChip,
                        backgroundColor: isSelected ? `${cat.color}25` : 'var(--bg-card)',
                        borderColor: isSelected ? cat.color : 'var(--border-color)',
                        color: isSelected ? cat.color : 'var(--text-primary)',
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      <div style={{ ...styles.frequentChipIcon, backgroundColor: cat.color }}>
                        <DynamicIcon name={cat.icon} size={11} color="white" />
                      </div>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {/* Payment Method / Card Selection */}
        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="input-label" style={{ margin: 0 }}>Método de Pago / Tarjeta Utilizada</label>
            <button
              type="button"
              onClick={() => {
                onClose();
                setActiveTab('cards');
              }}
              style={{
                fontSize: '11px',
                color: 'var(--color-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              ⚙️ Mis Tarjetas
            </button>
          </div>

          <div style={{ ...styles.horizontalScroll, paddingBottom: '4px' }}>
            {/* Cash option */}
            <button
              type="button"
              onClick={() => {
                setCardId(undefined);
                setAccount('Efectivo');
              }}
              style={{
                ...styles.scrollItem,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '12px',
                backgroundColor: !cardId ? 'var(--color-primary-light)' : 'var(--bg-card)',
                borderColor: !cardId ? 'var(--color-primary)' : 'var(--border-color)',
                color: !cardId ? 'var(--color-primary)' : 'var(--text-primary)',
                fontWeight: !cardId ? '700' : '500',
              }}
            >
              <DynamicIcon name="Coins" size={16} />
              <span>Efectivo / Sin Tarjeta</span>
            </button>

            {/* Registered Cards */}
            {cards.filter(c => c.isActive || c.id === cardId).map(c => {
              const isSelected = cardId === c.id;
              const isCredit = c.type === 'credit';
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setCardId(c.id);
                    setAccount(c.name);
                  }}
                  style={{
                    ...styles.scrollItem,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--bg-card)',
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-color)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                    fontWeight: isSelected ? '700' : '500',
                    borderLeft: `4px solid ${c.color || (isCredit ? '#4f46e5' : '#059669')}`
                  }}
                >
                  <DynamicIcon name="CreditCard" size={16} color={c.color || (isCredit ? '#4f46e5' : '#059669')} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700' }}>{c.name}</span>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: '700',
                        backgroundColor: isCredit ? 'rgba(79, 70, 229, 0.15)' : 'rgba(5, 150, 105, 0.15)',
                        color: isCredit ? '#6366f1' : '#10b981'
                      }}>
                        {isCredit ? 'CRÉDITO' : 'DÉBITO'}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {c.bank} {c.lastFourDigits ? `(••• ${c.lastFourDigits})` : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dynamic real-time feedback on card balance / credit limit */}
          {cardImpact && (
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: cardImpact.isOverLimit || cardImpact.isOverdraftExceeded
                ? 'var(--color-danger-light)'
                : 'var(--bg-card)',
              border: `1px solid ${
                cardImpact.isOverLimit || cardImpact.isOverdraftExceeded
                  ? 'rgba(239, 68, 68, 0.4)'
                  : 'var(--border-color)'
              }`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '11px'
            }}>
              {cardImpact.isCredit ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Crédito disponible:</span>
                    <span style={{ fontWeight: '700', color: cardImpact.isOverLimit ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {cardImpact.currency}{cardImpact.currentAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ➔ {cardImpact.currency}{cardImpact.projectedAvailable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Deuda tarjeta:</span>
                    <span style={{ fontWeight: '700', color: 'var(--color-danger)' }}>
                      {cardImpact.currency}{cardImpact.currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ➔ {cardImpact.currency}{cardImpact.projectedDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {(cardImpact.currentPositive > 0 || cardImpact.projectedPositive > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Saldo a favor:</span>
                      <span style={{ fontWeight: '700', color: '#10b981' }}>
                        {cardImpact.currency}{cardImpact.currentPositive.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ➔ {cardImpact.currency}{cardImpact.projectedPositive.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {cardImpact.currentPositive > 0 && type === 'expense' && (
                    <div style={{ color: '#10b981', fontWeight: '600', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>✨ Este gasto se descontará primero de tu Saldo a Favor antes de generar deuda.</span>
                    </div>
                  )}
                  {cardImpact.isOverLimit && (
                    <div style={{ color: 'var(--color-danger)', fontWeight: '700', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚠️ Este gasto superará el límite de crédito disponible.</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Saldo en cuenta débito:</span>
                    <span style={{ fontWeight: '700', color: cardImpact.isNegative ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                      {cardImpact.currency}{cardImpact.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ➔ {cardImpact.currency}{cardImpact.projectedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {cardImpact.isOverdraftExceeded ? (
                    <div style={{ color: 'var(--color-danger)', fontWeight: '700', fontSize: '10px' }}>
                      🚨 Excede el saldo disponible (sobregiro no permitido o límite rebasado).
                    </div>
                  ) : cardImpact.isNegative && cardImpact.allowOverdraft ? (
                    <div style={{ color: 'var(--color-warning)', fontWeight: '600', fontSize: '10px' }}>
                      ⚠️ Esta compra utilizará saldo de sobregiro autorizado.
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        {/* Category selection */}
        <div className="input-group" style={{ marginBottom: showInlineAddCategory ? '8px' : '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="input-label" style={{ margin: 0 }}>Categoría</label>
            {!showInlineAddCategory && (
              <button 
                type="button" 
                onClick={() => setShowInlineAddCategory(true)} 
                className="btn btn-ghost" 
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 8px', 
                  color: 'var(--color-primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  width: 'auto',
                  border: 'none', 
                  cursor: 'pointer', 
                  background: 'none'
                }}
              >
                <span>➕ Crear nueva</span>
              </button>
            )}
          </div>

          {showInlineAddCategory && (
            <div style={{ 
              border: '1px dashed var(--color-primary)', 
              borderRadius: '12px', 
              padding: '12px', 
              backgroundColor: 'var(--bg-card)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              marginBottom: '14px',
              width: '100%'
            }}>
              <div style={{ fontWeight: '700', fontSize: '11px', color: 'var(--color-primary)' }}>Nueva Categoría Rápida</div>
              
              <div className="input-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="Nombre de la categoría, ej. Regalos"
                  value={inlineCatName}
                  onChange={(e) => setInlineCatName(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '16px', padding: '10px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', margin: '6px 0' }}>
                {['#ff4d4d', '#3399ff', '#b366ff', '#ff66b2', '#ffcc00', '#22c55e', '#00cccc', '#e11d48', '#f97316', '#a855f7', '#06b6d4', '#71717a'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setInlineCatColor(color)}
                    style={{
                      height: '32px',
                      width: '32px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: 'none',
                      outline: inlineCatColor === color ? '3px solid var(--text-primary)' : 'none',
                      outlineOffset: '2px',
                      cursor: 'pointer',
                      justifySelf: 'center'
                    }}
                  />
                ))}
              </div>

              <select
                value={inlineCatIcon}
                onChange={(e) => setInlineCatIcon(e.target.value)}
                className="input-field"
                style={{ fontSize: '13px', padding: '8px' }}
              >
                <option value="Tag">🏷️ Etiqueta genérica</option>
                <option value="Coffee">☕ Comida / Café</option>
                <option value="Car">🚗 Vehículo / Transporte</option>
                <option value="Tv">📺 Entretenimiento / Ocio</option>
                <option value="ShoppingBag">🛍️ Compras / Ropa</option>
                <option value="Zap">⚡ Servicios / Recibos</option>
                <option value="HeartPulse">❤️ Salud / Farmacia</option>
                <option value="Plane">✈️ Viajes / Vacaciones</option>
                <option value="GraduationCap">🎓 Educación / Cursos</option>
              </select>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleCreateInlineCategory} 
                  className="btn btn-primary"
                  style={{ fontSize: '11px', padding: '6px', flex: 1 }}
                >
                  Crear y Seleccionar
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowInlineAddCategory(false);
                    setInlineCatName('');
                  }} 
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '6px', flex: 1 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!showInlineAddCategory && (
            <div style={styles.gridContainer}>
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCatId(cat.id);
                    setSelectedSubCatId(''); // Reset subcategory on main change
                    setSuggestedCatId(''); // Clear suggestion on manual select
                  }}
                  style={{
                    ...styles.categoryGridItem,
                    backgroundColor: selectedCatId === cat.id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    borderColor: selectedCatId === cat.id ? cat.color : 'var(--border-color)',
                    animation: suggestedCatId === cat.id ? 'pulseGlow 1.5s infinite alternate' : 'none'
                  }}
                >
                  <div style={{ ...styles.catIconCircle, backgroundColor: cat.color }}>
                    <DynamicIcon name={cat.icon} size={18} color="white" />
                  </div>
                  <span style={styles.catNameText}>
                    {cat.name}
                    {suggestedCatId === cat.id && (
                      <span style={{ fontSize: '8px', color: 'var(--color-primary)', fontWeight: '700', display: 'block', marginTop: '1px' }}>
                        💡 Sugerido
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subcategories (only if selected category has them) */}
        {subcategories.length > 0 && (
          <div className="input-group animate-fade-in">
            <label className="input-label">Subcategoría (Opcional)</label>
            <div style={styles.horizontalScroll}>
              <button
                onClick={() => setSelectedSubCatId('')}
                style={{
                  ...styles.scrollItem,
                  backgroundColor: selectedSubCatId === '' ? 'var(--color-primary-light)' : 'var(--bg-card)',
                  borderColor: selectedSubCatId === '' ? 'var(--color-primary)' : 'var(--border-color)',
                  color: selectedSubCatId === '' ? 'var(--color-primary)' : 'var(--text-primary)',
                }}
              >
                Ninguna
              </button>
              {subcategories.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCatId(sub.id)}
                  style={{
                    ...styles.scrollItem,
                    backgroundColor: selectedSubCatId === sub.id ? 'var(--color-primary-light)' : 'var(--bg-card)',
                    borderColor: selectedSubCatId === sub.id ? sub.color : 'var(--border-color)',
                    color: selectedSubCatId === sub.id ? 'var(--color-primary)' : 'var(--text-primary)',
                  }}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Advanced */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={styles.advancedToggle}
        >
          <span>{showAdvanced ? 'Ocultar detalles' : 'Más detalles opcionales'}</span>
          <DynamicIcon name={showAdvanced ? 'ChevronUp' : 'ChevronDown'} size={16} />
        </button>

        {/* Advanced details section */}
        {showAdvanced && (
          <div style={styles.advancedContainer}>
            <div style={styles.row}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Hora</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Etiquetas (separadas por comas)</label>
              <input
                type="text"
                placeholder="viajes, vacaciones, comida-rapida"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Favorite check */}
            <div style={styles.checkboxRow}>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Marcar como favorito</span>
              <button
                onClick={() => setFavorite(!favorite)}
                style={{
                  ...styles.favBtn,
                  color: favorite ? '#f43f5e' : 'var(--text-muted)'
                }}
              >
                <DynamicIcon name={favorite ? 'Heart' : 'Heart'} size={24} color={favorite ? '#f43f5e' : 'var(--text-muted)'} />
              </button>
            </div>

            {/* Location Attachment */}
            <div className="input-group">
              <label className="input-label">Ubicación</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Obtener ubicación o escribir..."
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  style={styles.attachBtn}
                  title="Obtener ubicación actual"
                >
                  <DynamicIcon name="MapPin" size={18} />
                </button>
              </div>
            </div>

            {/* Photo Attachment */}
            <div className="input-group">
              <label className="input-label">Foto del Comprobante</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={styles.photoUploadLabel}>
                  <DynamicIcon name="Camera" size={18} />
                  <span>Subir foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
                {receiptPhoto && (
                  <div style={styles.previewContainer}>
                    <img src={receiptPhoto} alt="Comprobante" style={styles.photoPreview} />
                    <button onClick={() => setReceiptPhoto('')} style={styles.deletePhotoBtn}>
                      <DynamicIcon name="Trash2" size={12} color="white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        </div>
        {/* End modalBody */}

        {/* Sticky Action Bar */}
        <div style={styles.stickyFooter}>
          {formError && (
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
              gap: '6px',
              marginBottom: '10px'
            }}>
              <DynamicIcon name="AlertTriangle" size={14} color="#ef4444" />
              <span>{formError}</span>
            </div>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={isSaving}
            style={{ 
              width: '100%',
              minHeight: '48px',
              fontSize: '15px',
              fontWeight: '700',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              opacity: isSaving ? 0.7 : 1,
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {isSaving ? 'Guardando...' : (editTransaction ? 'Guardar Cambios' : 'Registrar Movimiento')}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalSheet: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100%',
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--bg-phone)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 48px) + 12px)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    backgroundColor: 'var(--bg-card)',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    WebkitOverflowScrolling: 'touch',
  },
  closeBtn: {
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-phone)',
    cursor: 'pointer',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    borderRadius: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    touchAction: 'manipulation',
    padding: 0,
  },
  typeToggle: {
    display: 'flex',
    backgroundColor: 'var(--bg-input)',
    padding: '4px',
    borderRadius: '12px',
    gap: '4px',
  },
  toggleBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid transparent',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  amountContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '6px',
    margin: '6px 0',
  },
  currencySymbol: {
    fontSize: '36px',
    fontWeight: '800',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)',
  },
  amountInput: {
    fontSize: '44px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    border: 'none',
    background: 'none',
    outline: 'none',
    width: '200px',
    textAlign: 'left',
    fontFamily: 'var(--font-display)',
  },
  frequentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    margin: '-4px 0 2px 0',
  },
  frequentLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  frequentChipsList: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '2px 0 6px 0',
    WebkitOverflowScrolling: 'touch',
  },
  frequentChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  frequentChipIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalScroll: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    padding: '4px 0',
  },
  scrollItem: {
    padding: '10px 16px',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.1s ease',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  categoryGridItem: {
    padding: '12px 6px',
    minHeight: '62px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  catIconCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameText: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  advancedToggle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: 'var(--color-primary)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    margin: '5px auto',
  },
  advancedContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '14px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  checkboxRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  attachBtn: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    padding: '10px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  previewContainer: {
    position: 'relative',
    width: '46px',
    height: '46px',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    backgroundColor: 'var(--color-danger)',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  stickyFooter: {
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 20px',
    paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
    backgroundColor: 'var(--bg-card)',
    borderTop: '1px solid var(--border-color)',
    zIndex: 20,
    flexShrink: 0,
  },
};
export default TransactionModal;
