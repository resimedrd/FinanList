import React from 'react';
import { DynamicIcon } from '../../components/DynamicIcon';
import { PaymentCard, PaymentMethod } from '../../models/types';

interface AccountPickerModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSelect: (account: string, cardId?: string, method?: PaymentMethod) => void;
  activeCards: PaymentCard[];
  cashBalance: number;
  currency: string;
}

export const AccountPickerModal: React.FC<AccountPickerModalProps> = ({
  isOpen,
  title,
  onClose,
  onSelect,
  activeCards,
  cashBalance,
  currency
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>{title}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            <DynamicIcon name="X" size={20} color="var(--text-secondary)" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px', maxHeight: '320px', overflowY: 'auto' }}>
          {/* Option 1: Cash */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onSelect('Efectivo', undefined, 'cash');
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <DynamicIcon name="Banknote" size={18} color="var(--color-success)" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Efectivo</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Caja y liquidez directa</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: cashBalance > 0 ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                {currency}{cashBalance.toLocaleString()}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Disponible</div>
            </div>
          </button>

          {/* Option 2: Active Cards */}
          {activeCards.map(c => {
            const isCredit = c.type === 'credit';
            const capacity = isCredit
              ? Math.max(0, (c.creditLimit || 0) - (c.balanceUsed || 0))
              : ((c.currentBalance || 0) + (c.allowOverdraft ? (c.overdraftLimit || 0) : 0));
            const capacityLabel = isCredit ? 'Cupo disponible' : 'Saldo disponible';

            return (
              <button
                key={c.id}
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onSelect(c.name, c.id, 'card');
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: `${c.color || 'var(--color-primary)'}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <DynamicIcon name="CreditCard" size={18} color={c.color || 'var(--color-primary)'} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {c.name} {c.lastFourDigits ? `(••${c.lastFourDigits})` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {c.bank} • <span style={{ textTransform: 'capitalize' }}>{isCredit ? 'Crédito' : 'Débito'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {currency}{capacity.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{capacityLabel}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
