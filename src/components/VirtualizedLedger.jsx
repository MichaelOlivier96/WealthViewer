import React, { useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Edit2, Check, X, ArrowLeftRight } from 'lucide-react';
import { useStagingStore } from '../store/useStagingStore';
import { sqliteClient } from '../db/sqliteClient';

export function VirtualizedLedger({ transactions = [], onUpdate }) {
  const { categories = [] } = useStagingStore();
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditValues({ ...tx });
  };

  const saveEdit = async () => {
    try {
      const cat = categories.find(c => c.name === editValues.category_name);
      await sqliteClient.execute(
        'UPDATE transactions SET category_id = ?, is_transfer = ?, amount = ? WHERE id = ?',
        [cat ? cat.id : null, editValues.is_transfer ? 1 : 0, editValues.amount, editingId]
      );
      setEditingId(null);
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  };

  const Row = ({ index, style }) => {
    const tx = transactions[index];
    if (!tx) return null;
    
    const isEditing = editingId === tx.id;

    if (isEditing) {
      return (
        <div style={style} className="px-4">
          <div className="flex items-center h-full border-b border-slate-800 bg-slate-900/95 rounded-lg px-6 text-sm gap-4 border border-sky-500/50 shadow-xl relative z-10">
            <div className="w-24 font-mono text-xs text-slate-500">{tx.date}</div>
            <div className="flex-1 truncate font-medium text-white pr-4">{tx.raw_description}</div>
            <div className="w-32">
              <select 
                value={editValues.category_name || 'Uncategorized'}
                onChange={e => setEditValues({ ...editValues, category_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-sky-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="w-48 flex items-center gap-3 justify-end">
              <button 
                onClick={() => setEditValues({ ...editValues, is_transfer: !editValues.is_transfer })}
                className={`p-1.5 rounded-lg transition-colors ${editValues.is_transfer ? 'bg-sky-500/20 text-sky-400' : 'text-slate-600 hover:text-slate-400'}`}
                title="Toggle Transfer"
              >
                <ArrowLeftRight size={14} />
              </button>
              <input 
                type="number"
                value={editValues.amount / 100}
                onChange={e => setEditValues({ ...editValues, amount: Math.round(parseFloat(e.target.value || 0) * 100) })}
                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-right outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div className="w-10 flex gap-1 justify-end shrink-0">
              <button onClick={saveEdit} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check size={16} /></button>
              <button onClick={() => setEditingId(null)} className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg"><X size={16} /></button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={style} className="px-4">
        <div className="flex items-center h-full border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors px-6 text-sm group">
          <div className="w-24 font-mono text-xs text-slate-500">{tx.date}</div>
          <div className="flex-1 truncate font-medium text-white pr-4 flex items-center gap-2">
            {tx.is_transfer && <ArrowLeftRight size={12} className="text-sky-400 shrink-0" />}
            {tx.raw_description}
          </div>
          <div className="w-32">
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter ${tx.is_transfer ? 'bg-slate-800 text-slate-400' : 'bg-sky-500/10 text-sky-400'}`}>
              {tx.is_transfer ? 'Transfer' : (tx.category_name || 'Uncategorized')}
            </span>
          </div>
          <div className={`w-32 text-right font-mono font-bold ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'} ${tx.is_transfer ? 'opacity-40' : ''}`}>
            {tx.amount < 0 ? '-' : '+'}R{Math.abs(tx.amount / 100).toFixed(2)}
          </div>
          <div className="w-10 text-right opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => startEdit(tx)} className="p-1.5 text-slate-500 hover:text-sky-400 transition-colors">
              <Edit2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-[600px] relative">
      {/* Table Header */}
      <div className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider font-bold flex px-10 py-4 border-b border-slate-800 shrink-0">
        <div className="w-24">Date</div>
        <div className="flex-1">Description</div>
        <div className="w-32">Category</div>
        <div className="w-32 text-right">Amount</div>
        <div className="w-10"></div>
      </div>
      
      {/* Scrollable List */}
      <div className="flex-1 min-h-0">
        <List
          height={540}
          width="100%"
          itemCount={transactions.length}
          itemSize={56}
        >
          {Row}
        </List>
      </div>

      {transactions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic pointer-events-none mt-10">
          No transactions to display.
        </div>
      )}
    </div>
  );
}
