import { useState } from 'react';
import { returnsApi } from '../api/client';
import { formatINR } from '../utils/format';
import toast from 'react-hot-toast';
import { Upload, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export default function ITCReconciliation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('matched');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await returnsApi.reconcileITC(file);
      setData(result);
      toast.success('Reconciliation complete');
    } catch {
      toast.error('Failed to reconcile');
    }
    setLoading(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">ITC Reconciliation</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Upload GSTR-2B CSV</h3>
        <p className="text-xs text-gray-500 mb-4">
          Upload a CSV with columns: supplier_gstin, invoice_number, invoice_date, taxable_value, igst, cgst, sgst
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 cursor-pointer">
          <Upload size={16} />
          {loading ? 'Processing...' : 'Choose File'}
          <input type="file" accept=".csv" onChange={handleUpload} className="hidden" disabled={loading} />
        </label>
      </div>

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500">Total ITC in Books</p>
              <p className="text-xl font-semibold font-mono">{formatINR(data.summary.total_itc_books)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-500">Total ITC in GSTR-2B</p>
              <p className="text-xl font-semibold font-mono">{formatINR(data.summary.total_itc_2b)}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs text-gray-500">Matched ITC</p>
              <p className="text-xl font-semibold font-mono text-green-600">{formatINR(data.summary.matched_itc)}</p>
            </div>
            <div className={`rounded-xl p-4 ${data.summary.variance > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="text-xs text-gray-500">Variance</p>
              <p className={`text-xl font-semibold font-mono ${data.summary.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatINR(Math.abs(data.summary.variance))}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { key: 'matched', label: `Matched (${data.matched.length})`, icon: CheckCircle, color: 'text-green-500' },
              { key: 'books', label: `Only in Books (${data.onlyInBooks.length})`, icon: AlertTriangle, color: 'text-amber-500' },
              { key: '2b', label: `Only in 2B (${data.onlyIn2B.length})`, icon: XCircle, color: 'text-red-500' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md ${
                  tab === t.key ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <t.icon size={14} className={tab === t.key ? t.color : ''} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tables */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {tab === 'matched' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Supplier GSTIN</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Invoice No</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Books ITC</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">2B ITC</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matched.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No matched entries</td></tr>
                  ) : data.matched.map((m, i) => {
                    const booksItc = Number(m.books.cgst || 0) + Number(m.books.sgst || 0) + Number(m.books.igst || 0);
                    const twoBItc = Number(m.gstr2b.cgst || 0) + Number(m.gstr2b.sgst || 0) + Number(m.gstr2b.igst || 0);
                    return (
                      <tr key={i} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''}`}>
                        <td className="px-4 py-2.5">{m.books.seller_gstin || m.books.buyer_gstin}</td>
                        <td className="px-4 py-2.5">{m.books.invoice_number}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatINR(booksItc)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatINR(twoBItc)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatINR(booksItc - twoBItc)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tab === 'books' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Supplier</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Invoice No</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Taxable</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">GST</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {data.onlyInBooks.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No entries only in books</td></tr>
                  ) : data.onlyInBooks.map((inv, i) => (
                    <tr key={i} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-2.5">{inv.buyer_name || inv.seller_gstin}</td>
                      <td className="px-4 py-2.5">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatINR(inv.taxable_value)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatINR(Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0))}</td>
                      <td className="px-4 py-2.5 text-amber-600 text-xs">ITC claim deferred</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === '2b' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Supplier GSTIN</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Invoice No</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Taxable</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">GST</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {data.onlyIn2B.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">No entries only in 2B</td></tr>
                  ) : data.onlyIn2B.map((row, i) => (
                    <tr key={i} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-2.5">{row.supplier_gstin}</td>
                      <td className="px-4 py-2.5">{row.invoice_number}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatINR(row.taxable_value)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatINR(Number(row.cgst || 0) + Number(row.sgst || 0) + Number(row.igst || 0))}</td>
                      <td className="px-4 py-2.5 text-red-600 text-xs">Missing from books</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
