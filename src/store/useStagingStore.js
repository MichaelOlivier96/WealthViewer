import { create } from 'zustand';
import { sqliteClient } from '../db/sqliteClient';

export const useStagingStore = create((set, get) => ({
  pendingTransactions: [],
  balances: { opening: 0, closing: 0 },
  categories: [],
  importLogs: [],
  isImporting: false,

  setImportLogs: (logs) => {
    set({ importLogs: logs });
  },

  fetchCategories: async () => {
    try {
      const rows = await sqliteClient.query('SELECT * FROM categories ORDER BY name ASC');
      set({ categories: rows });
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  },

  setBalances: (balances) => {
    set({ balances });
  },

  addManualTransaction: () => {
    const newTx = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
      raw_description: 'Manual Transaction',
      amount: 0,
      category_id: 'uncategorized',
      is_verified: true,
      is_new: true // Helper for UI to start in edit mode
    };
    set((state) => ({
      pendingTransactions: [newTx, ...state.pendingTransactions]
    }));
  },

  addTransactions: (transactions) => {
    set((state) => ({
      pendingTransactions: [...state.pendingTransactions, ...transactions]
    }));
  },

  clearStaging: () => {
    set({ pendingTransactions: [] });
  },

  updateTransaction: (id, updates) => {
    set((state) => ({
      pendingTransactions: state.pendingTransactions.map((tx) =>
        tx.id === id ? { ...tx, ...updates } : tx
      )
    }));
  },

  removeTransaction: (id) => {
    set((state) => ({
      pendingTransactions: state.pendingTransactions.filter((tx) => tx.id !== id)
    }));
  },

  commitToDatabase: async (accountId = 'default_account') => {
    const { pendingTransactions, categories } = get();
    if (pendingTransactions.length === 0) return;

    set({ isImporting: true });
    try {
      // Create a map of name -> id for fast lookup
      const categoryMap = categories.reduce((acc, cat) => {
        acc[cat.name.toLowerCase()] = cat.id;
        return acc;
      }, {});

      // Get the 'Uncategorized' ID once
      const uncategorizedId = categoryMap['uncategorized'];

      for (const tx of pendingTransactions) {
        // Fallback to 'Uncategorized' ID if not found
        const catName = (tx.category_id || 'Uncategorized').toLowerCase();
        const catId = categoryMap[catName] || uncategorizedId;
        
        if (catId === undefined) {
          console.warn(`Category mapping failed for "${tx.category_id}". Falling back to NULL.`);
        }

        await sqliteClient.execute(`
          INSERT OR IGNORE INTO transactions 
          (id, date, raw_description, amount, category_id, account_id, is_verified, is_transfer)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tx.id,
          tx.date,
          tx.raw_description,
          tx.amount,
          catId || null,
          accountId,
          tx.is_verified ? 1 : 0,
          tx.is_transfer ? 1 : 0
        ]);
      }
      set({ pendingTransactions: [] });
    } catch (error) {
      console.error('Failed to commit transactions:', error);
      throw error;
    } finally {
      set({ isImporting: false });
    }
  }
}));
