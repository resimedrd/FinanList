/**
 * FinanList - Appwrite Automatic Provisioning Script
 * 
 * Este script crea automáticamente la base de datos `finanlist_db`,
 * las 9 colecciones necesarias y todos sus atributos e índices en tu proyecto de Appwrite.
 * 
 * Uso:
 *   node scripts/setup-appwrite.cjs <APPWRITE_API_KEY>
 * 
 * O configurando la variable en tu entorno:
 *   $env:APPWRITE_API_KEY="tu_clave_secreta"
 *   node scripts/setup-appwrite.cjs
 */

const fs = require('fs');
const path = require('path');

// Cargar variables de .env si existe
const envPath = path.resolve(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      envVars[key] = val;
    }
  }
}

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || envVars.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID || envVars.VITE_APPWRITE_PROJECT_ID;
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || envVars.VITE_APPWRITE_DATABASE_ID || 'finanlist_db';
const API_KEY = process.argv[2] || process.env.APPWRITE_API_KEY;

if (!PROJECT_ID || PROJECT_ID === 'your-appwrite-project-id') {
  console.error('\n❌ ERROR: Falta configurar VITE_APPWRITE_PROJECT_ID en el archivo .env');
  console.log('   Por favor abre .env y coloca el Project ID de tu proyecto en Appwrite.\n');
  process.exit(1);
}

if (!API_KEY) {
  console.error('\n❌ ERROR: Falta la API Key de Appwrite para la configuración inicial.');
  console.log('   Debes crear una API Key en la consola de Appwrite:');
  console.log('   Project Settings -> API Keys -> Create API Key con scopes:');
  console.log('   - databases.write');
  console.log('   - collections.write');
  console.log('   - attributes.write');
  console.log('   - documents.write\n');
  console.log('   Luego ejecuta:');
  console.log('   node scripts/setup-appwrite.cjs TU_API_KEY\n');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': PROJECT_ID,
  'X-Appwrite-Key': API_KEY
};

async function appwriteRequest(urlPath, method = 'GET', body = null) {
  const url = `${ENDPOINT.replace(/\/$/, '')}${urlPath}`;
  const options = {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  };

  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Si ya existe (409 Conflict), es normal
    if (res.status === 409) {
      return { alreadyExists: true, ...json };
    }
    const err = new Error(json.message || `HTTP ${res.status}`);
    (err).status = res.status;
    (err).response = json;
    throw err;
  }
  return json;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('====================================================');
  console.log('🚀 Iniciando configuración de FinanList en Appwrite');
  console.log('====================================================');
  console.log(`📡 Endpoint:   ${ENDPOINT}`);
  console.log(`🆔 Project ID: ${PROJECT_ID}`);
  console.log(`💾 Database:   ${DATABASE_ID}`);
  console.log('----------------------------------------------------\n');

  // 1. Crear o verificar base de datos
  console.log('1️⃣  Verificando base de datos...');
  try {
    await appwriteRequest('/databases', 'POST', {
      databaseId: DATABASE_ID,
      name: 'FinanList Database',
      enabled: true
    });
    console.log(`   ✅ Base de datos "${DATABASE_ID}" creada.`);
  } catch (err) {
    if (err.status === 409 || err.message?.includes('already exists')) {
      console.log(`   ℹ️  La base de datos "${DATABASE_ID}" ya existe.`);
    } else {
      console.error(`   ❌ Error creando base de datos:`, err.message);
      throw err;
    }
  }

  // Colecciones y sus definiciones
  const collections = [
    {
      id: 'profiles',
      name: 'Perfiles de Usuario',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'string', key: 'name', size: 128, required: true },
        { type: 'string', key: 'username', size: 64, required: true },
        { type: 'string', key: 'email', size: 255, required: true },
        { type: 'string', key: 'currency', size: 10, required: false, default: 'RD$' },
        { type: 'string', key: 'language', size: 10, required: false, default: 'es' },
        { type: 'string', key: 'theme', size: 20, required: false, default: 'dark' },
        { type: 'string', key: 'accent_color', size: 20, required: false, default: '#8b5cf6' },
        { type: 'string', key: 'pin_code', size: 128, required: false },
        { type: 'boolean', key: 'stealth_mode_enabled', required: false, default: false }
      ]
    },
    {
      id: 'categories',
      name: 'Categorías',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'string', key: 'name', size: 100, required: true },
        { type: 'string', key: 'parent_id', size: 64, required: false },
        { type: 'string', key: 'color', size: 30, required: true },
        { type: 'string', key: 'icon', size: 50, required: true }
      ]
    },
    {
      id: 'transactions',
      name: 'Transacciones',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'string', key: 'type', size: 20, required: true },
        { type: 'string', key: 'category_id', size: 64, required: true },
        { type: 'string', key: 'subcategory_id', size: 64, required: false },
        { type: 'string', key: 'account', size: 100, required: true },
        { type: 'string', key: 'card_id', size: 64, required: false },
        { type: 'string', key: 'destination_card_id', size: 64, required: false },
        { type: 'string', key: 'date', size: 20, required: true },
        { type: 'string', key: 'time', size: 10, required: true },
        { type: 'string', key: 'notes', size: 500, required: false },
        { type: 'string', key: 'tags', size: 50, required: false, array: true },
        { type: 'string', key: 'color', size: 30, required: true },
        { type: 'string', key: 'icon', size: 50, required: true },
        { type: 'boolean', key: 'favorite', required: false, default: false }
      ]
    },
    {
      id: 'budgets',
      name: 'Presupuestos',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'float', key: 'contingency_amount', required: false, default: 0 },
        { type: 'string', key: 'type', size: 30, required: true },
        { type: 'string', key: 'category_id', size: 64, required: false },
        { type: 'string', key: 'start_date', size: 20, required: true },
        { type: 'string', key: 'end_date', size: 20, required: true },
        { type: 'string', key: 'name', size: 100, required: false }
      ]
    },
    {
      id: 'goals',
      name: 'Metas de Ahorro',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'string', key: 'name', size: 100, required: true },
        { type: 'float', key: 'target_amount', required: true },
        { type: 'float', key: 'current_amount', required: false, default: 0 },
        { type: 'string', key: 'icon', size: 50, required: true },
        { type: 'string', key: 'color', size: 30, required: true },
        { type: 'string', key: 'target_date', size: 20, required: false }
      ]
    },
    {
      id: 'debts',
      name: 'Deudas y Préstamos',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'string', key: 'person_or_institution', size: 150, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'float', key: 'remaining_amount', required: true },
        { type: 'string', key: 'type', size: 20, required: true },
        { type: 'string', key: 'due_date', size: 20, required: false },
        { type: 'string', key: 'notes', size: 500, required: false }
      ]
    },
    {
      id: 'recurring',
      name: 'Transacciones Recurrentes',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'float', key: 'amount', required: true },
        { type: 'string', key: 'type', size: 20, required: true },
        { type: 'string', key: 'category_id', size: 64, required: true },
        { type: 'string', key: 'account', size: 100, required: true },
        { type: 'string', key: 'notes', size: 500, required: false },
        { type: 'string', key: 'frequency', size: 20, required: true },
        { type: 'string', key: 'start_date', size: 20, required: true },
        { type: 'string', key: 'last_applied_date', size: 20, required: false },
        { type: 'boolean', key: 'active', required: false, default: true },
        { type: 'string', key: 'color', size: 30, required: true },
        { type: 'string', key: 'icon', size: 50, required: true }
      ]
    },
    {
      id: 'cards',
      name: 'Tarjetas y Cuentas',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'string', key: 'name', size: 100, required: true },
        { type: 'string', key: 'bank', size: 100, required: true },
        { type: 'string', key: 'type', size: 20, required: true },
        { type: 'string', key: 'last_four_digits', size: 10, required: false },
        { type: 'string', key: 'currency', size: 10, required: true },
        { type: 'string', key: 'color', size: 30, required: true },
        { type: 'boolean', key: 'is_active', required: false, default: true },
        { type: 'float', key: 'initial_balance', required: false, default: 0 },
        { type: 'float', key: 'current_balance', required: false, default: 0 },
        { type: 'float', key: 'min_balance_alert', required: false },
        { type: 'boolean', key: 'allow_overdraft', required: false, default: false },
        { type: 'float', key: 'overdraft_limit', required: false, default: 0 },
        { type: 'float', key: 'credit_limit', required: false, default: 0 },
        { type: 'float', key: 'balance_used', required: false, default: 0 },
        { type: 'integer', key: 'alert_threshold_percent', required: false, default: 80 },
        { type: 'integer', key: 'billing_cutoff_day', required: false, default: 15 },
        { type: 'integer', key: 'payment_due_day', required: false, default: 5 },
        { type: 'string', key: 'updated_at', size: 40, required: false }
      ]
    },
    {
      id: 'financial_notifications',
      name: 'Notificaciones Financieras',
      attributes: [
        { type: 'string', key: 'user_id', size: 36, required: true },
        { type: 'string', key: 'card_id', size: 64, required: false },
        { type: 'string', key: 'card_name', size: 100, required: false },
        { type: 'string', key: 'type', size: 50, required: true },
        { type: 'string', key: 'severity', size: 20, required: true },
        { type: 'string', key: 'title', size: 150, required: true },
        { type: 'string', key: 'message', size: 500, required: true },
        { type: 'boolean', key: 'is_read', required: false, default: false },
        { type: 'string', key: 'created_at', size: 40, required: false }
      ]
    }
  ];

  console.log('\n2️⃣  Creando colecciones y atributos...');

  for (const col of collections) {
    console.log(`\n📁 Colección: [${col.id}] (${col.name})`);
    
    // Crear colección con seguridad a nivel de documento habilitada
    try {
      await appwriteRequest(`/databases/${DATABASE_ID}/collections`, 'POST', {
        collectionId: col.id,
        name: col.name,
        permissions: [
          'read("users")',
          'create("users")',
          'update("users")',
          'delete("users")'
        ],
        documentSecurity: true,
        enabled: true
      });
      console.log(`   ✅ Colección "${col.id}" creada.`);
    } catch (err) {
      if (err.status === 409 || err.message?.includes('already exists')) {
        console.log(`   ℹ️  Colección "${col.id}" ya existe.`);
      } else {
        console.error(`   ❌ Error creando colección "${col.id}":`, err.message);
        continue;
      }
    }

    // Esperar un momento para asegurar consistencia
    await delay(300);

    // Crear atributos
    for (const attr of col.attributes) {
      try {
        let endpoint = `/databases/${DATABASE_ID}/collections/${col.id}/attributes/${attr.type}`;
        const body = {
          key: attr.key,
          required: !!attr.required
        };

        if (attr.type === 'string') {
          body.size = attr.size || 255;
          if (attr.default !== undefined) body.default = attr.default;
          if (attr.array) body.array = true;
        } else if (attr.type === 'float') {
          if (attr.default !== undefined) body.default = attr.default;
        } else if (attr.type === 'integer') {
          if (attr.default !== undefined) body.default = attr.default;
        } else if (attr.type === 'boolean') {
          if (attr.default !== undefined) body.default = attr.default;
        }

        await appwriteRequest(endpoint, 'POST', body);
        console.log(`      + Atributo "${attr.key}" (${attr.type}) creado.`);
        await delay(200);
      } catch (attrErr) {
        if (attrErr.status === 409 || attrErr.message?.includes('already exists')) {
          // Ya existe, omitir
        } else {
          console.warn(`      ⚠️ Atributo "${attr.key}": ${attrErr.message}`);
        }
      }
    }

    // Crear índice por user_id para acelerar consultas
    try {
      await appwriteRequest(`/databases/${DATABASE_ID}/collections/${col.id}/indexes`, 'POST', {
        key: 'idx_user_id',
        type: 'key',
        attributes: ['user_id']
      });
      console.log(`   ⚡ Índice por "user_id" creado.`);
      await delay(200);
    } catch (idxErr) {
      // Ignorar si ya existe
    }
  }

  console.log('\n====================================================');
  console.log('🎉 ¡Todas las colecciones de FinanList están listas!');
  console.log('====================================================');
  console.log('Ahora tu aplicación FinanList sincronizará automáticamente');
  console.log('todos tus datos con Appwrite 100% libre de costos.');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('\n❌ Error durante la ejecución:', err.message);
  process.exit(1);
});
