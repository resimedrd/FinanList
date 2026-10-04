import {
  account,
  databases,
  APPWRITE_CONFIG,
  COLLECTIONS,
  isAppwriteConfigured,
  ID,
  Query,
  Permission,
  Role,
  Models
} from './appwriteClient';
import {
  Transaction,
  Category,
  Budget,
  SavingGoal,
  UserProfile,
  RecurringTransaction,
  Debt,
  PaymentCard,
  FinancialNotification
} from '../models/types';

export interface AppwriteUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Sanitiza un ID para cumplir con las reglas de Appwrite:
 * Máximo 36 caracteres, solo [a-zA-Z0-9._-], no puede comenzar con guión o punto.
 */
export function sanitizeDocId(id: string): string {
  if (!id) return ID.unique();
  const cleaned = id.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 36);
  // No puede comenzar con . o _ o -
  if (cleaned.startsWith('.') || cleaned.startsWith('-') || cleaned.startsWith('_')) {
    return 'id_' + cleaned.substring(0, 33);
  }
  return cleaned;
}

export class AppwriteService {
  private static dbId = APPWRITE_CONFIG.databaseId;

  /**
   * Obtiene la sesión activa actual del usuario.
   */
  static async getCurrentUser(): Promise<AppwriteUser | null> {
    if (!isAppwriteConfigured) return null;
    try {
      const user = await account.get();
      return {
        id: user.$id,
        email: user.email,
        name: user.name || ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Registra una nueva cuenta de usuario en Appwrite y crea su sesión.
   */
  static async signUp(
    email: string,
    pass: string,
    name: string,
    _username: string
  ): Promise<AppwriteUser> {
    if (!isAppwriteConfigured) {
      throw new Error('Appwrite no está configurado en las variables de entorno.');
    }

    const userId = ID.unique();
    await account.create(userId, email, pass, name);

    // Iniciar sesión inmediatamente
    try {
      await account.createEmailPasswordSession(email, pass);
    } catch (sessionErr: any) {
      // Compatibilidad con versiones que usan createEmailSession
      if (typeof (account as any).createEmailSession === 'function') {
        await (account as any).createEmailSession(email, pass);
      } else {
        throw sessionErr;
      }
    }

    const current = await account.get();
    return {
      id: current.$id,
      email: current.email,
      name: current.name || name
    };
  }

  /**
   * Inicia sesión con email y contraseña.
   */
  static async signIn(email: string, pass: string): Promise<AppwriteUser> {
    if (!isAppwriteConfigured) {
      throw new Error('Appwrite no está configurado en las variables de entorno.');
    }

    try {
      await account.createEmailPasswordSession(email, pass);
    } catch (err: any) {
      if (typeof (account as any).createEmailSession === 'function') {
        await (account as any).createEmailSession(email, pass);
      } else {
        throw err;
      }
    }

    const current = await account.get();
    return {
      id: current.$id,
      email: current.email,
      name: current.name || ''
    };
  }

  /**
   * Cierra la sesión activa en Appwrite.
   */
  static async signOut(): Promise<void> {
    if (!isAppwriteConfigured) return;
    try {
      await account.deleteSession('current');
    } catch (err) {
      console.warn('[Appwrite] Error al cerrar sesión:', err);
    }
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   */
  static async changePassword(newPass: string, oldPass: string): Promise<void> {
    if (!isAppwriteConfigured) {
      throw new Error('Appwrite no está configurado.');
    }
    await account.updatePassword(newPass, oldPass);
  }

  /**
   * Helper seguro de Upsert (actualiza si existe, crea si no).
   */
  private static async safeUpsert(
    collectionId: string,
    docId: string,
    data: Record<string, any>,
    userId: string
  ): Promise<Models.Document | null> {
    if (!isAppwriteConfigured) return null;
    const permissions = [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId))
    ];
    const sanitizedId = sanitizeDocId(docId);

    try {
      // 1. Intentar upsert nativo de Appwrite SDK v28
      if (typeof (databases as any).upsertDocument === 'function') {
        try {
          return await (databases as any).upsertDocument(
            this.dbId,
            collectionId,
            sanitizedId,
            data,
            permissions
          );
        } catch (upsertEx: any) {
          // Si el servidor Appwrite no soporta upsert nativo (404/501), fallback
          if (upsertEx.code !== 404 && upsertEx.code !== 501 && !upsertEx.message?.includes('Method Not Allowed')) {
            throw upsertEx;
          }
        }
      }

      // 2. Fallback estándar: actualizar o crear
      try {
        return await databases.updateDocument(
          this.dbId,
          collectionId,
          sanitizedId,
          data,
          permissions
        );
      } catch (updateErr: any) {
        if (updateErr.code === 404) {
          return await databases.createDocument(
            this.dbId,
            collectionId,
            sanitizedId,
            data,
            permissions
          );
        }
        throw updateErr;
      }
    } catch (err: any) {
      console.warn(`[Appwrite] Error guardando documento en ${collectionId}:`, err?.message || err);
      return null;
    }
  }

  /**
   * Helper seguro de eliminación de documentos.
   */
  private static async safeDelete(collectionId: string, docId: string): Promise<boolean> {
    if (!isAppwriteConfigured) return false;
    try {
      await databases.deleteDocument(this.dbId, collectionId, sanitizeDocId(docId));
      return true;
    } catch (err: any) {
      // Si ya no existe (404), se considera eliminado con éxito
      if (err.code === 404) return true;
      console.warn(`[Appwrite] Error eliminando documento de ${collectionId}:`, err?.message || err);
      return false;
    }
  }

  // --- Operaciones de Perfil ---
  static async getProfile(userId: string): Promise<UserProfile | null> {
    if (!isAppwriteConfigured) return null;
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.PROFILES, [
        Query.equal('user_id', userId),
        Query.limit(1)
      ]);
      if (res.documents.length === 0) return null;
      const doc = res.documents[0] as any;
      return {
        name: doc.name || '',
        username: doc.username || '',
        email: doc.email || '',
        avatar: doc.avatar || '',
        currency: doc.currency || 'RD$',
        language: doc.language || 'es',
        theme: doc.theme || 'dark',
        accentColor: doc.accent_color || '#8b5cf6',
        pinCode: doc.pin_code || undefined,
        biometricsEnabled: !!doc.biometrics_enabled,
        stealthModeEnabled: !!doc.stealth_mode_enabled
      };
    } catch (err) {
      console.warn('[Appwrite] Error obteniendo perfil:', err);
      return null;
    }
  }

  static async syncProfile(profile: UserProfile, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      name: profile.name,
      username: (profile.username || '').toLowerCase(),
      email: (profile.email || '').toLowerCase(),
      currency: profile.currency || 'RD$',
      language: profile.language || 'es',
      theme: profile.theme || 'dark',
      accent_color: profile.accentColor || '#8b5cf6',
      pin_code: profile.pinCode || '',
      stealth_mode_enabled: !!profile.stealthModeEnabled
    };
    await this.safeUpsert(COLLECTIONS.PROFILES, `profile_${userId}`, data, userId);
  }

  // --- Operaciones de Transacciones ---
  static async listTransactions(userId: string): Promise<Transaction[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.TRANSACTIONS, [
        Query.equal('user_id', userId),
        Query.orderDesc('date'),
        Query.limit(5000)
      ]);
      return res.documents.map((d: any) => ({
        id: d.$id,
        amount: parseFloat(d.amount),
        type: d.type,
        categoryId: d.category_id,
        subcategoryId: d.subcategory_id || undefined,
        account: d.account,
        cardId: d.card_id || undefined,
        destinationCardId: d.destination_card_id || undefined,
        date: d.date,
        time: d.time,
        notes: d.notes || undefined,
        tags: Array.isArray(d.tags) ? d.tags : [],
        color: d.color,
        icon: d.icon,
        favorite: !!d.favorite
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando transacciones:', err);
      return [];
    }
  }

  static async syncTransaction(tx: Transaction, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      amount: tx.amount,
      type: tx.type,
      category_id: tx.categoryId,
      subcategory_id: tx.subcategoryId || null,
      account: tx.account,
      card_id: tx.cardId || null,
      destination_card_id: tx.destinationCardId || null,
      date: tx.date,
      time: tx.time,
      notes: tx.notes || null,
      tags: tx.tags || [],
      color: tx.color,
      icon: tx.icon,
      favorite: !!tx.favorite
    };
    await this.safeUpsert(COLLECTIONS.TRANSACTIONS, tx.id, data, userId);
  }

  static async deleteTransaction(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.TRANSACTIONS, id);
  }

  // --- Operaciones de Tarjetas ---
  static async listCards(userId: string): Promise<PaymentCard[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.CARDS, [
        Query.equal('user_id', userId),
        Query.limit(100)
      ]);
      return res.documents.map((c: any) => ({
        id: c.$id,
        name: c.name,
        bank: c.bank,
        type: c.type,
        lastFourDigits: c.last_four_digits || undefined,
        currency: c.currency || 'RD$',
        color: c.color || '#4f46e5',
        isActive: c.is_active !== false,
        initialBalance: parseFloat(c.initial_balance || 0),
        currentBalance: parseFloat(c.current_balance || 0),
        minBalanceAlert: c.min_balance_alert !== null && c.min_balance_alert !== undefined ? parseFloat(c.min_balance_alert) : undefined,
        allowOverdraft: !!c.allow_overdraft,
        overdraftLimit: parseFloat(c.overdraft_limit || 0),
        creditLimit: parseFloat(c.credit_limit || 0),
        balanceUsed: parseFloat(c.balance_used || 0),
        alertThresholdPercent: parseInt(c.alert_threshold_percent || 80, 10),
        billingCutoffDay: parseInt(c.billing_cutoff_day || 15, 10),
        paymentDueDay: parseInt(c.payment_due_day || 5, 10),
        createdAt: c.created_at || c.$createdAt
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando tarjetas:', err);
      return [];
    }
  }

  static async syncCard(card: PaymentCard, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      name: card.name,
      bank: card.bank,
      type: card.type,
      last_four_digits: card.lastFourDigits || null,
      currency: card.currency,
      color: card.color,
      is_active: card.isActive,
      initial_balance: card.initialBalance ?? 0,
      current_balance: card.currentBalance ?? 0,
      min_balance_alert: card.minBalanceAlert ?? null,
      allow_overdraft: card.allowOverdraft ?? false,
      overdraft_limit: card.overdraftLimit ?? 0,
      credit_limit: card.creditLimit ?? 0,
      balance_used: card.balanceUsed ?? 0,
      alert_threshold_percent: card.alertThresholdPercent ?? 80,
      billing_cutoff_day: card.billingCutoffDay ?? 15,
      payment_due_day: card.paymentDueDay ?? 5,
      updated_at: new Date().toISOString()
    };
    await this.safeUpsert(COLLECTIONS.CARDS, card.id, data, userId);
  }

  static async deleteCard(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.CARDS, id);
  }

  // --- Operaciones de Categorías ---
  static async listCategories(userId: string): Promise<Category[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.CATEGORIES, [
        Query.equal('user_id', userId),
        Query.limit(500)
      ]);
      return res.documents.map((c: any) => ({
        id: c.$id,
        name: c.name,
        parentId: c.parent_id || undefined,
        color: c.color,
        icon: c.icon
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando categorías:', err);
      return [];
    }
  }

  static async syncCategory(cat: Category, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      name: cat.name,
      parent_id: cat.parentId || null,
      color: cat.color,
      icon: cat.icon
    };
    await this.safeUpsert(COLLECTIONS.CATEGORIES, cat.id, data, userId);
  }

  static async deleteCategory(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.CATEGORIES, id);
  }

  // --- Operaciones de Presupuestos ---
  static async listBudgets(userId: string): Promise<Budget[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.BUDGETS, [
        Query.equal('user_id', userId),
        Query.limit(200)
      ]);
      return res.documents.map((b: any) => ({
        id: b.$id,
        amount: parseFloat(b.amount),
        contingencyAmount: b.contingency_amount ? parseFloat(b.contingency_amount) : undefined,
        type: b.type,
        categoryId: b.category_id || undefined,
        startDate: b.start_date,
        endDate: b.end_date,
        name: b.name || undefined
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando presupuestos:', err);
      return [];
    }
  }

  static async syncBudget(b: Budget, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      amount: b.amount,
      contingency_amount: b.contingencyAmount || null,
      type: b.type,
      category_id: b.categoryId || null,
      start_date: b.startDate,
      end_date: b.endDate,
      name: b.name || null
    };
    await this.safeUpsert(COLLECTIONS.BUDGETS, b.id, data, userId);
  }

  static async deleteBudget(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.BUDGETS, id);
  }

  // --- Operaciones de Metas de Ahorro ---
  static async listGoals(userId: string): Promise<SavingGoal[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.GOALS, [
        Query.equal('user_id', userId),
        Query.limit(200)
      ]);
      return res.documents.map((g: any) => ({
        id: g.$id,
        name: g.name,
        targetAmount: parseFloat(g.target_amount),
        currentAmount: parseFloat(g.current_amount),
        icon: g.icon,
        color: g.color,
        targetDate: g.target_date
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando metas:', err);
      return [];
    }
  }

  static async syncGoal(g: SavingGoal, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      name: g.name,
      target_amount: g.targetAmount,
      current_amount: g.currentAmount,
      icon: g.icon,
      color: g.color,
      target_date: g.targetDate
    };
    await this.safeUpsert(COLLECTIONS.GOALS, g.id, data, userId);
  }

  static async deleteGoal(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.GOALS, id);
  }

  // --- Operaciones de Deudas ---
  static async listDebts(userId: string): Promise<Debt[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.DEBTS, [
        Query.equal('user_id', userId),
        Query.limit(200)
      ]);
      return res.documents.map((d: any) => ({
        id: d.$id,
        personOrInstitution: d.person_or_institution,
        amount: parseFloat(d.amount),
        remainingAmount: parseFloat(d.remaining_amount),
        type: d.type,
        dueDate: d.due_date || undefined,
        notes: d.notes || undefined
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando deudas:', err);
      return [];
    }
  }

  static async syncDebt(d: Debt, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      person_or_institution: d.personOrInstitution,
      amount: d.amount,
      remaining_amount: d.remainingAmount,
      type: d.type,
      due_date: d.dueDate || null,
      notes: d.notes || null
    };
    await this.safeUpsert(COLLECTIONS.DEBTS, d.id, data, userId);
  }

  static async deleteDebt(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.DEBTS, id);
  }

  // --- Operaciones de Transacciones Recurrentes ---
  static async listRecurring(userId: string): Promise<RecurringTransaction[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.RECURRING, [
        Query.equal('user_id', userId),
        Query.limit(200)
      ]);
      return res.documents.map((r: any) => ({
        id: r.$id,
        amount: parseFloat(r.amount),
        type: r.type,
        categoryId: r.category_id,
        account: r.account,
        notes: r.notes || undefined,
        frequency: r.frequency,
        startDate: r.start_date,
        lastAppliedDate: r.last_applied_date || undefined,
        active: !!r.active,
        color: r.color,
        icon: r.icon
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando recurrentes:', err);
      return [];
    }
  }

  static async syncRecurring(r: RecurringTransaction, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      amount: r.amount,
      type: r.type,
      category_id: r.categoryId,
      account: r.account,
      notes: r.notes || null,
      frequency: r.frequency,
      start_date: r.startDate,
      last_applied_date: r.lastAppliedDate || null,
      active: !!r.active,
      color: r.color,
      icon: r.icon
    };
    await this.safeUpsert(COLLECTIONS.RECURRING, r.id, data, userId);
  }

  static async deleteRecurring(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.RECURRING, id);
  }

  // --- Operaciones de Notificaciones Financieras ---
  static async listNotifications(userId: string): Promise<FinancialNotification[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.NOTIFICATIONS, [
        Query.equal('user_id', userId),
        Query.orderDesc('created_at'),
        Query.limit(100)
      ]);
      return res.documents.map((n: any) => ({
        id: n.$id,
        cardId: n.card_id || undefined,
        cardName: n.card_name || undefined,
        type: n.type,
        severity: n.severity,
        title: n.title,
        message: n.message,
        isRead: !!n.is_read,
        createdAt: n.created_at || n.$createdAt
      }));
    } catch (err) {
      console.warn('[Appwrite] Error listando notificaciones:', err);
      return [];
    }
  }

  static async syncNotification(notif: FinancialNotification, userId: string): Promise<void> {
    const data = {
      user_id: userId,
      card_id: notif.cardId || null,
      card_name: notif.cardName || null,
      type: notif.type,
      severity: notif.severity,
      title: notif.title,
      message: notif.message,
      is_read: !!notif.isRead,
      created_at: notif.createdAt
    };
    await this.safeUpsert(COLLECTIONS.NOTIFICATIONS, notif.id, data, userId);
  }

  static async updateNotification(id: string, partial: Partial<FinancialNotification>): Promise<void> {
    if (!isAppwriteConfigured) return;
    try {
      const data: Record<string, any> = {};
      if (partial.isRead !== undefined) data.is_read = partial.isRead;
      await databases.updateDocument(this.dbId, COLLECTIONS.NOTIFICATIONS, sanitizeDocId(id), data);
    } catch (err) {
      console.warn('[Appwrite] Error actualizando notificación:', err);
    }
  }

  static async deleteNotification(id: string): Promise<void> {
    await this.safeDelete(COLLECTIONS.NOTIFICATIONS, id);
  }

  static async markAllNotificationsRead(userId: string): Promise<void> {
    if (!isAppwriteConfigured) return;
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.NOTIFICATIONS, [
        Query.equal('user_id', userId),
        Query.equal('is_read', false),
        Query.limit(100)
      ]);
      for (const doc of res.documents) {
        try {
          await databases.updateDocument(this.dbId, COLLECTIONS.NOTIFICATIONS, doc.$id, { is_read: true });
        } catch {}
      }
    } catch (e) {
      console.warn('[Appwrite] Error marcando notificaciones leídas:', e);
    }
  }

  static async clearAllNotifications(userId: string): Promise<void> {
    if (!isAppwriteConfigured) return;
    try {
      const res = await databases.listDocuments(this.dbId, COLLECTIONS.NOTIFICATIONS, [
        Query.equal('user_id', userId),
        Query.limit(100)
      ]);
      for (const doc of res.documents) {
        try {
          await databases.deleteDocument(this.dbId, COLLECTIONS.NOTIFICATIONS, doc.$id);
        } catch {}
      }
    } catch (e) {
      console.warn('[Appwrite] Error eliminando notificaciones:', e);
    }
  }

  /**
   * Elimina solo los registros financieros (transacciones, tarjetas, presupuestos, metas, deudas, recurrentes, notificaciones)
   * sin eliminar el perfil del usuario ni sus categorías.
   */
  static async resetFinancialData(userId: string): Promise<void> {
    if (!isAppwriteConfigured) return;
    const collections = [
      COLLECTIONS.TRANSACTIONS,
      COLLECTIONS.CARDS,
      COLLECTIONS.BUDGETS,
      COLLECTIONS.GOALS,
      COLLECTIONS.DEBTS,
      COLLECTIONS.RECURRING,
      COLLECTIONS.NOTIFICATIONS
    ];

    for (const col of collections) {
      try {
        const res = await databases.listDocuments(this.dbId, col, [
          Query.equal('user_id', userId),
          Query.limit(500)
        ]);
        for (const doc of res.documents) {
          try {
            await databases.deleteDocument(this.dbId, col, doc.$id);
          } catch {}
        }
      } catch (e) {
        console.warn(`[Appwrite] Error limpiando colección ${col}:`, e);
      }
    }
  }

  /**
   * Elimina todos los datos del usuario en Appwrite (Borrado de cuenta).
   */
  static async deleteAllUserData(userId: string): Promise<void> {
    if (!isAppwriteConfigured) return;
    const collections = [
      COLLECTIONS.TRANSACTIONS,
      COLLECTIONS.CARDS,
      COLLECTIONS.BUDGETS,
      COLLECTIONS.GOALS,
      COLLECTIONS.DEBTS,
      COLLECTIONS.RECURRING,
      COLLECTIONS.NOTIFICATIONS,
      COLLECTIONS.CATEGORIES,
      COLLECTIONS.PROFILES
    ];

    for (const col of collections) {
      try {
        const res = await databases.listDocuments(this.dbId, col, [
          Query.equal('user_id', userId),
          Query.limit(500)
        ]);
        for (const doc of res.documents) {
          try {
            await databases.deleteDocument(this.dbId, col, doc.$id);
          } catch {}
        }
      } catch (e) {
        console.warn(`[Appwrite] Error limpiando colección ${col}:`, e);
      }
    }
  }
}

