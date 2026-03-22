import { useState } from 'react';
import { returnsApi } from '../api/client';
import { formatINR } from '../utils/format';
import toast from 'react-hot-toast';
import { Download, FileJson } from 'lucide-react';

function SummaryTable({ title, data, columns }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-500 py-4">No data for this category.</p>;

  const totals = {};
  columns.filter(c => c.numeric).forEach(c => {
    totals[c.key] = data.reduce((s, r) => s + Number(r[c.key] || 0), 0);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase ${col.numeric ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50' : ''} hover:bg-gray-100`}>
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-2.5 ${col.numeric ? 'text-right font-mono' : ''}`}>
                  {col.numeric ? formatINR(row[col.key]) : (row[col.key] || '-')}
                </td>
              ))}
            </tr>
          ))}
          {/* Totals row */}
          <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
            {columns.map((col, ci) => (
              <td key={col.key} className={`px-4 py-2.5 ${col.numeric ? 'text-right font-mono' : ''}`}>
                {ci === 0 ? 'TOTAL' : (col.numeric ? formatINR(totals[col.key]) : '')}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function GSTR1() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('b2b');

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await returnsApi.getGSTR1(month, year);
      setData(result);
    } catch { toast.error('Failed to fetch GSTR-1 data'); }
    setLoading(false);
  };

  const exportJson = async () => {
    try {
      const json = await returnsApi.exportGSTR1(month, year);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${month}_${year}.json`;
      a.click();
      toast.success('GSTR-1 JSON exported');
    } catch { toast.error('Export failed'); }
  };

  const downloadCSV = (tableData, filename) => {
    if (!tableData || tableData.length === 0) return;
    const headers = Object.keys(tableData[0]);
    const csv = [headers.join(','), ...tableData.map(r => headers.map(h => `"${r[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    toast.success('CSV downloaded');
  };

  const b2bCols = [
    { key: 'buyer_gstin', label: 'Buyer GSTIN' },
    { key: 'buyer_name', label: 'Buyer Name' },
    { key: 'invoice_count', label: 'Invoices' },
    { key: 'taxable_value', label: 'Taxable Value', numeric: true },
    { key: 'cgst', label: 'CGST', numeric: true },
    { key: 'sgst', label: 'SGST', numeric: true },
    { key: 'igst', label: 'IGST', numeric: true },
    { key: 'total', label: 'Total', numeric: true },
  ];

  const b2cCols = [
    { key: 'invoice_number', label: 'Invoice No' },
    { key: 'buyer_name', label: 'Buyer' },
    { key: 'taxable_value', label: 'Taxable Value', numeric: true },
    { key: 'cgst', label: 'CGST', numeric: true },
    { key: 'sgst', label: 'SGST', numeric: true },
    { key: 'igst', label: 'IGST', numeric: true },
    { key: 'total_amount', label: 'Total', numeric: true },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">GSTR-1 Preview</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Loading...' : 'Generate Preview'}
          </button>
          {data && (
            <>
              <button onClick={exportJson}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                <FileJson size={16} /> Export JSON
              </button>
            </>
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-600">
              Period: <strong>{data.period}</strong> | Total Invoices: <strong>{data.totalInvoices}</strong> |
              B2B: <strong>{data.b2b.length}</strong> |
              B2C Large: <strong>{data.b2cLarge.length}</strong> |
              B2C Small: <strong>{data.b2cSmall.length}</strong> |
              Credit/Debit Notes: <strong>{data.creditDebitNotes.length}</strong>
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { key: 'b2b', label: 'B2B Summary' },
              { key: 'b2c', label: 'B2C Summary' },
              { key: 'cdn', label: 'Credit/Debit Notes' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm rounded-md ${tab === t.key ? 'bg-white font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex justify-end p-3 border-b border-gray-100">
              <button onClick={() => {
                const tableData = tab === 'b2b' ? data.b2b : tab === 'b2c' ? [...data.b2cLarge, ...data.b2cSmall] : data.creditDebitNotes;
                downloadCSV(tableData, `GSTR1_${tab}_${month}_${year}.csv`);
              }} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
                <Download size={14} /> Download CSV
              </button>
            </div>
            {tab === 'b2b' && <SummaryTable data={data.b2b} columns={b2bCols} />}
            {tab === 'b2c' && <SummaryTable data={[...data.b2cLarge, ...data.b2cSmall]} columns={b2cCols} />}
            {tab === 'cdn' && <SummaryTable data={data.creditDebitNotes} columns={b2cCols} />}
          </div>
        </>
      )}
    </div>
  );
}
