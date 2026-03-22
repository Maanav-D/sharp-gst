import { useState, useEffect } from 'react';
import { inventoryApi, productsApi } from '../api/client';
import { formatINR, formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import { Plus, Package } from 'lucide-react';

export default function Inventory() {
  const [tab, setTab] = useState('products');
  const [stockLevels, setStockLevels] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const [form, setForm] = useState({
    name: '', hsn_sac: '', description: '', unit: 'NOS', default_price: '', gst_rate: '18',
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    Promise.all([
      inventoryApi.getStockLevels(),
      inventoryApi.getAll(),
    ]).then(([sl, txns]) => {
      setStockLevels(sl);
      setTransactions(txns);
    }).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const [sl, txns] = await Promise.all([inventoryApi.getStockLevels(), inventoryApi.getAll()]);
    setStockLevels(sl);
    setTransactions(txns);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await productsApi.update(editId, form);
        toast.success('Product updated');
      } else {
        await productsApi.create(form);
        toast.success('Product created');
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', hsn_sac: '', description: '', unit: 'NOS', default_price: '', gst_rate: '18' });
      refresh();
    } catch { toast.error('Failed to save product'); }
  };

  const startEdit = (product) => {
    setForm({
      name: product.name, hsn_sac: product.hsn_sac, description: product.description,
      unit: product.unit, default_price: product.default_price, gst_rate: product.gst_rate,
    });
    setEditId(product.id);
    setShowForm(true);
  };

  const stockColor = (status) => {
    if (status === 'red') return 'bg-red-100 text-red-700';
    if (status === 'yellow') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
      <div className="bg-white rounded-xl p-6 h-64 animate-pulse"></div>
    </div>
  );

  const filteredTxns = productFilter
    ? transactions.filter(t => t.product_id === productFilter)
    : transactions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', hsn_sac: '', description: '', unit: 'NOS', default_price: '', gst_rate: '18' }); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Product form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">{editId ? 'Edit Product' : 'New Product'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">HSN/SAC Code</label>
              <input value={form.hsn_sac} onChange={e => setForm({ ...form, hsn_sac: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['NOS', 'PCS', 'KGS', 'MTR', 'LTR', 'BOX', 'SET', 'HRS', 'SQM'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default Price (₹)</label>
              <input type="number" step="0.01" value={form.default_price} onChange={e => setForm({ ...form, default_price: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">GST Rate (%)</label>
              <select value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {[0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'products', label: 'Product Catalogue' },
          { key: 'transactions', label: 'Stock Transactions' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md ${tab === t.key ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Products table */}
      {tab === 'products' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">HSN</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Unit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">GST %</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockLevels.map((p, i) => (
                <tr key={p.id} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.hsn_sac}</td>
                  <td className="px-4 py-2">{p.unit}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatINR(p.default_price)}</td>
                  <td className="px-4 py-2 text-right">{p.gst_rate}%</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stockColor(p.stock_status)}`}>
                      {p.current_stock}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => startEdit(p)} className="text-indigo-600 hover:text-indigo-800 text-xs">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <>
          <div className="flex gap-3">
            <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All Products</option>
              {stockLevels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">No transactions found</td></tr>
                ) : filteredTxns.map((t, i) => {
                  const product = stockLevels.find(p => p.id === t.product_id);
                  return (
                    <tr key={t.id} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                      <td className="px-4 py-2">{formatDate(t.transaction_date)}</td>
                      <td className="px-4 py-2">{product ? product.name : t.product_id}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          t.transaction_type === 'IN' ? 'bg-green-100 text-green-700' :
                          t.transaction_type === 'OUT' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{t.transaction_type}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{t.quantity}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{t.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
