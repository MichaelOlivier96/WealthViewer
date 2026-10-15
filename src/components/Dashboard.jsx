import React, { useMemo, useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Landmark, 
  ChevronLeft, ChevronRight, Calendar, MoveUpRight, MoveDownRight 
} from 'lucide-react';

export function Dashboard({ transactions, accounts = [] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Ensuring the layout is fully painted before rendering charts
    const timer = setTimeout(() => setIsReady(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // 0. Current Selected Month filtering
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthLabel = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. Calculate Net Worth (Fixing Cents vs Rands mismatch)
  const netWorth = useMemo(() => {
    const ledgerSum = transactions
      .filter(tx => !tx.is_transfer)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const manualSum = accounts
      .filter(a => a.id !== 'default_account')
      .reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    // Both ledgerSum and manualSum are in cents. Add them first, then divide.
    return (ledgerSum + manualSum) / 100;
  }, [transactions, accounts]);

  // 2. Calculate Net Worth Delta (Monthly change for viewed month)
  const netWorthDelta = useMemo(() => {
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    
    const ledgerSumTargetMonth = transactions
      .filter(tx => {
         if (tx.is_transfer) return false;
         const d = new Date(tx.date);
         return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
      
    let manualDelta = 0;
    if (monthOffset === 0) {
       manualDelta = accounts
         .filter(a => a.id !== 'default_account')
         .reduce((sum, acc) => sum + ((acc.current_balance || 0) - (acc.previous_balance || 0)), 0);
    }
    
    return (ledgerSumTargetMonth + manualDelta) / 100;
  }, [transactions, accounts, targetDate, monthOffset]);

  // 3. Prepare Data for Balance History
  const chartData = useMemo(() => {
    let currentBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
    const sortedTxs = [...transactions].filter(tx => !tx.is_transfer).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return sortedTxs.reduce((acc, tx) => {
      currentBalance += tx.amount;
      const last = acc[acc.length - 1];
      if (last && last.date === tx.date) {
        last.balance = currentBalance / 100;
      } else {
        acc.push({ date: tx.date, balance: currentBalance / 100 });
      }
      return acc;
    }, []);
  }, [transactions, accounts]);

  // 5. Category Spending (Pie Chart)
  const categoryData = useMemo(() => {
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    const spending = transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return tx.amount < 0 && 
               !tx.is_transfer && 
               txDate.getMonth() === targetMonth && 
               txDate.getFullYear() === targetYear;
      })
      .reduce((acc, tx) => {
        const cat = tx.category_name || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount / 100);
        return acc;
      }, {});

    return Object.entries(spending)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, targetDate]);

  // 6. Category Income (Pie Chart)
  const incomeCategoryData = useMemo(() => {
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    const income = transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return tx.amount > 0 && 
               !tx.is_transfer && 
               txDate.getMonth() === targetMonth && 
               txDate.getFullYear() === targetYear;
      })
      .reduce((acc, tx) => {
        const cat = tx.category_name || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + (tx.amount / 100);
        return acc;
      }, {});

    return Object.entries(income)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, targetDate]);

  const totalSpending = useMemo(() => categoryData.reduce((sum, item) => sum + item.value, 0), [categoryData]);
  const totalIncome = useMemo(() => incomeCategoryData.reduce((sum, item) => sum + item.value, 0), [incomeCategoryData]);

  const groupedAccounts = useMemo(() => {
    const groups = accounts.filter(a => a.id !== 'default_account').reduce((acc, account) => {
      const type = account.type || 'other';
      if (!acc[type]) acc[type] = { total: 0, items: {} };
      
      const subType = account.account_type || 'General';
      if (!acc[type].items[subType]) acc[type].items[subType] = [];
      
      acc[type].items[subType].push(account);
      acc[type].total += (account.current_balance || 0);
      return acc;
    }, {});

    return Object.entries(groups).map(([type, data]) => ({
      type,
      total: data.total,
      subTypes: Object.entries(data.items).map(([subType, accts]) => ({
        subType,
        accounts: accts
      }))
    })).sort((a, b) => b.total - a.total);
  }, [accounts]);

  const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b', '#10b981'];
  const INCOME_COLORS = ['#10b981', '#059669', '#047857', '#065f46', '#34d399', '#6ee7b7'];



  return (
    <div className="space-y-8 pb-12">
      {/* Top Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-8 col-span-1 md:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={120} className="text-sky-400" />
          </div>
          <div className="relative z-10">
            <p className="text-slate-400 font-medium mb-2 flex items-center gap-2">
              <Wallet size={16} /> Total Net Worth
            </p>
            <div className="flex items-baseline gap-4">
              <h1 className="text-6xl font-black text-white tracking-tighter">
                R{netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h1>
              {netWorthDelta !== 0 && (
                <div className={`flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${netWorthDelta > 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>
                  {netWorthDelta > 0 ? <MoveUpRight size={14} /> : <MoveDownRight size={14} />}
                  R{Math.abs(netWorthDelta).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-6">
              <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-400/10 px-3 py-1 rounded-full uppercase tracking-widest">
                <Landmark size={12} /> {accounts.length} Accounts Connected
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
           <div className="glass-card p-6 border-l-4 border-emerald-500">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Manual Assets</p>
              <p className="text-2xl font-bold text-white">R{(accounts.filter(a => a.id !== 'default_account').reduce((sum, acc) => sum + (acc.current_balance || 0), 0) / 100).toLocaleString()}</p>
           </div>
           <div className="glass-card p-6 border-l-4 border-sky-500">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Ledger Sum</p>
              <p className="text-2xl font-bold text-white">R{(transactions.filter(tx => !tx.is_transfer).reduce((sum, tx) => sum + tx.amount, 0) / 100).toLocaleString()}</p>
           </div>
        </div>
      </div>

      {/* Account Breakdown */}
      <section className="glass-card p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
          <Landmark className="text-sky-400" size={20} />
          Account Balances
        </h3>
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x custom-scrollbar">
          {groupedAccounts.map(group => (
            <div key={group.type} className="flex-none w-80 bg-slate-900/40 rounded-2xl p-6 border border-slate-800/50 snap-start flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h4 className="text-sm font-bold text-white uppercase tracking-widest">{group.type}</h4>
                <span className="text-sm font-mono font-bold text-sky-400">
                  R{(group.total / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex-1 space-y-6">
                {group.subTypes.map(sub => (
                  <div key={sub.subType}>
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{sub.subType}</h5>
                    <div className="space-y-3">
                      {sub.accounts.map(acc => {
                        const delta = (acc.current_balance - (acc.previous_balance || 0)) / 100;
                        return (
                          <div key={acc.id} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 hover:border-sky-500/30 transition-all group relative">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">{acc.name}</p>
                              {delta !== 0 && (
                                <span className={`text-[10px] font-bold flex items-center ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-mono font-bold mt-1 text-slate-300">
                              R{(acc.current_balance / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8">
        {/* Net Worth Trend */}
        <div className="glass-card p-8 min-h-[450px] flex flex-col overflow-hidden">
          <h3 className="text-lg font-bold mb-6 text-white uppercase tracking-wider text-xs">Net Worth Trend</h3>
          <div className="flex-1 w-full h-full min-h-[300px]">
            {isReady && (
              <ResponsiveContainer width="99%" height="100%" debounce={50} minWidth={100} minHeight={100}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={10} 
                    minTickGap={30}
                    tickFormatter={(str) => {
                      const d = new Date(str);
                      return chartData.length > 365 ? d.getFullYear() : d.toLocaleString('default', { month: 'short' });
                    }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickFormatter={(val) => `R${(val/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(val) => [`R${val.toLocaleString()}`, 'Net Worth']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#0ea5e9" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 8, stroke: '#0ea5e9', strokeWidth: 2, fill: '#0f172a' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Category Breakdown */}
        <div className="glass-card p-8 min-h-[500px] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-6 relative">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Spending
            </h3>
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 z-10">
              <button onClick={() => setMonthOffset(o => o - 1)} className="p-1 hover:text-sky-400 transition-colors"><ChevronLeft size={16}/></button>
              <span className="text-xs font-bold text-white min-w-[100px] text-center flex items-center justify-center gap-2">
                <Calendar size={12} className="text-sky-400" /> {monthLabel}
              </span>
              <button onClick={() => setMonthOffset(o => o + 1)} className="p-1 hover:text-sky-400 transition-colors"><ChevronRight size={16}/></button>
            </div>
            {categoryData.length > 0 && (
              <div className="absolute top-10 right-0 text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Spent</div>
                <div className="text-lg font-bold text-rose-400">R{totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            )}
          </div>
          
          <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center">
            {categoryData.length > 0 ? (
              isReady && (
                <ResponsiveContainer width="99%" height="100%" debounce={50} minWidth={100} minHeight={100}>
                  <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} style={{ outline: 'none' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tick={{ fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickFormatter={(val) => `R${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#ffffff' }}
                      itemStyle={{ color: '#ffffff' }}
                      formatter={(value) => [`R${value.toLocaleString()}`, 'Amount']}
                      cursor={{ fill: '#1e293b' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ outline: 'none' }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <div className="text-slate-500 italic text-sm text-center">
                No spending data for this month.
              </div>
            )}
          </div>
        </div>

        {/* Monthly Income Breakdown */}
        <div className="glass-card p-8 min-h-[500px] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-6 relative">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Income
            </h3>
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 opacity-0 pointer-events-none z-10">
              <button className="p-1"><ChevronLeft size={16}/></button>
              <span className="text-xs font-bold min-w-[100px]">Filler</span>
              <button className="p-1"><ChevronRight size={16}/></button>
            </div>
            {incomeCategoryData.length > 0 && (
              <div className="absolute top-10 right-0 text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Earned</div>
                <div className="text-lg font-bold text-emerald-400">R{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            )}
          </div>
          
          <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center">
            {incomeCategoryData.length > 0 ? (
              isReady && (
                <ResponsiveContainer width="99%" height="100%" debounce={50} minWidth={100} minHeight={100}>
                  <BarChart data={incomeCategoryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} style={{ outline: 'none' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tick={{ fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickFormatter={(val) => `R${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#ffffff' }}
                      itemStyle={{ color: '#ffffff' }}
                      formatter={(value) => [`R${value.toLocaleString()}`, 'Amount']}
                      cursor={{ fill: '#1e293b' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {incomeCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} style={{ outline: 'none' }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <div className="text-slate-500 italic text-sm text-center">
                No income data for this month.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
