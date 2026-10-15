import React, { useState, useEffect } from 'react';
import { sqliteClient } from '../db/sqliteClient';
import { useStagingStore } from '../store/useStagingStore';
import { Trash2, Plus, ShieldCheck } from 'lucide-react';
import { categorizationEngine } from '../logic/categorizationEngine';

export function RulesManager() {
  const [rules, setRules] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const { categories } = useStagingStore();

  const loadRules = async () => {
    const rows = await sqliteClient.query(`
      SELECT r.id, r.keyword, c.name as category_name 
      FROM category_rules r
      JOIN categories c ON r.category_id = c.id
      ORDER BY r.keyword ASC
    `);
    setRules(rows);
    categorizationEngine.loadRules(); // Refresh the engine too
  };

  useEffect(() => {
    loadRules();
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].name);
    }
  }, [categories]);

  const addRule = async () => {
    if (!newKeyword || !selectedCategory) return;
    
    const cat = categories.find(c => c.name === selectedCategory);
    if (!cat) return;

    try {
      await sqliteClient.execute(
        'INSERT OR REPLACE INTO category_rules (keyword, category_id) VALUES (?, ?)',
        [newKeyword.toUpperCase(), cat.id]
      );
      setNewKeyword('');
      loadRules();
    } catch (err) {
      console.error('Failed to add rule:', err);
      alert('Failed to add rule: ' + err.message);
    }
  };

  const deleteRule = async (id) => {
    try {
      await sqliteClient.execute('DELETE FROM category_rules WHERE id = ?', [id]);
      loadRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <section className="glass-card p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <ShieldCheck className="text-sky-400" />
          Categorization Rules
        </h3>
        
        {/* Add Rule Form */}
        <div className="flex gap-4 mb-8 bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Keyword</label>
            <input 
              type="text" 
              placeholder="e.g. UBER, CHECKERS" 
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div className="w-64">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
            <select 
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none"
            >
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={addRule}
              className="px-6 py-2 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Add Rule
            </button>
          </div>
        </div>

        {/* Rules Table */}
        <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Keyword</th>
                <th className="px-6 py-4">Maps To</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-sky-400">{rule.keyword}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter">
                      {rule.category_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center text-slate-500 italic">
                    No rules defined. Add one above to automate categorization.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
