import React, { useState } from 'react';
import { sqliteClient } from '../db/sqliteClient';
import { useStagingStore } from '../store/useStagingStore';
import { Tag, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export function CategoryManager() {
  const { categories, fetchCategories } = useStagingStore();
  const [newName, setNewName] = useState('');

  const addCategory = async () => {
    if (!newName) return;
    try {
      await sqliteClient.execute(
        'INSERT INTO categories (name) VALUES (?)',
        [newName]
      );
      setNewName('');
      await fetchCategories();
    } catch (err) {
      alert('Failed to add category: ' + err.message);
    }
  };

  const deleteCategory = async (id) => {
    if (id === 'Uncategorized' || id === 1) {
      alert('Cannot delete the Uncategorized category.');
      return;
    }
    
    if (!confirm('Are you sure? Transactions with this category will be reset to Uncategorized.')) return;
    
    try {
      // Find the ID of Uncategorized explicitly from DB
      const rows = await sqliteClient.query("SELECT id FROM categories WHERE name = 'Uncategorized' LIMIT 1");
      const uncatId = rows.length > 0 ? rows[0].id : null;

      if (!uncatId) {
        throw new Error("Critical error: 'Uncategorized' category not found in database.");
      }

      // 1. Update transactions to Uncategorized
      await sqliteClient.execute(
        'UPDATE transactions SET category_id = ? WHERE category_id = ?',
        [uncatId, id]
      );

      // 2. Update rules to Uncategorized
      await sqliteClient.execute(
        'UPDATE category_rules SET category_id = ? WHERE category_id = ?',
        [uncatId, id]
      );

      // 3. Delete the category
      await sqliteClient.execute('DELETE FROM categories WHERE id = ?', [id]);
      
      // Refresh local store
      await fetchCategories();
      alert('Category deleted and transactions re-assigned.');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const toggleCategoryType = async (id, currentType) => {
    const newType = currentType === 'expense' ? 'income' : 'expense';
    try {
      await sqliteClient.execute(
        'UPDATE categories SET type = ? WHERE id = ?',
        [newType, id]
      );
      await fetchCategories();
    } catch (err) {
      alert('Failed to update category type: ' + err.message);
    }
  };

  const expenseCategories = categories.filter(c => c.type !== 'income');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <section className="glass-card p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Tag className="text-sky-400" />
          Category Management
        </h3>

        {/* Add Category Form */}
        <div className="flex gap-4 mb-8 bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">New Category Name</label>
            <input 
              type="text" 
              placeholder="e.g. Entertainment, Health, Travel" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={addCategory}
              className="px-6 py-2 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Create Category
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Spending Categories */}
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              Spending Categories ({expenseCategories.length})
            </h4>
            <div className="space-y-3">
              {expenseCategories.map(cat => (
                <div key={cat.id} className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all group">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className={cat.name === 'Uncategorized' ? 'text-slate-600' : 'text-rose-500'} />
                    <span className="font-medium text-slate-200">{cat.name}</span>
                  </div>
                  {cat.name !== 'Uncategorized' && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleCategoryType(cat.id, cat.type || 'expense')}
                        className="px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                        title="Move to Income"
                      >
                        Set to Income
                      </button>
                      <button 
                        onClick={() => deleteCategory(cat.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Income Categories */}
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              Income Categories ({incomeCategories.length})
            </h4>
            <div className="space-y-3">
              {incomeCategories.map(cat => (
                <div key={cat.id} className="p-4 bg-slate-950/50 rounded-2xl border border-emerald-900/30 flex items-center justify-between hover:border-emerald-700/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="font-medium text-slate-200">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => toggleCategoryType(cat.id, cat.type)}
                      className="px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                      title="Move to Spending"
                    >
                      Set to Spending
                    </button>
                    <button 
                      onClick={() => deleteCategory(cat.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {incomeCategories.length === 0 && (
                <div className="text-center p-6 border border-dashed border-slate-700 rounded-2xl text-slate-500 text-sm">
                  No income categories yet.<br/>Move existing categories here or create new ones.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
