/**
 * Utilidades seguras para fechas en FinanList.
 * 
 * Evitan desfases causados por el estándar ECMAScript que interpreta cadenas
 * con solo fecha "YYYY-MM-DD" como UTC medianoche (00:00:00Z), lo que en zonas
 * horarias negativas (ej. República Dominicana UTC-4) retrocede la fecha al día anterior.
 */

export interface LocalDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * Descompone una cadena "YYYY-MM-DD" en sus partes numéricas locales exactas.
 */
export function parseLocalDate(dateStr: string): LocalDateParts {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };
  }

  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
    }
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  };
}

/**
 * Crea un objeto Date fijado al mediodía local (12:00:00), completamente inmune
 * a saltos de fecha por cambios de zona horaria o ajustes de verano/invierno.
 */
export function createLocalDate(dateStr: string): Date {
  const { year, month, day } = parseLocalDate(dateStr);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Formatea un objeto Date a formato ISO de calendario local "YYYY-MM-DD".
 */
export function formatLocalDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Obtiene la fecha actual en formato "YYYY-MM-DD" en la hora local del usuario.
 */
export function getTodayDateString(): string {
  return formatLocalDateISO(new Date());
}

/**
 * Retorna la cantidad exacta de días que tiene un mes determinado (28, 29, 30 o 31).
 * @param year Año (ej. 2026)
 * @param month Mes 1-indexed (1 para Enero, 12 para Diciembre)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Retorna el nombre en español del mes correspondiente.
 * @param month Mes 1-indexed (1-12)
 */
export function getMonthName(month: number, format: 'long' | 'short' = 'long'): string {
  const d = new Date(2026, month - 1, 15);
  const name = d.toLocaleString('es-ES', { month: format });
  return name.charAt(0).toUpperCase() + name.slice(1);
}
