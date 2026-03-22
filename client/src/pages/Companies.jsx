import { useState, useEffect } from 'react';
import { companiesApi } from '../api/client';
import { useCompany } from '../context/CompanyContext';
import { Building2, Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' }, { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
];

const emptyForm = {
  business_name: '', gstin: '', address: '', state: '', state_code: '',
  email: '', phone: '', invoice_prefix: 'INV', fiscal_year_start: '04',
};

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { currentCompany, switchCompany, refreshCompanies } = useCompany();

  const load = async () => {
    try {
      const data = await companiesApi.getAll();
      setCompanies(data);
    } catch (err) {
      toast.error('Failed to load companies');
    }
  };

  useEffect(() => { load(); }, []);

  const handleStateChange = (stateCode) => {
    const state = INDIAN_STATES.find(s => s.code === stateCode);
    setForm(f => ({ ...f, state_code: stateCode, state: state ? state.name : '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.business_name.trim()) return toast.error('Business name is required');

    try {
      if (editing) {
        await companiesApi.update(editing, form);
        toast.success('Company updated');
      } else {
        await companiesApi.create(form);
        toast.success('Company created');
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
      await refreshCompanies();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleEdit = (company) => {
    setEditing(company.id);
    setForm({
      business_name: company.business_name || '',
      gstin: company.gstin || '',
      address: company.address || '',
      state: company.state || '',
      state_code: company.state_code || '',
      email: company.email || '',
      phone: company.phone || '',
      invoice_prefix: company.invoice_prefix || 'INV',
      fiscal_year_start: company.fiscal_year_start || '04',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this company? This cannot be undone.')) return;
    try {
      await companiesApi.remove(id);
      toast.success('Company deleted');
      await load();
      await refreshCompanies();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Companies</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your business entities</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Company
        </button>
      </div>

      {/* Company Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map(c => (
          <div
            key={c.id}
            className={`bg-white rounded-xl border p-5 transition-all ${
              currentCompany?.id === c.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Building2 size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{c.business_name}</h3>
                  <p className="text-xs text-slate-500">{c.gstin || 'No GSTIN'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              {c.address && <p>{c.address}</p>}
              {c.state && <p>{c.state}</p>}
              {c.email && <p className="text-slate-500">{c.email}</p>}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              {currentCompany?.id === c.id ? (
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Active</span>
              ) : (
                <button
                  onClick={() => switchCompany(c)}
                  className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full hover:bg-slate-200 transition-colors"
                >
                  Switch to this
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium">No companies yet</p>
          <p className="text-sm">Add your first company to get started</p>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {editing ? 'Edit Company' : 'Add Company'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                <input
                  value={form.business_name}
                  onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                <input
                  value={form.gstin}
                  onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={15}
                  placeholder="29ABCDE1234F1Z5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <select
                  value={form.state_code}
                  onChange={e => handleStateChange(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix</label>
                  <input
                    value={form.invoice_prefix}
                    onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="INV"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">FY Start Month</label>
                  <select
                    value={form.fiscal_year_start}
                    onChange={e => setForm(f => ({ ...f, fiscal_year_start: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="01">January</option>
                    <option value="04">April</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditing(null); }}
                  className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
