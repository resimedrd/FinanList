import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryDetector, normalizeConcept } from '../CategoryDetector';
import { Category } from '../../models/types';

// Mock localStorage in Node
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

const TEST_CATEGORIES: Category[] = [
  { id: 'cat_food_super', name: 'Comida', color: '#ff4d4d', icon: 'ShoppingBasket' },
  { id: 'cat_food_out', name: 'Restaurante y pedidos', color: '#ff9f43', icon: 'Utensils' },
  { id: 'cat_trans', name: 'Transporte', color: '#3399ff', icon: 'Car' },
  { id: 'cat_fun', name: 'Entretenimiento', color: '#b366ff', icon: 'Tv' },
  { id: 'cat_shop', name: 'Compras', color: '#ff66b2', icon: 'ShoppingBag' },
  { id: 'cat_bills', name: 'Servicios', color: '#ffcc00', icon: 'Zap' },
  { id: 'cat_health', name: 'Salud', color: '#22c55e', icon: 'HeartPulse' },
  { id: 'cat_personal', name: 'Cuidado Personal', color: '#ec4899', icon: 'Sparkles' },
  { id: 'cat_saving', name: 'Ahorro', color: '#2ecc71', icon: 'Target' }
];

describe('CategoryDetector Engine', () => {
  beforeEach(() => {
    CategoryDetector.clearMemory();
  });

  describe('normalizeConcept', () => {
    it('normalizes uppercase, accents and punctuation properly', () => {
      expect(normalizeConcept('¡Cenaduría Don Pícho, S.R.L.!'))
        .toBe('cenaduria don picho s r l');
      expect(normalizeConcept('PLAZA LAMA - LUPERÓN'))
        .toBe('plaza lama luperon');
      expect(normalizeConcept('Uñas & Salón de Belleza'))
        .toBe('unas salon de belleza');
    });
  });

  describe('Dominican Dictionary Categorization', () => {
    it('separates explicitly Restaurante from Supermercado y Colmado', () => {
      // Restaurante y Pedidos
      const picaPollo = CategoryDetector.detect('Pica pollo con tostones y frito', TEST_CATEGORIES);
      expect(picaPollo?.categoryId).toBe('cat_food_out');
      expect(picaPollo?.source).toBe('dictionary');

      const cenaduria = CategoryDetector.detect('Cenaduria Don Pepe', TEST_CATEGORIES);
      expect(cenaduria?.categoryId).toBe('cat_food_out');

      const pedidosYa = CategoryDetector.detect('Almuerzo en PedidosYa delivery', TEST_CATEGORIES);
      expect(pedidosYa?.categoryId).toBe('cat_food_out');

      const mcdonalds = CategoryDetector.detect('McDonalds combo cuarto de libra', TEST_CATEGORIES);
      expect(mcdonalds?.categoryId).toBe('cat_food_out');

      // Supermercado y Colmado
      const sirena = CategoryDetector.detect('Compras en La Sirena Churchill', TEST_CATEGORIES);
      expect(sirena?.categoryId).toBe('cat_food_super');

      const colmado = CategoryDetector.detect('Colmado Don Manuel viveres y leche', TEST_CATEGORIES);
      expect(colmado?.categoryId).toBe('cat_food_super');

      const bravo = CategoryDetector.detect('Supermercado Bravo carnes y lacteos', TEST_CATEGORIES);
      expect(bravo?.categoryId).toBe('cat_food_super');

      const plazaLama = CategoryDetector.detect('Plaza Lama despensa', TEST_CATEGORIES);
      expect(plazaLama?.categoryId).toBe('cat_food_super');

      const jumbo = CategoryDetector.detect('Jumbo Luperon provisiones', TEST_CATEGORIES);
      expect(jumbo?.categoryId).toBe('cat_food_super');
    });

    it('disambiguates Uber Eats (Restaurante) vs Uber (Transporte) via token weighting', () => {
      // "Uber Eats" has weight 10 in cat_food_out, should beat single "Uber" in cat_trans
      const uberEats = CategoryDetector.detect('Uber Eats hamburguesa', TEST_CATEGORIES);
      expect(uberEats?.categoryId).toBe('cat_food_out');

      // Standard Uber should match Transporte
      const uberRide = CategoryDetector.detect('Uber al trabajo', TEST_CATEGORIES);
      expect(uberRide?.categoryId).toBe('cat_trans');
    });

    it('correctly detects Cuidado Personal terms', () => {
      const barberia = CategoryDetector.detect('Barberia corte de pelo y barba', TEST_CATEGORIES);
      expect(barberia?.categoryId).toBe('cat_personal');

      const salon = CategoryDetector.detect('Salon de belleza tinte y unas', TEST_CATEGORIES);
      expect(salon?.categoryId).toBe('cat_personal');

      const peluqueria = CategoryDetector.detect('Peluqueria blower y keratina', TEST_CATEGORIES);
      expect(peluqueria?.categoryId).toBe('cat_personal');
    });

    it('correctly detects Dominican Utilities / Servicios', () => {
      const edesur = CategoryDetector.detect('Factura de luz Edesur Dominicana', TEST_CATEGORIES);
      expect(edesur?.categoryId).toBe('cat_bills');

      const claro = CategoryDetector.detect('Internet Claro y telefono', TEST_CATEGORIES);
      expect(claro?.categoryId).toBe('cat_bills');

      const caasd = CategoryDetector.detect('Pago servicio CAASD agua', TEST_CATEGORIES);
      expect(caasd?.categoryId).toBe('cat_bills');

      const netflix = CategoryDetector.detect('Suscripcion Netflix streaming', TEST_CATEGORIES);
      expect(netflix?.categoryId).toBe('cat_bills');
    });

    it('correctly detects Dominican Transportation terms', () => {
      const gasolina = CategoryDetector.detect('Gasolina Premium TotalEnergies', TEST_CATEGORIES);
      expect(gasolina?.categoryId).toBe('cat_trans');

      const peaje = CategoryDetector.detect('Peaje Las Americas', TEST_CATEGORIES);
      expect(peaje?.categoryId).toBe('cat_trans');

      const carroPublico = CategoryDetector.detect('Pasaje concho carro publico', TEST_CATEGORIES);
      expect(carroPublico?.categoryId).toBe('cat_trans');
    });

    it('returns null for unclassifiable or very short concepts', () => {
      expect(CategoryDetector.detect('', TEST_CATEGORIES)).toBeNull();
      expect(CategoryDetector.detect('x', TEST_CATEGORIES)).toBeNull();
      expect(CategoryDetector.detect('cosa aleatoria xyz 123', TEST_CATEGORIES)).toBeNull();
    });
  });

  describe('User Memory & Self-Learning Cache', () => {
    it('learns user associations and prioritizes them over default dictionary', () => {
      // 1. Initial unknown merchant
      const concept = 'Ferreteria El Clavo Dorado';
      expect(CategoryDetector.detect(concept, TEST_CATEGORIES)).toBeNull();

      // 2. User manually selects Compras (cat_shop) and learns
      CategoryDetector.learn(concept, 'cat_shop');

      // 3. Subsequent detection recognizes it from user memory with 100% confidence
      const detected = CategoryDetector.detect(concept, TEST_CATEGORIES);
      expect(detected).not.toBeNull();
      expect(detected?.categoryId).toBe('cat_shop');
      expect(detected?.source).toBe('user_memory');
      expect(detected?.confidence).toBe(100);
    });

    it('allows user override of dictionary rules in memory', () => {
      // By default "gasolina" is cat_trans
      const defaultTrans = CategoryDetector.detect('Gasolina generador casa', TEST_CATEGORIES);
      expect(defaultTrans?.categoryId).toBe('cat_trans');

      // User specifies that for them, this is Servicios (cat_bills)
      CategoryDetector.learn('Gasolina generador casa', 'cat_bills');

      const overrideDetected = CategoryDetector.detect('Gasolina generador casa', TEST_CATEGORIES);
      expect(overrideDetected?.categoryId).toBe('cat_bills');
      expect(overrideDetected?.source).toBe('user_memory');
    });
  });
});
