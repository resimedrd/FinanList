import React, { useState, useEffect } from 'react';
import { DynamicIcon } from './DynamicIcon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect if running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) return;

    // 2. Detect iOS environment
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    // 3. Listen for Chrome/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user dismissed it recently (in the last 24h)
      const dismissedTime = localStorage.getItem('finanlist_pwa_dismissed');
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for custom trigger from ProfileView or other components
    const handleCustomTrigger = () => {
      if (checkStandalone()) {
        alert('¡FinanList ya está instalada en tu dispositivo!');
        return;
      }
      if (isIosDevice) {
        setShowIOSModal(true);
      } else if (deferredPrompt) {
        deferredPrompt.prompt().then(() => {
          deferredPrompt.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
              setShowBanner(false);
              setDeferredPrompt(null);
            }
          });
        });
      } else {
        setShowIOSModal(true); // Fallback instructions
      }
    };

    window.addEventListener('trigger-pwa-install', handleCustomTrigger);

    // On iOS Safari, show prompt banner if not installed and not dismissed recently
    if (isIosDevice && !checkStandalone()) {
      const dismissedTime = localStorage.getItem('finanlist_pwa_dismissed');
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('trigger-pwa-install', handleCustomTrigger);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      setShowIOSModal(true);
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('finanlist_pwa_dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Floating Installation Banner */}
      {showBanner && (
        <aside 
          aria-label="Aviso de instalación"
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '16px',
            right: '16px',
            zIndex: 999,
            backgroundColor: 'rgba(18, 18, 24, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(139, 92, 246, 0.2)',
            animation: 'fadeInUp 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            <img 
              src="/icons/icon-192x192.png" 
              alt="FinanList" 
              style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0 }}
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Instalar FinanList
              </div>
              <div style={{ fontSize: '11px', color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Úsala como app en tu pantalla
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={handleInstallClick}
              style={{
                backgroundColor: 'var(--color-primary, #8b5cf6)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <DynamicIcon name="Download" size={14} color="#ffffff" />
              <span>Instalar</span>
            </button>

            <button
              onClick={handleDismiss}
              aria-label="Cerrar aviso de instalación"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <DynamicIcon name="X" size={16} />
            </button>
          </div>
        </aside>
      )}

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setShowIOSModal(false)}
        >
          <div
            style={{
              backgroundColor: '#121215',
              border: '1px solid #27272a',
              borderRadius: '24px',
              padding: '24px',
              maxWidth: '380px',
              width: '100%',
              color: '#f4f4f5',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/icons/icon-192x192.png" alt="FinanList" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Instalar en tu Dispositivo</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '4px' }}
              >
                <DynamicIcon name="X" size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5, marginBottom: '20px' }}>
              Sigue estos sencillos pasos para tener FinanList como una aplicación nativa en tu pantalla de inicio:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#1c1c22', padding: '12px', borderRadius: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#fff', flexShrink: 0 }}>
                  1
                </div>
                <div style={{ fontSize: '13px' }}>
                  Toca el botón <strong>Compartir</strong> en la barra de tu navegador <span style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}><DynamicIcon name="Share" size={16} color="var(--color-primary, #8b5cf6)" /></span>.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#1c1c22', padding: '12px', borderRadius: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#fff', flexShrink: 0 }}>
                  2
                </div>
                <div style={{ fontSize: '13px' }}>
                  Desplázate hacia abajo y selecciona <strong>"Agregar a pantalla de inicio"</strong> <span style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}><DynamicIcon name="PlusSquare" size={16} color="var(--color-primary, #8b5cf6)" /></span>.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#1c1c22', padding: '12px', borderRadius: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#fff', flexShrink: 0 }}>
                  3
                </div>
                <div style={{ fontSize: '13px' }}>
                  Presiona <strong>"Agregar"</strong> en la esquina superior derecha.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: '600' }}
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPrompt;
