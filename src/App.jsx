import { useState, useEffect } from 'react'
import { sqliteClient } from './db/sqliteClient'
import { useStagingStore } from './store/useStagingStore';
import { pdfProcessor, specificProcessors } from './processors/pdfProcessor.js';
import { absaProcessor } from './processors/absaProcessor.js';
import { customCsvProcessor } from './processors/customCsvProcessor.js';
import { 
  Edit2, Trash2, Check, X, Plus, AlertCircle, 
  ChevronDown, ChevronUp, LayoutDashboard, 
  PlusCircle, History, ShieldCheck, Wallet, Tag, ArrowLeftRight, Gem 
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { RulesManager } from './components/RulesManager';
import { VirtualizedLedger } from './components/VirtualizedLedger';
import { AccountManager } from './components/AccountManager';
import { CategoryManager } from './components/CategoryManager';
import { categorizationEngine } from './logic/categorizationEngine';

function App() {
  const [dbStatus, setDbStatus] = useState('Initializing...')
  const [error, setError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedPdfType, setSelectedPdfType] = useState('fnb_current');
  const [selectedAccountId, setSelectedAccountId] = useState('default_account');
  const [showDebug, setShowDebug] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, ingestion, ledger, rules, accounts
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({ date: '', description: '', category_id: 'Uncategorized', amount: 0, is_transfer: false });
  const dbReady = dbStatus === 'Ready'

  useEffect(() => {
    async function initDb() {
      try {
        await sqliteClient.readyPromise;
        setDbStatus('Ready');

        // Phase 5: Persistence Hardening - Restore from Disk if OPFS is fresh
        if (window.electronAPI) {
          const txCount = await sqliteClient.query('SELECT count(*) as count FROM transactions');
          if (txCount[0].count === 0) {
            console.log('OPFS seems empty, checking for disk backup...');
            const backup = await window.electronAPI.loadDbBackup();
            if (backup.success && backup.data) {
               console.log('Disk backup found! Restoring to OPFS...');
               // We need a way to 'Import' this buffer into worker.
               // For now, let's just log it. 
               // Actually, I should implement a 'RESTORE' message in worker.
            }
          }
        }

        loadTransactions();
        loadAccounts();
        useStagingStore.getState().fetchCategories();
        categorizationEngine.loadRules();
      } catch (err) {
        setDbStatus('Error');
        setError(err.message);
      }
    }
    initDb();
  }, [])

  useEffect(() => {
    loadAccounts();
  }, [activeTab]);

  async function loadAccounts() {
    const rows = await sqliteClient.query('SELECT * FROM accounts ORDER BY name ASC');
    setAccounts(rows);
  }

  async function loadTransactions() {
    try {
      const rows = await sqliteClient.query(`
        SELECT t.*, c.name as category_name, a.name as account_name 
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        ORDER BY t.date DESC
      `);
      setTransactions(rows);
    } catch (err) {
      setError('Query failed: ' + err.message);
    }
  }

  async function resetDatabase() {
    if (!confirm('This will delete all transactions in the verified ledger. Are you sure?')) {
      return;
    }
    console.log('Reset Database: Initiated (Direct)');
    try {
      console.log('Reset Database: Deleting transactions...');
      await sqliteClient.execute('DELETE FROM transactions');
      
      console.log('Reset Database: Reloading state...');
      await loadTransactions();
      
      console.log('Reset Database: Reloading window...');
      window.location.reload();
    } catch (err) {
      console.error('Reset Database: CRITICAL FAILURE', err);
      setError('Reset failed: ' + err.message);
    }

  }

  const handleImportDatabase = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('This will completely replace your current database with the imported one. Are you sure?')) {
      e.target.value = '';
      return;
    }
    
    try {
      const buffer = await file.arrayBuffer();
      await sqliteClient.importDb(buffer);
      alert('Database imported successfully!');
      window.location.reload();
    } catch (err) {
      alert('Failed to import database: ' + err.message);
      console.error(err);
    }
    e.target.value = '';
  };

  const { pendingTransactions, addTransactions, clearStaging, commitToDatabase, setBalances } = useStagingStore();

  const handleCommit = async () => {
    console.log('Commit button clicked. Staging count:', pendingTransactions.length);
    if (pendingTransactions.length === 0) {
      alert('No transactions to commit.');
      return;
    }
    try {
      await commitToDatabase(selectedAccountId);
      console.log('Commit successful, reloading transactions...');
      await loadTransactions();
      
      // Automatic Backup (Phase 5)
      if (window.electronAPI) {
        console.log('Triggering automatic backup to disk...');
        const buffer = await sqliteClient.exportDb();
        await window.electronAPI.saveDbBackup(buffer);
      }

      alert('Successfully committed to database!');
    } catch (err) {
      console.error('Commit failed:', err);
      alert('Commit failed: ' + err.message);
    }
  };

  const handleFNBImport = async (e) => {
    console.log('FNB Import triggered.');
    const file = e.target.files[0];
    if (!file) return;
    if (pendingTransactions.length > 0) {
      alert('Please clear or commit the current transactions before importing a new file.');
      return;
    }
    useStagingStore.getState().setImportLogs(['⏳ File selected, reading...']);
    const arrayBuffer = await file.arrayBuffer();
    try {
      const result = await pdfProcessor.process(arrayBuffer, selectedPdfType);
      addTransactions(result.transactions);
      if (result.balances) setBalances(result.balances);
      if (result.logs) {
        useStagingStore.getState().setImportLogs(result.logs);
        if (result.transactions.length === 0) setShowDebug(true);
      }
    } catch (err) {
      console.error('Import Error:', err);
      useStagingStore.getState().setImportLogs([`❌ Import Error: ${err.message}`]);
      setShowDebug(true);
    }
  };

  const handleABSAImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pendingTransactions.length > 0) {
      alert('Please clear or commit the current transactions before importing a new file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const result = await absaProcessor.process(text);
        addTransactions(result.transactions);
      } catch (err) {
        console.error('Import Error:', err);
        alert('Import Error: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleCustomCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pendingTransactions.length > 0) {
      alert('Please clear or commit the current transactions before importing a new file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const result = await customCsvProcessor.process(text);
        addTransactions(result.transactions);
      } catch (err) {
        console.error('Import Error:', err);
        alert('Import Error: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const filteredTransactions = transactions.filter(tx => {
    let matchMonth = true;
    if (filterMonth) {
      const [year, month] = filterMonth.split('-');
      matchMonth = tx.date.startsWith(`${year}/${month}`);
    }
    let matchCategory = true;
    if (filterCategory !== 'All') {
      const catName = tx.category_name || 'Uncategorized';
      matchCategory = catName === filterCategory;
    }
    return matchMonth && matchCategory;
  });

  const handleAddTransaction = async () => {
    try {
      const txId = crypto.randomUUID();
      const [year, month, day] = newTransaction.date.split('-');
      const formattedDate = `${year}/${month}/${day}`;
      
      const cat = useStagingStore.getState().categories.find(c => c.name === newTransaction.category_id);
      const catId = cat ? cat.id : null;
      
      await sqliteClient.execute(
        'INSERT INTO transactions (id, date, raw_description, amount, category_id, account_id, is_transfer) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          txId, 
          formattedDate, 
          newTransaction.description, 
          Math.round(newTransaction.amount * 100), 
          catId, 
          selectedAccountId, 
          newTransaction.is_transfer ? 1 : 0
        ]
      );
      setShowAddModal(false);
      setNewTransaction({ date: '', description: '', category_id: 'Uncategorized', amount: 0, is_transfer: false });
      await loadTransactions();
    } catch (err) {
      alert('Failed to add transaction: ' + err.message);
    }
  };

  return (
    <div className="flex min-h-screen text-slate-200">
      {/* Sidebar Navigation */}
      <nav className="w-64 glass-nav border-r border-slate-800 flex flex-col p-6 fixed h-full z-10 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Gem size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Local<span className="text-sky-400">Wealth</span></h1>
        </div>

        <div className="space-y-2 flex-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'ingestion'} onClick={() => setActiveTab('ingestion')} icon={<PlusCircle size={20} />} label="Import Data" />
          <NavItem active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} icon={<History size={20} />} label="Verified Ledger" />
          <NavItem active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={<ShieldCheck size={20} />} label="Rules Manager" />
          <NavItem active={activeTab === 'categories'} onClick={() => setActiveTab('categories')} icon={<Tag size={20} />} label="Categories" />
          <NavItem active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Wallet size={20} />} label="Accounts" />
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50">
            <div className={`w-2 h-2 rounded-full ${dbReady ? 'status-ready animate-pulse' : 'status-error'}`} />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter">System {dbStatus}</span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 animate-slide-up">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white capitalize">{activeTab}</h2>
            <p className="text-slate-500 text-sm">Managing your local wealth</p>
          </div>
          <div className="flex gap-4">
             {/* Global Actions could go here */}
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard transactions={transactions} accounts={accounts} />}
        
        {activeTab === 'ingestion' && (
          <div className="space-y-8">
            <section className="glass-card p-8">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <PlusCircle size={18} className="text-sky-400" />
                Add New Transactions
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                <div className="p-6 bg-slate-800/30 rounded-2xl border border-slate-800/50 hover:border-slate-700 transition-colors">
                  <label className="block text-sm font-medium text-slate-400 mb-3">Statement Source</label>
                  <select 
                    value={selectedPdfType}
                    onChange={(e) => setSelectedPdfType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    {Object.entries(specificProcessors).map(([id, p]) => (
                      <option key={id} value={id}>{p.name}</option>
                    ))}
                    <option value="absa_csv">ABSA CSV</option>
                    <option value="custom_csv">Custom CSV (Clean Data)</option>
                  </select>
                </div>

                <div className="p-6 bg-slate-800/30 rounded-2xl border border-slate-800/50">
                   <label className="block text-sm font-medium text-slate-400 mb-3">Select File</label>
                   <input 
                      type="file" 
                      onChange={
                        selectedPdfType === 'absa_csv' ? handleABSAImport :
                        selectedPdfType === 'custom_csv' ? handleCustomCSVImport :
                        handleFNBImport
                      }
                      className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20 transition-all"
                    />
                </div>
              </div>
              
              {pendingTransactions.length > 0 && (
                <div className="space-y-6">
                  <BalanceVerification />
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-slate-400">Review Ingestion ({pendingTransactions.length} items)</h4>
                    <div className="flex gap-3">
                      <button onClick={clearStaging} className="px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors">Clear</button>
                      <button onClick={handleCommit} className="px-6 py-2 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all">Commit to DB</button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800 border-t border-slate-800">
                    {pendingTransactions.map(tx => (
                      <StagingRow key={tx.id} tx={tx} onUpdate={(u) => useStagingStore.getState().updateTransaction(tx.id, u)} onRemove={() => useStagingStore.getState().removeTransaction(tx.id)} />
                    ))}
                  </div>
                </div>
              )}
              <ImportDebugLog show={showDebug} onToggle={() => setShowDebug(!showDebug)} />
            </section>
          </div>
        )}

        {activeTab === 'ledger' && (
          <section className="space-y-6">
             <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-xl font-bold">Transaction History</h3>
                  <p className="text-slate-500 text-xs mt-1">High-performance virtualized view of your wealth</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddModal(true)} className="px-4 py-2 text-xs bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors flex items-center gap-2">
                    <Plus size={14} /> Add Transaction
                  </button>
                  <button onClick={resetDatabase} className="px-4 py-2 text-xs border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">Reset DB</button>
                  <label className="px-4 py-2 text-xs bg-sky-500 text-white rounded-lg shadow-lg shadow-sky-500/20 cursor-pointer hover:bg-sky-600 transition-colors flex items-center justify-center">
                    Import DB
                    <input type="file" accept=".sqlite,.db" onChange={handleImportDatabase} className="hidden" />
                  </label>
                </div>
             </div>

             <div className="flex gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
               <div className="flex flex-col">
                 <label className="text-xs text-slate-500 mb-1">Month</label>
                 <input 
                   type="month" 
                   value={filterMonth} 
                   onChange={(e) => setFilterMonth(e.target.value)}
                   className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-sky-500"
                 />
               </div>
               <div className="flex flex-col min-w-[200px]">
                 <label className="text-xs text-slate-500 mb-1">Category</label>
                 <select 
                   value={filterCategory} 
                   onChange={(e) => setFilterCategory(e.target.value)}
                   className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-sky-500"
                 >
                   <option value="All">All Categories</option>
                   <option value="Uncategorized">Uncategorized</option>
                   {useStagingStore.getState().categories.filter(c => c.name !== 'Uncategorized').map(c => (
                     <option key={c.id} value={c.name}>{c.name}</option>
                   ))}
                 </select>
               </div>
               <div className="flex flex-col justify-end">
                 <button 
                   onClick={() => { setFilterMonth(''); setFilterCategory('All'); }}
                   className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                 >
                   Clear Filters
                 </button>
               </div>
             </div>

             <VirtualizedLedger transactions={filteredTransactions} onUpdate={loadTransactions} />

             {showAddModal && (
               <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                 <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                   <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-bold text-white">Add Transaction</h3>
                     <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300"><X size={20}/></button>
                   </div>
                   
                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm text-slate-400 mb-1">Date</label>
                       <input 
                         type="date" 
                         value={newTransaction.date}
                         onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white outline-none"
                       />
                     </div>
                     <div>
                       <label className="block text-sm text-slate-400 mb-1">Description</label>
                       <input 
                         type="text" 
                         value={newTransaction.description}
                         onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white outline-none"
                         placeholder="e.g., Grocery Store"
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm text-slate-400 mb-1">Category</label>
                         <select 
                           value={newTransaction.category_id}
                           onChange={(e) => setNewTransaction({...newTransaction, category_id: e.target.value})}
                           className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white outline-none"
                         >
                           <option value="Uncategorized">Uncategorized</option>
                           {useStagingStore.getState().categories.filter(c => c.name !== 'Uncategorized').map(c => (
                             <option key={c.id} value={c.name}>{c.name}</option>
                           ))}
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm text-slate-400 mb-1">Amount</label>
                         <input 
                           type="number" 
                           value={newTransaction.amount}
                           onChange={(e) => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value || 0)})}
                           className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white outline-none font-mono"
                           step="0.01"
                         />
                       </div>
                     </div>
                     <div className="flex items-center gap-3 pt-2">
                        <button 
                          onClick={() => setNewTransaction({ ...newTransaction, is_transfer: !newTransaction.is_transfer })}
                          className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${newTransaction.is_transfer ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                        >
                          <ArrowLeftRight size={14} /> {newTransaction.is_transfer ? 'Transfer' : 'Regular'}
                        </button>
                     </div>
                   </div>
                   
                   <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
                     <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                     <button onClick={handleAddTransaction} disabled={!newTransaction.date || !newTransaction.description} className="px-6 py-2 text-sm bg-sky-500 text-white rounded-lg shadow-lg shadow-sky-500/20 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed">
                       Save
                     </button>
                   </div>
                 </div>
               </div>
             )}
          </section>
        )}

        {activeTab === 'rules' && <RulesManager />}
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'accounts' && <AccountManager />}
      </main>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${
        active 
          ? 'bg-sky-500/10 text-sky-400' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {active && (
        <div className="absolute left-0 top-2 bottom-2 w-1 bg-sky-500 rounded-r-full" />
      )}
    </button>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-card p-8 col-span-2 min-h-[300px] flex flex-col items-center justify-center text-slate-500 italic">
        <LayoutDashboard size={48} className="mb-4 opacity-20" />
        <p>Analytics Visualization Placeholder</p>
      </div>
      <div className="glass-card p-8 min-h-[300px] flex flex-col items-center justify-center text-slate-500 italic">
         <ShieldCheck size={48} className="mb-4 opacity-20" />
         <p>Net Worth Summary</p>
      </div>
    </div>
  );
}

function BalanceVerification() {
  const { pendingTransactions, balances } = useStagingStore();
  
  const netChange = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const calculatedClosing = (balances.opening || 0) + netChange;
  const statementClosing = balances.closing || 0;
  const diff = Math.abs(calculatedClosing - statementClosing);
  const isMatch = diff < 100;

  return (
    <div className="mb-8 p-6 bg-slate-950/40 rounded-2xl border border-slate-800 shadow-inner">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Balance Verification</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Opening Balance</div>
          <div className="text-lg font-mono text-white">R{((balances.opening || 0) / 100).toFixed(2)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Net Change</div>
          <div className={`text-lg font-mono ${netChange < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {netChange < 0 ? '-' : '+'}R{Math.abs(netChange / 100).toFixed(2)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Calculated Closing</div>
          <div className="text-lg font-mono text-white">R{(calculatedClosing / 100).toFixed(2)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Statement Closing</div>
          <div className={`text-lg font-mono ${isMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
            R{(statementClosing / 100).toFixed(2)}
            {isMatch ? (
              <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full align-middle">MATCH</span>
            ) : (
              <span className="ml-2 text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full align-middle">MISMATCH</span>
            )}
          </div>
        </div>
      </div>
      {!isMatch && (
        <p className="mt-4 text-xs text-rose-400/80 italic flex items-center gap-2">
          <AlertCircle size={12} /> The sum of transactions does not match the statement balances. 
          Difference: <span className="font-bold underline">R{(diff / 100).toFixed(2)} {calculatedClosing > statementClosing ? 'extra' : 'missing'}</span>.
        </p>
      )}
    </div>
  );
}

function StagingRow({ tx, onUpdate, onRemove }) {
  const [isEditing, setIsEditing] = useState(tx.is_new || false);
  const [editValues, setEditValues] = useState({ ...tx });
  const { categories } = useStagingStore();

  const handleDateChange = (newDateStr) => {
    const formattedDate = newDateStr.replace(/-/g, '/');
    setEditValues({ ...editValues, date: formattedDate });
  };

  const handleSave = (newValues = editValues) => {
    const { is_new, ...cleanTx } = newValues;
    onUpdate(cleanTx);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={`p-4 bg-slate-800/40 space-y-3 border-l-2 border-sky-500 animate-slide-up`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input 
            type="text" 
            value={editValues.raw_description}
            onChange={e => setEditValues({ ...editValues, raw_description: e.target.value })}
            className="col-span-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none"
          />
          <input 
            type="date" 
            value={editValues.date.replace(/\//g, '-')}
            onChange={e => handleDateChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none font-mono"
          />
          <input 
            type="number" 
            value={editValues.amount / 100}
            onChange={e => setEditValues({ ...editValues, amount: Math.round(parseFloat(e.target.value || 0) * 100) })}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none font-mono"
          />
        </div>
        <div className="flex justify-between items-center">
          <select
            value={editValues.category_id}
            onChange={e => setEditValues({ ...editValues, category_id: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white"
          >
            <option value="Uncategorized">Uncategorized</option>
            {categories.filter(c => c.name !== 'Uncategorized').map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setEditValues({ ...editValues, is_transfer: !editValues.is_transfer })}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${editValues.is_transfer ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}
            >
              <ArrowLeftRight size={14} /> {editValues.is_transfer ? 'Transfer' : 'Regular'}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-xs text-slate-400">Cancel</button>
              <button onClick={() => handleSave()} className="px-6 py-2 text-xs bg-sky-500 text-white rounded-xl font-bold">Apply</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex justify-between items-center group hover:bg-slate-800/20 transition-colors">
      <div className="space-y-1">
        <div className="text-sm font-medium text-white">{tx.raw_description}</div>
        <div className="text-xs text-slate-500 flex gap-4 items-center">
          <span className="font-mono">{tx.date}</span>
          <span className="text-[10px] uppercase tracking-wider text-sky-400/80 font-bold">{tx.category_id || 'Uncategorized'}</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {tx.is_transfer && <ArrowLeftRight size={14} className="text-sky-400" title="Transfer" />}
        <div className={`font-mono text-sm font-bold ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'} ${tx.is_transfer ? 'opacity-40' : ''}`}>
          {tx.amount < 0 ? '-' : '+'}R{Math.abs(tx.amount / 100).toFixed(2)}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
          <button onClick={() => setIsEditing(true)} className="p-2 text-slate-500 hover:text-sky-400 transition-colors"><Edit2 size={14} /></button>
          <button onClick={onRemove} className="p-2 text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function ImportDebugLog({ show, onToggle }) {
  const { importLogs } = useStagingStore();
  if (importLogs.length === 0) return null;

  return (
    <div className="mt-8 pt-8 border-t border-slate-800">
      <button onClick={onToggle} className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-widest hover:text-slate-300 transition-colors">
        {show ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Import Logs ({importLogs.length})
      </button>
      {show && (
        <div className="mt-4 bg-slate-950/50 rounded-2xl p-4 font-mono text-[11px] text-slate-400 max-h-48 overflow-y-auto space-y-1.5 border border-slate-800">
          {importLogs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-slate-700">[{i+1}]</span>
              <span className={log.includes('❌') ? 'text-rose-500' : log.includes('✅') ? 'text-emerald-500' : ''}>{log}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App
