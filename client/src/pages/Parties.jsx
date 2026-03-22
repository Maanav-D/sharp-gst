import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi, invoicesApi } from '../api/client';
import { formatINR, formatDate, INDIAN_STATES, getStateName } from '../utils/format';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Eye, X, Users } from 'lucide-react';

const GSTIN_TYPES = ['REGULAR', 'COMPOSITION', 'UNREGISTERED'];

function PartyForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', gstin: '', email: '', phone: '', address: '',
    state_code: '', gstin_type: 'REGULAR',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Party name is required');
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{initial ? 'Edit Party' : 'Add New Party'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Party Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Business or person name" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">GSTIN</label>
          <input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">GSTIN Type</label>
          <select value={form.gstin_type} onChange={e => setForm(f => ({ ...f, gstin_type: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
            {GSTIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
          <select value={form.state_code} onChange={e => setForm(f => ({ ...f, state_code: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
            <option value="">Select State</option>
            {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            placeholder="email@example.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            placeholder="+91-9876543210" />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
          <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            rows={2} placeholder="Full address" />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit"
          className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          {initial ? 'Update Party' : 'Add Party'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-5 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Parties() {
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editParty, setEditParty] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [partyInvoices, setPartyInvoices] = useState({});
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const fetchParties = async () => {
    try {
      const data = await customersApi.getAll();
      setParties(data);
    } catch {
      toast.error('Failed to load parties');
    }
    setLoading(false);
  };

  useEffect(() => { fetchParties(); }, []);

  const handleSave = async (form) => {
    try {
      if (editParty) {
        await customersApi.update(editParty.id, form);
        toast.success('Party updated');
      } else {
        await customersApi.create(form);
        toast.success('Party added');
      }
      setShowForm(false);
      setEditParty(null);
      fetchParties();
    } catch {
      toast.error('Failed to save party');
    }
  };

  const handleDelete = async (party) => {
    if (!confirm(`Delete "${party.name}"? This action cannot be undone.`)) return;
    try {
      await customersApi.remove(party.id);
      toast.success('Party deleted');
      fetchParties();
    } catch {
      toast.error('Failed to delete party');
    }
  };

  const handleEdit = (party) => {
    setEditParty(party);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpand = async (partyId, partyName, partyGstin) => {
    if (expandedId === partyId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(partyId);
    if (!partyInvoices[partyId]) {
      try {
        const params = {};
        if (partyGstin) params.buyer_gstin = partyGstin;
        else params.buyer_name = partyName;
        const invoices = await invoicesApi.getAll(params);
        setPartyInvoices(prev => ({ ...prev, [partyId]: invoices }));
      } catch {
        setPartyInvoices(prev => ({ ...prev, [partyId]: [] }));
      }
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // Filter and sort
  let filtered = parties;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.gstin || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.phone || '').includes(q)
    );
  }
  if (typeFilter) {
    filtered = filtered.filter(p => p.gstin_type === typeFilter);
  }
  filtered = [...filtered].sort((a, b) => {
    const aVal = (a[sortField] || '').toLowerCase();
    const bVal = (b[sortField] || '').toLowerCase();
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const SortHeader = ({ field, label, className = '' }) => (
    <th onClick={() => handleSort(field)}
      className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none ${className}`}>
      {label} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}
    </th>
  );

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Parties</h1>
      <div className="grid grid-cols-1 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 h-16 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Parties</h1>
          <p className="text-sm text-gray-500 mt-1">{parties.length} total clients/suppliers</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditParty(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Add Party
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <PartyForm
          initial={editParty}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditParty(null); }}
        />
      )}

      {/* Search and filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, GSTIN, email, phone..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {GSTIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <SortHeader field="name" label="Party Name" className="text-left" />
              <SortHeader field="gstin" label="GSTIN" className="text-left" />
              <SortHeader field="gstin_type" label="Type" className="text-left" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">State</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Users size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400">No parties found</p>
                  <p className="text-xs text-gray-400 mt-1">Add your first client or supplier</p>
                </td>
              </tr>
            ) : filtered.map((party, i) => (
              <>
                <tr key={party.id}
                  className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100 cursor-pointer`}
                  style={{ height: '40px' }}
                  onClick={() => toggleExpand(party.id, party.name, party.gstin)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{party.name}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-600 text-xs">
                    {party.gstin || <span className="text-gray-400 italic">Unregistered</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      party.gstin_type === 'REGULAR' ? 'bg-green-100 text-green-700' :
                      party.gstin_type === 'COMPOSITION' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {party.gstin_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{getStateName(party.state_code)}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs text-gray-500">
                      {party.email && <span className="block">{party.email}</span>}
                      {party.phone && <span className="block">{party.phone}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleExpand(party.id, party.name, party.gstin)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50" title="View invoices">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleEdit(party)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50" title="Edit">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleDelete(party)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded row: invoices for this party */}
                {expandedId === party.id && (
                  <tr key={`${party.id}-expanded`}>
                    <td colSpan={6} className="bg-slate-50 px-6 py-4 border-t border-gray-100">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-gray-600 uppercase">
                            Invoices for {party.name}
                          </h4>
                          <button onClick={() => navigate('/invoices/create')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                            + Create Invoice
                          </button>
                        </div>
                        {party.address && (
                          <p className="text-xs text-gray-500">Address: {party.address}</p>
                        )}
                        {!partyInvoices[party.id] ? (
                          <p className="text-xs text-gray-400">Loading invoices...</p>
                        ) : partyInvoices[party.id].length === 0 ? (
                          <p className="text-xs text-gray-400">No invoices found for this party.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1.5 pr-4">Invoice No</th>
                                <th className="text-left py-1.5 pr-4">Date</th>
                                <th className="text-left py-1.5 pr-4">Type</th>
                                <th className="text-right py-1.5 pr-4">Amount</th>
                                <th className="text-left py-1.5">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {partyInvoices[party.id].map(inv => (
                                <tr key={inv.id} className="border-t border-gray-200 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => navigate(`/invoices/${inv.id}`)}>
                                  <td className="py-1.5 pr-4 font-medium text-indigo-600">{inv.invoice_number}</td>
                                  <td className="py-1.5 pr-4">{formatDate(inv.invoice_date)}</td>
                                  <td className="py-1.5 pr-4">{inv.invoice_type}</td>
                                  <td className="py-1.5 pr-4 text-right font-mono">{formatINR(inv.total_amount)}</td>
                                  <td className="py-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                      inv.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                                      inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                      inv.status === 'CANCELLED' ? 'bg-gray-200 text-gray-500' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>{inv.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
