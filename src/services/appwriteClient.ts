import { Client, Account, Databases, ID, Query, Permission, Role, Models } from 'appwrite';

const endpoint: string = (import.meta as any).env?.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId: string = (import.meta as any).env?.VITE_APPWRITE_PROJECT_ID || '';
const databaseId: string = (import.meta as any).env?.VITE_APPWRITE_DATABASE_ID || 'finanlist_db';

export const isAppwriteConfigured: boolean = !!(
  projectId &&
  projectId.trim() !== '' &&
  projectId !== 'your-appwrite-project-id'
);

export const client = new Client();

if (isAppwriteConfigured) {
  client.setEndpoint(endpoint).setProject(projectId);
} else {
  client.setEndpoint(endpoint || 'https://cloud.appwrite.io/v1');
}

export const account = new Account(client);
export const databases = new Databases(client);

export const APPWRITE_CONFIG = {
  endpoint,
  projectId,
  databaseId
};

export const COLLECTIONS = {
  PROFILES: 'profiles',
  CATEGORIES: 'categories',
  TRANSACTIONS: 'transactions',
  BUDGETS: 'budgets',
  GOALS: 'goals',
  DEBTS: 'debts',
  RECURRING: 'recurring',
  CARDS: 'cards',
  NOTIFICATIONS: 'financial_notifications'
} as const;

export { ID, Query, Permission, Role };
export type { Models };
