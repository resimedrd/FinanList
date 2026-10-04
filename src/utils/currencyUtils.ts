/**
 * Utilidades monetarias seguras para FinanList.
 * 
 * Evitan errores de precisión de coma flotante IEEE 754 (ej. 0.1 + 0.2 = 0.30000000000000004)
 * garantizando cálculos exactos redondeados al centavo.
 */

/**
 * Redondea un importe monetario exactamente a 2 decimales.
 */
export function roundCurrency(val: number): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Suma valores monetarios de forma segura (admite dos números o un arreglo de números).
 */
export function safeSum(a: number | number[], b?: number): number {
  if (Array.isArray(a)) {
    return roundCurrency(a.reduce((acc, curr) => acc + (isNaN(curr) ? 0 : curr), 0));
  }
  return roundCurrency(roundCurrency(a) + roundCurrency(b ?? 0));
}

/**
 * Resta dos valores monetarios de forma segura.
 */
export function safeSubtract(a: number, b: number): number {
  return roundCurrency(roundCurrency(a) - roundCurrency(b));
}

/**
 * Multiplica un importe monetario por un factor y redondea al centavo.
 */
export function safeMultiply(amount: number, factor: number): number {
  return roundCurrency(amount * factor);
}

/**
 * Formatea un valor monetario respetando el modo stealth.
 */
export function formatCurrencyDisplay(
  amount: number,
  currency: string = 'RD$',
  stealthMode: boolean = false
): string {
  if (stealthMode) {
    return `${currency} ••••`;
  }
  const rounded = roundCurrency(amount);
  return `${currency}${rounded.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
