import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from '../components/DynamicIcon';

export const OnboardingView: React.FC = () => {
  const { signUp, signIn, updateProfile } = useApp();
  const [isLoginMode, setIsLoginMode] = useState<boolean>(false);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Registration States
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [currency, setCurrency] = useState<string>('RD$');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [accentColor, setAccentColor] = useState<string>('#8b5cf6'); // Default to moradito bonito
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Login States
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

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

  const handleFinishRegistration = async () => {
    if (!password || password.length < 6) {
      setErrorMsg('La contraseña de la nube debe tener al menos 6 caracteres.');
      return;
    }

    if (pin.length > 0) {
      if (pin.length !== 4) {
        setErrorMsg('El PIN de bloqueo rápido debe tener exactamente 4 dígitos.');
        return;
      }
      if (pin !== confirmPin) {
        setErrorMsg('Los códigos PIN de confirmación no coinciden.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Create account on Supabase
      await signUp(email.trim(), password, name.trim(), username.trim());
      
      // 2. Set profile custom preferences
      await updateProfile({
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
      });

      // 3. Reload page to initialize home
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al crear la cuenta. Verifica que los datos sean correctos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Por favor, completa todos los campos.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      await signIn(loginEmail.trim(), loginPassword);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Credenciales incorrectas o problema de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.logoHeader}>
        <div style={styles.logoCircle}>
          <DynamicIcon name="PiggyBank" size={28} color="var(--color-primary)" />
        </div>
        <h1 style={styles.logoText}>FinanList</h1>
        <span style={styles.logoTagline}>Tu asistente financiero en la nube</span>
      </div>

      <div className="card" style={styles.formCard}>
        {isLoginMode ? (
          /* --- LOGIN FORM --- */
          <div style={styles.stepContent}>
            <div style={styles.stepHeader}>
              <span style={styles.stepIndicator}>Iniciar Sesión</span>
              <h3>Bienvenido de nuevo</h3>
              <p>Introduce tus credenciales para sincronizar tu cuenta.</p>
            </div>

            <div className="input-group">
              <label className="input-label">Correo Electrónico</label>
              <input
                type="email"
                placeholder="Ej. usuario@ejemplo.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Contraseña</label>
              <input
                type="password"
                placeholder="Tu contraseña de inicio de sesión"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="input-field"
              />
            </div>

            {errorMsg && <p style={styles.errorText}>{errorMsg}</p>}

            <button 
              className="btn btn-primary" 
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando Sesión...' : 'Entrar'}
            </button>

            <button 
              className="btn btn-ghost" 
              onClick={() => {
                setIsLoginMode(false);
                setErrorMsg('');
                setStep(1);
              }}
              style={{ fontSize: '12px', marginTop: '4px' }}
            >
              No tengo cuenta, Registrarme
            </button>
          </div>
        ) : (
          /* --- SIGNUP FLOW --- */
          <>
            {/* STEP 1: Basic Info */}
            {step === 1 && (
              <div style={styles.stepContent}>
                <div style={styles.stepHeader}>
                  <span style={styles.stepIndicator}>Paso 1 de 3</span>
                  <h3>Comencemos con lo básico</h3>
                  <p>¿Cómo deberíamos llamarte y cuál es tu correo?</p>
                </div>

                <div className="input-group">
                  <label className="input-label">Tu Nombre</label>
                  <input
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Nombre de Usuario (Único)</label>
                  <input
                    type="text"
                    placeholder="Ej. juanperez"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="Ej. juan@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                  />
                </div>

                {errorMsg && <p style={styles.errorText}>{errorMsg}</p>}

                <button className="btn btn-primary" onClick={handleNextStep}>
                  Siguiente
                </button>

                <button 
                  className="btn btn-ghost" 
                  onClick={() => {
                    setIsLoginMode(true);
                    setErrorMsg('');
                  }}
                  style={{ fontSize: '12px', marginTop: '4px' }}
                >
                  Ya tengo cuenta, Iniciar Sesión
                </button>
              </div>
            )}

            {/* STEP 2: Theme and Preferences */}
            {step === 2 && (
              <div style={styles.stepContent}>
                <div style={styles.stepHeader}>
                  <span style={styles.stepIndicator}>Paso 2 de 3</span>
                  <h3>Personaliza tu estilo</h3>
                  <p>Elige tu moneda y tu color de acento favorito.</p>
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

                <div className="input-group">
                  <label className="input-label">Tema Visual</label>
                  <div style={styles.segmentControl}>
                    {['light', 'dark', 'system'].map(t => (
                      <button
                        key={t}
                        type="button"
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
                      { name: 'Morado', value: '#8b5cf6' },
                      { name: 'Índigo', value: '#6366f1' },
                      { name: 'Esmeralda', value: '#10b981' },
                      { name: 'Ámbar', value: '#f59e0b' },
                      { name: 'Carmesí', value: '#ef4444' },
                      { name: 'Turquesa', value: '#06b6d4' },
                    ].map(color => (
                      <button
                        key={color.value}
                        type="button"
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

            {/* STEP 3: Cloud Password and Quick PIN */}
            {step === 3 && (
              <div style={styles.stepContent}>
                <div style={styles.stepHeader}>
                  <span style={styles.stepIndicator}>Paso 3 de 3</span>
                  <h3>Contraseñas y Acceso</h3>
                  <p>Crea tu clave en la nube y configura un PIN de desbloqueo rápido (opcional).</p>
                </div>

                <div className="input-group">
                  <label className="input-label">Contraseña (Mín. 6 caracteres)</label>
                  <input
                    type="password"
                    placeholder="Contraseña para iniciar sesión"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label className="input-label">PIN Rápido (4 dígitos)</label>
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
                  <button 
                    className="btn btn-primary" 
                    onClick={handleFinishRegistration}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Registrando...' : (pin ? 'Crear Cuenta y Finalizar' : 'Finalizar sin PIN')}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setStep(2)}>
                    Atrás
                  </button>
                </div>
              </div>
            )}
          </>
        )}
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
    justifyContent: 'center',
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
};

export default OnboardingView;
