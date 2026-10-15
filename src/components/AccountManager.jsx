import React, { useState, useEffect } from 'react';
import { sqliteClient } from '../db/sqliteClient';
import { Wallet, Plus, Trash2, CreditCard, PiggyBank, ShieldCheck, Save, Edit2 } from 'lucide-react';

const SUBTYPES = {
  checkings: ['General', 'Joint', 'Business'],
  savings: ['CryptoCurrency', 'Long-Term', 'Short-Term', 'Other'],
  credit: ['General', 'Rewards', 'Business'],
  investment: ['CryptoCurrency', 'Property', 'Stocks', 'Long-Term', 'Short-Term', 'Other'],
  loan: ['Long-Term', 'Short-Term', 'Other']
};

export function AccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('checkings');
  const [newSubType, setNewSubType] = useState('General');
  const [editingBalanceId, setEditingBalanceId] = useState(null);
  const [tempBalance, setTempBalance] = useState('');
  
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editDetails, setEditDetails] = useState({ name: '', type: 'checkings', account_type: 'General' });

  const loadAccounts = async () => {
    const rows = await sqliteClient.query('SELECT * FROM accounts ORDER BY name ASC');
    setAccounts(rows);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    setNewSubType(SUBTYPES[newType]?.[0] || 'General');
  }, [newType]);

  const addAccount = async () => {
    if (!newName) return;
    const id = newName.toLowerCase().replace(/\s+/g, '_');
    try {
      await sqliteClient.execute(
        'INSERT INTO accounts (id, name, type, account_type) VALUES (?, ?, ?, ?)',
        [id, newName, newType, newSubType]
      );
      setNewName('');
      loadAccounts();
    } catch (err) {
      alert('Failed to add account: ' + err.message);
    }
  };

  const deleteAccount = async (id) => {
    if (id === 'default_account') {
      alert('Cannot delete the default account.');
      return;
    }
    if (!confirm('Are you sure? This will NOT delete transactions, but they will become unlinked.')) return;
    try {
      await sqliteClient.execute('DELETE FROM accounts WHERE id = ?', [id]);
      loadAccounts();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const updateBalance = async (id, amount) => {
    try {
      // Get current balance first
      const acc = accounts.find(a => a.id === id);
      const oldCents = acc ? acc.current_balance : 0;
      
      // Store as cents
      const cents = Math.round(parseFloat(amount) * 100);
      await sqliteClient.execute(
        'UPDATE accounts SET previous_balance = ?, current_balance = ? WHERE id = ?',
        [oldCents, cents, id]
      );
      setEditingBalanceId(null);
      loadAccounts();
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  };

  const startEditDetails = (acc) => {
    setEditingAccountId(acc.id);
    setEditDetails({ 
      name: acc.name, 
      type: acc.type, 
      account_type: acc.account_type || SUBTYPES[acc.type]?.[0] || 'General' 
    });
  };

  const handleEditTypeChange = (e) => {
    const t = e.target.value;
    setEditDetails({ ...editDetails, type: t, account_type: SUBTYPES[t]?.[0] || 'General' });
  };

  const saveEditDetails = async () => {
    try {
      await sqliteClient.execute(
        'UPDATE accounts SET name = ?, type = ?, account_type = ? WHERE id = ?',
        [editDetails.name, editDetails.type, editDetails.account_type, editingAccountId]
      );
      setEditingAccountId(null);
      loadAccounts();
    } catch (err) {
      alert('Failed to save account details: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <section className="glass-card p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Wallet className="text-sky-400" />
          Account Management
        </h3>

        {/* Add Account Form */}
        <div className="flex gap-4 mb-8 bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Account Name</label>
            <input 
              type="text" 
              placeholder="e.g. Discovery Credit, FNB Savings, Investment Portfolio" 
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type</label>
            <select 
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none"
            >
              <option value="checkings">Checkings</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="loan">Loan</option>
            </select>
          </div>
          <div className="w-48">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sub-Type</label>
            <select 
              value={newSubType}
              onChange={e => setNewSubType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none"
            >
              {(SUBTYPES[newType] || ['General']).map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={addAccount}
              className="px-6 py-2 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Add
            </button>
          </div>
        </div>

        {/* Account List */}
        <div className="grid grid-cols-1 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all group">
              {editingAccountId === acc.id ? (
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-sky-400">
                    <Edit2 size={24} />
                  </div>
                  <div className="flex gap-3 flex-1">
                    <input 
                      type="text" 
                      value={editDetails.name} 
                      onChange={e => setEditDetails({...editDetails, name: e.target.value})}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none flex-1"
                    />
                    <select 
                      value={editDetails.type}
                      onChange={handleEditTypeChange}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none w-32"
                    >
                      <option value="checkings">Checkings</option>
                      <option value="savings">Savings</option>
                      <option value="credit">Credit Card</option>
                      <option value="investment">Investment</option>
                      <option value="loan">Loan</option>
                    </select>
                    <select 
                      value={editDetails.account_type}
                      onChange={e => setEditDetails({...editDetails, account_type: e.target.value})}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none w-40"
                    >
                      {(SUBTYPES[editDetails.type] || ['General']).map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    <button onClick={saveEditDetails} className="px-4 py-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20"><Save size={18} /></button>
                    <button onClick={() => setEditingAccountId(null)} className="px-4 py-2 text-slate-400">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/10 transition-colors">
                    {acc.type === 'credit' ? <CreditCard size={24} /> : <PiggyBank size={24} />}
                  </div>
                  <div>
                    <div className="font-bold text-white">{acc.name}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest">{acc.type} • {acc.account_type || 'General'}</div>
                  </div>
                </div>
              )}

              {/* Manual Balance Tracking */}
              <div className="flex items-center gap-4 px-6 border-l border-slate-800">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current Value</div>
                  {editingBalanceId === acc.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">R</span>
                      <input 
                        type="number"
                        step="0.01"
                        autoFocus
                        value={tempBalance}
                        onChange={e => setTempBalance(e.target.value)}
                        className="w-48 bg-slate-900 border-2 border-sky-500/50 rounded-xl px-4 py-3 text-xl font-mono text-white outline-none shadow-2xl"
                      />
                      <button 
                        onClick={() => updateBalance(acc.id, tempBalance)}
                        className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Save size={20} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        setEditingBalanceId(acc.id);
                        setTempBalance((acc.current_balance / 100).toFixed(2));
                      }}
                      className="text-lg font-mono font-bold text-sky-400 cursor-pointer hover:text-sky-300 transition-colors"
                    >
                      R{(acc.current_balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                
                {acc.id !== 'default_account' && (
                  <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => startEditDetails(acc)}
                      className="p-2 text-slate-600 hover:text-sky-400 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => deleteAccount(acc.id)}
                      className="p-2 text-slate-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Portability Section */}
      <section className="glass-card p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" />
          Data Portability
        </h3>
        <p className="text-slate-500 text-sm mb-6">
          Your data is stored locally in this app. Use the options below to manually export your database for backup or to move it to another device.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={async () => {
              const buffer = await sqliteClient.exportDb();
              if (window.electronAPI) {
                await window.electronAPI.exportDbManual(buffer);
              } else {
                // Browser fallback: Download file
                const blob = new Blob([buffer], { type: 'application/x-sqlite3' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'budget_backup.sqlite';
                a.click();
              }
            }}
            className="px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-2"
          >
            <ShieldCheck size={18} /> Export SQLite Database
          </button>
        </div>
      </section>
    </div>
  );
}
