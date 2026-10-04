import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DynamicIcon } from './DynamicIcon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  closeOnBackdrop?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '420px',
  closeOnBackdrop = true,
}) => {
  // Prevent background scrolling while modal is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-portal-overlay"
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 48px) + 12px)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 16px) + 12px)',
        zIndex: 99999,
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="modal-portal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-phone)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100dvh - max(env(safe-area-inset-top, 0px), 48px) - max(env(safe-area-inset-bottom, 0px), 16px) - 36px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          animation: 'modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {title && (
          <div
            style={{
              padding: '18px 20px 14px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            {typeof title === 'string' ? (
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {title}
              </h2>
            ) : (
              title
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                minWidth: '40px',
                minHeight: '40px',
                borderRadius: '10px',
                touchAction: 'manipulation',
                padding: 0,
                transition: 'all var(--transition-fast)',
              }}
              title="Cerrar"
            >
              <DynamicIcon name="X" size={20} />
            </button>
          </div>
        )}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
export default Modal;
