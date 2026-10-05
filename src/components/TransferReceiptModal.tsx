import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DynamicIcon } from './DynamicIcon';
import { CheckCircle2, Copy, Check, ArrowRight, X } from 'lucide-react';

export interface TransferReceiptData {
  referenceId: string;
  amount: number;
  currency: string;
  sourceName: string;
  destinationName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title?: string;
  subtitle?: string;
  notes?: string;
  availableRestored?: number;
}

interface TransferReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TransferReceiptData | null;
  onViewHistory?: () => void;
}

export const TransferReceiptModal: React.FC<TransferReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
  onViewHistory,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2200);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const formattedAmount = `${data.currency} ${data.amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const handleCopyReceipt = () => {
    const text = `🧾 COMPROBANTE FINANLIST
Ref: #${data.referenceId}
Monto: ${formattedAmount}
Origen: ${data.sourceName}
Destino: ${data.destinationName}
Fecha: ${data.date} ${data.time}
Estado: Completado con éxito`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => setCopied(true));
    } else {
      setCopied(true);
    }
  };

  return createPortal(
    <div
      className="receipt-portal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 48px) + 12px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 12px)',
        zIndex: 100000,
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="receipt-ticket-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-card, #1e293b)',
          color: 'var(--text-primary, #f8fafc)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          position: 'relative',
          overflow: 'hidden',
          animation: 'receiptIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Close Button top-right */}
        <button
          onClick={onClose}
          aria-label="Cerrar recibo"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'var(--text-secondary, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <X size={18} />
        </button>

        {/* Top Header with Success Icon */}
        <div
          style={{
            padding: '28px 24px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              marginBottom: '14px',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
            }}
          >
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            {data.subtitle || 'Operación Exitosa'}
          </span>

          <h2
            style={{
              margin: '0 0 6px',
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--text-primary, #f8fafc)',
            }}
          >
            {data.title || '¡Pago Realizado con Éxito!'}
          </h2>

          <div
            style={{
              fontSize: '28px',
              fontWeight: '800',
              color: 'var(--color-primary, #6366f1)',
              letterSpacing: '-0.5px',
              marginTop: '4px',
            }}
          >
            {formattedAmount}
          </div>
        </div>

        {/* Perforated ticket line */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Left Notch */}
          <div
            style={{
              position: 'absolute',
              left: '-10px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
            }}
          />
          {/* Dashed line */}
          <div
            style={{
              width: 'calc(100% - 36px)',
              borderTop: '1.5px dashed var(--border-color, rgba(255, 255, 255, 0.12))',
            }}
          />
          {/* Right Notch */}
          <div
            style={{
              position: 'absolute',
              right: '-10px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
            }}
          />
        </div>

        {/* Voucher Details Body */}
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* From -> To Flow Cards */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
              borderRadius: '14px',
              padding: '12px 14px',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '2px' }}>
                Origen
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.sourceName}
              </div>
            </div>

            <div style={{ padding: '0 8px', color: 'var(--text-secondary, #94a3b8)' }}>
              <ArrowRight size={16} />
            </div>

            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '2px' }}>
                Destino
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#10b981' }}>
                {data.destinationName}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Referencia</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--text-primary, #f8fafc)' }}>
                #{data.referenceId}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Fecha y Hora</span>
              <span style={{ fontWeight: '500' }}>
                {data.date} • {data.time}
              </span>
            </div>

            {data.availableRestored !== undefined && data.availableRestored > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Cupo Liberado</span>
                <span style={{ color: '#10b981', fontWeight: '700' }}>
                  +{data.currency} {data.availableRestored.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {data.notes && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Concepto</span>
                <span style={{ fontWeight: '500', fontStyle: 'italic', maxWidth: '60%', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {data.notes}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '700',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Check size={16} /> Listo
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyReceipt}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  backgroundColor: copied ? 'rgba(16, 185, 129, 0.15)' : undefined,
                  borderColor: copied ? '#10b981' : undefined,
                  color: copied ? '#10b981' : undefined,
                  transition: 'all 0.2s ease',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '¡Copiado!' : 'Copiar Comprobante'}
              </button>

              {onViewHistory && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    onClose();
                    onViewHistory();
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <DynamicIcon name="FileText" size={14} /> Ver Movimientos
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
