import { useState, useEffect } from 'react';
import { reportsApi } from '../api/client';
import { formatINR, formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Download } from 'lucide-react';

function exportCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(r => headers.map(h => `"${r[h] || ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  toast.success('CSV exported');
}

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [dateRange, setDateRange] = useState({ from_date: '', to_date: '' });
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [hsnData, setHsnData] = useState([]);
  const [custData, setCustData] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [taxData, setTaxData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsApi.salesRegister(dateRange),
      reportsApi.purchaseRegister(dateRange),
      reportsApi.hsnSummary(dateRange),
      reportsApi.customerOutstanding(),
      reportsApi.cashFlow(),
      reportsApi.taxLiability(),
    ]).then(([s, p, h, c, cf, t]) => {
      setSalesData(s); setPurchaseData(p); setHsnData(h); setCustData(c); setCashFlow(cf); setTaxData(t);
    }).finally(() => setLoading(false));
  }, [dateRange]);

  const tabs = [
    { key: 'sales', label: 'Sales Register' },
    { key: 'purchase', label: 'Purchase Register' },
    { key: 'hsn', label: 'HSN Summary' },
    { key: 'customer', label: 'Customer Outstanding' },
    { key: 'cashflow', label: 'Cash Flow' },
    { key: 'tax', label: 'Tax Liability' },
  ];

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
      <div className="bg-white rounded-xl p-6 h-64 animate-pulse"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>

      {/* Date filters */}
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <input type="date" value={dateRange.from_date} onChange={e => setDateRange(d => ({ ...d, from_date: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <input type="date" value={dateRange.to_date} onChange={e => setDateRange(d => ({ ...d, to_date: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md ${tab === t.key ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sales Register */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => exportCSV(salesData, 'sales_register.csv')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Invoice No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Buyer</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Taxable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">CGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">IGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((inv, i) => (
                  <tr key={inv.id} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                    <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-2">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-2">{inv.buyer_name}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.taxable_value)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.cgst)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.sgst)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.igst)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">{formatINR(inv.total_amount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-green-600">{formatINR(inv.paid_amount)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${Number(inv.outstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatINR(inv.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Register */}
      {tab === 'purchase' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => exportCSV(purchaseData, 'purchase_register.csv')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Invoice No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Supplier</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Taxable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">CGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">IGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseData.map((inv, i) => (
                  <tr key={inv.id} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                    <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-2">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-2">{inv.buyer_name}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.taxable_value)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.cgst)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.sgst)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(inv.igst)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">{formatINR(inv.total_amount)}</td>
                    <td className="px-4 py-2">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HSN Summary */}
      {tab === 'hsn' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => exportCSV(hsnData, 'hsn_summary.csv')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">HSN Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Taxable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">CGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">IGST</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {hsnData.map((h, i) => (
                  <tr key={h.hsn_sac} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                    <td className="px-4 py-2 font-medium font-mono">{h.hsn_sac}</td>
                    <td className="px-4 py-2">{h.description}</td>
                    <td className="px-4 py-2 text-right font-mono">{h.total_quantity}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(h.taxable_value)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(h.cgst)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(h.sgst)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(h.igst)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">{formatINR(h.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Outstanding */}
      {tab === 'customer' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => exportCSV(custData, 'customer_outstanding.csv')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">GSTIN</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total Invoiced</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {custData.map((c, i) => (
                  <tr key={c.customer_name} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                    <td className="px-4 py-2 font-medium">{c.customer_name}</td>
                    <td className="px-4 py-2 text-gray-500">{c.gstin || 'N/A'}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(c.total_invoiced)}</td>
                    <td className="px-4 py-2 text-right font-mono text-green-600">{formatINR(c.total_paid)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${Number(c.outstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatINR(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {tab === 'cashflow' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Cash Flow</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend />
                <Bar dataKey="invoiced" name="Invoiced" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Received" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-end">
            <button onClick={() => exportCSV(cashFlow, 'cash_flow.csv')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Tax Liability */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Tax Liability Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={taxData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend />
                <Line type="monotone" dataKey="total_output" name="Output Tax" stroke="#EF4444" strokeWidth={2} />
                <Line type="monotone" dataKey="total_itc" name="ITC" stroke="#22C55E" strokeWidth={2} />
                <Line type="monotone" dataKey="net_payable" name="Net Payable" stroke="#4F46E5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-end">
            <button onClick={() => exportCSV(taxData, 'tax_liability.csv')}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Month</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">CGST Payable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SGST Payable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">IGST Payable</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">ITC Available</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {taxData.map((t, i) => (
                  <tr key={t.month} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`} style={{height: '40px'}}>
                    <td className="px-4 py-2 font-medium">{t.label}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(t.cgst_payable)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(t.sgst_payable)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatINR(t.igst_payable)}</td>
                    <td className="px-4 py-2 text-right font-mono text-green-600">{formatINR(t.total_itc)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${Number(t.net_payable) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatINR(t.net_payable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
