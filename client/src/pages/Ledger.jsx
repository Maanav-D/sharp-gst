import { useState, useEffect } from 'react';
import { ledgerApi } from '../api/client';
import { formatINR, formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import { Plus, BookOpen, Scale } from 'lucide-react';

export default function Ledger() {
  const [tab, setTab] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ account_name: '', account_type: '' });
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    account_name: '', account_type: 'ASSET', debit: '', credit: '', narration: '',
  });

  useEffect(() => {
    Promise.all([
      ledgerApi.getAll(filters),
      ledgerApi.getAccounts(),
      ledgerApi.getTrialBalance(),
    ]).then(([e, a, tb]) => {
      setEntries(e);
      setAccounts(a);
      setTrialBalance(tb);
    }).finally(() => setLoading(false));
  }, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await ledgerApi.create({
        ...form,
        debit: form.debit || '0.00',
        credit: form.credit || '0.00',
        reference_id: '', reference_type: 'MANUAL',
      });
      toast.success('Journal entry created');
      setShowForm(false);
      setForm({ date: new Date().toISOString().split('T')[0], account_name: '', account_type: 'ASSET', debit: '', credit: '', narration: '' });
      // Refresh
      const [e2, a2, tb2] = await Promise.all([ledgerApi.getAll(filters), ledgerApi.getAccounts(), ledgerApi.getTrialBalance()]);
      setEntries(e2); setAccounts(a2); setTrialBalance(tb2);
    } catch { toast.error('Failed to create entry'); }
  };

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Ledger</h1>
      <div className="bg-white rounded-xl p-6 h-64 animate-pulse"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Ledger</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> New Entry
        </button>
      </div>

      {/* Manual entry form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Manual Journal Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account Name</label>
              <input value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required placeholder="e.g., Bank" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account Type</label>
              <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Narration</label>
              <input value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Description" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Debit (₹)</label>
              <input type="number" step="0.01" value={form.debit} onChange={e => setForm({ ...form, debit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Credit (₹)</label>
              <input type="number" step="0.01" value={form.credit} onChange={e => setForm({ ...form, credit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'entries', label: 'Journal Entries', icon: BookOpen },
          { key: 'accounts', label: 'Account Summary', icon: BookOpen },
          { key: 'trial', label: 'Trial Balance', icon: Scale },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md ${
              tab === t.key ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters for entries tab */}
      {tab === 'entries' && (
        <div className="flex gap-3">
          <input placeholder="Filter by account name..." value={filters.account_name}
            onChange={e => setFilters({ ...filters, account_name: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64" />
          <select value={filters.account_type} onChange={e => setFilters({ ...filters, account_type: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Types</option>
            {['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Journal entries */}
      {tab === 'entries' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Account</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Debit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Credit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Narration</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No journal entries found</td></tr>
              ) : entries.map((e, i) => (
                <tr key={e.id} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                  <td className="px-4 py-2">{formatDate(e.date)}</td>
                  <td className="px-4 py-2 font-medium">{e.account_name}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{e.account_type}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{Number(e.debit) > 0 ? formatINR(e.debit) : '-'}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(e.credit) > 0 ? formatINR(e.credit) : '-'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{e.narration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Account Summary */}
      {tab === 'accounts' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Account</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total Debit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total Credit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={a.account_name} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`}>
                  <td className="px-4 py-2.5 font-medium">{a.account_name}</td>
                  <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{a.account_type}</span></td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatINR(a.total_debit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatINR(a.total_credit)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${Number(a.balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatINR(a.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trial Balance */}
      {tab === 'trial' && trialBalance && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 border ${trialBalance.balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-sm">
              {trialBalance.balanced
                ? '✓ Trial balance is balanced — Total Debits equal Total Credits'
                : '✗ Trial balance is NOT balanced — please review entries'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Debit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Credit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Balance</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.accounts.map((a, i) => (
                  <tr key={a.account_name} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium">{a.account_name}</td>
                    <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{a.account_type}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatINR(a.total_debit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatINR(a.total_credit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatINR(a.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                  <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(trialBalance.total_debits)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(trialBalance.total_credits)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatINR(Number(trialBalance.total_debits) - Number(trialBalance.total_credits))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
