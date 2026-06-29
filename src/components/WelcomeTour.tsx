import React, { useState, useEffect } from 'react';
import { DynamicIcon } from './DynamicIcon';

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  tab: 'home' | 'history' | 'budget' | 'stats' | 'profile';
  placement: 'top' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '.bottom-nav button:nth-child(1)',
    title: 'Resumen Financiero 🏠',
    description: 'En esta pestaña de Inicio verás tu dinero disponible en efectivo y tarjetas, tu distribución de gastos y tu salud financiera semanal.',
    tab: 'home',
    placement: 'top'
  },
  {
    targetSelector: '.fab-button',
    title: 'Registrar Movimientos ⚡',
    description: 'Toca el botón central "+" para agregar ingresos o gastos. Podrás seleccionar cuentas como Tarjeta o Efectivo con un solo toque y sin escribir.',
    tab: 'home',
    placement: 'top'
  },
  {
    targetSelector: '.bottom-nav button:nth-child(4)',
    title: 'Presupuestos y Planificación 📊',
    description: 'Aquí defines tus límites de gasto. Al final del mes o cuando cobres, toca "Reiniciar Ciclos" para empezar desde cero conservando tu historial.',
    tab: 'budget',
    placement: 'top'
  },
  {
    targetSelector: 'button[title*="montos"]',
    title: 'Modo Incógnito 🔒',
    description: 'Toca este icono de ojo en el encabezado para ocultar tus montos rápidamente cuando estés usando la aplicación en público.',
    tab: 'home',
    placement: 'bottom'
  }
];

interface WelcomeTourProps {
  setActiveTab: (tab: 'home' | 'history' | 'budget' | 'stats' | 'profile') => void;
  onClose: () => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ setActiveTab, onClose }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const currentStep = TOUR_STEPS[stepIdx];

  // Recalculate spotlight coordinates based on selector
  const updateCoords = () => {
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      });
    } else {
      setCoords(null);
    }
  };

  // Change tab when step changes and wait for render
  useEffect(() => {
    setActiveTab(currentStep.tab);
    
    // Delay coordination fetch slightly so the view has time to swap and mount
    const timer = setTimeout(() => {
      updateCoords();
    }, 150);

    return () => clearTimeout(timer);
  }, [stepIdx]);

  // Recalculate on window resize
  useEffect(() => {
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [stepIdx]);

  const handleNext = () => {
    if (stepIdx < TOUR_STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99999, pointerEvents: 'none' }}>
      {/* Dimmed backdrop overlay */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'rgba(0, 0, 0, 0.4)', 
        pointerEvents: 'auto',
        zIndex: 99998
      }} />

      {/* Spotlight cutout border */}
      {coords && (
        <div style={{
          position: 'absolute',
          top: coords.top - 4,
          left: coords.left - 4,
          width: coords.width + 8,
          height: coords.height + 8,
          borderRadius: coords.width > 70 ? '20px' : '50%',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 0 3px var(--color-primary)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 99999,
          pointerEvents: 'none'
        }} />
      )}

      {/* Tooltip bubble popover */}
      {coords && (
        <div style={{
          position: 'absolute',
          top: currentStep.placement === 'top' ? coords.top - 12 : coords.top + coords.height + 12,
          left: Math.max(16, Math.min(window.innerWidth - 300, coords.left + coords.width / 2 - 140)),
          width: '280px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 100000,
          pointerEvents: 'auto',
          transform: currentStep.placement === 'top' ? 'translateY(-100%)' : 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'scaleIn 0.2s ease-out'
        }}>
          {/* Header step info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
              Paso {stepIdx + 1} de {TOUR_STEPS.length}
            </span>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              title="Omitir"
            >
              <DynamicIcon name="X" size={14} color="var(--text-muted)" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {currentStep.title}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
              {currentStep.description}
            </p>
          </div>

          {/* Action buttons inside tooltip */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {stepIdx > 0 && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handlePrev}
                style={{ padding: '6px 12px', fontSize: '11px', flex: 1, height: '28px', borderRadius: '8px' }}
              >
                Atrás
              </button>
            )}
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleNext}
              style={{ padding: '6px 12px', fontSize: '11px', flex: 2, height: '28px', borderRadius: '8px' }}
            >
              {stepIdx === TOUR_STEPS.length - 1 ? 'Terminar' : 'Siguiente'}
            </button>
          </div>
        </div>
      )}

      {/* CSS Injection for scaleIn animation */}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
