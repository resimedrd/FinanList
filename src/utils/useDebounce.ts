import { useState, useEffect } from 'react';

/**
 * Hook para retrasar la actualización de un valor hasta que haya transcurrido
 * un tiempo de espera (delay en ms) desde la última vez que cambió.
 * Ideal para optimizar búsquedas, filtros intensivos y autocompletados.
 */
export function useDebounce<T>(value: T, delayMs: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
