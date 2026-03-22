import { useState, useEffect } from 'react';
import { settingsApi } from '../api/client';
import { INDIAN_STATES } from '../utils/format';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [form, setForm] = useState({
    business_name: '', gstin: '', address: '', state: '', state_code: '',
    email: '', phone: '', invoice_prefix: 'INV', fiscal_year_start: '04',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then(data => setForm(data)).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(form);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
    setSaving(false);
  };

  const handleStateChange = (code) => {
    const state = INDIAN_STATES.find(s => s.code === code);
    setForm(f => ({ ...f, state_code: code, state: state ? state.name : '' }));
  };

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      <div className="bg-white rounded-xl p-6 h-64 animate-pulse"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6 max-w-2xl">
        <h3 className="text-sm font-semibold text-gray-700">Business Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Business Name</label>
            <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">GSTIN</label>
            <input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500" maxLength={15} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" rows={2} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
            <select value={form.state_code} onChange={e => handleStateChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">State Code</label>
            <input value={form.state_code} readOnly
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <h3 className="text-sm font-semibold text-gray-700 pt-4">Invoice Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Prefix</label>
            <input value={form.invoice_prefix} onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fiscal Year Start Month</label>
            <select value={form.fiscal_year_start} onChange={e => setForm(f => ({ ...f, fiscal_year_start: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              {Array.from({ length: 12 }, (_, i) => {
                const month = String(i + 1).padStart(2, '0');
                return <option key={month} value={month}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>;
              })}
            </select>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
