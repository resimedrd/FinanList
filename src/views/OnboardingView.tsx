import React, { useState } from 'react';
import { DynamicIcon } from '../components/DynamicIcon';
import { UserProfile } from '../models/types';
import { LocalRepository } from '../repositories/LocalRepository';

export const OnboardingView: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  
  // Registration States
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [currency, setCurrency] = useState<string>('RD$');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [accentColor, setAccentColor] = useState<string>('#8b5cf6'); // Default to moradito bonito
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleNextStep = () => {
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Por favor, introduce tu nombre.');
        return;
      }
      if (!username.trim()) {
        setErrorMsg('Por favor, elige un nombre de usuario.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Por favor, introduce un correo electrónico válido.');
        return;
      }
      setErrorMsg('');
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleFinishRegistration = (useDemoData: boolean = false) => {
    if (!useDemoData && pin.length > 0) {
      if (pin.length !== 4) {
        setErrorMsg('El PIN debe tener exactamente 4 dígitos.');
        return;
      }
      if (pin !== confirmPin) {
        setErrorMsg('Los códigos PIN no coinciden.');
        return;
      }
    }

    if (useDemoData) {
      // Clear localStorage first to make sure init runs clean
      localStorage.clear();
      LocalRepository.seedDemoData(); // This seeds everything
      window.location.reload();
      return;
    }

    // Register empty user from scratch
    localStorage.clear();
    
    const newProfile: UserProfile = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      avatar: '',
      currency,
      language: 'es',
      theme,
      accentColor,
      pinCode: pin || undefined,
      biometricsEnabled: false
    };

    // Save profile and setup empty lists
    localStorage.setItem('finanlist_profile', JSON.stringify(newProfile));
    localStorage.setItem('finanlist_transactions', JSON.stringify([]));
    localStorage.setItem('finanlist_categories', JSON.stringify(LocalRepository.getCategories())); // keep default categories
    localStorage.setItem('finanlist_budgets', JSON.stringify([]));
    localStorage.setItem('finanlist_goals', JSON.stringify([]));
    localStorage.setItem('finanlist_onboarded', 'true');

    // Reload page to re-initialize application context state from storage
    window.location.reload();
  };

  return (
    <div style={styles.container}>
      {/* Top Banner logo */}
      <div style={styles.logoHeader}>
        <div style={styles.logoCircle}>
          <DynamicIcon name="Coins" size={28} color="var(--color-primary)" />
        </div>
        <h1 style={styles.logoText}>Finanlist</h1>
        <p style={styles.logoTagline}>Tu gestor financiero personal premium</p>
      </div>

      <div className="card animate-fade-in" style={styles.formCard}>
        {/* STEP 1: Name and Currency */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <div style={styles.stepHeader}>
              <span style={styles.stepIndicator}>Paso 1 de 3</span>
              <h3>Comencemos con lo básico</h3>
              <p>¿Cómo deberíamos llamarte y qué moneda utilizas?</p>
            </div>

            <div className="input-group">
              <label className="input-label">Tu Nombre</label>
              <input
                type="text"
                placeholder="Ej. Frank Espinal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Nombre de Usuario (Para ingresar)</label>
              <input
                type="text"
                placeholder="Ej. frankespinal"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Correo Electrónico</label>
              <input
                type="email"
                placeholder="Ej. frank@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Moneda Principal</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input-field"
              >
                <option value="RD$">Peso Dominicano (RD$)</option>
                <option value="$">Dólar ($)</option>
                <option value="€">Euro (€)</option>
                <option value="COL$">Peso Colombiano (COL$)</option>
                <option value="MXN$">Peso Mexicano (MXN$)</option>
                <option value="S/">Sol Peruano (S/)</option>
              </select>
            </div>

            {errorMsg && <p style={styles.errorText}>{errorMsg}</p>}

            <button className="btn btn-primary" onClick={handleNextStep}>
              Siguiente
            </button>
          </div>
        )}

        {/* STEP 2: Theme and Accent Color */}
        {step === 2 && (
          <div style={styles.stepContent}>
            <div style={styles.stepHeader}>
              <span style={styles.stepIndicator}>Paso 2 de 3</span>
              <h3>Personaliza tu estilo</h3>
              <p>Elige tu tema visual y tu color de acento favorito.</p>
            </div>

            <div className="input-group">
              <label className="input-label">Tema Visual</label>
              <div style={styles.segmentControl}>
                {['light', 'dark', 'system'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t as any)}
                    style={{
                      ...styles.segmentBtn,
                      backgroundColor: theme === t ? 'var(--bg-phone)' : 'transparent',
                      color: theme === t ? 'var(--color-primary)' : 'var(--text-secondary)',
                      fontWeight: theme === t ? '700' : '500',
                    }}
                  >
                    {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Sistema'}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Color de Énfasis</label>
              <div style={styles.colorsGrid}>
                {[
                  { name: 'Índigo', value: '#6366f1' },
                  { name: 'Esmeralda', value: '#10b981' },
                  { name: 'Ámbar', value: '#f59e0b' },
                  { name: 'Carmesí', value: '#ef4444' },
                  { name: 'Turquesa', value: '#06b6d4' },
                  { name: 'Rosa Violeta', value: '#ec4899' },
                ].map(color => (
                  <button
                    key={color.value}
                    onClick={() => setAccentColor(color.value)}
                    style={{
                      ...styles.colorBtn,
                      backgroundColor: color.value,
                      outline: accentColor === color.value ? `3px solid var(--text-primary)` : 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                Atrás
              </button>
              <button className="btn btn-primary" onClick={handleNextStep} style={{ flex: 1 }}>
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Security PIN Setup */}
        {step === 3 && (
          <div style={styles.stepContent}>
            <div style={styles.stepHeader}>
              <span style={styles.stepIndicator}>Paso 3 de 3</span>
              <h3>Seguridad de Acceso</h3>
              <p>Introduce un PIN de 4 dígitos para proteger tu información. Si no deseas PIN, puedes dejarlo en blanco.</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">PIN (4 dígitos)</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d*"
                  inputMode="numeric"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="input-field"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '18px' }}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Confirmar PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d*"
                  inputMode="numeric"
                  placeholder="PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="input-field"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '18px' }}
                />
              </div>
            </div>

            {errorMsg && <p style={styles.errorText}>{errorMsg}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <button className="btn btn-primary" onClick={() => handleFinishRegistration(false)}>
                {pin ? 'Guardar y Finalizar' : 'Finalizar sin PIN'}
              </button>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                Atrás
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Demo Seed Shortcut */}
      <div style={styles.demoShortcut}>
        <p style={styles.demoText}>¿Deseas probar la app antes?</p>
        <button
          className="btn btn-secondary"
          onClick={() => handleFinishRegistration(true)}
          style={styles.demoBtn}
        >
          <DynamicIcon name="Sparkles" size={14} color="var(--color-primary)" />
          <span>Comenzar con Datos Demo</span>
        </button>
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
    overflowY: 'auto',
  },
  logoHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginTop: '20px',
  },
  logoCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '18px',
    backgroundColor: 'var(--color-primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    border: '1px solid var(--border-color)',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    letterSpacing: '-0.5px',
  },
  logoTagline: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  formCard: {
    width: '100%',
    maxWidth: '350px',
    margin: '30px 0',
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  stepHeader: {
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '8px',
  },
  stepIndicator: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--color-primary)',
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: '12px',
    color: 'var(--color-danger)',
    fontWeight: '600',
    textAlign: 'center',
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
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  colorsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '8px',
  },
  colorBtn: {
    aspectRatio: '1',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
  },
  demoShortcut: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  demoText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  demoBtn: {
    padding: '8px 16px',
    fontSize: '11px',
    width: 'auto',
    borderRadius: '20px',
  },
};
export default OnboardingView;
