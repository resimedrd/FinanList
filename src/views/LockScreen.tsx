import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from '../components/DynamicIcon';
import { CryptoService } from '../services/CryptoService';
import {
  checkPinLockout,
  recordFailedPinAttempt,
  resetPinLockout,
  type LockoutState
} from '../utils/securityUtils';

export const LockScreen: React.FC = () => {
  const { profile, setAuthenticated, updateProfile } = useApp();
  const [pin, setPin] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lockout, setLockout] = useState<LockoutState>(() => checkPinLockout());
  const targetPin = profile.pinCode || '1234';

  // Lockout countdown timer
  useEffect(() => {
    if (!lockout.isLocked) return;

    const timer = setInterval(() => {
      const updated = checkPinLockout();
      setLockout(updated);
      if (!updated.isLocked) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lockout.isLocked]);

  const handleKeyPress = async (num: string) => {
    if (lockout.isLocked || isVerifying) return;

    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      // Auto submit if length is 4
      if (nextPin.length === 4) {
        setIsVerifying(true);
        const isMatch = await CryptoService.verifyPin(nextPin, targetPin);

        if (isMatch) {
          resetPinLockout();

          // Transparent migration from legacy plaintext PIN to SHA-256 hash
          if (CryptoService.isLegacyPlaintext(targetPin)) {
            try {
              const hashed = await CryptoService.hashPin(nextPin);
              await updateProfile({
                ...profile,
                pinCode: hashed,
              });
            } catch (err) {
              console.error('[LockScreen] Error migrating PIN to SHA-256:', err);
            }
          }

          setTimeout(() => {
            setAuthenticated(true);
            setIsVerifying(false);
          }, 150);
        } else {
          const newLockout = recordFailedPinAttempt();
          setLockout(newLockout);
          setTimeout(() => {
            setShake(true);
            setPin('');
            setIsVerifying(false);
            setTimeout(() => setShake(false), 500);
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (lockout.isLocked || isVerifying) return;
    setPin(pin.slice(0, -1));
  };

  // Listen to physical keyboard events for digits and backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockout.isLocked || isVerifying) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, lockout.isLocked, isVerifying]);

  return (
    <div className="lockscreen-container" style={styles.container}>
      <div className="lockscreen-header" style={styles.header}>
        <div className="lock-icon" style={styles.lockIcon}>
          <DynamicIcon name="Lock" size={24} color={lockout.isLocked ? 'var(--color-danger)' : 'var(--color-primary)'} />
        </div>
        <h2 style={styles.appName}>Finanlist</h2>
        <p style={styles.subtitle}>¡Hola, @{profile.username || 'usuario'}!</p>
        {lockout.isLocked ? (
          <p style={{ ...styles.subtitle, fontSize: '12px', marginTop: '6px', color: 'var(--color-danger)', fontWeight: 600 }}>
            Demasiados intentos fallidos. Espera {lockout.remainingSeconds}s
          </p>
        ) : (
          <p style={{ ...styles.subtitle, fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>
            {lockout.failedAttempts > 0 && lockout.failedAttempts < 3
              ? `PIN incorrecto (${3 - lockout.failedAttempts} ${3 - lockout.failedAttempts === 1 ? 'intento restante' : 'intentos restantes'})`
              : 'Introduce tu PIN para ingresar'}
          </p>
        )}
      </div>

      {/* PIN Dot Indicators */}
      <div className={`pin-indicators ${shake ? 'shake' : ''}`} style={styles.dotsContainer}>
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            style={{
              ...styles.dot,
              backgroundColor: shake 
                ? 'var(--color-danger)' 
                : pin.length > idx 
                  ? 'var(--color-primary)' 
                  : 'var(--border-color)',
              transform: pin.length > idx ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Keyboard Grid */}
      <div style={styles.keyboard}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleKeyPress(String(num))}
            className="pin-btn"
            disabled={lockout.isLocked || isVerifying}
            style={{
              ...styles.keyButton,
              opacity: lockout.isLocked || isVerifying ? 0.4 : 1,
              cursor: lockout.isLocked || isVerifying ? 'not-allowed' : 'pointer'
            }}
          >
            {num}
          </button>
        ))}

        {/* Action Keys */}
        <div style={styles.keyButtonAction} />

        <button
          onClick={() => handleKeyPress('0')}
          className="pin-btn"
          disabled={lockout.isLocked || isVerifying}
          style={{
            ...styles.keyButton,
            opacity: lockout.isLocked || isVerifying ? 0.4 : 1,
            cursor: lockout.isLocked || isVerifying ? 'not-allowed' : 'pointer'
          }}
        >
          0
        </button>

        <button
          onClick={handleBackspace}
          className="pin-btn"
          disabled={lockout.isLocked || isVerifying}
          style={{
            ...styles.keyButtonAction,
            opacity: lockout.isLocked || isVerifying ? 0.4 : 1,
            cursor: lockout.isLocked || isVerifying ? 'not-allowed' : 'pointer'
          }}
        >
          <DynamicIcon name="Delete" size={24} color="var(--text-primary)" />
        </button>
      </div>

      {/* Footer Info */}
      <div style={styles.footer}>
        <p style={styles.footerText}>Finanlist Premium Secure Storage</p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '40px 24px',
    backgroundColor: 'var(--bg-phone)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '40px',
    textAlign: 'center',
  },
  lockIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  appName: {
    fontSize: '24px',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  dotsContainer: {
    display: 'flex',
    gap: '24px',
    margin: '30px 0',
  },
  dot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  keyboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%',
    maxWidth: '280px',
    marginBottom: '30px',
  },
  keyButton: {
    aspectRatio: '1',
    borderRadius: '50%',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: '24px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    outline: 'none',
  },
  keyButtonAction: {
    aspectRatio: '1',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
  },
  footer: {
    marginBottom: '10px',
  },
  footerText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
};
export default LockScreen;
