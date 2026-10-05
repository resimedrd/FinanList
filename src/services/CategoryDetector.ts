import { Category } from '../models/types';

/**
 * Resultado estructurado de la detección automática de categoría
 */
export interface CategoryDetectionResult {
  categoryId: string;
  categoryName: string;
  source: 'user_memory' | 'dictionary';
  matchedKeyword?: string;
  confidence: number; // 0 - 100
}

interface RuleToken {
  keyword: string;
  weight: number; // 10 para frases compuestas exactas, 5 para marcas/comercios clave, 2 para términos generales
}

interface CategoryRule {
  targetId: string;
  fallbackNames: string[];
  tokens: RuleToken[];
}

const STORAGE_KEY_MEMORY = 'finanlist_category_memory';

/**
 * Normaliza cualquier texto: convierte a minúsculas, remueve diacríticos/acentos (NFD),
 * elimina signos de puntuación y contrae espacios en blanco.
 * Ejemplo: "¡Cenaduría Don Pícho, S.R.L.!" -> "cenaduria don picho s r l"
 */
export function normalizeConcept(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina tildes y diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')   // Convierte símbolos a espacios
    .replace(/\s+/g, ' ')           // Contrae múltiples espacios
    .trim();
}

/**
 * Diccionario de reglas y ponderación de tokens con enfoque dominicano.
 * Ponderaciones:
 * - Peso 10: Frases multi-palabra exactas o marcas compuestas (e.g. "uber eats", "pica pollo", "plaza lama", "la sirena")
 * - Peso 5: Marcas, comercios y nombres propios altamente específicos (e.g. "pedidosya", "edesur", "colmado", "barberia")
 * - Peso 2: Términos genéricos o comunes (e.g. "comida", "almuerzo", "luz", "gasolina")
 */
const DOMINICAN_RULES: CategoryRule[] = [
  // 1. RESTAURANTE Y PEDIDOS (Comida fuera, delivery, comida rápida)
  {
    targetId: 'cat_food_out',
    fallbackNames: ['restaurante y pedidos', 'restaurante', 'comida fuera'],
    tokens: [
      // Multi-word exactos (peso 10)
      { keyword: 'uber eats', weight: 10 },
      { keyword: 'pica pollo', weight: 10 },
      { keyword: 'burger king', weight: 10 },
      { keyword: 'pizza hut', weight: 10 },
      { keyword: 'papa johns', weight: 10 },
      { keyword: 'taco bell', weight: 10 },
      { keyword: 'barra payan', weight: 10 },
      { keyword: 'helados bon', weight: 10 },
      { keyword: 'comida rapida', weight: 10 },
      { keyword: 'pollo frito', weight: 10 },
      // Marcas y comercios específicos dominicanos (peso 5)
      { keyword: 'mcdonalds', weight: 5 },
      { keyword: 'mcdonald', weight: 5 },
      { keyword: 'wendys', weight: 5 },
      { keyword: 'pedidosya', weight: 5 },
      { keyword: 'cenaduria', weight: 5 },
      { keyword: 'picapollo', weight: 5 },
      { keyword: 'dominos', weight: 5 },
      { keyword: 'kfc', weight: 5 },
      { keyword: 'starbucks', weight: 5 },
      { keyword: 'chimi', weight: 5 },
      { keyword: 'chimichurri', weight: 5 },
      { keyword: 'yaniqueque', weight: 5 },
      { keyword: 'heladeria', weight: 5 },
      { keyword: 'churros', weight: 5 },
      { keyword: 'empanadas', weight: 5 },
      { keyword: 'empanada', weight: 5 },
      { keyword: 'cafeteria', weight: 5 },
      { keyword: 'reposteria', weight: 5 },
      { keyword: 'panaderia', weight: 5 },
      { keyword: 'parrillada', weight: 5 },
      { keyword: 'pizzeria', weight: 5 },
      { keyword: 'taqueria', weight: 5 },
      { keyword: 'sushi', weight: 5 },
      { keyword: 'fondita', weight: 5 },
      { keyword: 'comedor', weight: 5 },
      // Términos generales (peso 2)
      { keyword: 'almuerzo', weight: 2 },
      { keyword: 'cena', weight: 2 },
      { keyword: 'desayuno', weight: 2 },
      { keyword: 'restaurante', weight: 2 },
      { keyword: 'delivery', weight: 2 },
      { keyword: 'snack', weight: 2 },
      { keyword: 'buffet', weight: 2 },
      { keyword: 'picadera', weight: 2 },
      { keyword: 'postre', weight: 2 },
      { keyword: 'frito', weight: 2 }
    ]
  },

  // 2. SUPERMERCADO Y COLMADO (Alimentos para el hogar, víveres, provisiones)
  {
    targetId: 'cat_food_super',
    fallbackNames: ['comida', 'supermercado', 'colmado', 'supermercado y colmado'],
    tokens: [
      // Multi-word exactos (peso 10)
      { keyword: 'la sirena', weight: 10 },
      { keyword: 'supermercados nacional', weight: 10 },
      { keyword: 'supermercado nacional', weight: 10 },
      { keyword: 'supermercado bravo', weight: 10 },
      { keyword: 'hiper ole', weight: 10 },
      { keyword: 'plaza lama', weight: 10 },
      { keyword: 'mini market', weight: 10 },
      { keyword: 'comida en casa', weight: 10 },
      // Marcas y comercios específicos dominicanos (peso 5)
      { keyword: 'colmado', weight: 5 },
      { keyword: 'colmadito', weight: 5 },
      { keyword: 'sirena', weight: 5 },
      { keyword: 'bravo', weight: 5 },
      { keyword: 'jumbo', weight: 5 },
      { keyword: 'nacional', weight: 5 },
      { keyword: 'ole', weight: 5 },
      { keyword: 'plazalama', weight: 5 },
      { keyword: 'carrefour', weight: 5 },
      { keyword: 'despensa', weight: 5 },
      { keyword: 'la cadena', weight: 5 },
      { keyword: 'supermercado', weight: 5 },
      { keyword: 'hipermercado', weight: 5 },
      { keyword: 'carniceria', weight: 5 },
      { keyword: 'fruteria', weight: 5 },
      { keyword: 'bodega', weight: 5 },
      { keyword: 'minimarket', weight: 5 },
      { keyword: 'viveres', weight: 5 },
      { keyword: 'provisiones', weight: 5 },
      { keyword: 'almacen', weight: 5 },
      // Términos generales (peso 2)
      { keyword: 'abarrotes', weight: 2 },
      { keyword: 'groceries', weight: 2 },
      { keyword: 'mercado', weight: 2 },
      { keyword: 'carnes', weight: 2 },
      { keyword: 'verduras', weight: 2 },
      { keyword: 'lacteos', weight: 2 }
    ]
  },

  // 3. CUIDADO PERSONAL (Barbería, salón de belleza, estética, spa)
  {
    targetId: 'cat_personal',
    fallbackNames: ['cuidado personal', 'belleza', 'salud'],
    tokens: [
      // Multi-word exactos (peso 10)
      { keyword: 'salon de belleza', weight: 10 },
      { keyword: 'corte de pelo', weight: 10 },
      { keyword: 'corte de cabello', weight: 10 },
      { keyword: 'cuidado personal', weight: 10 },
      // Comercios y servicios específicos (peso 5)
      { keyword: 'peluqueria', weight: 5 },
      { keyword: 'barberia', weight: 5 },
      { keyword: 'barbero', weight: 5 },
      { keyword: 'salon', weight: 5 },
      { keyword: 'estetica', weight: 5 },
      { keyword: 'spa', weight: 5 },
      { keyword: 'pedicura', weight: 5 },
      { keyword: 'manicura', weight: 5 },
      { keyword: 'unas', weight: 5 },
      { keyword: 'maquillaje', weight: 5 },
      { keyword: 'cosmeticos', weight: 5 },
      { keyword: 'depilacion', weight: 5 },
      { keyword: 'blower', weight: 5 },
      { keyword: 'keratina', weight: 5 },
      { keyword: 'afeitado', weight: 5 },
      // Términos generales (peso 2)
      { keyword: 'corte', weight: 2 },
      { keyword: 'tinte', weight: 2 },
      { keyword: 'cejas', weight: 2 },
      { keyword: 'shampoo', weight: 2 },
      { keyword: 'peinado', weight: 2 },
      { keyword: 'barba', weight: 2 }
    ]
  },

  // 4. SERVICIOS Y FACTURAS (Servicios básicos dominicanos, suscripciones)
  {
    targetId: 'cat_bills',
    fallbackNames: ['servicios', 'facturas', 'servicios publicos'],
    tokens: [
      // Multi-word exactos (peso 10)
      { keyword: 'youtube premium', weight: 10 },
      { keyword: 'amazon prime', weight: 10 },
      { keyword: 'hbo max', weight: 10 },
      { keyword: 'gas propano', weight: 10 },
      { keyword: 'mantenimiento apto', weight: 10 },
      // Empresas de servicios dominicanas y globales (peso 5)
      { keyword: 'edesur', weight: 5 },
      { keyword: 'edenorte', weight: 5 },
      { keyword: 'edeeste', weight: 5 },
      { keyword: 'claro', weight: 5 },
      { keyword: 'altice', weight: 5 },
      { keyword: 'caasd', weight: 5 },
      { keyword: 'coraasan', weight: 5 },
      { keyword: 'netflix', weight: 5 },
      { keyword: 'spotify', weight: 5 },
      { keyword: 'aster', weight: 5 },
      { keyword: 'telecable', weight: 5 },
      { keyword: 'electricidad', weight: 5 },
      { keyword: 'condominio', weight: 5 },
      { keyword: 'chatgpt', weight: 5 },
      { keyword: 'icloud', weight: 5 },
      // Términos generales (peso 2)
      { keyword: 'luz', weight: 2 },
      { keyword: 'agua', weight: 2 },
      { keyword: 'internet', weight: 2 },
      { keyword: 'cable', weight: 2 },
      { keyword: 'telefono', weight: 2 },
      { keyword: 'basura', weight: 2 },
      { keyword: 'factura', weight: 2 },
      { keyword: 'recarga', weight: 2 },
      { keyword: 'streaming', weight: 2 }
    ]
  },

  // 5. TRANSPORTE (Transporte urbano dominicano, combustible, peaje)
  {
    targetId: 'cat_trans',
    fallbackNames: ['transporte', 'vehiculo', 'combustible'],
    tokens: [
      // Multi-word exactos (peso 10)
      { keyword: 'carro publico', weight: 10 },
      { keyword: 'cambio de aceite', weight: 10 },
      { keyword: 'car wash', weight: 10 },
      { keyword: 'carwash', weight: 10 },
      // Marcas y términos específicos dominicanos (peso 5)
      { keyword: 'indriver', weight: 5 },
      { keyword: 'didi', weight: 5 },
      { keyword: 'gasolina', weight: 5 },
      { keyword: 'combustible', weight: 5 },
      { keyword: 'gasoil', weight: 5 },
      { keyword: 'glp', weight: 5 },
      { keyword: 'peaje', weight: 5 },
      { keyword: 'pasaje', weight: 5 },
      { keyword: 'metro', weight: 5 },
      { keyword: 'omsa', weight: 5 },
      { keyword: 'concho', weight: 5 },
      { keyword: 'conchito', weight: 5 },
      { keyword: 'corredor', weight: 5 },
      { keyword: 'parqueo', weight: 5 },
      { keyword: 'estacionamiento', weight: 5 },
      { keyword: 'gomera', weight: 5 },
      { keyword: 'mecanico', weight: 5 },
      { keyword: 'repuesto', weight: 5 },
      // Términos generales (peso 2)
      // Nota: 'uber' solo (sin 'eats') tiene peso 2 para que 'uber eats' (peso 10 en cat_food_out) siempre gane
      { keyword: 'uber', weight: 2 },
      { keyword: 'taxi', weight: 2 },
      { keyword: 'guagua', weight: 2 },
      { keyword: 'gas', weight: 2 },
      { keyword: 'lavado', weight: 2 }
    ]
  },

  // 6. SALUD Y FARMACIA
  {
    targetId: 'cat_health',
    fallbackNames: ['salud', 'farmacia', 'medicina'],
    tokens: [
      // Multi-word exactos (peso 10)
      { keyword: 'farmacia gbc', weight: 10 },
      { keyword: 'farmacia carol', weight: 10 },
      { keyword: 'farmacia carolus', weight: 10 },
      // Comercios y servicios (peso 5)
      { keyword: 'farmacia', weight: 5 },
      { keyword: 'gbc', weight: 5 },
      { keyword: 'carol', weight: 5 },
      { keyword: 'carolus', weight: 5 },
      { keyword: 'amadita', weight: 5 },
      { keyword: 'referencia', weight: 5 },
      { keyword: 'laboratorio', weight: 5 },
      { keyword: 'dentista', weight: 5 },
      { keyword: 'odontologo', weight: 5 },
      { keyword: 'optica', weight: 5 },
      { keyword: 'clinica', weight: 5 },
      { keyword: 'hospital', weight: 5 },
      { keyword: 'doctor', weight: 5 },
      { keyword: 'medico', weight: 5 },
      { keyword: 'medicina', weight: 5 },
      { keyword: 'medicamentos', weight: 5 },
      // Términos generales (peso 2)
      { keyword: 'pastillas', weight: 2 },
      { keyword: 'consulta', weight: 2 },
      { keyword: 'analisis', weight: 2 },
      { keyword: 'lentes', weight: 2 }
    ]
  },

  // 7. ENTRETENIMIENTO
  {
    targetId: 'cat_fun',
    fallbackNames: ['entretenimiento', 'ocio', 'diversion'],
    tokens: [
      { keyword: 'caribbean cinemas', weight: 10 },
      { keyword: 'palacio del cine', weight: 10 },
      { keyword: 'cine', weight: 5 },
      { keyword: 'concierto', weight: 5 },
      { keyword: 'discoteca', weight: 5 },
      { keyword: 'playstation', weight: 5 },
      { keyword: 'steam', weight: 5 },
      { keyword: 'resort', weight: 5 },
      { keyword: 'karaoke', weight: 5 },
      { keyword: 'billar', weight: 5 },
      { keyword: 'cerveza', weight: 2 },
      { keyword: 'cervezas', weight: 2 },
      { keyword: 'presidente', weight: 2 },
      { keyword: 'trago', weight: 2 },
      { keyword: 'bar', weight: 2 },
      { keyword: 'boletas', weight: 2 }
    ]
  },

  // 8. COMPRAS / SHOPPING
  {
    targetId: 'cat_shop',
    fallbackNames: ['compras', 'tiendas', 'ropa'],
    tokens: [
      { keyword: 'pull and bear', weight: 10 },
      { keyword: 'blue mall', weight: 10 },
      { keyword: 'agora mall', weight: 10 },
      { keyword: 'galeria 360', weight: 10 },
      { keyword: 'zara', weight: 5 },
      { keyword: 'bershka', weight: 5 },
      { keyword: 'amazon', weight: 5 },
      { keyword: 'shein', weight: 5 },
      { keyword: 'temu', weight: 5 },
      { keyword: 'ebay', weight: 5 },
      { keyword: 'sambil', weight: 5 },
      { keyword: 'agora', weight: 5 },
      { keyword: 'tienda', weight: 2 },
      { keyword: 'ropa', weight: 2 },
      { keyword: 'zapatos', weight: 2 },
      { keyword: 'tenis', weight: 2 },
      { keyword: 'mall', weight: 2 }
    ]
  }
];

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

export class CategoryDetector {
  /**
   * Obtiene el diccionario de memoria aprendido por el usuario desde localStorage.
   */
  static getMemory(): Record<string, string> {
    try {
      const storage = getStorage();
      if (!storage) return {};
      const data = storage.getItem(STORAGE_KEY_MEMORY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Error reading category memory:', e);
      return {};
    }
  }

  /**
   * Guarda o actualiza una asociación aprendida entre concepto y categoryId.
   * Guarda la frase normalizada completa y también las palabras clave principales.
   */
  static learn(concept: string, categoryId: string): void {
    const normalized = normalizeConcept(concept);
    if (!normalized || !categoryId || normalized.length < 2) return;

    try {
      const memory = CategoryDetector.getMemory();
      // Guardar frase completa
      memory[normalized] = categoryId;

      // Si es una frase con comercio o palabra relevante (e.g. "pica pollo el gordito"),
      // también guarda los tokens distintivos principales de más de 3 letras
      const tokens = normalized.split(' ').filter(t => t.length >= 4);
      if (tokens.length > 1 && tokens.length <= 4) {
        // También guardamos el primer bigrama o nombre clave si no es genérico
        const leadingPhrase = tokens.slice(0, 2).join(' ');
        memory[leadingPhrase] = categoryId;
      }

      const storage = getStorage();
      if (storage) {
        storage.setItem(STORAGE_KEY_MEMORY, JSON.stringify(memory));
      }
    } catch (e) {
      console.warn('Error saving category memory:', e);
    }
  }

  /**
   * Limpia toda la memoria de asociaciones aprendidas.
   */
  static clearMemory(): void {
    try {
      const storage = getStorage();
      if (storage) {
        storage.removeItem(STORAGE_KEY_MEMORY);
      }
    } catch (e) {
      console.warn('Error clearing category memory:', e);
    }
  }

  /**
   * Detecta la categoría más adecuada para un concepto o comercio ingresado.
   * 1. Consulta primero la memoria histórica del usuario (Prioridad Máxima).
   * 2. Si no hay memoria, evalúa la ponderación de tokens del diccionario dominicano.
   * 3. Devuelve null si no supera el umbral de confianza mínimo.
   */
  static detect(concept: string, categories: Category[]): CategoryDetectionResult | null {
    const normalized = normalizeConcept(concept);
    if (!normalized || normalized.length < 2) return null;

    // Helper para resolver la categoría en el arreglo del usuario por ID o por nombre alternativo
    const resolveCategory = (targetId: string, fallbackNames: string[] = []): Category | undefined => {
      // 1. Coincidencia por ID directo
      const byId = categories.find(c => c.id === targetId);
      if (byId) return byId;

      // 2. Coincidencia por fallbackNames
      for (const name of fallbackNames) {
        const normalizedFallback = normalizeConcept(name);
        const byName = categories.find(c => normalizeConcept(c.name).includes(normalizedFallback));
        if (byName) return byName;
      }

      // 3. Fallbacks especiales
      if (targetId === 'cat_personal') {
        const personal = categories.find(c => {
          const n = normalizeConcept(c.name);
          return n.includes('cuidado') || n.includes('personal') || n.includes('belleza');
        });
        if (personal) return personal;
      }

      return undefined;
    };

    // =========================================================================
    // ETAPA 1: Memoria de Aprendizaje del Usuario (Prioridad 1)
    // =========================================================================
    const userMemory = CategoryDetector.getMemory();

    // 1.1 Coincidencia exacta en memoria
    if (userMemory[normalized]) {
      const catId = userMemory[normalized];
      const matchedCat = categories.find(c => c.id === catId);
      if (matchedCat) {
        return {
          categoryId: matchedCat.id,
          categoryName: matchedCat.name,
          source: 'user_memory',
          matchedKeyword: normalized,
          confidence: 100
        };
      }
    }

    // 1.2 Coincidencia por frase contenida en memoria (de más larga a más corta)
    const memoryKeys = Object.keys(userMemory).sort((a, b) => b.length - a.length);
    for (const key of memoryKeys) {
      if (key.length >= 3 && (normalized.includes(key) || key.includes(normalized))) {
        const catId = userMemory[key];
        const matchedCat = categories.find(c => c.id === catId);
        if (matchedCat) {
          return {
            categoryId: matchedCat.id,
            categoryName: matchedCat.name,
            source: 'user_memory',
            matchedKeyword: key,
            confidence: 95
          };
        }
      }
    }

    // =========================================================================
    // ETAPA 2: Diccionario Dominicano con Ponderación de Tokens (Prioridad 2)
    // =========================================================================
    // Cada categoría acumula puntos en función de los tokens que coinciden
    const scores: Array<{
      rule: CategoryRule;
      score: number;
      matchedKeyword: string;
    }> = [];

    for (const rule of DOMINICAN_RULES) {
      let categoryScore = 0;
      let bestMatch = '';
      let bestWeight = 0;

      for (const token of rule.tokens) {
        const tokenKw = token.keyword;
        let isMatch = false;

        // Si es multi-palabra (contiene espacio), verificar como subcadena directa
        if (tokenKw.includes(' ')) {
          if (normalized.includes(tokenKw)) {
            isMatch = true;
          }
        } else {
          // Token de una sola palabra: verificar límite de palabra para evitar falsos positivos
          // Ej: "uber" no debe dispararse con "tubería"
          const wordRegex = new RegExp(`(^|\\s)${tokenKw}(\\s|$)`, 'i');
          if (wordRegex.test(normalized)) {
            isMatch = true;
          }
        }

        if (isMatch) {
          categoryScore += token.weight;
          if (token.weight > bestWeight) {
            bestWeight = token.weight;
            bestMatch = tokenKw;
          }
        }
      }

      if (categoryScore > 0) {
        scores.push({
          rule,
          score: categoryScore,
          matchedKeyword: bestMatch
        });
      }
    }

    // Ordenar de mayor a menor puntuación
    scores.sort((a, b) => b.score - a.score);

    if (scores.length > 0) {
      const winner = scores[0];
      const resolvedCat = resolveCategory(winner.rule.targetId, winner.rule.fallbackNames);

      if (resolvedCat) {
        return {
          categoryId: resolvedCat.id,
          categoryName: resolvedCat.name,
          source: 'dictionary',
          matchedKeyword: winner.matchedKeyword,
          confidence: Math.min(95, Math.max(50, winner.score * 10))
        };
      }
    }

    return null;
  }
}
export default CategoryDetector;
