import React, { useState } from 'react';
import { DynamicIcon } from './DynamicIcon';

interface WelcomeTourProps {
  onClose: () => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: '¡Bienvenido a FinanList! 🏦✨',
      subtitle: 'Tu centro financiero inteligente',
      description: 'Controla tus ingresos, gastos, deudas y metas de ahorro en un solo lugar seguro y sincronizado en la nube.',
      icon: 'Wallet',
      color: '#6366f1',
    },
    {
      title: 'Presupuestos y Ciclos Reseteables 📊🔄',
      subtitle: 'Límites a tu manera',
      description: 'Establece presupuestos generales o por categorías, y reinicia el ciclo de consumo cuando consideres oportuno con un solo botón.',
      icon: 'RefreshCw',
      color: '#22c55e',
    },
    {
      title: 'Registro Rápido e Inteligente ⚡💳',
      subtitle: 'Sencillo y sin fricción',
      description: 'Usa el Gasto Rápido y selecciona tu cuenta (Efectivo, Tarjeta, Banco, Broker) tocando los botones visuales. ¡Sin escribir nada!',
      icon: 'Zap',
      color: '#ffaa00',
    },
    {
      title: 'Privacidad y Seguridad 🔒👁️',
      subtitle: 'Tus datos siempre a salvo',
      description: 'Bloqueo automático tras 30 segundos en segundo plano. Activa el Modo Incógnito para ocultar tus montos en público con un toque.',
      icon: 'Shield',
      color: '#ef4444',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <div className="modal-overlay open" style={{ zIndex: 3000 }}>
      <div 
        className="modal-sheet" 
        style={{ 
          maxWidth: '460px', 
          width: '90%', 
          padding: '24px', 
          textAlign: 'center',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          margin: 'auto'
        }}
      >
        {/* Progress dots at the top */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {slides.map((_, idx) => (
            <div 
              key={idx}
              style={{
                width: currentSlide === idx ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: currentSlide === idx ? 'var(--color-primary)' : 'var(--text-muted)',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* Big Animated Icon */}
        <div 
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '24px',
            backgroundColor: `${slide.color}15`,
            color: slide.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px',
            boxShadow: `0 8px 16px -4px ${slide.color}20`
          }}
        >
          <DynamicIcon name={slide.icon} size={40} color={slide.color} />
        </div>

        {/* Typography */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            {slide.title}
          </h2>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {slide.subtitle}
          </span>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '8px 0 0 0' }}>
            {slide.description}
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '10px' }}>
          {currentSlide > 0 ? (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handlePrev}
              style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: '600' }}
            >
              Atrás
            </button>
          ) : (
            <button 
              type="button" 
              className="btn btn-ghost" 
              onClick={onClose}
              style={{ flex: 1, padding: '12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}
            >
              Omitir
            </button>
          )}

          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleNext}
            style={{ flex: 2, padding: '12px', fontSize: '13px', fontWeight: '600' }}
          >
            {currentSlide === slides.length - 1 ? '¡Comenzar ya!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
};
